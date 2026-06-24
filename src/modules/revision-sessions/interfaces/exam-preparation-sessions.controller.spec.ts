import { INestApplication } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import {
  GetExamPreparationSessionResultUseCase,
  GetExamPreparationSessionUseCase,
  SubmitExamPreparationSessionUseCase,
} from '../application/exam-preparation-sessions.use-cases';
import { ExamPreparationSessionsController } from './exam-preparation-sessions.controller';

describe('ExamPreparationSessionsController', () => {
  let app: INestApplication<App>;
  let getExamPreparationSession: { execute: jest.Mock };
  let submitExamPreparationSession: { execute: jest.Mock };
  let getExamPreparationSessionResult: { execute: jest.Mock };

  beforeEach(async () => {
    getExamPreparationSession = {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    };
    submitExamPreparationSession = {
      execute: jest.fn().mockResolvedValue(revisionSessionResult()),
    };
    getExamPreparationSessionResult = {
      execute: jest.fn().mockResolvedValue(revisionSessionResult()),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ExamPreparationSessionsController],
      providers: [
        {
          provide: GetExamPreparationSessionUseCase,
          useValue: getExamPreparationSession,
        },
        {
          provide: SubmitExamPreparationSessionUseCase,
          useValue: submitExamPreparationSession,
        },
        {
          provide: GetExamPreparationSessionResultUseCase,
          useValue: getExamPreparationSessionResult,
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const httpRequest = context
            .switchToHttp()
            .getRequest<{ student?: { id: string } }>();
          httpRequest.student = { id: 'student-1' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('returns an exam preparation session without completing it', async () => {
    const response = await request(app.getHttpServer())
      .get('/exam-preparation/sessions/exam-session-1')
      .expect(200);

    const body = response.body as unknown as RevisionSessionResponseBody;
    expect(body.session.mode).toBe('EXAM');
    expect(getExamPreparationSession.execute.mock.calls).toEqual([
      [{ studentId: 'student-1', sessionId: 'exam-session-1' }],
    ]);
    expect(submitExamPreparationSession.execute.mock.calls).toHaveLength(0);
  });

  it('submits answers and returns the canonical exam result', async () => {
    const response = await request(app.getHttpServer())
      .post('/exam-preparation/sessions/exam-session-1/submit')
      .send({
        answers: [
          { questionId: 'question-1', choiceId: 'choice-1' },
          { questionId: 'question-2', choiceIds: ['choice-2', 'choice-3'] },
        ],
      })
      .expect(201);

    const body = response.body as unknown as RevisionSessionResultBody;
    expect(body.session.mode).toBe('EXAM');
    expect(body.summary.score).toBe(1);
    expect(submitExamPreparationSession.execute.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'exam-session-1',
          answers: [
            { questionId: 'question-1', choiceId: 'choice-1' },
            { questionId: 'question-2', choiceIds: ['choice-2', 'choice-3'] },
          ],
        },
      ],
    ]);
  });

  it('returns a completed exam preparation result', async () => {
    const response = await request(app.getHttpServer())
      .get('/exam-preparation/sessions/exam-session-1/result')
      .expect(200);

    const body = response.body as unknown as RevisionSessionResultBody;
    expect(body.session.status).toBe('COMPLETED');
    expect(body.session.mode).toBe('EXAM');
    expect(getExamPreparationSessionResult.execute.mock.calls).toEqual([
      [{ studentId: 'student-1', sessionId: 'exam-session-1' }],
    ]);
  });

  it('rejects client-side result fields during submit', async () => {
    await request(app.getHttpServer())
      .post('/exam-preparation/sessions/exam-session-1/submit')
      .send({
        answers: [{ questionId: 'question-1', choiceId: 'choice-1' }],
        score: 1,
      })
      .expect(400);

    expect(submitExamPreparationSession.execute.mock.calls).toHaveLength(0);
  });
});

interface RevisionSessionResponseBody {
  session: {
    mode: string;
  };
}

interface RevisionSessionResultBody {
  session: {
    mode: string;
    status: string;
  };
  summary: {
    score: number;
  };
}

function revisionSessionResponse() {
  return {
    session: {
      id: 'exam-session-1',
      status: 'STARTED',
      mode: 'EXAM',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      createdAt: new Date('2026-06-20T10:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-exam-1',
      kind: 'DIAGNOSTIC_QUIZ',
      status: 'READY',
      displayOrder: 0,
      activitySessionId: 'activity-exam-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      payload: {
        type: 'diagnostic_quiz',
        sessionId: 'activity-exam-1',
        title: 'Préparation examen',
        questions: [
          {
            id: 'question-1',
            prompt: 'Quel principe organise les pouvoirs ?',
            choices: [
              { id: 'choice-1', label: 'La séparation des pouvoirs' },
              { id: 'choice-2', label: 'Le hasard' },
            ],
          },
        ],
      },
    },
    history: [],
  };
}

function revisionSessionResult() {
  return {
    session: {
      id: 'exam-session-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      mode: 'EXAM',
      status: 'COMPLETED',
      createdAt: new Date('2026-06-20T10:00:00.000Z'),
      completedAt: new Date('2026-06-20T10:05:00.000Z'),
    },
    summary: {
      correctAnswers: 1,
      totalQuestions: 1,
      score: 1,
      durationSeconds: 300,
    },
    knowledgeUnits: [
      {
        knowledgeUnitId: 'unit-1',
        title: 'Séparation des pouvoirs',
        correctAnswers: 1,
        totalQuestions: 1,
        score: 1,
        state: 'MASTERED',
      },
    ],
    corrections: [
      {
        prompt: 'Quel principe organise les pouvoirs ?',
        isCorrect: true,
        selectedAnswers: ['La séparation des pouvoirs'],
        correctAnswers: ['La séparation des pouvoirs'],
        explanation: 'La séparation des pouvoirs structure le régime.',
      },
    ],
  };
}
