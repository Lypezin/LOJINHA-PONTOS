import Link from "next/link";
import { Banknote, History, Package, PackageCheck, ReceiptText, ShoppingBag } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCurrentAccount } from "@/features/points/period";
import { requirePageUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatCurrency, formatDate, formatDateTime, formatPoints } from "@/lib/format";
import { periodLabel, redemptionLabels, redemptionTone } from "@/lib/presentation";

export const metadata = { title: "Meus resgates" };

const entryLabels = {
  IMPORT_CREDIT: "Crédito da planilha",
  IMPORT_CORRECTION: "Correção da importação",
  ADMIN_ADJUSTMENT: "Ajuste administrativo",
  REDEMPTION: "Resgate",
  REFUND: "Estorno",
  EXPIRATION: "Expiração",
} as const;

function readDailyPoints(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      typeof item === "object" &&
      item !== null &&
      typeof (item as { date?: unknown }).date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test((item as { date: string }).date) &&
      typeof (item as { points?: unknown }).points === "number" &&
      Number.isSafeInteger((item as { points: number }).points)
    ) {
      return [
        {
          date: (item as { date: string }).date,
          points: (item as { points: number }).points,
        },
      ];
    }
    return [];
  });
}

function formatImportDate(date: string) {
  return formatDate(`${date}T12:00:00Z`);
}

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
        fulfillmentType: true,
        cashAmountCents: true,
        pixKey: true,
        status: true,
        requestedAt: true,
        period: { select: { key: true, year: true, month: true, startsAt: true, endsAt: true } },
      },
    }),
    db.pointAccount.findMany({
      where: { courierId: user.courierId },
      orderBy: { period: { startsAt: "desc" } },
      take: 12,
      select: {
        id: true,
        period: { select: { key: true, year: true, month: true, startsAt: true, endsAt: true } },
        entries: {
          orderBy: { createdAt: "desc" },
          take: 40,
          select: {
            id: true,
            type: true,
            amount: true,
            balanceAfter: true,
            description: true,
            createdAt: true,
            importBatch: {
              select: {
                filename: true,
                snapshots: {
                  where: { courierId: user.courierId },
                  take: 1,
                  select: { dailyPoints: true },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const entries = accounts.flatMap((item) => item.entries.map((entry) => ({ ...entry, period: item.period })));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Sua movimentação"
        title="Resgates e extrato"
        description="Acompanhe seus pedidos e confira todas as movimentações de pontos."
        action={
          <Link href="/loja" className={buttonStyles()}>
            Ir para a loja
          </Link>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo do ciclo atual">
        <StatCard
          label="Saldo do ciclo atual"
          value={`${formatPoints(account?.balancePoints ?? 0)} pts`}
          helper={periodLabel(period)}
          icon={ReceiptText}
        />
        <StatCard
          label="Pontos recebidos"
          value={`${formatPoints(account?.importedPoints ?? 0)} pts`}
          helper="Crédito acumulado da planilha"
          icon={PackageCheck}
        />
        <StatCard
          label="Pontos usados"
          value={`${formatPoints(account?.redeemedPoints ?? 0)} pts`}
          helper="Total debitado em resgates"
          icon={ShoppingBag}
        />
      </section>

      <section aria-labelledby="redemptions-title">
        <div>
          <p className="text-xs font-semibold text-[var(--brand-blue)]">Pedidos</p>
          <h2 id="redemptions-title" className="font-display mt-0.5 text-xl font-bold text-[var(--brand-navy)]">
            Meus resgates
          </h2>
        </div>

        {redemptions.length ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {redemptions.map((redemption) => (
              <article
                key={redemption.id}
                className="flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5"
              >
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400 sm:size-[72px]">
                  {redemption.imageUrlSnapshot ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={redemption.imageUrlSnapshot} alt="" className="size-full object-cover" />
                  ) : (
                    <ShoppingBag className="size-6" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-display line-clamp-2 text-balance text-base font-semibold text-[var(--brand-navy)]">
                        {redemption.productNameSnapshot}
                      </h3>
                      {redemption.fulfillmentType === "CASH" ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          <Banknote className="size-3" aria-hidden="true" />
                          Dinheiro (PIX)
                        </span>
                      ) : (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[var(--brand-blue)]">
                          <Package className="size-3" aria-hidden="true" />
                          Produto físico
                        </span>
                      )}
                    </div>
                    <StatusBadge tone={redemptionTone[redemption.status]}>
                      {redemptionLabels[redemption.status]}
                    </StatusBadge>
                  </div>

                  <p className="mt-2 text-xs font-medium tabular-nums text-slate-500">
                    {redemption.code} • {formatDateTime(redemption.requestedAt)}
                  </p>

                  {redemption.fulfillmentType === "CASH" && redemption.cashAmountCents ? (
                    <div className="mt-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-2.5 text-xs text-emerald-950">
                      <p className="font-medium">
                        Valor via PIX:{" "}
                        <strong className="font-bold tabular-nums">
                          {formatCurrency(redemption.cashAmountCents)}
                        </strong>
                      </p>
                      {redemption.pixKey ? (
                        <p className="mt-0.5 truncate text-emerald-800" title={redemption.pixKey}>
                          Chave: {redemption.pixKey}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span className="tabular-nums">{redemption.quantity} un.</span>
                    <span className="font-semibold tabular-nums text-[var(--brand-navy)]">
                      {formatPoints(redemption.pointsSpent)} pts
                    </span>
                    <span className="text-slate-400">•</span>
                    <span>{periodLabel(redemption.period)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              icon={<History className="size-5" />}
              title="Você ainda não fez nenhum resgate"
              description="Quando escolher um prêmio, o código e o andamento aparecerão aqui."
              action={
                <Link href="/loja" className={buttonStyles()}>
                  Explorar catálogo
                </Link>
              }
            />
          </div>
        )}
      </section>

      <section aria-labelledby="ledger-title">
        <div>
          <p className="text-xs font-semibold text-[var(--brand-blue)]">Pontos</p>
          <h2 id="ledger-title" className="font-display mt-0.5 text-xl font-bold text-[var(--brand-navy)]">
            Extrato detalhado
          </h2>
        </div>

        {entries.length ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="hidden grid-cols-[1.3fr_1fr_0.7fr_0.7fr] gap-4 border-b border-slate-200/80 bg-slate-50/80 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:grid">
              <span>Movimentação</span>
              <span>Ciclo e data</span>
              <span className="text-right">Pontos</span>
              <span className="text-right">Saldo</span>
            </div>
            <div className="divide-y divide-slate-200/70">
              {entries.map((entry) => {
                const dailyPoints = readDailyPoints(entry.importBatch?.snapshots[0]?.dailyPoints);
                return (
                  <article
                    key={entry.id}
                    className="grid gap-2.5 px-5 py-4 text-sm transition-colors hover:bg-slate-50/50 sm:grid-cols-[1.3fr_1fr_0.7fr_0.7fr] sm:items-start sm:gap-4"
                  >
                    <div>
                      <p className="font-semibold text-[var(--brand-navy)]">{entryLabels[entry.type]}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{entry.description}</p>

                      {dailyPoints.length ? (
                        <details className="mt-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2">
                          <summary className="cursor-pointer text-xs font-semibold text-[var(--brand-blue)]">
                            Detalhamento diário ({dailyPoints.length}{" "}
                            {dailyPoints.length === 1 ? "dia" : "dias"})
                          </summary>
                          <div className="mt-2 divide-y divide-slate-200/70">
                            {dailyPoints.map((daily) => (
                              <div key={daily.date} className="flex items-center justify-between gap-4 py-1.5 text-xs">
                                <span className="text-slate-600">{formatImportDate(daily.date)}</span>
                                <span className="font-semibold tabular-nums text-emerald-700">
                                  +{formatPoints(daily.points)} pts
                                </span>
                              </div>
                            ))}
                          </div>
                          {entry.importBatch?.filename ? (
                            <p
                              className="mt-2 truncate border-t border-slate-200/70 pt-2 text-[11px] text-slate-400"
                              title={entry.importBatch.filename}
                            >
                              Arquivo: {entry.importBatch.filename}
                            </p>
                          ) : null}
                        </details>
                      ) : null}
                    </div>

                    <div className="text-xs text-slate-600">
                      <p className="font-medium">{periodLabel(entry.period)}</p>
                      <p className="mt-0.5 tabular-nums text-slate-400">{formatDateTime(entry.createdAt)}</p>
                    </div>

                    <p
                      className={
                        entry.amount >= 0
                          ? "font-semibold tabular-nums text-emerald-700 sm:text-right"
                          : "font-semibold tabular-nums text-red-600 sm:text-right"
                      }
                    >
                      {entry.amount >= 0 ? "+" : ""}
                      {formatPoints(entry.amount)} pts
                    </p>
                    <p className="font-semibold tabular-nums text-[var(--brand-navy)] sm:text-right">
                      {formatPoints(entry.balanceAfter)} pts
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-6 text-sm text-slate-500">
            O extrato será criado quando seus pontos forem creditados pela primeira planilha.
          </div>
        )}
      </section>
    </div>
  );
}
