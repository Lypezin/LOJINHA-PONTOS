import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeEmail } from "@/lib/auth/identity";
import { isTrustedPostOrigin } from "@/lib/auth/origin";
import { requireUser } from "@/lib/auth/session";
import { getRequestIpHash } from "@/lib/auth/audit";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/domain-error";
import { apiError } from "@/lib/http";

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  email: z.string().trim().transform(normalizeEmail).pipe(z.string().email().max(254)),
  currentPassword: z.string().max(200).optional(),
}).strict();

export async function PATCH(request: Request) {
  try {
    if (!isTrustedPostOrigin(request)) {
      throw new DomainError("Origem da solicitação não permitida.", "INVALID_ORIGIN", 403);
    }
    const sessionUser = await requireUser();
    const input = profileSchema.parse(await request.json());
    const emailChanged = input.email !== sessionUser.emailNormalized;

    if (emailChanged) {
      if (!input.currentPassword) {
        throw new DomainError("Informe sua senha atual para alterar o e-mail.", "PASSWORD_REQUIRED", 422);
      }
      const record = await db.user.findUnique({
        where: { id: sessionUser.id },
        select: { passwordHash: true },
      });
      if (!record || !(await bcrypt.compare(input.currentPassword, record.passwordHash))) {
        throw new DomainError("A senha atual está incorreta.", "INVALID_PASSWORD", 422);
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: sessionUser.id },
        data: {
          displayName: input.displayName,
          email: input.email,
          emailNormalized: input.email,
        },
        select: { displayName: true, email: true, updatedAt: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: sessionUser.id,
          action: "PROFILE_UPDATED",
          entityType: "User",
          entityId: sessionUser.id,
          metadata: { emailChanged, displayNameChanged: input.displayName !== sessionUser.displayName },
          ipHash: getRequestIpHash(request),
        },
      });
      return user;
    });

    return NextResponse.json({ profile: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError(new DomainError("Este e-mail já está em uso.", "EMAIL_IN_USE", 409));
    }
    return apiError(error);
  }
}
