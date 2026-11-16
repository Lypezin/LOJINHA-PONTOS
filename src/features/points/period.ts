import { PointEntryType, PeriodStatus, Prisma } from "@prisma/client";
import { cache } from "react";
import { db } from "@/lib/db";
import { pointsCycleDefinitionForDate } from "@/features/points/cycle";

const TIME_ZONE = "America/Sao_Paulo";

export function periodKeyForDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("Não foi possível determinar a competência atual.");
  return `${year}-${month}`;
}

export function periodDefinition(key: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(key);
  if (!match) throw new Error("Competência inválida.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    key,
    year,
    month,
    startsAt: new Date(`${key}-01T00:00:00-03:00`),
    endsAt: new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00-03:00`),
  };
}

async function closeOtherOpenPeriods(now: Date, currentPeriodId: string) {
  const periodsToClose = await db.monthlyPeriod.findMany({
    where: {
      id: { not: currentPeriodId },
      status: PeriodStatus.OPEN,
    },
  });

  for (const period of periodsToClose) {
    await db.$transaction(
      async (tx) => {
        await tx.$queryRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtext(${`lojinha-import:${period.key}`}))::text
        `);
        const latest = await tx.monthlyPeriod.findUnique({ where: { id: period.id } });
        if (!latest || latest.status === PeriodStatus.CLOSED) return;

        const moved = await tx.$queryRaw<Array<{ id: string; amount: number }>>(Prisma.sql`
          WITH balances AS (
            SELECT "id", "balancePoints" AS amount
            FROM "PointAccount"
            WHERE "periodId" = ${period.id} AND "balancePoints" > 0
            FOR UPDATE
          ), updated AS (
            UPDATE "PointAccount" AS account
            SET
              "expiredPoints" = account."expiredPoints" + balances.amount,
              "balancePoints" = 0,
              "version" = account."version" + 1,
              "updatedAt" = ${now}
            FROM balances
            WHERE account."id" = balances."id"
            RETURNING account."id", balances.amount
          )
          SELECT "id", amount FROM updated
        `);
        if (moved.length) {
          await tx.pointLedgerEntry.createMany({
            data: moved.map((account) => ({
              accountId: account.id,
              type: PointEntryType.EXPIRATION,
              amount: -account.amount,
              balanceAfter: 0,
              description: `Expiração do saldo do período ${period.key}`,
              referenceType: "PERIOD",
              referenceId: period.id,
            })),
          });
        }
        await tx.monthlyPeriod.update({
          where: { id: period.id },
          data: {
            status: PeriodStatus.CLOSED,
            closedAt: now,
            endsAt: now,
          },
        });
      },
      { maxWait: 15_000, timeout: 120_000 },
    );
  }
}

export async function ensureCurrentPeriod(now = new Date()) {
  const definition = pointsCycleDefinitionForDate(now);
  const period = await db.monthlyPeriod.upsert({
    where: { key: definition.key },
    update: {},
    create: definition,
  });

  await closeOtherOpenPeriods(now, period.id);
  return period;
}

const loadCurrentAccount = async (courierId: string) => {
  let now = new Date();
  let period = await ensureCurrentPeriod(now);
  const afterEnsure = new Date();
  if (period.endsAt <= afterEnsure || period.status === PeriodStatus.CLOSED) {
    now = afterEnsure;
    period = await ensureCurrentPeriod(now);
  }
  const accounts = await db.pointAccount.findMany({
    where: {
      courierId,
      period: { status: PeriodStatus.OPEN, startsAt: { lte: now }, endsAt: { gt: now } },
    },
    select: {
      balancePoints: true,
      importedPoints: true,
      redeemedPoints: true,
      expiredPoints: true,
    },
  });
  const account = accounts.length
    ? accounts.reduce(
        (summary, current) => ({
          balancePoints: summary.balancePoints + current.balancePoints,
          importedPoints: summary.importedPoints + current.importedPoints,
          redeemedPoints: summary.redeemedPoints + current.redeemedPoints,
          expiredPoints: summary.expiredPoints + current.expiredPoints,
        }),
        { balancePoints: 0, importedPoints: 0, redeemedPoints: 0, expiredPoints: 0 },
      )
    : null;
  return { period, account };
};

// Compartilha período e saldo entre o layout e a página na mesma requisição.
export const getCurrentAccount = cache(loadCurrentAccount);

export type TransactionClient = Prisma.TransactionClient;
