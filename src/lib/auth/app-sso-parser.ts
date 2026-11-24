import { createHmac, timingSafeEqual } from "node:crypto";
import { digitsOnly, isValidCnpj, isValidCpf } from "@/lib/documents";
import { normalizeEmail } from "@/lib/auth/identity";

export type AppSsoErrorCode =
  | "INVALID_TOKEN"
  | "EXPIRED_TOKEN"
  | "SIGNED_TOKEN_REQUIRED"
  | "INVALID_KEY"
  | "MISSING_IDENTIFIER"
  | "COURIER_INACTIVE"
  | "USER_INACTIVE"
  | "CITY_UNAVAILABLE";

export class AppSsoError extends Error {
  constructor(
    public readonly code: AppSsoErrorCode,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "AppSsoError";
  }
}

export type AppSsoInput = {
  externalCourierId: string | null;
  cnpj: string | null;
  cpf: string | null;
  name: string | null;
  email: string | null;
  city: string | null;
  next: string;
  signed: boolean;
};

type ParamMap = URLSearchParams | Record<string, string | string[] | undefined>;

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanAppParam(raw?: string | null): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower === "null" || lower === "undefined" || lower === "none" || lower === "(null)") {
    return null;
  }

  if (/^\{[^}]+\}$/.test(trimmed) || /^%7b.*%7d$/i.test(trimmed)) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(trimmed).trim();
    if (/^\{[^}]+\}$/.test(decoded)) return null;
  } catch {
    // Keep original trimmed value if URI decoding fails
  }

  return trimmed;
}

function getParam(params: ParamMap, keys: string[]): string | null {
  for (const key of keys) {
    const raw =
      params instanceof URLSearchParams
        ? params.get(key)
        : (() => {
            const value = params[key];
            return Array.isArray(value) ? value[0] : value;
          })();
    const cleaned = cleanAppParam(raw);
    if (cleaned) return cleaned;
  }
  return null;
}

function sanitizeNextPath(raw: string | null): string {
  if (!raw) return "/loja";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/loja";
  return raw;
}

