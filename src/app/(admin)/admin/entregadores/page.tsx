import type { CourierStatus, Prisma } from "@prisma/client";

import { CourierManager, type AdminCourier } from "@/components/admin/courier-manager";
import { PageHeader } from "@/components/ui/page-header";
import { ensureCurrentPeriod } from "@/features/points/period";
import { requirePageAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata = { title: "Entregadores" };

const PAGE_SIZE = 20;
const statuses = new Set<CourierStatus>(["ACTIVE", "PENDING", "INACTIVE"]);

export default async function AdminCouriersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  await requirePageAdmin();
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 120) ?? "";
  const status = statuses.has(params.status as CourierStatus) ? params.status as CourierStatus : "ALL";
  const requestedPage = Number(params.page ?? 1);
  const digits = query.replace(/\D/g, "");
  const where: Prisma.CourierWhereInput = {
    ...(status === "ALL" ? {} : { status }),
    ...(query ? { OR: [
      { name: { contains: query, mode: "insensitive" } },
      ...(digits ? [{ cnpj: { contains: digits } } as const] : []),
      { user: { is: { email: { contains: query, mode: "insensitive" } } } },
    ] } : {}),
  };

  const period = await ensureCurrentPeriod();
  const total = await db.courier.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Number.isInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), pageCount) : 1;
  const couriers = await db.courier.findMany({
    where,
    orderBy: { name: "asc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      cnpj: true,
      status: true,
      cnpjMatchStatus: true,
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
    email: courier.user?.email ?? null,
    lastImportedAt: courier.lastImportedAt?.toISOString() ?? null,
    balance: courier.pointAccounts[0]?.balancePoints ?? 0,
    importedPoints: courier.pointAccounts[0]?.importedPoints ?? 0,
    redeemedPoints: courier.pointAccounts[0]?.redeemedPoints ?? 0,
  }));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`Competência ${period.key}`} title="Entregadores" description="Consulte o saldo atual, corrija dados cadastrais e registre ajustes de pontos com motivo e saldo antes/depois." />
      <CourierManager couriers={data} total={total} page={page} query={query} status={status} />
    </div>
  );
}
