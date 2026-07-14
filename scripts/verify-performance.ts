import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const expectedIndexes = [
  "Courier_name_idx",
  "Courier_name_trgm_idx",
  "Courier_status_name_idx",
  "CnpjGuideEntry_name_trgm_idx",
  "Product_status_featured_sortOrder_name_idx",
  "Redemption_requestedAt_idx",
] as const;

type ExplainResult = [{ "QUERY PLAN": [{ "Planning Time": number; "Execution Time": number; Plan: { "Node Type": string } }] }];

async function explain(name: string, sql: string) {
  const result = await db.$queryRawUnsafe<ExplainResult>(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`);
  const data = result[0]["QUERY PLAN"][0];
  if (data["Execution Time"] > 50) throw new Error(`${name} excedeu 50 ms no banco.`);
  return { name, planningMs: data["Planning Time"], executionMs: data["Execution Time"], node: data.Plan["Node Type"] };
}

async function main() {
  const indexes = await db.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
  `;
  const available = new Set(indexes.map((index) => index.indexname));
  const missing = expectedIndexes.filter((index) => !available.has(index));
  if (missing.length) throw new Error(`Índices ausentes: ${missing.join(", ")}`);

  const queries = await Promise.all([
    explain("lista de entregadores", `SELECT "id", "name" FROM "Courier" ORDER BY "name" LIMIT 20`),
    explain("busca de entregadores", `SELECT "id", "name" FROM "Courier" WHERE "name" ILIKE '%oliveira%' LIMIT 20`),
    explain("catálogo", `SELECT "id", "name" FROM "Product" WHERE "status" = 'ACTIVE' ORDER BY "featured" DESC, "sortOrder", "name"`),
    explain("guia de CNPJ", `SELECT "id", "name" FROM "CnpjGuideEntry" ORDER BY "name" LIMIT 40`),
  ]);

  console.log(JSON.stringify({ indexes: expectedIndexes.length, queries }, null, 2));
}

main().finally(() => db.$disconnect());
