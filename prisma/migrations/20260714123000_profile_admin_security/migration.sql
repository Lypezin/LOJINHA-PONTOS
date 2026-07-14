-- Perfil editável sem alterar o nome operacional importado do entregador.
ALTER TABLE "User"
  ADD COLUMN "displayName" VARCHAR(100),
  ADD COLUMN "avatarData" BYTEA,
  ADD COLUMN "avatarMimeType" VARCHAR(32),
  ADD COLUMN "avatarUpdatedAt" TIMESTAMP(3);

-- A aplicação acessa o banco somente pelo usuário de backend. As tabelas não
-- devem ficar expostas diretamente pela Data API do Supabase.
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CnpjGuideEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CnpjRegistryEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Courier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImportBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImportCourierSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MonthlyPeriod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PointAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PointLedgerEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimitBucket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Redemption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SystemSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  "AuditLog",
  "CnpjGuideEntry",
  "CnpjRegistryEntry",
  "Courier",
  "ImportBatch",
  "ImportCourierSnapshot",
  "MonthlyPeriod",
  "PasswordResetToken",
  "PointAccount",
  "PointLedgerEntry",
  "Product",
  "RateLimitBucket",
  "Redemption",
  "Session",
  "SystemSetting",
  "User",
  "_prisma_migrations"
FROM anon, authenticated;

-- O Security Advisor recomenda que extensões não sejam instaladas em public.
CREATE SCHEMA IF NOT EXISTS extensions;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension extension
    JOIN pg_namespace namespace ON namespace.oid = extension.extnamespace
    WHERE extension.extname = 'pg_trgm' AND namespace.nspname = 'public'
  ) THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END
$$;
