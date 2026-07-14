import { PointEntryType, ProductStatus, RedemptionStatus, UserRole } from "@prisma/client";
import { db } from "../src/lib/db";
import { ensureCurrentPeriod } from "../src/features/points/period";
import { redeemProduct, updateRedemptionStatus } from "../src/features/redemptions/service";

async function main() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const admin = await db.user.findFirstOrThrow({ where: { role: UserRole.ADMIN } });
  const period = await ensureCurrentPeriod();
  const courier = await db.courier.create({
    data: {
      externalCourierId: `smoke-${suffix}`,
      name: `Teste de concorrência ${suffix}`,
      normalizedName: `TESTE DE CONCORRENCIA ${suffix.toUpperCase()}`,
      status: "ACTIVE",
    },
  });
  const user = await db.user.create({
    data: {
      email: `smoke-${suffix}@local.test`,
      emailNormalized: `smoke-${suffix}@local.test`,
      passwordHash: "smoke-test-only",
      role: UserRole.COURIER,
      courierId: courier.id,
    },
  });
  const product = await db.product.create({
    data: {
      slug: `smoke-${suffix}`,
      name: "Último item de teste",
      description: "Item temporário para validar atomicidade de estoque e saldo.",
      category: "Teste",
      pointsCost: 100,
      stockQuantity: 1,
      status: ProductStatus.ACTIVE,
      createdById: admin.id,
    },
  });
  await db.pointAccount.create({
    data: {
      courierId: courier.id,
      periodId: period.id,
      importedPoints: 100,
      balancePoints: 100,
    },
  });

  try {
    const attempts = await Promise.allSettled([
      redeemProduct({
        courierId: courier.id,
        userId: user.id,
        productId: product.id,
        quantity: 1,
        idempotencyKey: crypto.randomUUID(),
      }),
      redeemProduct({
        courierId: courier.id,
        userId: user.id,
        productId: product.id,
        quantity: 1,
        idempotencyKey: crypto.randomUUID(),
      }),
    ]);
    const fulfilled = attempts.filter((result) => result.status === "fulfilled");
    const [savedProduct, account, redemptions] = await Promise.all([
      db.product.findUniqueOrThrow({ where: { id: product.id } }),
      db.pointAccount.findUniqueOrThrow({
        where: { courierId_periodId: { courierId: courier.id, periodId: period.id } },
      }),
      db.redemption.findMany({ where: { courierId: courier.id } }),
    ]);

    if (fulfilled.length !== 1 || redemptions.length !== 1) throw new Error("Mais de um resgate foi confirmado.");
    if (savedProduct.stockQuantity !== 0) throw new Error("O estoque não foi debitado exatamente uma vez.");
    if (account.balancePoints !== 0 || account.redeemedPoints !== 100) {
      throw new Error("O saldo não foi debitado exatamente uma vez.");
    }

    const repeated = await redeemProduct({
      courierId: courier.id,
      userId: user.id,
      productId: product.id,
      quantity: 1,
      idempotencyKey: redemptions[0].idempotencyKey,
    });
    if (repeated.id !== redemptions[0].id) throw new Error("A chave de idempotência não retornou o mesmo resgate.");

    await Promise.allSettled([
      updateRedemptionStatus(redemptions[0].id, RedemptionStatus.CANCELED, admin.id),
      updateRedemptionStatus(redemptions[0].id, RedemptionStatus.CANCELED, admin.id),
    ]);
    const [refundedProduct, refundedAccount, refundEntries] = await Promise.all([
      db.product.findUniqueOrThrow({ where: { id: product.id } }),
      db.pointAccount.findUniqueOrThrow({
        where: { courierId_periodId: { courierId: courier.id, periodId: period.id } },
      }),
      db.pointLedgerEntry.count({
        where: {
          account: { courierId: courier.id },
          type: PointEntryType.REFUND,
          referenceId: redemptions[0].id,
        },
      }),
    ]);
    if (refundedProduct.stockQuantity !== 1) throw new Error("O cancelamento devolveu estoque mais de uma vez.");
    if (refundedAccount.balancePoints !== 100 || refundedAccount.redeemedPoints !== 0) {
      throw new Error("O cancelamento estornou os pontos incorretamente.");
    }
    if (refundEntries !== 1) throw new Error("O cancelamento criou mais de um lançamento de estorno.");

    console.log("Smoke aprovado: concorrência, débito, estoque, idempotência e estorno estão consistentes.");
  } finally {
    await db.auditLog.deleteMany({ where: { actorUserId: user.id } });
    await db.redemption.deleteMany({ where: { courierId: courier.id } });
    await db.product.delete({ where: { id: product.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.courier.delete({ where: { id: courier.id } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
