import { CourierManager, type AdminCourier } from "@/components/admin/courier-manager";
import { PageHeader } from "@/components/ui/page-header";
import { ensureCurrentPeriod } from "@/features/points/period";
import { requirePageAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata = { title: "Entregadores" };

export default async function AdminCouriersPage() {
  await requirePageAdmin();
  const period = await ensureCurrentPeriod();
  const couriers = await db.courier.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      cnpj: true,
      status: true,
      cnpjMatchStatus: true,
      plaza: true,
      subPlaza: true,
      lastImportedAt: true,
      user: { select: { email: true } },
      pointAccounts: { where: { periodId: period.id }, take: 1, select: { balancePoints: true, importedPoints: true, redeemedPoints: true } },
    },
  });
  const data: AdminCourier[] = couriers.map((courier) => ({
    id: courier.id,
    name: courier.name,
    cnpj: courier.cnpj,
    status: courier.status,
    cnpjMatchStatus: courier.cnpjMatchStatus,
    plaza: courier.plaza,
    subPlaza: courier.subPlaza,
    email: courier.user?.email ?? null,
    lastImportedAt: courier.lastImportedAt?.toISOString() ?? null,
    balance: courier.pointAccounts[0]?.balancePoints ?? 0,
    importedPoints: courier.pointAccounts[0]?.importedPoints ?? 0,
    redeemedPoints: courier.pointAccounts[0]?.redeemedPoints ?? 0,
  }));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`Competência ${period.key}`} title="Entregadores" description="Consulte o saldo atual, corrija dados cadastrais e registre ajustes de pontos com motivo e saldo antes/depois." />
      <CourierManager couriers={data} />
    </div>
  );
}
