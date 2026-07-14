import { MatchStatus, CourierStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { digitsOnly, isValidCnpj, isValidCpf } from "@/lib/documents";
import { DomainError } from "@/lib/domain-error";
import { apiError } from "@/lib/http";
import { isTrustedPostOrigin } from "@/lib/auth/origin";

const schema = z.object({
  cpf: z.string().trim().nullable().optional(),
  cnpj: z.string().trim().nullable().optional(),
  name: z.string().trim().min(2).max(160).optional(),
  status: z.nativeEnum(CourierStatus).optional(),
  cnpjMatchStatus: z.nativeEnum(MatchStatus).optional(),
  plaza: z.string().trim().max(100).nullable().optional(),
  subPlaza: z.string().trim().max(100).nullable().optional(),
});

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isTrustedPostOrigin(request)) throw new DomainError("Origem da solicitação não permitida.", "INVALID_ORIGIN", 403);
    const admin = await requireAdmin();
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const cpfProvided = Object.prototype.hasOwnProperty.call(input, "cpf");
    const cnpjProvided = Object.prototype.hasOwnProperty.call(input, "cnpj");
    const cpf = cpfProvided ? (input.cpf == null || input.cpf === "" ? null : digitsOnly(input.cpf)) : undefined;
    const cnpj = cnpjProvided ? (input.cnpj == null || input.cnpj === "" ? null : digitsOnly(input.cnpj)) : undefined;
    if (cpf && !isValidCpf(cpf)) throw new DomainError("CPF inválido.", "INVALID_CPF", 422);
    if (cnpj && !isValidCnpj(cnpj)) throw new DomainError("CNPJ inválido.", "INVALID_CNPJ", 422);

    const current = await db.courier.findUnique({ where: { id } });
    if (!current) throw new DomainError("Entregador não encontrado.", "NOT_FOUND", 404);
    if (cpf) {
      const owner = await db.courier.findFirst({ where: { cpf, id: { not: id } }, select: { id: true } });
      if (owner) throw new DomainError("Este CPF já está vinculado a outro entregador.", "CPF_IN_USE", 409);
    }

    const courier = await db.$transaction(async (tx) => {
      const updated = await tx.courier.update({
        where: { id },
        data: {
          cpf,
          cnpj,
          name: input.name,
          normalizedName: input.name ? normalizeName(input.name) : undefined,
          status: input.status,
          cnpjMatchStatus: input.cnpjMatchStatus,
          plaza: input.plaza,
          subPlaza: input.subPlaza,
          cpfAddedAt: cpfProvided && cpf && cpf !== current.cpf ? new Date() : undefined,
          activationCodeHash: cpfProvided && cpf !== current.cpf ? null : undefined,
          activationCodeExpiresAt: cpfProvided && cpf !== current.cpf ? null : undefined,
        },
      });
      if (input.status === "INACTIVE") {
        const users = await tx.user.findMany({ where: { courierId: id }, select: { id: true } });
        const userIds = users.map((user) => user.id);
        if (userIds.length) {
          await tx.user.updateMany({ where: { id: { in: userIds } }, data: { active: false } });
          await tx.session.deleteMany({ where: { userId: { in: userIds } } });
        }
      } else if (input.status === "ACTIVE") {
        await tx.user.updateMany({ where: { courierId: id }, data: { active: true } });
      }
      await tx.auditLog.create({
        data: {
          actorUserId: admin.id,
          action: "COURIER_UPDATED",
          entityType: "Courier",
          entityId: updated.id,
          metadata: {
            fields: Object.keys(input),
            cpfChanged: cpfProvided && cpf !== current.cpf,
            cnpjChanged: cnpjProvided && cnpj !== current.cnpj,
            sessionsRevoked: input.status === "INACTIVE",
          },
        },
      });
      return updated;
    });
    return NextResponse.json({ courier });
  } catch (error) {
    return apiError(error);
  }
}
