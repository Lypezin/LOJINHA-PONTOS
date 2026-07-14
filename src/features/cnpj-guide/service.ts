import { MatchStatus, Prisma } from "@prisma/client";

import type { CnpjSourceEntry } from "@/features/imports/types";
import { normalizeName } from "@/features/imports/normalization";
import { isValidCnpj, normalizeCnpj } from "@/lib/auth/identity";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/domain-error";

export interface SaveCnpjGuideInput {
  name: string;
  cnpj: string;
  courierId: string | null;
  notes?: string | null;
}

function validatedInput(input: SaveCnpjGuideInput) {
  const name = input.name.trim();
  const normalizedName = normalizeName(name);
  const cnpj = normalizeCnpj(input.cnpj);
  if (!normalizedName) {
    throw new DomainError("Informe o nome usado na planilha.", "INVALID_GUIDE_NAME", 422);
  }
  if (!isValidCnpj(cnpj)) {
    throw new DomainError("Informe um CNPJ válido.", "INVALID_CNPJ", 422);
  }
  return { name, normalizedName, cnpj, courierId: input.courierId, notes: input.notes?.trim() || null };
}

export async function getCnpjGuideSourceEntries(): Promise<CnpjSourceEntry[]> {
  const entries = await db.cnpjGuideEntry.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, normalizedName: true, cnpj: true },
  });
  return entries.map((entry) => ({
    sourceName: entry.name,
    normalizedName: entry.normalizedName,
    cnpj: entry.cnpj,
    sourceRow: 0,
    sourceKey: `guide:${entry.id}`,
  }));
}

export async function saveCnpjGuideEntry(
  id: string | null,
  rawInput: SaveCnpjGuideInput,
  adminUserId: string,
) {
  const input = validatedInput(rawInput);
  return db.$transaction(async (tx) => {
    const existing = id ? await tx.cnpjGuideEntry.findUnique({ where: { id } }) : null;
    if (id && !existing) throw new DomainError("Registro da guia não encontrado.", "NOT_FOUND", 404);

    const requestedCourier = input.courierId
      ? await tx.courier.findUnique({ where: { id: input.courierId } })
      : null;
    if (input.courierId && !requestedCourier) {
      throw new DomainError("Entregador não encontrado.", "COURIER_NOT_FOUND", 404);
    }

    const cnpjOwner = await tx.courier.findUnique({ where: { cnpj: input.cnpj } });
    if (cnpjOwner && requestedCourier && cnpjOwner.id !== requestedCourier.id) {
      throw new DomainError("Este CNPJ já pertence a outro entregador.", "CNPJ_IN_USE", 409);
    }
    const courierId = requestedCourier?.id ?? cnpjOwner?.id ?? null;

    const [cnpjConflict, courierConflict] = await Promise.all([
      tx.cnpjGuideEntry.findFirst({ where: { cnpj: input.cnpj, ...(id ? { id: { not: id } } : {}) } }),
      courierId
        ? tx.cnpjGuideEntry.findFirst({ where: { courierId, ...(id ? { id: { not: id } } : {}) } })
        : null,
    ]);
    if (cnpjConflict) throw new DomainError("Este CNPJ já existe na Guia de CNPJ.", "GUIDE_CNPJ_EXISTS", 409);
    if (courierConflict) throw new DomainError("Este entregador já possui um registro na Guia de CNPJ.", "GUIDE_COURIER_EXISTS", 409);

    const entry = existing
      ? await tx.cnpjGuideEntry.update({
          where: { id: existing.id },
          data: { ...input, courierId, source: existing.source === "INFORMATIVO" ? existing.source : "ADMIN" },
        })
      : await tx.cnpjGuideEntry.create({ data: { ...input, courierId, source: "ADMIN" } });

    if (courierId) {
      const courier = requestedCourier ?? cnpjOwner!;
      await tx.courier.update({
        where: { id: courierId },
        data: {
          cnpj: input.cnpj,
          sourceCnpjName: input.name,
          cnpjMatchStatus: MatchStatus.MANUAL_MATCHED,
          cnpjMatchScore: 1,
          activationCodeHash: courier.cnpj !== input.cnpj ? null : undefined,
          activationCodeExpiresAt: courier.cnpj !== input.cnpj ? null : undefined,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: adminUserId,
        action: existing ? "CNPJ_GUIDE_UPDATED" : "CNPJ_GUIDE_CREATED",
        entityType: "CnpjGuideEntry",
        entityId: entry.id,
        metadata: { courierId, cnpjChanged: existing ? existing.cnpj !== input.cnpj : false },
      },
    });
    return entry;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function deleteCnpjGuideEntry(id: string, adminUserId: string) {
  return db.$transaction(async (tx) => {
    const entry = await tx.cnpjGuideEntry.findUnique({ where: { id } });
    if (!entry) throw new DomainError("Registro da guia não encontrado.", "NOT_FOUND", 404);
    await tx.cnpjGuideEntry.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        actorUserId: adminUserId,
        action: "CNPJ_GUIDE_DELETED",
        entityType: "CnpjGuideEntry",
        entityId: id,
        metadata: { courierId: entry.courierId },
      },
    });
  });
}
