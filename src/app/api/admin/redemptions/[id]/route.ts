import { NextResponse } from "next/server";
import { RedemptionStatus } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { updateRedemptionStatus } from "@/features/redemptions/service";
import { isTrustedPostOrigin } from "@/lib/auth/origin";
import { DomainError } from "@/lib/domain-error";

const schema = z.object({ status: z.nativeEnum(RedemptionStatus) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isTrustedPostOrigin(request)) throw new DomainError("Origem da solicitação não permitida.", "INVALID_ORIGIN", 403);
    const admin = await requireAdmin();
    const { id } = await context.params;
    const { status } = schema.parse(await request.json());
    const redemption = await updateRedemptionStatus(id, status, admin.id);
    return NextResponse.json({ redemption });
  } catch (error) {
    return apiError(error);
  }
}
