import {
  ImportStatus,
  MatchStatus,
  PeriodStatus,
  PointEntryType,
  Prisma,
} from "@prisma/client";

import type {
  CnpjMatch,
  CourierAggregate,
  ImportIssue,
  ImportPreviewResponse,
  ParsedImportWorkbook,
} from "@/features/imports/types";
import { MAX_DATABASE_INT } from "@/features/imports/normalization";
import { getCnpjMatchCounts } from "@/features/imports/workbook";
import { ensureCurrentPeriod } from "@/features/points/period";
import { pointsCycleDefinitionForDate } from "@/features/points/cycle";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/domain-error";

interface CommitImportOptions {
  parsed: ParsedImportWorkbook;
  adminUserId: string;
}

export interface CommitImportResult {
  batchId: string;
  status: ImportStatus;
  duplicate: boolean;
  periodKey: string;
  rows: number;
  couriers: number;
  totalPoints: number;
  warningCount: number;
}

function issueCount(issues: ImportIssue[], severity: ImportIssue["severity"]): number {
  return issues
    .filter((issue) => issue.severity === severity)
    .reduce((total, issue) => total + (issue.count ?? 1), 0);
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function desiredMatch(match: CnpjMatch | undefined) {
  if (match?.kind === "EXACT" && match.cnpj) {
    return {
      cnpj: match.cnpj,
      sourceCnpjName: match.sourceName,
      cnpjMatchStatus: MatchStatus.AUTO_MATCHED,
      cnpjMatchScore: 1,
    };
  }
  if (match?.kind === "FUZZY" || match?.kind === "AMBIGUOUS") {
    return {
      cnpj: null,
      sourceCnpjName: null,
      cnpjMatchStatus: MatchStatus.AMBIGUOUS,
      cnpjMatchScore: match.score,
    };
  }
  return {
    cnpj: null,
    sourceCnpjName: null,
    cnpjMatchStatus: MatchStatus.NOT_FOUND,
    cnpjMatchScore: match?.score ?? null,
  };
}

function importDates(parsed: ParsedImportWorkbook) {
  return [...new Set(parsed.aggregates.flatMap((item) => item.dailyPoints.map((day) => day.date)))].sort();
}

async function dateConflicts(client: Prisma.TransactionClient, parsed: ParsedImportWorkbook, now: Date) {
  const dates = importDates(parsed);
  const cycle = pointsCycleDefinitionForDate(now);
  const outside = dates.filter((date) => {
    const instant = new Date(`${date}T12:00:00-03:00`);
    return instant < cycle.startsAt || instant >= cycle.endsAt;
  });
  const issues: ImportIssue[] = [];
  if (outside.length) issues.push({ code: "DATE_OUTSIDE_CYCLE", severity: "error", message: `Datas fora do ciclo atual: ${outside.join(", ")}.` });
  if (!dates.length) return issues;
  const overlaps = await client.$queryRaw<Array<{ date: string }>>(Prisma.sql`
    SELECT DISTINCT day->>'date' AS date
    FROM "ImportCourierSnapshot" snapshot
    JOIN "ImportBatch" batch ON batch.id = snapshot."batchId"
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(snapshot."dailyPoints") = 'array' THEN snapshot."dailyPoints" ELSE '[]'::jsonb END) day
    WHERE batch.status IN ('COMPLETED'::"ImportStatus", 'COMPLETED_WITH_WARNINGS'::"ImportStatus")
      AND day->>'date' IN (${Prisma.join(dates)})
    ORDER BY date
  `);
  if (overlaps.length) issues.push({ code: "DATES_ALREADY_IMPORTED", severity: "error", message: `Datas já importadas: ${overlaps.map((item) => item.date).join(", ")}.` });
  const unknown = await client.importBatch.findFirst({
    where: { competenceKey: { in: [...new Set(dates.map((date) => date.slice(0, 7)))] }, status: { in: [ImportStatus.COMPLETED, ImportStatus.COMPLETED_WITH_WARNINGS] }, snapshots: { some: { dailyPoints: { equals: Prisma.DbNull } } } },
    select: { id: true },
  });
  if (unknown) issues.push({ code: "HISTORICAL_DATES_UNKNOWN", severity: "error", message: "Uma importação anterior deste mês não tem datas detalhadas. Revise o histórico antes de importar para evitar pontos duplicados." });
  return issues;
}

export async function buildImportPreview(
  parsed: ParsedImportWorkbook,
): Promise<ImportPreviewResponse> {
  let duplicateBatchId: string | null = null;
  const previewIssues = [...parsed.issues, ...await dateConflicts(db, parsed, new Date())];
  if (parsed.selectedPeriodKey) {
    const existing = await db.importBatch.findUnique({
      where: {
        fileHash_competenceKey_pointsColumn: {
          fileHash: parsed.fileHash,
          competenceKey: parsed.selectedPeriodKey,
          pointsColumn: parsed.pointsColumn.header,
        },
      },
      select: { id: true },
    });
    duplicateBatchId = existing?.id ?? null;
  }

  const matches = getCnpjMatchCounts(parsed);
  return {
    filename: parsed.filename,
    fileHash: parsed.fileHash,
    sheets: {
      data: parsed.dataSheet,
      cnpj: parsed.cnpjSheet,
      dataHeaderRow: parsed.dataHeaderRow,
      cnpjHeaderRow: parsed.cnpjHeaderRow,
    },
    columns: parsed.columns,
    selection: {
      pointsColumn: parsed.pointsColumn.header,
      pointsColumnIndex: parsed.pointsColumn.index,
      pointsColumnPosition: parsed.pointsColumn.position,
      pointsColumnLetter: parsed.pointsColumn.letter,
      periodKey: parsed.selectedPeriodKey,
      detectedPeriodKeys: parsed.detectedPeriodKeys,
      dates: importDates(parsed),
    },
    summary: {
      rows: parsed.rowCount,
      couriers: parsed.aggregates.length,
      totalPoints: parsed.totalPoints,
      cnpjRegistryEntries: parsed.cnpjEntries.length,
      cnpjMatches: matches,
      errors: issueCount(previewIssues, "error"),
      warnings: issueCount(previewIssues, "warning"),
    },
    issues: previewIssues,
    canCommit: parsed.canCommit && !duplicateBatchId && !previewIssues.some((issue) => issue.severity === "error"),
    duplicate: Boolean(duplicateBatchId),
    duplicateBatchId,
  };
}

interface ExistingCourier {
  id: string;
  externalCourierId: string | null;
  cnpj: string | null;
  sourceCnpjName: string | null;
  cnpjMatchStatus: MatchStatus;
  cnpjMatchScore: number | null;
}

function courierCreateData(
  aggregate: CourierAggregate,
  parsed: ParsedImportWorkbook,
  importedAt: Date,
) {
  const match = desiredMatch(parsed.cnpjMatches.get(aggregate.externalCourierId));
  return {
    externalCourierId: aggregate.externalCourierId,
    name: aggregate.name,
    normalizedName: aggregate.normalizedName,
    plaza: aggregate.plaza,
    subPlaza: aggregate.subPlaza,
    tag: aggregate.tag,
    source: aggregate.source,
    lastImportedAt: importedAt,
    ...match,
  };
}

async function bulkUpdateCouriers(
  tx: Prisma.TransactionClient,
  parsed: ParsedImportWorkbook,
  existingByExternalId: Map<string, ExistingCourier>,
  importedAt: Date,
) {
  const values = parsed.aggregates.flatMap((aggregate) => {
    const existing = existingByExternalId.get(aggregate.externalCourierId);
    if (!existing) return [];
    const automatedMatch = desiredMatch(parsed.cnpjMatches.get(aggregate.externalCourierId));
    const match =
      existing.cnpjMatchStatus === MatchStatus.MANUAL_MATCHED
        ? {
            cnpj: existing.cnpj,
            sourceCnpjName: existing.sourceCnpjName,
            cnpjMatchStatus: existing.cnpjMatchStatus,
            cnpjMatchScore: existing.cnpjMatchScore,
          }
        : automatedMatch;
    return [
      Prisma.sql`(
        ${existing.id}, ${aggregate.name}, ${aggregate.normalizedName},
        ${aggregate.plaza}, ${aggregate.subPlaza}, ${aggregate.tag}, ${aggregate.source},
        ${match.cnpj}, ${match.sourceCnpjName}, ${match.cnpjMatchStatus},
        ${match.cnpjMatchScore}
      )`,
    ];
  });

  if (!values.length) return;
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < values.length; i += CHUNK_SIZE) {
    const chunk = values.slice(i, i + CHUNK_SIZE);
    await tx.$executeRaw(Prisma.sql`
      UPDATE "Courier" AS courier
      SET
        "name" = incoming."name"::text,
        "normalizedName" = incoming."normalizedName"::text,
        "plaza" = incoming."plaza"::text,
        "subPlaza" = incoming."subPlaza"::text,
        "tag" = incoming."tag"::text,
        "source" = incoming."source"::text,
        "cnpj" = CASE
          WHEN courier."cnpjMatchStatus" = 'MANUAL_MATCHED'::"MatchStatus"
            THEN courier."cnpj"
          ELSE incoming."cnpj"::text
        END,
        "sourceCnpjName" = CASE
          WHEN courier."cnpjMatchStatus" = 'MANUAL_MATCHED'::"MatchStatus"
            THEN courier."sourceCnpjName"
          ELSE incoming."sourceCnpjName"::text
        END,
        "cnpjMatchStatus" = CASE
          WHEN courier."cnpjMatchStatus" = 'MANUAL_MATCHED'::"MatchStatus"
            THEN courier."cnpjMatchStatus"
          ELSE incoming."cnpjMatchStatus"::text::"MatchStatus"
        END,
        "cnpjMatchScore" = CASE
          WHEN courier."cnpjMatchStatus" = 'MANUAL_MATCHED'::"MatchStatus"
            THEN courier."cnpjMatchScore"
          ELSE incoming."cnpjMatchScore"::double precision
        END,
        "lastImportedAt" = ${importedAt},
        "updatedAt" = ${importedAt}
      FROM (VALUES ${Prisma.join(chunk)}) AS incoming(
        "id", "name", "normalizedName", "plaza", "subPlaza", "tag", "source",
        "cnpj", "sourceCnpjName", "cnpjMatchStatus", "cnpjMatchScore"
      )
      WHERE courier."id" = incoming."id"::text
    `);
  }
}

