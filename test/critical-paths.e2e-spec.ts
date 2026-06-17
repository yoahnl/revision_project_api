import { INestApplication, NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { TOKEN_VERIFIER } from '../src/modules/auth/application/token-verifier';
import { FirebaseAuthGuard } from '../src/modules/auth/interfaces/firebase-auth.guard';
import { StartNextActivityUseCase } from '../src/modules/activities/application/start-next-activity.use-case';
import { StartOpenQuestionActivityUseCase } from '../src/modules/activities/application/start-open-question-activity.use-case';
import { SubmitActivityResultUseCase } from '../src/modules/activities/application/submit-activity-result.use-case';
import { SubmitOpenAnswerUseCase } from '../src/modules/activities/application/submit-open-answer.use-case';
import {
  richClosedExerciseFixture,
  richClosedV1BExerciseFixture,
  richClosedV1BFullExerciseFixture,
  richClosedV1CExerciseFixture,
  richClosedV1CFullExerciseFixture,
} from '../src/modules/activities/application/rich-closed-questions/rich-closed-question.fixtures';
import { GetRichClosedExerciseResultUseCase } from '../src/modules/activities/application/rich-closed-questions/get-rich-closed-exercise-result.use-case';
import { GetRichClosedExerciseUseCase } from '../src/modules/activities/application/rich-closed-questions/get-rich-closed-exercise.use-case';
import { toRichClosedPublicExerciseEnvelope } from '../src/modules/activities/application/rich-closed-questions/rich-closed-question-public.mapper';
import { scoreRichClosedExerciseSubmission } from '../src/modules/activities/application/rich-closed-questions/rich-closed-question-scorer';
import type {
  RichClosedAnswer,
  RichClosedQuestionKind,
} from '../src/modules/activities/application/rich-closed-questions/rich-closed-question.types';
import { StartRichClosedExerciseUseCase } from '../src/modules/activities/application/rich-closed-questions/start-rich-closed-exercise.use-case';
import { SubmitRichClosedExerciseUseCase } from '../src/modules/activities/application/rich-closed-questions/submit-rich-closed-exercise.use-case';
import { GetDocumentUseCase } from '../src/modules/documents/application/get-document.use-case';
import { ListDocumentKnowledgeUnitsUseCase } from '../src/modules/documents/application/list-document-knowledge-units.use-case';
import { GetTodayPlanUseCase } from '../src/modules/revision/application/get-today-plan.use-case';
import { GetRevisionSessionUseCase } from '../src/modules/revision-sessions/application/get-revision-session.use-case';
import { RequestNextRevisionSessionActionUseCase } from '../src/modules/revision-sessions/application/request-next-revision-session-action.use-case';
import { StartRevisionSessionUseCase } from '../src/modules/revision-sessions/application/start-revision-session.use-case';
import { GenerateDocumentSummaryUseCase } from '../src/modules/study-artifacts/application/generate-document-summary.use-case';
import { GenerateRevisionSheetUseCase } from '../src/modules/study-artifacts/application/generate-revision-sheet.use-case';
import { GetDocumentSummaryUseCase } from '../src/modules/study-artifacts/application/get-document-summary.use-case';
import { GetRevisionSheetUseCase } from '../src/modules/study-artifacts/application/get-revision-sheet.use-case';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';

jest.mock('firebase-admin/app', () => ({
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(),
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

type CriticalPathMocks = ReturnType<typeof createCriticalPathMocks>;
type KnowledgeUnitsResponse = ReturnType<typeof documentKnowledgeUnits>;
type SummaryResponse = ReturnType<typeof documentSummary>;
type RevisionSheetResponse = ReturnType<typeof revisionSheet>;
type TodayPlanResponse = ReturnType<typeof todayPlan>;
type ActivityResponse = ReturnType<typeof diagnosticQuizActivity>;
type OpenQuestionResponse = ReturnType<typeof openQuestionActivity>;

const currentStudent = {
  id: 'student-demo-test',
  firebaseUid: 'firebase-demo-test-uid',
  email: 'demo-revision@example.test',
  displayName: 'Demo Revision',
};

describe('Critical demo paths (e2e)', () => {
  describe('protected routes', () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
      app = await createAppWithRealAuthGuard();
    });

    afterEach(async () => {
      await app?.close();
    });

    it('rejects critical demo routes without a bearer token', async () => {
      // This suite keeps the real FirebaseAuthGuard behavior for missing-token
      // checks, but the verifier itself is mocked so no Firebase network call
      // can happen even if a future test adds a token.
      const server = app.getHttpServer();

      await request(server).get('/today').expect(401);
      await request(server).get('/documents/document-1').expect(401);
      await request(server)
        .get('/documents/document-1/knowledge-units')
        .expect(401);
      await request(server)
        .post('/activities/next')
        .send({ subjectId: 'subject-1' })
        .expect(401);
      await request(server)
        .post('/activities/open-question')
        .send({ subjectId: 'subject-1', knowledgeUnitId: 'unit-1' })
        .expect(401);
      await request(server)
        .post('/activities/rich-closed/start')
        .send({ subjectId: 'subject-1', knowledgeUnitId: 'unit-1' })
        .expect(401);
      await request(server)
        .post('/revision-sessions')
        .send({ subjectId: 'subject-1' })
        .expect(401);
    });
  });

  describe('authenticated contracts', () => {
    let app: INestApplication<App>;
    let mocks: CriticalPathMocks;

    beforeEach(async () => {
      mocks = createCriticalPathMocks();
      app = await createAuthenticatedApp(mocks);
    });

    afterEach(async () => {
      await app?.close();
    });

    it('routes document and knowledge-unit reads with ownership context and no storage path leak', async () => {
      const server = app.getHttpServer();

      const documentResponse = await request(server)
        .get('/documents/document-1')
        .expect(200);

      expect(mocks.getDocument.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        documentId: 'document-1',
      });
      expect(documentResponse.body).toMatchObject({
        id: 'document-1',
        subjectId: 'subject-1',
        status: 'READY',
      });
      assertNoSensitivePreSubmitFields(documentResponse.body);

      const knowledgeUnitsResponse = await request(server)
        .get('/documents/document-1/knowledge-units')
        .expect(200);
      const knowledgeUnitsBody =
        knowledgeUnitsResponse.body as KnowledgeUnitsResponse;

      expect(mocks.listDocumentKnowledgeUnits.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        documentId: 'document-1',
      });
      expect(knowledgeUnitsBody.items[0].sources[0]).toMatchObject({
        chunkId: 'chunk-1',
        pageNumber: 1,
        index: 0,
      });
      assertNoSensitivePreSubmitFields(knowledgeUnitsResponse.body);
    });

    it('maps missing documents to a clean 404 response', async () => {
      mocks.getDocument.execute.mockRejectedValueOnce(
        new NotFoundException('Document not found'),
      );

      await request(app.getHttpServer())
        .get('/documents/missing-document')
        .expect(404);
    });

    it('serves ready summary and revision sheet without internal metadata', async () => {
      const server = app.getHttpServer();

      const summaryResponse = await request(server)
        .get('/documents/document-1/summary')
        .expect(200);
      const summaryBody = summaryResponse.body as SummaryResponse;

      expect(mocks.getDocumentSummary.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        documentId: 'document-1',
      });
      expect(summaryBody.title).toBe('Synthèse de démonstration');
      assertNoSensitivePreSubmitFields(summaryResponse.body);
      expect(JSON.stringify(summaryResponse.body)).not.toContain('provider');
      expect(JSON.stringify(summaryResponse.body)).not.toContain(
        'promptVersion',
      );

      const sheetResponse = await request(server)
        .get('/documents/document-1/revision-sheet')
        .expect(200);
      const sheetBody = sheetResponse.body as RevisionSheetResponse;

      expect(mocks.getRevisionSheet.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        documentId: 'document-1',
      });
      expect(sheetBody.sections).toHaveLength(1);
      assertNoSensitivePreSubmitFields(sheetResponse.body);
      expect(JSON.stringify(sheetResponse.body)).not.toContain('provider');
      expect(JSON.stringify(sheetResponse.body)).not.toContain('promptVersion');
    });

    it('returns a deterministic multi-action TodayPlan for the current student', async () => {
      const response = await request(app.getHttpServer())
        .get('/today')
        .expect(200);
      const todayBody = response.body as TodayPlanResponse;

      expect(mocks.getTodayPlan.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
      });
      expect(todayBody.items.map((item) => item.action)).toEqual([
        'diagnostic_quiz',
        'open_question',
        'rich_closed_exercise',
        'revision_session',
      ]);
      const richClosedItem = todayBody.items.find(
        (item) => item.action === 'rich_closed_exercise',
      );
      expect(richClosedItem).toMatchObject({
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        startPayload: {
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
        },
      });
      expect(richClosedItem).not.toHaveProperty('questions');
      expect(richClosedItem).not.toHaveProperty('correction');
      assertNoSensitivePreSubmitFields(response.body);
      expect(JSON.stringify(response.body)).not.toContain('other-student');
    });

    it('starts a QCM with bounded v3 options and no correction leak', async () => {
      const response = await request(app.getHttpServer())
        .post('/activities/next')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 12,
          visualsEnabled: true,
          visualTypes: ['CHART', 'DIAGRAM'],
          selectionModes: ['single', 'multiple'],
        })
        .expect(201);
      const responseBody = response.body as ActivityResponse;

      expect(mocks.startNextActivity.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
        questionCount: 12,
        visualsEnabled: true,
        visualTypes: ['CHART', 'DIAGRAM'],
        selectionModes: ['single', 'multiple'],
      });
      expect(responseBody.type).toBe('diagnostic_quiz');
      assertNoSensitivePreSubmitFields(response.body);
    });

    it('rejects invalid QCM payloads before calling the use case', async () => {
      await request(app.getHttpServer())
        .post('/activities/next')
        .send({
          subjectId: 'subject-1',
          questionCount: 25,
          visualTypes: ['IMAGE'],
        })
        .expect(400);

      expect(mocks.startNextActivity.execute).not.toHaveBeenCalled();
    });

    it('submits QCM answers and maps critical submit errors', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/activities/quiz-session-1/result')
        .send({
          answers: [
            { questionId: 'question-1', choiceId: 'choice-1' },
            { questionId: 'question-2', choiceIds: ['choice-2', 'choice-3'] },
          ],
        })
        .expect(201);

      expect(mocks.submitActivityResult.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'quiz-session-1',
        answers: [
          { questionId: 'question-1', choiceId: 'choice-1' },
          { questionId: 'question-2', choiceIds: ['choice-2', 'choice-3'] },
        ],
      });

      await request(server)
        .post('/activities/quiz-session-1/result')
        .send({ answers: [{ questionId: 'question-1' }] })
        .expect(400);

      mocks.submitActivityResult.execute.mockRejectedValueOnce(
        new Error('Activity session not found'),
      );
      await request(server)
        .post('/activities/missing-session/result')
        .send({ answers: [{ questionId: 'question-1', choiceId: 'choice-1' }] })
        .expect(404);

      mocks.submitActivityResult.execute.mockRejectedValueOnce(
        new Error('Activity session already submitted'),
      );
      await request(server)
        .post('/activities/submitted-session/result')
        .send({ answers: [{ questionId: 'question-1', choiceId: 'choice-1' }] })
        .expect(409);

      mocks.submitActivityResult.execute.mockRejectedValueOnce(
        new Error('Generated diagnostic quiz is invalid'),
      );
      await request(server)
        .post('/activities/invalid-generation/result')
        .send({ answers: [{ questionId: 'question-1', choiceId: 'choice-1' }] })
        .expect(422);
    });

    it('starts an open question without exposing correction fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/activities/open-question')
        .send({ subjectId: 'subject-1', knowledgeUnitId: 'unit-1' })
        .expect(201);
      const responseBody = response.body as OpenQuestionResponse;

      expect(mocks.startOpenQuestionActivity.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
      });
      expect(responseBody.type).toBe('open_question');
      assertNoSensitivePreSubmitFields(response.body);
    });

    it('validates open question start and submit payloads', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/activities/open-question')
        .send({ subjectId: 'subject-1' })
        .expect(400);
      expect(mocks.startOpenQuestionActivity.execute).not.toHaveBeenCalled();

      await request(server)
        .post('/activities/open-session-1/open-answer')
        .send({ answerText: '   ' })
        .expect(400);
      expect(mocks.submitOpenAnswer.execute).not.toHaveBeenCalled();
    });

    it('submits an open answer and maps critical evaluation errors', async () => {
      const server = app.getHttpServer();
      const answerText =
        'La distinction entre les régimes parlementaire et présidentiel repose sur la responsabilité politique du gouvernement et sur la séparation institutionnelle des pouvoirs.';

      await request(server)
        .post('/activities/open-session-1/open-answer')
        .send({ answerText })
        .expect(201);

      expect(mocks.submitOpenAnswer.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'open-session-1',
        answerText,
      });

      mocks.submitOpenAnswer.execute.mockRejectedValueOnce(
        new Error('Activity session not found'),
      );
      await request(server)
        .post('/activities/missing-session/open-answer')
        .send({ answerText })
        .expect(404);

      mocks.submitOpenAnswer.execute.mockRejectedValueOnce(
        new Error('Activity session is not an open question'),
      );
      await request(server)
        .post('/activities/quiz-session/open-answer')
        .send({ answerText })
        .expect(400);

      mocks.submitOpenAnswer.execute.mockRejectedValueOnce(
        new Error('OPEN_ANSWER_EVALUATION_INVALID'),
      );
      await request(server)
        .post('/activities/open-session-invalid/open-answer')
        .send({ answerText })
        .expect(422);
    });

    it('routes rich closed start, get, submit and result without pre-submit leaks', async () => {
      const server = app.getHttpServer();

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 6,
        })
        .expect(201);

      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 6,
        complexityProfile: 'exam',
        questionTypeMix: undefined,
      });
      const startBody = startResponse.body as ReturnType<
        typeof richClosedPublicExercise
      >;
      expect(startBody.type).toBe('rich_closed_exercise');
      expect(
        startBody.questions.map(
          (question: { questionKind: RichClosedQuestionKind }) =>
            question.questionKind,
        ),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
      ]);
      expect(
        startBody.questions.every(
          (question: { sourceChunkIds?: unknown[] }) =>
            Array.isArray(question.sourceChunkIds) &&
            question.sourceChunkIds.length > 0,
        ),
      ).toBe(true);
      assertNoSensitivePreSubmitFields(startBody);

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-1')
        .expect(200);
      expect(mocks.getRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-1',
      });
      assertNoSensitivePreSubmitFields(getResponse.body);

      mocks.getRichClosedExerciseResult.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_SESSION_NOT_COMPLETED'),
      );
      await request(server)
        .get('/activities/rich-closed/rich-session-1/result')
        .expect(409);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-1/submit')
        .send({ answers: richClosedAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-1',
        answers: richClosedAnswers(),
      });
      const submitBody = submitResponse.body as {
        items: Array<Record<string, unknown>>;
      };
      expect(submitBody).toMatchObject({
        correctAnswers: 6,
        totalQuestions: 6,
        score: 1,
      });
      expect(submitBody.items).toHaveLength(6);
      expect(submitBody.items[0]).toHaveProperty('correction');
      expect(JSON.stringify(submitBody)).toContain('explanation');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-1/result')
        .expect(200);
      expect(mocks.getRichClosedExerciseResult.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-1',
      });
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 6,
        totalQuestions: 6,
      });
    });

    it('routes rich closed V1-B timeline and date slider without pre-submit leaks', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BPublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BPublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1BResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 8,
          questionTypeMix,
        })
        .expect(201);

      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };
      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 8,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map(
          (question: { questionKind: RichClosedQuestionKind }) =>
            question.questionKind,
        ),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
      ]);
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).not.toContain('correctYear');
      expect(JSON.stringify(startBody)).not.toContain('correctOrder');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1b')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1b/submit')
        .send({ answers: richClosedV1BAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1b',
        answers: richClosedV1BAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 8,
        totalQuestions: 8,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctYear');
      expect(JSON.stringify(submitResponse.body)).toContain('correctOrder');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1b/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 8,
        totalQuestions: 8,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1b/submit')
        .send({
          answers: replaceRichClosedV1BAnswer({
            questionId: 'date-slider-1',
            questionKind: 'date_slider',
            year: 1958.5,
          } as unknown as RichClosedAnswer),
        })
        .expect(400);

      const semanticInvalidSubmissions = [
        replaceRichClosedV1BAnswer({
          questionId: 'timeline-1',
          questionKind: 'timeline',
          orderedEventIds: ['event-1', 'event-1', 'event-3'],
        }),
        replaceRichClosedV1BAnswer({
          questionId: 'timeline-1',
          questionKind: 'timeline',
          orderedEventIds: ['event-1', 'event-2', 'unknown-event'],
        }),
        replaceRichClosedV1BAnswer({
          questionId: 'timeline-1',
          questionKind: 'timeline',
          orderedEventIds: ['event-1', 'event-2'],
        }),
        replaceRichClosedV1BAnswer({
          questionId: 'date-slider-1',
          questionKind: 'date_slider',
          year: 1971,
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-v1b/submit')
          .send({ answers })
          .expect(400);
      }
    });

    it('routes rich closed V1-B true/false grid and cause/consequence without pre-submit leaks', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
        true_false_grid: 1,
        cause_consequence: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BFullPublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BFullPublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BFullResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1BFullResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 10,
          questionTypeMix,
        })
        .expect(201);

      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };
      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 10,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map((question) => question.questionKind),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
      ]);
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).not.toContain('correctValues');
      expect(JSON.stringify(startBody)).not.toContain('correctPairs');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1b-full')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1b-full/submit')
        .send({ answers: richClosedV1BFullAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1b-full',
        answers: richClosedV1BFullAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 10,
        totalQuestions: 10,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctValues');
      expect(JSON.stringify(submitResponse.body)).toContain('correctPairs');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1b-full/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 10,
        totalQuestions: 10,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1b-full/submit')
        .send({
          answers: replaceRichClosedV1BFullAnswer({
            questionId: 'true-false-grid-1',
            questionKind: 'true_false_grid',
            values: [
              { rowId: 'row-1', value: true },
              { rowId: 'row-2', value: false },
              { rowId: 'row-3', value: 'true' },
            ],
          }),
        })
        .expect(400);

      const semanticInvalidSubmissions = [
        replaceRichClosedV1BFullAnswer({
          questionId: 'true-false-grid-1',
          questionKind: 'true_false_grid',
          values: [
            { rowId: 'row-1', value: true },
            { rowId: 'row-1', value: false },
            { rowId: 'row-3', value: true },
          ],
        }),
        replaceRichClosedV1BFullAnswer({
          questionId: 'true-false-grid-1',
          questionKind: 'true_false_grid',
          values: [
            { rowId: 'row-1', value: true },
            { rowId: 'row-2', value: false },
          ],
        }),
        replaceRichClosedV1BFullAnswer({
          questionId: 'cause-consequence-1',
          questionKind: 'cause_consequence',
          pairs: [
            { causeId: 'cause-1', consequenceId: 'consequence-1' },
            { causeId: 'cause-1', consequenceId: 'consequence-2' },
            { causeId: 'cause-3', consequenceId: 'consequence-3' },
          ],
        }),
        replaceRichClosedV1BFullAnswer({
          questionId: 'cause-consequence-1',
          questionKind: 'cause_consequence',
          pairs: [
            { causeId: 'cause-1', consequenceId: 'consequence-1' },
            { causeId: 'cause-2', consequenceId: 'unknown-consequence' },
            { causeId: 'cause-3', consequenceId: 'consequence-3' },
          ],
        }),
        replaceRichClosedV1BFullAnswer({
          questionId: 'cause-consequence-1',
          questionKind: 'cause_consequence',
          pairs: [
            { causeId: 'cause-1', consequenceId: 'consequence-1' },
            { causeId: 'cause-2', consequenceId: 'consequence-2' },
          ],
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-v1b-full/submit')
          .send({ answers })
          .expect(400);
      }
    });

    it('routes rich closed V1-C institution matrix without pre-submit leaks', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
        true_false_grid: 1,
        cause_consequence: 1,
        institution_matrix: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CPublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CPublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1CResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 11,
          questionTypeMix,
        })
        .expect(201);

      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };
      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 11,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map((question) => question.questionKind),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
        'institution_matrix',
      ]);
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).not.toContain('correctValues');
      expect(JSON.stringify(startBody)).not.toContain('explanation');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1c/submit')
        .send({ answers: richClosedV1CAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1c',
        answers: richClosedV1CAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 11,
        totalQuestions: 11,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctValues');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 11,
        totalQuestions: 11,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1c/submit')
        .send({
          answers: replaceRichClosedV1CAnswer({
            questionId: 'institution-matrix-1',
            questionKind: 'institution_matrix',
            values: [
              {
                cellId: 'cell-president-legitimacy',
                optionId: 'option-legitimacy-election',
              },
              {
                cellId: 'cell-government-responsibility',
                optionId: 42,
              },
              {
                cellId: 'cell-assembly-action',
                optionId: 'option-action-censure',
              },
            ],
          }),
        })
        .expect(400);

      const semanticInvalidSubmissions = [
        replaceRichClosedV1CAnswer({
          questionId: 'institution-matrix-1',
          questionKind: 'institution_matrix',
          values: [
            {
              cellId: 'cell-president-legitimacy',
              optionId: 'option-legitimacy-election',
            },
            {
              cellId: 'cell-president-legitimacy',
              optionId: 'option-legitimacy-confidence',
            },
            {
              cellId: 'cell-assembly-action',
              optionId: 'option-action-censure',
            },
          ],
        }),
        replaceRichClosedV1CAnswer({
          questionId: 'institution-matrix-1',
          questionKind: 'institution_matrix',
          values: [
            {
              cellId: 'unknown-cell',
              optionId: 'option-legitimacy-election',
            },
            {
              cellId: 'cell-government-responsibility',
              optionId: 'option-responsibility-assembly',
            },
            {
              cellId: 'cell-assembly-action',
              optionId: 'option-action-censure',
            },
          ],
        }),
        replaceRichClosedV1CAnswer({
          questionId: 'institution-matrix-1',
          questionKind: 'institution_matrix',
          values: [
            {
              cellId: 'cell-president-legitimacy',
              optionId: 'option-action-censure',
            },
            {
              cellId: 'cell-government-responsibility',
              optionId: 'option-responsibility-assembly',
            },
            {
              cellId: 'cell-assembly-action',
              optionId: 'option-action-censure',
            },
          ],
        }),
        replaceRichClosedV1CAnswer({
          questionId: 'institution-matrix-1',
          questionKind: 'institution_matrix',
          values: [
            {
              cellId: 'cell-president-legitimacy',
              optionId: 'option-legitimacy-election',
            },
            {
              cellId: 'cell-government-responsibility',
              optionId: 'option-responsibility-assembly',
            },
          ],
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-v1c/submit')
          .send({ answers })
          .expect(400);
      }
    });

    it('routes rich closed V1-C diagram labeling without arbitrary render payloads', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
        true_false_grid: 1,
        cause_consequence: 1,
        institution_matrix: 1,
        diagram_labeling: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CFullPublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CFullPublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CFullResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1CFullResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 12,
          questionTypeMix,
        })
        .expect(201);

      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };
      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 12,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map((question) => question.questionKind),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
        'institution_matrix',
        'diagram_labeling',
      ]);
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).not.toContain('correctValues');
      expect(JSON.stringify(startBody)).not.toContain('explanation');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c-full')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1c-full/submit')
        .send({ answers: richClosedV1CFullAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1c-full',
        answers: richClosedV1CFullAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 12,
        totalQuestions: 12,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctValues');
      expect(JSON.stringify(submitResponse.body)).not.toContain(
        'renderPayload',
      );
      expect(JSON.stringify(submitResponse.body)).not.toContain('mermaid');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c-full/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 12,
        totalQuestions: 12,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1c-full/submit')
        .send({
          answers: replaceRichClosedV1CFullAnswer({
            questionId: 'diagram-labeling-1',
            questionKind: 'diagram_labeling',
            values: [
              { slotId: 'slot-government-role', optionId: 'option-government' },
              { slotId: 'slot-censure', optionId: 42 },
              { slotId: 'slot-nomination', optionId: 'option-nomination' },
            ],
          }),
        })
        .expect(400);

      await request(server)
        .post('/activities/rich-closed/rich-session-v1c-full/submit')
        .send({
          answers: replaceRichClosedV1CFullAnswer({
            questionId: 'diagram-labeling-1',
            questionKind: 'diagram_labeling',
            values: [
              { slotId: 'slot-government-role', optionId: 'option-government' },
              {
                slotId: 'slot-censure',
                optionId: 'option-motion-censure',
              },
              { slotId: 'slot-nomination', optionId: 'option-nomination' },
            ],
            renderPayload: { widget: 'free-form' },
          }),
        })
        .expect(400);

      const semanticInvalidSubmissions = [
        replaceRichClosedV1CFullAnswer({
          questionId: 'diagram-labeling-1',
          questionKind: 'diagram_labeling',
          values: [
            { slotId: 'slot-government-role', optionId: 'option-government' },
            { slotId: 'slot-government-role', optionId: 'option-president' },
            { slotId: 'slot-nomination', optionId: 'option-nomination' },
          ],
        }),
        replaceRichClosedV1CFullAnswer({
          questionId: 'diagram-labeling-1',
          questionKind: 'diagram_labeling',
          values: [
            { slotId: 'unknown-slot', optionId: 'option-government' },
            { slotId: 'slot-censure', optionId: 'option-motion-censure' },
            { slotId: 'slot-nomination', optionId: 'option-nomination' },
          ],
        }),
        replaceRichClosedV1CFullAnswer({
          questionId: 'diagram-labeling-1',
          questionKind: 'diagram_labeling',
          values: [
            {
              slotId: 'slot-government-role',
              optionId: 'option-motion-censure',
            },
            { slotId: 'slot-censure', optionId: 'option-motion-censure' },
            { slotId: 'slot-nomination', optionId: 'option-nomination' },
          ],
        }),
        replaceRichClosedV1CFullAnswer({
          questionId: 'diagram-labeling-1',
          questionKind: 'diagram_labeling',
          values: [
            { slotId: 'slot-government-role', optionId: 'option-government' },
            { slotId: 'slot-censure', optionId: 'option-motion-censure' },
          ],
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-v1c-full/submit')
          .send({ answers })
          .expect(400);
      }
    });

    it('validates and maps rich closed errors', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 5,
        })
        .expect(400);
      expect(mocks.startRichClosedExercise.execute).not.toHaveBeenCalled();

      await request(server)
        .post('/activities/rich-closed/rich-session-1/submit')
        .send({
          answers: [
            {
              questionId: 'single-1',
              questionKind: 'single_choice',
              choiceId: 'choice-a',
              modelAnswer: 'interdit',
            },
          ],
        })
        .expect(400);
      expect(mocks.submitRichClosedExercise.execute).not.toHaveBeenCalled();

      await request(server)
        .post('/activities/rich-closed/rich-session-1/submit')
        .send({
          answers: [
            ...richClosedAnswers(),
            {
              questionId: 'single-1',
              questionKind: 'single_choice',
              choiceId: 'choice-a',
            },
          ],
        })
        .expect(400);
      expect(mocks.submitRichClosedExercise.execute).not.toHaveBeenCalled();

      const semanticInvalidSubmissions = [
        replaceRichClosedAnswer({
          questionId: 'single-1',
          questionKind: 'single_choice',
          choiceId: 'unknown-choice',
        }),
        richClosedAnswers().filter(
          (answer) => answer.questionId !== 'single-1',
        ),
        replaceRichClosedAnswer({
          questionId: 'matching-1',
          questionKind: 'matching',
          pairs: [
            { leftId: 'left-1', rightId: 'right-1' },
            { leftId: 'left-2', rightId: 'unknown-right' },
            { leftId: 'left-3', rightId: 'right-3' },
          ],
        }),
        replaceRichClosedAnswer({
          questionId: 'ordering-1',
          questionKind: 'ordering',
          orderedIds: ['item-1', 'item-2'],
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-1/submit')
          .send({ answers })
          .expect(400);
      }

      mocks.getRichClosedExercise.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_SESSION_NOT_FOUND'),
      );
      await request(server)
        .get('/activities/rich-closed/missing-session')
        .expect(404);

      mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_SESSION_ALREADY_COMPLETED'),
      );
      await request(server)
        .post('/activities/rich-closed/rich-session-1/submit')
        .send({ answers: richClosedAnswers() })
        .expect(409);

      mocks.startRichClosedExercise.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_GENERATION_QUALITY_REJECTED'),
      );
      await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 6,
        })
        .expect(422);
    });

    it('routes revision sessions and next actions without free-message leakage', async () => {
      const server = app.getHttpServer();

      const startResponse = await request(server)
        .post('/revision-sessions')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          preferredAction: 'open_question',
        })
        .expect(201);

      expect(mocks.startRevisionSession.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        preferredAction: 'open_question',
      });
      assertNoSensitivePreSubmitFields(startResponse.body);

      await request(server)
        .get('/revision-sessions/revision-session-1')
        .expect(200);
      expect(mocks.getRevisionSession.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'revision-session-1',
      });

      await request(server)
        .post('/revision-sessions/revision-session-1/next-action')
        .send({ message: 'ignore this free text' })
        .expect(201);

      expect(mocks.requestNextAction.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'revision-session-1',
      });
      expect(
        JSON.stringify(mocks.requestNextAction.execute.mock.calls),
      ).not.toContain('ignore this free text');
    });

    it('routes rich closed revision sessions as bounded launchers', async () => {
      mocks.startRevisionSession.execute.mockResolvedValueOnce(
        richClosedRevisionSessionResponse(),
      );

      const response = await request(app.getHttpServer())
        .post('/revision-sessions')
        .send({
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
          preferredAction: 'rich_closed_exercise',
        })
        .expect(201);

      expect(mocks.startRevisionSession.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        preferredAction: 'rich_closed_exercise',
      });
      const body = response.body as ReturnType<
        typeof richClosedRevisionSessionResponse
      >;

      expect(body.currentAction).toMatchObject({
        kind: 'RICH_CLOSED_EXERCISE',
        activitySessionId: null,
        payload: {
          type: 'rich_closed_exercise',
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
          preferredAction: 'rich_closed_exercise',
        },
      });
      expect(body.currentAction.payload).not.toHaveProperty('questions');
      expect(body.currentAction.payload).not.toHaveProperty('correction');
      assertNoSensitivePreSubmitFields(body);
    });

    it('validates and maps revision session errors', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/revision-sessions')
        .send({ subjectId: 'subject-1', preferredAction: 'chat' })
        .expect(400);
      expect(mocks.startRevisionSession.execute).not.toHaveBeenCalled();

      mocks.startRevisionSession.execute.mockRejectedValueOnce(
        new Error('Open question revision session requires a knowledge unit'),
      );
      await request(server)
        .post('/revision-sessions')
        .send({ subjectId: 'subject-1', preferredAction: 'open_question' })
        .expect(422);

      mocks.getRevisionSession.execute.mockRejectedValueOnce(
        new Error('Revision session not found'),
      );
      await request(server)
        .get('/revision-sessions/missing-session')
        .expect(404);
    });
  });
});

