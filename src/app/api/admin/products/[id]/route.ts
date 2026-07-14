import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { isTrustedPostOrigin } from "@/lib/auth/origin";
import { DomainError } from "@/lib/domain-error";

const updateSchema = z.object({
  version: z.number().int().nonnegative(),
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().min(8).max(800).optional(),
  category: z.string().trim().min(2).max(60).optional(),
  imageUrl: z.string().trim().max(2_800_000).refine((value) => {
    if (value === "" || value.startsWith("/")) return true;
    if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return true;
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  }, "Use uma URL HTTPS ou uma imagem PNG, JPEG ou WebP válida.").nullable().optional(),
  pointsCost: z.number().int().positive().max(10_000_000).optional(),
  referenceValueCents: z.number().int().nonnegative().max(100_000_000).nullable().optional(),
  stockQuantity: z.number().int().nonnegative().max(1_000_000).optional(),
  maxPerCourierPerPeriod: z.number().int().positive().max(100).nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  featured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isTrustedPostOrigin(request)) throw new DomainError("Origem da solicitação não permitida.", "INVALID_ORIGIN", 403);
    const admin = await requireAdmin();
    const { id } = await context.params;
    const input = updateSchema.parse(await request.json());
    const { version, ...changes } = input;
    const product = await db.$transaction(async (tx) => {
      const changed = await tx.product.updateMany({
        where: { id, version },
        data: { ...changes, imageUrl: changes.imageUrl === "" ? null : changes.imageUrl, version: { increment: 1 } },
      });
      if (changed.count !== 1) {
        throw new DomainError("O produto foi alterado por outra operação. Atualize a página.", "PRODUCT_VERSION_CONFLICT", 409);
      }
      const updated = await tx.product.findUniqueOrThrow({ where: { id } });
      await tx.auditLog.create({
        data: {
          actorUserId: admin.id,
          action: "PRODUCT_UPDATED",
          entityType: "Product",
          entityId: updated.id,
          metadata: { fields: Object.keys(changes), previousVersion: version },
        },
      });
      return updated;
    });
    return NextResponse.json({ product });
  } catch (error) {
    return apiError(error);
  }
}
