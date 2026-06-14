-- AlterTable
ALTER TABLE "ActivitySession" ADD COLUMN     "documentId" TEXT,
ADD COLUMN     "generationFlowName" TEXT,
ADD COLUMN     "generationInputSize" INTEGER,
ADD COLUMN     "generationModel" TEXT,
ADD COLUMN     "generationPromptVersion" TEXT,
ADD COLUMN     "generationProvider" TEXT,
ADD COLUMN     "generationSchemaVersion" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "difficulty" "KnowledgeUnitDifficulty",
ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "documentId" TEXT,
ADD COLUMN     "subjectId" TEXT;

-- AlterTable
ALTER TABLE "ActivityResult" ADD COLUMN     "score" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "QuestionSource" (
    "questionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionSource_pkey" PRIMARY KEY ("questionId","chunkId")
);

-- CreateTable
CREATE TABLE "QuestionAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedChoiceId" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionSource_chunkId_idx" ON "QuestionSource"("chunkId");

-- CreateIndex
CREATE INDEX "QuestionSource_subjectId_idx" ON "QuestionSource"("subjectId");

-- CreateIndex
CREATE INDEX "QuestionAnswer_questionId_idx" ON "QuestionAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionAnswer_sessionId_questionId_key" ON "QuestionAnswer"("sessionId", "questionId");

-- CreateIndex
CREATE INDEX "ActivitySession_documentId_idx" ON "ActivitySession"("documentId");

-- CreateIndex
CREATE INDEX "Question_sessionId_idx" ON "Question"("sessionId");

-- CreateIndex
CREATE INDEX "Question_subjectId_idx" ON "Question"("subjectId");

-- CreateIndex
CREATE INDEX "Question_documentId_idx" ON "Question"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_id_subjectId_key" ON "Question"("id", "subjectId");

-- AddForeignKey
ALTER TABLE "QuestionSource" ADD CONSTRAINT "QuestionSource_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSource" ADD CONSTRAINT "QuestionSource_chunkId_subjectId_fkey" FOREIGN KEY ("chunkId", "subjectId") REFERENCES "DocumentChunk"("id", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ActivitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
