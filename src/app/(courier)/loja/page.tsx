import Link from "next/link";
import { CalendarClock, ChevronRight, Clock3, ShoppingBag, WalletCards } from "lucide-react";
import { ProductCatalog, type StoreProduct } from "@/components/store/product-catalog";
import { ProgramRulesBanner } from "@/components/store/program-rules-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentAccount } from "@/features/points/period";
import { pointsCycleLastUseDate } from "@/features/points/cycle";
import { requirePageUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate, formatPoints } from "@/lib/format";
import { periodLabel } from "@/lib/presentation";

export const metadata = { title: "Loja" };

function daysUntil(end: Date, now = new Date()) {
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
}

export default async function StorePage() {
  const user = await requirePageUser();
  if (!user.courierId || !user.courier) return null;

  const [{ period, account }, products] = await Promise.all([
    getCurrentAccount(user.courierId),
    db.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        imageUrl: true,
        updatedAt: true,
        pointsCost: true,
        referenceValueCents: true,
        stockQuantity: true,
        maxPerCourierPerPeriod: true,
        featured: true,
      },
    }),
  ]);

  const catalogProducts = products.map(({ updatedAt, ...product }) => ({
    ...product,
    imageUrl: product.imageUrl?.startsWith("data:image/")
      ? `/api/products/${encodeURIComponent(product.id)}/image?v=${updatedAt.getTime()}`
      : product.imageUrl,
  }));

  const firstName = (user.displayName || user.courier.name).split(" ")[0];
  const balance = account?.balancePoints ?? 0;
  const daysLeft = daysUntil(period.endsAt);
  const expiringSoon = daysLeft <= 7;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-slate-500">{periodLabel(period)}</p>
          <h1 className="font-display mt-0.5 text-xl font-bold tracking-tight text-[var(--brand-navy)] sm:text-2xl">
            Olá, {firstName}
          </h1>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          1 pedido = 1 pt • PIX 50%
        </span>
      </div>

      <section
        className="rounded-2xl bg-[var(--brand-navy)] p-5 text-white shadow-[0_8px_24px_-8px_rgba(11,22,51,0.28)] sm:p-7"
        aria-labelledby="balance-title"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <WalletCards className="size-4 text-emerald-400" aria-hidden="true" />
              <span id="balance-title">Saldo disponível no ciclo</span>
            </div>

            <div className="mt-2.5 flex items-baseline gap-2">
              <p className="font-display text-4xl font-bold tracking-tight tabular-nums text-white sm:text-5xl">
                {formatPoints(balance)}
              </p>
              <span className="text-sm font-medium text-slate-300 sm:text-base">pontos</span>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Link
                href="/historico"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-[var(--brand-navy)] transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                Ver extrato
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
              <ProgramRulesBanner variant="inline" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:min-w-[22rem]">
            <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3.5 sm:p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <CalendarClock className="size-3.5 text-emerald-400" aria-hidden="true" />
                <span>Válido até</span>
              </div>
              <p className="mt-2 text-sm font-semibold tabular-nums text-white sm:text-base">
                {formatDate(pointsCycleLastUseDate(period.endsAt))}
              </p>
            </div>

            <div
              className={
                expiringSoon
                  ? "rounded-xl border border-amber-300/40 bg-amber-400/15 p-3.5 sm:p-4"
                  : "rounded-xl border border-white/10 bg-white/[0.06] p-3.5 sm:p-4"
              }
            >
              <div
                className={
                  expiringSoon
                    ? "flex items-center gap-2 text-xs font-medium text-amber-200"
                    : "flex items-center gap-2 text-xs font-medium text-slate-300"
                }
              >
                <Clock3
                  className={expiringSoon ? "size-3.5 text-amber-300" : "size-3.5 text-emerald-400"}
                  aria-hidden="true"
                />
                <span>Tempo restante</span>
              </div>
              <p
                className={
                  expiringSoon
                    ? "mt-2 text-sm font-semibold tabular-nums text-amber-100 sm:text-base"
                    : "mt-2 text-sm font-semibold tabular-nums text-white sm:text-base"
                }
              >
                {daysLeft === 1 ? "1 dia" : `${daysLeft} dias`}
              </p>
            </div>
          </div>
        </div>
      </section>

      {products.length ? (
        <ProductCatalog products={catalogProducts satisfies StoreProduct[]} balance={balance} />
      ) : (
        <EmptyState
          icon={<ShoppingBag className="size-5" />}
          title="O catálogo está sendo preparado"
          description="Os produtos ativos aparecerão aqui assim que a equipe concluir o cadastro. Seus pontos continuam disponíveis até o fim do ciclo atual."
          action={
            <Link href="/historico" className="text-sm font-semibold text-[var(--brand-blue)] hover:underline">
              Consultar meu extrato
            </Link>
          }
        />
      )}
    </div>
  );
}
