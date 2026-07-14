import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestIpHash } from "@/lib/auth/audit";
import { isTrustedPostOrigin } from "@/lib/auth/origin";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/domain-error";
import { apiError } from "@/lib/http";

const updateSchema = z.object({ active: z.boolean() }).strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isTrustedPostOrigin(request)) {
      throw new DomainError("Origem da solicitação não permitida.", "INVALID_ORIGIN", 403);
    }
    const actor = await requireAdmin();
    const { id } = await context.params;
    const input = updateSchema.parse(await request.json());
    if (id === actor.id && !input.active) {
      throw new DomainError("Você não pode desativar o próprio acesso.", "CANNOT_DISABLE_SELF", 409);
    }

    const user = await db.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('lojinha-admin-users'))::text`);
      const target = await tx.user.findUnique({
        where: { id },
        select: { id: true, role: true, active: true },
      });
      if (!target || target.role !== "ADMIN") {
        throw new DomainError("Administrador não encontrado.", "ADMIN_NOT_FOUND", 404);
      }
      if (!input.active && target.active) {
        const activeAdmins = await tx.user.count({ where: { role: "ADMIN", active: true } });
        if (activeAdmins <= 1) {
          throw new DomainError("Mantenha pelo menos um administrador ativo.", "LAST_ADMIN", 409);
        }
      }
      const updated = await tx.user.update({
        where: { id },
        data: { active: input.active },
        select: {
          id: true,
          displayName: true,
          email: true,
          active: true,
          mustChangePassword: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!input.active) await tx.session.deleteMany({ where: { userId: id } });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: input.active ? "ADMIN_USER_ACTIVATED" : "ADMIN_USER_DEACTIVATED",
          entityType: "User",
          entityId: id,
          metadata: { sessionsRevoked: !input.active },
          ipHash: getRequestIpHash(request),
        },
      });
      return updated;
    });

    return NextResponse.json({ user });
  } catch (error) {
    return apiError(error);
  }
}
