import { describe, expect, it } from "vitest";
import { formatCpf, getPasswordError, isValidCpf, normalizeEmail } from "./identity";

describe("auth identity utilities", () => {
  it("normalizes e-mail and formats CPF without blocking partial input", () => {
    expect(normalizeEmail("  Entregador@Exemplo.COM ")).toBe("entregador@exemplo.com");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCpf("5299")).toBe("529.9");
  });

  it("validates CPF check digits and rejects repeated digits", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("529.982.247-24")).toBe(false);
  });

  it("requires a bounded password with letters and numbers", () => {
    expect(getPasswordError("entrego2026")).toBeNull();
    expect(getPasswordError("curta1")).toBeTruthy();
    expect(getPasswordError("somenteletras")).toBeTruthy();
  });
});
