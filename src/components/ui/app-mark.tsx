import Link from "next/link";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/cn";

export function AppMark({ href = "/loja", compact = false, inverse = false }: { href?: string; compact?: boolean; inverse?: boolean }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200" aria-label="Lojinha EntreGô">
      <span className={cn("relative flex size-10 items-center justify-center rounded-2xl shadow-sm ring-1", inverse ? "bg-white text-[var(--brand-blue-dark)] ring-white/40" : "bg-[var(--brand-blue)] text-white ring-blue-800/10")} aria-hidden="true">
        <MapPin className="size-5" strokeWidth={2.5} />
        <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full border-2 border-white bg-[var(--brand-mint)]" />
      </span>
      {!compact ? (
        <span className={cn("text-base font-extrabold", inverse ? "text-white" : "text-[var(--brand-navy)]")}>
          Lojinha <span className={inverse ? "text-[var(--brand-mint)]" : "text-[var(--brand-blue)]"}>EntreGô</span>
        </span>
      ) : null}
    </Link>
  );
}
