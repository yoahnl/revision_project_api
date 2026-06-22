CREATE TABLE "CourseQuestionBankPreparationJob" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "knowledgeUnitId" TEXT NOT NULL,
    "targetQuestionCount" INTEGER NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseQuestionBankPreparationJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CourseQuestionBankPreparationJob_status_createdAt_idx" ON "CourseQuestionBankPreparationJob"("status", "createdAt");
CREATE INDEX "CourseQuestionBankPreparationJob_courseId_status_idx" ON "CourseQuestionBankPreparationJob"("courseId", "status");
CREATE INDEX "CourseQuestionBankPreparationJob_studentId_courseId_status_idx" ON "CourseQuestionBankPreparationJob"("studentId", "courseId", "status");
