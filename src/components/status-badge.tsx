"use client";

import { CircleCheck, CircleHelp, CircleX, TriangleAlert } from "lucide-react";

import { useDictionary } from "@/i18n/provider";
import type { ComplianceStatus } from "@/lib/compliance/types";
import { cn } from "@/lib/utils";

const styles: Record<ComplianceStatus, { className: string; Icon: typeof CircleCheck }> = {
  COMPLIANT: { className: "bg-status-compliant text-white", Icon: CircleCheck },
  ATTENTION: { className: "bg-status-attention text-brand-900", Icon: TriangleAlert },
  NON_COMPLIANT: { className: "bg-status-noncompliant text-white", Icon: CircleX },
  NO_COVERAGE: { className: "bg-status-nocoverage text-white", Icon: CircleHelp },
};

/** Status always shown with icon and text, never color alone (PLANO.md 11). */
export function StatusBadge({
  status,
  size = "sm",
  className,
}: {
  status: ComplianceStatus;
  size?: "sm" | "lg";
  className?: string;
}) {
  const t = useDictionary();
  const { className: tone, Icon } = styles[status];
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        size === "lg" ? "px-4 py-2 text-base" : "px-2.5 py-1 text-xs",
        tone,
        className,
      )}
    >
      <Icon aria-hidden className={size === "lg" ? "size-5" : "size-3.5"} />
      {t.status[status]}
    </span>
  );
}
