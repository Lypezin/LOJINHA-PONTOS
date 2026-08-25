"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Award, Banknote, HelpCircle, Info, Sparkles, X, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ProgramRulesBanner() {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-[20px] border border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-slate-50 p-5 shadow-sm sm:p-6" aria-labelledby="rules-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--brand-blue)] text-white shadow-md shadow-blue-900/10">
            <Zap className="size-6 text-[var(--brand-mint)]" aria-hidden="true" />
          </div>
          <div>
            <h2 id="rules-heading" className="text-lg font-extrabold text-[var(--brand-navy)] sm:text-xl">
              Regras de Pontuação & Resgate
            </h2>
            <p className="text-xs font-semibold text-slate-600 sm:text-sm">
              Confira como acumular pontos e como resgatar em produto ou dinheiro no PIX.
            </p>
          </div>
        </div>

        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <Button variant="secondary" size="sm" className="self-start sm:self-auto">
              <HelpCircle className="size-4 text-[var(--brand-blue)]" aria-hidden="true" />
              Ver regras completas
            </Button>
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl focus:outline-none sm:p-8">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-[var(--brand-blue)]">
                    <Info className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--brand-blue)]">Programa de Pontos EntreGô</p>
                    <Dialog.Title className="text-xl font-extrabold text-[var(--brand-navy)]">
                      Regras Oficiais do Programa
                    </Dialog.Title>
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button className="flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200" aria-label="Fechar modal de regras">
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                  <div className="flex items-center gap-2.5 font-bold text-[var(--brand-navy)]">
                    <Sparkles className="size-5 text-[var(--brand-blue)]" />
                    <span>1. Pontuação Padrão por Pedido</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    Cada pedido aceito e concluído no mês equivale a <strong className="font-extrabold text-[var(--brand-navy)]">1 Ponto</strong> no seu saldo de competência.
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                  <div className="flex items-center gap-2.5 font-bold text-amber-950">
                    <Award className="size-5 text-amber-600" />
                    <span>2. Bônus Entregador Elite (+300 pedidos)</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-amber-900">
                    Se você foi categoria <strong className="font-extrabold">Elite (+300 entregas)</strong> no mês anterior, cada pedido realizado no mês atual vale <strong className="font-extrabold text-amber-950">1.5 Pontos</strong> (50% a mais por pedido).
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <div className="flex items-center gap-2.5 font-bold text-emerald-950">
                    <Banknote className="size-5 text-emerald-600" />
                    <span>3. Opção de Resgate em Dinheiro (PIX)</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-emerald-900">
                    Ao resgatar qualquer prêmio, você pode optar por receber em <strong className="font-extrabold text-emerald-950">Dinheiro direto na sua conta via PIX</strong> em vez do produto físico.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2.5 font-bold text-[var(--brand-navy)]">
                    <Info className="size-5 text-slate-600" />
                    <span>4. Cálculo do Resgate em Dinheiro</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    O valor pago via PIX é exatamente <strong className="font-extrabold text-[var(--brand-navy)]">50% do Valor de Referência</strong> cadastrado no produto.
                  </p>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                    <p className="font-bold text-[var(--brand-navy)]">Exemplo prático:</p>
                    <p className="mt-1">
                      Produto com valor de referência de <strong className="font-bold">R$ 200,00</strong> → Resgate em dinheiro no valor de <strong className="font-bold text-emerald-700">R$ 100,00 no PIX</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-4 text-right">
                <Dialog.Close asChild>
                  <Button variant="secondary">Entendido</Button>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[var(--brand-blue)]">
            <Sparkles className="size-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-[var(--brand-navy)]">1 Pedido = 1 Ponto</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-600">Acúmulo mensal por entrega</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <Award className="size-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-[var(--brand-navy)]">Elite = 1.5 Pontos</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-600">Para quem fez +300 no mês anterior</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <Banknote className="size-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-[var(--brand-navy)]">Opção Dinheiro (PIX)</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-600">Receba direto na sua conta</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
            <Info className="size-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-[var(--brand-navy)]">50% em Dinheiro</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-600">Metade do valor de referência</p>
          </div>
        </div>
      </div>
    </section>
  );
}
