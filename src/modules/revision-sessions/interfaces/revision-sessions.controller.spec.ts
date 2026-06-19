import { INestApplication } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../../app.module';
import { TOKEN_VERIFIER } from '../../auth/application/token-verifier';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import { CompleteQuickRevisionSessionUseCase } from '../application/complete-quick-revision-session.use-case';
import { GetRevisionSessionUseCase } from '../application/get-revision-session.use-case';
import { GetRevisionSessionResultUseCase } from '../application/get-revision-session-result.use-case';
import { RequestNextRevisionSessionActionUseCase } from '../application/request-next-revision-session-action.use-case';
import { StartRevisionSessionUseCase } from '../application/start-revision-session.use-case';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type { RevisionSessionResponseDto } from '../domain/revision-session.entity';

jest.mock('firebase-admin/app', () => ({
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(),
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

describe('RevisionSessionsController', () => {
  let app: INestApplication<App>;
  let startRevisionSession: { execute: jest.Mock };
  let getRevisionSession: { execute: jest.Mock };
  let requestNextAction: { execute: jest.Mock };
  let completeQuickRevisionSession: { execute: jest.Mock };
  let getRevisionSessionResult: { execute: jest.Mock };

  beforeEach(async () => {
    startRevisionSession = {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    };
    getRevisionSession = {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    };
    requestNextAction = {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    };
    completeQuickRevisionSession = {
      execute: jest.fn().mockResolvedValue(revisionSessionResult()),
    };
    getRevisionSessionResult = {
      execute: jest.fn().mockResolvedValue(revisionSessionResult()),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context
            .switchToHttp()
            .getRequest<{ student?: { id: string } }>();
          request.student = { id: 'student-1' };
          return true;
        },
      })
      .overrideProvider(TOKEN_VERIFIER)
      .useValue({ verify: jest.fn() })
      .overrideProvider(StartRevisionSessionUseCase)
      .useValue(startRevisionSession)
      .overrideProvider(GetRevisionSessionUseCase)
      .useValue(getRevisionSession)
      .overrideProvider(RequestNextRevisionSessionActionUseCase)
      .useValue(requestNextAction)
      .overrideProvider(CompleteQuickRevisionSessionUseCase)
      .useValue(completeQuickRevisionSession)
      .overrideProvider(GetRevisionSessionResultUseCase)
      .useValue(getRevisionSessionResult)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('creates a deterministic revision session for the current student', async () => {
    const response = await request(app.getHttpServer())
      .post('/revision-sessions')
      .send({
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        preferredAction: 'open_question',
      })
      .expect(201);

    expect(startRevisionSession.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      preferredAction: 'open_question',
    });
    const body = response.body as RevisionSessionResponseDto;
    expect(body.currentAction?.kind).toBe('OPEN_QUESTION');
    expect(JSON.stringify(response.body)).not.toContain('correctChoiceId');
    expect(JSON.stringify(response.body)).not.toContain('modelAnswer');
  });

  it('accepts rich closed preferred action as a bounded session action', async () => {
    startRevisionSession.execute.mockResolvedValueOnce(
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

    expect(startRevisionSession.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      preferredAction: 'rich_closed_exercise',
    });
    const body = response.body as RevisionSessionResponseDto;
    expect(body.currentAction?.kind).toBe('RICH_CLOSED_EXERCISE');
    expect(body.currentAction?.activitySessionId).toBeNull();
    expect(body.currentAction?.payload).toEqual({
      type: 'rich_closed_exercise',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      reason: 'Questions riches recommandées.',
      estimatedMinutes: 8,
      preferredAction: 'rich_closed_exercise',
    });
    expect(JSON.stringify(response.body)).not.toContain('questions');
    expect(JSON.stringify(response.body)).not.toContain('correction');
  });

  it('rejects malformed create payloads before calling the use case', async () => {
    await request(app.getHttpServer())
      .post('/revision-sessions')
      .send({ subjectId: '', preferredAction: 'open_question' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/revision-sessions')
      .send({ subjectId: 'subject-1', preferredAction: 'chat' })
      .expect(400);

    expect(startRevisionSession.execute).not.toHaveBeenCalled();
  });

  it('maps impossible open question actions to 422', async () => {
    startRevisionSession.execute.mockRejectedValue(
      new Error('Open question revision session requires a knowledge unit'),
    );

    await request(app.getHttpServer())
      .post('/revision-sessions')
      .send({ subjectId: 'subject-1', preferredAction: 'open_question' })
      .expect(422);
  });

  it('maps impossible rich closed actions to 422', async () => {
    startRevisionSession.execute.mockRejectedValue(
      new Error('Rich closed revision session requires a knowledge unit'),
    );

    await request(app.getHttpServer())
      .post('/revision-sessions')
      .send({
        subjectId: 'subject-1',
        preferredAction: 'rich_closed_exercise',
      })
      .expect(422);
  });

  it('loads an owned revision session without creating a new action', async () => {
    await request(app.getHttpServer())
      .get('/revision-sessions/revision-session-1')
      .expect(200);

    expect(getRevisionSession.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });
    expect(startRevisionSession.execute).not.toHaveBeenCalled();
  });

  it('maps unknown sessions to 404', async () => {
    getRevisionSession.execute.mockRejectedValue(
      new Error('Revision session not found'),
    );

    await request(app.getHttpServer())
      .get('/revision-sessions/missing-session')
      .expect(404);
  });

  it('requests a bounded next action for the current student', async () => {
    await request(app.getHttpServer())
      .post('/revision-sessions/revision-session-1/next-action')
      .send({ message: 'ignore me' })
      .expect(201);

    expect(requestNextAction.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });
    expect(JSON.stringify(requestNextAction.execute.mock.calls)).not.toContain(
      'ignore me',
    );
  });

  it('maps next action session and planning errors', async () => {
    requestNextAction.execute.mockRejectedValueOnce(
      new Error('Revision session not found'),
    );

    await request(app.getHttpServer())
      .post('/revision-sessions/missing-session/next-action')
      .expect(404);

    requestNextAction.execute.mockRejectedValueOnce(
      new Error('Revision coach no action available'),
    );

    await request(app.getHttpServer())
      .post('/revision-sessions/revision-session-1/next-action')
      .expect(422);
  });

  it('completes a quick session without accepting client result fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/revision-sessions/revision-session-1/complete')
      .send({})
      .expect(201);
    const body = response.body as ReturnType<typeof revisionSessionResult>;

    expect(completeQuickRevisionSession.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });
    expect(body.summary.score).toBeCloseTo(0.6666666667);
    expect(JSON.stringify(body)).not.toContain('correctChoiceId');
    expect(JSON.stringify(body)).not.toContain('selectedChoiceId');
    expect(JSON.stringify(body)).not.toContain('storagePath');
  });

  it('rejects non-empty complete bodies', async () => {
    await request(app.getHttpServer())
      .post('/revision-sessions/revision-session-1/complete')
      .send({ score: 1, activitySessionId: 'fake' })
      .expect(400);

    expect(completeQuickRevisionSession.execute).not.toHaveBeenCalled();
  });

  it('maps complete lifecycle conflicts', async () => {
    completeQuickRevisionSession.execute.mockRejectedValueOnce(
      new Error('Revision session activity not submitted'),
    );

    await request(app.getHttpServer())
      .post('/revision-sessions/revision-session-1/complete')
      .send({})
      .expect(409);

    completeQuickRevisionSession.execute.mockRejectedValueOnce(
      new Error('Revision session completion unsupported'),
    );

    await request(app.getHttpServer())
      .post('/revision-sessions/revision-session-1/complete')
      .send({})
      .expect(422);
  });

  it('returns a completed quick session result', async () => {
    const response = await request(app.getHttpServer())
      .get('/revision-sessions/revision-session-1/result')
      .expect(200);
    const body = response.body as ReturnType<typeof revisionSessionResult>;

    expect(getRevisionSessionResult.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });
    expect(body.knowledgeUnits).toEqual([
      {
        knowledgeUnitId: 'unit-1',
        title: 'Séparation des pouvoirs',
        correctAnswers: 4,
        totalQuestions: 6,
        score: 0.6666666667,
        state: 'TO_REVIEW',
      },
    ]);
  });

  it('maps result errors', async () => {
    getRevisionSessionResult.execute.mockRejectedValueOnce(
      new Error('Revision session not found'),
    );

    await request(app.getHttpServer())
      .get('/revision-sessions/missing-session/result')
      .expect(404);

    getRevisionSessionResult.execute.mockRejectedValueOnce(
      new Error('Revision session not completed'),
    );

    await request(app.getHttpServer())
      .get('/revision-sessions/revision-session-1/result')
      .expect(409);
  });
});

function revisionSessionResponse() {
  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      createdAt: new Date('2026-06-15T10:00:00.000Z'),
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
      payload: {
        type: 'open_question',
        sessionId: 'open-session-1',
      },
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
      createdAt: new Date('2026-06-15T10:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-1',
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
        id: 'action-1',
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

function revisionSessionResult() {
  return {
    session: {
      id: 'revision-session-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      mode: 'QUICK',
      status: 'COMPLETED',
      createdAt: new Date('2026-06-15T10:00:00.000Z'),
      completedAt: new Date('2026-06-15T10:04:12.000Z'),
    },
    summary: {
      correctAnswers: 4,
      totalQuestions: 6,
      score: 0.6666666667,
      durationSeconds: 252,
    },
    knowledgeUnits: [
      {
        knowledgeUnitId: 'unit-1',
        title: 'Séparation des pouvoirs',
        correctAnswers: 4,
        totalQuestions: 6,
        score: 0.6666666667,
        state: 'TO_REVIEW',
      },
    ],
  };
}
