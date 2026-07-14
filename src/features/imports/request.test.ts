import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { validateXlsxArchive } from "@/features/imports/request";
import { DomainError } from "@/lib/domain-error";

async function validWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("BANCO DE DADOS").addRow(["valor"]);
  workbook.addWorksheet("DADOS CNPJ").addRow(["valor"]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("XLSX archive validation", () => {
  it("accepts a regular OOXML workbook", async () => {
    const buffer = await validWorkbook();
    expect(() => validateXlsxArchive(buffer)).not.toThrow();
  });

  it("rejects a truncated or disguised ZIP", () => {
    expect(() => validateXlsxArchive(Buffer.from("PK-not-a-workbook"))).toThrow(
      DomainError,
    );
  });
});
