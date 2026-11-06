/**
 * Input of the compliance engine: geometric facts computed by the SQL function
 * public.compliance_facts (PostGIS, areas with geography). The engine never
 * touches geometry; it only applies the rules to these facts.
 */
export type ComplianceFacts = {
  /** Area of the analysis polygon outside the pilot municipalities (ha). */
  outside_coverage_ha: number;
  /** Pilot municipality that contains most of the farm, if any. */
  municipality: { name: string; geocode: string } | null;
  farm_area_ha: number;
  /** Area after the inner border buffer (equals farm_area_ha if the buffer emptied it). */
  analysis_area_ha: number;
  border_tolerance_m: number;
  /** False when the buffer emptied the polygon and the original was used. */
  border_tolerance_applied: boolean;
  deforestation: DeforestationOverlap[];
  protected_areas: ProtectedAreaOverlap[];
  data_versions: DataVersions;
};

export type DeforestationOverlap = {
  id: number;
  source: "DETER" | "PRODES";
  external_id: string | null;
  class_name: string | null;
  detected_at: string | null; // ISO date
  prodes_year: number | null;
  overlap_ha: number;
  is_synthetic: boolean;
};

export type ProtectedAreaOverlap = {
  id: number;
  kind: "TI" | "UC";
  external_id: string;
  name: string | null;
  category: string | null;
  overlap_ha: number;
};

/** Latest imported version of each source (from data_snapshots). */
export type DataVersions = {
  DETER: string | null; // latest view_date imported
  PRODES: string | null; // latest PRODES year imported
  TI: string | null; // date of the last import
  UC: string | null; // CNUC edition
};

export type ComplianceStatus = "COMPLIANT" | "ATTENTION" | "NON_COMPLIANT" | "NO_COVERAGE";

/** Effect of one finding on the verdict. */
export type FindingEffect = "non_compliant" | "attention" | "info";

export type FindingReason =
  | "deter_deforestation_after_cutoff"
  | "deter_deforestation_before_cutoff"
  | "deter_attention_after_cutoff"
  | "deter_attention_before_cutoff"
  | "deter_unknown_class"
  | "prodes_after_cutoff"
  | "prodes_mixed_year"
  | "prodes_before_cutoff"
  | "protected_area_overlap";

export type StatusReason = FindingReason | "outside_coverage" | "recent_imagery_unavailable";

export type DeforestationFinding = {
  type: "deforestation";
  source: "DETER" | "PRODES";
  class: string | null;
  detected_at: string | null;
  prodes_year: number | null;
  overlap_ha: number;
  reference_id: string | null;
  effect: FindingEffect;
  /** Classification of the polygon; when below_min_overlap, effect is "info". */
  reason: FindingReason;
  below_min_overlap: boolean;
  synthetic: boolean;
};

export type ProtectedAreaFinding = {
  type: "protected_area";
  kind: "TI" | "UC";
  name: string | null;
  category: string | null;
  overlap_ha: number;
  reference_id: string;
  effect: FindingEffect;
  reason: FindingReason;
  below_min_overlap: boolean;
};

export type ImageryStatus = "available" | "unavailable" | "not_checked";

/** Stored in checks.result (PLANO.md 5.3). */
export type ComplianceResult = {
  status: ComplianceStatus;
  farm_area_ha: number;
  analysis_area_ha: number;
  municipality: { name: string; geocode: string } | null;
  findings: DeforestationFinding[];
  protected_area_overlaps: ProtectedAreaFinding[];
  /** Short machine-readable reasons for the status (empty when COMPLIANT). */
  status_reasons: StatusReason[];
  imagery: ImageryStatus;
  /** True if any finding comes from the demo alert simulation. */
  includes_synthetic: boolean;
  parameters: {
    cutoff_date: string;
    border_tolerance_m: number;
    border_tolerance_applied: boolean;
    min_overlap_ha: number;
  };
  data_versions: DataVersions;
  rules_version: string;
};
