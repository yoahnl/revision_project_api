-- CreateEnum
CREATE TYPE "OpenAnswerEvaluationStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'OPEN_QUESTION';

-- AlterEnum
ALTER TYPE "ActivityStatus" ADD VALUE 'SUBMITTED';

-- CreateTable
CREATE TABLE "OpenQuestion" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "documentId" TEXT,
    "knowledgeUnitId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "instructions" TEXT,
    "maxAnswerLength" INTEGER NOT NULL DEFAULT 4000,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenQuestionSource" (
    "questionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpenQuestionSource_pkey" PRIMARY KEY ("questionId","chunkId")
);

-- CreateTable
CREATE TABLE "OpenAnswerEvaluation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "openQuestionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "answerText" TEXT NOT NULL,
    "status" "OpenAnswerEvaluationStatus" NOT NULL DEFAULT 'PENDING',
    "score" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "feedback" TEXT,
    "presentPoints" JSONB,
    "missingPoints" JSONB,
    "errors" JSONB,
    "modelAnswer" TEXT,
    "advice" TEXT,
    "generationFlowName" TEXT,
    "generationProvider" TEXT,
    "generationModel" TEXT,
    "generationPromptVersion" TEXT,
    "generationSchemaVersion" TEXT,
    "generationInputSize" INTEGER,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenAnswerEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpenQuestion_sessionId_key" ON "OpenQuestion"("sessionId");

-- CreateIndex
CREATE INDEX "OpenQuestion_studentId_idx" ON "OpenQuestion"("studentId");

-- CreateIndex
CREATE INDEX "OpenQuestion_subjectId_idx" ON "OpenQuestion"("subjectId");

-- CreateIndex
CREATE INDEX "OpenQuestion_documentId_idx" ON "OpenQuestion"("documentId");

-- CreateIndex
CREATE INDEX "OpenQuestion_knowledgeUnitId_idx" ON "OpenQuestion"("knowledgeUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "OpenQuestion_id_subjectId_key" ON "OpenQuestion"("id", "subjectId");

-- CreateIndex
CREATE INDEX "OpenQuestionSource_chunkId_idx" ON "OpenQuestionSource"("chunkId");

-- CreateIndex
CREATE INDEX "OpenQuestionSource_subjectId_idx" ON "OpenQuestionSource"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "OpenAnswerEvaluation_sessionId_key" ON "OpenAnswerEvaluation"("sessionId");

-- CreateIndex
CREATE INDEX "OpenAnswerEvaluation_studentId_idx" ON "OpenAnswerEvaluation"("studentId");

-- CreateIndex
CREATE INDEX "OpenAnswerEvaluation_subjectId_idx" ON "OpenAnswerEvaluation"("subjectId");

-- CreateIndex
CREATE INDEX "OpenAnswerEvaluation_openQuestionId_idx" ON "OpenAnswerEvaluation"("openQuestionId");

-- AddForeignKey
ALTER TABLE "OpenQuestion" ADD CONSTRAINT "OpenQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ActivitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenQuestion" ADD CONSTRAINT "OpenQuestion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenQuestion" ADD CONSTRAINT "OpenQuestion_subjectId_studentId_fkey" FOREIGN KEY ("subjectId", "studentId") REFERENCES "Subject"("id", "studentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenQuestion" ADD CONSTRAINT "OpenQuestion_documentId_subjectId_fkey" FOREIGN KEY ("documentId", "subjectId") REFERENCES "Document"("id", "subjectId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenQuestion" ADD CONSTRAINT "OpenQuestion_knowledgeUnitId_subjectId_fkey" FOREIGN KEY ("knowledgeUnitId", "subjectId") REFERENCES "KnowledgeUnit"("id", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenQuestionSource" ADD CONSTRAINT "OpenQuestionSource_questionId_subjectId_fkey" FOREIGN KEY ("questionId", "subjectId") REFERENCES "OpenQuestion"("id", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenQuestionSource" ADD CONSTRAINT "OpenQuestionSource_chunkId_subjectId_fkey" FOREIGN KEY ("chunkId", "subjectId") REFERENCES "DocumentChunk"("id", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenAnswerEvaluation" ADD CONSTRAINT "OpenAnswerEvaluation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ActivitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenAnswerEvaluation" ADD CONSTRAINT "OpenAnswerEvaluation_openQuestionId_subjectId_fkey" FOREIGN KEY ("openQuestionId", "subjectId") REFERENCES "OpenQuestion"("id", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenAnswerEvaluation" ADD CONSTRAINT "OpenAnswerEvaluation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenAnswerEvaluation" ADD CONSTRAINT "OpenAnswerEvaluation_subjectId_studentId_fkey" FOREIGN KEY ("subjectId", "studentId") REFERENCES "Subject"("id", "studentId") ON DELETE CASCADE ON UPDATE CASCADE;
