import {
  ImportStatus,
  PointEntryType,
  Prisma,
} from "@prisma/client";

import { MAX_DATABASE_INT } from "@/features/imports/normalization";
import { db } from "@/lib/db";

const batchId = process.argv.find((argument) => !argument.startsWith("--") && argument !== process.argv[0] && argument !== process.argv[1]);
const apply = process.argv.includes("--apply");

function isErroneousOmissionWarning(value: Prisma.JsonValue | null): boolean {
  if (!Array.isArray(value)) return false;
  return value.some(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      "code" in entry &&
      entry.code === "COURIER_OMITTED_FROM_REIMPORT",
  );
}

function cleanedBatchWarnings(value: Prisma.JsonValue | null): Prisma.InputJsonValue {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry) =>
      !(
        typeof entry === "object" &&
        entry !== null &&
        "code" in entry &&
        entry.code === "COURIER_OMITTED_FROM_REIMPORT"
      ),
  ) as Prisma.InputJsonValue;
}

async function inspect() {
  if (!batchId) throw new Error("Informe o ID do lote.");
  const batch = await db.importBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      periodId: true,
      period: { select: { key: true } },
      pointsColumn: true,
      createdAt: true,
      createdById: true,
      courierCount: true,
      totalPoints: true,
      warningCount: true,
      warnings: true,
      _count: { select: { snapshots: true } },
      snapshots: {
        where: { sourceRowCount: 0 },
        select: {
          id: true,
          courierId: true,
          points: true,
          previousPoints: true,
          deltaPoints: true,
          warnings: true,
        },
      },
    },
  });
  if (!batch) throw new Error("Lote não encontrado.");
  const candidates = batch.snapshots.filter(
    (snapshot) =>
      snapshot.points === 0 &&
      snapshot.previousPoints > 0 &&
      snapshot.deltaPoints === -snapshot.previousPoints &&
      isErroneousOmissionWarning(snapshot.warnings),
  );
  const previousBatchCount = await db.importBatch.count({
    where: {
      periodId: batch.periodId,
      pointsColumn: batch.pointsColumn,
      createdAt: { lt: batch.createdAt },
      status: {
        in: [ImportStatus.COMPLETED, ImportStatus.COMPLETED_WITH_WARNINGS],
      },
    },
  });
  const accounts = candidates.length
    ? await db.pointAccount.findMany({
        where: {
          periodId: batch.periodId,
          courierId: { in: candidates.map((snapshot) => snapshot.courierId) },
        },
        select: {
          courierId: true,
          importedPoints: true,
          balancePoints: true,
        },
      })
    : [];
  return { batch, candidates, previousBatchCount, accounts };
}

