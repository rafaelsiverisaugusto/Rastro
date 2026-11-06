/**
 * Synthetic polygons for the compliance engine (PLANO.md 5.4).
 *
 * Everything is placed far from the pilot region (around 45.5°W 10.5°S), so
 * the fixtures can be inserted inside a rolled-back transaction even in a
 * database that already holds the real reference layers. Shapes are defined in
 * metres from a local origin per case and converted to degrees.
 */
import type { ComplianceStatus } from "@/lib/compliance/types";

type Polygon = { type: "Polygon"; coordinates: number[][][] };

const BASE_LON = -45.5;
const BASE_LAT = -10.5;
const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LON = 111_320 * Math.cos((BASE_LAT * Math.PI) / 180);

/** Rectangle in metres relative to (originLon, originLat). */
export function rect(
  origin: [number, number],
  [x0, y0, x1, y1]: [number, number, number, number],
): Polygon {
  const [lon, lat] = origin;
  const p = (x: number, y: number) => [
    Number((lon + x / M_PER_DEG_LON).toFixed(9)),
    Number((lat + y / M_PER_DEG_LAT).toFixed(9)),
  ];
  return {
    type: "Polygon",
    coordinates: [[p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1), p(x0, y0)]],
  };
}

/** Two adjacent fake "municipalities" sharing the meridian BASE_LON. */
export const COVERAGE = [
  {
    name: "Município Teste Oeste",
    mun_geocode: "TEST01",
    geom: rect([BASE_LON, BASE_LAT], [-20_000, -20_000, 0, 20_000]),
  },
  {
    name: "Município Teste Leste",
    mun_geocode: "TEST02",
    geom: rect([BASE_LON, BASE_LAT], [0, -20_000, 60_000, 20_000]),
  },
];

export type FixtureDeforestation = {
  source: "DETER" | "PRODES";
  class_name: string;
  detected_at: string | null;
  prodes_year: number | null;
  geom: Polygon;
};

export type FixtureProtectedArea = {
  kind: "TI" | "UC";
  name: string;
  geom: Polygon;
};

export type ComplianceCase = {
  id: string;
  description: string;
  farm: Polygon;
  deforestation: FixtureDeforestation[];
  protected_areas: FixtureProtectedArea[];
  expected: {
    status: ComplianceStatus;
    findings: number;
    /** Number of findings that only inform (do not change the status). */
    info?: number;
    border_tolerance_applied?: boolean;
    municipality?: string;
  };
};

const FARM: [number, number, number, number] = [0, 0, 400, 400]; // 16 ha

/** Each case gets its own origin, 3 km apart, inside the eastern municipality. */
function origin(index: number): [number, number] {
  return [BASE_LON + (5_000 + index * 3_000) / M_PER_DEG_LON, BASE_LAT];
}

function deter(
  o: [number, number],
  box: [number, number, number, number],
  class_name: string,
  date: string,
): FixtureDeforestation {
  return { source: "DETER", class_name, detected_at: date, prodes_year: null, geom: rect(o, box) };
}

function prodes(
  o: [number, number],
  box: [number, number, number, number],
  year: number,
): FixtureDeforestation {
  return {
    source: "PRODES",
    class_name: `d${year}`,
    detected_at: `${year}-07-15`,
    prodes_year: year,
    geom: rect(o, box),
  };
}

const INSIDE_1HA: [number, number, number, number] = [100, 100, 200, 200];

