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
  } catch {
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

  let importedEntries = 0;
  let linkedCouriers = 0;

  await db.$transaction(
    async (tx) => {
      const CHUNK_SIZE = 500;
      for (let i = 0; i < parsedEntries.length; i += CHUNK_SIZE) {
        const chunk = parsedEntries.slice(i, i + CHUNK_SIZE);

        for (const entry of chunk) {
          let courier = entry.uuid
            ? await tx.courier.findUnique({ where: { externalCourierId: entry.uuid } })
            : null;

          if (!courier) {
            courier = await tx.courier.findUnique({ where: { cnpj: entry.cnpj } });
          }

          if (!courier) {
            const matches = await tx.courier.findMany({
              where: { normalizedName: entry.normalizedName, status: { not: "INACTIVE" } },
            });
            if (matches.length === 1) {
              courier = matches[0]!;
            }
          }

          const courierId = courier?.id ?? null;

          await tx.cnpjGuideEntry.upsert({
            where: { cnpj: entry.cnpj },
            create: {
              name: entry.name,
              normalizedName: entry.normalizedName,
              cnpj: entry.cnpj,
              courierId,
              source: "PLANILHA_CNPJ",
            },
            update: {
              name: entry.name,
              normalizedName: entry.normalizedName,
              ...(courierId ? { courierId } : {}),
            },
          });

          if (courierId) {
            linkedCouriers += 1;
            await tx.courier.update({
              where: { id: courierId },
              data: {
                cnpj: entry.cnpj,
                sourceCnpjName: entry.name,
                cnpjMatchStatus: MatchStatus.AUTO_MATCHED,
                cnpjMatchScore: 1,
                ...(entry.region && !courier?.plaza ? { plaza: entry.region } : {}),
              },
            });
          } else if (entry.uuid) {
            await tx.courier.updateMany({
              where: { externalCourierId: entry.uuid },
              data: {
                ...(entry.region ? { plaza: entry.region } : {}),
              },
            });
          }

          importedEntries += 1;
        }
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
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
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
