import { db } from "../src/lib/db";

async function main() {
  const batch = await db.importBatch.findFirstOrThrow({
    where: { status: { in: ["COMPLETED", "COMPLETED_WITH_WARNINGS"] } },
    orderBy: { createdAt: "desc" },
    include: { period: true },
  });
  const snapshots = await db.importCourierSnapshot.findMany({
    where: { batchId: batch.id },
    select: { courierId: true, points: true, deltaPoints: true },
  });
  const courierIds = snapshots.map((snapshot) => snapshot.courierId);
  const [accounts, ledger, negativeBalances, cnpjPending, matchStatuses] = await Promise.all([
    db.pointAccount.findMany({
      where: { periodId: batch.periodId, courierId: { in: courierIds } },
      select: { importedPoints: true, balancePoints: true, redeemedPoints: true },
    }),
    db.pointLedgerEntry.aggregate({
      where: { importBatchId: batch.id },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.pointAccount.count({ where: { balancePoints: { lt: 0 } } }),
    db.courier.count({ where: { id: { in: courierIds }, cnpj: null } }),
    db.courier.groupBy({
      by: ["cnpjMatchStatus"],
      where: { id: { in: courierIds } },
      _count: { _all: true },
    }),
  ]);
  const snapshotPoints = snapshots.reduce((sum, item) => sum + item.points, 0);
  const importedPoints = accounts.reduce((sum, item) => sum + item.importedPoints, 0);
  if (snapshots.length !== batch.courierCount) {
    throw new Error(`Quantidade de snapshots diverge do lote: ${snapshots.length}/${batch.courierCount}.`);
  }
  if (snapshotPoints !== batch.totalPoints || importedPoints !== batch.totalPoints) {
    throw new Error("Total de pontos diverge entre lote, snapshots e contas.");
  }
  if (negativeBalances !== 0) throw new Error("Há saldo negativo no banco.");
  console.log({
    batchId: batch.id,
    period: batch.period.key,
    rows: batch.rowCount,
    couriers: snapshots.length,
    points: snapshotPoints,
    ledgerDelta: ledger._sum.amount ?? 0,
    ledgerEntries: ledger._count.id,
    couriersWithoutCnpj: cnpjPending,
    cnpjMatchStatuses: Object.fromEntries(matchStatuses.map((item) => [item.cnpjMatchStatus, item._count._all])),
    negativeBalances,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
