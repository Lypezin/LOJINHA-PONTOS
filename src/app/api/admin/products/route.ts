import { NextResponse } from "next/server";
import { ProductStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { isTrustedPostOrigin } from "@/lib/auth/origin";
import { DomainError } from "@/lib/domain-error";

const productSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(8).max(800),
  category: z.string().trim().min(2).max(60),
  imageUrl: z.string().trim().max(2_800_000).refine((value) => {
    if (value === "" || value.startsWith("/")) return true;
    if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return true;
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  }, "Use uma URL HTTPS ou uma imagem PNG, JPEG ou WebP válida.").nullable().optional(),
  pointsCost: z.number().int().positive().max(10_000_000),
  referenceValueCents: z.number().int().nonnegative().max(100_000_000).nullable().optional(),
  stockQuantity: z.number().int().nonnegative().max(1_000_000),
  maxPerCourierPerPeriod: z.number().int().positive().max(100).nullable().optional(),
  status: z.nativeEnum(ProductStatus).default(ProductStatus.DRAFT),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);
}

export async function GET() {
  try {
    await requireAdmin();
    const products = await db.product.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
    return NextResponse.json({ products });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isTrustedPostOrigin(request)) throw new DomainError("Origem da solicitação não permitida.", "INVALID_ORIGIN", 403);
    const admin = await requireAdmin();
    const input = productSchema.parse(await request.json());
    const baseSlug = slugify(input.name) || "item";
    const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 10)}`;
    const product = await db.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: { ...input, imageUrl: input.imageUrl || null, slug, createdById: admin.id },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: admin.id,
          action: "PRODUCT_CREATED",
          entityType: "Product",
          entityId: created.id,
          metadata: { name: created.name, pointsCost: created.pointsCost, stockQuantity: created.stockQuantity },
        },
      });
      return created;
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
