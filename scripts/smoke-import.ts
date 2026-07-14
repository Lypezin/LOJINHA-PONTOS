import ExcelJS from "exceljs";
import { PointEntryType, Prisma, UserRole } from "@prisma/client";

import { commitImport } from "@/features/imports/service";
import { parseImportWorkbook } from "@/features/imports/workbook";
import { periodDefinition } from "@/features/points/period";
import { db } from "@/lib/db";

const PERIOD_KEY = "2099-11";
const FIRST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SECOND_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CONCURRENT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MANUAL_ID = "smoke-manual-account";
let ownsSmokePeriod = false;

interface SmokeCourier {
  id: string;
  name: string;
  points: number;
  cnpj: string;
}

async function workbook(couriers: SmokeCourier[], ambiguousName?: string) {
  const value = new ExcelJS.Workbook();
  const data = value.addWorksheet("BANCO DE DADOS");
  const headers = new Array<string>(18).fill("");
  headers[0] = "data_do_periodo";
  headers[5] = "id_da_pessoa_entregadora";
  headers[6] = "pessoa_entregadora";
  headers[17] = "numero_de_pedidos_aceitos_e_concluidos";
  data.addRow(headers);
  for (const courier of couriers) {
    const row = new Array<unknown>(18).fill(null);
    row[0] = new Date("2099-11-10T12:00:00Z");
    row[5] = courier.id;
    row[6] = courier.name;
    row[17] = courier.points;
    data.addRow(row);
  }
  const cnpj = value.addWorksheet("DADOS CNPJ");
  cnpj.addRow(["ENTREGADOR", "CNPJ"]);
  for (const courier of couriers) cnpj.addRow([courier.name, courier.cnpj]);
  if (ambiguousName) cnpj.addRow([ambiguousName, "04.252.011/0001-10"]);
  return Buffer.from(await value.xlsx.writeBuffer());
}

