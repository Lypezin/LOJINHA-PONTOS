import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper?: string;
  icon: LucideIcon;
}) {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 truncate font-display text-2xl font-bold tracking-tight tabular-nums text-[var(--brand-navy)]">
            {value}
          </p>
          {helper ? (
            <p className="mt-1 text-pretty text-xs leading-5 text-slate-500">
              {helper}
            </p>
          ) : null}
        </div>
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100/80 text-slate-600"
          aria-hidden="true"
        >
          <Icon className="size-[18px]" strokeWidth={2} />
        </div>
      </div>
    </article>
  );
}
