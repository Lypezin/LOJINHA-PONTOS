import { writeAuditLog } from "@/lib/auth/audit";
import { destroyCurrentSession, getCurrentUser } from "@/lib/auth/session";
import { originDeniedResponse, secureJson } from "@/lib/auth/http";
import { isTrustedPostOrigin } from "@/lib/auth/origin";

export async function POST(request: Request) {
  if (!isTrustedPostOrigin(request)) return originDeniedResponse();

  try {
    const user = await getCurrentUser();
    await destroyCurrentSession();

    if (user) {
      await writeAuditLog({
        request,
        action: "auth.logged_out",
        entityType: "User",
        entityId: user.id,
        actorUserId: user.id,
      });
    }

    return secureJson({ ok: true, message: "Você saiu da sua conta." });
  } catch {
    await destroyCurrentSession().catch(() => undefined);
    console.error("[auth:logout] Falha ao revogar a sessão no banco.");
    return secureJson({ ok: true, message: "Você saiu deste dispositivo." });
  }
}
