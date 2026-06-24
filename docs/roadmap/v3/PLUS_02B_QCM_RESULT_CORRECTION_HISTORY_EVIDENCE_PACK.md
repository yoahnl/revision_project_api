# PLUS-02B - Evidence pack API

Ce pack capture le diff complet des fichiers produit/test API pour PLUS-02B. Les documents V3 du lot sont exclus pour eviter un artefact auto-recursif ; ils sont listes dans le rapport.

## Diff stat produit/test

```text
 src/modules/activities/activities.module.ts        |   3 +
 .../application/activities.repository.ts           |   7 +
 .../rich-closed-question.types.ts                  |  33 ++++
 .../start-rich-closed-exercise.use-case.spec.ts    |   1 +
 .../submit-rich-closed-exercise.use-case.spec.ts   |  33 +++-
 .../start-open-question-activity.use-case.spec.ts  |   1 +
 .../submit-open-answer.use-case.spec.ts            |   1 +
 .../prisma-activities.repository.spec.ts           | 180 +++++++++++++++++-
 .../infrastructure/prisma-activities.repository.ts | 206 ++++++++++++++++++++-
 .../courses/interfaces/courses.controller.spec.ts  |  55 ++++++
 .../courses/interfaces/courses.controller.ts       |  17 ++
 11 files changed, 516 insertions(+), 21 deletions(-)
```

## Diff complet des fichiers suivis produit/test

