import { PointEntryType, PeriodStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

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

async function closeExpiredPeriods(now: Date, currentPeriodId: string) {
  const expiredPeriods = await db.monthlyPeriod.findMany({
    where: {
      id: { not: currentPeriodId },
      status: PeriodStatus.OPEN,
      endsAt: { lte: now },
    },
  });

  for (const period of expiredPeriods) {
    await db.$transaction(
      async (tx) => {
        await tx.$queryRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(hashtext(${`lojinha-import:${period.key}`}))::text
        `);
        const latest = await tx.monthlyPeriod.findUnique({ where: { id: period.id } });
        if (!latest || latest.status === PeriodStatus.CLOSED || latest.endsAt > now) return;

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
              description: `Expiração da competência ${period.key}`,
              referenceType: "PERIOD",
              referenceId: period.id,
            })),
          });
        }
        await tx.monthlyPeriod.update({
          where: { id: period.id },
          data: { status: PeriodStatus.CLOSED, closedAt: now },
        });
      },
      { maxWait: 15_000, timeout: 120_000 },
    );
  }
}

export async function ensureCurrentPeriod(now = new Date()) {
  const definition = periodDefinition(periodKeyForDate(now));
  const period = await db.monthlyPeriod.upsert({
    where: { key: definition.key },
    update: {},
    create: definition,
  });
  await closeExpiredPeriods(now, period.id);
  return period;
}

export async function getCurrentAccount(courierId: string) {
  const period = await ensureCurrentPeriod();
  const account = await db.pointAccount.findUnique({
    where: { courierId_periodId: { courierId, periodId: period.id } },
    include: { entries: { orderBy: { createdAt: "desc" }, take: 8 } },
  });
  return { period, account };
}

export type TransactionClient = Prisma.TransactionClient;
