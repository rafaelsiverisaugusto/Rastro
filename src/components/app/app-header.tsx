"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";

import { signOut } from "@/app/entrar/actions";
import { useI18n } from "@/i18n/provider";

export function AppHeaderView({ isDemo }: { isDemo: boolean }) {
  const { t, locale, setLocale } = useI18n();
  return (
    <header className="flex items-center justify-between gap-3 bg-brand-900 px-4 py-3 text-white sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Link href="/app" className="text-xl font-semibold tracking-tight">
          Rastro
        </Link>
        {isDemo && (
          <span className="rounded-full bg-farm px-2 py-0.5 text-xs font-semibold text-brand-900">
            {t.common.demoBadge}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setLocale(locale === "pt" ? "en" : "pt")}
          className="rounded-md border border-white/30 px-3 py-1.5 text-sm hover:bg-white/10"
        >
          {t.common.switchLanguage}
        </button>
        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-white/10"
          >
            <LogOut aria-hidden className="size-4" />
            <span className="sr-only sm:not-sr-only">{t.common.signOut}</span>
          </button>
        </form>
      </div>
    </header>
  );
}
