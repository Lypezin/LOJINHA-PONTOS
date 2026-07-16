import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { parseImportWorkbook } from "@/features/imports/workbook";

const FIRST_ID = "047138f9-4004-4a4a-a54c-1cdef7f17922";
const SECOND_ID = "147138f9-4004-4a4a-a54c-1cdef7f17923";

function dataRow(date: Date, id: string, name: string, points: number | string) {
  const values = new Array<unknown>(18).fill(null);
  values[0] = date;
  values[5] = id;
  values[6] = name;
  values[7] = "SÃO PAULO";
  values[17] = points;
  return values;
}

async function workbookBuffer(invalidPoints = false, includeCnpjSheet = true) {
  const workbook = new ExcelJS.Workbook();
  const data = workbook.addWorksheet("BANCO DE DADOS");
  data.addRow(["Relatório mensal"]);
  const headers = new Array<string>(18).fill("");
  headers[0] = "data_do_periodo";
  headers[5] = "id_da_pessoa_entregadora";
  headers[6] = "pessoa_entregadora";
  headers[7] = "praca";
  headers[17] = "numero_de_pedidos_aceitos_e_concluidos";
  data.addRow(headers);
  data.addRow(dataRow(new Date("2026-07-01T12:00:00Z"), FIRST_ID, "João da Silva", 4));
  data.addRow(
    dataRow(
      new Date("2026-07-02T12:00:00Z"),
      FIRST_ID,
      "JOAO DA SILVA",
      invalidPoints ? -1 : 6,
    ),
  );
  data.addRow(dataRow(new Date("2026-07-03T12:00:00Z"), SECOND_ID, "Maria Souza", 3));

  if (includeCnpjSheet) {
    const cnpj = workbook.addWorksheet("DADOS CNPJ");
    cnpj.addRow(["Dados cadastrais"]);
    cnpj.addRow(["ENTREGADOR", "CNPJ"]);
    cnpj.addRow(["João da Silva", "11.222.333/0001-81"]);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("Excel import aggregation", () => {
  it("detects shifted headers, defaults to column R and aggregates rows by UUID", async () => {
    const parsed = await parseImportWorkbook(await workbookBuffer(), {
      filename: "entregadores.xlsx",
      periodKey: "2026-07",
    });

    expect(parsed.dataHeaderRow).toBe(2);
    expect(parsed.cnpjHeaderRow).toBe(2);
    expect(parsed.pointsColumn.letter).toBe("R");
    expect(parsed.pointsColumn.index).toBe(17);
    expect(parsed.pointsColumn.position).toBe(18);
    expect(parsed.rowCount).toBe(3);
    expect(parsed.aggregates).toHaveLength(2);
    expect(parsed.totalPoints).toBe(13);
    expect(parsed.aggregates.find((item) => item.externalCourierId === FIRST_ID)?.points).toBe(10);
    expect(parsed.aggregates.find((item) => item.externalCourierId === FIRST_ID)?.dailyPoints).toEqual([
      { date: "2026-07-01", points: 4 },
      { date: "2026-07-02", points: 6 },
    ]);
    expect(parsed.detectedPeriodKeys).toEqual(["2026-07"]);
    expect(parsed.cnpjMatches.get(FIRST_ID)?.kind).toBe("EXACT");
    expect(parsed.cnpjMatches.get(SECOND_ID)?.kind).toBe("NOT_FOUND");
    expect(parsed.canCommit).toBe(true);
  });

  it("blocks a commit when a points cell is negative", async () => {
    const parsed = await parseImportWorkbook(await workbookBuffer(true), {
      filename: "entregadores.xlsx",
      periodKey: "2026-07",
    });

    expect(parsed.canCommit).toBe(false);
    expect(parsed.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_POINTS", severity: "error" }),
      ]),
    );
  });

  it("uses the internal CNPJ guide when the workbook has only BANCO DE DADOS", async () => {
    const parsed = await parseImportWorkbook(await workbookBuffer(false, false), {
      filename: "entregadores.xlsx",
      periodKey: "2026-07",
      guideEntries: [{
        sourceName: "João da Silva",
        normalizedName: "joao da silva",
        cnpj: "11222333000181",
        sourceRow: 0,
        sourceKey: "guide:test",
      }],
    });

    expect(parsed.cnpjSheet).toBe("Guia interna de CNPJ");
    expect(parsed.cnpjHeaderRow).toBe(0);
    expect(["EXACT", "FUZZY"]).toContain(parsed.cnpjMatches.get(FIRST_ID)?.kind);
    expect(parsed.cnpjMatches.get(FIRST_ID)?.cnpj).toBe("11222333000181");
    expect(parsed.canCommit).toBe(true);
  });
});
