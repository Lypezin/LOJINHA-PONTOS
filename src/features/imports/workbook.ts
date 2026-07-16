import { createHash } from "node:crypto";

import ExcelJS from "exceljs";

import { matchCouriersToCnpj } from "@/features/imports/matching";
import {
  columnLetterToIndex,
  indexToColumnLetter,
  isUuid,
  isValidCnpj,
  MAX_DATABASE_INT,
  normalizeHeader,
  normalizeName,
  normalizeUuid,
  onlyDigits,
  parseNonNegativeInteger,
  repairTextEncoding,
} from "@/features/imports/normalization";
import type {
  CnpjSourceEntry,
  CourierAggregate,
  ImportColumn,
  ImportIssue,
  ImportIssueCode,
  ImportIssueSeverity,
  ParsedImportWorkbook,
  ParseImportOptions,
} from "@/features/imports/types";

type CellValue = string | number | boolean | Date | null | undefined;
type Row = CellValue[];

const DATA_SHEET_NAME = "BANCO DE DADOS";
const CNPJ_SHEET_NAME = "DADOS CNPJ";
const DEFAULT_POINTS_COLUMN = "R";
const HEADER_SCAN_LIMIT = 50;
const MAX_DATA_ROWS = 200_000;
const MAX_CNPJ_ROWS = 100_000;
const MAX_WORKSHEET_COLUMNS = 256;

const DATA_ALIASES = {
  externalCourierId: ["id_da_pessoa_entregadora", "id_pessoa_entregadora", "uuid_entregador"],
  name: ["pessoa_entregadora", "nome_entregador", "entregador"],
  date: ["data_do_periodo", "data", "competencia"],
  plaza: ["praca", "praça"],
  subPlaza: ["sub_praca", "sub_praça"],
  tag: ["tag"],
  source: ["origem", "source"],
} as const;

const CNPJ_ALIASES = {
  name: ["entregador", "pessoa_entregadora", "nome_entregador"],
  cnpj: ["cnpj"],
} as const;

export class ImportWorkbookError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_WORKBOOK"
      | "MISSING_SHEET"
      | "HEADER_NOT_FOUND"
      | "COLUMN_NOT_FOUND",
  ) {
    super(message);
    this.name = "ImportWorkbookError";
  }
}

class IssueCollector {
  private readonly issues = new Map<
    string,
    ImportIssue & { count: number }
  >();

  add(
    code: ImportIssueCode,
    severity: ImportIssueSeverity,
    message: string,
    row?: number,
  ) {
    const key = `${severity}:${code}:${message}`;
    const existing = this.issues.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    this.issues.set(key, { code, severity, message, row, count: 1 });
  }

  all(): ImportIssue[] {
    return [...this.issues.values()].map(({ count, ...issue }) => ({
      ...issue,
      ...(count > 1 ? { count } : {}),
    }));
  }

  hasErrors(): boolean {
    return [...this.issues.values()].some((issue) => issue.severity === "error");
  }
}

function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function hashSourceKey(normalizedName: string, cnpj: string): string {
  return createHash("sha256")
    .update(`${normalizedName}\u0000${cnpj}`)
    .digest("hex");
}

function resolveSheet(workbook: ExcelJS.Workbook, expectedName: string): ExcelJS.Worksheet {
  const target = normalizeName(expectedName);
  const resolved = workbook.worksheets.find((sheet) => normalizeName(sheet.name) === target);
  if (!resolved) {
    throw new ImportWorkbookError(
      `A planilha precisa conter a guia ${expectedName}.`,
      "MISSING_SHEET",
    );
  }
  return resolved;
}

function findOptionalSheet(workbook: ExcelJS.Workbook, expectedName: string) {
  const target = normalizeName(expectedName);
  return workbook.worksheets.find((sheet) => normalizeName(sheet.name) === target) ?? null;
}

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

function normalizedAliases(values: readonly string[]): Set<string> {
  return new Set(values.map(normalizeHeader));
}

