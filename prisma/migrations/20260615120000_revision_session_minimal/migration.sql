-- CreateEnum
CREATE TYPE "RevisionSessionStatus" AS ENUM ('STARTED', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "RevisionSessionActionKind" AS ENUM ('DIAGNOSTIC_QUIZ', 'OPEN_QUESTION');

-- CreateEnum
CREATE TYPE "RevisionSessionActionStatus" AS ENUM ('READY', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "RevisionSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "documentId" TEXT,
    "knowledgeUnitId" TEXT,
    "status" "RevisionSessionStatus" NOT NULL DEFAULT 'STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RevisionSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionSessionAction" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "kind" "RevisionSessionActionKind" NOT NULL,
    "status" "RevisionSessionActionStatus" NOT NULL DEFAULT 'READY',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "activitySessionId" TEXT,
    "documentId" TEXT,
    "knowledgeUnitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RevisionSessionAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RevisionSession_studentId_idx" ON "RevisionSession"("studentId");

-- CreateIndex
CREATE INDEX "RevisionSession_subjectId_idx" ON "RevisionSession"("subjectId");

-- CreateIndex
CREATE INDEX "RevisionSession_documentId_idx" ON "RevisionSession"("documentId");

-- CreateIndex
CREATE INDEX "RevisionSession_knowledgeUnitId_idx" ON "RevisionSession"("knowledgeUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionSession_id_studentId_key" ON "RevisionSession"("id", "studentId");

-- CreateIndex
CREATE INDEX "RevisionSessionAction_studentId_idx" ON "RevisionSessionAction"("studentId");

-- CreateIndex
CREATE INDEX "RevisionSessionAction_subjectId_idx" ON "RevisionSessionAction"("subjectId");

-- CreateIndex
CREATE INDEX "RevisionSessionAction_activitySessionId_idx" ON "RevisionSessionAction"("activitySessionId");

-- CreateIndex
CREATE INDEX "RevisionSessionAction_documentId_idx" ON "RevisionSessionAction"("documentId");

-- CreateIndex
CREATE INDEX "RevisionSessionAction_knowledgeUnitId_idx" ON "RevisionSessionAction"("knowledgeUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "RevisionSessionAction_sessionId_displayOrder_key" ON "RevisionSessionAction"("sessionId", "displayOrder");

-- AddForeignKey
ALTER TABLE "RevisionSession" ADD CONSTRAINT "RevisionSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSession" ADD CONSTRAINT "RevisionSession_subjectId_studentId_fkey" FOREIGN KEY ("subjectId", "studentId") REFERENCES "Subject"("id", "studentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSession" ADD CONSTRAINT "RevisionSession_documentId_subjectId_fkey" FOREIGN KEY ("documentId", "subjectId") REFERENCES "Document"("id", "subjectId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSession" ADD CONSTRAINT "RevisionSession_knowledgeUnitId_subjectId_fkey" FOREIGN KEY ("knowledgeUnitId", "subjectId") REFERENCES "KnowledgeUnit"("id", "subjectId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSessionAction" ADD CONSTRAINT "RevisionSessionAction_sessionId_studentId_fkey" FOREIGN KEY ("sessionId", "studentId") REFERENCES "RevisionSession"("id", "studentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSessionAction" ADD CONSTRAINT "RevisionSessionAction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSessionAction" ADD CONSTRAINT "RevisionSessionAction_subjectId_studentId_fkey" FOREIGN KEY ("subjectId", "studentId") REFERENCES "Subject"("id", "studentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSessionAction" ADD CONSTRAINT "RevisionSessionAction_activitySessionId_fkey" FOREIGN KEY ("activitySessionId") REFERENCES "ActivitySession"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSessionAction" ADD CONSTRAINT "RevisionSessionAction_documentId_subjectId_fkey" FOREIGN KEY ("documentId", "subjectId") REFERENCES "Document"("id", "subjectId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionSessionAction" ADD CONSTRAINT "RevisionSessionAction_knowledgeUnitId_subjectId_fkey" FOREIGN KEY ("knowledgeUnitId", "subjectId") REFERENCES "KnowledgeUnit"("id", "subjectId") ON DELETE NO ACTION ON UPDATE CASCADE;
