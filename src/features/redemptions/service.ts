import {
  PointEntryType,
  Prisma,
  ProductStatus,
  RedemptionStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/domain-error";
import { ensureCurrentPeriod } from "@/features/points/period";

type RedeemInput = {
  courierId: string;
  userId: string;
  productId: string;
  quantity: number;
  idempotencyKey: string;
  notes?: string;
};

function sameRedemptionRequest(
  existing: { courierId: string; productId: string; quantity: number; notes: string | null },
  input: RedeemInput,
) {
  return existing.courierId === input.courierId &&
    existing.productId === input.productId &&
    existing.quantity === input.quantity &&
    (existing.notes ?? "") === (input.notes ?? "");
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

          const [product, account] = await Promise.all([
            tx.product.findUnique({ where: { id: input.productId } }),
            tx.pointAccount.findUnique({
              where: { courierId_periodId: { courierId: input.courierId, periodId: period.id } },
            }),
          ]);

          if (!product || product.status !== ProductStatus.ACTIVE) {
            throw new DomainError("Este item não está disponível.", "PRODUCT_UNAVAILABLE", 409);
          }
          if (!account) {
            throw new DomainError("Você ainda não possui pontos nesta competência.", "ACCOUNT_NOT_FOUND", 409);
          }
          if (product.stockQuantity < input.quantity) {
            throw new DomainError("Estoque insuficiente para esta quantidade.", "OUT_OF_STOCK", 409);
          }

          const pointsSpent = product.pointsCost * input.quantity;
          if (account.balancePoints < pointsSpent) {
            throw new DomainError("Seu saldo de pontos é insuficiente.", "INSUFFICIENT_POINTS", 409);
          }

          if (product.maxPerCourierPerPeriod) {
            const alreadyRedeemed = await tx.redemption.aggregate({
              where: {
                courierId: input.courierId,
                periodId: period.id,
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

          const accountUpdate = await tx.pointAccount.updateMany({
            where: {
              id: account.id,
              version: account.version,
              balancePoints: { gte: pointsSpent },
            },
            data: {
              redeemedPoints: { increment: pointsSpent },
              balancePoints: { decrement: pointsSpent },
              version: { increment: 1 },
            },
          });
          if (accountUpdate.count !== 1) {
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
              notes: input.notes,
            },
          });

          await Promise.all([
            tx.pointLedgerEntry.create({
              data: {
                accountId: account.id,
                type: PointEntryType.REDEMPTION,
                amount: -pointsSpent,
                balanceAfter: account.balancePoints - pointsSpent,
                description: `Resgate de ${input.quantity}x ${product.name}`,
                referenceType: "REDEMPTION",
                referenceId: redemption.id,
                actorUserId: input.userId,
              },
            }),
            tx.auditLog.create({
              data: {
                actorUserId: input.userId,
                action: "REDEMPTION_CREATED",
                entityType: "Redemption",
                entityId: redemption.id,
                metadata: { productId: product.id, quantity: input.quantity, pointsSpent },
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

            const account = await tx.pointAccount.findUnique({
              where: { courierId_periodId: { courierId: redemption.courierId, periodId: redemption.periodId } },
            });
            const refundable = account && redemption.period.status === "OPEN" && redemption.period.endsAt > new Date();
            if (account && refundable) {
              const balanceAfter = account.balancePoints + redemption.pointsSpent;
              const accountUpdate = await tx.pointAccount.updateMany({
                where: { id: account.id, version: account.version },
                data: {
                  redeemedPoints: { decrement: redemption.pointsSpent },
                  balancePoints: { increment: redemption.pointsSpent },
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
                  amount: redemption.pointsSpent,
                  balanceAfter,
                  description: `Estorno do resgate ${redemption.code}`,
                  referenceType: "REDEMPTION",
                  referenceId: redemption.id,
                  actorUserId: adminId,
                },
              });
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
