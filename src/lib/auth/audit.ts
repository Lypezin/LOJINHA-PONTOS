import "server-only";

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

function digest(value: string) {
  const salt =
    process.env.AUTH_AUDIT_SALT ??
    process.env.AUTH_SECRET ??
    process.env.DATABASE_URL ??
    "lojinha-local-audit";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

export function hashForAudit(value: string) {
  return digest(value);
}

export function getRequestIpHash(request: Request) {
  const platformForwarded = process.env.VERCEL === "1"
    ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    : null;
  const trustedForwarded = process.env.TRUST_PROXY === "true"
    ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    : null;
  const trustedRealIp = process.env.TRUST_PROXY === "true" ? request.headers.get("x-real-ip")?.trim() : null;
  const ip = platformForwarded || trustedForwarded || trustedRealIp;
  return ip ? digest(ip) : null;
}

export async function writeAuditLog(input: {
  request: Request;
  action: string;
  entityType: string;
  entityId?: string | null;
  actorUserId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    await db.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        actorUserId: input.actorUserId ?? null,
        metadata: input.metadata,
        ipHash: getRequestIpHash(input.request),
      },
    });
  } catch {
    // Uma indisponibilidade pontual da auditoria não deve expor detalhes do banco ao cliente.
    console.error("[auth:audit] Não foi possível registrar o evento.");
  }
}
