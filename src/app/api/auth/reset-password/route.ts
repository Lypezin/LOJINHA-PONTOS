import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/auth/audit";
import { clearSessionCookie, hashSessionToken } from "@/lib/auth/session";
import { originDeniedResponse, parseJsonBody, secureJson } from "@/lib/auth/http";
import { isTrustedPostOrigin } from "@/lib/auth/origin";
import { resetPasswordSchema } from "@/lib/auth/validation";
import { AUTH_RATE_LIMITS, consumeAuthRateLimit, rateLimitResponse } from "@/lib/auth/rate-limit";

class InvalidResetTokenError extends Error {}

export async function POST(request: Request) {
  if (!isTrustedPostOrigin(request)) return originDeniedResponse();

  const parsed = await parseJsonBody(request, resetPasswordSchema);
  if (!parsed.success) return parsed.response;

  const tokenHash = hashSessionToken(parsed.data.token);
  const now = new Date();

  try {
    const limit = await consumeAuthRateLimit(
      request,
      "reset-password",
      tokenHash,
      AUTH_RATE_LIMITS.resetPassword,
    );
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const userId = await db.$transaction(async (transaction) => {
      const resetToken = await transaction.passwordResetToken.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true, usedAt: true, expiresAt: true },
      });

      if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now) {
        throw new InvalidResetTokenError();
      }

      const consumed = await transaction.passwordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) throw new InvalidResetTokenError();

      await transaction.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, mustChangePassword: false },
      });
      await transaction.session.deleteMany({ where: { userId: resetToken.userId } });
      await transaction.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, id: { not: resetToken.id }, usedAt: null },
        data: { usedAt: now },
      });

      return resetToken.userId;
    });

    await clearSessionCookie();
    await writeAuditLog({
      request,
      action: "auth.password_reset_completed",
      entityType: "User",
      entityId: userId,
      actorUserId: userId,
    });

    return secureJson({
      ok: true,
      message: "Senha redefinida. Entre novamente com a nova senha.",
      redirectTo: "/login?senha=redefinida",
    });
  } catch (error) {
    if (!(error instanceof InvalidResetTokenError)) {
      console.error("[auth:reset-password] Falha interna ao redefinir a senha.");
      return secureJson({ ok: false, message: "Não foi possível redefinir a senha agora." }, { status: 500 });
    }

    return secureJson(
      { ok: false, message: "Este link é inválido, expirou ou já foi utilizado." },
      { status: 400 },
    );
  }
}
