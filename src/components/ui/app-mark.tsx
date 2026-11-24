import Link from "next/link";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/cn";

export function AppMark({
  href = "/loja",
  compact = false,
  inverse = false,
}: {
  href?: string;
  compact?: boolean;
  inverse?: boolean;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
      aria-label="Lojinha EntreGô"
    >
      <span
        className={cn(
          "relative flex size-9 items-center justify-center rounded-xl transition-colors",
          inverse
            ? "bg-white/15 text-white ring-1 ring-white/20"
            : "bg-[var(--brand-navy)] text-white shadow-[0_1px_2px_rgba(11,22,51,0.18)]",
        )}
        aria-hidden="true"
      >
        <MapPin className="size-[18px]" strokeWidth={2.25} />
        <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[var(--brand-mint)] ring-2 ring-[var(--brand-navy)]" />
      </span>
      {!compact ? (
        <span
          className={cn(
            "font-display text-[15px] font-bold tracking-tight",
            inverse ? "text-white" : "text-[var(--brand-navy)]",
          )}
        >
          Lojinha <span className={inverse ? "text-emerald-300" : "text-[var(--brand-blue)]"}>EntreGô</span>
        </span>
      ) : null}
    </Link>
  );
}
