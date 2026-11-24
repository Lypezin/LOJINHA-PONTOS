"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Banknote, Check, CheckCircle2, Copy, Gift, Minus, Package, Plus, Search, ShoppingBag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
      <div
        className="flex aspect-[4/3] items-center justify-center bg-slate-100 text-slate-400"
        role="img"
        aria-label={`Imagem ainda não cadastrada para ${name}`}
      >
        <Package className="size-10" strokeWidth={1.6} aria-hidden="true" />
      </div>
    );
  }
  return (
    // O catálogo aceita URL externa e imagem embutida cadastradas pelo administrador.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      className="aspect-[4/3] w-full bg-slate-100 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      onError={() => setFailed(true)}
    />
  );
}

function RedeemDialog({ product, balance }: { product: StoreProduct; balance: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [fulfillmentType, setFulfillmentType] = useState<"PRODUCT" | "CASH">("PRODUCT");
  const [pixKey, setPixKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{
    code: string;
    pointsSpent: number;
    fulfillmentType: string;
    cashAmountCents?: number | null;
  } | null>(null);

  const maxQuantity = Math.max(1, Math.min(10, product.stockQuantity, product.maxPerCourierPerPeriod ?? 10));
  const totalPoints = product.pointsCost * quantity;
  const outOfStock = product.stockQuantity < 1;
  const insufficient = balance < product.pointsCost;
  const unavailable = outOfStock || insufficient;

  const referenceValue = product.referenceValueCents ? product.referenceValueCents / 100 : null;
  const cashAmountPerUnit = product.referenceValueCents ? Math.round(product.referenceValueCents * 0.5) / 100 : null;
  const totalCashAmount = cashAmountPerUnit ? cashAmountPerUnit * quantity : null;

  function handleOpen(next: boolean) {
    setOpen(next);
    if (next) {
      setQuantity(1);
      setFulfillmentType("PRODUCT");
      setPixKey("");
      setError("");
      setCopied(false);
      setResult(null);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard indisponível em contextos sem permissão
    }
  }

  async function redeem() {
    setPending(true);
    setError("");

    if (fulfillmentType === "CASH") {
      if (!product.referenceValueCents || product.referenceValueCents <= 0) {
        setError("Este produto não possui valor de referência para resgate em dinheiro.");
        setPending(false);
        return;
      }
      if (!pixKey.trim()) {
        setError("Por favor, digite sua chave PIX.");
        setPending(false);
        return;
      }
    }

    try {
      const response = await fetch("/api/redemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          fulfillmentType,
          pixKey: fulfillmentType === "CASH" ? pixKey.trim() : undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        redemption?: { code: string; pointsSpent: number; fulfillmentType: string; cashAmountCents?: number | null };
      };
      if (!response.ok || !data.redemption) throw new Error(data.error || "Não foi possível concluir o resgate.");
      setResult({
        code: data.redemption.code,
        pointsSpent: data.redemption.pointsSpent,
        fulfillmentType: data.redemption.fulfillmentType,
        cashAmountCents: data.redemption.cashAmountCents,
      });
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível concluir o resgate. Atualize a página e tente novamente.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpen}>
      <AlertDialog.Trigger asChild>
        <Button
          size="md"
          variant={unavailable ? "secondary" : "primary"}
          className="w-full"
          disabled={unavailable}
          aria-label={unavailable ? `${product.name} indisponível para resgate` : `Resgatar ${product.name}`}
        >
          <Gift className="size-4" aria-hidden="true" />
          {outOfStock
            ? "Sem estoque"
            : insufficient
              ? `Faltam ${formatPoints(product.pointsCost - balance)} pts`
              : "Resgatar"}
        </Button>
      </AlertDialog.Trigger>

      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[var(--z-overlay)] bg-slate-950/45 backdrop-blur-[2px]" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[var(--z-drawer)] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl focus:outline-none sm:p-7">
          {result ? (
            <div className="text-center" aria-live="polite">
              <div
                className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"
                aria-hidden="true"
              >
                <CheckCircle2 className="size-6" />
              </div>
              <AlertDialog.Title className="font-display mt-4 text-balance text-xl font-bold text-[var(--brand-navy)]">
                Resgate solicitado
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-1.5 text-pretty text-sm leading-relaxed text-slate-600">
                {result.fulfillmentType === "CASH"
                  ? "Sua solicitação via PIX foi registrada. O pagamento será processado em breve."
                  : "Guarde o código abaixo. Você acompanha tudo em Meus resgates."}
              </AlertDialog.Description>

              <div className="mt-5 rounded-xl border border-slate-200/80 bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">Código do resgate</p>
                <div className="mt-1.5 flex items-center justify-center gap-2">
                  <p className="font-mono text-lg font-bold tracking-tight tabular-nums text-[var(--brand-navy)]">
                    {result.code}
                  </p>
                  <button
                    type="button"
                    onClick={() => void copyCode(result.code)}
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-[var(--brand-navy)]"
                    aria-label="Copiar código do resgate"
                  >
                    {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  </button>
                </div>
                <p className="mt-1.5 text-xs font-medium tabular-nums text-slate-500">
                  {formatPoints(result.pointsSpent)} pontos debitados
                </p>

                {result.fulfillmentType === "CASH" && result.cashAmountCents ? (
                  <div className="mt-3 rounded-lg border border-emerald-200/80 bg-emerald-50 p-3 text-emerald-950">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                      Valor via PIX
                    </p>
                    <p className="mt-0.5 text-base font-bold tabular-nums">
                      {formatCurrency(result.cashAmountCents)}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                <a
                  href="/historico"
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--brand-blue)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-blue-dark)]"
                >
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
                  <p className="text-xs font-semibold text-[var(--brand-blue)]">Confirmar resgate</p>
                  <AlertDialog.Title className="font-display mt-0.5 text-balance text-xl font-bold text-[var(--brand-navy)]">
                    {product.name}
                  </AlertDialog.Title>
                </div>
                <AlertDialog.Cancel asChild>
                  <button
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Fechar confirmação"
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </AlertDialog.Cancel>
              </div>
              <AlertDialog.Description className="mt-1.5 text-pretty text-xs leading-relaxed text-slate-500">
                Escolha como deseja receber e confira os pontos utilizados.
              </AlertDialog.Description>

              <div className="mt-5 space-y-2">
                <p className="text-xs font-semibold text-slate-700">Formato de recebimento</p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setFulfillmentType("PRODUCT")}
                    className={cn(
                      "flex flex-col items-start rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                      fulfillmentType === "PRODUCT"
                        ? "border-[var(--brand-blue)] bg-blue-50/50 ring-1 ring-[var(--brand-blue)]"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--brand-navy)]">
                      <Package className="size-4 text-[var(--brand-blue)]" aria-hidden="true" />
                      <span>Produto físico</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Receba o item cadastrado</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFulfillmentType("CASH")}
                    disabled={!cashAmountPerUnit}
                    className={cn(
                      "flex flex-col items-start rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50",
                      fulfillmentType === "CASH"
                        ? "border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
                      <Banknote className="size-4 text-emerald-600" aria-hidden="true" />
                      <span>Dinheiro via PIX</span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-600">
                      {cashAmountPerUnit
                        ? `50% (${formatCurrency(Math.round((product.referenceValueCents ?? 0) * 0.5))})`
                        : "Indisponível"}
                    </p>
                  </button>
                </div>
              </div>

              {fulfillmentType === "CASH" ? (
                <div className="mt-4 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4">
                  {referenceValue && totalCashAmount ? (
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-emerald-900">
                      <span>Referência: {formatCurrency(product.referenceValueCents)}</span>
                      <span className="text-sm font-bold text-emerald-950 tabular-nums">
                        Recebe: {formatCurrency(Math.round((product.referenceValueCents ?? 0) * 0.5 * quantity))}
                      </span>
                    </div>
                  ) : null}

                  <label className="mt-3 block">
                    <span className="text-xs font-semibold text-slate-700">
                      Sua Chave PIX (CPF, CNPJ, E-mail, Celular ou Aleatória)
                    </span>
                    <input
                      type="text"
                      value={pixKey}
                      onChange={(e) => setPixKey(e.target.value)}
                      placeholder="Digite ou cole sua chave PIX"
                      className="mt-1.5 h-10 w-full rounded-xl border border-emerald-300 bg-white px-3 text-sm text-[var(--brand-navy)] outline-none placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </label>
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-slate-200/80 p-3.5">
                <div>
                  <p className="text-sm font-semibold text-[var(--brand-navy)]">Quantidade</p>
                  <p className="text-xs text-slate-500">Máximo por pedido: {maxQuantity}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    disabled={quantity <= 1}
                    className="flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                    aria-label="Diminuir quantidade"
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </button>
                  <span className="min-w-7 text-center text-base font-bold tabular-nums" aria-live="polite">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
                    disabled={quantity >= maxQuantity}
                    className="flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                    aria-label="Aumentar quantidade"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <dl className="mt-4 divide-y divide-slate-200/70 rounded-xl border border-slate-200/70 bg-slate-50/70 px-4">
                <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <dt className="text-slate-500">Custo em pontos</dt>
                  <dd className="font-bold tabular-nums text-[var(--brand-navy)]">
                    {formatPoints(totalPoints)} pts
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <dt className="text-slate-500">Saldo atual</dt>
                  <dd className="font-semibold tabular-nums text-slate-700">{formatPoints(balance)} pts</dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <dt className="text-slate-500">Saldo restante</dt>
                  <dd className="font-bold tabular-nums text-emerald-700">
                    {formatPoints(balance - totalPoints)} pts
                  </dd>
                </div>
              </dl>

              {product.maxPerCourierPerPeriod ? (
                <p className="mt-3 text-xs text-slate-500">
                  Limite do item: {product.maxPerCourierPerPeriod} unidade(s) por ciclo.
                </p>
              ) : null}

              {error ? (
                <p
                  className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                <Button onClick={redeem} disabled={pending || totalPoints > balance}>
                  {pending ? "Confirmando…" : "Confirmar resgate"}
                </Button>
                <AlertDialog.Cancel asChild>
                  <Button variant="secondary" disabled={pending}>
                    Voltar
                  </Button>
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
  const [query, setQuery] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const categories = useMemo(
    () => ["Todos", ...Array.from(new Set(products.map((product) => product.category))).sort()],
    [products],
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => {
      if (category !== "Todos" && product.category !== category) return false;
      if (onlyAvailable && (product.stockQuantity < 1 || balance < product.pointsCost)) return false;
      if (term) {
        const matchName = product.name.toLowerCase().includes(term);
        const matchDesc = product.description.toLowerCase().includes(term);
        const matchCat = product.category.toLowerCase().includes(term);
        if (!matchName && !matchDesc && !matchCat) return false;
      }
      return true;
    });
  }, [products, category, onlyAvailable, query, balance]);

  return (
    <section aria-labelledby="catalog-title" className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold text-[var(--brand-blue)]">Catálogo</p>
          <h2
            id="catalog-title"
            className="font-display mt-0.5 text-balance text-xl font-bold tracking-tight text-[var(--brand-navy)] sm:text-2xl"
          >
            Escolha seu próximo prêmio
          </h2>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <label className="relative block w-full sm:w-64">
            <span className="sr-only">Buscar no catálogo</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar prêmio…"
              className="h-10 w-full rounded-xl border border-slate-200/90 bg-white pl-9 pr-3 text-sm text-[var(--brand-navy)] outline-none placeholder:text-slate-400 focus:border-[var(--brand-blue)] focus:ring-2 focus:ring-blue-500/15"
            />
          </label>

          <button
            type="button"
            onClick={() => setOnlyAvailable((current) => !current)}
            aria-pressed={onlyAvailable}
            className={cn(
              "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border px-3.5 text-xs font-semibold transition-colors",
              onlyAvailable
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-slate-200/90 bg-white text-slate-600 hover:bg-slate-50",
            )}
          >
            <span
              className={cn("size-2 rounded-full", onlyAvailable ? "bg-emerald-500" : "bg-slate-300")}
              aria-hidden="true"
            />
            Posso resgatar ({products.filter((p) => p.stockQuantity > 0 && balance >= p.pointsCost).length})
          </button>
        </div>
      </div>

      <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1" aria-label="Filtrar produtos por categoria">
        {categories.map((item) => {
          const active = category === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              aria-pressed={active}
              className={cn(
                "min-h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                active
                  ? "border-[var(--brand-navy)] bg-[var(--brand-navy)] text-white"
                  : "border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 hover:text-[var(--brand-navy)]",
              )}
            >
              {item}
            </button>
          );
        })}
      </div>

      {visible.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((product) => {
            const referenceValue = formatCurrency(product.referenceValueCents);
            const lowStock = product.stockQuantity > 0 && product.stockQuantity <= 5;
            const outOfStock = product.stockQuantity < 1;
            const progressPct = product.pointsCost > 0 ? Math.min(100, Math.round((balance / product.pointsCost) * 100)) : 100;
            const missingPoints = Math.max(0, product.pointsCost - balance);

            return (
              <article
                key={product.id}
                className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] duration-150 hover:border-slate-300 hover:shadow-sm"
              >
                <div className="relative overflow-hidden border-b border-slate-100">
                  <ProductImage src={product.imageUrl} name={product.name} />
                  {product.featured ? (
                    <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--brand-blue)] shadow-xs backdrop-blur-xs">
                      Destaque
                    </span>
                  ) : null}
                  <span className="absolute bottom-2.5 right-2.5 inline-flex items-center rounded-full bg-[var(--brand-navy)]/90 px-2.5 py-1 text-xs font-bold tabular-nums text-white backdrop-blur-xs">
                    {formatPoints(product.pointsCost)} pts
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {product.category}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-medium tabular-nums",
                        outOfStock
                          ? "text-red-600"
                          : lowStock
                            ? "text-amber-700"
                            : "text-slate-500",
                      )}
                    >
                      {outOfStock
                        ? "Esgotado"
                        : lowStock
                          ? `Últimas ${product.stockQuantity} un.`
                          : `${product.stockQuantity} disponíveis`}
                    </span>
                  </div>

                  <h3 className="font-display mt-1.5 line-clamp-2 text-balance text-base font-semibold leading-snug text-[var(--brand-navy)]">
                    {product.name}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-pretty text-xs leading-relaxed text-slate-500">
                    {product.description}
                  </p>

                  <div className="mt-3 space-y-2 pt-1 text-xs">
                    {referenceValue ? (
                      <p className="text-slate-500">
                        Ref.: <span className="font-medium tabular-nums text-slate-700">{referenceValue}</span>
                        {product.referenceValueCents ? (
                          <span className="ml-1.5 text-emerald-700 font-medium">
                            ({formatCurrency(Math.round(product.referenceValueCents * 0.5))} no PIX)
                          </span>
                        ) : null}
                      </p>
                    ) : null}

                    {!outOfStock && missingPoints > 0 ? (
                      <div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[var(--brand-blue)]/70"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-auto pt-4">
                    <RedeemDialog product={product} balance={balance} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <ShoppingBag className="mx-auto size-8 text-slate-400" aria-hidden="true" />
          <h3 className="font-display mt-3 text-base font-semibold text-[var(--brand-navy)]">
            Nenhum item encontrado
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Ajuste a busca ou limpe os filtros para ver todo o catálogo.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setCategory("Todos");
              setQuery("");
              setOnlyAvailable(false);
            }}
            className="mt-4"
          >
            Limpar filtros
          </Button>
        </div>
      )}
    </section>
  );
}