function safeEqualStrings(a: string, b: string): boolean {
  const hashA = createHmac("sha256", "app-sso-compare").update(a).digest();
  const hashB = createHmac("sha256", "app-sso-compare").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

function decodeBase64UrlJson<T>(segment: string): T | null {
  try {
    const json = Buffer.from(segment, "base64url").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function asCleanString(value: unknown): string | null {
  return typeof value === "string" ? cleanAppParam(value) : null;
}

export function verifyAppSsoToken(
  token: string,
  secret: string,
  nowMs: number = Date.now(),
): Omit<AppSsoInput, "next" | "signed"> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AppSsoError("INVALID_TOKEN", "Token de acesso inválido.", 401);
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeBase64UrlJson<{ alg?: unknown; typ?: unknown }>(headerPart);
  if (!header || header.alg !== "HS256") {
    throw new AppSsoError("INVALID_TOKEN", "Algoritmo do token não suportado.", 401);
  }

  const expectedSig = createHmac("sha256", secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest();

  let providedSig: Buffer;
  try {
    providedSig = Buffer.from(signaturePart, "base64url");
  } catch {
    throw new AppSsoError("INVALID_TOKEN", "Assinatura do token inválida.", 401);
  }

  if (providedSig.length !== expectedSig.length || !timingSafeEqual(providedSig, expectedSig)) {
    throw new AppSsoError("INVALID_TOKEN", "Assinatura do token inválida.", 401);
  }

  const payload = decodeBase64UrlJson<Record<string, unknown>>(payloadPart);
  if (!payload || typeof payload !== "object") {
    throw new AppSsoError("INVALID_TOKEN", "Conteúdo do token inválido.", 401);
  }

  const nowSec = Math.floor(nowMs / 1000);
  if (payload.exp !== undefined) {
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      throw new AppSsoError("INVALID_TOKEN", "Expiração do token inválida.", 401);
    }
    if (nowSec - 30 > payload.exp) {
      throw new AppSsoError("EXPIRED_TOKEN", "Token de acesso expirado.", 401);
    }
  }

  if (payload.nbf !== undefined) {
    if (typeof payload.nbf !== "number" || !Number.isFinite(payload.nbf) || nowSec + 30 < payload.nbf) {
      throw new AppSsoError("INVALID_TOKEN", "Token ainda não está ativo.", 401);
    }
  }

  const rawId =
    asCleanString(payload.sub) ??
    asCleanString(payload.id) ??
    asCleanString(payload.uuid) ??
    asCleanString(payload.courierId) ??
    asCleanString(payload.externalCourierId);

  const rawCnpj = asCleanString(payload.cnpj);
  const rawCpf = asCleanString(payload.cpf);
  const rawName = asCleanString(payload.name) ?? asCleanString(payload.nome);
  const rawEmail = asCleanString(payload.email);
  const rawCity =
    asCleanString(payload.city) ??
    asCleanString(payload.cidade) ??
    asCleanString(payload.plaza);

  const cnpj = rawCnpj && isValidCnpj(rawCnpj) ? digitsOnly(rawCnpj) : null;
  const cpf = rawCpf && isValidCpf(rawCpf) ? digitsOnly(rawCpf) : null;
  const email =
    rawEmail && SIMPLE_EMAIL_PATTERN.test(rawEmail) && rawEmail.length <= 254
      ? normalizeEmail(rawEmail)
      : null;

  if (!rawId && !cnpj && !cpf) {
    throw new AppSsoError("MISSING_IDENTIFIER", "Identificador do entregador ausente no token.", 400);
  }

  return {
    externalCourierId: rawId?.slice(0, 128) ?? null,
    cnpj,
    cpf,
    name: rawName?.slice(0, 120) ?? null,
    email,
    city: rawCity?.slice(0, 120) ?? null,
  };
}

export function parseAppSsoRequest(
  params: ParamMap,
  env: NodeJS.ProcessEnv = process.env,
  nowMs: number = Date.now(),
): AppSsoInput {
  const next = sanitizeNextPath(getParam(params, ["next", "redirectTo"]));
  const token = getParam(params, ["token", "sso_token"]);

  if (token) {
    const secret = env.APP_SSO_SECRET?.trim();
    if (!secret) {
      throw new AppSsoError("INVALID_TOKEN", "Chave de validação SSO não configurada.", 500);
    }
    const verified = verifyAppSsoToken(token, secret, nowMs);
    return { ...verified, next, signed: true };
  }

  if (env.APP_SSO_REQUIRE_SIGNED === "true") {
    throw new AppSsoError("SIGNED_TOKEN_REQUIRED", "O acesso exige token assinado.", 401);
  }

  const configuredKey = env.APP_SSO_KEY?.trim();
  if (configuredKey) {
    const suppliedKey = getParam(params, ["key", "k"]);
    if (!suppliedKey || !safeEqualStrings(suppliedKey, configuredKey)) {
      throw new AppSsoError("INVALID_KEY", "Chave de integração do aplicativo inválida.", 401);
    }
  }

  const externalCourierId = getParam(params, ["id", "uuid", "externalId", "externalCourierId", "sub"]);
  const rawCnpj = getParam(params, ["cnpj"]);
  const rawCpf = getParam(params, ["cpf"]);
  const rawName = getParam(params, ["nome", "name"]);
  const rawEmail = getParam(params, ["email"]);
  const rawCity = getParam(params, ["cidade", "city", "plaza"]);

  const cnpj = rawCnpj && isValidCnpj(rawCnpj) ? digitsOnly(rawCnpj) : null;
  const cpf = rawCpf && isValidCpf(rawCpf) ? digitsOnly(rawCpf) : null;
  const email =
    rawEmail && SIMPLE_EMAIL_PATTERN.test(rawEmail) && rawEmail.length <= 254
      ? normalizeEmail(rawEmail)
      : null;

  if (!externalCourierId && !cnpj && !cpf) {
    throw new AppSsoError(
      "MISSING_IDENTIFIER",
      "Nenhum identificador válido (CPF, CNPJ ou ID) foi informado pelo aplicativo.",
      400,
    );
  }

  return {
    externalCourierId: externalCourierId?.slice(0, 128) ?? null,
    cnpj,
    cpf,
    name: rawName?.slice(0, 120) ?? null,
    email,
    city: rawCity?.slice(0, 120) ?? null,
    next,
    signed: false,
  };
}

export function hasAppSsoParams(params: ParamMap): boolean {
  return Boolean(
    getParam(params, ["token", "sso_token", "cpf", "cnpj", "id", "uuid", "externalId", "externalCourierId"]),
  );
}

export function buildAppSsoQueryString(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      search.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") search.append(key, item);
      }
    }
  }
  return search.toString();
}
