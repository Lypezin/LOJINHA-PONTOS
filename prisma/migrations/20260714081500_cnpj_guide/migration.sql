CREATE TABLE "CnpjGuideEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "courierId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'ADMIN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CnpjGuideEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CnpjGuideEntry_cnpj_key" ON "CnpjGuideEntry"("cnpj");
CREATE UNIQUE INDEX "CnpjGuideEntry_courierId_key" ON "CnpjGuideEntry"("courierId");
CREATE INDEX "CnpjGuideEntry_normalizedName_idx" ON "CnpjGuideEntry"("normalizedName");
CREATE INDEX "CnpjGuideEntry_name_idx" ON "CnpjGuideEntry"("name");

ALTER TABLE "CnpjGuideEntry"
ADD CONSTRAINT "CnpjGuideEntry_courierId_fkey"
FOREIGN KEY ("courierId") REFERENCES "Courier"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "CnpjGuideEntry" (
    "id", "name", "normalizedName", "cnpj", "courierId", "source", "createdAt", "updatedAt"
)
SELECT
    'guide_' || "id", "name", "normalizedName", "cnpj", "id", 'BASE_EXISTENTE', NOW(), NOW()
FROM "Courier"
WHERE "cnpj" IS NOT NULL
ON CONFLICT DO NOTHING;
