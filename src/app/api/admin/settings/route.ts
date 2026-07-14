import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { isTrustedPostOrigin } from "@/lib/auth/origin";
import { DomainError } from "@/lib/domain-error";

const schema = z.discriminatedUnion("key", [
  z.object({
    key: z.literal("points.defaultColumn"),
    value: z.object({
      letter: z.string().trim().transform((value) => value.toUpperCase()).pipe(z.string().regex(/^[A-Z]{1,3}$/)),
      index: z.number().int().min(1).max(16_384),
      header: z.string().trim().min(1).max(200),
    }).strict().superRefine((value, context) => {
      const computed = [...value.letter].reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0);
      if (computed !== value.index || computed > 16_384) {
        context.addIssue({ code: "custom", path: ["letter"], message: "A letra e o número da coluna não correspondem." });
      }
    }),
  }).strict(),
  z.object({
    key: z.literal("store.profile"),
    value: z.object({
      name: z.string().trim().min(2).max(80),
      supportEmail: z.string().trim().email().max(254),
    }).strict(),
  }).strict(),
]);

export async function GET() {
  try {
    await requireAdmin();
    const settings = await db.systemSetting.findMany({ orderBy: { key: "asc" } });
    return NextResponse.json({ settings });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isTrustedPostOrigin(request)) throw new DomainError("Origem da solicitação não permitida.", "INVALID_ORIGIN", 403);
    const admin = await requireAdmin();
    const input = schema.parse(await request.json());
    const value = input.value as Prisma.InputJsonValue;
    const setting = await db.$transaction(async (tx) => {
      const updated = await tx.systemSetting.upsert({
        where: { key: input.key },
        update: { value, updatedById: admin.id },
        create: { key: input.key, value, updatedById: admin.id },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: admin.id,
          action: "SETTING_UPDATED",
          entityType: "SystemSetting",
          entityId: updated.id,
          metadata: { key: input.key },
        },
      });
      return updated;
    });
    return NextResponse.json({ setting });
  } catch (error) {
    return apiError(error);
  }
}
