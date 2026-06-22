-- CORE-09C: logical archive support for subjects and courses.
ALTER TABLE "Subject"
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "archivedReason" TEXT;

ALTER TABLE "Course"
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "archivedReason" TEXT;

CREATE INDEX "Subject_archivedAt_idx" ON "Subject"("archivedAt");
CREATE INDEX "Course_archivedAt_idx" ON "Course"("archivedAt");
