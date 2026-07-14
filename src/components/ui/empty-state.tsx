import type { ReactNode } from "react";

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-[var(--brand-blue)]" aria-hidden="true">
        {icon}
      </div>
      <h2 className="text-balance text-xl font-bold text-[var(--brand-navy)]">{title}</h2>
      <p className="mt-2 max-w-md text-pretty text-sm leading-6 text-slate-600">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