async function repair() {
  const before = await inspect();
  console.log(
    JSON.stringify({
      phase: "before",
      batchId: before.batch.id,
      courierCount: before.batch.courierCount,
      snapshotCount: before.batch._count.snapshots,
      totalPoints: before.batch.totalPoints,
      warningCount: before.batch.warningCount,
      repairCandidates: before.candidates.length,
      candidatePreviousPoints: before.candidates.reduce(
        (total, snapshot) => total + snapshot.previousPoints,
        0,
      ),
      candidateAccounts: before.accounts.map((account) => ({
        importedPoints: account.importedPoints,
        balancePoints: account.balancePoints,
      })),
      previousBatchCount: before.previousBatchCount,
      dryRun: !apply,
    }),
  );

  if (!apply) return;
  if (before.previousBatchCount !== 0) {
    throw new Error(
      "Reparo recusado: este não é o primeiro lote da competência e coluna.",
    );
  }
  if (!before.candidates.length) throw new Error("Nenhum snapshot errôneo encontrado.");

  await db.$transaction(
    async (tx) => {
      await tx.$queryRaw<Array<{ lock: string }>>(Prisma.sql`
        SELECT pg_advisory_xact_lock(
          hashtext(${`lojinha-import:${before.batch.period.key}`})
        )::text AS "lock"
      `);
      await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "ImportBatch" WHERE "id" = ${before.batch.id} FOR UPDATE
      `);
      const candidateIds = before.candidates.map((snapshot) => snapshot.courierId);
      await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id"
        FROM "PointAccount"
        WHERE "periodId" = ${before.batch.periodId}
          AND "courierId" IN (${Prisma.join(candidateIds)})
        ORDER BY "id"
        FOR UPDATE
      `);

      const laterSnapshots = await tx.importCourierSnapshot.count({
        where: {
          courierId: { in: candidateIds },
          batch: {
            periodId: before.batch.periodId,
            createdAt: { gt: before.batch.createdAt },
            status: {
              in: [ImportStatus.COMPLETED, ImportStatus.COMPLETED_WITH_WARNINGS],
            },
          },
        },
      });
      if (laterSnapshots) {
        throw new Error("Reparo recusado: há snapshots posteriores para a conta afetada.");
      }

      let compensatedPoints = 0;
      for (const snapshot of before.candidates) {
        const account = await tx.pointAccount.findUnique({
          where: {
            courierId_periodId: {
              courierId: snapshot.courierId,
              periodId: before.batch.periodId,
            },
          },
        });
        if (!account || account.importedPoints !== snapshot.points) {
          throw new Error("Reparo recusado: a conta mudou após o lote.");
        }
        const amount = snapshot.previousPoints - snapshot.points;
        const balanceAfter = account.balancePoints + amount;
        if (balanceAfter < 0 || balanceAfter > MAX_DATABASE_INT) {
          throw new Error("Reparo recusado: saldo resultante fora do limite.");
        }
        const changed = await tx.pointAccount.updateMany({
          where: {
            id: account.id,
            version: account.version,
            importedPoints: snapshot.points,
          },
          data: {
            importedPoints: snapshot.previousPoints,
            balancePoints: { increment: amount },
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) throw new Error("Reparo recusado por conflito de versão.");
        await tx.pointLedgerEntry.create({
          data: {
            accountId: account.id,
            type: PointEntryType.IMPORT_CORRECTION,
            amount,
            balanceAfter,
            description: "Reparo de omissão sem snapshot anterior",
            referenceType: "IMPORT_REPAIR",
            referenceId: before.batch.id,
            importBatchId: before.batch.id,
            actorUserId: before.batch.createdById,
          },
        });
        await tx.importCourierSnapshot.delete({ where: { id: snapshot.id } });
        compensatedPoints += amount;
      }

      const warningCount = Math.max(
        0,
        before.batch.warningCount - before.candidates.length,
      );
      await tx.importBatch.update({
        where: { id: before.batch.id },
        data: {
          warningCount,
          warnings: cleanedBatchWarnings(before.batch.warnings),
          status: warningCount
            ? ImportStatus.COMPLETED_WITH_WARNINGS
            : ImportStatus.COMPLETED,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: before.batch.createdById,
          action: "IMPORT_REPAIR_OMITTED_NON_SNAPSHOT",
          entityType: "ImportBatch",
          entityId: before.batch.id,
          metadata: {
            repairedAccounts: before.candidates.length,
            compensatedPoints,
            snapshotCountBefore: before.batch._count.snapshots,
            snapshotCountAfter:
              before.batch._count.snapshots - before.candidates.length,
          },
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );

  const after = await inspect();
  const restoredAccounts = await db.pointAccount.findMany({
    where: {
      periodId: before.batch.periodId,
      courierId: { in: before.candidates.map((snapshot) => snapshot.courierId) },
    },
    select: { importedPoints: true, balancePoints: true },
  });
  console.log(
    JSON.stringify({
      phase: "after",
      batchId: after.batch.id,
      courierCount: after.batch.courierCount,
      snapshotCount: after.batch._count.snapshots,
      totalPoints: after.batch.totalPoints,
      warningCount: after.batch.warningCount,
      repairCandidates: after.candidates.length,
      candidateAccounts: restoredAccounts.map((account) => ({
        importedPoints: account.importedPoints,
        balancePoints: account.balancePoints,
      })),
    }),
  );
}

repair().finally(() => db.$disconnect());
