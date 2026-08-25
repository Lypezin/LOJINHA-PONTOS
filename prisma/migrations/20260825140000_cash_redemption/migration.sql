-- CreateEnum
CREATE TYPE "RedemptionFulfillmentType" AS ENUM ('PRODUCT', 'CASH');

-- AlterTable
ALTER TABLE "Redemption" ADD COLUMN "fulfillmentType" "RedemptionFulfillmentType" NOT NULL DEFAULT 'PRODUCT',
ADD COLUMN "cashAmountCents" INTEGER,
ADD COLUMN "pixKey" TEXT;
