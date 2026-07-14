import { NextResponse } from "next/server";

import { readImportUpload } from "@/features/imports/request";
import { getCnpjGuideSourceEntries } from "@/features/cnpj-guide/service";
import { commitImport } from "@/features/imports/service";
import {
  ImportWorkbookError,
  parseImportWorkbook,
} from "@/features/imports/workbook";
import { isTrustedPostOrigin } from "@/lib/auth/origin";
import { requireAdmin } from "@/lib/auth/session";
import { DomainError } from "@/lib/domain-error";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";

function safeImportError(error: unknown) {
  if (error instanceof DomainError) return apiError(error);
  if (error instanceof ImportWorkbookError) {
    return apiError(new DomainError(error.message, error.code, 422));
  }
  return apiError(
    new DomainError(
      "Não foi possível concluir a importação. Nenhuma alteração parcial foi mantida.",
      "IMPORT_COMMIT_FAILED",
      500,
    ),
  );
}

export async function POST(request: Request) {
  try {
    if (!isTrustedPostOrigin(request)) {
      throw new DomainError("Origem da solicitação não permitida.", "INVALID_ORIGIN", 403);
    }
    const admin = await requireAdmin();
    const upload = await readImportUpload(request);
    const guideEntries = await getCnpjGuideSourceEntries();
    const parsed = await parseImportWorkbook(upload.buffer, {
      filename: upload.filename,
      periodKey: upload.periodKey,
      pointsColumn: upload.pointsColumn,
      guideEntries,
    });
    const result = await commitImport({ parsed, adminUserId: admin.id });
    return NextResponse.json(
      { ok: true, data: result },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (error) {
    return safeImportError(error);
  }
}
