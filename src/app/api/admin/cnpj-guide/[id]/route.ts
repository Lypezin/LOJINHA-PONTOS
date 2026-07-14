import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteCnpjGuideEntry, saveCnpjGuideEntry } from "@/features/cnpj-guide/service";
import { isTrustedPostOrigin } from "@/lib/auth/origin";
import { requireAdmin } from "@/lib/auth/session";
import { DomainError } from "@/lib/domain-error";
import { apiError } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(2).max(180),
  cnpj: z.string().trim().min(14).max(18),
  courierId: z.string().min(1).nullable(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isTrustedPostOrigin(request)) throw new DomainError("Origem da solicitação não permitida.", "INVALID_ORIGIN", 403);
    const admin = await requireAdmin();
    const { id } = await context.params;
    const entry = await saveCnpjGuideEntry(id, schema.parse(await request.json()), admin.id);
    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isTrustedPostOrigin(request)) throw new DomainError("Origem da solicitação não permitida.", "INVALID_ORIGIN", 403);
    const admin = await requireAdmin();
    const { id } = await context.params;
    await deleteCnpjGuideEntry(id, admin.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
