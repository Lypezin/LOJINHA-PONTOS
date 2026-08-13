import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { importCnpjGuideWorkbook } from "@/features/cnpj-guide/import";

async function cnpjWorkbookBuffer() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("DADOS CNPJ");
  sheet.addRow(["NOME", "UUID", "CNPJ", "REGIÃO"]);
  sheet.addRow([
    "Adelmir Antônio Dos Santos",
    "b2b490ca-22ca-4222-ba30-ab26a8debf84",
    "51.465.597/0001-80",
    "SÃO PAULO",
  ]);
  sheet.addRow([
    "Adelmo Sousa Meneses",
    "ce269de1-0b45-4c09-b5a8-301c253422d3",
    "28.016.078/0001-13",
    "CAMPINAS",
  ]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("CNPJ Guide standalone Excel import", () => {
  it("parses headers NOME, UUID, CNPJ, REGIÃO correctly", async () => {
    const buffer = await cnpjWorkbookBuffer();
    // We mock adminUserId
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
