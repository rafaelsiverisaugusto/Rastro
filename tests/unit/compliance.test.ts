import { describe, expect, it } from "vitest";

import {
  BORDER_TOLERANCE_M,
  CUTOFF_DATE,
  MIN_OVERLAP_HA,
  RULES_VERSION,
} from "@/lib/compliance/constants";
import {
  classifyDeforestation,
  evaluateCompliance,
  isAfterCutoff,
} from "@/lib/compliance/evaluate";
import type {
  ComplianceFacts,
  DeforestationOverlap,
  ProtectedAreaOverlap,
} from "@/lib/compliance/types";

let nextId = 1;

function facts(overrides: Partial<ComplianceFacts> = {}): ComplianceFacts {
  return {
    outside_coverage_ha: 0,
    municipality: { name: "Uruará", geocode: "1508159" },
    farm_area_ha: 38.6,
    analysis_area_ha: 36.1,
    border_tolerance_m: BORDER_TOLERANCE_M,
    border_tolerance_applied: true,
    deforestation: [],
    protected_areas: [],
    data_versions: { DETER: "2026-10-23", PRODES: "2025", TI: "2026-11-05", UC: "2025_08" },
    ...overrides,
  };
}

function deter(
  class_name: string,
  detected_at: string,
  overlap_ha = 1,
  extra: Partial<DeforestationOverlap> = {},
): DeforestationOverlap {
  return {
    id: nextId++,
    source: "DETER",
    external_id: `x_hist|${detected_at}|${class_name}|1508159`,
    class_name,
    detected_at,
    prodes_year: null,
    overlap_ha,
    is_synthetic: false,
    ...extra,
  };
}

function prodes(year: number, overlap_ha = 1): DeforestationOverlap {
  return {
    id: nextId++,
    source: "PRODES",
    external_id: `uuid-${year}`,
    class_name: `d${year}`,
    detected_at: `${year}-07-20`,
    prodes_year: year,
    overlap_ha,
    is_synthetic: false,
  };
}

function ti(overlap_ha: number): ProtectedAreaOverlap {
  return {
    id: nextId++,
    kind: "TI",
    external_id: "3201",
    name: "Arara",
    category: "Regularizada",
    overlap_ha,
  };
}

describe("compliance rules (PLANO.md 5.4)", () => {
  it("no overlap -> COMPLIANT", () => {
    const r = evaluateCompliance(facts());
    expect(r.status).toBe("COMPLIANT");
    expect(r.findings).toEqual([]);
    expect(r.status_reasons).toEqual([]);
  });

  it("overlap below the minimum is listed as information only", () => {
    const r = evaluateCompliance(
      facts({ deforestation: [deter("DESMATAMENTO_CR", "2023-08-14", 0.06)] }),
    );
    expect(r.status).toBe("COMPLIANT");
    expect(r.findings[0]).toMatchObject({
      effect: "info",
      below_min_overlap: true,
      reason: "deter_deforestation_after_cutoff",
    });
  });

  it("the minimum overlap itself already counts", () => {
    const r = evaluateCompliance(
      facts({ deforestation: [deter("DESMATAMENTO_CR", "2023-08-14", MIN_OVERLAP_HA)] }),
    );
    expect(r.status).toBe("NON_COMPLIANT");
  });

  it("DETER deforestation before the cut-off -> COMPLIANT, with an informative finding", () => {
    const r = evaluateCompliance(
      facts({ deforestation: [deter("DESMATAMENTO_CR", "2020-06-15")] }),
    );
    expect(r.status).toBe("COMPLIANT");
    expect(r.findings[0]).toMatchObject({
      effect: "info",
      reason: "deter_deforestation_before_cutoff",
    });
  });

  it("DETER on the cut-off date itself is not after it", () => {
    expect(isAfterCutoff(CUTOFF_DATE)).toBe(false);
    expect(isAfterCutoff("2021-01-01")).toBe(true);
    const r = evaluateCompliance(facts({ deforestation: [deter("DESMATAMENTO_CR", CUTOFF_DATE)] }));
    expect(r.status).toBe("COMPLIANT");
  });

  it.each(["DESMATAMENTO_CR", "DESMATAMENTO_VEG", "MINERACAO"])(
    "DETER %s after the cut-off -> NON_COMPLIANT",
    (cls) => {
      const r = evaluateCompliance(facts({ deforestation: [deter(cls, "2023-08-14", 9.8)] }));
      expect(r.status).toBe("NON_COMPLIANT");
      expect(r.status_reasons).toEqual(["deter_deforestation_after_cutoff"]);
      expect(r.findings[0]).toMatchObject({
        type: "deforestation",
        source: "DETER",
        class: cls,
        detected_at: "2023-08-14",
        overlap_ha: 9.8,
        effect: "non_compliant",
      });
    },
  );

  it("PRODES 2021 alone -> ATTENTION", () => {
    const r = evaluateCompliance(facts({ deforestation: [prodes(2021)] }));
    expect(r.status).toBe("ATTENTION");
    expect(r.status_reasons).toEqual(["prodes_mixed_year"]);
  });

  it("PRODES 2021 confirmed by a post-cut-off DETER deforestation alert -> NON_COMPLIANT", () => {
    const r = evaluateCompliance(
      facts({ deforestation: [prodes(2021), deter("DESMATAMENTO_CR", "2021-03-02")] }),
    );
    expect(r.status).toBe("NON_COMPLIANT");
  });

  it.each([2022, 2025])("PRODES %i -> NON_COMPLIANT", (year) => {
    const r = evaluateCompliance(facts({ deforestation: [prodes(year)] }));
    expect(r.status).toBe("NON_COMPLIANT");
    expect(r.status_reasons).toEqual(["prodes_after_cutoff"]);
  });

  it("PRODES 2020 -> COMPLIANT, informative", () => {
    const r = evaluateCompliance(facts({ deforestation: [prodes(2020)] }));
    expect(r.status).toBe("COMPLIANT");
    expect(r.findings[0].effect).toBe("info");
  });

  it.each([
    "DEGRADACAO",
    "CICATRIZ_DE_QUEIMADA",
    "CS_DESORDENADO",
    "CS_GEOMETRICO",
    "CORTE_SELETIVO",
  ])("DETER %s after the cut-off -> ATTENTION", (cls) => {
    const r = evaluateCompliance(facts({ deforestation: [deter(cls, "2024-03-10")] }));
    expect(r.status).toBe("ATTENTION");
    expect(r.status_reasons).toEqual(["deter_attention_after_cutoff"]);
  });

  it("degradation before the cut-off is informative", () => {
    const r = evaluateCompliance(facts({ deforestation: [deter("DEGRADACAO", "2019-09-01")] }));
    expect(r.status).toBe("COMPLIANT");
  });

  it("an unknown DETER class is never ignored", () => {
    expect(classifyDeforestation(deter("NOVA_CLASSE", "2025-01-10"))).toEqual({
      effect: "attention",
      reason: "deter_unknown_class",
    });
    expect(
      evaluateCompliance(facts({ deforestation: [deter("NOVA_CLASSE", "2025-01-10")] })).status,
    ).toBe("ATTENTION");
  });

  it("indigenous land overlap -> NON_COMPLIANT (legality risk)", () => {
    const r = evaluateCompliance(facts({ protected_areas: [ti(3.4)] }));
    expect(r.status).toBe("NON_COMPLIANT");
    expect(r.status_reasons).toEqual(["protected_area_overlap"]);
    expect(r.protected_area_overlaps[0]).toMatchObject({
      type: "protected_area",
      kind: "TI",
      name: "Arara",
      effect: "non_compliant",
    });
  });

  it("protected-area overlap below the minimum is informative", () => {
    const r = evaluateCompliance(facts({ protected_areas: [ti(0.05)] }));
    expect(r.status).toBe("COMPLIANT");
    expect(r.protected_area_overlaps[0]).toMatchObject({ effect: "info", below_min_overlap: true });
  });

  it("outside the coverage region -> NO_COVERAGE, even with findings", () => {
    const r = evaluateCompliance(
      facts({ outside_coverage_ha: 12, deforestation: [deter("DESMATAMENTO_CR", "2023-08-14")] }),
    );
    expect(r.status).toBe("NO_COVERAGE");
    expect(r.status_reasons).toEqual(["outside_coverage"]);
  });

  it("a sliver outside the region (below the minimum) does not remove coverage", () => {
    expect(evaluateCompliance(facts({ outside_coverage_ha: 0.01 })).status).toBe("COMPLIANT");
  });
});