function makeCases(): ComplianceCase[] {
  const cases: ComplianceCase[] = [];
  const add = (c: Omit<ComplianceCase, "farm"> & { farm?: Polygon }, o: [number, number]) =>
    cases.push({ ...c, farm: c.farm ?? rect(o, FARM) });

  let o = origin(0);
  add(
    {
      id: "no_overlap",
      description: "Desmatamento recente a 600 m da fazenda",
      deforestation: [deter(o, [1000, 0, 1100, 100], "DESMATAMENTO_CR", "2023-08-14")],
      protected_areas: [],
      expected: { status: "COMPLIANT", findings: 0, border_tolerance_applied: true },
    },
    o,
  );

  o = origin(1);
  add(
    {
      id: "border_only",
      description: "Mancha invade só 5 m pela borda (0,2 ha brutos), abaixo da tolerância de 10 m",
      deforestation: [deter(o, [-100, 0, 5, 400], "DESMATAMENTO_CR", "2023-08-14")],
      protected_areas: [],
      expected: { status: "COMPLIANT", findings: 0 },
    },
    o,
  );

  o = origin(2);
  add(
    {
      id: "small_overlap",
      description: "Desmatamento recente de 25 m x 25 m (0,0625 ha), abaixo do mínimo",
      deforestation: [deter(o, [100, 100, 125, 125], "DESMATAMENTO_CR", "2023-08-14")],
      protected_areas: [],
      expected: { status: "COMPLIANT", findings: 1, info: 1 },
    },
    o,
  );

  o = origin(3);
  add(
    {
      id: "deter_before_cutoff",
      description: "DETER de desmatamento em 15/06/2020, antes do corte",
      deforestation: [deter(o, INSIDE_1HA, "DESMATAMENTO_CR", "2020-06-15")],
      protected_areas: [],
      expected: { status: "COMPLIANT", findings: 1, info: 1 },
    },
    o,
  );

  o = origin(4);
  add(
    {
      id: "deter_after_cutoff",
      description: "DETER de desmatamento em 14/08/2023",
      deforestation: [deter(o, INSIDE_1HA, "DESMATAMENTO_CR", "2023-08-14")],
      protected_areas: [],
      expected: { status: "NON_COMPLIANT", findings: 1, info: 0 },
    },
    o,
  );

  o = origin(5);
  add(
    {
      id: "prodes_2021",
      description: "PRODES 2021 (ago/2020 a jul/2021) sem DETER que confirme",
      deforestation: [prodes(o, INSIDE_1HA, 2021)],
      protected_areas: [],
      expected: { status: "ATTENTION", findings: 1, info: 0 },
    },
    o,
  );

  o = origin(6);
  add(
    {
      id: "prodes_2022",
      description: "PRODES 2022, todo depois do corte",
      deforestation: [prodes(o, INSIDE_1HA, 2022)],
      protected_areas: [],
      expected: { status: "NON_COMPLIANT", findings: 1, info: 0 },
    },
    o,
  );

  o = origin(7);
  add(
    {
      id: "degradation",
      description: "DETER de degradação em 2024",
      deforestation: [deter(o, INSIDE_1HA, "DEGRADACAO", "2024-03-10")],
      protected_areas: [],
      expected: { status: "ATTENTION", findings: 1, info: 0 },
    },
    o,
  );

  o = origin(8);
  add(
    {
      id: "indigenous_land",
      description: "Terra indígena cobre uma faixa de 100 m da fazenda",
      deforestation: [],
      protected_areas: [{ kind: "TI", name: "TI Teste", geom: rect(o, [300, -100, 600, 500]) }],
      expected: { status: "NON_COMPLIANT", findings: 0 },
    },
    o,
  );

  o = [BASE_LON - 30_000 / M_PER_DEG_LON, BASE_LAT];
  add(
    {
      id: "out_of_coverage",
      description: "Fazenda fora dos municípios cobertos",
      deforestation: [],
      protected_areas: [],
      expected: { status: "NO_COVERAGE", findings: 0 },
    },
    o,
  );

  o = origin(9);
  add(
    {
      id: "thin_farm",
      description: "Faixa de 15 m: o recuo de 10 m esvazia o polígono e o original é usado",
      farm: rect(o, [0, 0, 15, 400]),
      deforestation: [deter(o, [-50, 0, 50, 400], "DESMATAMENTO_CR", "2023-08-14")],
      protected_areas: [],
      expected: { status: "NON_COMPLIANT", findings: 1, border_tolerance_applied: false },
    },
    o,
  );

  o = [BASE_LON, BASE_LAT + 5_000 / M_PER_DEG_LAT];
  add(
    {
      id: "municipality_border",
      description: "Fazenda na divisa entre dois municípios cobertos, mais a leste",
      farm: rect(o, [-100, 0, 300, 400]),
      deforestation: [],
      protected_areas: [],
      expected: { status: "COMPLIANT", findings: 0, municipality: "Município Teste Leste" },
    },
    o,
  );

  return cases;
}

export const COMPLIANCE_CASES = makeCases();
