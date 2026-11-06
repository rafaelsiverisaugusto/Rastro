"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, MapPinned, Plus } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { useI18n } from "@/i18n/provider";
import { isCommodity } from "@/lib/commodities";
import type { FarmSummary } from "@/lib/farms";

function formatHa(value: number, locale: string) {
  return value.toLocaleString(locale === "pt" ? "pt-BR" : "en-US", { maximumFractionDigits: 1 });
}

function NewFarmButton() {
  const { t } = useI18n();
  return (
    <Link
      href="/app/fazendas/nova"
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-900 px-4 text-base font-semibold text-white hover:bg-brand-700 sm:w-auto"
    >
      <Plus aria-hidden className="size-5" />
      {t.app.newFarm}
    </Link>
  );
}

export function FarmList({ farms, isDemo }: { farms: FarmSummary[]; isDemo: boolean }) {
  const { t, locale } = useI18n();
  const dateFmt = new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : "en-GB");

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-brand-900">{t.app.title}</h1>
        {farms.length > 0 && <NewFarmButton />}
      </div>

      {isDemo && (
        <p className="rounded-lg bg-farm/20 px-3 py-2 text-sm text-brand-900">{t.app.demoNotice}</p>
      )}

      {farms.length === 0 ? (
        <div className="space-y-4 rounded-2xl bg-white p-8 text-center ring-1 ring-black/5">
          <MapPinned aria-hidden className="mx-auto size-10 text-brand-700" />
          <h2 className="text-lg font-semibold text-brand-900">{t.app.emptyTitle}</h2>
          <p className="text-sm text-neutral-600">{t.app.emptyBody}</p>
          <NewFarmButton />
        </div>
      ) : (
        <ul className="space-y-3" data-testid="farm-list">
          {farms.map((farm) => (
            <li key={farm.id}>
              <Link
                href={`/app/fazendas/${farm.id}`}
                className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-black/5 hover:ring-brand-700/40"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-base font-semibold text-brand-900">
                      {farm.name}
                    </span>
                    {farm.is_demo && (
                      <span className="text-xs text-neutral-500">· {t.common.fictitious}</span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-600">
                    {isCommodity(farm.commodity) ? t.commodities[farm.commodity] : farm.commodity} ·{" "}
                    {formatHa(farm.area_ha, locale)} {t.common.hectares}
                    {farm.municipality ? ` · ${farm.municipality}` : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {farm.last_check ? (
                      <>
                        <StatusBadge status={farm.last_check.status} />
                        <span className="text-xs text-neutral-500">
                          {t.app.checkedOn} {dateFmt.format(new Date(farm.last_check.created_at))}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-neutral-500">{t.app.notChecked}</span>
                    )}
                  </div>
                </div>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-neutral-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FarmListSkeleton() {
  return (
    <div className="space-y-3" aria-busy>
      <div className="h-8 w-48 animate-pulse rounded bg-neutral-200" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-white ring-1 ring-black/5" />
      ))}
    </div>
  );
}

export function FarmListError() {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <div
      role="alert"
      className="space-y-3 rounded-2xl bg-white p-6 text-center ring-1 ring-black/5"
    >
      <p className="text-sm text-neutral-700">{t.app.loadError}</p>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white"
      >
        {t.common.retry}
      </button>
    </div>
  );
}
