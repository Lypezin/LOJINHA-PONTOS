import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? <p className="mb-3 inline-flex min-h-7 items-center rounded-full border border-blue-100 bg-blue-50 px-3 text-xs font-bold text-[var(--brand-blue-dark)]">{eyebrow}</p> : null}
        <h1 className="text-balance text-3xl font-extrabold text-[var(--brand-navy)] sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-slate-600 sm:text-base">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
