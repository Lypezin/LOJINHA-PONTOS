import { NextResponse } from "next/server";
import { db, describeDatabaseError } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "healthy" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[health] Banco de dados indisponível.", describeDatabaseError(error));
    return NextResponse.json(
      { status: "unhealthy" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