```diff
diff --git a/src/modules/activities/activities.module.ts b/src/modules/activities/activities.module.ts
index 0c901b1..fa4180f 100644
--- a/src/modules/activities/activities.module.ts
+++ b/src/modules/activities/activities.module.ts
@@ -11,6 +11,7 @@ import { OPEN_QUESTION_GENERATOR } from './application/open-question-generator';
 import { QUESTION_BANK_REPOSITORY } from './application/question-bank.repository';
 import { GetRichClosedExerciseResultUseCase } from './application/rich-closed-questions/get-rich-closed-exercise-result.use-case';
 import { GetRichClosedExerciseUseCase } from './application/rich-closed-questions/get-rich-closed-exercise.use-case';
+import { ListCourseRichClosedExerciseHistoryUseCase } from './application/rich-closed-questions/list-course-rich-closed-exercise-history.use-case';
 import { RICH_CLOSED_QUESTION_GENERATOR } from './application/rich-closed-questions/rich-closed-question-generator';
 import { StartRichClosedExerciseUseCase } from './application/rich-closed-questions/start-rich-closed-exercise.use-case';
 import { SubmitRichClosedExerciseUseCase } from './application/rich-closed-questions/submit-rich-closed-exercise.use-case';
@@ -38,6 +39,7 @@ import { ActivitiesController } from './interfaces/activities.controller';
     GetRichClosedExerciseUseCase,
     SubmitRichClosedExerciseUseCase,
     GetRichClosedExerciseResultUseCase,
+    ListCourseRichClosedExerciseHistoryUseCase,
     SubmitActivityResultUseCase,
     SubmitOpenAnswerUseCase,
     QuestionBankService,
@@ -69,6 +71,7 @@ import { ActivitiesController } from './interfaces/activities.controller';
   exports: [
     StartNextActivityUseCase,
     StartOpenQuestionActivityUseCase,
+    ListCourseRichClosedExerciseHistoryUseCase,
     QuestionBankService,
     QUESTION_BANK_REPOSITORY,
   ],
diff --git a/src/modules/activities/application/activities.repository.ts b/src/modules/activities/application/activities.repository.ts
index 377a43f..52e25de 100644
--- a/src/modules/activities/application/activities.repository.ts
+++ b/src/modules/activities/application/activities.repository.ts
@@ -17,6 +17,7 @@ import type {
 import type {
   RichClosedAnswer,
   RichClosedExercise,
+  RichClosedExerciseHistoryResponse,
   RichClosedExerciseResult,
   RichClosedPublicExerciseEnvelope,
 } from './rich-closed-questions/rich-closed-question.types';
@@ -283,6 +284,12 @@ export interface ActivitiesRepository {
     sessionId: string;
   }): Promise<RichClosedExerciseResult>;

+  listCourseRichClosedExerciseHistoryForStudent(input: {
+    studentId: string;
+    courseId: string;
+    limit: number;
+  }): Promise<RichClosedExerciseHistoryResponse>;
+
   submitResult(input: {
     studentId: string;
     sessionId: string;
diff --git a/src/modules/activities/application/rich-closed-questions/rich-closed-question.types.ts b/src/modules/activities/application/rich-closed-questions/rich-closed-question.types.ts
index 734740f..729daf5 100644
--- a/src/modules/activities/application/rich-closed-questions/rich-closed-question.types.ts
+++ b/src/modules/activities/application/rich-closed-questions/rich-closed-question.types.ts
@@ -590,12 +590,45 @@ export interface RichClosedExerciseResult {
   sessionId: string;
   type: 'rich_closed_exercise';
   status: 'completed';
+  subjectId?: string;
+  documentId?: string | null;
+  knowledgeUnitId?: string;
+  createdAt?: Date;
+  completedAt?: Date;
+  durationSeconds?: number | null;
   correctAnswers: number;
   totalQuestions: number;
   score: number;
   items: RichClosedCorrectionItem[];
 }

+export interface RichClosedExerciseHistoryResponse {
+  items: RichClosedExerciseHistoryItem[];
+}
+
+export interface RichClosedExerciseHistoryItem {
+  id: string;
+  sessionId: string;
+  type: 'rich_closed_exercise';
+  status: 'completed';
+  title: string;
+  subjectId: string;
+  documentId: string | null;
+  knowledgeUnit: {
+    id: string;
+    title: string;
+  };
+  course: {
+    id: string;
+    title: string;
+  };
+  correctAnswers: number;
+  totalQuestions: number;
+  score: number;
+  completedAt: Date;
+  resultPath: string;
+}
+
 export interface RichClosedExercise {
   id: string;
   version: RichClosedExerciseVersion;
diff --git a/src/modules/activities/application/rich-closed-questions/start-rich-closed-exercise.use-case.spec.ts b/src/modules/activities/application/rich-closed-questions/start-rich-closed-exercise.use-case.spec.ts
index dd9e203..f0d93c2 100644
--- a/src/modules/activities/application/rich-closed-questions/start-rich-closed-exercise.use-case.spec.ts
+++ b/src/modules/activities/application/rich-closed-questions/start-rich-closed-exercise.use-case.spec.ts
@@ -276,6 +276,7 @@ function createActivitiesRepository(): jest.Mocked<ActivitiesRepository> {
     getInternalRichClosedExerciseForStudent: jest.fn(),
     saveRichClosedExerciseResult: jest.fn(),
     getRichClosedExerciseResultForStudent: jest.fn(),
+    listCourseRichClosedExerciseHistoryForStudent: jest.fn(),
   };
 }

diff --git a/src/modules/activities/application/rich-closed-questions/submit-rich-closed-exercise.use-case.spec.ts b/src/modules/activities/application/rich-closed-questions/submit-rich-closed-exercise.use-case.spec.ts
index f762fbc..80a9960 100644
--- a/src/modules/activities/application/rich-closed-questions/submit-rich-closed-exercise.use-case.spec.ts
+++ b/src/modules/activities/application/rich-closed-questions/submit-rich-closed-exercise.use-case.spec.ts
@@ -79,11 +79,7 @@ describe('rich closed exercise use cases', () => {
       sessionId: 'rich-session-1',
       status: 'COMPLETED',
       exercise: richClosedExerciseFixture(),
-      result: scoreRichClosedExerciseSubmission({
-        sessionId: 'rich-session-1',
-        exercise: richClosedExerciseFixture(),
-        answers: correctAnswers(),
-      }),
+      result: richClosedResult(),
     });

     await expect(
@@ -107,6 +103,10 @@ describe('rich closed exercise use cases', () => {
     ).resolves.toMatchObject({
       sessionId: 'rich-session-1',
       status: 'completed',
+      subjectId: 'subject-1',
+      documentId: 'document-1',
+      knowledgeUnitId: 'unit-1',
+      durationSeconds: 420,
     });

     repository.getRichClosedExerciseResultForStudent.mockRejectedValueOnce(
@@ -123,11 +123,7 @@ describe('rich closed exercise use cases', () => {

 function createActivitiesRepository(): jest.Mocked<ActivitiesRepository> {
   const exercise = richClosedExerciseFixture();
-  const result = scoreRichClosedExerciseSubmission({
-    sessionId: 'rich-session-1',
-    exercise,
-    answers: correctAnswers(),
-  });
+  const result = richClosedResult();

   return {
     findDiagnosticQuizGenerationContext: jest.fn(),
@@ -158,6 +154,23 @@ function createActivitiesRepository(): jest.Mocked<ActivitiesRepository> {
     }),
     saveRichClosedExerciseResult: jest.fn().mockResolvedValue(result),
     getRichClosedExerciseResultForStudent: jest.fn().mockResolvedValue(result),
+    listCourseRichClosedExerciseHistoryForStudent: jest.fn(),
+  };
+}
+
+function richClosedResult() {
+  return {
+    ...scoreRichClosedExerciseSubmission({
+      sessionId: 'rich-session-1',
+      exercise: richClosedExerciseFixture(),
+      answers: correctAnswers(),
+    }),
+    subjectId: 'subject-1',
+    documentId: 'document-1',
+    knowledgeUnitId: 'unit-1',
+    createdAt: new Date('2026-06-18T10:00:00.000Z'),
+    completedAt: new Date('2026-06-18T10:07:00.000Z'),
+    durationSeconds: 420,
   };
 }

diff --git a/src/modules/activities/application/start-open-question-activity.use-case.spec.ts b/src/modules/activities/application/start-open-question-activity.use-case.spec.ts
index 874fc34..d0f3173 100644
--- a/src/modules/activities/application/start-open-question-activity.use-case.spec.ts
+++ b/src/modules/activities/application/start-open-question-activity.use-case.spec.ts
@@ -170,6 +170,7 @@ function createActivitiesRepository(): jest.Mocked<ActivitiesRepository> {
     createOpenQuestionActivity: jest.fn(),
     findOpenAnswerEvaluationContext: jest.fn(),
     saveOpenAnswerEvaluation: jest.fn(),
+    listCourseRichClosedExerciseHistoryForStudent: jest.fn(),
   };
 }

diff --git a/src/modules/activities/application/submit-open-answer.use-case.spec.ts b/src/modules/activities/application/submit-open-answer.use-case.spec.ts
index 48ab023..6e58d5f 100644
--- a/src/modules/activities/application/submit-open-answer.use-case.spec.ts
+++ b/src/modules/activities/application/submit-open-answer.use-case.spec.ts
@@ -310,6 +310,7 @@ function createActivitiesRepository(): jest.Mocked<ActivitiesRepository> {
     createOpenQuestionActivity: jest.fn(),
     findOpenAnswerEvaluationContext: jest.fn(),
     saveOpenAnswerEvaluation: jest.fn(),
+    listCourseRichClosedExerciseHistoryForStudent: jest.fn(),
   };
 }

diff --git a/src/modules/activities/infrastructure/prisma-activities.repository.spec.ts b/src/modules/activities/infrastructure/prisma-activities.repository.spec.ts
index d9a7a1c..b5de860 100644
--- a/src/modules/activities/infrastructure/prisma-activities.repository.spec.ts
+++ b/src/modules/activities/infrastructure/prisma-activities.repository.spec.ts
@@ -21,6 +21,8 @@ type ActivitySessionRecord = {
   generationSchemaVersion: string | null;
   generationInputSize: number | null;
   status: 'STARTED' | 'SUBMITTED' | 'COMPLETED';
+  type: 'DIAGNOSTIC_QUIZ' | 'OPEN_QUESTION' | 'RICH_CLOSED_EXERCISE';
+  createdAt: Date;
   completedAt: Date | null;
 };

@@ -239,6 +241,26 @@ type RichClosedExerciseSessionRecord = ActivitySessionRecord & {
   richClosedExerciseResult: RichClosedExerciseResultRecord | null;
 };

+type RichClosedExerciseHistorySessionRecord =
+  RichClosedExerciseSessionRecord & {
+    richClosedExercisePayload: RichClosedExercisePayloadRecord;
+    richClosedExerciseResult: RichClosedExerciseResultRecord;
+    knowledgeUnit: {
+      id: string;
+      title: string;
+      documentId: string | null;
+    };
+  };
+
+type CourseRecord = {
+  id: string;
+  subjectId: string;
+  title: string;
+  documents: Array<{
+    id: string;
+  }>;
+};
+
 type KnowledgeUnitRecord = {
   id: string;
   subjectId: string;
@@ -257,6 +279,9 @@ type SessionWithQuestions = ActivitySessionRecord & {
 };

 type PrismaActivitiesMock = {
+  course: {
+    findFirst: jest.Mock;
+  };
   knowledgeUnit: {
     findFirst: jest.Mock;
   };
@@ -266,6 +291,7 @@ type PrismaActivitiesMock = {
   activitySession: {
     create: jest.Mock<ActivitySessionRecord, [ActivitySessionCreatePayload]>;
     findFirst: jest.Mock;
+    findMany: jest.Mock;
     update: jest.Mock<ActivitySessionRecord, [ActivitySessionUpdatePayload]>;
   };
   question: {
@@ -318,6 +344,9 @@ describe('PrismaActivitiesRepository', () => {

   const createRepository = () => {
     const prisma: PrismaActivitiesMock = {
+      course: {
+        findFirst: jest.fn(),
+      },
       knowledgeUnit: {
         findFirst: jest.fn(),
       },
@@ -330,6 +359,7 @@ describe('PrismaActivitiesRepository', () => {
           [ActivitySessionCreatePayload]
         >(),
         findFirst: jest.fn(),
+        findMany: jest.fn(),
         update: jest.fn<
           ActivitySessionRecord,
           [ActivitySessionUpdatePayload]
@@ -403,6 +433,8 @@ describe('PrismaActivitiesRepository', () => {
     generationSchemaVersion: null,
     generationInputSize: null,
     status: 'STARTED',
+    type: 'DIAGNOSTIC_QUIZ',
+    createdAt,
     completedAt: null,
     ...input,
   });
@@ -573,6 +605,38 @@ describe('PrismaActivitiesRepository', () => {
     ...input,
   });

+  const richClosedHistorySessionRecord = (
+    input: Partial<RichClosedExerciseHistorySessionRecord> = {},
+  ): RichClosedExerciseHistorySessionRecord => ({
+    ...richClosedSessionRecord({
+      status: 'COMPLETED',
+      createdAt: new Date('2026-06-18T10:00:00.000Z'),
+      completedAt: new Date('2026-06-18T10:07:00.000Z'),
+    }),
+    richClosedExercisePayload: richClosedPayloadRecord({
+      title: 'Questions riches - Constitution',
+    }),
+    richClosedExerciseResult: richClosedResultRecord({
+      correctAnswers: 5,
+      totalQuestions: 6,
+      score: 0.833,
+    }),
+    knowledgeUnit: {
+      id: 'unit-1',
+      title: 'Séparation des pouvoirs',
+      documentId: 'document-1',
+    },
+    ...input,
+  });
+
+  const courseRecord = (input: Partial<CourseRecord> = {}): CourseRecord => ({
+    id: 'course-1',
+    subjectId: 'subject-1',
+    title: 'Droit constitutionnel',
+    documents: [{ id: 'document-1' }],
+    ...input,
+  });
+
   const generatedQuizQuestions = (questionCount: number) =>
     Array.from({ length: questionCount }, (_value, index) => ({
       prompt: `Question de revision ${index + 1}`,
@@ -1969,7 +2033,15 @@ describe('PrismaActivitiesRepository', () => {
         completedAt: expect.any(Date) as Date,
       },
     });
-    expect(saved).toEqual(result);
+    expect(saved).toMatchObject({
+      ...result,
+      subjectId: 'subject-1',
+      documentId: 'document-1',
+      knowledgeUnitId: 'unit-1',
+      createdAt,
+      completedAt: expect.any(Date) as Date,
+      durationSeconds: expect.any(Number) as number,
+    });

     prisma.activitySession.findFirst.mockResolvedValue(
       richClosedSessionRecord({
@@ -1986,12 +2058,118 @@ describe('PrismaActivitiesRepository', () => {
       sessionId: 'session-1',
       type: 'rich_closed_exercise',
       status: 'completed',
+      subjectId: 'subject-1',
+      documentId: 'document-1',
+      knowledgeUnitId: 'unit-1',
+      createdAt,
+      completedAt: expect.any(Date) as Date,
+      durationSeconds: expect.any(Number) as number,
       correctAnswers: 6,
       totalQuestions: 6,
       score: 1,
     });
   });

+  it('lists lightweight completed rich closed history for a course owner', async () => {
+    const { prisma, repository } = createRepository();
+    prisma.course.findFirst.mockResolvedValue(courseRecord());
+    prisma.activitySession.findMany.mockResolvedValue([
+      richClosedHistorySessionRecord(),
+    ]);
+
+    const history =
+      await repository.listCourseRichClosedExerciseHistoryForStudent({
+        studentId: 'student-1',
+        courseId: 'course-1',
+        limit: 5,
+      });
+
+    expect(prisma.course.findFirst).toHaveBeenCalledWith({
+      where: {
+        id: 'course-1',
+        studentId: 'student-1',
+        archivedAt: null,
+        subject: {
+          archivedAt: null,
+        },
+      },
+      include: {
+        documents: {
+          where: {
+            archivedAt: null,
+          },
+          select: {
+            id: true,
+          },
+        },
+      },
+    });
+    expect(prisma.activitySession.findMany).toHaveBeenCalledWith({
+      where: {
+        studentId: 'student-1',
+        type: 'RICH_CLOSED_EXERCISE',
+        status: 'COMPLETED',
+        richClosedExerciseResult: {
+          isNot: null,
+        },
+        OR: [
+          {
+            documentId: {
+              in: ['document-1'],
+            },
+          },
+          {
+            knowledgeUnit: {
+              documentId: {
+                in: ['document-1'],
+              },
+            },
+          },
+        ],
+      },
+      include: {
+        richClosedExercisePayload: true,
+        richClosedExerciseResult: true,
+        knowledgeUnit: {
+          select: {
+            id: true,
+            title: true,
+            documentId: true,
+          },
+        },
+      },
+      orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
+      take: 5,
+    });
+    expect(history.items).toEqual([
+      expect.objectContaining({
+        id: 'session-1',
+        sessionId: 'session-1',
+        type: 'rich_closed_exercise',
+        status: 'completed',
+        title: 'Questions riches - Constitution',
+        subjectId: 'subject-1',
+        documentId: 'document-1',
+        correctAnswers: 5,
+        totalQuestions: 6,
+        score: 0.833,
+        resultPath: '/activities/rich-closed/session-1/result',
+        course: {
+          id: 'course-1',
+          title: 'Droit constitutionnel',
+        },
+        knowledgeUnit: {
+          id: 'unit-1',
+          title: 'Séparation des pouvoirs',
+        },
+      }),
+    ]);
+    expect(JSON.stringify(history)).not.toContain('correctionPayload');
+    expect(JSON.stringify(history)).not.toContain('answersPayload');
+    expect(JSON.stringify(history)).not.toContain('submittedAnswer');
+    expect(JSON.stringify(history)).not.toContain('questionId');
+  });
+
   it('rejects rich closed double submit', async () => {
     const { prisma, repository } = createRepository();
     const result = scoreRichClosedExerciseSubmission({
diff --git a/src/modules/activities/infrastructure/prisma-activities.repository.ts b/src/modules/activities/infrastructure/prisma-activities.repository.ts
index 4c90956..0ff47a5 100644
--- a/src/modules/activities/infrastructure/prisma-activities.repository.ts
+++ b/src/modules/activities/infrastructure/prisma-activities.repository.ts
@@ -45,6 +45,8 @@ import { toRichClosedPublicExerciseEnvelope } from '../application/rich-closed-q
 import type {
   RichClosedAnswer,
   RichClosedExercise,
+  RichClosedExerciseHistoryItem,
+  RichClosedExerciseHistoryResponse,
   RichClosedExerciseResult,
   RichClosedPublicExerciseEnvelope,
 } from '../application/rich-closed-questions/rich-closed-question.types';
@@ -94,12 +96,15 @@ type QuestionVisualRecord = {

 type ActivitySessionRecord = {
   id: string;
+  studentId?: string;
   subjectId: string;
   knowledgeUnitId: string;
   type: ActivityType;
   status: ActivityStatus;
   version?: number;
   documentId?: string | null;
+  createdAt?: Date;
+  completedAt?: Date | null;
   questions: QuestionRecord[];
   result?: object | null;
 };
@@ -189,6 +194,32 @@ type RichClosedPersistedSessionRecord = RichClosedExerciseSessionRecord & {
   richClosedExercisePayload: RichClosedExercisePayloadRecord;
 };

+type RichClosedHistorySessionRecord = {
+  id: string;
+  subjectId: string;
+  knowledgeUnitId: string;
+  type: ActivityType;
+  status: ActivityStatus;
+  documentId: string | null;
+  createdAt: Date;
+  completedAt: Date | null;
+  richClosedExercisePayload: RichClosedExercisePayloadRecord;
+  richClosedExerciseResult: RichClosedExerciseResultRecord;
+  knowledgeUnit: {
+    id: string;
+    title: string;
+    documentId: string | null;
+  };
+};
+
+type RichClosedCourseRecord = {
+  id: string;
+  title: string;
+  documents: Array<{
+    id: string;
+  }>;
+};
+
 type DocumentChunkRecord = {
   id: string;
   documentId: string;
@@ -658,7 +689,7 @@ export class PrismaActivitiesRepository implements ActivitiesRepository {
   }): Promise<RichClosedExerciseInternalEnvelope> {
     const session = await this.findRichClosedExerciseSession(input);
     const result = session.richClosedExerciseResult
-      ? toRichClosedExerciseResult(session.id, session.richClosedExerciseResult)
+      ? toRichClosedExerciseResult(session, session.richClosedExerciseResult)
       : null;

     return {
@@ -696,6 +727,8 @@ export class PrismaActivitiesRepository implements ActivitiesRepository {
         throw new Error(RICH_CLOSED_SESSION_ALREADY_COMPLETED);
       }

+      const completedAt = new Date();
+
       await tx.richClosedExerciseResult.create({
         data: {
           activitySessionId: session.id,
@@ -713,11 +746,15 @@ export class PrismaActivitiesRepository implements ActivitiesRepository {
         },
         data: {
           status: ActivityStatus.COMPLETED,
-          completedAt: new Date(),
+          completedAt,
         },
       });

-      return input.result;
+      return enrichRichClosedExerciseResult({
+        session,
+        result: input.result,
+        completedAt,
+      });
     });
   }

@@ -732,11 +769,91 @@ export class PrismaActivitiesRepository implements ActivitiesRepository {
     }

     return toRichClosedExerciseResult(
-      session.id,
+      session,
       session.richClosedExerciseResult,
     );
   }

+  async listCourseRichClosedExerciseHistoryForStudent(input: {
+    studentId: string;
+    courseId: string;
+    limit: number;
+  }): Promise<RichClosedExerciseHistoryResponse> {
+    const course = (await this.prisma.course.findFirst({
+      where: {
+        id: input.courseId,
+        studentId: input.studentId,
+        archivedAt: null,
+        subject: {
+          archivedAt: null,
+        },
+      },
+      include: {
+        documents: {
+          where: {
+            archivedAt: null,
+          },
+          select: {
+            id: true,
+          },
+        },
+      },
+    })) as RichClosedCourseRecord | null;
+
+    if (!course) {
+      throw new Error('Course not found');
+    }
+
+    const documentIds = course.documents.map((document) => document.id);
+    if (documentIds.length === 0) {
+      return { items: [] };
+    }
+
+    const sessions = (await this.prisma.activitySession.findMany({
+      where: {
+        studentId: input.studentId,
+        type: ActivityType.RICH_CLOSED_EXERCISE,
+        status: ActivityStatus.COMPLETED,
+        richClosedExerciseResult: {
+          isNot: null,
+        },
+        OR: [
+          {
+            documentId: {
+              in: documentIds,
+            },
+          },
+          {
+            knowledgeUnit: {
+              documentId: {
+                in: documentIds,
+              },
+            },
+          },
+        ],
+      },
+      include: {
+        richClosedExercisePayload: true,
+        richClosedExerciseResult: true,
+        knowledgeUnit: {
+          select: {
+            id: true,
+            title: true,
+            documentId: true,
+          },
+        },
+      },
+      orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
+      take: input.limit,
+    })) as unknown as RichClosedHistorySessionRecord[];
+
+    return {
+      items: sessions.map((session) =>
+        toRichClosedExerciseHistoryItem(session, course),
+      ),
+    };
+  }
+
   async submitResult(input: {
     studentId: string;
     sessionId: string;
@@ -1093,24 +1210,93 @@ function toRichClosedExercise(
 }

 function toRichClosedExerciseResult(
-  sessionId: string,
+  session: RichClosedPersistedSessionRecord,
   result: RichClosedExerciseResultRecord,
 ): RichClosedExerciseResult {
   if (!Array.isArray(result.correctionPayload)) {
     throw new Error(RICH_CLOSED_START_INVALID_INPUT);
   }

+  return enrichRichClosedExerciseResult({
+    session,
+    result: {
+      sessionId: session.id,
+      type: 'rich_closed_exercise',
+      status: 'completed',
+      correctAnswers: result.correctAnswers,
+      totalQuestions: result.totalQuestions,
+      score: result.score,
+      items: result.correctionPayload as RichClosedExerciseResult['items'],
+    },
+    completedAt: session.completedAt ?? result.createdAt,
+  });
+}
+
+function enrichRichClosedExerciseResult(input: {
+  session: RichClosedExerciseSessionRecord;
+  result: RichClosedExerciseResult;
+  completedAt: Date;
+}): RichClosedExerciseResult {
+  const createdAt = input.session.createdAt ?? input.completedAt;
+
+  return {
+    ...input.result,
+    sessionId: input.session.id,
+    type: 'rich_closed_exercise',
+    status: 'completed',
+    subjectId: input.session.subjectId,
+    documentId: input.session.documentId ?? null,
+    knowledgeUnitId: input.session.knowledgeUnitId,
+    createdAt,
+    completedAt: input.completedAt,
+    durationSeconds: secondsBetween(createdAt, input.completedAt),
+  };
+}
+
+function toRichClosedExerciseHistoryItem(
+  session: RichClosedHistorySessionRecord,
+  course: RichClosedCourseRecord,
+): RichClosedExerciseHistoryItem {
+  const completedAt =
+    session.completedAt ?? session.richClosedExerciseResult.createdAt;
+
   return {
-    sessionId,
+    id: session.id,
+    sessionId: session.id,
     type: 'rich_closed_exercise',
     status: 'completed',
-    correctAnswers: result.correctAnswers,
-    totalQuestions: result.totalQuestions,
-    score: result.score,
-    items: result.correctionPayload as RichClosedExerciseResult['items'],
+    title: session.richClosedExercisePayload.title,
+    subjectId: session.subjectId,
+    documentId:
+      session.documentId ??
+      session.knowledgeUnit.documentId ??
+      session.richClosedExercisePayload.documentId,
+    knowledgeUnit: {
+      id: session.knowledgeUnit.id,
+      title: session.knowledgeUnit.title,
+    },
+    course: {
+      id: course.id,
+      title: course.title,
+    },
+    correctAnswers: session.richClosedExerciseResult.correctAnswers,
+    totalQuestions: session.richClosedExerciseResult.totalQuestions,
+    score: session.richClosedExerciseResult.score,
+    completedAt,
+    resultPath: `/activities/rich-closed/${session.id}/result`,
   };
 }

+function secondsBetween(startedAt: Date, completedAt: Date): number | null {
+  const durationMs = completedAt.getTime() - startedAt.getTime();
+
+  if (!Number.isFinite(durationMs) || durationMs < 0) {
+    return null;
+  }
+
+  return Math.round(durationMs / 1000);
+}
+
 function collectRichClosedSourceChunkIds(
   exercise: RichClosedExercise,
 ): string[] {
diff --git a/src/modules/courses/interfaces/courses.controller.spec.ts b/src/modules/courses/interfaces/courses.controller.spec.ts
index 378892c..5209ce1 100644
--- a/src/modules/courses/interfaces/courses.controller.spec.ts
+++ b/src/modules/courses/interfaces/courses.controller.spec.ts
@@ -42,6 +42,7 @@ import { CoursesController } from './courses.controller';
 import { SourceDeleteBlockedError } from '../../documents/domain/source-lifecycle.entity';
 import { GetResumableCourseRevisionSessionUseCase } from '../../revision-sessions/application/get-resumable-course-revision-session.use-case';
 import { ListCourseRevisionSessionHistoryUseCase } from '../../revision-sessions/application/list-revision-session-history.use-case';
+import { ListCourseRichClosedExerciseHistoryUseCase } from '../../activities/application/rich-closed-questions/list-course-rich-closed-exercise-history.use-case';

 describe('CoursesController', () => {
   it('lists courses for the current student and subject', async () => {
@@ -604,6 +605,57 @@ describe('CoursesController', () => {
     expect(listCourseRevisionSessionHistory.execute).not.toHaveBeenCalled();
   });

+  it('returns completed rich closed history for a course', async () => {
+    const { controller, listCourseRichClosedExerciseHistory } =
+      createController();
+    listCourseRichClosedExerciseHistory.execute.mockResolvedValue({
+      items: [
+        {
+          id: 'rich-session-1',
+          sessionId: 'rich-session-1',
+          type: 'rich_closed_exercise',
+          status: 'completed',
+          title: 'Questions riches',
+          subjectId: 'subject-1',
+          documentId: 'document-1',
+          knowledgeUnit: {
+            id: 'unit-1',
+            title: 'Séparation des pouvoirs',
+          },
+          course: {
+            id: 'course-1',
+            title: 'Droit constitutionnel',
+          },
+          correctAnswers: 5,
+          totalQuestions: 6,
+          score: 0.833,
+          completedAt: new Date('2026-06-18T10:07:00.000Z'),
+          resultPath: '/activities/rich-closed/rich-session-1/result',
+        },
+      ],
+    });
+
+    await expect(
+      controller.getCourseRichClosedHistory(currentStudent, ' course-1 ', '5'),
+    ).resolves.toMatchObject({
+      items: [
+        {
+          sessionId: 'rich-session-1',
+          type: 'rich_closed_exercise',
+          correctAnswers: 5,
+          totalQuestions: 6,
+          resultPath: '/activities/rich-closed/rich-session-1/result',
+        },
+      ],
+    });
+
+    expect(listCourseRichClosedExerciseHistory.execute).toHaveBeenCalledWith({
+      studentId: 'student-1',
+      courseId: 'course-1',
+      limit: 5,
+    });
+  });
+
   it('returns course question bank readiness and starts async preparation', async () => {
     const {
       controller,
@@ -783,6 +835,7 @@ function createController() {
   const startCourseQuickRevisionSession = { execute: jest.fn() };
   const getResumableCourseRevisionSession = { execute: jest.fn() };
   const listCourseRevisionSessionHistory = { execute: jest.fn() };
+  const listCourseRichClosedExerciseHistory = { execute: jest.fn() };
   const getCourseProgress = { execute: jest.fn() };
   const getSubjectProgress = { execute: jest.fn() };
   const getCourseSourceLifecycle = { execute: jest.fn() };
@@ -806,6 +859,7 @@ function createController() {
       startCourseQuickRevisionSession as unknown as StartCourseQuickRevisionSessionUseCase,
       getResumableCourseRevisionSession as unknown as GetResumableCourseRevisionSessionUseCase,
       listCourseRevisionSessionHistory as unknown as ListCourseRevisionSessionHistoryUseCase,
+      listCourseRichClosedExerciseHistory as unknown as ListCourseRichClosedExerciseHistoryUseCase,
       getCourseProgress as unknown as GetCourseProgressUseCase,
       getSubjectProgress as unknown as GetSubjectProgressUseCase,
       getCourseSourceLifecycle as unknown as GetCourseSourceLifecycleUseCase,
@@ -827,6 +881,7 @@ function createController() {
     startCourseQuickRevisionSession,
     getResumableCourseRevisionSession,
     listCourseRevisionSessionHistory,
+    listCourseRichClosedExerciseHistory,
     getCourseProgress,
     getSubjectProgress,
     getCourseSourceLifecycle,
diff --git a/src/modules/courses/interfaces/courses.controller.ts b/src/modules/courses/interfaces/courses.controller.ts
index ba67f51..91e88b5 100644
--- a/src/modules/courses/interfaces/courses.controller.ts
+++ b/src/modules/courses/interfaces/courses.controller.ts
@@ -50,6 +50,7 @@ import {
 } from '../application/start-course-quick-revision-session.use-case';
 import { GetResumableCourseRevisionSessionUseCase } from '../../revision-sessions/application/get-resumable-course-revision-session.use-case';
 import { ListCourseRevisionSessionHistoryUseCase } from '../../revision-sessions/application/list-revision-session-history.use-case';
+import { ListCourseRichClosedExerciseHistoryUseCase } from '../../activities/application/rich-closed-questions/list-course-rich-closed-exercise-history.use-case';
 import { toPublicRevisionSheet } from '../../study-artifacts/interfaces/study-artifact-response.mapper';
 import {
   MAX_DOCUMENT_BYTES,
@@ -108,6 +109,7 @@ export class CoursesController {
     private readonly startCourseQuickRevisionSessionUseCase: StartCourseQuickRevisionSessionUseCase,
     private readonly getResumableCourseRevisionSessionUseCase: GetResumableCourseRevisionSessionUseCase,
     private readonly listCourseRevisionSessionHistoryUseCase: ListCourseRevisionSessionHistoryUseCase,
+    private readonly listCourseRichClosedExerciseHistoryUseCase: ListCourseRichClosedExerciseHistoryUseCase,
     private readonly getCourseProgressUseCase: GetCourseProgressUseCase,
     private readonly getSubjectProgressUseCase: GetSubjectProgressUseCase,
     private readonly getCourseSourceLifecycleUseCase: GetCourseSourceLifecycleUseCase,
@@ -452,6 +454,21 @@ export class CoursesController {
       })
       .catch(normalizeCourseError);
   }
+
+  @Get('courses/:courseId/rich-closed/history')
+  getCourseRichClosedHistory(
+    @CurrentStudent() student: AuthenticatedStudent,
+    @Param('courseId') courseId: string,
+    @Query('limit') limit?: string,
+  ) {
+    return this.listCourseRichClosedExerciseHistoryUseCase
+      .execute({
+        studentId: student.id,
+        courseId: trimRequiredString(courseId, 'Course id is required'),
+        limit: normalizeOptionalHistoryLimitQuery(limit) ?? 5,
+      })
+      .catch(normalizeCourseError);
+  }
 }

 function validateCreateCourseBody(body: CreateCourseRequest) {
```