async function createAppWithRealAuthGuard(): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(TOKEN_VERIFIER)
    .useValue({ verify: jest.fn() })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}

async function createAuthenticatedApp(
  mocks: CriticalPathMocks,
): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(FirebaseAuthGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        // The e2e suite verifies controller contracts, not Firebase itself.
        // Injecting an explicit fake student keeps every request scoped while
        // avoiding Firebase Admin and BootstrapStudentUseCase side effects.
        const httpRequest = context
          .switchToHttp()
          .getRequest<{ student?: typeof currentStudent }>();
        httpRequest.student = currentStudent;
        return true;
      },
    })
    .overrideProvider(TOKEN_VERIFIER)
    .useValue({ verify: jest.fn() })
    .overrideProvider(PrismaService)
    .useValue({})
    .overrideProvider(GetDocumentUseCase)
    .useValue(mocks.getDocument)
    .overrideProvider(ListDocumentKnowledgeUnitsUseCase)
    .useValue(mocks.listDocumentKnowledgeUnits)
    .overrideProvider(GetDocumentSummaryUseCase)
    .useValue(mocks.getDocumentSummary)
    .overrideProvider(GenerateDocumentSummaryUseCase)
    .useValue(mocks.generateDocumentSummary)
    .overrideProvider(GetRevisionSheetUseCase)
    .useValue(mocks.getRevisionSheet)
    .overrideProvider(GenerateRevisionSheetUseCase)
    .useValue(mocks.generateRevisionSheet)
    .overrideProvider(GetTodayPlanUseCase)
    .useValue(mocks.getTodayPlan)
    .overrideProvider(StartNextActivityUseCase)
    .useValue(mocks.startNextActivity)
    .overrideProvider(StartOpenQuestionActivityUseCase)
    .useValue(mocks.startOpenQuestionActivity)
    .overrideProvider(SubmitActivityResultUseCase)
    .useValue(mocks.submitActivityResult)
    .overrideProvider(SubmitOpenAnswerUseCase)
    .useValue(mocks.submitOpenAnswer)
    .overrideProvider(StartRichClosedExerciseUseCase)
    .useValue(mocks.startRichClosedExercise)
    .overrideProvider(GetRichClosedExerciseUseCase)
    .useValue(mocks.getRichClosedExercise)
    .overrideProvider(SubmitRichClosedExerciseUseCase)
    .useValue(mocks.submitRichClosedExercise)
    .overrideProvider(GetRichClosedExerciseResultUseCase)
    .useValue(mocks.getRichClosedExerciseResult)
    .overrideProvider(StartRevisionSessionUseCase)
    .useValue(mocks.startRevisionSession)
    .overrideProvider(GetRevisionSessionUseCase)
    .useValue(mocks.getRevisionSession)
    .overrideProvider(RequestNextRevisionSessionActionUseCase)
    .useValue(mocks.requestNextAction)
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}

