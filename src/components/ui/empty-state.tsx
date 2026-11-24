import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
      <div
        className="mb-3.5 flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
        aria-hidden="true"
      >
        {icon}
      </div>
      <h2 className="font-display text-balance text-lg font-semibold text-[var(--brand-navy)]">
        {title}
      </h2>
      <p className="mt-1.5 max-w-md text-pretty text-sm leading-relaxed text-slate-500">
        {description}
      </p>
      {action ? <div className="mt-5 flex w-full justify-center sm:w-auto">{action}</div> : null}
    </div>
  );
}
