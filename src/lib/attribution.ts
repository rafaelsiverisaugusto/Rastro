import type { Locale } from "@/i18n/dictionaries";

/**
 * Credits required by the licenses of the data sources (see DATA_SOURCES.md).
 *
 * INPE data (DETER, PRODES and the TerraBrasilis municipality boundaries) is
 * CC BY-SA 4.0. The Rastro source code stays MIT, but every layer derived from
 * INPE data (deforestation patches, findings, coverage region) is shared under
 * the same CC BY-SA 4.0 license. This credit must appear on the map, in the
 * dossier and on the public verification page.
 */
export const TERRABRASILIS_URL = "https://terrabrasilis.dpi.inpe.br";
export const CC_BY_SA_4_URL = "https://creativecommons.org/licenses/by-sa/4.0/";

const inpeCreditText: Record<Locale, { prefix: string; derived: string }> = {
  pt: {
    prefix: "Dados",
    derived:
      "As camadas derivadas dos dados do INPE (manchas de desmatamento, achados e região de cobertura) seguem a mesma licença, CC BY-SA 4.0.",
  },
  en: {
    prefix: "Data",
    derived:
      "Layers derived from INPE data (deforestation patches, findings and coverage region) are shared under the same license, CC BY-SA 4.0.",
  },
};

/** Plain-text credit, e.g. "Dados: INPE/TerraBrasilis, CC BY-SA 4.0". */
export function inpeCredit(locale: Locale): string {
  return `${inpeCreditText[locale].prefix}: INPE/TerraBrasilis, CC BY-SA 4.0`;
}

/** Notice that derived layers follow the same license. */
export function derivedLayersNotice(locale: Locale): string {
  return inpeCreditText[locale].derived;
}

/** HTML credit for the MapLibre attribution control. */
export function inpeAttributionHtml(locale: Locale): string {
  return (
    `${inpeCreditText[locale].prefix}: ` +
    `<a href="${TERRABRASILIS_URL}" target="_blank" rel="noopener">INPE/TerraBrasilis</a>, ` +
    `<a href="${CC_BY_SA_4_URL}" target="_blank" rel="noopener" title="${derivedLayersNotice(locale)}">CC BY-SA 4.0</a>`
  );
}
