import Link from "next/link";
import { CalendarClock, ChevronRight, Clock3, WalletCards } from "lucide-react";
import { ProductCatalog, type StoreProduct } from "@/components/store/product-catalog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentAccount } from "@/features/points/period";
import { requirePageUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate, formatPoints } from "@/lib/format";
import { monthLabel } from "@/lib/presentation";

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
        pointsCost: true,
        referenceValueCents: true,
        stockQuantity: true,
        maxPerCourierPerPeriod: true,
        featured: true,
      },
    }),
  ]);
  const balance = account?.balancePoints ?? 0;
  const daysLeft = daysUntil(period.endsAt);
  const expiringSoon = daysLeft <= 7;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={`Olá, ${user.courier.name.split(" ")[0]}`}
        title="Seus pedidos viram conquistas"
        description="Use seus pontos da competência atual. O saldo que não for usado expira automaticamente na virada do mês."
      />

      <section className="relative overflow-hidden rounded-[28px] border border-blue-900 bg-[var(--brand-blue-dark)] p-6 text-white shadow-lg sm:p-8" aria-labelledby="balance-title">
        <span className="absolute -right-10 -top-16 size-52 rounded-full border-[28px] border-white/[0.06]" aria-hidden="true" />
        <span className="absolute -bottom-20 right-32 size-40 rounded-full border-[24px] border-[var(--brand-mint)]/[0.08]" aria-hidden="true" />
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-blue-100">
              <WalletCards className="size-5 text-[var(--brand-mint)]" aria-hidden="true" />
              <span id="balance-title">Saldo de {monthLabel(period.year, period.month)}</span>
            </div>
            <p className="mt-4 text-5xl font-extrabold tabular-nums sm:text-6xl">
              {formatPoints(balance)} <span className="text-xl text-blue-100 sm:text-2xl">pontos</span>
            </p>
            <Link href="/historico" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[var(--brand-blue-dark)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">
              Ver extrato
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[28rem]">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <CalendarClock className="size-5 text-[var(--brand-mint)]" aria-hidden="true" />
              <p className="mt-3 text-xs font-semibold text-blue-100">Válido até</p>
              <p className="mt-1 font-extrabold tabular-nums">{formatDate(period.endsAt)}</p>
            </div>
            <div className={expiringSoon ? "rounded-2xl border border-amber-200 bg-amber-100 p-4 text-amber-950" : "rounded-2xl border border-white/10 bg-white/10 p-4"}>
              <Clock3 className={expiringSoon ? "size-5 text-amber-800" : "size-5 text-[var(--brand-mint)]"} aria-hidden="true" />
              <p className={expiringSoon ? "mt-3 text-xs font-semibold text-amber-900" : "mt-3 text-xs font-semibold text-blue-100"}>Tempo restante</p>
              <p className="mt-1 font-extrabold tabular-nums">{daysLeft === 1 ? "1 dia" : `${daysLeft} dias`}</p>
            </div>
          </div>
        </div>
      </section>

      {products.length ? (
        <ProductCatalog products={products satisfies StoreProduct[]} balance={balance} />
      ) : (
        <EmptyState
          icon={<ShoppingBagIcon />}
          title="O catálogo está sendo preparado"
          description="Os produtos ativos aparecerão aqui assim que a equipe concluir o cadastro. Seus pontos continuam guardados até o fim da competência."
          action={<Link href="/historico" className="text-sm font-bold text-[var(--brand-blue-dark)]">Consultar meu extrato</Link>}
        />
      )}
    </div>
  );
}

function ShoppingBagIcon() {
  return <WalletCards className="size-6" />;
}
