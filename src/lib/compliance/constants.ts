/**
 * Every configurable parameter of the compliance engine lives here (PLANO.md 5.1).
 * Changing a value that alters verdicts requires bumping RULES_VERSION.
 */

export const RULES_VERSION = "1.0.0";

/** EUDR cut-off date (Regulation (EU) 2023/1115, art. 2(13)). Strictly after it counts. */
export const CUTOFF_DATE = "2020-12-31";

/**
 * Inner buffer applied to the farm before intersecting (one Sentinel-2 pixel),
 * to avoid false positives from misalignment along the border. If the buffer
 * empties the polygon, the original polygon is used.
 */
export const BORDER_TOLERANCE_M = 10;

/** Overlaps smaller than this are listed as information only (1,000 m²). */
export const MIN_OVERLAP_HA = 0.1;

/**
 * A farm is outside the coverage region when at least this area (after the
 * inner buffer) falls outside the pilot municipalities. Avoids NO_COVERAGE
 * caused by slivers between adjacent municipality polygons.
 */
export const MAX_OUTSIDE_COVERAGE_HA = MIN_OVERLAP_HA;

/**
 * PRODES year N covers August of N-1 to July of N. PRODES 2021 therefore mixes
 * August–December 2020 (before the cut-off) with 2021, so it only raises
 * attention; from PRODES 2022 onwards everything is after the cut-off.
 */
export const PRODES_ATTENTION_YEAR = 2021;
export const PRODES_NON_COMPLIANT_FROM_YEAR = 2022;

/**
 * DETER classes, as published in deter-amz:deter_amz (checked on 2026-11-05,
 * see docs/decisoes.md D-007). Any class not listed here is treated as
 * attention and flagged as unknown, never silently ignored.
 */
export const DETER_DEFORESTATION_CLASSES = [
  "DESMATAMENTO_CR",
  "DESMATAMENTO_VEG",
  "MINERACAO",
] as const;

export const DETER_ATTENTION_CLASSES = [
  "DEGRADACAO",
  "CICATRIZ_DE_QUEIMADA",
  "CS_DESORDENADO",
  "CS_GEOMETRICO",
  "CORTE_SELETIVO",
] as const;
