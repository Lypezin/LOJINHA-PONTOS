import { NextResponse } from "next/server";

import { importCnpjGuideWorkbook } from "@/features/cnpj-guide/import";
import { requireAdmin } from "@/lib/auth/session";
import { DomainError } from "@/lib/domain-error";

export async function POST(request: Request) {
  try {
    const adminUser = await requireAdmin();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      throw new DomainError("Selecione um arquivo Excel .xlsx para importar.", "MISSING_FILE", 400);
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      throw new DomainError("Formato de arquivo inválido. Envie um arquivo .xlsx.", "INVALID_FORMAT", 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const summary = await importCnpjGuideWorkbook(buffer, adminUser.id);

    return NextResponse.json({ ok: true, data: summary });
  } catch (error) {
    console.error("[CNPJ Guide Import API Error]", error);
    if (error instanceof DomainError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : "Erro ao importar a planilha de CNPJs.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
