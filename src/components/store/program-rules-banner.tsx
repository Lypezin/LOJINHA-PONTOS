"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Award, Banknote, HelpCircle, Info, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function ProgramRulesBanner({
  variant = "inline",
  className,
}: {
  variant?: "inline" | "card";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {variant === "card" ? (
        <section
          className={cn(
            "flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between sm:px-5",
            className,
          )}
          aria-labelledby="rules-heading"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[var(--brand-blue)]">
              <HelpCircle className="size-[18px]" aria-hidden="true" />
            </div>
            <div>
              <h2 id="rules-heading" className="text-sm font-semibold text-[var(--brand-navy)]">
                Regras de pontuação e resgate
              </h2>
              <p className="text-xs text-slate-500">
                1 pedido = 1 pt (Elite 1,5 pt) • Resgate produto físico ou 50% em PIX.
              </p>
            </div>
          </div>
          <Dialog.Trigger asChild>
            <Button variant="secondary" size="sm" className="self-start sm:self-auto">
              Ver regras completas
            </Button>
          </Dialog.Trigger>
        </section>
      ) : (
        <Dialog.Trigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
              className,
            )}
          >
            <HelpCircle className="size-4 text-emerald-300" aria-hidden="true" />
            Regras do programa
          </button>
        </Dialog.Trigger>
      )}

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--z-overlay)] bg-slate-950/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[var(--z-drawer)] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl focus:outline-none sm:p-7">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[var(--brand-blue)]">
                <Info className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--brand-blue)]">
                  Programa de Pontos EntreGô
                </p>
                <Dialog.Title className="font-display text-lg font-bold text-[var(--brand-navy)]">
                  Como funciona o programa
                </Dialog.Title>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                aria-label="Fechar modal de regras"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-5 divide-y divide-slate-100">
            <div className="flex items-start gap-3.5 py-3.5 first:pt-0">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[var(--brand-blue)]">
                <Sparkles className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[var(--brand-navy)]">
                  Pontuação padrão por pedido
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Cada pedido aceito e concluído equivale a{" "}
                  <strong className="font-semibold text-[var(--brand-navy)]">1 ponto</strong> no seu saldo do ciclo.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 py-3.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <Award className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[var(--brand-navy)]">
                  Bônus Entregador Elite (+300 pedidos)
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Quem atingiu a categoria{" "}
                  <strong className="font-semibold text-[var(--brand-navy)]">Elite (+300 entregas)</strong>{" "}
                  no mês anterior passa a ganhar{" "}
                  <strong className="font-semibold text-amber-800">1,5 ponto por pedido</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 py-3.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Banknote className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[var(--brand-navy)]">
                  Resgate em produto ou dinheiro via PIX
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Na hora do resgate, você escolhe receber o prêmio físico ou{" "}
                  <strong className="font-semibold text-emerald-800">50% do valor de referência via PIX</strong>{" "}
                  direto na sua chave cadastrada.
                </p>
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                  Exemplo: item com valor de referência de <strong className="font-semibold">R$ 200,00</strong>{" "}
                  gera <strong className="font-semibold text-emerald-700">R$ 100,00 no PIX</strong>.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
            <Dialog.Close asChild>
              <Button size="sm">Entendido</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
