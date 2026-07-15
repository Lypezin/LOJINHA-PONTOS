import { RankingDashboard, type RankingEntry } from "@/components/admin/ranking-dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { ensureCurrentPeriod } from "@/features/points/period";
import { requirePageAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { monthLabel } from "@/lib/presentation";

export const metadata = { title: "Ranking de Entregadores" };

export default async function AdminRankingPage() {
  await requirePageAdmin();
  const period = await ensureCurrentPeriod();

  // Load all point accounts for the current period
  const accounts = await db.pointAccount.findMany({
    where: { periodId: period.id },
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
  let activeAccounts = 0;

  const topEarners: RankingEntry[] = [];
  const topSpenders: RankingEntry[] = [];
  const topBalances: RankingEntry[] = [];

  for (const account of accounts) {
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

  const averageBalance = accounts.length > 0 ? totalBalance / accounts.length : 0;

  // Sort and take top 10
  topEarners.sort((a, b) => b.value - a.value).splice(10);
  topSpenders.sort((a, b) => b.value - a.value).splice(10);
  topBalances.sort((a, b) => b.value - a.value).splice(10);

  const stats = {
    totalDistributed,
    totalRedeemed,
    averageBalance,
    activeAccounts,
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        eyebrow={monthLabel(period.year, period.month)}
        title="Ranking de Entregadores"
        description="Acompanhe os destaques da competência. Veja quem acumulou mais pontos, quem realizou mais resgates e quem detém os maiores saldos."
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
