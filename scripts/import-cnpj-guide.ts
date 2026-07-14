import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { MatchStatus, Prisma, PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

import { normalizeName } from "../src/features/imports/normalization";
import { isValidCnpj, normalizeCnpj } from "../src/lib/auth/identity";

const db = new PrismaClient();

type InformativoEntry = {
  externalCourierId: string;
  name: string;
  normalizedName: string;
  cnpj: string;
};

function cellText(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return value.text.trim();
  return String(value).trim();
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

async function main() {
  const filename = path.resolve(process.argv[2] ?? "C:/Users/Luiz/Desktop/informativo.xlsx");
  const workbook = new ExcelJS.Workbook();
  const bytes = await readFile(filename);
  const data = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(data).set(bytes);
  await workbook.xlsx.load(data);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("O informativo não contém nenhuma guia.");

  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, column) => headers.set(cellText(cell.value).toLocaleLowerCase("pt-BR"), column));
  const idColumn = headers.get("id_da_pessoa_entregadora");
  const nameColumn = headers.get("pessoa_entregadora");
  const cnpjColumn = headers.get("cnpj");
  if (!idColumn || !nameColumn || !cnpjColumn) {
    throw new Error("As colunas id_da_pessoa_entregadora, pessoa_entregadora e CNPJ são obrigatórias.");
  }

  const byExternalId = new Map<string, { names: Map<string, number>; cnpjs: Set<string> }>();
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const externalCourierId = cellText(row.getCell(idColumn).value).toLowerCase();
    if (!externalCourierId) continue;
    const name = cellText(row.getCell(nameColumn).value);
    const cnpj = normalizeCnpj(cellText(row.getCell(cnpjColumn).value));
    const aggregate = byExternalId.get(externalCourierId) ?? { names: new Map(), cnpjs: new Set() };
    aggregate.names.set(name, (aggregate.names.get(name) ?? 0) + 1);
    if (cnpj) aggregate.cnpjs.add(cnpj);
    byExternalId.set(externalCourierId, aggregate);
  }

  let missingCnpj = 0;
  let invalidCnpj = 0;
  const parsed: InformativoEntry[] = [];
  for (const [externalCourierId, aggregate] of byExternalId) {
    const name = [...aggregate.names].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";
    if (aggregate.cnpjs.size === 0) {
      missingCnpj += 1;
      continue;
    }
    if (aggregate.cnpjs.size > 1) throw new Error(`O UUID ${externalCourierId} possui mais de um CNPJ.`);
    const cnpj = [...aggregate.cnpjs][0];
    if (!isValidCnpj(cnpj)) {
      invalidCnpj += 1;
      continue;
    }
    parsed.push({ externalCourierId, name, normalizedName: normalizeName(name), cnpj });
  }

  const externalIds = parsed.map((entry) => entry.externalCourierId);
  const couriers = await db.courier.findMany({
    where: { externalCourierId: { in: externalIds } },
    select: { id: true, externalCourierId: true, cnpj: true },
  });
  const courierByExternalId = new Map(couriers.flatMap((courier) => courier.externalCourierId ? [[courier.externalCourierId, courier] as const] : []));
  const matched = parsed.filter((entry) => courierByExternalId.has(entry.externalCourierId));
  const unmatched = parsed.length - matched.length;

  const desiredOwnerByCnpj = new Map(matched.map((entry) => [entry.cnpj, entry.externalCourierId]));
  const existingOwners = await db.courier.findMany({ where: { cnpj: { in: [...desiredOwnerByCnpj.keys()] } }, select: { cnpj: true, externalCourierId: true } });
  for (const owner of existingOwners) {
    if (owner.cnpj && desiredOwnerByCnpj.get(owner.cnpj) !== owner.externalCourierId) {
      throw new Error(`O CNPJ ${owner.cnpj} já pertence a outro UUID no banco.`);
    }
  }

  const beforeMatched = couriers.filter((courier) => courier.cnpj).length;
  await db.$transaction(async (tx) => {
    for (const group of chunks(matched, 400)) {
      const updateValues = group.map((entry) => {
        const courier = courierByExternalId.get(entry.externalCourierId)!;
        return Prisma.sql`(${courier.id}, ${entry.name}, ${entry.normalizedName}, ${entry.cnpj})`;
      });
      await tx.$executeRaw(Prisma.sql`
        UPDATE "Courier" AS courier
        SET "cnpj" = incoming."cnpj"::text,
            "sourceCnpjName" = incoming."name"::text,
            "cnpjMatchStatus" = ${MatchStatus.MANUAL_MATCHED}::text::"MatchStatus",
            "cnpjMatchScore" = 1,
            "activationCodeHash" = CASE WHEN courier."cnpj" IS DISTINCT FROM incoming."cnpj"::text THEN NULL ELSE courier."activationCodeHash" END,
            "activationCodeExpiresAt" = CASE WHEN courier."cnpj" IS DISTINCT FROM incoming."cnpj"::text THEN NULL ELSE courier."activationCodeExpiresAt" END,
            "updatedAt" = NOW()
        FROM (VALUES ${Prisma.join(updateValues)}) AS incoming("id", "name", "normalizedName", "cnpj")
        WHERE courier."id" = incoming."id"::text
      `);

      const guideValues = group.map((entry) => {
        const courier = courierByExternalId.get(entry.externalCourierId)!;
        return Prisma.sql`(${`guide_${randomUUID()}`}, ${entry.name}, ${entry.normalizedName}, ${entry.cnpj}, ${courier.id}, ${"INFORMATIVO"}, NOW(), NOW())`;
      });
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "CnpjGuideEntry" ("id", "name", "normalizedName", "cnpj", "courierId", "source", "createdAt", "updatedAt")
        VALUES ${Prisma.join(guideValues)}
        ON CONFLICT ("courierId") DO UPDATE SET
          "name" = EXCLUDED."name",
          "normalizedName" = EXCLUDED."normalizedName",
          "cnpj" = EXCLUDED."cnpj",
          "source" = EXCLUDED."source",
          "updatedAt" = NOW()
      `);
    }

    await tx.$executeRaw`
      UPDATE "CnpjRegistryEntry" AS registry
      SET "courierId" = guide."courierId",
          "matchStatus" = 'MANUAL_MATCHED'::"MatchStatus",
          "matchScore" = 1,
          "updatedAt" = NOW()
      FROM "CnpjGuideEntry" AS guide
      WHERE registry."cnpj" = guide."cnpj"
        AND guide."courierId" IS NOT NULL
    `;
    await tx.auditLog.create({
      data: {
        action: "CNPJ_GUIDE_INFORMATIVO_IMPORTED",
        entityType: "CnpjGuideEntry",
        metadata: { filename: path.basename(filename), rows: sheet.rowCount - 1, uniqueCouriers: byExternalId.size, matched: matched.length, newlyReconciled: matched.length - beforeMatched, missingCnpj, invalidCnpj, unmatched },
      },
    });
  }, { timeout: 120_000 });

  console.log(JSON.stringify({ filename, rows: sheet.rowCount - 1, uniqueCouriers: byExternalId.size, validCnpjs: parsed.length, matched: matched.length, newlyReconciled: matched.length - beforeMatched, missingCnpj, invalidCnpj, unmatched }, null, 2));
}

main().finally(() => db.$disconnect());
