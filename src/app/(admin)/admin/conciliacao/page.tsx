import { ReconciliationManager, type ReconciliationCourier, type ReconciliationEntry } from "@/components/admin/reconciliation-manager";
import { PageHeader } from "@/components/ui/page-header";
import type { Prisma } from "@prisma/client";
import { requirePageAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata = { title: "Conciliação" };

export default async function AdminReconciliationPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePageAdmin();
  const unresolvedWhere: Prisma.CnpjRegistryEntryWhereInput = { matchStatus: { in: ["PENDING", "AMBIGUOUS", "NOT_FOUND"] } };
  const total = await db.cnpjRegistryEntry.count({ where: unresolvedWhere });
  const requestedPage = Number((await searchParams).page ?? 1);
  const pageCount = Math.max(1, Math.ceil(total / 30));
  const page = Number.isInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), pageCount) : 1;
  const [entries, couriers] = await Promise.all([
    db.cnpjRegistryEntry.findMany({ where: unresolvedWhere, orderBy: [{ matchStatus: "asc" }, { sourceName: "asc" }], skip: (page - 1) * 30, take: 30, select: { id: true, sourceName: true, cnpj: true, sourceRow: true, matchStatus: true, matchScore: true, notes: true } }),
    db.courier.findMany({ where: { status: { not: "INACTIVE" } }, orderBy: { name: "asc" }, select: { id: true, name: true, cnpj: true, plaza: true } }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Nomes e CNPJ" title="Conciliação manual" description="Resolva os nomes que não puderam ser ligados automaticamente entre BANCO DE DADOS e DADOS CNPJ. Compare os dados antes de confirmar." />
      <ReconciliationManager entries={entries satisfies ReconciliationEntry[]} couriers={couriers satisfies ReconciliationCourier[]} page={page} total={total} />
    </div>
  );
}
