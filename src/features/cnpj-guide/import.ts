import ExcelJS from "exceljs";
import { MatchStatus, Prisma } from "@prisma/client";

import {
  isUuid,
  isValidCnpj,
  normalizeHeader,
  normalizeName,
  normalizeUuid,
  onlyDigits,
  repairTextEncoding,
} from "@/features/imports/normalization";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/domain-error";

type CellValue = string | number | boolean | Date | null | undefined;
type Row = CellValue[];

const NAME_ALIASES = ["entregador", "pessoa_entregadora", "nome_entregador", "nome"];
const CNPJ_ALIASES = ["cnpj"];
const UUID_ALIASES = [
  "id_da_pessoa_entregadora",
  "id_pessoa_entregadora",
  "uuid_entregador",
  "uuid",
];
const REGION_ALIASES = ["regiao", "região", "praca", "praça"];

const HEADER_SCAN_LIMIT = 30;
const MAX_CNPJ_IMPORT_ROWS = 100_000;

function primitiveCellValue(value: ExcelJS.CellValue): CellValue {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  ) {
    return value;
  }
  if ("result" in value) return primitiveCellValue(value.result as ExcelJS.CellValue);
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("text" in value) return value.text;
  if ("error" in value) return value.error;
  return null;
}

function sheetRows(sheet: ExcelJS.Worksheet): Row[] {
  const rows: Row[] = [];
  const columnCount = Math.max(sheet.columnCount, sheet.actualColumnCount);
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const worksheetRow = sheet.getRow(rowNumber);
    const row: Row = [];
    for (let column = 1; column <= columnCount; column += 1) {
      row.push(primitiveCellValue(worksheetRow.getCell(column).value));
    }
    rows.push(row);
  }
  return rows;
}

function findColumnIndex(headers: Row, aliases: readonly string[]): number {
  const expected = new Set(aliases.map((alias) => normalizeHeader(alias)));
  return headers.findIndex((header) => expected.has(normalizeHeader(header)));
}

function rowIsEmpty(row: Row): boolean {
  return !row.some((value) => value !== null && value !== undefined && String(value).trim() !== "");
}

export interface CnpjGuideImportSummary {
  totalRows: number;
  importedEntries: number;
  linkedCouriers: number;
  invalidCnpjs: number;
  missingNames: number;
  sheetName: string;
}

