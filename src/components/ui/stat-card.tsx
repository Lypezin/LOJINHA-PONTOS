import type { LucideIcon } from "lucide-react";

export function StatCard({ label, value, helper, icon: Icon }: { label: string; value: string; helper?: string; icon: LucideIcon }) {
  return (
    <article className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-950/[0.02]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-600">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums text-[var(--brand-navy)]">{value}</p>
          {helper ? <p className="mt-1 text-pretty text-xs leading-5 text-slate-500">{helper}</p> : null}
        </div>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-[var(--brand-blue)]" aria-hidden="true">
          <Icon className="size-5" />
        </div>
      </div>
    </article>
  );
}
