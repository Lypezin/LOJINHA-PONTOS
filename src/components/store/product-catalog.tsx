"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { CheckCircle2, Gift, Minus, Package, Plus, ShoppingBag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/cn";
import { formatCurrency, formatPoints } from "@/lib/format";

export type StoreProduct = {
  id: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string | null;
  pointsCost: number;
  referenceValueCents: number | null;
  stockQuantity: number;
  maxPerCourierPerPeriod: number | null;
  featured: boolean;
};

function ProductImage({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center bg-blue-50 text-[var(--brand-blue)]" role="img" aria-label={`Imagem ainda não cadastrada para ${name}`}>
        <Package className="size-12" aria-hidden="true" />
      </div>
    );
  }
  return (
    // O catálogo aceita URL externa e imagem embutida cadastradas pelo administrador.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" onError={() => setFailed(true)} />
  );
}

function RedeemDialog({ product, balance }: { product: StoreProduct; balance: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ code: string; pointsSpent: number } | null>(null);
  const maxQuantity = Math.max(1, Math.min(10, product.stockQuantity, product.maxPerCourierPerPeriod ?? 10));
  const total = product.pointsCost * quantity;
  const unavailable = product.stockQuantity < 1 || balance < product.pointsCost;

  function handleOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setQuantity(1);
      setError("");
      setResult(null);
    }
  }

  async function redeem() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/redemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity, idempotencyKey: crypto.randomUUID() }),
      });
      const data = (await response.json()) as { error?: string; redemption?: { code: string; pointsSpent: number } };
      if (!response.ok || !data.redemption) throw new Error(data.error || "Não foi possível concluir o resgate.");
      setResult({ code: data.redemption.code, pointsSpent: data.redemption.pointsSpent });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir o resgate. Atualize a página e tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpen}>
      <AlertDialog.Trigger asChild>
        <Button className="w-full" disabled={unavailable} aria-label={unavailable ? `${product.name} indisponível para resgate` : `Resgatar ${product.name}`}>
          <Gift className="size-4" aria-hidden="true" />
          {product.stockQuantity < 1 ? "Sem estoque" : balance < product.pointsCost ? "Saldo insuficiente" : "Resgatar item"}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-slate-950/50" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[20px] bg-white p-6 shadow-xl focus:outline-none sm:p-8">
          {result ? (
            <div className="text-center" aria-live="polite">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-[var(--brand-mint-ink)]" aria-hidden="true">
                <CheckCircle2 className="size-7" />
              </div>
              <AlertDialog.Title className="mt-5 text-balance text-2xl font-extrabold text-[var(--brand-navy)]">Resgate solicitado</AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-pretty text-sm leading-6 text-slate-600">
                Guarde o código abaixo. Você pode acompanhar o andamento em Meus resgates.
              </AlertDialog.Description>
              <div className="mt-6 rounded-2xl bg-blue-50 p-5">
                <p className="text-xs font-bold text-slate-600">Código do resgate</p>
                <p className="mt-1 text-xl font-extrabold tabular-nums text-[var(--brand-blue-dark)]">{result.code}</p>
                <p className="mt-2 text-sm font-semibold tabular-nums text-slate-600">{formatPoints(result.pointsSpent)} pontos debitados</p>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <a href="/historico" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--brand-blue)] px-5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">
                  Ver meus resgates
                </a>
                <AlertDialog.Cancel asChild>
                  <Button variant="secondary">Continuar na loja</Button>
                </AlertDialog.Cancel>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[var(--brand-blue)]">Confirmar resgate</p>
                  <AlertDialog.Title className="mt-1 text-balance text-2xl font-extrabold text-[var(--brand-navy)]">{product.name}</AlertDialog.Title>
                </div>
                <AlertDialog.Cancel asChild>
                  <button className="flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200" aria-label="Fechar confirmação">
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </AlertDialog.Cancel>
              </div>
              <AlertDialog.Description className="mt-3 text-pretty text-sm leading-6 text-slate-600">
                Confira a quantidade, o custo e o saldo depois do resgate antes de confirmar.
              </AlertDialog.Description>

              <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4">
                <div>
                  <p className="text-sm font-bold text-[var(--brand-navy)]">Quantidade</p>
                  <p className="mt-1 text-xs text-slate-500">Máximo nesta solicitação: {maxQuantity}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1} className="flex size-11 items-center justify-center rounded-xl border border-slate-200 text-[var(--brand-navy)] disabled:opacity-40" aria-label="Diminuir quantidade">
                    <Minus className="size-4" aria-hidden="true" />
                  </button>
                  <span className="min-w-8 text-center text-lg font-extrabold tabular-nums" aria-live="polite">{quantity}</span>
                  <button onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))} disabled={quantity >= maxQuantity} className="flex size-11 items-center justify-center rounded-xl border border-slate-200 text-[var(--brand-navy)] disabled:opacity-40" aria-label="Aumentar quantidade">
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <dl className="mt-4 divide-y divide-slate-200 rounded-2xl bg-slate-50 px-4">
                <div className="flex items-center justify-between gap-4 py-3 text-sm">
                  <dt className="text-slate-600">Custo total</dt>
                  <dd className="font-extrabold tabular-nums text-[var(--brand-navy)]">{formatPoints(total)} pts</dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-3 text-sm">
                  <dt className="text-slate-600">Saldo atual</dt>
                  <dd className="font-bold tabular-nums text-[var(--brand-navy)]">{formatPoints(balance)} pts</dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-3 text-sm">
                  <dt className="text-slate-600">Saldo depois</dt>
                  <dd className="font-extrabold tabular-nums text-[var(--brand-mint-ink)]">{formatPoints(balance - total)} pts</dd>
                </div>
              </dl>
              {product.maxPerCourierPerPeriod ? <p className="mt-3 text-pretty text-xs leading-5 text-slate-500">Limite do item: {product.maxPerCourierPerPeriod} unidade(s) por competência.</p> : null}
              {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">{error}</p> : null}
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Button onClick={redeem} disabled={pending || total > balance}>
                  {pending ? "Confirmando…" : "Confirmar resgate"}
                </Button>
                <AlertDialog.Cancel asChild>
                  <Button variant="secondary" disabled={pending}>Voltar</Button>
                </AlertDialog.Cancel>
              </div>
            </>
          )}
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function ProductCatalog({ products, balance }: { products: StoreProduct[]; balance: number }) {
  const [category, setCategory] = useState("Todos");
  const categories = useMemo(() => ["Todos", ...Array.from(new Set(products.map((product) => product.category))).sort()], [products]);
  const visible = category === "Todos" ? products : products.filter((product) => product.category === category);

  return (
    <section aria-labelledby="catalog-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-[var(--brand-blue)]">Catálogo</p>
          <h2 id="catalog-title" className="mt-1 text-balance text-2xl font-extrabold text-[var(--brand-navy)] sm:text-3xl">Escolha sua próxima conquista</h2>
        </div>
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1" aria-label="Filtrar produtos por categoria">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              aria-pressed={category === item}
              className={cn(
                "min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200",
                category === item ? "border-[var(--brand-blue)] bg-[var(--brand-blue)] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {visible.length ? (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((product) => {
            const referenceValue = formatCurrency(product.referenceValueCents);
            const lowStock = product.stockQuantity > 0 && product.stockQuantity <= 5;
            return (
              <article key={product.id} className="flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm ring-1 ring-slate-950/[0.02] hover:-translate-y-1 hover:shadow-md transition-all duration-200">
                <div className="relative overflow-hidden">
                  <ProductImage src={product.imageUrl} name={product.name} />
                  {product.featured ? <StatusBadge tone="info" className="absolute left-3 top-3 border-white/80 bg-white">Destaque</StatusBadge> : null}
                </div>
                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--brand-blue)]">{product.category}</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold tabular-nums text-[var(--brand-mint-ink)]">{formatPoints(product.pointsCost)} pts</span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-balance text-lg font-extrabold text-[var(--brand-navy)]">{product.name}</h3>
                  <p className="mt-2 line-clamp-2 text-pretty text-sm leading-5 text-slate-700">{product.description}</p>
                  <div className="mt-3 flex min-h-10 flex-col justify-end gap-1 text-xs">
                    <p className={cn("font-bold tabular-nums", product.stockQuantity < 1 ? "text-red-700" : lowStock ? "text-amber-800" : "text-slate-650")}>
                      {product.stockQuantity < 1 ? "Sem estoque" : lowStock ? `Estoque baixo: ${product.stockQuantity}` : `${product.stockQuantity} em estoque`}
                    </p>
                    {referenceValue ? <p className="text-slate-600 font-medium">Valor de referência: <span className="tabular-nums">{referenceValue}</span></p> : null}
                  </div>
                  <div className="mt-4">
                    <RedeemDialog product={product} balance={balance} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-[20px] border border-dashed border-slate-300 bg-white p-10 text-center">
          <ShoppingBag className="mx-auto size-10 text-[var(--brand-blue)]" aria-hidden="true" />
          <h3 className="mt-4 text-balance text-lg font-bold text-[var(--brand-navy)]">Nenhum item nesta categoria</h3>
          <button onClick={() => setCategory("Todos")} className="mt-4 min-h-11 rounded-full px-4 text-sm font-bold text-[var(--brand-blue-dark)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">Ver todo o catálogo</button>
        </div>
      )}
    </section>
  );
}
