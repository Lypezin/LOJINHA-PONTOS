"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RouteError({ reset, reference }: { reset: () => void; reference?: string }) {
  return (
    <main className="flex min-h-[60dvh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-7 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-red-50 text-red-600" aria-hidden="true">
          <AlertCircle className="size-5" />
        </div>
        <h1 className="font-display mt-4 text-balance text-xl font-bold text-[var(--brand-navy)]">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-slate-600">
          Tente novamente. Se o problema continuar, informe a referência abaixo à equipe responsável.
        </p>
        {reference ? (
          <p className="mt-3 text-xs text-slate-500">
            Referência: <strong className="font-semibold tabular-nums text-slate-700">{reference}</strong>
          </p>
        ) : null}
        <Button onClick={reset} className="mt-5">
          <RefreshCw className="size-4" aria-hidden="true" />
          Tentar novamente
        </Button>
      </div>
    </main>
  );
}

export function RouteLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8" aria-label="Carregando conteúdo" aria-busy="true">
      <div className="animate-pulse space-y-2.5">
        <div className="h-3.5 w-24 rounded-full bg-slate-200/80" />
        <div className="h-8 w-64 max-w-full rounded-xl bg-slate-200/80" />
        <div className="h-4 w-full max-w-md rounded-lg bg-slate-200/70" />
      </div>
      <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 rounded-2xl border border-slate-200/60 bg-white p-5">
            <div className="h-3 w-24 rounded bg-slate-200/70" />
            <div className="mt-4 h-7 w-20 rounded bg-slate-200/80" />
          </div>
        ))}
      </div>
      <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-72 rounded-2xl border border-slate-200/60 bg-white" />
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </main>
  );
}
