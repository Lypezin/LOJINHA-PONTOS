import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AppSsoError,
  cleanAppParam,
  hasAppSsoParams,
  parseAppSsoRequest,
  verifyAppSsoToken,
} from "./app-sso-parser";

function signHs256(payload: Record<string, unknown>, secret: string) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

describe("app SSO parser & JWT verifier", () => {
  const secret = "super-secret-entrego-test-key";

  it("limpa placeholders não substituídos pelo aplicativo", () => {
    expect(cleanAppParam("{CPF}")).toBeNull();
    expect(cleanAppParam("%7BCIDADE%7D")).toBeNull();
    expect(cleanAppParam("null")).toBeNull();
    expect(cleanAppParam("undefined")).toBeNull();
    expect(cleanAppParam("  ")).toBeNull();
    expect(cleanAppParam(" 529.982.247-25 ")).toBe("529.982.247-25");
  });

  it("detecta presença de parâmetros válidos de SSO", () => {
    expect(hasAppSsoParams({ cpf: "{CPF}", cidade: "{CIDADE}" })).toBe(false);
    expect(hasAppSsoParams({ cpf: "52998224725", cidade: "SAO PAULO" })).toBe(true);
    expect(hasAppSsoParams({ token: "abc.def.ghi" })).toBe(true);
    expect(hasAppSsoParams({ id: "uuid-123" })).toBe(true);
  });

  it("valida token JWT HS256 e extrai campos em português/inglês", () => {
    const now = 1_800_000_000_000;
    const token = signHs256(
      {
        sub: "courier-uuid-1",
        cpf: "529.982.247-25",
        cnpj: "11.222.333/0001-81",
        nome: "João Entregador",
        email: "JOAO@Entrego.com.br",
        cidade: "São Paulo",
        exp: Math.floor(now / 1000) + 120,
      },
      secret,
    );

    const parsed = verifyAppSsoToken(token, secret, now);
    expect(parsed).toEqual({
      externalCourierId: "courier-uuid-1",
      cpf: "52998224725",
      cnpj: "11222333000181",
      name: "João Entregador",
      email: "joao@entrego.com.br",
      city: "São Paulo",
    });
  });

  it("rejeita token expirado ou com assinatura adulterada", () => {
    const now = 1_800_000_000_000;
    const expiredToken = signHs256({ sub: "123", exp: Math.floor(now / 1000) - 60 }, secret);
    expect(() => verifyAppSsoToken(expiredToken, secret, now)).toThrowError(AppSsoError);

    const validToken = signHs256({ sub: "123", exp: Math.floor(now / 1000) + 60 }, secret);
    const tampered = `${validToken.slice(0, -4)}xxxx`;
    expect(() => verifyAppSsoToken(tampered, secret, now)).toThrowError(AppSsoError);
  });

  it("faz parse de parâmetros diretos de URL do app e exige chave quando configurada", () => {
    const params = new URLSearchParams({
      cpf: "529.982.247-25",
      cnpj: "{CNPJ}",
      nome: "Carlos Silva",
      cidade: "São Paulo",
    });

    const parsed = parseAppSsoRequest(params, {} as NodeJS.ProcessEnv);
    expect(parsed).toEqual({
      externalCourierId: null,
      cpf: "52998224725",
      cnpj: null,
      name: "Carlos Silva",
      email: null,
      city: "São Paulo",
      next: "/loja",
      signed: false,
    });

    expect(() =>
      parseAppSsoRequest(params, { APP_SSO_KEY: "segredo-app" } as unknown as NodeJS.ProcessEnv),
    ).toThrowError(AppSsoError);

    params.set("key", "segredo-app");
    const parsedWithKey = parseAppSsoRequest(
      params,
      { APP_SSO_KEY: "segredo-app" } as unknown as NodeJS.ProcessEnv,
    );
    expect(parsedWithKey.cpf).toBe("52998224725");
  });
});
