"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useI18n } from "@/i18n/provider";

export function AuthCard({ children }: { children: ReactNode }) {
  const { t, locale, setLocale } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="flex items-center justify-between bg-brand-900 px-4 py-3 text-white sm:px-6">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          Rastro
        </Link>
        <button
          type="button"
          onClick={() => setLocale(locale === "pt" ? "en" : "pt")}
          className="rounded-md border border-white/30 px-3 py-1.5 text-sm hover:bg-white/10"
        >
          {t.common.switchLanguage}
        </button>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-brand-900">{t.auth.title}</h1>
            <p className="text-sm text-neutral-600">{t.auth.subtitle}</p>
          </div>
          {children}
        </div>
      </main>
      <footer className="px-4 py-3 text-center text-xs text-neutral-600">
        {t.home.disclaimer}
      </footer>
    </div>
  );
}