## Nouveaux fichiers produit/test non suivis

### `src/modules/activities/application/rich-closed-questions/list-course-rich-closed-exercise-history.use-case.ts`

```diff
diff --git a/src/modules/activities/application/rich-closed-questions/list-course-rich-closed-exercise-history.use-case.ts b/src/modules/activities/application/rich-closed-questions/list-course-rich-closed-exercise-history.use-case.ts
new file mode 100644
index 0000000..678ff26
--- /dev/null
+++ b/src/modules/activities/application/rich-closed-questions/list-course-rich-closed-exercise-history.use-case.ts
@@ -0,0 +1,24 @@
+import { Inject, Injectable } from '@nestjs/common';
+import {
+  ACTIVITIES_REPOSITORY,
+  type ActivitiesRepository,
+} from '../activities.repository';
+import type { RichClosedExerciseHistoryResponse } from './rich-closed-question.types';
+
+@Injectable()
+export class ListCourseRichClosedExerciseHistoryUseCase {
+  constructor(
+    @Inject(ACTIVITIES_REPOSITORY)
+    private readonly activitiesRepository: ActivitiesRepository,
+  ) {}
+
+  execute(input: {
+    studentId: string;
+    courseId: string;
+    limit: number;
+  }): Promise<RichClosedExerciseHistoryResponse> {
+    return this.activitiesRepository.listCourseRichClosedExerciseHistoryForStudent(
+      input,
+    );
+  }
+}
```

