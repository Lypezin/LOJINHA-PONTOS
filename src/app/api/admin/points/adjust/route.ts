import { PointEntryType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/domain-error";
import { apiError } from "@/lib/http";
import { ensureCurrentPeriod } from "@/features/points/period";
import { isTrustedPostOrigin } from "@/lib/auth/origin";

const schema = z.object({
  courierId: z.string().min(1),
  amount: z.number().int().min(-10_000_000).max(10_000_000).refine((value) => value !== 0),
  description: z.string().trim().min(8).max(300),
  idempotencyKey: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    if (!isTrustedPostOrigin(request)) throw new DomainError("Origem da solicitação não permitida.", "INVALID_ORIGIN", 403);
    const admin = await requireAdmin();
    const input = schema.parse(await request.json());
    const period = await ensureCurrentPeriod();
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.pointLedgerEntry.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { account: true },
      });
      if (existing) {
        const sameOperation =
          existing.actorUserId === admin.id &&
          existing.account.courierId === input.courierId &&
          existing.account.periodId === period.id &&
          existing.amount === input.amount &&
          existing.description === input.description;
        if (!sameOperation) {
          throw new DomainError("A chave desta operação já foi usada com outros dados.", "IDEMPOTENCY_KEY_REUSED", 409);
        }
        return { account: existing.account, entry: existing };
      }
      let account = await tx.pointAccount.findUnique({
        where: { courierId_periodId: { courierId: input.courierId, periodId: period.id } },
      });
      if (!account) {
        if (input.amount < 0) throw new DomainError("Não há saldo para remover pontos.", "INSUFFICIENT_POINTS", 409);
        account = await tx.pointAccount.create({
          data: { courierId: input.courierId, periodId: period.id },
        });
      }
      if (account.balancePoints + input.amount < 0) {
        throw new DomainError("O ajuste deixaria o saldo negativo.", "INSUFFICIENT_POINTS", 409);
      }
      const changed = await tx.pointAccount.updateMany({
        where: {
          id: account.id,
          version: account.version,
          ...(input.amount < 0 ? { balancePoints: { gte: -input.amount } } : {}),
        },
        data: {
          adjustmentPoints: { increment: input.amount },
          balancePoints: { increment: input.amount },
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        throw new DomainError("O saldo mudou durante o ajuste. Atualize e tente novamente.", "BALANCE_CONFLICT", 409);
      }
      const updated = await tx.pointAccount.findUniqueOrThrow({ where: { id: account.id } });
      const entry = await tx.pointLedgerEntry.create({
        data: {
          accountId: account.id,
          type: PointEntryType.ADMIN_ADJUSTMENT,
          amount: input.amount,
          balanceAfter: updated.balancePoints,
          description: input.description,
          referenceType: "ADMIN_ADJUSTMENT",
          actorUserId: admin.id,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: admin.id,
          action: "POINTS_ADJUSTED",
          entityType: "Courier",
          entityId: input.courierId,
          metadata: { amount: input.amount, period: period.key, ledgerEntryId: entry.id },
        },
      });
      return { account: updated, entry };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
