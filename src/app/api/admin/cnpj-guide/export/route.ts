import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const entries = await db.cnpjGuideEntry.findMany({
      orderBy: { name: "asc" },
      select: { name: true, cnpj: true, source: true, notes: true, courier: { select: { name: true, externalCourierId: true, plaza: true } } },
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("DADOS CNPJ");
    sheet.columns = [
      { header: "NOME", key: "name", width: 35 },
      { header: "CNPJ", key: "cnpj", width: 22 },
      { header: "UUID", key: "uuid", width: 40 },
      { header: "REGIÃO", key: "region", width: 24 },
      { header: "ENTREGADOR VINCULADO", key: "courier", width: 35 },
      { header: "ORIGEM", key: "source", width: 22 },
      { header: "OBSERVAÇÕES", key: "notes", width: 45 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    for (const entry of entries) sheet.addRow({ name: entry.name, cnpj: entry.cnpj, uuid: entry.courier?.externalCourierId ?? "", region: entry.courier?.plaza ?? "", courier: entry.courier?.name ?? "", source: entry.source, notes: entry.notes ?? "" });
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=guia-de-cnpj.xlsx", "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
