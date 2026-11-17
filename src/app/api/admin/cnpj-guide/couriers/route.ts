import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { apiError } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
    const selected = (url.searchParams.get("selected") ?? "").slice(0, 100);
    if (query.length < 2) return NextResponse.json({ couriers: [] });
    const results = await db.courier.findMany({
      where: { status: { not: "INACTIVE" }, OR: [{ id: selected || "__none__" }, { cnpj: null, name: { contains: query, mode: "insensitive" } }] },
      select: { id: true, name: true, cnpj: true }, orderBy: { name: "asc" }, take: 51,
    });
    if (selected && !results.some((courier) => courier.id === selected)) {
      const current = await db.courier.findUnique({ where: { id: selected }, select: { id: true, name: true, cnpj: true } });
      if (current) results.unshift(current);
    }
    return NextResponse.json({ couriers: results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
