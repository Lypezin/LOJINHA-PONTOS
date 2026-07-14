import { normalizeName, repairTextEncoding } from "../src/features/imports/normalization";
import { db } from "../src/lib/db";

const KNOWN_REPLACEMENTS = new Map([
  ["Entregador Teste EntreG?", "Entregador Teste EntreGô"],
  ["S?o Paulo", "São Paulo"],
  ["Conta de demonstra??o", "Conta de demonstração"],
  ["Cr?dito inicial da conta de teste", "Crédito inicial da conta de teste"],
]);

function repair(value: string | null) {
  if (value === null) return null;
  return KNOWN_REPLACEMENTS.get(value) ?? repairTextEncoding(value);
}

async function main() {
  const counts = { couriers: 0, guide: 0, registry: 0, snapshots: 0, ledger: 0 };

  for (const row of await db.courier.findMany({
    select: { id: true, name: true, normalizedName: true, sourceCnpjName: true, plaza: true, subPlaza: true, tag: true, source: true },
  })) {
    const name = repair(row.name)!;
    const data = {
      name,
      normalizedName: normalizeName(name),
      sourceCnpjName: repair(row.sourceCnpjName),
      plaza: repair(row.plaza),
      subPlaza: repair(row.subPlaza),
      tag: repair(row.tag),
      source: repair(row.source),
    };
    if (
      data.name !== row.name || data.normalizedName !== row.normalizedName ||
      data.sourceCnpjName !== row.sourceCnpjName || data.plaza !== row.plaza ||
      data.subPlaza !== row.subPlaza || data.tag !== row.tag || data.source !== row.source
    ) {
      await db.courier.update({ where: { id: row.id }, data });
      counts.couriers += 1;
    }
  }

  for (const row of await db.cnpjGuideEntry.findMany({ select: { id: true, name: true, normalizedName: true } })) {
    const name = repair(row.name)!;
    const normalizedName = normalizeName(name);
    if (name !== row.name || normalizedName !== row.normalizedName) {
      await db.cnpjGuideEntry.update({ where: { id: row.id }, data: { name, normalizedName } });
      counts.guide += 1;
    }
  }

  for (const row of await db.cnpjRegistryEntry.findMany({ select: { id: true, sourceName: true, normalizedName: true } })) {
    const sourceName = repair(row.sourceName)!;
    const normalizedName = normalizeName(sourceName);
    if (sourceName !== row.sourceName || normalizedName !== row.normalizedName) {
      await db.cnpjRegistryEntry.update({ where: { id: row.id }, data: { sourceName, normalizedName } });
      counts.registry += 1;
    }
  }

  for (const row of await db.importCourierSnapshot.findMany({ select: { id: true, sourceName: true, normalizedName: true } })) {
    const sourceName = repair(row.sourceName)!;
    const normalizedName = normalizeName(sourceName);
    if (sourceName !== row.sourceName || normalizedName !== row.normalizedName) {
      await db.importCourierSnapshot.update({ where: { id: row.id }, data: { sourceName, normalizedName } });
      counts.snapshots += 1;
    }
  }

  for (const row of await db.pointLedgerEntry.findMany({ select: { id: true, description: true } })) {
    const description = repair(row.description)!;
    if (description !== row.description) {
      await db.pointLedgerEntry.update({ where: { id: row.id }, data: { description } });
      counts.ledger += 1;
    }
  }

  console.log(JSON.stringify(counts));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Falha ao reparar textos.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
