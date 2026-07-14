-- O CNPJ passa a ser o documento de identidade do entregador na lojinha.
-- Campos antigos de CPF são preservados temporariamente apenas para uma
-- implantação retrocompatível; o domínio da aplicação não os utiliza mais.

UPDATE "Courier" AS courier
SET "cnpj" = '11222333000181',
    "cnpjMatchStatus" = 'MANUAL_MATCHED'::"MatchStatus",
    "cnpjMatchScore" = 1
FROM "User" AS app_user
WHERE app_user."courierId" = courier."id"
  AND app_user."emailNormalized" = 'entregador@demo.local'
  AND courier."cnpj" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Courier" existing WHERE existing."cnpj" = '11222333000181'
  );

DROP INDEX IF EXISTS "Courier_cnpj_idx";
CREATE UNIQUE INDEX "Courier_cnpj_key" ON "Courier"("cnpj");
