import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashForAudit, writeAuditLog } from "@/lib/auth/audit";
import { hashSessionToken } from "@/lib/auth/session";
import { sendPasswordResetEmail } from "@/lib/auth/password-reset-email";
import { originDeniedResponse, parseJsonBody, secureJson } from "@/lib/auth/http";
import { isTrustedPostOrigin } from "@/lib/auth/origin";
import { forgotPasswordSchema } from "@/lib/auth/validation";
import { AUTH_RATE_LIMITS, consumeAuthRateLimit, rateLimitResponse } from "@/lib/auth/rate-limit";

const GENERIC_MESSAGE =
  "Se existir uma conta com esse e-mail, você receberá as instruções para redefinir a senha.";

function getPublicOrigin(request: Request) {
  const candidates = process.env.NODE_ENV === "production"
    ? [process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL]
    : [process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL, request.url];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return new URL(candidate).origin;
    } catch {
      // Tenta a próxima origem configurada.
    }
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_URL não configurada para recuperação de senha.");
  }
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (!isTrustedPostOrigin(request)) return originDeniedResponse();

  const parsed = await parseJsonBody(request, forgotPasswordSchema);
  if (!parsed.success) return parsed.response;

  try {
    const limit = await consumeAuthRateLimit(
      request,
      "forgot-password",
      parsed.data.email,
      AUTH_RATE_LIMITS.forgotPassword,
    );
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);
    const user = await db.user.findUnique({
      where: { emailNormalized: parsed.data.email },
      select: { id: true, email: true, active: true, courier: { select: { name: true } } },
    });

    let resetUrl: string | undefined;
    if (user?.active) {
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db.$transaction([
        db.passwordResetToken.deleteMany({
          where: { userId: user.id, OR: [{ usedAt: null }, { expiresAt: { lt: new Date() } }] },
        }),
        db.passwordResetToken.create({
          data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt },
        }),
      ]);

      const url = new URL("/redefinir-senha", getPublicOrigin(request));
      url.searchParams.set("token", token);
      resetUrl = url.toString();

      const delivery = await sendPasswordResetEmail({
        to: user.email,
        courierName: user.courier?.name ?? null,
        resetUrl,
      });

      await writeAuditLog({
        request,
        action: "auth.password_reset_requested",
        entityType: "User",
        entityId: user.id,
        metadata: { emailConfigured: delivery.configured, emailSent: delivery.sent },
      });
    } else {
      await writeAuditLog({
        request,
        action: "auth.password_reset_requested",
        entityType: "Auth",
        metadata: { emailHash: hashForAudit(parsed.data.email) },
      });
    }

    return secureJson({
      ok: true,
      message: GENERIC_MESSAGE,
      ...(process.env.NODE_ENV !== "production" && resetUrl ? { resetUrl } : {}),
    });
  } catch {
    console.error("[auth:forgot-password] Falha interna na solicitação.");
    // Mantém a mesma resposta para não confirmar se o e-mail existe.
    return secureJson({ ok: true, message: GENERIC_MESSAGE });
  }
}
