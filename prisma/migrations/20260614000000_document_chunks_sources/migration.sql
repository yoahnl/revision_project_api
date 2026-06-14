-- CreateEnum
CREATE TYPE "KnowledgeUnitDifficulty" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "KnowledgeUnit" ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "difficulty" "KnowledgeUnitDifficulty",
ADD COLUMN     "displayOrder" INTEGER,
ADD COLUMN     "extractionPromptVersion" TEXT,
ADD COLUMN     "extractionSchemaVersion" TEXT;

-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "charStart" INTEGER,
    "charEnd" INTEGER,
    "pageNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeUnitSource" (
    "knowledgeUnitId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeUnitSource_pkey" PRIMARY KEY ("knowledgeUnitId","chunkId")
);

-- CreateIndex
CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");

-- CreateIndex
CREATE INDEX "DocumentChunk_subjectId_idx" ON "DocumentChunk"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentChunk_documentId_index_key" ON "DocumentChunk"("documentId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentChunk_id_subjectId_key" ON "DocumentChunk"("id", "subjectId");

-- CreateIndex
CREATE INDEX "KnowledgeUnitSource_chunkId_idx" ON "KnowledgeUnitSource"("chunkId");

-- CreateIndex
CREATE INDEX "KnowledgeUnitSource_subjectId_idx" ON "KnowledgeUnitSource"("subjectId");

-- CreateIndex
CREATE INDEX "KnowledgeUnit_documentId_idx" ON "KnowledgeUnit"("documentId");

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_subjectId_fkey" FOREIGN KEY ("documentId", "subjectId") REFERENCES "Document"("id", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeUnitSource" ADD CONSTRAINT "KnowledgeUnitSource_knowledgeUnitId_subjectId_fkey" FOREIGN KEY ("knowledgeUnitId", "subjectId") REFERENCES "KnowledgeUnit"("id", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeUnitSource" ADD CONSTRAINT "KnowledgeUnitSource_chunkId_subjectId_fkey" FOREIGN KEY ("chunkId", "subjectId") REFERENCES "DocumentChunk"("id", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;
