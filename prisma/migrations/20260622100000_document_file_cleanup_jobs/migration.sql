-- CreateTable
CREATE TABLE "DocumentFileCleanupJob" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "studentId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentFileCleanupJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentFileCleanupJob_status_createdAt_idx" ON "DocumentFileCleanupJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentFileCleanupJob_documentId_idx" ON "DocumentFileCleanupJob"("documentId");

-- CreateIndex
CREATE INDEX "DocumentFileCleanupJob_studentId_idx" ON "DocumentFileCleanupJob"("studentId");
