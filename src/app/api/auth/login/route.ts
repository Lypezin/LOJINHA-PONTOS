import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { hashForAudit, writeAuditLog } from "@/lib/auth/audit";
import { cpfStorageCandidates, isValidCpf } from "@/lib/auth/identity";
import { createSession } from "@/lib/auth/session";
import { originDeniedResponse, parseJsonBody, secureJson } from "@/lib/auth/http";
import { isTrustedPostOrigin } from "@/lib/auth/origin";
import { loginSchema } from "@/lib/auth/validation";
import { AUTH_RATE_LIMITS, consumeAuthRateLimit, rateLimitResponse } from "@/lib/auth/rate-limit";

const DUMMY_PASSWORD_HASH = "$2b$12$OfUmlDF.LD99obmkGSoZtevMrp7wK.5SztMRarEKD52vC1rSPjOpy";
const INVALID_CREDENTIALS = "E-mail, CPF ou senha incorretos.";

export async function POST(request: Request) {
  if (!isTrustedPostOrigin(request)) return originDeniedResponse();

  const parsed = await parseJsonBody(request, loginSchema);
  if (!parsed.success) return parsed.response;

  try {
    const { identifier, password } = parsed.data;
    const limit = await consumeAuthRateLimit(request, "login", identifier, AUTH_RATE_LIMITS.login);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);
    const identifierIsCpf = isValidCpf(identifier);
    const user = await db.user.findFirst({
      where: identifierIsCpf
        ? { courier: { is: { cpf: { in: cpfStorageCandidates(identifier) } } } }
        : { emailNormalized: identifier },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        active: true,
        mustChangePassword: true,
        courier: { select: { name: true, status: true } },
      },
    });

    const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    const canSignIn = Boolean(user && passwordMatches && user.active && user.courier?.status !== "INACTIVE");

    if (!canSignIn || !user) {
      await writeAuditLog({
        request,
        action: "auth.login_failed",
        entityType: "Auth",
        metadata: { identifierHash: hashForAudit(identifier), identifierType: identifierIsCpf ? "cpf" : "email" },
      });
      return secureJson({ ok: false, message: INVALID_CREDENTIALS }, { status: 401 });
    }

    await createSession(user.id, request);
    await writeAuditLog({
      request,
      action: "auth.login_succeeded",
      entityType: "User",
      entityId: user.id,
      actorUserId: user.id,
    });

    return secureJson({
      ok: true,
      message: "Entrada autorizada.",
      user: { name: user.courier?.name ?? "Administrador", email: user.email, role: user.role },
      redirectTo: user.mustChangePassword ? "/trocar-senha" : user.role === "ADMIN" ? "/admin" : "/loja",
    });
  } catch {
    console.error("[auth:login] Falha interna ao entrar.");
    return secureJson({ ok: false, message: "Não foi possível entrar agora. Tente novamente." }, { status: 500 });
  }
}