function createCriticalPathMocks() {
  return {
    getDocument: {
      execute: jest.fn().mockResolvedValue(publicDocument()),
    },
    listDocumentKnowledgeUnits: {
      execute: jest.fn().mockResolvedValue(documentKnowledgeUnits()),
    },
    getDocumentSummary: {
      execute: jest.fn().mockResolvedValue(documentSummary()),
    },
    generateDocumentSummary: {
      execute: jest.fn().mockResolvedValue(documentSummary()),
    },
    getRevisionSheet: {
      execute: jest.fn().mockResolvedValue(revisionSheet()),
    },
    generateRevisionSheet: {
      execute: jest.fn().mockResolvedValue(revisionSheet()),
    },
    getTodayPlan: {
      execute: jest.fn().mockResolvedValue(todayPlan()),
    },
    startNextActivity: {
      execute: jest.fn().mockResolvedValue(diagnosticQuizActivity()),
    },
    startOpenQuestionActivity: {
      execute: jest.fn().mockResolvedValue(openQuestionActivity()),
    },
    submitActivityResult: {
      execute: jest.fn().mockResolvedValue(qcmSubmissionResult()),
    },
    submitOpenAnswer: {
      execute: jest.fn().mockResolvedValue(openAnswerSubmissionResult()),
    },
    startRichClosedExercise: {
      execute: jest.fn().mockResolvedValue(richClosedPublicExercise()),
    },
    getRichClosedExercise: {
      execute: jest.fn().mockResolvedValue(richClosedPublicExercise()),
    },
    submitRichClosedExercise: {
      execute: jest.fn().mockResolvedValue(richClosedResult()),
    },
    getRichClosedExerciseResult: {
      execute: jest.fn().mockResolvedValue(richClosedResult()),
    },
    startRevisionSession: {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    },
    getRevisionSession: {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    },
    requestNextAction: {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    },
  };
}

