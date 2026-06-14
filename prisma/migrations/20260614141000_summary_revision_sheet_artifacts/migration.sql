-- CreateEnum
CREATE TYPE "StudyArtifactStatus" AS ENUM ('READY', 'FAILED');

-- CreateEnum
CREATE TYPE "StudyArtifactSourceStrategy" AS ENUM ('DOCUMENT_CHUNKS', 'DOCUMENT_CHUNKS_AND_KNOWLEDGE_UNITS');

-- CreateTable
CREATE TABLE "Summary" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "StudyArtifactStatus" NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "keyPoints" JSONB,
    "limits" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "flowName" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "inputSize" INTEGER,
    "sourceStrategy" "StudyArtifactSourceStrategy" NOT NULL,
    "errorCode" TEXT,

    CONSTRAINT "Summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SummarySource" (
    "summaryId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SummarySource_pkey" PRIMARY KEY ("summaryId","chunkId")
);

-- CreateTable
CREATE TABLE "RevisionSheet" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "StudyArtifactStatus" NOT NULL,
    "title" TEXT,
    "introduction" TEXT,
    "keyPoints" JSONB,
    "commonMistakes" JSONB,
    "mustKnow" JSONB,
    "practiceSuggestions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "flowName" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "inputSize" INTEGER,
    "sourceStrategy" "StudyArtifactSourceStrategy" NOT NULL,
    "errorCode" TEXT,

    CONSTRAINT "RevisionSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionSheetSection" (
    "id" TEXT NOT NULL,
    "revisionSheetId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionSheetSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionSheetSectionSource" (
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionSheetSectionSource_pkey" PRIMARY KEY ("sectionId","chunkId")
);

-- CreateIndex
CREATE INDEX "Summary_studentId_idx" ON "Summary"("studentId");

-- CreateIndex
CREATE INDEX "Summary_subjectId_idx" ON "Summary"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Summary_documentId_key" ON "Summary"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Summary_id_subjectId_key" ON "Summary"("id", "subjectId");

-- CreateIndex
CREATE INDEX "SummarySource_chunkId_idx" ON "SummarySource"("chunkId");

-- CreateIndex
CREATE INDEX "SummarySource_subjectId_idx" ON "SummarySource"("subjectId");

-- CreateIndex
CREATE INDEX "RevisionSheet_studentId_idx" ON "RevisionSheet"("studentId");

-- CreateIndex
CREATE INDEX "RevisionSheet_subjectId_idx" ON "RevisionSheet"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionSheet_documentId_key" ON "RevisionSheet"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionSheet_id_subjectId_key" ON "RevisionSheet"("id", "subjectId");

-- CreateIndex
CREATE INDEX "RevisionSheetSection_subjectId_idx" ON "RevisionSheetSection"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionSheetSection_revisionSheetId_displayOrder_key" ON "RevisionSheetSection"("revisionSheetId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionSheetSection_id_subjectId_key" ON "RevisionSheetSection"("id", "subjectId");

-- CreateIndex
CREATE INDEX "RevisionSheetSectionSource_chunkId_idx" ON "RevisionSheetSectionSource"("chunkId");

-- CreateIndex
CREATE INDEX "RevisionSheetSectionSource_subjectId_idx" ON "RevisionSheetSectionSource"("subjectId");

-- AddForeignKey
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_subjectId_studentId_fkey" FOREIGN KEY ("subjectId", "studentId") REFERENCES "Subject"("id", "studentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_documentId_subjectId_fkey" FOREIGN KEY ("documentId", "subjectId") REFERENCES "Document"("id", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SummarySource" ADD CONSTRAINT "SummarySource_summaryId_subjectId_fkey" FOREIGN KEY ("summaryId", "subjectId") REFERENCES "Summary"("id", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SummarySource" ADD CONSTRAINT "SummarySource_chunkId_subjectId_fkey" FOREIGN KEY ("chunkId", "subjectId") REFERENCES "DocumentChunk"("id", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSheet" ADD CONSTRAINT "RevisionSheet_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSheet" ADD CONSTRAINT "RevisionSheet_subjectId_studentId_fkey" FOREIGN KEY ("subjectId", "studentId") REFERENCES "Subject"("id", "studentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSheet" ADD CONSTRAINT "RevisionSheet_documentId_subjectId_fkey" FOREIGN KEY ("documentId", "subjectId") REFERENCES "Document"("id", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSheetSection" ADD CONSTRAINT "RevisionSheetSection_revisionSheetId_subjectId_fkey" FOREIGN KEY ("revisionSheetId", "subjectId") REFERENCES "RevisionSheet"("id", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSheetSectionSource" ADD CONSTRAINT "RevisionSheetSectionSource_sectionId_subjectId_fkey" FOREIGN KEY ("sectionId", "subjectId") REFERENCES "RevisionSheetSection"("id", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSheetSectionSource" ADD CONSTRAINT "RevisionSheetSectionSource_chunkId_subjectId_fkey" FOREIGN KEY ("chunkId", "subjectId") REFERENCES "DocumentChunk"("id", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

