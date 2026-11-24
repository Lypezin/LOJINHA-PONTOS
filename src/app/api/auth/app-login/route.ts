import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditLog, hashForAudit } from "@/lib/auth/audit";
import {
  AppSsoError,
  parseAppSsoRequest,
  resolveAndProvisionAppCourier,
} from "@/lib/auth/app-sso";
import { parseJsonBody, secureJson } from "@/lib/auth/http";
import { AUTH_RATE_LIMITS, consumeAuthRateLimit, rateLimitResponse } from "@/lib/auth/rate-limit";
import {
  cookieIsSecure,
  createSession,
  sessionCookieSameSite,
  sessionDurationMs,
} from "@/lib/auth/session";
import { describeDatabaseError } from "@/lib/db";

const EMBEDDED_COOKIE_NAME = "lojinha_embedded";

function resolveRedirectUrl(path: string, request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();

  if (host) {
    const requestUrl = new URL(request.url);
    const protocol = forwardedProto || requestUrl.protocol.replace(":", "") || "https";
    return new URL(path, `${protocol}://${host}`);
  }

  return new URL(path, request.url);
}

function redirectWithNoStore(path: string, request: Request) {
  const response = NextResponse.redirect(resolveRedirectUrl(path, request), { status: 302 });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function applyEmbeddedCookie(response: NextResponse) {
  const maxAge = Math.floor(sessionDurationMs() / 1000);
  response.cookies.set(EMBEDDED_COOKIE_NAME, "1", {
    httpOnly: false,
    secure: cookieIsSecure(),
    sameSite: sessionCookieSameSite(),
    path: "/",
    maxAge,
  });
}

function errorRedirectPath(error: unknown) {
  if (error instanceof AppSsoError) {
    if (error.code === "CITY_UNAVAILABLE") return "/login?cidade=indisponivel";
    if (error.code === "COURIER_INACTIVE" || error.code === "USER_INACTIVE") return "/login?erro=inativo";
  }
  return "/login?erro=sso";
}

function rateScopeFromParams(params: URLSearchParams) {
  return (
    params.get("cpf") ||
    params.get("cnpj") ||
    params.get("id") ||
    params.get("uuid") ||
    params.get("token")?.slice(0, 24) ||
    "anonymous"
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = rateScopeFromParams(url.searchParams);

  try {
    const limit = await consumeAuthRateLimit(request, "app-sso", scope, AUTH_RATE_LIMITS.appSso);
    if (!limit.allowed) {
      return redirectWithNoStore("/login?erro=sso", request);
    }

    const input = parseAppSsoRequest(url.searchParams);
    const result = await resolveAndProvisionAppCourier(input);

    await createSession(result.userId, request);

    await writeAuditLog({
      request,
      action: result.provisioned ? "auth.app_sso_provisioned" : "auth.app_sso_login",
      entityType: "User",
      entityId: result.userId,
      actorUserId: result.userId,
      metadata: {
        courierId: result.courierId,
        signed: input.signed,
        hasCpf: Boolean(input.cpf),
        hasCnpj: Boolean(input.cnpj),
        hasExternalId: Boolean(input.externalCourierId),
      },
    });

    const response = redirectWithNoStore(input.next, request);
    applyEmbeddedCookie(response);
    return response;
  } catch (error) {
    const reason = error instanceof AppSsoError ? error.code : "INTERNAL";
    if (!(error instanceof AppSsoError)) {
      console.error("[auth:app-login] Falha interna no login automático.", describeDatabaseError(error));
    }

    await writeAuditLog({
      request,
      action: "auth.app_sso_denied",
      entityType: "Auth",
      metadata: {
        reason,
        scopeHash: hashForAudit(scope),
      },
    }).catch(() => undefined);

    return redirectWithNoStore(errorRedirectPath(error), request);
  }
}

const postAppSsoSchema = z
  .object({
    token: z.string().optional(),
    sso_token: z.string().optional(),
    key: z.string().optional(),
    k: z.string().optional(),
    id: z.string().optional(),
    uuid: z.string().optional(),
    externalId: z.string().optional(),
    externalCourierId: z.string().optional(),
    cnpj: z.string().optional(),
    cpf: z.string().optional(),
    nome: z.string().optional(),
    name: z.string().optional(),
    email: z.string().optional(),
    cidade: z.string().optional(),
    city: z.string().optional(),
    plaza: z.string().optional(),
    next: z.string().optional(),
  })
  .strict();

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, postAppSsoSchema);
  if (!parsed.success) return parsed.response;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(parsed.data)) {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value);
    }
  }

  const scope = rateScopeFromParams(params);

  try {
    const limit = await consumeAuthRateLimit(request, "app-sso", scope, AUTH_RATE_LIMITS.appSso);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

    const input = parseAppSsoRequest(params);
    const result = await resolveAndProvisionAppCourier(input);

    await createSession(result.userId, request);

    await writeAuditLog({
      request,
      action: result.provisioned ? "auth.app_sso_provisioned" : "auth.app_sso_login",
      entityType: "User",
      entityId: result.userId,
      actorUserId: result.userId,
      metadata: {
        courierId: result.courierId,
        signed: input.signed,
        method: "POST",
      },
    });

    const response = secureJson({
      ok: true,
      provisioned: result.provisioned,
      redirectTo: input.next,
    });
    applyEmbeddedCookie(response);
    return response;
  } catch (error) {
    if (error instanceof AppSsoError) {
      return secureJson({ ok: false, code: error.code, message: error.message }, { status: error.status });
    }
    console.error("[auth:app-login] Falha interna no POST SSO.", describeDatabaseError(error));
    return secureJson({ ok: false, message: "Não foi possível autenticar pelo aplicativo." }, { status: 500 });
  }
}
