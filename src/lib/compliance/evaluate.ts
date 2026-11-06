import {
  CUTOFF_DATE,
  DETER_ATTENTION_CLASSES,
  DETER_DEFORESTATION_CLASSES,
  MAX_OUTSIDE_COVERAGE_HA,
  MIN_OVERLAP_HA,
  PRODES_ATTENTION_YEAR,
  PRODES_NON_COMPLIANT_FROM_YEAR,
  RULES_VERSION,
} from "./constants";
import type {
  ComplianceFacts,
  ComplianceResult,
  ComplianceStatus,
  DeforestationFinding,
  DeforestationOverlap,
  FindingEffect,
  FindingReason,
  ImageryStatus,
  ProtectedAreaFinding,
  ProtectedAreaOverlap,
  StatusReason,
} from "./types";

const deforestationClasses: readonly string[] = DETER_DEFORESTATION_CLASSES;
const attentionClasses: readonly string[] = DETER_ATTENTION_CLASSES;

/** Areas are reported with 4 decimals (1 m²); thresholds use the exact value. */
export function roundHa(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** ISO dates compare correctly as strings. A missing date is treated as after the cut-off. */
export function isAfterCutoff(date: string | null): boolean {
  return date === null || date.slice(0, 10) > CUTOFF_DATE;
}

/** Effect of a deforestation polygon before applying the minimum overlap. */
export function classifyDeforestation(o: DeforestationOverlap): {
  effect: FindingEffect;
  reason: FindingReason;
} {
  if (o.source === "PRODES") {
    if (o.prodes_year === null || o.prodes_year === PRODES_ATTENTION_YEAR) {
      return { effect: "attention", reason: "prodes_mixed_year" };
    }
    if (o.prodes_year >= PRODES_NON_COMPLIANT_FROM_YEAR) {
      return { effect: "non_compliant", reason: "prodes_after_cutoff" };
    }
    return { effect: "info", reason: "prodes_before_cutoff" };
  }

  const after = isAfterCutoff(o.detected_at);
  const cls = o.class_name ?? "";
  if (deforestationClasses.includes(cls)) {
    return after
      ? { effect: "non_compliant", reason: "deter_deforestation_after_cutoff" }
      : { effect: "info", reason: "deter_deforestation_before_cutoff" };
  }
  if (attentionClasses.includes(cls)) {
    return after
      ? { effect: "attention", reason: "deter_attention_after_cutoff" }
      : { effect: "info", reason: "deter_attention_before_cutoff" };
  }
  // Unknown class: never ignored silently.
  return after
    ? { effect: "attention", reason: "deter_unknown_class" }
    : { effect: "info", reason: "deter_unknown_class" };
}

function toDeforestationFinding(o: DeforestationOverlap): DeforestationFinding {
  const { effect, reason } = classifyDeforestation(o);
  const belowMin = o.overlap_ha < MIN_OVERLAP_HA;
  return {
    type: "deforestation",
    source: o.source,
    class: o.class_name,
    detected_at: o.detected_at,
    prodes_year: o.prodes_year,
    overlap_ha: roundHa(o.overlap_ha),
    reference_id: o.external_id,
    effect: belowMin ? "info" : effect,
    reason,
    below_min_overlap: belowMin,
    synthetic: o.is_synthetic,
  };
}

function toProtectedAreaFinding(o: ProtectedAreaOverlap): ProtectedAreaFinding {
  const belowMin = o.overlap_ha < MIN_OVERLAP_HA;
  return {
    type: "protected_area",
    kind: o.kind,
    name: o.name,
    category: o.category,
    overlap_ha: roundHa(o.overlap_ha),
    reference_id: o.external_id,
    effect: belowMin ? "info" : "non_compliant",
    reason: "protected_area_overlap",
    below_min_overlap: belowMin,
  };
}

const severity: Record<FindingEffect, number> = { non_compliant: 0, attention: 1, info: 2 };

function compareFindings(a: DeforestationFinding, b: DeforestationFinding): number {
  return (
    severity[a.effect] - severity[b.effect] ||
    (b.detected_at ?? "").localeCompare(a.detected_at ?? "") ||
    b.overlap_ha - a.overlap_ha
  );
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/**
 * Applies the rules of PLANO.md 5.2, in order:
 * 1. outside the coverage region (at least MAX_OUTSIDE_COVERAGE_HA outside)
 *    -> NO_COVERAGE;
 * 2. post-cut-off deforestation (DETER deforestation classes, PRODES >= 2022) or
 *    protected-area overlap, each of at least MIN_OVERLAP_HA -> NON_COMPLIANT;
 * 3. PRODES 2021, post-cut-off DETER degradation/fire/selective logging, or
 *    recent imagery unavailable -> ATTENTION;
 * 4. otherwise COMPLIANT.
 *
 * PRODES 2021 "without DETER confirmation": when a post-cut-off DETER
 * deforestation alert confirms it, rule 2 already applies.
 */
export function evaluateCompliance(
  facts: ComplianceFacts,
  options: { imagery?: ImageryStatus } = {},
): ComplianceResult {
  const imagery = options.imagery ?? "not_checked";
  const findings = facts.deforestation.map(toDeforestationFinding).sort(compareFindings);
  const protectedAreas = facts.protected_areas
    .map(toProtectedAreaFinding)
    .sort((a, b) => severity[a.effect] - severity[b.effect] || b.overlap_ha - a.overlap_ha);

  const all = [...findings, ...protectedAreas];
  const nonCompliant = all.filter((f) => f.effect === "non_compliant");
  const attention = all.filter((f) => f.effect === "attention");

  let status: ComplianceStatus;
  let statusReasons: StatusReason[];
  if (facts.outside_coverage_ha >= MAX_OUTSIDE_COVERAGE_HA) {
    status = "NO_COVERAGE";
    statusReasons = ["outside_coverage"];
  } else if (nonCompliant.length > 0) {
    status = "NON_COMPLIANT";
    statusReasons = unique(nonCompliant.map((f) => f.reason));
  } else if (attention.length > 0 || imagery === "unavailable") {
    status = "ATTENTION";
    statusReasons = unique<StatusReason>([
      ...attention.map((f) => f.reason),
      ...(imagery === "unavailable" ? (["recent_imagery_unavailable"] as const) : []),
    ]);
  } else {
    status = "COMPLIANT";
    statusReasons = [];
  }

  return {
    status,
    farm_area_ha: roundHa(facts.farm_area_ha),
    analysis_area_ha: roundHa(facts.analysis_area_ha),
    municipality: facts.municipality,
    findings,
    protected_area_overlaps: protectedAreas,
    status_reasons: statusReasons,
    imagery,
    includes_synthetic: findings.some((f) => f.synthetic),
    parameters: {
      cutoff_date: CUTOFF_DATE,
      border_tolerance_m: facts.border_tolerance_m,
      border_tolerance_applied: facts.border_tolerance_applied,
      min_overlap_ha: MIN_OVERLAP_HA,
    },
    data_versions: facts.data_versions,
    rules_version: RULES_VERSION,
  };
}