export async function importCnpjGuideWorkbook(
  buffer: Buffer,
  adminUserId: string,
): Promise<CnpjGuideImportSummary> {
  const workbook = new ExcelJS.Workbook();
  try {
    const workbookBytes = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(workbookBytes).set(buffer);
    await workbook.xlsx.load(workbookBytes);
  } catch (error) {
    console.error("[CNPJ Import Error] Failed to parse Excel buffer:", error);
    throw new DomainError(
      "Não foi possível ler o arquivo. Envie uma planilha .xlsx válida.",
      "INVALID_WORKBOOK",
      422,
    );
  }

  const targetSheet =
    workbook.worksheets.find(
      (sheet) => normalizeName(sheet.name) === normalizeName("DADOS CNPJ"),
    ) ?? workbook.worksheets[0];

  if (!targetSheet) {
    throw new DomainError("A planilha enviada está vazia.", "EMPTY_WORKBOOK", 422);
  }

  if (targetSheet.rowCount > MAX_CNPJ_IMPORT_ROWS) {
    throw new DomainError("A planilha excede o limite máximo de 100.000 linhas.", "TOO_MANY_ROWS", 422);
  }

  const rows = sheetRows(targetSheet);
  let headerIndex = -1;
  for (let index = 0; index < Math.min(rows.length, HEADER_SCAN_LIMIT); index += 1) {
    const rowHeaders = (rows[index] ?? []).map(normalizeHeader);
    const hasName = NAME_ALIASES.some((alias) => rowHeaders.includes(normalizeHeader(alias)));
    const hasCnpj = CNPJ_ALIASES.some((alias) => rowHeaders.includes(normalizeHeader(alias)));
    if (hasName && hasCnpj) {
      headerIndex = index;
      break;
    }
  }

  if (headerIndex < 0) {
    throw new DomainError(
      "Não foi possível localizar os cabeçalhos NOME e CNPJ na planilha.",
      "HEADER_NOT_FOUND",
      422,
    );
  }

  const headers = rows[headerIndex]!;
  const nameIndex = findColumnIndex(headers, NAME_ALIASES);
  const cnpjIndex = findColumnIndex(headers, CNPJ_ALIASES);
  const uuidIndex = findColumnIndex(headers, UUID_ALIASES);
  const regionIndex = findColumnIndex(headers, REGION_ALIASES);

  let totalRows = 0;
  let invalidCnpjs = 0;
  let missingNames = 0;

  type ParsedEntry = {
    name: string;
    normalizedName: string;
    cnpj: string;
    uuid: string | null;
    region: string | null;
  };

  const parsedEntries: ParsedEntry[] = [];
  const seenCnpjs = new Set<string>();

  for (let offset = headerIndex + 1; offset < rows.length; offset += 1) {
    const row = rows[offset] ?? [];
    if (rowIsEmpty(row)) continue;
    totalRows += 1;

    const rawName = repairTextEncoding(row[nameIndex]).trim();
    const normalizedName = normalizeName(rawName);
    const cnpj = onlyDigits(row[cnpjIndex]);
    const rawUuid = uuidIndex >= 0 ? normalizeUuid(row[uuidIndex]) : "";
    const uuid = isUuid(rawUuid) ? rawUuid : null;
    const region = regionIndex >= 0 ? repairTextEncoding(row[regionIndex]).trim() || null : null;

    if (!normalizedName) {
      missingNames += 1;
      continue;
    }

    if (!isValidCnpj(cnpj)) {
      invalidCnpjs += 1;
      continue;
    }

    if (seenCnpjs.has(cnpj)) continue;
    seenCnpjs.add(cnpj);

    parsedEntries.push({
      name: rawName,
      normalizedName,
      cnpj,
      uuid,
      region,
    });
  }

  if (!parsedEntries.length) {
    throw new DomainError(
      "Nenhum CNPJ válido foi encontrado para importação na planilha.",
      "NO_VALID_DATA",
      422,
    );
  }

  const allUuids = parsedEntries.flatMap((e) => (e.uuid ? [e.uuid] : []));
  const allCnpjs = parsedEntries.map((e) => e.cnpj);
  const allNormalizedNames = parsedEntries.map((e) => e.normalizedName);

  // 1. Bulk pre-fetch existing Couriers
  const existingCouriers = await db.courier.findMany({
    where: {
      OR: [
        ...(allUuids.length ? [{ externalCourierId: { in: allUuids } }] : []),
        { cnpj: { in: allCnpjs } },
        { normalizedName: { in: allNormalizedNames }, status: { not: "INACTIVE" as const } },
      ],
    },
    select: {
      id: true,
      externalCourierId: true,
      cnpj: true,
      name: true,
      normalizedName: true,
      plaza: true,
    },
  });

  const courierByUuid = new Map(
    existingCouriers.flatMap((c) => (c.externalCourierId ? [[c.externalCourierId, c] as const] : [])),
  );
  const courierByCnpj = new Map(
    existingCouriers.flatMap((c) => (c.cnpj ? [[c.cnpj, c] as const] : [])),
  );
  const couriersByNormalizedName = new Map<string, typeof existingCouriers>();
  for (const c of existingCouriers) {
    const list = couriersByNormalizedName.get(c.normalizedName) ?? [];
    list.push(c);
    couriersByNormalizedName.set(c.normalizedName, list);
  }

  // 2. Pre-fetch existing CnpjGuideEntries
  const allCourierIds = existingCouriers.map((c) => c.id);
  const existingGuideEntries = await db.cnpjGuideEntry.findMany({
    where: {
      OR: [
        { cnpj: { in: allCnpjs } },
        ...(allCourierIds.length ? [{ courierId: { in: allCourierIds } }] : []),
      ],
    },
    select: { id: true, cnpj: true, courierId: true },
  });

  const guideByCnpj = new Map(existingGuideEntries.map((g) => [g.cnpj, g]));
  const guideByCourierId = new Map(
    existingGuideEntries.flatMap((g) => (g.courierId ? [[g.courierId, g] as const] : [])),
  );

  let importedEntries = 0;
  let linkedCouriers = 0;

  // 3. Process matches in-memory
  const guideUpserts: Array<{
    name: string;
    normalizedName: string;
    cnpj: string;
    courierId: string | null;
  }> = [];

  const courierUpdates: Array<{
    id: string;
    cnpj: string;
    sourceCnpjName: string;
    plaza: string | null;
  }> = [];

  const courierPlazaUpdates: Array<{
    uuid: string;
    plaza: string;
  }> = [];

  const guideCourierUnlinks: string[] = [];
  const assignedCourierIds = new Set<string>();

  for (const entry of parsedEntries) {
    let courier = entry.uuid ? courierByUuid.get(entry.uuid) ?? null : null;
    if (!courier) courier = courierByCnpj.get(entry.cnpj) ?? null;
    if (!courier) {
      const candidates = couriersByNormalizedName.get(entry.normalizedName) ?? [];
      if (candidates.length === 1) courier = candidates[0]!;
    }

    let targetCourierId = courier?.id ?? null;

    if (targetCourierId) {
      const owner = courierByCnpj.get(entry.cnpj);
      if (owner && owner.id !== targetCourierId) {
        targetCourierId = null;
      }
    }

    if (targetCourierId && assignedCourierIds.has(targetCourierId)) {
      targetCourierId = null;
    }

    if (targetCourierId) {
      assignedCourierIds.add(targetCourierId);
      const existingGuideForCourier = guideByCourierId.get(targetCourierId);
      if (existingGuideForCourier && existingGuideForCourier.cnpj !== entry.cnpj) {
        guideCourierUnlinks.push(existingGuideForCourier.id);
      }
    }

    guideUpserts.push({
      name: entry.name,
      normalizedName: entry.normalizedName,
      cnpj: entry.cnpj,
      courierId: targetCourierId,
    });

    if (targetCourierId && courier) {
      linkedCouriers += 1;
      courierUpdates.push({
        id: targetCourierId,
        cnpj: entry.cnpj,
        sourceCnpjName: entry.name,
        plaza: entry.region || courier.plaza,
      });
    } else if (entry.uuid && entry.region) {
      courierPlazaUpdates.push({
        uuid: entry.uuid,
        plaza: entry.region,
      });
    }

    importedEntries += 1;
  }

  // 4. Fast bulk database execution inside transaction with high timeout limit (60s)
  await db.$transaction(
    async (tx) => {
      // Clear conflicting courier links in CnpjGuideEntry if any
      if (guideCourierUnlinks.length) {
        await tx.cnpjGuideEntry.updateMany({
          where: { id: { in: guideCourierUnlinks } },
          data: { courierId: null },
        });
      }

      // Upsert CnpjGuideEntries in chunks
      const CHUNK_SIZE = 500;
      for (let i = 0; i < guideUpserts.length; i += CHUNK_SIZE) {
        const chunk = guideUpserts.slice(i, i + CHUNK_SIZE);
        for (const item of chunk) {
          await tx.cnpjGuideEntry.upsert({
            where: { cnpj: item.cnpj },
            create: {
              name: item.name,
              normalizedName: item.normalizedName,
              cnpj: item.cnpj,
              courierId: item.courierId,
              source: "PLANILHA_CNPJ",
            },
            update: {
              name: item.name,
              normalizedName: item.normalizedName,
              ...(item.courierId ? { courierId: item.courierId } : {}),
            },
          });
        }
      }

      // Update Couriers in chunks
      for (let i = 0; i < courierUpdates.length; i += CHUNK_SIZE) {
        const chunk = courierUpdates.slice(i, i + CHUNK_SIZE);
        for (const item of chunk) {
          await tx.courier.update({
            where: { id: item.id },
            data: {
              cnpj: item.cnpj,
              sourceCnpjName: item.sourceCnpjName,
              cnpjMatchStatus: MatchStatus.AUTO_MATCHED,
              cnpjMatchScore: 1,
              ...(item.plaza ? { plaza: item.plaza } : {}),
            },
          });
        }
      }

      // Update plaza for unmatched couriers by UUID
      for (const item of courierPlazaUpdates) {
        await tx.courier.updateMany({
          where: { externalCourierId: item.uuid },
          data: { plaza: item.plaza },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: adminUserId,
          action: "CNPJ_GUIDE_BULK_IMPORTED",
          entityType: "CnpjGuideEntry",
          metadata: {
            totalRows,
            importedEntries,
            linkedCouriers,
            invalidCnpjs,
            missingNames,
            sheetName: targetSheet.name,
          },
        },
      });
    },
    {
      maxWait: 20_000,
      timeout: 60_000,
    },
  );

  return {
    totalRows,
    importedEntries,
    linkedCouriers,
    invalidCnpjs,
    missingNames,
    sheetName: targetSheet.name,
  };
}
