import { MatchStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/domain-error";
import { apiError } from "@/lib/http";
import { isTrustedPostOrigin } from "@/lib/auth/origin";

const schema = z.object({
  courierId: z.string().min(1),
  notes: z.string().trim().max(500).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isTrustedPostOrigin(request)) throw new DomainError("Origem da solicitação não permitida.", "INVALID_ORIGIN", 403);
    const admin = await requireAdmin();
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    await db.$transaction(async (tx) => {
      const [entry, courier] = await Promise.all([
        tx.cnpjRegistryEntry.findUnique({ where: { id } }),
        tx.courier.findUnique({ where: { id: input.courierId } }),
      ]);
      if (!entry || !courier) throw new DomainError("Registro de conciliação não encontrado.", "NOT_FOUND", 404);
      const cnpjOwner = await tx.courier.findFirst({
        where: { cnpj: entry.cnpj, id: { not: courier.id } },
        select: { id: true },
      });
      if (cnpjOwner) {
        throw new DomainError("Este CNPJ já está vinculado a outro entregador. Revise o vínculo existente antes de continuar.", "CNPJ_IN_USE", 409);
      }

      if (entry.courierId && entry.courierId !== courier.id) {
        await tx.courier.updateMany({
          where: {
            id: entry.courierId,
            cnpj: entry.cnpj,
            sourceCnpjName: entry.sourceName,
          },
          data: {
            cnpj: null,
            sourceCnpjName: null,
            cnpjMatchStatus: MatchStatus.PENDING,
            cnpjMatchScore: null,
          },
        });
      }

      const replaced = await tx.cnpjRegistryEntry.updateMany({
        where: { courierId: courier.id, id: { not: entry.id } },
        data: { courierId: null, matchStatus: MatchStatus.PENDING, matchScore: null },
      });
      await tx.cnpjRegistryEntry.update({
        where: { id },
        data: {
          courierId: courier.id,
          matchStatus: MatchStatus.MANUAL_MATCHED,
          notes: input.notes,
          matchScore: 1,
        },
      });
      await tx.courier.update({
        where: { id: courier.id },
        data: {
          cnpj: entry.cnpj,
          sourceCnpjName: entry.sourceName,
          cnpjMatchStatus: MatchStatus.MANUAL_MATCHED,
          cnpjMatchScore: 1,
          activationCodeHash: courier.cnpj !== entry.cnpj ? null : undefined,
          activationCodeExpiresAt: courier.cnpj !== entry.cnpj ? null : undefined,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: admin.id,
          action: "CNPJ_MANUALLY_MATCHED",
          entityType: "Courier",
          entityId: courier.id,
          metadata: { registryEntryId: entry.id, previousLinksReleased: replaced.count },
        },
      });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
