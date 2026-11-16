ALTER TABLE "ImportBatch"
ADD COLUMN "competenceKey" TEXT;

UPDATE "ImportBatch" AS batch
SET "competenceKey" = period."key"
FROM "MonthlyPeriod" AS period
WHERE batch."periodId" = period."id";

ALTER TABLE "ImportBatch"
ALTER COLUMN "competenceKey" SET NOT NULL;

DROP INDEX "ImportBatch_fileHash_periodId_pointsColumn_key";
CREATE UNIQUE INDEX "ImportBatch_fileHash_competenceKey_pointsColumn_key"
ON "ImportBatch"("fileHash", "competenceKey", "pointsColumn");

DROP INDEX "MonthlyPeriod_year_month_key";
CREATE INDEX "MonthlyPeriod_year_month_idx"
ON "MonthlyPeriod"("year", "month");

-- No início da nova regra, nenhum saldo mensal anterior é carregado.
-- O valor disponível é movido para expiredPoints e fica auditável no extrato.
WITH balances AS (
  SELECT account."id", account."periodId", account."balancePoints" AS amount
  FROM "PointAccount" AS account
  WHERE account."balancePoints" > 0
  FOR UPDATE OF account
), updated AS (
  UPDATE "PointAccount" AS account
  SET
    "expiredPoints" = account."expiredPoints" + balances.amount,
    "balancePoints" = 0,
    "version" = account."version" + 1,
    "updatedAt" = TIMESTAMP '2026-11-16 03:00:00'
  FROM balances
  WHERE account."id" = balances."id"
  RETURNING account."id", balances."periodId", balances.amount
)
INSERT INTO "PointLedgerEntry" (
  "id", "accountId", "type", "amount", "balanceAfter", "description",
  "referenceType", "referenceId", "createdAt"
)
SELECT
  gen_random_uuid()::text,
  updated."id",
  'EXPIRATION'::"PointEntryType",
  -updated.amount,
  0,
  'Zeragem do saldo anterior ao início do ciclo fixo em 16/11/2026',
  'PERIOD',
  updated."periodId",
  TIMESTAMP '2026-11-16 03:00:00'
FROM updated;

UPDATE "MonthlyPeriod"
SET
  "status" = 'CLOSED'::"PeriodStatus",
  "closedAt" = TIMESTAMP '2026-11-16 03:00:00',
  "endsAt" = TIMESTAMP '2026-11-16 03:00:00',
  "updatedAt" = TIMESTAMP '2026-11-16 03:00:00'
WHERE "status" = 'OPEN'::"PeriodStatus";

UPDATE "SystemSetting"
SET
  "value" = '{"type":"FIXED_CYCLE","lengthDays":75,"startDate":"2026-11-16","timeZone":"America/Sao_Paulo"}'::jsonb,
  "description" = 'Os pontos disponíveis vencem ao fim de cada ciclo fixo de 75 dias, iniciado em 16/11/2026.'
WHERE "key" = 'points.expirationPolicy';
