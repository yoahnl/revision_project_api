-- CORE-01: additive Course backbone for the MVP Core.
-- No data is deleted and no backfill is applied by this migration.

CREATE TYPE "RevisionSessionMode" AS ENUM ('QUICK', 'DEEP', 'EXAM');

CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "chapterLabel" TEXT,
    "estimatedMinutes" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Document" ADD COLUMN "courseId" TEXT;

ALTER TABLE "RevisionSession"
ADD COLUMN "courseId" TEXT,
ADD COLUMN "mode" "RevisionSessionMode" NOT NULL DEFAULT 'QUICK';

CREATE INDEX "Course_studentId_idx" ON "Course"("studentId");
CREATE INDEX "Course_subjectId_studentId_idx" ON "Course"("subjectId", "studentId");
CREATE INDEX "Course_subjectId_displayOrder_idx" ON "Course"("subjectId", "displayOrder");
CREATE UNIQUE INDEX "Course_id_studentId_key" ON "Course"("id", "studentId");

CREATE INDEX "Document_courseId_idx" ON "Document"("courseId");
CREATE INDEX "RevisionSession_courseId_idx" ON "RevisionSession"("courseId");

ALTER TABLE "Course"
ADD CONSTRAINT "Course_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Course"
ADD CONSTRAINT "Course_subjectId_studentId_fkey"
FOREIGN KEY ("subjectId", "studentId") REFERENCES "Subject"("id", "studentId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Document"
ADD CONSTRAINT "Document_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RevisionSession"
ADD CONSTRAINT "RevisionSession_courseId_studentId_fkey"
FOREIGN KEY ("courseId", "studentId") REFERENCES "Course"("id", "studentId")
ON DELETE NO ACTION ON UPDATE CASCADE;
