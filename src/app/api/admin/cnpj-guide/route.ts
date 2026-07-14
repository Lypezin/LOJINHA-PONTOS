import { NextResponse } from "next/server";
import { z } from "zod";

import { saveCnpjGuideEntry } from "@/features/cnpj-guide/service";
import { isTrustedPostOrigin } from "@/lib/auth/origin";
import { requireAdmin } from "@/lib/auth/session";
import { DomainError } from "@/lib/domain-error";
import { apiError } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(2).max(180),
  cnpj: z.string().trim().min(14).max(18),
  courierId: z.string().min(1).nullable().optional().default(null),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    if (!isTrustedPostOrigin(request)) throw new DomainError("Origem da solicitação não permitida.", "INVALID_ORIGIN", 403);
    const admin = await requireAdmin();
    const input = schema.parse(await request.json());
    const entry = await saveCnpjGuideEntry(null, input, admin.id);
    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
