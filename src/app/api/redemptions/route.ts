import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { DomainError } from "@/lib/domain-error";
import { redeemProduct } from "@/features/redemptions/service";
import { isTrustedPostOrigin } from "@/lib/auth/origin";

const schema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(10).default(1),
  idempotencyKey: z.string().uuid(),
  notes: z.string().trim().max(300).optional(),
});

export async function POST(request: Request) {
  try {
    if (!isTrustedPostOrigin(request)) throw new DomainError("Origem da solicitação não permitida.", "INVALID_ORIGIN", 403);
    const user = await requireUser();
    if (!user.courierId) throw new DomainError("Conta de entregador inválida.", "COURIER_REQUIRED", 403);
    const input = schema.parse(await request.json());
    const redemption = await redeemProduct({ ...input, courierId: user.courierId, userId: user.id });
    return NextResponse.json({ redemption }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
