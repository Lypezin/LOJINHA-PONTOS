import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { db } from "../src/lib/db";
import { parseImportWorkbook } from "../src/features/imports/workbook";
import { buildImportPreview, commitImport } from "../src/features/imports/service";

async function main() {
  const [fileArgument, periodKey, pointsColumn = "numero_de_pedidos_aceitos_e_concluidos"] = process.argv.slice(2);
  if (!fileArgument || !periodKey) {
    throw new Error("Uso: npm run import:excel -- <arquivo.xlsx> <AAAA-MM> [cabecalho-ou-letra]");
  }
  const filePath = resolve(fileArgument);
  const buffer = await readFile(filePath);
  const parsed = await parseImportWorkbook(buffer, {
    filename: basename(filePath),
    periodKey,
    pointsColumn,
  });
  const preview = await buildImportPreview(parsed);
  console.log({
    file: preview.filename,
    period: preview.selection.periodKey,
    column: preview.selection.pointsColumn,
    rows: preview.summary.rows,
    couriers: preview.summary.couriers,
    points: preview.summary.totalPoints,
    warnings: preview.summary.warnings,
    duplicate: preview.duplicate,
  });
  if (preview.duplicate && preview.duplicateBatchId) {
    console.log(`Arquivo já importado no lote ${preview.duplicateBatchId}.`);
    return;
  }
  if (!preview.canCommit) throw new Error("A prévia contém erros e não pode ser confirmada.");

  const admin = await db.user.findFirstOrThrow({ where: { role: "ADMIN", active: true }, select: { id: true } });
  const result = await commitImport({ parsed, adminUserId: admin.id });
  console.log({
    batchId: result.batchId,
    status: result.status,
    couriers: result.couriers,
    totalPoints: result.totalPoints,
    warningCount: result.warningCount,
  });
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
