"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { ArrowLeft, Footprints, PencilLine, Upload } from "lucide-react";

import { createFarm, type CreateFarmError } from "@/app/app/fazendas/actions";
import { useI18n } from "@/i18n/provider";
import { COMMODITIES, type CaptureMethod, type Commodity } from "@/lib/commodities";
import { MAX_FARM_FILE_BYTES, parseFarmFile, type FarmFileError } from "@/lib/geo/farm-file";
import {
  polygonAreaHa,
  validateFarmPolygon,
  type FarmGeometryError,
} from "@/lib/geo/farm-geometry";
import { addFix, emptyTrack, trackToPolygon, type GpsTrack } from "@/lib/geo/gps-track";

const FarmEditorMap = dynamic(() => import("./farm-editor-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-brand-900" />,
});

type Step = "method" | "draw" | "gps" | "upload" | "details";
type Candidate = { polygon: Polygon; areaHa: number } | null;

function formatHa(value: number, locale: string) {
  return value.toLocaleString(locale === "pt" ? "pt-BR" : "en-US", {
    maximumFractionDigits: value < 10 ? 2 : 1,
  });
}

export function NewFarmWizard({ coverage }: { coverage: Feature<Polygon | MultiPolygon> | null }) {
  const { t, locale } = useI18n();
  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<CaptureMethod>("draw");
  const [candidate, setCandidate] = useState<Candidate>(null);
  const [geometryError, setGeometryError] = useState<FarmGeometryError | null>(null);
  const [liveAreaHa, setLiveAreaHa] = useState<number | null>(null);
  const [resetKey, setResetKey] = useState(0);

  // GPS
  const [track, setTrack] = useState<GpsTrack>(emptyTrack);
  const [position, setPosition] = useState<Position | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<"unsupported" | "denied" | "tooFew" | null>(null);
  const [walking, setWalking] = useState(false);
  const watchRef = useRef<number | null>(null);

  // Upload
  const [fileError, setFileError] = useState<FarmFileError | null>(null);

  // Details
  const [name, setName] = useState("");
  const [commodity, setCommodity] = useState<Commodity>("cocoa");
  const [submitError, setSubmitError] = useState<CreateFarmError | null>(null);
  const [saving, startSaving] = useTransition();

  const accept = useCallback((input: unknown) => {
    const r = validateFarmPolygon(input);
    if (r.ok) {
      setCandidate({ polygon: r.polygon, areaHa: r.areaHa });
      setGeometryError(null);
    } else {
      setCandidate(null);
      setGeometryError(r.error);
    }
    return r.ok;
  }, []);

  const outsideCoverage = useMemo(() => {
    if (!candidate || !coverage) return false;
    return candidate.polygon.coordinates[0].some((p) => !booleanPointInPolygon(p, coverage));
  }, [candidate, coverage]);

  // Draw mode callback from the map.
  const onDrawChange = useCallback(
    (polygon: Polygon | null, drawing: boolean) => {
      if (!polygon) {
        setLiveAreaHa(null);
        setCandidate(null);
        setGeometryError(null);
        return;
      }
      setLiveAreaHa(polygon.coordinates[0].length >= 4 ? polygonAreaHa(polygon) : null);
      if (drawing) {
        setCandidate(null);
        setGeometryError(null);
      } else {
        accept(polygon);
      }
    },
    [accept],
  );

  const stopWatching = useCallback(() => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setWalking(false);
  }, []);

  useEffect(() => stopWatching, [stopWatching]);

  function startWalking() {
    if (!("geolocation" in navigator)) {
      setGpsError("unsupported");
      return;
    }
    setGpsError(null);
    setWalking(true);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = {
          lon: pos.coords.longitude,
          lat: pos.coords.latitude,
          accuracy: pos.coords.accuracy,
        };
        setAccuracy(fix.accuracy);
        setPosition([fix.lon, fix.lat]);
        setTrack((current) => addFix(current, fix));
      },
      (error) => {
        setGpsError(error.code === error.PERMISSION_DENIED ? "denied" : "unsupported");
        stopWatching();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );
  }

  function finishWalking() {
    stopWatching();
    const polygon = trackToPolygon(track);
    if (!polygon) {
      setGpsError("tooFew");
      return;
    }
    accept(polygon);
  }

  async function onFile(file: File | undefined) {
    setFileError(null);
    setCandidate(null);
    setGeometryError(null);
    if (!file) return;
    if (file.size > MAX_FARM_FILE_BYTES) {
      setFileError("file_too_large");
      return;
    }
    const parsed = parseFarmFile(file.name, await file.text());
    if (!parsed.ok) {
      setFileError(parsed.error);
      return;
    }
    accept(parsed.geojson);
  }

  function chooseMethod(next: CaptureMethod) {
    setMethod(next);
    setCandidate(null);
    setGeometryError(null);
    setLiveAreaHa(null);
    setTrack(emptyTrack);
    setPosition(null);
    setFileError(null);
    setGpsError(null);
    setStep(next);
  }

  function backToMethods() {
    stopWatching();
    setStep("method");
    setCandidate(null);
    setGeometryError(null);
  }

  function submit() {
    if (!candidate) return;
    setSubmitError(null);
    startSaving(async () => {
      const error = await createFarm({
        name,
        commodity,
        method,
        geometry: candidate.polygon,
      });
      // createFarm redirects on success; it only returns on error.
      if (error) setSubmitError(error);
    });
  }

  const mapMode = step === "draw" ? "draw" : "view";
  const shownPolygon = step === "draw" ? null : (candidate?.polygon ?? null);
  const areaHa = candidate?.areaHa ?? liveAreaHa;

  const areaLine =
    areaHa !== null ? (
      <p className="text-sm text-neutral-700" data-testid="farm-area">
        {t.newFarm.area}:{" "}
        <strong className="text-lg text-brand-900">
          {formatHa(areaHa, locale)} {t.common.hectares}
        </strong>
      </p>
    ) : null;

  const messages = (
    <>
      {geometryError && (
        <p role="alert" className="text-sm text-status-noncompliant">
          {t.newFarm.geometryErrors[geometryError]}
        </p>
      )}
      {candidate && outsideCoverage && (
        <p className="rounded-md bg-farm/20 px-3 py-2 text-sm text-brand-900">
          {t.newFarm.outsideCoverage}
        </p>
      )}
    </>
  );

  const continueButton = (
    <button
      type="button"
      disabled={!candidate}
      onClick={() => setStep("details")}
      className="h-12 w-full rounded-lg bg-brand-900 text-base font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
    >
      {t.newFarm.continue}
    </button>
  );

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col lg:flex-row">
      <div className="relative h-[55dvh] shrink-0 lg:h-auto lg:flex-1">
        <FarmEditorMap
          className="absolute inset-0"
          mode={mapMode}
          polygon={shownPolygon}
          onDrawChange={onDrawChange}
          resetKey={resetKey}
          track={step === "gps" ? track.points : []}
          position={step === "gps" ? position : null}
          coverage={coverage}
        />
      </div>

      <section className="flex-1 space-y-4 bg-paper px-4 py-5 sm:px-6 lg:max-w-md lg:flex-none lg:overflow-y-auto">
        <div className="flex items-center gap-2">
          {step === "method" ? (
            <Link
              href="/app"
              aria-label={t.common.back}
              className="rounded-md p-1 text-brand-900 hover:bg-black/5"
            >
              <ArrowLeft className="size-5" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={step === "details" ? () => setStep(method) : backToMethods}
              aria-label={step === "details" ? t.common.back : t.newFarm.changeMethod}
              className="rounded-md p-1 text-brand-900 hover:bg-black/5"
            >
              <ArrowLeft className="size-5" />
            </button>
          )}
          <h1 className="text-xl font-semibold text-brand-900">{t.newFarm.title}</h1>
        </div>

        {step === "method" && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-700">{t.newFarm.chooseMethod}</p>
            {(
              [
                ["draw", PencilLine],
                ["gps", Footprints],
                ["upload", Upload],
              ] as const
            ).map(([m, Icon]) => (
              <button
                key={m}
                type="button"
                onClick={() => chooseMethod(m)}
                className="flex w-full items-center gap-3 rounded-xl bg-white p-4 text-left ring-1 ring-black/5 hover:ring-brand-700/40"
              >
                <Icon aria-hidden className="size-6 shrink-0 text-brand-700" />
                <span>
                  <span className="block text-base font-semibold text-brand-900">
                    {t.newFarm.methods[m].title}
                  </span>
                  <span className="block text-sm text-neutral-600">
                    {t.newFarm.methods[m].hint}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {step === "draw" && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-700">
              {candidate ? t.newFarm.editHint : t.newFarm.drawHint}
            </p>
            {areaLine}
            {messages}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setResetKey((k) => k + 1)}
                className="h-12 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium text-brand-900"
              >
                {t.newFarm.restart}
              </button>
              {continueButton}
            </div>
          </div>
        )}

        {step === "gps" && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-700">{t.newFarm.gps.hint}</p>
            {walking && !position && (
              <p className="text-sm text-neutral-600" role="status">
                {t.newFarm.gps.waiting}
              </p>
            )}
            {(track.points.length > 0 || accuracy !== null) && (
              <p className="text-sm text-neutral-700" role="status">
                {track.points.length} {t.newFarm.gps.points}
                {accuracy !== null && ` · ${t.newFarm.gps.accuracy} ±${Math.round(accuracy)} m`}
                {track.discarded > 0 && ` · ${track.discarded} ${t.newFarm.gps.discarded}`}
              </p>
            )}
            {gpsError && (
              <p role="alert" className="text-sm text-status-noncompliant">
                {t.newFarm.gps[gpsError]}
              </p>
            )}
            {areaLine}
            {messages}
            {!candidate && (
              <div className="flex gap-2">
                {walking ? (
                  <button
                    type="button"
                    onClick={stopWatching}
                    className="h-12 flex-1 rounded-lg border border-neutral-300 bg-white text-sm font-medium text-brand-900"
                  >
                    {t.newFarm.gps.stop}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startWalking}
                    className="h-12 flex-1 rounded-lg bg-brand-900 text-sm font-semibold text-white"
                  >
                    {track.points.length ? t.newFarm.gps.resume : t.newFarm.gps.start}
                  </button>
                )}
                <button
                  type="button"
                  onClick={finishWalking}
                  disabled={track.points.length < 3}
                  className="h-12 flex-1 rounded-lg bg-farm text-sm font-semibold text-brand-900 disabled:opacity-40"
                >
                  {t.newFarm.gps.finish}
                </button>
              </div>
            )}
            {candidate && continueButton}
          </div>
        )}

        {step === "upload" && (
          <div className="space-y-3">
            <label className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-brand-700/40 bg-white text-sm font-semibold text-brand-900 hover:border-brand-700">
              <Upload aria-hidden className="size-5" />
              {t.newFarm.upload.choose}
              <input
                type="file"
                accept=".geojson,.json,.kml,application/geo+json,application/vnd.google-earth.kml+xml"
                className="sr-only"
                data-testid="farm-file"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
            </label>
            <p className="text-xs text-neutral-600">{t.newFarm.upload.formats}</p>
            {fileError && (
              <p role="alert" className="text-sm text-status-noncompliant">
                {t.newFarm.upload.errors[fileError]}
              </p>
            )}
            {areaLine}
            {messages}
            {continueButton}
          </div>
        )}

        {step === "details" && candidate && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <h2 className="text-base font-semibold text-brand-900">{t.newFarm.details.title}</h2>
            {areaLine}
            {messages}
            <div className="space-y-1.5">
              <label htmlFor="farm-name" className="block text-sm font-medium text-brand-900">
                {t.newFarm.details.name}
              </label>
              <input
                id="farm-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={80}
                placeholder={t.newFarm.details.namePlaceholder}
                className="h-12 w-full rounded-lg border border-neutral-300 bg-white px-3 text-base outline-none focus:border-brand-700 focus:ring-3 focus:ring-brand-700/20"
              />
              {submitError?.field === "name" && (
                <p role="alert" className="text-sm text-status-noncompliant">
                  {t.newFarm.details.nameError}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="farm-commodity" className="block text-sm font-medium text-brand-900">
                {t.newFarm.details.commodity}
              </label>
              <select
                id="farm-commodity"
                value={commodity}
                onChange={(e) => setCommodity(e.target.value as Commodity)}
                className="h-12 w-full rounded-lg border border-neutral-300 bg-white px-3 text-base"
              >
                {COMMODITIES.map((c) => (
                  <option key={c} value={c}>
                    {t.commodities[c]}
                  </option>
                ))}
              </select>
            </div>
            {submitError?.field === "geometry" && (
              <p role="alert" className="text-sm text-status-noncompliant">
                {t.newFarm.geometryErrors[submitError.error]}
              </p>
            )}
            {(submitError?.field === "server" ||
              submitError?.field === "commodity" ||
              submitError?.field === "method") && (
              <p role="alert" className="text-sm text-status-noncompliant">
                {t.newFarm.details.serverError}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="h-12 w-full rounded-lg bg-brand-900 text-base font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? t.newFarm.details.saving : t.newFarm.details.save}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