function publicDocument() {
  return {
    id: 'document-1',
    subjectId: 'subject-1',
    kind: 'COURSE_PDF',
    fileName: 'demo-droit-constitutionnel.pdf',
    mimeType: 'application/pdf',
    status: 'READY',
    errorCode: null,
  };
}

function documentKnowledgeUnits() {
  return {
    documentId: 'document-1',
    items: [
      {
        id: 'unit-1',
        subjectId: 'subject-1',
        documentId: 'document-1',
        title: 'Séparation des pouvoirs',
        summary: 'La séparation des pouvoirs organise les institutions.',
        difficulty: 'MEDIUM',
        displayOrder: 0,
        sources: [
          {
            chunkId: 'chunk-1',
            pageNumber: 1,
            index: 0,
          },
        ],
      },
    ],
  };
}

function documentSummary() {
  return {
    id: 'summary-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY',
    title: 'Synthèse de démonstration',
    content: 'La Ve République articule stabilité exécutive et contrôle.',
    keyPoints: ['Séparation des pouvoirs', 'Contrôle constitutionnel'],
    limits: 'Synthèse courte issue des fixtures de démonstration.',
    errorCode: null,
    metadata: {
      provider: 'demo-seed',
      promptVersion: 'demo-seed-v1',
    },
    storagePath: 'internal/demo.pdf',
    sources: [
      {
        chunkId: 'chunk-1',
        text: 'Extrait borné.',
        pageNumber: 1,
        index: 0,
        relevanceScore: 0.9,
      },
    ],
  };
}

