/** EUDR commodities (Regulation (EU) 2023/1115, Annex I). Stored as these codes. */
export const COMMODITIES = [
  "cocoa",
  "coffee",
  "soy",
  "cattle",
  "oil_palm",
  "rubber",
  "wood",
] as const;
export type Commodity = (typeof COMMODITIES)[number];

export function isCommodity(value: unknown): value is Commodity {
  return typeof value === "string" && (COMMODITIES as readonly string[]).includes(value);
}

export const CAPTURE_METHODS = ["draw", "gps", "upload"] as const;
export type CaptureMethod = (typeof CAPTURE_METHODS)[number];

export function isCaptureMethod(value: unknown): value is CaptureMethod {
  return typeof value === "string" && (CAPTURE_METHODS as readonly string[]).includes(value);
}
