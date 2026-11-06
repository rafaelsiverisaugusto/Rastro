export const locales = ["pt", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "pt";

const pt = {
  common: {
    retry: "Tentar de novo",
    switchLanguage: "English",
    loading: "Carregando…",
    signOut: "Sair",
    back: "Voltar",
    demoBadge: "Demonstração",
    fictitious: "Fazenda fictícia",
    hectares: "ha",
  },
  home: {
    tagline: "Prova de origem livre de desmatamento para pequenos produtores",
    pilot: "Região-piloto: Transamazônica, Pará",
    disclaimer: "Evidências para due diligence. Não é certificação.",
    enter: "Entrar",
    demo: "Ver demonstração",
  },
  map: {
    label: "Mapa de satélite da região-piloto",
    loading: "Carregando mapa…",
    error: "Não foi possível abrir o mapa. Verifique a conexão ou use outro navegador.",
  },
  auth: {
    title: "Entrar no Rastro",
    subtitle: "Receba um link de acesso no seu e-mail. Não precisa de senha.",
    emailLabel: "Seu e-mail",
    emailPlaceholder: "voce@exemplo.com",
    sendLink: "Enviar link de acesso",
    sending: "Enviando…",
    sentTitle: "Confira seu e-mail",
    sentBody: "Enviamos um link de acesso para",
    sentHint: "Abra o link neste mesmo aparelho. Ele vale por 1 hora.",
    useAnotherEmail: "Usar outro e-mail",
    or: "ou",
    demo: "Entrar como demonstração",
    demoHint: "Conta compartilhada com três fazendas fictícias.",
    entering: "Entrando…",
    errors: {
      invalid_email: "Digite um e-mail válido.",
      rate_limited: "Muitos pedidos seguidos. Espere alguns minutos e tente de novo.",
      failed: "Não foi possível enviar o link agora. Tente de novo.",
      demo: "A demonstração não está disponível agora. Tente de novo em instantes.",
      link: "O link expirou ou já foi usado. Peça um novo.",
    },
  },
  app: {
    title: "Minhas fazendas",
    newFarm: "Mapear nova fazenda",
    emptyTitle: "Nenhuma fazenda ainda",
    emptyBody: "Mapeie a área de produção para checar se ela está livre de desmatamento.",
    loadError: "Não foi possível carregar suas fazendas.",
    checkedOn: "Checada em",
    notChecked: "Ainda não checada",
    demoNotice: "Você está na conta de demonstração. As fazendas são fictícias.",
  },
  status: {
    COMPLIANT: "Conforme",
    ATTENTION: "Atenção",
    NON_COMPLIANT: "Não conforme",
    NO_COVERAGE: "Sem cobertura",
  },
};

export type Dictionary = typeof pt;

const en: Dictionary = {
  common: {
    retry: "Try again",
    switchLanguage: "Português",
    loading: "Loading…",
    signOut: "Sign out",
    back: "Back",
    demoBadge: "Demo",
    fictitious: "Fictitious farm",
    hectares: "ha",
  },
  home: {
    tagline: "Deforestation-free proof of origin for smallholder farmers",
    pilot: "Pilot region: Transamazônica, Pará",
    disclaimer: "Evidence for due diligence. Not a certification.",
    enter: "Sign in",
    demo: "See the demo",
  },
  map: {
    label: "Satellite map of the pilot region",
    loading: "Loading map…",
    error: "The map could not be loaded. Check your connection or try another browser.",
  },
  auth: {
    title: "Sign in to Rastro",
    subtitle: "Get a sign-in link by e-mail. No password needed.",
    emailLabel: "Your e-mail",
    emailPlaceholder: "you@example.com",
    sendLink: "Send sign-in link",
    sending: "Sending…",
    sentTitle: "Check your e-mail",
    sentBody: "We sent a sign-in link to",
    sentHint: "Open the link on this same device. It is valid for 1 hour.",
    useAnotherEmail: "Use another e-mail",
    or: "or",
    demo: "Sign in as demo",
    demoHint: "Shared account with three fictitious farms.",
    entering: "Signing in…",
    errors: {
      invalid_email: "Enter a valid e-mail address.",
      rate_limited: "Too many requests. Wait a few minutes and try again.",
      failed: "The link could not be sent right now. Try again.",
      demo: "The demo is not available right now. Try again in a moment.",
      link: "The link has expired or was already used. Request a new one.",
    },
  },
  app: {
    title: "My farms",
    newFarm: "Map a new farm",
    emptyTitle: "No farms yet",
    emptyBody: "Map the production area to check whether it is deforestation-free.",
    loadError: "Your farms could not be loaded.",
    checkedOn: "Checked on",
    notChecked: "Not checked yet",
    demoNotice: "You are using the demo account. The farms are fictitious.",
  },
  status: {
    COMPLIANT: "Compliant",
    ATTENTION: "Attention",
    NON_COMPLIANT: "Non-compliant",
    NO_COVERAGE: "No coverage",
  },
};

export const dictionaries: Record<Locale, Dictionary> = { pt, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
