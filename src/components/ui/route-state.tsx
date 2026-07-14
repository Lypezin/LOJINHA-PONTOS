"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RouteError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-[60dvh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-[20px] border border-red-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-red-50 text-red-700" aria-hidden="true">
          <AlertCircle className="size-6" />
        </div>
        <h1 className="mt-5 text-balance text-2xl font-extrabold text-[var(--brand-navy)]">Não foi possível carregar esta página</h1>
        <p className="mt-2 text-pretty text-sm leading-6 text-slate-600">Verifique sua conexão e tente novamente. Nenhuma alteração foi feita.</p>
        <Button onClick={reset} className="mt-6">
          <RefreshCw className="size-4" aria-hidden="true" />
          Tentar novamente
        </Button>
      </div>
    </main>
  );
}

export function RouteLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8" aria-label="Carregando conteúdo" aria-busy="true">
      <div className="space-y-3">
        <div className="h-4 w-28 rounded-full bg-slate-200" />
        <div className="h-10 w-72 max-w-full rounded-xl bg-slate-200" />
        <div className="h-5 w-full max-w-xl rounded-lg bg-slate-200" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 rounded-[20px] bg-slate-200" />)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-72 rounded-[20px] bg-slate-200" />)}
      </div>
      <span className="sr-only">Carregando…</span>
    </main>
  );
}
