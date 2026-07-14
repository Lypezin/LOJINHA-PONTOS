CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Courier_status_name_idx" ON "Courier"("status", "name");
CREATE INDEX "Courier_name_trgm_idx" ON "Courier" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "User_email_trgm_idx" ON "User" USING GIN ("email" gin_trgm_ops);
CREATE INDEX "CnpjGuideEntry_name_trgm_idx" ON "CnpjGuideEntry" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "ImportBatch_createdAt_idx" ON "ImportBatch"("createdAt");
CREATE INDEX "Product_status_featured_sortOrder_name_idx" ON "Product"("status", "featured", "sortOrder", "name");
CREATE INDEX "Redemption_requestedAt_idx" ON "Redemption"("requestedAt");
