CREATE TABLE "RevisionQuestionDraftAnswer" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "activitySessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedChoiceIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevisionQuestionDraftAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RevisionQuestionDraftAnswer_studentId_sessionId_questionId_key" ON "RevisionQuestionDraftAnswer"("studentId", "sessionId", "questionId");
CREATE INDEX "RevisionQuestionDraftAnswer_studentId_sessionId_idx" ON "RevisionQuestionDraftAnswer"("studentId", "sessionId");
CREATE INDEX "RevisionQuestionDraftAnswer_activitySessionId_idx" ON "RevisionQuestionDraftAnswer"("activitySessionId");
CREATE INDEX "RevisionQuestionDraftAnswer_questionId_idx" ON "RevisionQuestionDraftAnswer"("questionId");

ALTER TABLE "RevisionQuestionDraftAnswer"
ADD CONSTRAINT "RevisionQuestionDraftAnswer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RevisionQuestionDraftAnswer"
ADD CONSTRAINT "RevisionQuestionDraftAnswer_sessionId_studentId_fkey" FOREIGN KEY ("sessionId", "studentId") REFERENCES "RevisionSession"("id", "studentId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RevisionQuestionDraftAnswer"
ADD CONSTRAINT "RevisionQuestionDraftAnswer_activitySessionId_fkey" FOREIGN KEY ("activitySessionId") REFERENCES "ActivitySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RevisionQuestionDraftAnswer"
ADD CONSTRAINT "RevisionQuestionDraftAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
