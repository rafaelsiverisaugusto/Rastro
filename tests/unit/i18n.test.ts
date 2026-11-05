import { describe, expect, it } from "vitest";

import { dictionaries, locales } from "@/i18n/dictionaries";

function keyPaths(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? keyPaths(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe("i18n dictionaries", () => {
  it("pt and en have exactly the same keys", () => {
    const [first, ...rest] = locales.map((l) => keyPaths(dictionaries[l]).sort());
    for (const other of rest) expect(other).toEqual(first);
  });

  it("has no empty strings", () => {
    for (const locale of locales) {
      const flat = JSON.stringify(dictionaries[locale]);
      expect(flat).not.toContain('""');
    }
  });
});
