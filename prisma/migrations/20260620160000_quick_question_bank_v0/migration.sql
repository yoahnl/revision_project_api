-- CreateEnum
CREATE TYPE "QuestionBankItemStatus" AS ENUM ('ACTIVE', 'FLAGGED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "bankQuestionId" TEXT;

-- CreateTable
CREATE TABLE "QuestionBankItem" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "documentId" TEXT,
    "knowledgeUnitId" TEXT NOT NULL,
    "status" "QuestionBankItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "prompt" TEXT NOT NULL,
    "difficulty" "KnowledgeUnitDifficulty",
    "choices" JSONB NOT NULL,
    "selectionMode" "QuestionSelectionMode" NOT NULL DEFAULT 'SINGLE',
    "minSelections" INTEGER,
    "maxSelections" INTEGER,
    "correctChoiceId" TEXT,
    "correctChoiceIds" JSONB,
    "explanation" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "askedCount" INTEGER NOT NULL DEFAULT 0,
    "lastAskedAt" TIMESTAMP(3),
    "flaggedAt" TIMESTAMP(3),
    "flagReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionBankItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionBankItemSource" (
    "questionBankItemId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionBankItemSource_pkey" PRIMARY KEY ("questionBankItemId","chunkId")
);

-- CreateTable
CREATE TABLE "QuestionBankItemVisual" (
    "id" TEXT NOT NULL,
    "questionBankItemId" TEXT NOT NULL,
    "type" "QuestionVisualType" NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionBankItemVisual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Question_bankQuestionId_idx" ON "Question"("bankQuestionId");

-- CreateIndex
CREATE INDEX "QuestionBankItem_studentId_idx" ON "QuestionBankItem"("studentId");

-- CreateIndex
CREATE INDEX "QuestionBankItem_subjectId_idx" ON "QuestionBankItem"("subjectId");

-- CreateIndex
CREATE INDEX "QuestionBankItem_courseId_status_idx" ON "QuestionBankItem"("courseId", "status");

-- CreateIndex
CREATE INDEX "QuestionBankItem_knowledgeUnitId_idx" ON "QuestionBankItem"("knowledgeUnitId");

-- CreateIndex
CREATE INDEX "QuestionBankItem_askedCount_idx" ON "QuestionBankItem"("askedCount");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionBankItem_courseId_fingerprint_key" ON "QuestionBankItem"("courseId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionBankItem_id_subjectId_key" ON "QuestionBankItem"("id", "subjectId");

-- CreateIndex
CREATE INDEX "QuestionBankItemSource_chunkId_idx" ON "QuestionBankItemSource"("chunkId");

-- CreateIndex
CREATE INDEX "QuestionBankItemSource_subjectId_idx" ON "QuestionBankItemSource"("subjectId");

-- CreateIndex
CREATE INDEX "QuestionBankItemVisual_questionBankItemId_idx" ON "QuestionBankItemVisual"("questionBankItemId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionBankItemVisual_questionBankItemId_displayOrder_key" ON "QuestionBankItemVisual"("questionBankItemId", "displayOrder");

-- AddForeignKey
ALTER TABLE "QuestionBankItem" ADD CONSTRAINT "QuestionBankItem_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankItem" ADD CONSTRAINT "QuestionBankItem_subjectId_studentId_fkey" FOREIGN KEY ("subjectId", "studentId") REFERENCES "Subject"("id", "studentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankItem" ADD CONSTRAINT "QuestionBankItem_courseId_studentId_fkey" FOREIGN KEY ("courseId", "studentId") REFERENCES "Course"("id", "studentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankItem" ADD CONSTRAINT "QuestionBankItem_documentId_subjectId_fkey" FOREIGN KEY ("documentId", "subjectId") REFERENCES "Document"("id", "subjectId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankItem" ADD CONSTRAINT "QuestionBankItem_knowledgeUnitId_subjectId_fkey" FOREIGN KEY ("knowledgeUnitId", "subjectId") REFERENCES "KnowledgeUnit"("id", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankItemSource" ADD CONSTRAINT "QuestionBankItemSource_questionBankItemId_subjectId_fkey" FOREIGN KEY ("questionBankItemId", "subjectId") REFERENCES "QuestionBankItem"("id", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankItemSource" ADD CONSTRAINT "QuestionBankItemSource_chunkId_subjectId_fkey" FOREIGN KEY ("chunkId", "subjectId") REFERENCES "DocumentChunk"("id", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBankItemVisual" ADD CONSTRAINT "QuestionBankItemVisual_questionBankItemId_fkey" FOREIGN KEY ("questionBankItemId") REFERENCES "QuestionBankItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_bankQuestionId_fkey" FOREIGN KEY ("bankQuestionId") REFERENCES "QuestionBankItem"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
