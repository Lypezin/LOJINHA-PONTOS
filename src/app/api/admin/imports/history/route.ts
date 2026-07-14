import { ImportStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/domain-error";
import { apiError } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const searchParams = new URL(request.url).searchParams;
    const requestedLimit = Number(searchParams.get("limit") ?? 30);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 30;
    const periodKey = searchParams.get("periodKey")?.trim() || undefined;
    const statusValue = searchParams.get("status")?.trim();
    const status = statusValue
      ? Object.values(ImportStatus).find((value) => value === statusValue)
      : undefined;
    if (statusValue && !status) {
      throw new DomainError("Status de importação inválido.", "INVALID_IMPORT_STATUS", 422);
    }

    const batches = await db.importBatch.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(periodKey ? { period: { key: periodKey } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        filename: true,
        fileHash: true,
        pointsColumn: true,
        pointsColumnIndex: true,
        status: true,
        rowCount: true,
        courierCount: true,
        totalPoints: true,
        warningCount: true,
        processedAt: true,
        createdAt: true,
        period: { select: { key: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      data: batches.map(({ period, fileHash, ...batch }) => ({
        ...batch,
        periodKey: period.key,
        fileHash: fileHash.slice(0, 12),
      })),
    });
  } catch (error) {
    if (error instanceof DomainError) return apiError(error);
    return apiError(
      new DomainError(
        "Não foi possível consultar o histórico de importações.",
        "IMPORT_HISTORY_FAILED",
        500,
      ),
    );
  }
}
