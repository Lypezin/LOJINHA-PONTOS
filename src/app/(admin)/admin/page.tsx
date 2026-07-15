import Link from "next/link";
import { Prisma } from "@prisma/client";
import { ArrowRight, Boxes, FileSpreadsheet, PackageCheck, ShoppingBag, UserRoundSearch, UsersRound, WalletCards } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ensureCurrentPeriod } from "@/features/points/period";
import { requirePageAdmin } from "@/lib/auth/session";
import { db, retryDatabaseRead } from "@/lib/db";
import { formatDateTime, formatPoints } from "@/lib/format";
import { monthLabel, redemptionLabels, redemptionTone } from "@/lib/presentation";

export const metadata = { title: "Administração" };

type DashboardMetrics = {
  courierCount: number;
  productCount: number;
  pendingRedemptions: number;
  unresolvedMatches: number;
  balancePoints: number;
  importedPoints: number;
  redeemedPoints: number;
};

export default async function AdminDashboardPage() {
  await requirePageAdmin();
  const period = await ensureCurrentPeriod();
  const [metricsRows, recentRedemptions, latestImport, lowStock] = await Promise.all([
    retryDatabaseRead(() => db.$queryRaw<DashboardMetrics[]>(Prisma.sql`
      SELECT
        (SELECT COUNT(*)::int FROM "Courier" WHERE "status" = 'ACTIVE'::"CourierStatus") AS "courierCount",
        (SELECT COUNT(*)::int FROM "Product" WHERE "status" = 'ACTIVE'::"ProductStatus") AS "productCount",
        (SELECT COUNT(*)::int FROM "Redemption" WHERE "status" IN ('REQUESTED', 'APPROVED', 'PREPARING', 'READY')) AS "pendingRedemptions",
        (SELECT COUNT(*)::int FROM "Courier" WHERE "cnpj" IS NULL AND "status" <> 'INACTIVE'::"CourierStatus") AS "unresolvedMatches",
        COALESCE(SUM("balancePoints"), 0)::int AS "balancePoints",
        COALESCE(SUM("importedPoints"), 0)::int AS "importedPoints",
        COALESCE(SUM("redeemedPoints"), 0)::int AS "redeemedPoints"
      FROM "PointAccount"
      WHERE "periodId" = ${period.id}
    `)),
    db.redemption.findMany({
      orderBy: { requestedAt: "desc" },
      take: 6,
      select: {
        id: true,
        code: true,
        productNameSnapshot: true,
        pointsSpent: true,
        status: true,
        requestedAt: true,
        courier: { select: { name: true } },
      },
    }),
    db.importBatch.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true, filename: true, status: true, courierCount: true, totalPoints: true, createdAt: true } }),
    db.product.findMany({ where: { status: "ACTIVE", stockQuantity: { lte: 5 } }, orderBy: { stockQuantity: "asc" }, take: 5, select: { id: true, name: true, stockQuantity: true } }),
  ]);
  const metrics = metricsRows[0] ?? { courierCount: 0, productCount: 0, pendingRedemptions: 0, unresolvedMatches: 0, balancePoints: 0, importedPoints: 0, redeemedPoints: 0 };
  const { courierCount, productCount, pendingRedemptions, unresolvedMatches } = metrics;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={monthLabel(period.year, period.month)}
        title="Visão geral da lojinha"
        description="Acompanhe pontos, pedidos, estoque e dados que precisam de atenção antes de abrir cada competência."
        action={<Link href="/admin/importacoes" className={buttonStyles()}><FileSpreadsheet className="size-4" aria-hidden="true" />Importar planilha</Link>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores principais">
        <StatCard label="Saldo em circulação" value={`${formatPoints(metrics.balancePoints)} pts`} helper={`${formatPoints(metrics.importedPoints)} pontos importados no mês`} icon={WalletCards} />
        <StatCard label="Resgates em andamento" value={formatPoints(pendingRedemptions)} helper={`${formatPoints(metrics.redeemedPoints)} pontos já utilizados`} icon={PackageCheck} />
        <StatCard label="Entregadores ativos" value={formatPoints(courierCount)} helper="Cadastros liberados para a operação" icon={UsersRound} />
        <StatCard label="Produtos ativos" value={formatPoints(productCount)} helper={`${lowStock.length} item(ns) com estoque baixo`} icon={Boxes} />
      </section>

      <section className="grid gap-5 lg:grid-cols-3" aria-label="Atalhos operacionais">
        <Link href="/admin/resgates" className="group rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">
          <div className="flex items-start justify-between gap-4">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-[var(--brand-blue)]"><ShoppingBag className="size-5" aria-hidden="true" /></span>
            <ArrowRight className="size-5 text-slate-400 group-hover:text-[var(--brand-blue)]" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-balance text-lg font-extrabold text-[var(--brand-navy)]">Fila de resgates</h2>
          <p className="mt-1 text-pretty text-sm leading-6 text-slate-600">{pendingRedemptions ? `${pendingRedemptions} pedido(s) aguardam andamento.` : "Nenhum pedido pendente agora."}</p>
        </Link>
        <Link href="/admin/conciliacao" className="group rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">
          <div className="flex items-start justify-between gap-4">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-[var(--brand-blue)]"><UserRoundSearch className="size-5" aria-hidden="true" /></span>
            <ArrowRight className="size-5 text-slate-400 group-hover:text-[var(--brand-blue)]" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-balance text-lg font-extrabold text-[var(--brand-navy)]">Conciliação de CNPJ</h2>
          <p className="mt-1 text-pretty text-sm leading-6 text-slate-600">{unresolvedMatches ? `${unresolvedMatches} nome(s) precisam de revisão manual.` : "Todos os nomes estão conciliados."}</p>
        </Link>
        <Link href="/admin/produtos" className="group rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">
          <div className="flex items-start justify-between gap-4">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-[var(--brand-blue)]"><Boxes className="size-5" aria-hidden="true" /></span>
            <ArrowRight className="size-5 text-slate-400 group-hover:text-[var(--brand-blue)]" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-balance text-lg font-extrabold text-[var(--brand-navy)]">Estoque dos produtos</h2>
          <p className="mt-1 text-pretty text-sm leading-6 text-slate-600">{lowStock.length ? `${lowStock.length} item(ns) estão com 5 unidades ou menos.` : "Todos os itens ativos têm estoque regular."}</p>
        </Link>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section aria-labelledby="recent-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="recent-title" className="text-balance text-xl font-extrabold text-[var(--brand-navy)]">Resgates recentes</h2>
            <Link href="/admin/resgates" className="text-sm font-bold text-[var(--brand-blue-dark)]">Ver todos</Link>
          </div>
          {recentRedemptions.length ? (
            <div className="mt-4 overflow-hidden rounded-[20px] border border-slate-200 bg-white">
              <div className="divide-y divide-slate-200">
                {recentRedemptions.map((item) => (
                  <article key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/60 transition-colors duration-150">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[var(--brand-navy)]">{item.courier.name} • {item.productNameSnapshot}</p>
                      <p className="mt-1 text-xs tabular-nums text-slate-600 font-medium">{item.code} • {formatDateTime(item.requestedAt)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-extrabold tabular-nums text-[var(--brand-navy)]">{formatPoints(item.pointsSpent)} pts</span>
                      <StatusBadge tone={redemptionTone[item.status]}>{redemptionLabels[item.status]}</StatusBadge>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState icon={<ShoppingBag className="size-6" />} title="Nenhum resgate registrado" description="Os pedidos feitos pelos entregadores aparecerão aqui." action={<Link href="/admin/produtos" className={buttonStyles({ variant: "secondary" })}>Revisar catálogo</Link>} />
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-[20px] border border-slate-200 bg-white p-5" aria-labelledby="import-title">
            <h2 id="import-title" className="text-balance text-lg font-extrabold text-[var(--brand-navy)]">Importação mais recente</h2>
            {latestImport ? (
              <div className="mt-4">
                <p className="truncate text-sm font-bold text-[var(--brand-navy)]">{latestImport.filename}</p>
                <p className="mt-1 text-xs tabular-nums text-slate-600 font-medium">{formatDateTime(latestImport.createdAt)}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4">
                  <div><dt className="text-xs text-slate-600 font-medium">Entregadores</dt><dd className="mt-1 font-extrabold tabular-nums">{formatPoints(latestImport.courierCount)}</dd></div>
                  <div><dt className="text-xs text-slate-600 font-medium">Pontos</dt><dd className="mt-1 font-extrabold tabular-nums">{formatPoints(latestImport.totalPoints)}</dd></div>
                </dl>
              </div>
            ) : <p className="mt-3 text-pretty text-sm leading-6 text-slate-600">Nenhuma planilha foi importada ainda.</p>}
            <Link href="/admin/importacoes" className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-[var(--brand-blue-dark)]">Abrir importações <ArrowRight className="ml-2 size-4" aria-hidden="true" /></Link>
          </section>

          <section className="rounded-[20px] border border-slate-200 bg-white p-5" aria-labelledby="stock-title">
            <h2 id="stock-title" className="text-balance text-lg font-extrabold text-[var(--brand-navy)]">Estoque baixo</h2>
            {lowStock.length ? (
              <ul className="mt-3 divide-y divide-slate-200">
                {lowStock.map((item) => <li key={item.id} className="flex items-center justify-between gap-4 py-3 text-sm"><span className="truncate font-bold text-[var(--brand-navy)]">{item.name}</span><span className="shrink-0 font-extrabold tabular-nums text-amber-800">{item.stockQuantity} un.</span></li>)}
              </ul>
            ) : <p className="mt-3 text-sm text-slate-600">Nenhum item ativo precisa de reposição.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