describe("compliance result", () => {
  it("recent imagery unavailable -> ATTENTION; not yet checked has no effect", () => {
    expect(evaluateCompliance(facts(), { imagery: "unavailable" })).toMatchObject({
      status: "ATTENTION",
      status_reasons: ["recent_imagery_unavailable"],
    });
    expect(evaluateCompliance(facts()).status).toBe("COMPLIANT");
    expect(evaluateCompliance(facts()).imagery).toBe("not_checked");
  });

  it("non-compliance wins over attention and imagery", () => {
    const r = evaluateCompliance(
      facts({ deforestation: [deter("DEGRADACAO", "2024-01-01"), prodes(2023)] }),
      { imagery: "unavailable" },
    );
    expect(r.status).toBe("NON_COMPLIANT");
    expect(r.status_reasons).toEqual(["prodes_after_cutoff"]);
  });

  it("orders findings by severity, then most recent first", () => {
    const r = evaluateCompliance(
      facts({
        deforestation: [
          deter("DESMATAMENTO_CR", "2019-01-01"),
          deter("DEGRADACAO", "2024-01-01"),
          deter("DESMATAMENTO_CR", "2022-05-05"),
          deter("DESMATAMENTO_CR", "2025-05-05"),
        ],
      }),
    );
    expect(r.findings.map((f) => [f.effect, f.detected_at])).toEqual([
      ["non_compliant", "2025-05-05"],
      ["non_compliant", "2022-05-05"],
      ["attention", "2024-01-01"],
      ["info", "2019-01-01"],
    ]);
  });

  it("flags findings that come from the alert simulation", () => {
    const r = evaluateCompliance(
      facts({ deforestation: [deter("DESMATAMENTO_CR", "2026-11-20", 2, { is_synthetic: true })] }),
    );
    expect(r.includes_synthetic).toBe(true);
    expect(r.findings[0].synthetic).toBe(true);
  });

  it("rounds areas to 1 m² and records parameters, data versions and rules version", () => {
    const r = evaluateCompliance(
      facts({
        farm_area_ha: 38.612345678,
        deforestation: [deter("DESMATAMENTO_CR", "2023-08-14", 9.87654321)],
      }),
    );
    expect(r.farm_area_ha).toBe(38.6123);
    expect(r.findings[0].overlap_ha).toBe(9.8765);
    expect(r.parameters).toEqual({
      cutoff_date: "2020-12-31",
      border_tolerance_m: 10,
      border_tolerance_applied: true,
      min_overlap_ha: 0.1,
    });
    expect(r.data_versions.DETER).toBe("2026-10-23");
    expect(r.rules_version).toBe(RULES_VERSION);
  });

  it("is a pure function (same input, same output)", () => {
    const input = facts({ deforestation: [prodes(2021), deter("DEGRADACAO", "2024-01-01")] });
    const snapshot = JSON.stringify(input);
    expect(evaluateCompliance(input)).toEqual(evaluateCompliance(input));
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
