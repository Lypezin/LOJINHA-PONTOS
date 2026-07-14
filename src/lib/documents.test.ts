import { describe, expect, it } from "vitest";
import { digitsOnly, formatCnpj, isValidCnpj, maskDocument } from "@/lib/documents";

describe("documentos brasileiros", () => {
  it("valida e formata CNPJ", () => {
    expect(digitsOnly("11.222.333/0001-81")).toBe("11222333000181");
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("mascara o documento em saídas administrativas", () => {
    expect(maskDocument("11222333000181")).toBe("11••••••••••81");
    expect(maskDocument(null)).toBe("Não informado");
  });
});
