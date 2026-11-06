"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, MonitorPlay } from "lucide-react";

import {
  sendMagicLink,
  signInAsDemo,
  type DemoState,
  type MagicLinkState,
} from "@/app/entrar/actions";
import { useDictionary } from "@/i18n/provider";

export function SignInForm() {
  const t = useDictionary();
  const params = useSearchParams();
  const next = params.get("next") ?? "/app";
  const linkError = params.get("erro") === "link";

  const [linkState, sendLink, sending] = useActionState<MagicLinkState, FormData>(sendMagicLink, {
    status: "idle",
  });
  const [demoState, enterDemo, entering] = useActionState<DemoState, FormData>(signInAsDemo, {
    status: "idle",
  });
  const [retyping, setRetyping] = useState(false);

  if (linkState.status === "sent" && !retyping) {
    return (
      <div className="space-y-3 text-center" role="status">
        <Mail aria-hidden className="mx-auto size-10 text-brand-700" />
        <h2 className="text-lg font-semibold text-brand-900">{t.auth.sentTitle}</h2>
        <p className="text-sm text-neutral-700">
          {t.auth.sentBody} <strong>{linkState.email}</strong>.
        </p>
        <p className="text-sm text-neutral-600">{t.auth.sentHint}</p>
        <button
          type="button"
          onClick={() => setRetyping(true)}
          className="text-sm font-medium text-brand-700 underline underline-offset-4"
        >
          {t.auth.useAnotherEmail}
        </button>
      </div>
    );
  }

  const error =
    linkState.status === "error"
      ? t.auth.errors[linkState.code]
      : linkError && linkState.status === "idle"
        ? t.auth.errors.link
        : null;

  return (
    <div className="space-y-6">
      <form action={sendLink} onSubmit={() => setRetyping(false)} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <label htmlFor="email" className="block text-sm font-medium text-brand-900">
          {t.auth.emailLabel}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder={t.auth.emailPlaceholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "email-error" : undefined}
          className="h-12 w-full rounded-lg border border-neutral-300 bg-white px-3 text-base outline-none focus:border-brand-700 focus:ring-3 focus:ring-brand-700/20"
        />
        {error && (
          <p id="email-error" role="alert" className="text-sm text-status-noncompliant">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={sending}
          className="h-12 w-full rounded-lg bg-brand-900 text-base font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {sending ? t.auth.sending : t.auth.sendLink}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-neutral-500 uppercase">
        <span className="h-px flex-1 bg-neutral-300" />
        {t.auth.or}
        <span className="h-px flex-1 bg-neutral-300" />
      </div>

      <form action={enterDemo} className="space-y-2">
        <input type="hidden" name="next" value="/app" />
        <button
          type="submit"
          disabled={entering}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-brand-900 bg-white text-base font-semibold text-brand-900 hover:bg-brand-900/5 disabled:opacity-60"
        >
          <MonitorPlay aria-hidden className="size-5" />
          {entering ? t.auth.entering : t.auth.demo}
        </button>
        <p className="text-center text-xs text-neutral-600">{t.auth.demoHint}</p>
        {demoState.status === "error" && (
          <p role="alert" className="text-center text-sm text-status-noncompliant">
            {t.auth.errors.demo}
          </p>
        )}
      </form>
    </div>
  );
}
