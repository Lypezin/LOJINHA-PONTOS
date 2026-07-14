import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { isTrustedPostOrigin } from "@/lib/auth/origin";
import { hashForAudit } from "@/lib/auth/audit";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/domain-error";
import { apiError } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isTrustedPostOrigin(request)) throw new DomainError("Origem da solicitação não permitida.", "INVALID_ORIGIN", 403);
    const admin = await requireAdmin();
    const { id } = await context.params;
    const courier = await db.courier.findUnique({
      where: { id },
      select: { id: true, cnpj: true, user: { select: { id: true } } },
    });
    if (!courier) throw new DomainError("Entregador não encontrado.", "NOT_FOUND", 404);
    if (!courier.cnpj) throw new DomainError("Concilie o CNPJ antes de gerar o código.", "CNPJ_REQUIRED", 409);
    if (courier.user) throw new DomainError("Este entregador já possui uma conta.", "ACCOUNT_EXISTS", 409);

    const code = randomBytes(6).toString("hex").slice(0, 10).toUpperCase();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.$transaction([
      db.courier.update({
        where: { id: courier.id },
        data: {
          activationCodeHash: hashForAudit(`${courier.id}:${code}`),
          activationCodeExpiresAt: expiresAt,
        },
      }),
      db.auditLog.create({
        data: {
          actorUserId: admin.id,
          action: "COURIER_ACTIVATION_CODE_GENERATED",
          entityType: "Courier",
          entityId: courier.id,
          metadata: { expiresAt: expiresAt.toISOString() },
        },
      }),
    ]);
    return NextResponse.json(
      { code, expiresAt },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
