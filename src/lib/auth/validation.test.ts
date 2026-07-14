import { describe, expect, it } from "vitest";
import { registerSchema } from "./validation";

const validRegistration = {
  cnpj: "11.222.333/0001-81",
  email: "Entregador@Exemplo.com",
  password: "entrego2026",
};

describe("registerSchema", () => {
  it("aceita cadastro sem codigo de ativacao", () => {
    const result = registerSchema.safeParse(validRegistration);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cnpj).toBe("11222333000181");
      expect(result.data.email).toBe("entregador@exemplo.com");
      expect(result.data.activationCode).toBeUndefined();
    }
  });

  it("mantem compatibilidade com formulario antigo que ainda envia o codigo", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      activationCode: "CODIGOANTIGO",
    });

    expect(result.success).toBe(true);
  });
});
