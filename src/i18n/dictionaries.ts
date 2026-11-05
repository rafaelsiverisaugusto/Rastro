export const locales = ["pt", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "pt";

const pt = {
  common: {
    retry: "Tentar de novo",
    switchLanguage: "English",
  },
  home: {
    tagline: "Prova de origem livre de desmatamento para pequenos produtores",
    pilot: "Região-piloto: Transamazônica, Pará",
    disclaimer: "Evidências para due diligence. Não é certificação.",
  },
  map: {
    label: "Mapa de satélite da região-piloto",
    loading: "Carregando mapa…",
    error: "Não foi possível abrir o mapa. Verifique a conexão ou use outro navegador.",
  },
};

export type Dictionary = typeof pt;

const en: Dictionary = {
  common: {
    retry: "Try again",
    switchLanguage: "Português",
  },
  home: {
    tagline: "Deforestation-free proof of origin for smallholder farmers",
    pilot: "Pilot region: Transamazônica, Pará",
    disclaimer: "Evidence for due diligence. Not a certification.",
  },
  map: {
    label: "Satellite map of the pilot region",
    loading: "Loading map…",
    error: "The map could not be loaded. Check your connection or try another browser.",
  },
};

export const dictionaries: Record<Locale, Dictionary> = { pt, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
