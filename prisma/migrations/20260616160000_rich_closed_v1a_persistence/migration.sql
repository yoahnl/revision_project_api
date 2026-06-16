-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'RICH_CLOSED_EXERCISE';

-- CreateTable
CREATE TABLE "RichClosedExercisePayload" (
    "id" TEXT NOT NULL,
    "activitySessionId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "documentId" TEXT,
    "knowledgeUnitId" TEXT NOT NULL,
    "exercisePayload" JSONB NOT NULL,
    "generationMetadata" JSONB,
    "qualityMetrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RichClosedExercisePayload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RichClosedExerciseResult" (
    "id" TEXT NOT NULL,
    "activitySessionId" TEXT NOT NULL,
    "answersPayload" JSONB NOT NULL,
    "correctionPayload" JSONB NOT NULL,
    "correctAnswers" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RichClosedExerciseResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RichClosedExercisePayload_activitySessionId_key" ON "RichClosedExercisePayload"("activitySessionId");

-- CreateIndex
CREATE INDEX "RichClosedExercisePayload_subjectId_idx" ON "RichClosedExercisePayload"("subjectId");

-- CreateIndex
CREATE INDEX "RichClosedExercisePayload_documentId_idx" ON "RichClosedExercisePayload"("documentId");

-- CreateIndex
CREATE INDEX "RichClosedExercisePayload_knowledgeUnitId_idx" ON "RichClosedExercisePayload"("knowledgeUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "RichClosedExerciseResult_activitySessionId_key" ON "RichClosedExerciseResult"("activitySessionId");

-- AddForeignKey
ALTER TABLE "RichClosedExercisePayload" ADD CONSTRAINT "RichClosedExercisePayload_activitySessionId_fkey" FOREIGN KEY ("activitySessionId") REFERENCES "ActivitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RichClosedExerciseResult" ADD CONSTRAINT "RichClosedExerciseResult_activitySessionId_fkey" FOREIGN KEY ("activitySessionId") REFERENCES "ActivitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
