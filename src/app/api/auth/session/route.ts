import { originDeniedResponse, secureJson } from "@/lib/auth/http";
import { isTrustedPostOrigin } from "@/lib/auth/origin";
import { refreshCurrentSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  if (!isTrustedPostOrigin(request)) return originDeniedResponse();

  const active = await refreshCurrentSession();
  return active
    ? new Response(null, { status: 204 })
    : secureJson({ ok: false, message: "Sua sessão expirou." }, { status: 401 });
}
