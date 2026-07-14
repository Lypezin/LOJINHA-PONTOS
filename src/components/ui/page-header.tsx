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
        {eyebrow ? <p className="mb-2 text-sm font-bold text-[var(--brand-blue)]">{eyebrow}</p> : null}
        <h1 className="text-balance text-3xl font-extrabold text-[var(--brand-navy)] sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-slate-600 sm:text-base">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
