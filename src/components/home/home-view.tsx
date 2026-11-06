"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

import { useI18n } from "@/i18n/provider";

// MapLibre needs the browser (WebGL), so it is never rendered on the server.
const BaseMap = dynamic(() => import("@/components/map/base-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-brand-900" data-testid="base-map-placeholder" />,
});

export function HomeView() {
  const { t, locale, setLocale } = useI18n();

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="flex items-center justify-between gap-4 bg-brand-900 px-4 py-3 text-white sm:px-6">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Rastro</h1>
          <p className="truncate text-sm text-white/80">{t.home.tagline}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setLocale(locale === "pt" ? "en" : "pt")}
            className="rounded-md border border-white/30 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            {t.common.switchLanguage}
          </button>
          <Link
            href="/entrar"
            className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-brand-900 hover:bg-white/90"
          >
            {t.home.enter}
          </Link>
        </div>
      </header>

      <main className="relative flex-1">
        <BaseMap className="absolute inset-0" />
        <div className="pointer-events-none absolute top-3 left-3 rounded-md bg-brand-900/85 px-3 py-2 text-sm text-white shadow">
          {t.home.pilot}
        </div>
      </main>

      <div className="flex justify-center bg-paper px-4 py-3">
        <Link
          href="/entrar"
          className="inline-flex h-12 w-full max-w-sm items-center justify-center rounded-lg bg-farm px-6 text-base font-semibold text-brand-900 shadow hover:brightness-105"
        >
          {t.home.demo}
        </Link>
      </div>

      <footer className="bg-brand-700 px-4 py-2 text-center text-xs text-white/90 sm:px-6">
        {t.home.disclaimer}
      </footer>
    </div>
  );
}
