import bcrypt from "bcryptjs";
import { getCurrentUser, clearSessionCookie } from "@/lib/auth/session";
import { isTrustedPostOrigin } from "@/lib/auth/origin";
import { originDeniedResponse, parseJsonBody, secureJson } from "@/lib/auth/http";
import { changePasswordSchema } from "@/lib/auth/validation";
import { AUTH_RATE_LIMITS, consumeAuthRateLimit, rateLimitResponse } from "@/lib/auth/rate-limit";
import { writeAuditLog } from "@/lib/auth/audit";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  if (!isTrustedPostOrigin(request)) return originDeniedResponse();
  const user = await getCurrentUser();
  if (!user) return secureJson({ ok: false, message: "Faça login para continuar." }, { status: 401 });
  const parsed = await parseJsonBody(request, changePasswordSchema);
  if (!parsed.success) return parsed.response;

  try {
    const limit = await consumeAuthRateLimit(
      request,
      "change-password",
      user.id,
      AUTH_RATE_LIMITS.changePassword,
    );
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);
    const record = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    if (!record || !(await bcrypt.compare(parsed.data.currentPassword, record.passwordHash))) {
      return secureJson({ ok: false, message: "A senha atual está incorreta." }, { status: 400 });
    }
    if (await bcrypt.compare(parsed.data.password, record.passwordHash)) {
      return secureJson({ ok: false, message: "A nova senha precisa ser diferente da senha atual." }, { status: 422 });
    }
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false },
      }),
      db.session.deleteMany({ where: { userId: user.id } }),
    ]);
    await clearSessionCookie();
    await writeAuditLog({
      request,
      action: "auth.password_changed",
      entityType: "User",
      entityId: user.id,
      actorUserId: user.id,
    });
    return secureJson({
      ok: true,
      message: "Senha alterada. Entre novamente.",
      redirectTo: "/login?senha=redefinida",
    });
  } catch {
    console.error("[auth:change-password] Falha interna.");
    return secureJson({ ok: false, message: "Não foi possível alterar a senha agora." }, { status: 500 });
  }
}
