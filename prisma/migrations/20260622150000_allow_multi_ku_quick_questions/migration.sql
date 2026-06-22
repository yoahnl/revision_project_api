ALTER TABLE "Question" DROP CONSTRAINT IF EXISTS "Question_sessionId_knowledgeUnitId_fkey";

ALTER TABLE "Question"
  ADD CONSTRAINT "Question_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "ActivitySession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
