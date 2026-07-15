import Link from "next/link";
import { History, PackageCheck, ReceiptText, ShoppingBag } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCurrentAccount } from "@/features/points/period";
import { requirePageUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDateTime, formatPoints } from "@/lib/format";
import { monthLabel, redemptionLabels, redemptionTone } from "@/lib/presentation";

export const metadata = { title: "Meus resgates" };

const entryLabels = {
  IMPORT_CREDIT: "Crédito da planilha",
  IMPORT_CORRECTION: "Correção da importação",
  ADMIN_ADJUSTMENT: "Ajuste administrativo",
  REDEMPTION: "Resgate",
  REFUND: "Estorno",
  EXPIRATION: "Expiração",
} as const;

export default async function HistoryPage() {
  const user = await requirePageUser();
  if (!user.courierId) return null;
  const [{ period, account }, redemptions, accounts] = await Promise.all([
    getCurrentAccount(user.courierId),
    db.redemption.findMany({
      where: { courierId: user.courierId },
      orderBy: { requestedAt: "desc" },
      take: 50,
      select: {
        id: true,
        code: true,
        productNameSnapshot: true,
        imageUrlSnapshot: true,
        quantity: true,
        pointsSpent: true,
        status: true,
        requestedAt: true,
        period: { select: { year: true, month: true } },
      },
    }),
    db.pointAccount.findMany({
      where: { courierId: user.courierId },
      orderBy: { period: { startsAt: "desc" } },
      take: 12,
      select: {
        id: true,
        period: { select: { year: true, month: true } },
        entries: {
          orderBy: { createdAt: "desc" },
          take: 40,
          select: { id: true, type: true, amount: true, balanceAfter: true, description: true, createdAt: true },
        },
      },
    }),
  ]);
  const entries = accounts.flatMap((item) => item.entries.map((entry) => ({ ...entry, period: item.period })));

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Sua movimentação"
        title="Resgates e extrato"
        description="Acompanhe cada pedido e confira como seus pontos foram creditados, usados, ajustados ou expirados."
        action={<Link href="/loja" className={buttonStyles()}>Ir para a loja</Link>}
      />

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo da competência atual">
        <StatCard label={`Saldo de ${monthLabel(period.year, period.month)}`} value={`${formatPoints(account?.balancePoints ?? 0)} pts`} helper="Disponível para resgate" icon={ReceiptText} />
        <StatCard label="Pontos recebidos" value={`${formatPoints(account?.importedPoints ?? 0)} pts`} helper="Crédito-base da planilha" icon={PackageCheck} />
        <StatCard label="Pontos usados" value={`${formatPoints(account?.redeemedPoints ?? 0)} pts`} helper="Total debitado em resgates" icon={ShoppingBag} />
      </section>

      <section aria-labelledby="redemptions-title">
        <div>
          <p className="text-sm font-bold text-[var(--brand-blue)]">Pedidos</p>
          <h2 id="redemptions-title" className="mt-1 text-balance text-2xl font-extrabold text-[var(--brand-navy)]">Meus resgates</h2>
        </div>
        {redemptions.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {redemptions.map((redemption) => (
              <article key={redemption.id} className="flex gap-4 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-50 text-[var(--brand-blue)] sm:size-20">
                  {redemption.imageUrlSnapshot ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={redemption.imageUrlSnapshot} alt="" className="size-full object-cover" />
                  ) : <ShoppingBag className="size-7" aria-hidden="true" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-balance font-extrabold text-[var(--brand-navy)]">{redemption.productNameSnapshot}</h3>
                    <StatusBadge tone={redemptionTone[redemption.status]}>{redemptionLabels[redemption.status]}</StatusBadge>
                  </div>
                  <p className="mt-2 text-xs font-semibold tabular-nums text-slate-650">{redemption.code} • {formatDateTime(redemption.requestedAt)}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
                    <span className="tabular-nums">{redemption.quantity} unidade(s)</span>
                    <span className="font-extrabold tabular-nums text-[var(--brand-navy)]">{formatPoints(redemption.pointsSpent)} pts</span>
                    <span>{monthLabel(redemption.period.year, redemption.period.month)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5">
            <EmptyState
              icon={<History className="size-6" />}
              title="Você ainda não fez nenhum resgate"
              description="Quando escolher um item, o código e o andamento do pedido aparecerão aqui."
              action={<Link href="/loja" className={buttonStyles()}>Conhecer os itens</Link>}
            />
          </div>
        )}
      </section>

      <section aria-labelledby="ledger-title">
        <div>
          <p className="text-sm font-bold text-[var(--brand-blue)]">Pontos</p>
          <h2 id="ledger-title" className="mt-1 text-balance text-2xl font-extrabold text-[var(--brand-navy)]">Extrato detalhado</h2>
        </div>
        {entries.length ? (
          <div className="mt-5 overflow-hidden rounded-[20px] border border-slate-200 bg-white">
            <div className="hidden grid-cols-[1.3fr_1fr_0.7fr_0.7fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold text-slate-600 sm:grid">
              <span>Movimentação</span><span>Competência e data</span><span className="text-right">Valor</span><span className="text-right">Saldo</span>
            </div>
            <div className="divide-y divide-slate-200">
              {entries.map((entry) => (
                <article key={entry.id} className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-[1.3fr_1fr_0.7fr_0.7fr] sm:items-center sm:gap-4">
                  <div>
                    <p className="font-bold text-[var(--brand-navy)]">{entryLabels[entry.type]}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600 font-medium">{entry.description}</p>
                  </div>
                  <div className="text-xs text-slate-700">
                    <p>{monthLabel(entry.period.year, entry.period.month)}</p>
                    <p className="mt-1 tabular-nums">{formatDateTime(entry.createdAt)}</p>
                  </div>
                  <p className={entry.amount >= 0 ? "font-extrabold tabular-nums text-emerald-700 sm:text-right" : "font-extrabold tabular-nums text-red-700 sm:text-right"}>
                    {entry.amount >= 0 ? "+" : ""}{formatPoints(entry.amount)} pts
                  </p>
                  <p className="font-bold tabular-nums text-[var(--brand-navy)] sm:text-right">{formatPoints(entry.balanceAfter)} pts</p>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-5 rounded-[20px] border border-slate-200 bg-white p-6 text-sm text-slate-600">O extrato será criado quando os pontos da primeira planilha forem importados.</p>
        )}
      </section>
    </div>
  );
}
