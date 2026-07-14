import { describe, expect, it } from "vitest";
import { digitsOnly, formatCnpj, formatCpf, isValidCnpj, isValidCpf, maskDocument } from "@/lib/documents";

describe("documentos brasileiros", () => {
  it("normaliza, valida e formata CPF", () => {
    expect(digitsOnly("529.982.247-25")).toBe("52998224725");
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
  });

  it("valida e formata CNPJ", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("mascara o documento em saídas administrativas", () => {
    expect(maskDocument("52998224725")).toBe("52•••••••25");
    expect(maskDocument(null)).toBe("Não informado");
  });
});
