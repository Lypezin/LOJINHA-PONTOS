import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  info: "border-blue-200/80 bg-blue-50/80 text-[var(--brand-blue-dark)]",
  success: "border-emerald-200/80 bg-emerald-50/80 text-emerald-800",
  warning: "border-amber-200/80 bg-amber-50/80 text-amber-800",
  danger: "border-red-200/80 bg-red-50/80 text-red-700",
};

const dots: Record<Tone, string> = {
  neutral: "bg-slate-400",
  info: "bg-[var(--brand-blue)]",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", dots[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}
