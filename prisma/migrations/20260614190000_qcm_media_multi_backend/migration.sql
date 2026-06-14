-- CreateEnum
CREATE TYPE "QuestionSelectionMode" AS ENUM ('SINGLE', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "QuestionVisualType" AS ENUM ('IMAGE', 'CHART', 'DIAGRAM');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "correctChoiceIds" JSONB,
ADD COLUMN     "maxSelections" INTEGER,
ADD COLUMN     "minSelections" INTEGER,
ADD COLUMN     "selectionMode" "QuestionSelectionMode" NOT NULL DEFAULT 'SINGLE',
ALTER COLUMN "correctChoiceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "QuestionAnswer" ALTER COLUMN "selectedChoiceId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "QuestionVisual" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "type" "QuestionVisualType" NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionVisual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionVisualSource" (
    "visualId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionVisualSource_pkey" PRIMARY KEY ("visualId","chunkId")
);

-- CreateTable
CREATE TABLE "QuestionAnswerChoice" (
    "answerId" TEXT NOT NULL,
    "choiceId" TEXT NOT NULL,

    CONSTRAINT "QuestionAnswerChoice_pkey" PRIMARY KEY ("answerId","choiceId")
);

-- CreateIndex
CREATE INDEX "QuestionVisual_questionId_idx" ON "QuestionVisual"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionVisual_questionId_displayOrder_key" ON "QuestionVisual"("questionId", "displayOrder");

-- CreateIndex
CREATE INDEX "QuestionVisualSource_chunkId_idx" ON "QuestionVisualSource"("chunkId");

-- CreateIndex
CREATE INDEX "QuestionVisualSource_subjectId_idx" ON "QuestionVisualSource"("subjectId");

-- AddForeignKey
ALTER TABLE "QuestionVisual" ADD CONSTRAINT "QuestionVisual_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionVisualSource" ADD CONSTRAINT "QuestionVisualSource_visualId_fkey" FOREIGN KEY ("visualId") REFERENCES "QuestionVisual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionVisualSource" ADD CONSTRAINT "QuestionVisualSource_chunkId_subjectId_fkey" FOREIGN KEY ("chunkId", "subjectId") REFERENCES "DocumentChunk"("id", "subjectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswerChoice" ADD CONSTRAINT "QuestionAnswerChoice_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "QuestionAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