async function holdRedemptionLock(
  accountId: string,
  actorUserId: string,
  onLocked: () => void,
  release: Promise<void>,
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "PointAccount" WHERE "id" = ${accountId} FOR UPDATE
    `);
    const account = await tx.pointAccount.findUniqueOrThrow({ where: { id: accountId } });
    onLocked();
    await release;
    if (account.balancePoints < 3) throw new Error("Saldo insuficiente no smoke concorrente.");
    const balanceAfter = account.balancePoints - 3;
    await tx.pointAccount.update({
      where: { id: account.id },
      data: {
        redeemedPoints: { increment: 3 },
        balancePoints: { decrement: 3 },
        version: { increment: 1 },
      },
    });
    await tx.pointLedgerEntry.create({
      data: {
        accountId: account.id,
        type: PointEntryType.REDEMPTION,
        amount: -3,
        balanceAfter,
        description: "Resgate concorrente do smoke de importação",
        referenceType: "SMOKE_REDEMPTION",
        actorUserId,
      },
    });
  });
}

async function main() {
  if (await db.monthlyPeriod.findUnique({ where: { key: PERIOD_KEY } })) {
    throw new Error("A competência reservada para o smoke já existe.");
  }
  ownsSmokePeriod = true;
  const admin = await db.user.findFirst({ where: { role: UserRole.ADMIN } });
  if (!admin) throw new Error("Admin de teste ausente.");
  const period = await db.monthlyPeriod.create({ data: periodDefinition(PERIOD_KEY) });
  const manualCourier = await db.courier.create({
    data: {
      externalCourierId: MANUAL_ID,
      name: "Pessoa Smoke Manual",
      normalizedName: "PESSOA SMOKE MANUAL",
    },
  });
  await db.pointAccount.create({
    data: {
      courierId: manualCourier.id,
      periodId: period.id,
      importedPoints: 500,
      balancePoints: 500,
      entries: {
        create: {
          type: PointEntryType.IMPORT_CREDIT,
          amount: 500,
          balanceAfter: 500,
          description: "Crédito manual sem snapshot para teste",
        },
      },
    },
  });

  const firstSnapshot: SmokeCourier[] = [
    { id: FIRST_ID, name: "Pessoa Smoke A", points: 5, cnpj: "11.222.333/0001-81" },
    {
      id: CONCURRENT_ID,
      name: "Pessoa Smoke C",
      points: 10,
      cnpj: "11.444.777/0001-61",
    },
  ];
  const parsed1 = await parseImportWorkbook(await workbook(firstSnapshot), {
    filename: "smoke-a.xlsx",
    periodKey: PERIOD_KEY,
  });
  const initialAttempts = await Promise.all([
    commitImport({ parsed: parsed1, adminUserId: admin.id }),
    commitImport({ parsed: parsed1, adminUserId: admin.id }),
  ]);
  const first = initialAttempts.find((result) => !result.duplicate);
  const duplicate = initialAttempts.find((result) => result.duplicate);
  if (!first || !duplicate || duplicate.batchId !== first.batchId) {
    throw new Error("A repetição não foi idempotente.");
  }

  const secondSnapshot: SmokeCourier[] = [
    { ...firstSnapshot[0], points: 7 },
    { ...firstSnapshot[1], points: 12 },
  ];
  const parsed2 = await parseImportWorkbook(await workbook(secondSnapshot), {
    filename: "smoke-b.xlsx",
    periodKey: PERIOD_KEY,
  });
  const concurrentAccount = await db.pointAccount.findFirstOrThrow({
    where: {
      period: { key: PERIOD_KEY },
      courier: { externalCourierId: CONCURRENT_ID },
    },
    select: { id: true },
  });
  let notifyLocked!: () => void;
  const locked = new Promise<void>((resolve) => {
    notifyLocked = resolve;
  });
  let releaseLock!: () => void;
  const release = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const redemption = holdRedemptionLock(
    concurrentAccount.id,
    admin.id,
    notifyLocked,
    release,
  );
  await locked;
  const concurrentImport = commitImport({ parsed: parsed2, adminUserId: admin.id });
  await new Promise((resolve) => setTimeout(resolve, 150));
  releaseLock();
  await Promise.all([redemption, concurrentImport]);

  const thirdSnapshot: SmokeCourier[] = [
    {
      id: SECOND_ID,
      name: "Pessoa Smoke B",
      points: 3,
      cnpj: "19.131.243/0001-97",
    },
    secondSnapshot[1],
  ];
  const parsed3 = await parseImportWorkbook(
    await workbook(thirdSnapshot, "Pessoa Smoke B"),
    {
      filename: "smoke-c.xlsx",
      periodKey: PERIOD_KEY,
    },
  );
  const omitted = await commitImport({ parsed: parsed3, adminUserId: admin.id });
  if (omitted.warningCount < 1) throw new Error("A omissão não gerou aviso.");

  const account = await db.pointAccount.findFirst({
    where: {
      period: { key: PERIOD_KEY },
      courier: { externalCourierId: FIRST_ID },
    },
    select: {
      importedPoints: true,
      balancePoints: true,
      entries: {
        orderBy: { createdAt: "asc" },
        select: { amount: true },
      },
    },
  });
  if (
    !account ||
    account.importedPoints !== 0 ||
    account.balancePoints !== 0 ||
    account.entries.map((entry) => entry.amount).join(",") !== "5,2,-7"
  ) {
    throw new Error("A sequência de deltas não foi contabilizada corretamente.");
  }
  const concurrentAccountAfter = await db.pointAccount.findFirst({
    where: {
      period: { key: PERIOD_KEY },
      courier: { externalCourierId: CONCURRENT_ID },
    },
    select: {
      importedPoints: true,
      redeemedPoints: true,
      balancePoints: true,
    },
  });
  if (
    !concurrentAccountAfter ||
    concurrentAccountAfter.importedPoints !== 12 ||
    concurrentAccountAfter.redeemedPoints !== 3 ||
    concurrentAccountAfter.balancePoints !== 9
  ) {
    throw new Error("Importação concorrente sobrescreveu o resgate.");
  }
  const manualAccount = await db.pointAccount.findFirst({
    where: { courierId: manualCourier.id, periodId: period.id },
    select: { importedPoints: true, balancePoints: true },
  });
  if (
    !manualAccount ||
    manualAccount.importedPoints !== 500 ||
    manualAccount.balancePoints !== 500
  ) {
    throw new Error("Conta sem snapshot anterior foi alterada pela importação.");
  }
  console.log(
    JSON.stringify({
      ok: true,
      duplicate: true,
      deltas: [5, 2, -7],
      concurrentBalance: 9,
      manualBalance: 500,
    }),
  );
}

async function cleanup() {
  if (!ownsSmokePeriod) return;
  const period = await db.monthlyPeriod.findUnique({ where: { key: PERIOD_KEY } });
  const couriers = await db.courier.findMany({
    where: {
      externalCourierId: { in: [FIRST_ID, SECOND_ID, CONCURRENT_ID, MANUAL_ID] },
    },
    select: { id: true },
  });
  const courierIds = couriers.map((courier) => courier.id);
  const batches = period
    ? await db.importBatch.findMany({ where: { periodId: period.id }, select: { id: true } })
    : [];
  const batchIds = batches.map((batch) => batch.id);
  await db.$transaction([
    db.auditLog.deleteMany({ where: { entityId: { in: batchIds } } }),
    db.importBatch.deleteMany({ where: { id: { in: batchIds } } }),
    db.pointAccount.deleteMany({ where: { courierId: { in: courierIds } } }),
    db.cnpjRegistryEntry.deleteMany({
      where: {
        OR: [
          { courierId: { in: courierIds } },
          {
            sourceName: {
              in: [
                "Pessoa Smoke A",
                "Pessoa Smoke B",
                "Pessoa Smoke C",
                "Pessoa Smoke Manual",
              ],
            },
          },
        ],
      },
    }),
    db.courier.deleteMany({ where: { id: { in: courierIds } } }),
    db.monthlyPeriod.deleteMany({ where: { key: PERIOD_KEY } }),
  ]);
}

main()
  .finally(cleanup)
  .finally(() => db.$disconnect());
