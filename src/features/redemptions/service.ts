import {
  PointEntryType,
  Prisma,
  ProductStatus,
  RedemptionFulfillmentType,
  RedemptionStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/domain-error";
import { ensureCurrentPeriod, periodDefinition, periodKeyForDate } from "@/features/points/period";

type RedeemInput = {
  courierId: string;
  userId: string;
  productId: string;
  quantity: number;
  idempotencyKey: string;
  fulfillmentType?: RedemptionFulfillmentType;
  pixKey?: string;
  notes?: string;
};

function sameRedemptionRequest(
  existing: {
    courierId: string;
    productId: string;
    quantity: number;
    fulfillmentType: RedemptionFulfillmentType;
    pixKey: string | null;
    notes: string | null;
  },
  input: RedeemInput,
) {
  return (
    existing.courierId === input.courierId &&
    existing.productId === input.productId &&
    existing.quantity === input.quantity &&
    existing.fulfillmentType === (input.fulfillmentType ?? RedemptionFulfillmentType.PRODUCT) &&
    (existing.pixKey ?? "") === (input.pixKey?.trim() ?? "") &&
    (existing.notes ?? "") === (input.notes ?? "")
  );
}

function redemptionCode() {
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "2-digit",
    month: "2-digit",
  })
    .format(new Date())
    .replace("-", "");
  return `RES-${stamp}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

export async function redeemProduct(input: RedeemInput) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 10) {
    throw new DomainError("Quantidade inválida.", "INVALID_QUANTITY", 422);
  }
  const period = await ensureCurrentPeriod();
  const calendarMonth = periodDefinition(periodKeyForDate());

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(
        async (tx) => {
          const existing = await tx.redemption.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
          if (existing) {
            if (!sameRedemptionRequest(existing, input)) {
              throw new DomainError("A chave deste resgate já foi usada com outros dados.", "IDEMPOTENCY_KEY_REUSED", 409);
            }
            return existing;
          }

          // Serializa a leitura do saldo com importações e ajustes do ciclo.
          await tx.$queryRaw(Prisma.sql`
            SELECT "id" FROM "MonthlyPeriod" WHERE "id" = ${period.id} FOR UPDATE
          `);
          const lockedPeriod = await tx.monthlyPeriod.findUniqueOrThrow({
            where: { id: period.id },
            select: { status: true, startsAt: true, endsAt: true },
          });
          const transactionNow = new Date();
          if (
            lockedPeriod.status !== "OPEN" ||
            lockedPeriod.startsAt > transactionNow ||
            lockedPeriod.endsAt <= transactionNow
          ) {
            throw new DomainError("O ciclo atual foi encerrado. Atualize a página para continuar.", "PERIOD_CLOSED", 409);
          }
          const product = await tx.product.findUnique({ where: { id: input.productId } });
          const accountIds = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
            SELECT account."id"
            FROM "PointAccount" AS account
            JOIN "MonthlyPeriod" AS activePeriod ON activePeriod."id" = account."periodId"
            WHERE account."courierId" = ${input.courierId}
              AND activePeriod."status" = 'OPEN'::"PeriodStatus"
              AND activePeriod."startsAt" <= NOW()
              AND activePeriod."endsAt" > NOW()
            ORDER BY activePeriod."startsAt" ASC, activePeriod."endsAt" ASC, account."id" ASC
            FOR UPDATE OF account
          `);
          const accounts = accountIds.length
            ? await tx.pointAccount.findMany({ where: { id: { in: accountIds.map(({ id }) => id) } } })
            : [];
          const accountOrder = new Map<string, number>(accountIds.map(({ id }, index) => [id, index] as const));
          accounts.sort((a, b) => (accountOrder.get(a.id) ?? 0) - (accountOrder.get(b.id) ?? 0));
          const totalBalance = accounts.reduce((sum, account) => sum + account.balancePoints, 0);

          if (!product || product.status !== ProductStatus.ACTIVE) {
            throw new DomainError("Este item não está disponível.", "PRODUCT_UNAVAILABLE", 409);
          }
          if (!accounts.length || totalBalance <= 0) {
            throw new DomainError("Você ainda não possui pontos disponíveis neste ciclo.", "ACCOUNT_NOT_FOUND", 409);
          }
          if (product.stockQuantity < input.quantity) {
            throw new DomainError("Estoque insuficiente para esta quantidade.", "OUT_OF_STOCK", 409);
          }

          const fulfillmentType = input.fulfillmentType ?? RedemptionFulfillmentType.PRODUCT;
          let cashAmountCents: number | null = null;
          let pixKey: string | null = null;

          if (fulfillmentType === RedemptionFulfillmentType.CASH) {
            if (!product.referenceValueCents || product.referenceValueCents <= 0) {
              throw new DomainError("Este item não possui valor de referência configurado para resgate em dinheiro.", "CASH_REDEMPTION_UNAVAILABLE", 422);
            }
            if (!input.pixKey || !input.pixKey.trim()) {
              throw new DomainError("Informe sua chave PIX para o resgate em dinheiro.", "PIX_KEY_REQUIRED", 422);
            }
            pixKey = input.pixKey.trim();
            cashAmountCents = Math.round(product.referenceValueCents * 0.50) * input.quantity;
          }

          const pointsSpent = product.pointsCost * input.quantity;
          if (totalBalance < pointsSpent) {
            throw new DomainError("Seu saldo de pontos é insuficiente.", "INSUFFICIENT_POINTS", 409);
          }

          if (product.maxPerCourierPerPeriod) {
            const alreadyRedeemed = await tx.redemption.aggregate({
              where: {
                courierId: input.courierId,
                requestedAt: { gte: calendarMonth.startsAt, lt: calendarMonth.endsAt },
                productId: product.id,
                status: { not: RedemptionStatus.CANCELED },
              },
              _sum: { quantity: true },
            });
            const previous = alreadyRedeemed._sum.quantity ?? 0;
            if (previous + input.quantity > product.maxPerCourierPerPeriod) {
              throw new DomainError(
                `Limite de ${product.maxPerCourierPerPeriod} unidade(s) por mês atingido.`,
                "REDEMPTION_LIMIT",
                409,
              );
            }
          }

          const stockUpdate = await tx.product.updateMany({
            where: {
              id: product.id,
              version: product.version,
              status: ProductStatus.ACTIVE,
              stockQuantity: { gte: input.quantity },
            },
            data: { stockQuantity: { decrement: input.quantity }, version: { increment: 1 } },
          });
          if (stockUpdate.count !== 1) {
            throw new Prisma.PrismaClientKnownRequestError("Conflito de estoque", {
              code: "P2034",
              clientVersion: Prisma.prismaVersion.client,
            });
          }

          let remainingPoints = pointsSpent;
          const pointDebits: Array<{ accountId: string; amount: number; balanceAfter: number }> = [];
          for (const account of accounts) {
            if (remainingPoints <= 0) break;
            const debited = Math.min(account.balancePoints, remainingPoints);
            if (debited <= 0) continue;
            const accountUpdate = await tx.pointAccount.updateMany({
              where: { id: account.id, version: account.version, balancePoints: { gte: debited } },
              data: {
                redeemedPoints: { increment: debited },
                balancePoints: { decrement: debited },
                version: { increment: 1 },
              },
            });
            if (accountUpdate.count !== 1) {
              throw new Prisma.PrismaClientKnownRequestError("Conflito de saldo", {
                code: "P2034",
                clientVersion: Prisma.prismaVersion.client,
              });
            }
            remainingPoints -= debited;
            pointDebits.push({ accountId: account.id, amount: debited, balanceAfter: account.balancePoints - debited });
          }
          if (remainingPoints !== 0) {
            throw new Prisma.PrismaClientKnownRequestError("Conflito de saldo", {
              code: "P2034",
              clientVersion: Prisma.prismaVersion.client,
            });
          }

          const redemption = await tx.redemption.create({
            data: {
              code: redemptionCode(),
              idempotencyKey: input.idempotencyKey,
              courierId: input.courierId,
              periodId: period.id,
              productId: product.id,
              quantity: input.quantity,
              unitPoints: product.pointsCost,
              pointsSpent,
              productNameSnapshot: product.name,
              imageUrlSnapshot: product.imageUrl,
              fulfillmentType,
              cashAmountCents,
              pixKey,
              notes: input.notes,
            },
          });

          await Promise.all([
            tx.pointLedgerEntry.createMany({
              data: pointDebits.map((debit) => ({
                accountId: debit.accountId,
                type: PointEntryType.REDEMPTION,
                amount: -debit.amount,
                balanceAfter: debit.balanceAfter,
                description: fulfillmentType === RedemptionFulfillmentType.CASH
                  ? `Resgate em Dinheiro (PIX) de ${input.quantity}x ${product.name}`
                  : `Resgate de ${input.quantity}x ${product.name}`,
                referenceType: "REDEMPTION",
                referenceId: redemption.id,
                actorUserId: input.userId,
              })),
            }),
            tx.auditLog.create({
              data: {
                actorUserId: input.userId,
                action: "REDEMPTION_CREATED",
                entityType: "Redemption",
                entityId: redemption.id,
                metadata: { productId: product.id, quantity: input.quantity, pointsSpent, fulfillmentType, cashAmountCents, pixKey },
              },
            }),
          ]);
          return redemption;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof DomainError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await db.redemption.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (existing) {
          if (!sameRedemptionRequest(existing, input)) {
            throw new DomainError("A chave deste resgate já foi usada com outros dados.", "IDEMPOTENCY_KEY_REUSED", 409);
          }
          return existing;
        }
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        if (attempt < 2) continue;
        throw new DomainError("Houve uma disputa pelo último item. Tente novamente.", "CONCURRENCY_CONFLICT", 409);
      }
      throw error;
    }
  }
  throw new DomainError("Houve uma disputa pelo último item. Tente novamente.", "CONCURRENCY_CONFLICT", 409);
}