async function updateRegistryMatches(
  tx: Prisma.TransactionClient,
  parsed: ParsedImportWorkbook,
  courierIdByExternalId: Map<string, string>,
) {
  const exactValues: Prisma.Sql[] = [];
  const pendingValues = new Map<string, number | null>();

  for (const [externalCourierId, match] of parsed.cnpjMatches) {
    const courierId = courierIdByExternalId.get(externalCourierId);
    if (!courierId) continue;
    if (match.kind === "EXACT" && match.cnpj) {
      for (const sourceKey of match.sourceKeys) {
        exactValues.push(Prisma.sql`(${sourceKey}, ${courierId}, ${match.score})`);
      }
    } else if (match.kind === "FUZZY" || match.kind === "AMBIGUOUS") {
      for (const sourceKey of match.sourceKeys) pendingValues.set(sourceKey, match.score);
    }
  }

  if (pendingValues.size) {
    const values = [...pendingValues].map(
      ([sourceKey, score]) => Prisma.sql`(${sourceKey}, ${score})`,
    );
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < values.length; i += CHUNK_SIZE) {
      const chunk = values.slice(i, i + CHUNK_SIZE);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "CnpjRegistryEntry" AS entry
        SET
          "courierId" = NULL,
          "matchStatus" = 'AMBIGUOUS'::"MatchStatus",
          "matchScore" = incoming."score"::double precision,
          "updatedAt" = NOW()
        FROM (VALUES ${Prisma.join(chunk)}) AS incoming("sourceKey", "score")
        WHERE entry."sourceKey" = incoming."sourceKey"::text
          AND entry."matchStatus" <> 'MANUAL_MATCHED'::"MatchStatus"
      `);
    }
  }

  if (exactValues.length) {
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < exactValues.length; i += CHUNK_SIZE) {
      const chunk = exactValues.slice(i, i + CHUNK_SIZE);
      await tx.$executeRaw(Prisma.sql`
        UPDATE "CnpjRegistryEntry" AS entry
        SET
          "courierId" = incoming."courierId"::text,
          "matchStatus" = 'AUTO_MATCHED'::"MatchStatus",
          "matchScore" = incoming."score"::double precision,
          "updatedAt" = NOW()
        FROM (VALUES ${Prisma.join(chunk)}) AS incoming("sourceKey", "courierId", "score")
        WHERE entry."sourceKey" = incoming."sourceKey"::text
          AND entry."matchStatus" <> 'MANUAL_MATCHED'::"MatchStatus"
      `);
    }
  }
}

export async function commitImport({
  parsed,
  adminUserId,
}: CommitImportOptions): Promise<CommitImportResult> {
  if (!parsed.canCommit || !parsed.selectedPeriodKey) {
    throw new DomainError(
      "A planilha contém erros de validação. Revise a prévia antes de importar.",
      "IMPORT_VALIDATION_FAILED",
      422,
    );
  }

  const competenceKey = parsed.selectedPeriodKey;
  const parsedWarningCount = issueCount(parsed.issues, "warning");
  const now = new Date();
  const definition = pointsCycleDefinitionForDate(now);
  if (definition.endsAt <= now) throw new DomainError("O ciclo atual já foi encerrado. Atualize a página e tente novamente.", "PERIOD_EXPIRED", 409);

  // Mantém contas mensais abertas na virada da regra dentro do ciclo inicial.
  await ensureCurrentPeriod(now);

  return db.$transaction(
    async (tx) => {
      // Todas as importações do ciclo compartilham contas; serializa seus ajustes.
      await tx.$queryRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtext(${`lojinha-import:${definition.key}`}))::text
          AS "lock"
      `);

      const cyclePeriod = await tx.monthlyPeriod.upsert({
        where: { key: definition.key },
        update: {},
        create: definition,
      });
      await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "MonthlyPeriod" WHERE "id" = ${cyclePeriod.id} FOR UPDATE
      `);
      const lockedCycle = await tx.monthlyPeriod.findUniqueOrThrow({
        where: { id: cyclePeriod.id },
        select: { status: true, startsAt: true, endsAt: true },
      });
      const transactionNow = new Date();
      if (
        lockedCycle.status === PeriodStatus.CLOSED ||
        lockedCycle.startsAt > transactionNow ||
        lockedCycle.endsAt <= transactionNow
      ) {
        throw new DomainError(
          "O ciclo atual já foi encerrado e não aceita novas importações.",
          "PERIOD_CLOSED",
          409,
        );
      }

      const uniqueImport = {
        fileHash: parsed.fileHash,
        competenceKey,
        pointsColumn: parsed.pointsColumn.header,
      };
      const duplicate = await tx.importBatch.findUnique({
        where: { fileHash_competenceKey_pointsColumn: uniqueImport },
      });
      if (duplicate) {
        throw new DomainError("Esta planilha já foi importada. Nenhum ponto foi alterado.", "IMPORT_ALREADY_EXISTS", 409);
      }

      const conflicts = await dateConflicts(tx, parsed, transactionNow);
      if (conflicts.length) throw new DomainError(conflicts.map((issue) => issue.message).join(" "), "IMPORT_DATE_CONFLICT", 409);
      const period = cyclePeriod;

      const batch = await tx.importBatch.create({
        data: {
          filename: parsed.filename,
          ...uniqueImport,
          periodId: period.id,
          dataSheet: parsed.dataSheet,
          cnpjSheet: parsed.cnpjSheet,
          pointsColumnIndex: parsed.pointsColumn.position,
          status: ImportStatus.PROCESSING,
          rowCount: parsed.rowCount,
          courierCount: parsed.aggregates.length,
          totalPoints: parsed.totalPoints,
          warningCount: parsedWarningCount,
          warnings: jsonValue(parsed.issues),
          createdById: adminUserId,
        },
      });

      if (parsed.cnpjEntries.length) {
        const entries = parsed.cnpjEntries.map((entry) => ({
          sourceName: entry.sourceName,
          normalizedName: entry.normalizedName,
          cnpj: entry.cnpj,
          sourceRow: entry.sourceRow,
          sourceKey: entry.sourceKey,
        }));
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
          await tx.cnpjRegistryEntry.createMany({
            data: entries.slice(i, i + CHUNK_SIZE),
            skipDuplicates: true,
          });
        }
      }
      const manualRegistryEntries = parsed.cnpjEntries.length
        ? await tx.cnpjRegistryEntry.findMany({
            where: {
              sourceKey: { in: parsed.cnpjEntries.map((entry) => entry.sourceKey) },
              matchStatus: MatchStatus.MANUAL_MATCHED,
            },
            select: {
              sourceKey: true,
              courier: { select: { externalCourierId: true } },
            },
          })
        : [];
      const manualTargetBySourceKey = new Map(
        manualRegistryEntries.map((entry) => [
          entry.sourceKey,
          entry.courier?.externalCourierId ?? null,
        ]),
      );
      let manualMatchConflictCount = 0;
      const effectiveMatches = new Map(parsed.cnpjMatches);
      for (const [externalCourierId, match] of effectiveMatches) {
        if (match.kind !== "EXACT") continue;
        const conflictsWithManualDecision = match.sourceKeys.some((sourceKey) => {
          if (!manualTargetBySourceKey.has(sourceKey)) return false;
          return manualTargetBySourceKey.get(sourceKey) !== externalCourierId;
        });
        if (!conflictsWithManualDecision) continue;
        manualMatchConflictCount += 1;
        effectiveMatches.set(externalCourierId, {
          ...match,
          kind: "AMBIGUOUS",
          cnpj: null,
          sourceName: null,
        });
      }
      const proposedCnpjs = [...effectiveMatches.values()].flatMap((match) =>
        match.kind === "EXACT" && match.cnpj ? [match.cnpj] : [],
      );
      const existingCnpjOwners = proposedCnpjs.length
        ? await tx.courier.findMany({
            where: { cnpj: { in: proposedCnpjs } },
            select: { cnpj: true, externalCourierId: true },
          })
        : [];
      const ownerByCnpj = new Map(
        existingCnpjOwners.flatMap((owner) =>
          owner.cnpj ? [[owner.cnpj, owner.externalCourierId] as const] : [],
        ),
      );
      for (const [externalCourierId, match] of effectiveMatches) {
        if (match.kind !== "EXACT" || !match.cnpj) continue;
        const currentOwner = ownerByCnpj.get(match.cnpj);
        if (!currentOwner || currentOwner === externalCourierId) continue;
        manualMatchConflictCount += 1;
        effectiveMatches.set(externalCourierId, {
          ...match,
          kind: "AMBIGUOUS",
          cnpj: null,
          sourceName: null,
        });
      }
      const effectiveParsed: ParsedImportWorkbook = manualMatchConflictCount
        ? { ...parsed, cnpjMatches: effectiveMatches }
        : parsed;

      const externalIds = parsed.aggregates.map((aggregate) => aggregate.externalCourierId);
      const existingCouriers = await tx.courier.findMany({
        where: { externalCourierId: { in: externalIds } },
        select: {
          id: true,
          externalCourierId: true,
          cnpj: true,
          sourceCnpjName: true,
          cnpjMatchStatus: true,
          cnpjMatchScore: true,
        },
      });
      const existingByExternalId = new Map(
        existingCouriers.flatMap((courier) =>
          courier.externalCourierId ? [[courier.externalCourierId, courier] as const] : [],
        ),
      );

      const newCouriers = parsed.aggregates.filter(
        (aggregate) => !existingByExternalId.has(aggregate.externalCourierId),
      );
      if (newCouriers.length) {
        const data = newCouriers.map((aggregate) =>
          courierCreateData(aggregate, effectiveParsed, now),
        );
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
          await tx.courier.createMany({
            data: data.slice(i, i + CHUNK_SIZE),
            skipDuplicates: true,
          });
        }
      }
      await bulkUpdateCouriers(tx, effectiveParsed, existingByExternalId, now);

      const couriers = await tx.courier.findMany({
        where: { externalCourierId: { in: externalIds } },
        select: { id: true, externalCourierId: true },
      });
      const courierIdByExternalId = new Map(
        couriers.flatMap((courier) =>
          courier.externalCourierId ? [[courier.externalCourierId, courier.id] as const] : [],
        ),
      );
      if (courierIdByExternalId.size !== parsed.aggregates.length) {
        throw new DomainError(
          "Não foi possível criar todos os entregadores da importação.",
          "COURIER_IMPORT_CONFLICT",
          409,
        );
      }

      await tx.cnpjRegistryEntry.updateMany({
        where: {
          courierId: { in: [...courierIdByExternalId.values()] },
          matchStatus: MatchStatus.AUTO_MATCHED,
        },
        data: {
          courierId: null,
          matchStatus: MatchStatus.PENDING,
          matchScore: null,
        },
      });
      await updateRegistryMatches(tx, effectiveParsed, courierIdByExternalId);

      const courierIds = [...courierIdByExternalId.values()];
      const relevantAccountIds = courierIds;
      // Materializar primeiro elimina a janela de corrida de uma conta inexistente:
      // ajustes concorrentes passam a disputar a mesma linha, em vez de criarem
      // uma conta entre a leitura e o createMany da importação.
      const accountData = courierIds.map((courierId) => ({ courierId, periodId: period.id }));
      const CHUNK_SIZE = 1000;
      for (let i = 0; i < accountData.length; i += CHUNK_SIZE) {
        await tx.pointAccount.createMany({
          data: accountData.slice(i, i + CHUNK_SIZE),
          skipDuplicates: true,
        });
      }

      // Resgates e ajustes também atualizam PointAccount. O lock precisa vir
      // antes da leitura do saldo para que o UPDATE absoluto e o balanceAfter
      // do ledger usem o estado confirmado mais recente.
      await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id"
        FROM "PointAccount"
        WHERE "periodId" = ${period.id}
          AND "courierId" IN (${Prisma.join(relevantAccountIds)})
        ORDER BY "id"
        FOR UPDATE
      `);

      const periodAccounts = await tx.pointAccount.findMany({
        where: {
          periodId: period.id,
          courierId: { in: relevantAccountIds },
        },
      });
      const existingAccountByCourierId = new Map(
        periodAccounts.map((account) => [account.courierId, account]),
      );
      const accountUpdates: Prisma.Sql[] = [];
      const ledgerRows: Prisma.PointLedgerEntryCreateManyInput[] = [];
      const snapshotRows: Prisma.ImportCourierSnapshotCreateManyInput[] = [];

      for (const aggregate of parsed.aggregates) {
        const courierId = courierIdByExternalId.get(aggregate.externalCourierId)!;
        const account = existingAccountByCourierId.get(courierId);
        if (!account) {
          throw new DomainError(
            "Não foi possível criar todas as contas de pontos da importação.",
            "POINT_ACCOUNT_CONFLICT",
            409,
          );
        }
        const previousPoints = 0;
        const deltaPoints = aggregate.points;
        const importedPointsAfter = account.importedPoints + deltaPoints;
        const balanceAfter = account.balancePoints + deltaPoints;
        if (importedPointsAfter < 0 || importedPointsAfter > MAX_DATABASE_INT || balanceAfter < 0 || balanceAfter > MAX_DATABASE_INT) {
          throw new DomainError(
            "Uma correção deixaria o saldo fora do intervalo permitido. Ajuste os resgates ou os pontos antes de importar.",
            "INVALID_BALANCE_AFTER_IMPORT",
            409,
          );
        }
        if (deltaPoints !== 0) {
          accountUpdates.push(
            Prisma.sql`(${account.id}, ${importedPointsAfter}, ${balanceAfter})`,
          );
        }
        if (deltaPoints !== 0) {
          ledgerRows.push({
            accountId: account.id,
            type:
              previousPoints === 0 && deltaPoints > 0
                ? PointEntryType.IMPORT_CREDIT
                : PointEntryType.IMPORT_CORRECTION,
            amount: deltaPoints,
            balanceAfter,
            description:
              previousPoints === 0 && deltaPoints > 0
                ? `Crédito da importação da competência ${competenceKey}`
                : `Correção da importação da competência ${competenceKey}`,
            referenceType: "IMPORT_BATCH",
            referenceId: batch.id,
            importBatchId: batch.id,
            actorUserId: adminUserId,
          });
        }
        snapshotRows.push({
          batchId: batch.id,
          courierId,
          externalCourierId: aggregate.externalCourierId,
          sourceName: aggregate.name,
          normalizedName: aggregate.normalizedName,
          sourceRowCount: aggregate.sourceRowCount,
          points: aggregate.points,
          dailyPoints: jsonValue(aggregate.dailyPoints),
          previousPoints,
          deltaPoints,
          warnings: aggregate.warnings.length ? jsonValue(aggregate.warnings) : undefined,
        });
      }

      if (accountUpdates.length) {
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < accountUpdates.length; i += CHUNK_SIZE) {
          const chunk = accountUpdates.slice(i, i + CHUNK_SIZE);
          await tx.$executeRaw(Prisma.sql`
            UPDATE "PointAccount" AS account
            SET
              "importedPoints" = incoming."importedPoints"::integer,
              "balancePoints" = incoming."balancePoints"::integer,
              "version" = account."version" + 1,
              "updatedAt" = NOW()
            FROM (VALUES ${Prisma.join(chunk)}) AS incoming(
              "id", "importedPoints", "balancePoints"
            )
            WHERE account."id" = incoming."id"::text
          `);
        }
      }
      if (ledgerRows.length) {
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < ledgerRows.length; i += CHUNK_SIZE) {
          await tx.pointLedgerEntry.createMany({ data: ledgerRows.slice(i, i + CHUNK_SIZE) });
        }
      }
      if (snapshotRows.length) {
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < snapshotRows.length; i += CHUNK_SIZE) {
          await tx.importCourierSnapshot.createMany({ data: snapshotRows.slice(i, i + CHUNK_SIZE) });
        }
      }

      const warningCount = parsedWarningCount + manualMatchConflictCount;
      const finalIssues: unknown[] = [...parsed.issues];
      if (manualMatchConflictCount) {
        finalIssues.push({
          code: "CNPJ_AMBIGUOUS",
          severity: "warning",
          message:
            "Correspondências automáticas conflitantes com vínculos de CNPJ existentes ficaram pendentes.",
          count: manualMatchConflictCount,
        });
      }
      const status = warningCount
        ? ImportStatus.COMPLETED_WITH_WARNINGS
        : ImportStatus.COMPLETED;
      await tx.importBatch.update({
        where: { id: batch.id },
        data: {
          status,
          processedAt: now,
          warningCount,
          warnings: jsonValue(finalIssues),
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: adminUserId,
          action: "EXCEL_IMPORT_COMPLETED",
          entityType: "ImportBatch",
          entityId: batch.id,
          metadata: {
            periodKey: competenceKey,
            cycleKey: definition.key,
            pointsColumn: parsed.pointsColumn.header,
            rowCount: parsed.rowCount,
            courierCount: parsed.aggregates.length,
            totalPoints: parsed.totalPoints,
            warningCount,
          },
        },
      });

      return {
        batchId: batch.id,
        status,
        duplicate: false,
        periodKey: competenceKey,
        rows: parsed.rowCount,
        couriers: parsed.aggregates.length,
        totalPoints: parsed.totalPoints,
        warningCount,
      };
    },
    {
      // READ COMMITTED faz a transação que aguardou o advisory lock enxergar
      // o lote concluído pela transação anterior e retornar como duplicado.
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 15_000,
      timeout: 120_000,
    },
  );
}
