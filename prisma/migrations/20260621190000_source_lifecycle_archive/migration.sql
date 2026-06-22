ALTER TABLE "Document" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN "archivedReason" TEXT;

CREATE INDEX "Document_archivedAt_idx" ON "Document"("archivedAt");
