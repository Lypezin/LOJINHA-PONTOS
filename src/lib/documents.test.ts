import { describe, expect, it } from "vitest";
import { digitsOnly, formatCnpj, formatCpf, isValidCnpj, isValidCpf, maskDocument } from "@/lib/documents";

describe("documentos brasileiros", () => {
  it("valida e formata CNPJ", () => {
    expect(digitsOnly("11.222.333/0001-81")).toBe("11222333000181");
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("valida e formata CPF", () => {
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("52998224724")).toBe(false);
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
  });

  it("mascara o documento em saídas administrativas", () => {
    expect(maskDocument("11222333000181")).toBe("11••••••••••81");
    expect(maskDocument(null)).toBe("Não informado");
  });
});
