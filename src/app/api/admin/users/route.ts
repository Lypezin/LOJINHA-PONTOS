import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestIpHash } from "@/lib/auth/audit";
import { isStrongPassword, normalizeEmail } from "@/lib/auth/identity";
import { isTrustedPostOrigin } from "@/lib/auth/origin";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/domain-error";
import { apiError } from "@/lib/http";

const createAdminSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  email: z.string().trim().transform(normalizeEmail).pipe(z.string().email().max(254)),
  password: z.string().refine(isStrongPassword, "Use 8 a 72 caracteres, com pelo menos uma letra e um número."),
}).strict();

const adminSelect = {
  id: true,
  displayName: true,
  email: true,
  active: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET() {
  try {
    await requireAdmin();
    const users = await db.user.findMany({
      where: { role: "ADMIN" },
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
      select: adminSelect,
    });
    return NextResponse.json({ users });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isTrustedPostOrigin(request)) {
      throw new DomainError("Origem da solicitação não permitida.", "INVALID_ORIGIN", 403);
    }
    const actor = await requireAdmin();
    const input = createAdminSchema.parse(await request.json());
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          displayName: input.displayName,
          email: input.email,
          emailNormalized: input.email,
          passwordHash,
          role: "ADMIN",
          active: true,
          mustChangePassword: true,
        },
        select: adminSelect,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "ADMIN_USER_CREATED",
          entityType: "User",
          entityId: created.id,
          metadata: { email: created.email },
          ipHash: getRequestIpHash(request),
        },
      });
      return created;
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError(new DomainError("Já existe um usuário com este e-mail.", "EMAIL_IN_USE", 409));
    }
    return apiError(error);
  }
}
