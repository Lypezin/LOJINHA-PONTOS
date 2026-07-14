import { describe, expect, it } from "vitest";

import {
  columnLetterToIndex,
  indexToColumnLetter,
  isValidCnpj,
  nameSimilarity,
  normalizeHeader,
  normalizeName,
  parseNonNegativeInteger,
  repairTextEncoding,
} from "@/features/imports/normalization";

describe("import normalization", () => {
  it("normalizes names without losing meaningful tokens", () => {
    expect(normalizeName("  João d'Ávila & Silva  ")).toBe("JOAO D AVILA E SILVA");
    expect(normalizeHeader("Número de Pedidos Áceitos")).toBe(
      "numero_de_pedidos_aceitos",
    );
  });

  it("repara acentos que foram interpretados como Windows-1252", () => {
    expect(repairTextEncoding("Jo\u00c3\u00a3o Gon\u00c3\u00a7alves")).toBe("João Gonçalves");
    expect(repairTextEncoding("\u00c3\u201angela Matos")).toBe("Ângela Matos");
    expect(repairTextEncoding("São Paulo")).toBe("São Paulo");
  });

  it("converts Excel column letters in both directions", () => {
    expect(columnLetterToIndex("A")).toBe(0);
    expect(columnLetterToIndex("R")).toBe(17);
    expect(columnLetterToIndex("AA")).toBe(26);
    expect(indexToColumnLetter(17)).toBe("R");
    expect(indexToColumnLetter(26)).toBe("AA");
  });

  it("accepts only non-negative database-safe integers", () => {
    expect(parseNonNegativeInteger(12)).toBe(12);
    expect(parseNonNegativeInteger("12,0")).toBe(12);
    expect(parseNonNegativeInteger("+12")).toBe(12);
    expect(parseNonNegativeInteger(-1)).toBeNull();
    expect(parseNonNegativeInteger("1,5")).toBeNull();
    expect(parseNonNegativeInteger(2_147_483_648)).toBeNull();
  });

  it("validates CNPJ check digits and scores close names", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(nameSimilarity("Maria Aparecida Souza", "Maria Aparecida de Souza")).toBeGreaterThan(
      0.9,
    );
  });
});
