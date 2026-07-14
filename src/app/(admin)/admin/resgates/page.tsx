import type { RedemptionStatus, Prisma } from "@prisma/client";
import { RedemptionManager, type AdminRedemption } from "@/components/admin/redemption-manager";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { redemptionLabels } from "@/lib/presentation";

export const metadata = { title: "Resgates" };

export default async function AdminRedemptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  await requirePageAdmin();
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 120) ?? "";
  const statusParam = params.status as RedemptionStatus | "ALL" | undefined;
  const resolvedStatus = statusParam && statusParam !== "ALL" && statusParam in redemptionLabels ? statusParam : undefined;

  const where: Prisma.RedemptionWhereInput = {
    ...(resolvedStatus ? { status: resolvedStatus } : {}),
    ...(query ? {
      OR: [
        { code: { contains: query, mode: "insensitive" } },
        { productNameSnapshot: { contains: query, mode: "insensitive" } },
        { courier: { is: { name: { contains: query, mode: "insensitive" } } } },
        { courier: { is: { cnpj: { contains: query.replace(/\D/g, "") } } } },
      ]
    } : {}),
  };

  const total = await db.redemption.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / 50));
  const requestedPage = Number(params.page ?? 1);
  const page = Number.isInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), pageCount) : 1;

  const redemptions = await db.redemption.findMany({
    where,
    orderBy: { requestedAt: "desc" },
    skip: (page - 1) * 50,
    take: 50,
    select: {
      id: true,
      code: true,
      productNameSnapshot: true,
      quantity: true,
      pointsSpent: true,
      status: true,
      requestedAt: true,
      period: { select: { key: true } },
      courier: { select: { name: true, cnpj: true } },
    },
  });

  const data: AdminRedemption[] = redemptions.map((item) => ({
    id: item.id,
    code: item.code,
    courierName: item.courier.name,
    courierCnpj: item.courier.cnpj,
    productName: item.productNameSnapshot,
    quantity: item.quantity,
    pointsSpent: item.pointsSpent,
    status: item.status,
    periodKey: item.period.key,
    requestedAt: item.requestedAt.toISOString(),
  }));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Operação" title="Resgates" description="Acompanhe o pedido do recebimento à entrega. Cancelamentos devolvem estoque e, quando permitido, os pontos do entregador." />
      <RedemptionManager redemptions={data} page={page} total={total} query={query} status={statusParam ?? "ALL"} />
    </div>
  );
}