const transitions: Record<RedemptionStatus, RedemptionStatus[]> = {
  REQUESTED: [RedemptionStatus.APPROVED, RedemptionStatus.CANCELED],
  APPROVED: [RedemptionStatus.PREPARING, RedemptionStatus.CANCELED],
  PREPARING: [RedemptionStatus.READY, RedemptionStatus.CANCELED],
  READY: [RedemptionStatus.DELIVERED, RedemptionStatus.CANCELED],
  DELIVERED: [],
  CANCELED: [],
};

export async function updateRedemptionStatus(redemptionId: string, status: RedemptionStatus, adminId: string) {
  const now = new Date();
  await ensureCurrentPeriod(now);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(
        async (tx) => {
          const redemption = await tx.redemption.findUnique({
            where: { id: redemptionId },
            include: { period: true },
          });
          if (!redemption) throw new DomainError("Resgate não encontrado.", "NOT_FOUND", 404);
          if (redemption.status === status) return redemption;
          if (!transitions[redemption.status].includes(status)) {
            throw new DomainError("Essa mudança de status não é permitida.", "INVALID_STATUS_TRANSITION", 409);
          }

          const changed = await tx.redemption.updateMany({
            where: { id: redemption.id, status: redemption.status },
            data: {
              status,
              managedById: adminId,
              canceledAt: status === RedemptionStatus.CANCELED ? new Date() : undefined,
              fulfilledAt: status === RedemptionStatus.DELIVERED ? new Date() : undefined,
            },
          });
          if (changed.count !== 1) {
            throw new DomainError("O resgate foi alterado por outra operação. Atualize a página.", "STATUS_CONFLICT", 409);
          }

          if (status === RedemptionStatus.CANCELED) {
            const product = await tx.product.findUnique({
              where: { id: redemption.productId },
              select: { version: true },
            });
            if (!product) throw new DomainError("Produto não encontrado.", "NOT_FOUND", 404);

            const productUpdate = await tx.product.updateMany({
              where: { id: redemption.productId, version: product.version },
              data: { stockQuantity: { increment: redemption.quantity }, version: { increment: 1 } },
            });
            if (productUpdate.count !== 1) {
              throw new Prisma.PrismaClientKnownRequestError("Conflito de estoque no cancelamento", {
                code: "P2034",
                clientVersion: Prisma.prismaVersion.client,
              });
            }

            const originalDebits = await tx.pointLedgerEntry.findMany({
              where: { referenceType: "REDEMPTION", referenceId: redemption.id, amount: { lt: 0 } },
              select: { accountId: true, amount: true },
            });
            const refundableAccountIds = originalDebits.map(({ accountId }) => accountId);
            if (refundableAccountIds.length) {
              await tx.$queryRaw(Prisma.sql`
                SELECT "id" FROM "PointAccount"
                WHERE "id" IN (${Prisma.join(refundableAccountIds)})
                ORDER BY "id"
                FOR UPDATE
              `);
              const accounts = await tx.pointAccount.findMany({
                where: { id: { in: refundableAccountIds } },
                include: { period: true },
              });
              const accountById = new Map(accounts.map((account) => [account.id, account]));
              for (const debit of originalDebits) {
                const account = accountById.get(debit.accountId);
                if (!account || account.period.status !== "OPEN" || account.period.startsAt > now || account.period.endsAt <= now) continue;
                const refundPoints = -debit.amount;
                const balanceAfter = account.balancePoints + refundPoints;
                const accountUpdate = await tx.pointAccount.updateMany({
                  where: { id: account.id, version: account.version },
                  data: {
                    redeemedPoints: { decrement: refundPoints },
                    balancePoints: { increment: refundPoints },
                    version: { increment: 1 },
                  },
                });
                if (accountUpdate.count !== 1) {
                  throw new Prisma.PrismaClientKnownRequestError("Conflito de saldo no cancelamento", {
                    code: "P2034",
                    clientVersion: Prisma.prismaVersion.client,
                  });
                }
                await tx.pointLedgerEntry.create({
                  data: {
                    accountId: account.id,
                    type: PointEntryType.REFUND,
                    amount: refundPoints,
                    balanceAfter,
                    description: `Estorno do resgate ${redemption.code}`,
                    referenceType: "REDEMPTION",
                    referenceId: redemption.id,
                    actorUserId: adminId,
                  },
                });
              }
            }
          }

          await tx.auditLog.create({
            data: {
              actorUserId: adminId,
              action: "REDEMPTION_STATUS_UPDATED",
              entityType: "Redemption",
              entityId: redemption.id,
              metadata: { from: redemption.status, to: status },
            },
          });
          return tx.redemption.findUniqueOrThrow({ where: { id: redemption.id } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof DomainError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        if (attempt < 2) continue;
        throw new DomainError("O resgate foi alterado ao mesmo tempo. Tente novamente.", "STATUS_CONFLICT", 409);
      }
      throw error;
    }
  }
  throw new DomainError("O resgate foi alterado ao mesmo tempo. Tente novamente.", "STATUS_CONFLICT", 409);
}
