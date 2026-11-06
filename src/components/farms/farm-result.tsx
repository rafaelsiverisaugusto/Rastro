"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { recheckFarm } from "@/app/app/fazendas/actions";
import { StatusBadge } from "@/components/status-badge";
import type { Dictionary } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/provider";
import { derivedLayersNotice, inpeCredit } from "@/lib/attribution";
import { isCommodity } from "@/lib/commodities";
import type { DeforestationFinding, ProtectedAreaFinding } from "@/lib/compliance/types";
import type { FarmDetail } from "@/lib/farm-detail";
import { MAP_COLORS } from "@/lib/geo/map-layers";
import { cn } from "@/lib/utils";

const FarmResultMap = dynamic(() => import("./farm-result-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-brand-900" />,
});

function useFormatters() {
  const { locale } = useI18n();
  const tag = locale === "pt" ? "pt-BR" : "en-GB";
  return {
    ha: (v: number) =>
      v.toLocaleString(tag, { maximumFractionDigits: v < 1 ? 2 : 1, minimumFractionDigits: 0 }),
    date: (iso: string) => {
      const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
      return new Intl.DateTimeFormat(tag, { timeZone: "UTC" }).format(Date.UTC(y, m - 1, d));
    },
    dateTime: (iso: string) =>
      new Intl.DateTimeFormat(tag, { dateStyle: "short", timeStyle: "short" }).format(
        new Date(iso),
      ),
  };
}

const effectTone = {
  non_compliant: "bg-status-noncompliant/10 text-status-noncompliant",
  attention: "bg-status-attention/20 text-brand-900",
  info: "bg-neutral-100 text-neutral-600",
} as const;

function EffectTag({ effect, t }: { effect: keyof typeof effectTone; t: Dictionary }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", effectTone[effect])}>
      {t.farm.effect[effect]}
    </span>
  );
}

function FindingRow({ f }: { f: DeforestationFinding }) {
  const { t } = useI18n();
  const fmt = useFormatters();
  return (
    <li className="space-y-1 rounded-xl bg-white p-3 ring-1 ring-black/5">
      <div className="flex flex-wrap items-center gap-2">
        <EffectTag effect={f.effect} t={t} />
        {f.synthetic && (
          <span className="rounded bg-brand-900 px-1.5 py-0.5 text-xs font-bold text-white">
            {t.farm.simulation}
          </span>
        )}
        <span className="text-sm font-medium text-brand-900">{t.farm.reasons[f.reason]}</span>
      </div>
      <p className="text-sm text-neutral-700">
        {f.source === "DETER" ? (
          <>
            DETER · {f.class} · {t.farm.detectedOn} {f.detected_at ? fmt.date(f.detected_at) : "—"}
          </>
        ) : (
          <>
            {t.farm.prodesYear} {f.prodes_year}
          </>
        )}
      </p>
      <p className="text-sm text-neutral-700">
        <strong>
          {fmt.ha(f.overlap_ha)} {t.common.hectares}
        </strong>{" "}
        {t.farm.overlap}
        {f.below_min_overlap && <span className="text-neutral-500"> ({t.farm.belowMin})</span>}
      </p>
    </li>
  );
}

function ProtectedRow({ p }: { p: ProtectedAreaFinding }) {
  const { t } = useI18n();
  const fmt = useFormatters();
  return (
    <li className="space-y-1 rounded-xl bg-white p-3 ring-1 ring-black/5">
      <div className="flex flex-wrap items-center gap-2">
        <EffectTag effect={p.effect} t={t} />
        <span className="text-sm font-medium text-brand-900">
          {p.kind === "TI" ? t.farm.ti : t.farm.uc}: {p.name}
        </span>
      </div>
      <p className="text-sm text-neutral-700">
        <strong>
          {fmt.ha(p.overlap_ha)} {t.common.hectares}
        </strong>{" "}
        {t.farm.overlap}
        {p.below_min_overlap && <span className="text-neutral-500"> ({t.farm.belowMin})</span>}
      </p>
    </li>
  );
}

function Legend() {
  const { t } = useI18n();
  const items: [string, string, "fill" | "line"][] = [
    [t.farm.legend.farm, MAP_COLORS.farm, "line"],
    [t.farm.legend.afterCutoff, MAP_COLORS.afterCutoff, "fill"],
    [t.farm.legend.attention, MAP_COLORS.attention, "fill"],
    [t.farm.legend.beforeCutoff, MAP_COLORS.beforeCutoff, "fill"],
    [t.farm.legend.protected, MAP_COLORS.protected, "line"],
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-neutral-700" aria-label="Legenda">
      {items.map(([label, color, kind]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block size-3 rounded-sm"
            style={
              kind === "fill"
                ? { backgroundColor: color, opacity: 0.8 }
                : { border: `2px solid ${color}` }
            }
          />
          {label}
        </li>
      ))}
    </ul>
  );
}

function RecheckButton({ farmId, label }: { farmId: string; label: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setFailed(false);
            const r = await recheckFarm(farmId);
            if (r && !r.ok) setFailed(true);
          })
        }
        className="inline-flex h-11 items-center gap-2 rounded-lg border border-brand-900 bg-white px-4 text-sm font-semibold text-brand-900 disabled:opacity-60"
      >
        <RefreshCw aria-hidden className={cn("size-4", pending && "animate-spin")} />
        {pending ? t.farm.checking : label}
      </button>
      {failed && (
        <p role="alert" className="text-sm text-status-noncompliant">
          {t.farm.checkError}
        </p>
      )}
    </div>
  );
}