function revisionSheet() {
  return {
    id: 'sheet-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY',
    title: 'Fiche de démonstration',
    introduction: 'Fiche courte de droit constitutionnel.',
    keyPoints: ['Pouvoir exécutif', 'Parlement'],
    commonMistakes: ['Confondre régime parlementaire et présidentiel.'],
    mustKnow: ['Responsabilité politique du gouvernement.'],
    practiceSuggestions: ['Comparer deux institutions.'],
    errorCode: null,
    metadata: {
      provider: 'demo-seed',
      promptVersion: 'demo-seed-v1',
    },
    sections: [
      {
        id: 'section-1',
        displayOrder: 0,
        title: 'Institutions',
        content: 'Le régime organise les rapports entre les pouvoirs.',
        sources: [
          {
            chunkId: 'chunk-2',
            text: 'Extrait de fiche borné.',
            pageNumber: 2,
            index: 1,
            relevanceScore: 0.8,
          },
        ],
      },
    ],
  };
}

function todayPlan() {
  return {
    generatedAt: new Date('2026-06-15T12:00:00.000Z'),
    items: [
      {
        id: 'today-1',
        subjectId: 'subject-1',
        subjectName: 'Droit constitutionnel',
        knowledgeUnitId: 'unit-1',
        knowledgeUnitTitle: 'Séparation des pouvoirs',
        masteryScore: 0.2,
        action: 'diagnostic_quiz',
        estimatedMinutes: 12,
        priority: 170,
        reasonCode: 'LOW_MASTERY',
        reason: 'À revoir en priorité.',
        startPayload: {
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          preferredAction: 'diagnostic_quiz',
        },
      },
      {
        id: 'today-2',
        subjectId: 'subject-1',
        subjectName: 'Droit constitutionnel',
        knowledgeUnitId: 'unit-2',
        knowledgeUnitTitle: 'Contrôle de constitutionnalité',
        masteryScore: null,
        action: 'open_question',
        estimatedMinutes: 18,
        priority: 140,
        reasonCode: 'MIX_ACTIVITY_TYPE',
        reason: 'Change de format pour renforcer la mémorisation.',
        startPayload: {
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-2',
          preferredAction: 'open_question',
        },
      },
      {
        id: 'today-3',
        subjectId: 'subject-1',
        subjectName: 'Droit constitutionnel',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        knowledgeUnitTitle: 'Séparation des pouvoirs',
        masteryScore: 0.2,
        action: 'rich_closed_exercise',
        estimatedMinutes: 8,
        priority: 130,
        reasonCode: 'RICH_CLOSED_PRACTICE',
        reason: 'Questions riches recommandées pour consolider la notion.',
        startPayload: {
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
        },
      },
      {
        id: 'today-4',
        subjectId: 'subject-1',
        subjectName: 'Droit constitutionnel',
        knowledgeUnitId: 'unit-1',
        knowledgeUnitTitle: 'Séparation des pouvoirs',
        masteryScore: 0.2,
        action: 'revision_session',
        estimatedMinutes: 25,
        priority: 120,
        reasonCode: 'START_REVISION_SESSION',
        reason: 'Lance une session guidée.',
        startPayload: {
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
        },
      },
    ],
  };
}

