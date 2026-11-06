import { describe, expect, it } from "vitest";

import { derivedLayersNotice, inpeAttributionHtml, inpeCredit } from "@/lib/attribution";

describe("INPE credit", () => {
  it("uses the exact credit text agreed by the team", () => {
    expect(inpeCredit("pt")).toBe("Dados: INPE/TerraBrasilis, CC BY-SA 4.0");
    expect(inpeCredit("en")).toBe("Data: INPE/TerraBrasilis, CC BY-SA 4.0");
  });

  it("states that derived layers follow the same license", () => {
    expect(derivedLayersNotice("pt")).toContain("mesma licença, CC BY-SA 4.0");
    expect(derivedLayersNotice("en")).toContain("same license, CC BY-SA 4.0");
  });

  it("links to TerraBrasilis and to the license in the map attribution", () => {
    const html = inpeAttributionHtml("pt");
    expect(html).toContain("https://terrabrasilis.dpi.inpe.br");
    expect(html).toContain("https://creativecommons.org/licenses/by-sa/4.0/");
    expect(html.replace(/<[^>]+>/g, "")).toBe(inpeCredit("pt"));
  });
});
