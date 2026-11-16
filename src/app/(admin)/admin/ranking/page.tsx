import { RankingDashboard, type RankingEntry } from "@/components/admin/ranking-dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { ensureCurrentPeriod } from "@/features/points/period";
import { requirePageAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { periodLabel } from "@/lib/presentation";

export const metadata = { title: "Ranking de Entregadores" };

export default async function AdminRankingPage() {
  await requirePageAdmin();
  const period = await ensureCurrentPeriod();

  // Consolida saldos elegíveis do ciclo para não duplicar entregadores no ranking.
  const accounts = await db.pointAccount.findMany({
    where: { period: { status: "OPEN", startsAt: { lte: new Date() }, endsAt: { gt: new Date() } } },
    select: {
      courierId: true,
      importedPoints: true,
      redeemedPoints: true,
      balancePoints: true,
      courier: {
        select: {
          name: true,
          cnpj: true,
          plaza: true,
        },
      },
    },
  });

  let totalDistributed = 0;
  let totalRedeemed = 0;
  let totalBalance = 0;
  const totalsByCourier = new Map<string, {
    importedPoints: number;
    redeemedPoints: number;
    balancePoints: number;
    courier: (typeof accounts)[number]["courier"];
  }>();

  for (const account of accounts) {
    const current = totalsByCourier.get(account.courierId) ?? {
      importedPoints: 0,
      redeemedPoints: 0,
      balancePoints: 0,
      courier: account.courier,
    };
    current.importedPoints += account.importedPoints;
    current.redeemedPoints += account.redeemedPoints;
    current.balancePoints += account.balancePoints;
    totalsByCourier.set(account.courierId, current);
  }
  const courierTotals = [...totalsByCourier.entries()].map(([courierId, values]) => ({ courierId, ...values }));
  let activeAccounts = 0;

  const topEarners: RankingEntry[] = [];
  const topSpenders: RankingEntry[] = [];
  const topBalances: RankingEntry[] = [];

  for (const account of courierTotals) {
    totalDistributed += account.importedPoints;
    totalRedeemed += account.redeemedPoints;
    totalBalance += account.balancePoints;
    if (account.importedPoints > 0 || account.redeemedPoints > 0) {
      activeAccounts += 1;
    }

    const entry = {
      courierId: account.courierId,
      courierName: account.courier.name,
      cnpj: account.courier.cnpj,
      plaza: account.courier.plaza,
    };

    if (account.importedPoints > 0) {
      topEarners.push({ ...entry, value: account.importedPoints });
    }
    if (account.redeemedPoints > 0) {
      topSpenders.push({ ...entry, value: account.redeemedPoints });
    }
    if (account.balancePoints > 0) {
      topBalances.push({ ...entry, value: account.balancePoints });
    }
  }

  const averageBalance = courierTotals.length > 0 ? totalBalance / courierTotals.length : 0;

  // Sort entries
  topEarners.sort((a, b) => b.value - a.value);
  topSpenders.sort((a, b) => b.value - a.value);
  topBalances.sort((a, b) => b.value - a.value);

  const stats = {
    totalDistributed,
    totalRedeemed,
    averageBalance,
    activeAccounts,
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        eyebrow={periodLabel(period)}
        title="Ranking de Entregadores"
        description="Acompanhe os destaques do ciclo atual: quem acumulou mais pontos, realizou mais resgates e mantém os maiores saldos."
      />
      <RankingDashboard
        topEarners={topEarners}
        topSpenders={topSpenders}
        topBalances={topBalances}
        stats={stats}
      />
    </div>
  );
}