function findHeaderRow(
  rows: Row[],
  requiredAliases: readonly (readonly string[])[],
): number {
  let bestIndex = -1;
  let bestScore = 0;
  for (let index = 0; index < Math.min(rows.length, HEADER_SCAN_LIMIT); index += 1) {
    const headers = new Set((rows[index] ?? []).map(normalizeHeader).filter(Boolean));
    const score = requiredAliases.reduce(
      (total, aliases) =>
        total + ([...normalizedAliases(aliases)].some((alias) => headers.has(alias)) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestScore === requiredAliases.length ? bestIndex : -1;
}

function findColumnIndex(headers: Row, aliases: readonly string[]): number {
  const expected = normalizedAliases(aliases);
  return headers.findIndex((header) => expected.has(normalizeHeader(header)));
}

function rowIsEmpty(row: Row): boolean {
  return !row.some((value) => value !== null && value !== undefined && String(value).trim() !== "");
}

function inspectColumns(headers: Row, dataRows: Row[]): ImportColumn[] {
  return headers.map((headerValue, index) => {
    let nonEmptyCount = 0;
    let integerCount = 0;
    let invalidIntegerCount = 0;

    for (const row of dataRows) {
      const value = row[index];
      if (value === null || value === undefined || String(value).trim() === "") continue;
      nonEmptyCount += 1;
      if (parseNonNegativeInteger(value) === null) invalidIntegerCount += 1;
      else integerCount += 1;
    }

    const header = String(headerValue ?? "").trim() || `Coluna ${indexToColumnLetter(index)}`;
    return {
      index,
      position: index + 1,
      letter: indexToColumnLetter(index),
      header,
      normalizedHeader: normalizeHeader(header),
      nonEmptyCount,
      integerCount,
      invalidIntegerCount,
      canBePoints: nonEmptyCount > 0 && invalidIntegerCount === 0,
    };
  });
}

function resolvePointsColumn(
  columns: ImportColumn[],
  selector: string | number | null | undefined,
): ImportColumn {
  const selected = selector ?? DEFAULT_POINTS_COLUMN;
  let index: number | null = null;

  if (typeof selected === "number") {
    index = Number.isInteger(selected) ? selected : null;
  } else {
    const text = selected.trim();
    const byHeader = columns.find(
      (column) => column.normalizedHeader === normalizeHeader(text),
    );
    if (byHeader) return byHeader;
    if (/^\d+$/.test(text)) index = Number(text);
    else index = columnLetterToIndex(text);
  }

  const column = index === null ? undefined : columns[index];
  if (!column) {
    throw new ImportWorkbookError(
      "A coluna de pontos selecionada não existe na guia BANCO DE DADOS.",
      "COLUMN_NOT_FOUND",
    );
  }
  return column;
}

function parseDateKey(value: CellValue): string | null {
  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    year = value.getUTCFullYear();
    month = value.getUTCMonth() + 1;
    day = value.getUTCDate();
  } else if (typeof value === "number") {
    // Excel's serial date epoch includes the historical 1900 leap-year bug.
    const parsed = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    if (!Number.isNaN(parsed.getTime())) {
      year = parsed.getUTCFullYear();
      month = parsed.getUTCMonth() + 1;
      day = parsed.getUTCDate();
    }
  } else if (typeof value === "string") {
    const text = value.trim();
    const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
    const brazilian = /^(\d{1,2})[/.](\d{1,2})[/.](\d{2}|\d{4})$/.exec(text);
    if (iso) {
      year = Number(iso[1]);
      month = Number(iso[2]);
      day = Number(iso[3]);
    } else if (brazilian) {
      year = Number(brazilian[3]);
      if (year < 100) year += 2000;
      month = Number(brazilian[2]);
      day = Number(brazilian[1]);
    }
  }

  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function mode(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return (
    [...counts.entries()].sort(
      ([leftValue, leftCount], [rightValue, rightCount]) =>
        rightCount - leftCount || leftValue.localeCompare(rightValue, "pt-BR"),
    )[0]?.[0] ?? null
  );
}

interface MutableAggregate {
  externalCourierId: string;
  names: string[];
  points: number;
  dailyPoints: Map<string, number>;
  sourceRowCount: number;
  firstSourceRow: number;
  plazas: string[];
  subPlazas: string[];
  tags: string[];
  sources: string[];
}

function textCell(value: CellValue): string {
  return repairTextEncoding(value).trim();
}

function countMatches(matches: ParsedImportWorkbook["cnpjMatches"]) {
  const counts = { exact: 0, fuzzy: 0, ambiguous: 0, notFound: 0 };
  for (const match of matches.values()) {
    if (match.kind === "EXACT") counts.exact += 1;
    else if (match.kind === "FUZZY") counts.fuzzy += 1;
    else if (match.kind === "AMBIGUOUS") counts.ambiguous += 1;
    else counts.notFound += 1;
  }
  return counts;
}

export function getCnpjMatchCounts(parsed: ParsedImportWorkbook) {
  return countMatches(parsed.cnpjMatches);
}

export async function parseImportWorkbook(
  buffer: Buffer,
  options: ParseImportOptions,
): Promise<ParsedImportWorkbook> {
  const workbook = new ExcelJS.Workbook();
  try {
    const workbookBytes = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(workbookBytes).set(buffer);
    await workbook.xlsx.load(workbookBytes);
  } catch {
    throw new ImportWorkbookError(
      "Não foi possível ler o arquivo. Envie uma planilha .xlsx válida.",
      "INVALID_WORKBOOK",
    );
  }

  const dataWorksheet = resolveSheet(workbook, DATA_SHEET_NAME);
  const cnpjWorksheet = findOptionalSheet(workbook, CNPJ_SHEET_NAME);
  if (
    dataWorksheet.rowCount > MAX_DATA_ROWS ||
    (cnpjWorksheet?.rowCount ?? 0) > MAX_CNPJ_ROWS ||
    dataWorksheet.columnCount > MAX_WORKSHEET_COLUMNS ||
    (cnpjWorksheet?.columnCount ?? 0) > MAX_WORKSHEET_COLUMNS
  ) {
    throw new ImportWorkbookError(
      "A planilha excede o limite de linhas ou colunas permitido para importação.",
      "INVALID_WORKBOOK",
    );
  }
  const dataRows = sheetRows(dataWorksheet);
  const cnpjRows = cnpjWorksheet ? sheetRows(cnpjWorksheet) : [];

  const dataHeaderIndex = findHeaderRow(dataRows, [
    DATA_ALIASES.externalCourierId,
    DATA_ALIASES.name,
  ]);
  const cnpjHeaderIndex = cnpjWorksheet
    ? findHeaderRow(cnpjRows, [CNPJ_ALIASES.name, CNPJ_ALIASES.cnpj])
    : -1;
  if (dataHeaderIndex < 0) {
    throw new ImportWorkbookError(
      "Não foi possível detectar os cabeçalhos de entregador na guia BANCO DE DADOS.",
      "HEADER_NOT_FOUND",
    );
  }
  if (cnpjWorksheet && cnpjHeaderIndex < 0) {
    throw new ImportWorkbookError(
      "Não foi possível detectar os cabeçalhos ENTREGADOR e CNPJ na guia DADOS CNPJ.",
      "HEADER_NOT_FOUND",
    );
  }

  const dataHeaders = dataRows[dataHeaderIndex];
  const nonEmptyDataRows = dataRows.slice(dataHeaderIndex + 1).filter((row) => !rowIsEmpty(row));
  const columns = inspectColumns(dataHeaders, nonEmptyDataRows);
  const pointsColumn = resolvePointsColumn(columns, options.pointsColumn);
  const idIndex = findColumnIndex(dataHeaders, DATA_ALIASES.externalCourierId);
  const nameIndex = findColumnIndex(dataHeaders, DATA_ALIASES.name);
  const dateIndex = findColumnIndex(dataHeaders, DATA_ALIASES.date);
  const plazaIndex = findColumnIndex(dataHeaders, DATA_ALIASES.plaza);
  const subPlazaIndex = findColumnIndex(dataHeaders, DATA_ALIASES.subPlaza);
  const tagIndex = findColumnIndex(dataHeaders, DATA_ALIASES.tag);
  const sourceIndex = findColumnIndex(dataHeaders, DATA_ALIASES.source);
  const issues = new IssueCollector();
  const mutableAggregates = new Map<string, MutableAggregate>();
  const detectedPeriods = new Set<string>();
  let validRowCount = 0;

  if (dateIndex < 0) {
    issues.add(
      "INVALID_DATE",
      "error",
      "A coluna de data da competência não foi encontrada.",
    );
  }
  if (!pointsColumn.canBePoints) {
    issues.add(
      "INVALID_POINTS",
      "error",
      "A coluna selecionada contém valores vazios, negativos, decimais ou não numéricos.",
    );
  }

  for (let offset = dataHeaderIndex + 1; offset < dataRows.length; offset += 1) {
    const row = dataRows[offset] ?? [];
    if (rowIsEmpty(row)) continue;
    const sourceRow = offset + 1;
    const externalCourierId = normalizeUuid(row[idIndex]);
    const name = textCell(row[nameIndex]);
    const points = parseNonNegativeInteger(row[pointsColumn.index]);
    const dateKey = dateIndex >= 0 ? parseDateKey(row[dateIndex]) : null;
    const periodKey = dateKey?.slice(0, 7) ?? null;

    let valid = true;
    if (!isUuid(externalCourierId)) {
      issues.add("INVALID_UUID", "error", "Há linhas sem um UUID de entregador válido.", sourceRow);
      valid = false;
    }
    if (!normalizeName(name)) {
      issues.add("MISSING_NAME", "error", "Há linhas sem nome de entregador.", sourceRow);
      valid = false;
    }
    if (points === null) {
      issues.add(
        "INVALID_POINTS",
        "error",
        "Há valores de pontos vazios, negativos, decimais ou não numéricos.",
        sourceRow,
      );
      valid = false;
    }
    if (!periodKey) {
      issues.add("INVALID_DATE", "error", "Há linhas sem uma data válida.", sourceRow);
      valid = false;
    } else {
      detectedPeriods.add(periodKey);
    }
    if (!valid || points === null) continue;

    validRowCount += 1;
    const aggregate = mutableAggregates.get(externalCourierId) ?? {
      externalCourierId,
      names: [],
      points: 0,
      dailyPoints: new Map<string, number>(),
      sourceRowCount: 0,
      firstSourceRow: sourceRow,
      plazas: [],
      subPlazas: [],
      tags: [],
      sources: [],
    };
    aggregate.names.push(name);
    aggregate.points += points;
    aggregate.dailyPoints.set(dateKey!, (aggregate.dailyPoints.get(dateKey!) ?? 0) + points);
    aggregate.sourceRowCount += 1;
    if (!Number.isSafeInteger(aggregate.points) || aggregate.points > MAX_DATABASE_INT) {
      issues.add(
        "UNSAFE_POINTS_TOTAL",
        "error",
        "A soma de pontos excedeu o limite seguro.",
        sourceRow,
      );
    }
    if (plazaIndex >= 0) aggregate.plazas.push(textCell(row[plazaIndex]));
    if (subPlazaIndex >= 0) aggregate.subPlazas.push(textCell(row[subPlazaIndex]));
    if (tagIndex >= 0) aggregate.tags.push(textCell(row[tagIndex]));
    if (sourceIndex >= 0) aggregate.sources.push(textCell(row[sourceIndex]));
    mutableAggregates.set(externalCourierId, aggregate);
  }

  const aggregates: CourierAggregate[] = [...mutableAggregates.values()].map((aggregate) => {
    const chosenName = mode(aggregate.names) ?? aggregate.names[0];
    const distinctNames = new Set(aggregate.names.map(normalizeName));
    const warnings: ImportIssue[] = [];
    if (distinctNames.size > 1) {
      const warning: ImportIssue = {
        code: "CONFLICTING_COURIER_DATA",
        severity: "warning",
        message: "O mesmo UUID aparece com mais de um nome; foi usado o nome mais frequente.",
        row: aggregate.firstSourceRow,
      };
      warnings.push(warning);
      issues.add(warning.code, warning.severity, warning.message, warning.row);
    }
    return {
      externalCourierId: aggregate.externalCourierId,
      name: chosenName,
      normalizedName: normalizeName(chosenName),
      points: aggregate.points,
      dailyPoints: [...aggregate.dailyPoints.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, dailyTotal]) => ({ date, points: dailyTotal })),
      sourceRowCount: aggregate.sourceRowCount,
      firstSourceRow: aggregate.firstSourceRow,
      plaza: mode(aggregate.plazas),
      subPlaza: mode(aggregate.subPlazas),
      tag: mode(aggregate.tags),
      source: mode(aggregate.sources),
      warnings,
    };
  });

  let totalPoints = 0;
  for (const aggregate of aggregates) {
    totalPoints += aggregate.points;
    if (!Number.isSafeInteger(totalPoints) || totalPoints > MAX_DATABASE_INT) {
      issues.add("UNSAFE_POINTS_TOTAL", "error", "A soma total de pontos excedeu o limite seguro.");
      break;
    }
  }

  const cnpjNameIndex = cnpjHeaderIndex >= 0
    ? findColumnIndex(cnpjRows[cnpjHeaderIndex], CNPJ_ALIASES.name)
    : -1;
  const cnpjValueIndex = cnpjHeaderIndex >= 0
    ? findColumnIndex(cnpjRows[cnpjHeaderIndex], CNPJ_ALIASES.cnpj)
    : -1;
  const cnpjBySourceKey = new Map<string, CnpjSourceEntry>();
  for (let offset = Math.max(0, cnpjHeaderIndex + 1); offset < cnpjRows.length; offset += 1) {
    const row = cnpjRows[offset] ?? [];
    if (rowIsEmpty(row)) continue;
    const sourceRow = offset + 1;
    const sourceName = textCell(row[cnpjNameIndex]);
    const normalizedName = normalizeName(sourceName);
    const cnpj = onlyDigits(row[cnpjValueIndex]);
    if (!normalizedName) {
      issues.add(
        "MISSING_CNPJ_NAME",
        "warning",
        "Há registros de CNPJ sem nome; eles foram ignorados.",
        sourceRow,
      );
      continue;
    }
    if (!isValidCnpj(cnpj)) {
      issues.add(
        "INVALID_CNPJ",
        "warning",
        "Há documentos inválidos na guia DADOS CNPJ; eles foram ignorados.",
        sourceRow,
      );
      continue;
    }
    const sourceKey = hashSourceKey(normalizedName, cnpj);
    if (!cnpjBySourceKey.has(sourceKey)) {
      cnpjBySourceKey.set(sourceKey, {
        sourceName,
        normalizedName,
        cnpj,
        sourceRow,
        sourceKey,
      });
    }
  }
  for (const entry of options.guideEntries ?? []) {
    if (!cnpjBySourceKey.has(entry.sourceKey)) cnpjBySourceKey.set(entry.sourceKey, entry);
  }
  const cnpjEntries = [...cnpjBySourceKey.values()];
  const cnpjMatches = matchCouriersToCnpj(aggregates, cnpjEntries);
  const matchCounts = countMatches(cnpjMatches);
  for (let index = 0; index < matchCounts.ambiguous; index += 1) {
    issues.add(
      "CNPJ_AMBIGUOUS",
      "warning",
      "Há entregadores com mais de uma correspondência possível de CNPJ; a decisão ficou pendente.",
    );
  }
  for (let index = 0; index < matchCounts.fuzzy; index += 1) {
    issues.add(
      "CNPJ_AMBIGUOUS",
      "warning",
      "Há sugestões aproximadas de CNPJ aguardando confirmação manual.",
    );
  }
  for (let index = 0; index < matchCounts.notFound; index += 1) {
    issues.add(
      "CNPJ_NOT_FOUND",
      "warning",
      "Há entregadores sem correspondência de CNPJ; o vínculo ficou pendente.",
    );
  }

  const detectedPeriodKeys = [...detectedPeriods].sort();
  const requestedPeriod = options.periodKey?.trim() || null;
  const selectedPeriodKey = requestedPeriod ??
    (detectedPeriodKeys.length === 1 ? detectedPeriodKeys[0] : null);

  if (requestedPeriod && !/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedPeriod)) {
    issues.add(
      "PERIOD_MISMATCH",
      "error",
      "A competência deve estar no formato AAAA-MM.",
    );
  }
  if (detectedPeriodKeys.length > 1) {
    issues.add(
      "MULTIPLE_PERIODS",
      "error",
      "A guia BANCO DE DADOS contém dados de mais de uma competência.",
    );
  }
  if (
    selectedPeriodKey &&
    detectedPeriodKeys.length > 0 &&
    detectedPeriodKeys.some((period) => period !== selectedPeriodKey)
  ) {
    issues.add(
      "PERIOD_MISMATCH",
      "error",
      "A competência selecionada não corresponde às datas da planilha.",
    );
  }
  if (!selectedPeriodKey) {
    issues.add(
      "PERIOD_MISMATCH",
      "error",
      "Não foi possível definir uma única competência para a importação.",
    );
  }

  const allIssues = issues.all();
  return {
    filename: options.filename,
    fileHash: hashBuffer(buffer),
    dataSheet: dataWorksheet.name,
    cnpjSheet: cnpjWorksheet?.name ?? "Guia interna de CNPJ",
    dataHeaderRow: dataHeaderIndex + 1,
    cnpjHeaderRow: cnpjHeaderIndex >= 0 ? cnpjHeaderIndex + 1 : 0,
    columns,
    pointsColumn,
    rowCount: validRowCount,
    aggregates,
    cnpjEntries,
    cnpjMatches,
    detectedPeriodKeys,
    selectedPeriodKey,
    totalPoints,
    issues: allIssues,
    canCommit: !issues.hasErrors() && Boolean(selectedPeriodKey),
  };
}