export function FarmResult({ farm }: { farm: FarmDetail }) {
  const { t, locale } = useI18n();
  const fmt = useFormatters();
  const check = farm.check;
  const result = check?.result;
  const commodity = isCommodity(farm.commodity) ? t.commodities[farm.commodity] : farm.commodity;

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <div className="relative h-[45dvh] shrink-0 lg:sticky lg:top-0 lg:h-[calc(100dvh-3.5rem)] lg:flex-1">
        <FarmResultMap className="absolute inset-0" layers={farm.layers} />
      </div>

      <main className="flex-1 space-y-5 px-4 py-5 sm:px-6 lg:max-w-lg lg:flex-none">
        <Link
          href="/app"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-700"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t.farm.backToList}
        </Link>

        <header className="space-y-3">
          <div>
            <h1 className="text-2xl font-semibold text-brand-900">{farm.name}</h1>
            {farm.is_demo && <p className="text-sm text-neutral-500">{t.common.fictitious}</p>}
          </div>
          {check ? (
            <div className="space-y-2" data-testid="farm-verdict" data-status={check.status}>
              <StatusBadge status={check.status} size="lg" />
              <p className="text-sm text-neutral-700">{t.statusExplain[check.status]}</p>
              <p className="text-xs text-neutral-500">
                {t.farm.checkedOn} {fmt.dateTime(check.created_at)}
              </p>
            </div>
          ) : (
            <div className="space-y-2 rounded-xl bg-white p-4 ring-1 ring-black/5">
              <p className="text-sm text-neutral-700">{t.farm.notChecked}</p>
              <RecheckButton farmId={farm.id} label={t.farm.runCheck} />
            </div>
          )}
        </header>

        <dl className="grid grid-cols-3 gap-3 rounded-xl bg-white p-4 text-sm ring-1 ring-black/5">
          <div>
            <dt className="text-xs text-neutral-500">{t.farm.area}</dt>
            <dd className="font-semibold text-brand-900">
              {fmt.ha(farm.area_ha)} {t.common.hectares}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">{t.farm.commodity}</dt>
            <dd className="font-semibold text-brand-900">{commodity}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">{t.farm.municipality}</dt>
            <dd className="font-semibold text-brand-900">
              {result?.municipality?.name ?? farm.municipality ?? "—"}
            </dd>
          </div>
        </dl>

        <Legend />

        {result && (
          <section className="space-y-3" aria-labelledby="findings-title">
            <h2 id="findings-title" className="text-base font-semibold text-brand-900">
              {t.farm.findingsTitle}
            </h2>
            {result.findings.length === 0 && result.protected_area_overlaps.length === 0 ? (
              <p className="rounded-xl bg-white p-4 text-sm text-neutral-700 ring-1 ring-black/5">
                {t.farm.noFindings}
              </p>
            ) : (
              <ul className="space-y-2" data-testid="findings">
                {result.protected_area_overlaps.map((p) => (
                  <ProtectedRow key={`pa-${p.reference_id}`} p={p} />
                ))}
                {result.findings.map((f, i) => (
                  <FindingRow key={`${f.reference_id}-${i}`} f={f} />
                ))}
              </ul>
            )}
          </section>
        )}

        {result && (
          <section className="space-y-2 text-xs text-neutral-600">
            <h2 className="text-sm font-semibold text-brand-900">{t.farm.dataVersions}</h2>
            <p>
              {t.farm.deterUntil}{" "}
              {result.data_versions.DETER ? fmt.date(result.data_versions.DETER) : "—"} ·{" "}
              {t.farm.prodesUntil} {result.data_versions.PRODES ?? "—"} · FUNAI{" "}
              {result.data_versions.TI ? fmt.date(result.data_versions.TI) : "—"} · CNUC{" "}
              {result.data_versions.UC ?? "—"}
            </p>
            <p>{t.farm.method}</p>
            <p>
              {inpeCredit(locale)}. {derivedLayersNotice(locale)}
            </p>
            <p className="font-medium text-neutral-700">{t.farm.disclaimer}</p>
          </section>
        )}

        {check && <RecheckButton farmId={farm.id} label={t.farm.rerun} />}
      </main>
    </div>
  );
}

export function FarmResultSkeleton() {
  return (
    <div className="flex flex-1 flex-col lg:flex-row" aria-busy>
      <div className="h-[45dvh] animate-pulse bg-brand-900/80 lg:h-auto lg:flex-1" />
      <div className="flex-1 space-y-4 px-4 py-5 lg:max-w-lg">
        <div className="h-8 w-2/3 animate-pulse rounded bg-neutral-200" />
        <div className="h-10 w-40 animate-pulse rounded-full bg-neutral-200" />
        <div className="h-20 animate-pulse rounded-xl bg-white ring-1 ring-black/5" />
      </div>
    </div>
  );
}

export function FarmResultError() {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <div role="alert" className="mx-auto max-w-md space-y-3 px-4 py-10 text-center">
      <p className="text-sm text-neutral-700">{t.farm.loadError}</p>
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