function diagnosticQuizActivity() {
  return {
    sessionId: 'quiz-session-1',
    type: 'diagnostic_quiz',
    title: 'QCM de démonstration',
    questions: [
      {
        id: 'question-1',
        prompt: 'Quel principe organise les pouvoirs ?',
        difficulty: 'MEDIUM',
        selectionMode: 'single',
        choices: [
          { id: 'choice-1', label: 'La séparation des pouvoirs' },
          { id: 'choice-2', label: 'La confusion des pouvoirs' },
        ],
        sources: [{ chunkId: 'chunk-1', pageNumber: 1, index: 0 }],
      },
    ],
  };
}

function qcmSubmissionResult() {
  return {
    correctAnswers: 2,
    totalQuestions: 2,
    score: 1,
    knowledgeUnitId: 'unit-1',
    items: [
      {
        questionId: 'question-1',
        selectedChoiceId: 'choice-1',
        correctChoiceId: 'choice-1',
        isCorrect: true,
      },
    ],
  };
}

function openQuestionActivity() {
  return {
    sessionId: 'open-session-1',
    type: 'open_question',
    version: 1,
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    question: {
      id: 'open-question-1',
      prompt: 'Explique la séparation des pouvoirs.',
      instructions: 'Structure ta réponse en deux paragraphes.',
      maxAnswerLength: 2500,
      sources: [{ chunkId: 'chunk-1', pageNumber: 1, index: 0 }],
    },
  };
}

