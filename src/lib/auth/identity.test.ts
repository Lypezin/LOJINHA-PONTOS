import { describe, expect, it } from "vitest";
import { cnpjStorageCandidates, formatCnpj, getPasswordError, isValidCnpj, normalizeCnpj, normalizeEmail } from "./identity";

describe("auth identity utilities", () => {
  it("normalizes e-mail and formats CNPJ without blocking partial input", () => {
    expect(normalizeEmail("  Entregador@Exemplo.COM ")).toBe("entregador@exemplo.com");
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCnpj("1122")).toBe("11.22");
    expect(formatCnpj("1122233300018")).toBe("11.222.333/0001-8");
  });

  it("validates CNPJ check digits and rejects repeated digits", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.111.111/1111-11")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
  });

  it("normalizes CNPJ and accepts normalized or formatted storage", () => {
    expect(normalizeCnpj("11.222.333/0001-81")).toBe("11222333000181");
    expect(cnpjStorageCandidates("11.222.333/0001-81")).toEqual([
      "11222333000181",
      "11.222.333/0001-81",
    ]);
  });

  it("requires a bounded password with letters and numbers", () => {
    expect(getPasswordError("entrego2026")).toBeNull();
    expect(getPasswordError("curta1")).toBeTruthy();
    expect(getPasswordError("somenteletras")).toBeTruthy();
  });
});
