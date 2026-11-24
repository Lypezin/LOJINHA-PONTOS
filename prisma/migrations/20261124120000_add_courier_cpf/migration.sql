-- AlterTable
ALTER TABLE "Courier" ADD COLUMN IF NOT EXISTS "cpf" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Courier_cpf_key" ON "Courier"("cpf");