function openAnswerSubmissionResult() {
  return {
    sessionId: 'open-session-1',
    type: 'open_question',
    status: 'submitted',
    evaluation: {
      id: 'evaluation-1',
      status: 'READY',
      score: 16,
      maxScore: 20,
      feedback: 'Réponse structurée.',
      presentPoints: ['Séparation institutionnelle'],
      missingPoints: ['Responsabilité politique'],
      errors: [],
      modelAnswer: 'La séparation des pouvoirs distingue les fonctions.',
      advice: 'Revois le régime parlementaire.',
      sources: [
        {
          chunkId: 'chunk-1',
          text: 'Extrait post-submit borné.',
          pageNumber: 1,
          index: 0,
        },
      ],
    },
  };
}

function richClosedPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-1',
    exercise: richClosedExerciseFixture(),
  });
}

function richClosedV1BPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1b',
    exercise: richClosedV1BExerciseFixture(),
  });
}

function richClosedV1BFullPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1b-full',
    exercise: richClosedV1BFullExerciseFixture(),
  });
}

function richClosedV1CPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1c',
    exercise: richClosedV1CExerciseFixture(),
  });
}

function richClosedV1CFullPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1c-full',
    exercise: richClosedV1CFullExerciseFixture(),
  });
}

function richClosedResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-1',
    exercise: richClosedExerciseFixture(),
    answers: richClosedAnswers(),
  });
}

function richClosedV1BResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1b',
    exercise: richClosedV1BExerciseFixture(),
    answers: richClosedV1BAnswers(),
  });
}

function richClosedV1BFullResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1b-full',
    exercise: richClosedV1BFullExerciseFixture(),
    answers: richClosedV1BFullAnswers(),
  });
}

function richClosedV1CResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1c',
    exercise: richClosedV1CExerciseFixture(),
    answers: richClosedV1CAnswers(),
  });
}

function richClosedV1CFullResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1c-full',
    exercise: richClosedV1CFullExerciseFixture(),
    answers: richClosedV1CFullAnswers(),
  });
}

function richClosedAnswers(): RichClosedAnswer[] {
  return [
    {
      questionId: 'single-1',
      questionKind: 'single_choice',
      choiceId: 'choice-a',
    },
    {
      questionId: 'multiple-1',
      questionKind: 'multiple_choice',
      choiceIds: ['choice-a', 'choice-b'],
    },
    {
      questionId: 'matching-1',
      questionKind: 'matching',
      pairs: [
        { leftId: 'left-1', rightId: 'right-1' },
        { leftId: 'left-2', rightId: 'right-2' },
        { leftId: 'left-3', rightId: 'right-3' },
      ],
    },
    {
      questionId: 'ordering-1',
      questionKind: 'ordering',
      orderedIds: ['item-1', 'item-2', 'item-3'],
    },
    {
      questionId: 'case-1',
      questionKind: 'case_qualification',
      choiceId: 'choice-a',
    },
    {
      questionId: 'error-1',
      questionKind: 'error_detection',
      errorId: 'error-a',
    },
  ];
}

function richClosedV1BAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedAnswers(),
    {
      questionId: 'timeline-1',
      questionKind: 'timeline',
      orderedEventIds: ['event-1', 'event-2', 'event-3'],
    },
    {
      questionId: 'date-slider-1',
      questionKind: 'date_slider',
      year: 1958,
    },
  ];
}

function richClosedV1BFullAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedV1BAnswers(),
    {
      questionId: 'true-false-grid-1',
      questionKind: 'true_false_grid',
      values: [
        { rowId: 'row-1', value: true },
        { rowId: 'row-2', value: false },
        { rowId: 'row-3', value: true },
      ],
    },
    {
      questionId: 'cause-consequence-1',
      questionKind: 'cause_consequence',
      pairs: [
        { causeId: 'cause-1', consequenceId: 'consequence-1' },
        { causeId: 'cause-2', consequenceId: 'consequence-2' },
        { causeId: 'cause-3', consequenceId: 'consequence-3' },
      ],
    },
  ];
}

function richClosedV1CAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedV1BFullAnswers(),
    {
      questionId: 'institution-matrix-1',
      questionKind: 'institution_matrix',
      values: [
        {
          cellId: 'cell-president-legitimacy',
          optionId: 'option-legitimacy-election',
        },
        {
          cellId: 'cell-government-responsibility',
          optionId: 'option-responsibility-assembly',
        },
        {
          cellId: 'cell-assembly-action',
          optionId: 'option-action-censure',
        },
      ],
    },
  ];
}

function richClosedV1CFullAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedV1CAnswers(),
    {
      questionId: 'diagram-labeling-1',
      questionKind: 'diagram_labeling',
      values: [
        {
          slotId: 'slot-government-role',
          optionId: 'option-government',
        },
        {
          slotId: 'slot-censure',
          optionId: 'option-motion-censure',
        },
        {
          slotId: 'slot-nomination',
          optionId: 'option-nomination',
        },
      ],
    },
  ];
}

function replaceRichClosedAnswer(answer: RichClosedAnswer): RichClosedAnswer[] {
  return richClosedAnswers().map((currentAnswer) =>
    currentAnswer.questionId === answer.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1BAnswer(
  answer: RichClosedAnswer,
): RichClosedAnswer[] {
  return richClosedV1BAnswers().map((currentAnswer) =>
    currentAnswer.questionId === answer.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1BFullAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return richClosedV1BFullAnswers().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1CAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return richClosedV1CAnswers().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1CFullAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return richClosedV1CFullAnswers().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function revisionSessionResponse() {
  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      createdAt: new Date('2026-06-15T12:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-1',
      kind: 'OPEN_QUESTION',
      status: 'READY',
      displayOrder: 0,
      activitySessionId: 'open-session-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      payload: openQuestionActivity(),
    },
    history: [
      {
        id: 'action-1',
        kind: 'OPEN_QUESTION',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: 'open-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    ],
  };
}

function richClosedRevisionSessionResponse() {
  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      createdAt: new Date('2026-06-15T12:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-rich-1',
      kind: 'RICH_CLOSED_EXERCISE',
      status: 'READY',
      displayOrder: 0,
      activitySessionId: null,
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      payload: {
        type: 'rich_closed_exercise',
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        reason: 'Questions riches recommandées.',
        estimatedMinutes: 8,
        preferredAction: 'rich_closed_exercise',
      },
    },
    history: [
      {
        id: 'action-rich-1',
        kind: 'RICH_CLOSED_EXERCISE',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: null,
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    ],
  };
}

function assertNoSensitivePreSubmitFields(payload: unknown): void {
  expect(collectSensitivePreSubmitFields(payload)).toEqual([]);
}

const forbiddenPreSubmitFields = new Set([
  'correction',
  'correctionPayload',
  'explanation',
  'feedback',
  'choiceFeedback',
  'modelAnswer',
  'answerText',
  'freeTextAnswer',
  'textAnswer',
  'score',
  'partialScore',
  'answersPayload',
  'storagePath',
  'promptVersion',
  'completion',
  'html',
  'svg',
  'rawSvg',
  'mermaid',
  'markdown',
  'widget',
  'component',
  'renderPayload',
  'style',
  'css',
  'script',
  'imageUrl',
  'assetUrl',
  'canvas',
  'code',
  'markup',
]);

function collectSensitivePreSubmitFields(
  value: unknown,
  path: string[] = [],
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectSensitivePreSubmitFields(item, [...path, String(index)]),
    );
  }

  if (typeof value !== 'object' || value === null) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const nextPath = [...path, key];
    const currentViolation =
      key.startsWith('correct') || forbiddenPreSubmitFields.has(key)
        ? [nextPath.join('.')]
        : [];

    return [
      ...currentViolation,
      ...collectSensitivePreSubmitFields(nestedValue, nextPath),
    ];
  });
}
