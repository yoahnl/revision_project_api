import { INestApplication } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../app.module';
import { REVISION_REPOSITORY } from '../revision/application/revision.repository';
import {
  ACTIVITIES_REPOSITORY,
  type DiagnosticQuizActivity,
  type OpenAnswerSubmissionResult,
  type OpenQuestionActivity,
} from './application/activities.repository';
import {
  DIAGNOSTIC_QUIZ_GENERATOR,
  type DiagnosticQuizGenerationInput,
  type GeneratedDiagnosticQuiz,
} from './application/diagnostic-quiz-generator';
import {
  OPEN_QUESTION_GENERATOR,
  type GeneratedOpenQuestion,
  type OpenQuestionGenerationInput,
} from './application/open-question-generator';
import {
  OPEN_ANSWER_EVALUATOR,
  type GeneratedOpenAnswerEvaluation,
  type OpenAnswerEvaluationInput,
} from './application/open-answer-evaluator';
import { KnowledgeUnit } from '../revision/domain/knowledge-unit.entity';
import { TOKEN_VERIFIER } from '../auth/application/token-verifier';
import { FirebaseAuthGuard } from '../auth/interfaces/firebase-auth.guard';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

jest.mock('firebase-admin/app', () => ({
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(),
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

type NextActivityResponseBody = {
  sessionId: string;
  type: string;
  title: string;
  questions: unknown[];
};

type CreateDiagnosticQuizInput = {
  studentId: string;
  subjectId: string;
  knowledgeUnitId: string;
  documentId?: string | null;
  quiz: GeneratedDiagnosticQuiz;
};

describe('ActivitiesModule', () => {
  let app: INestApplication<App>;
  let activitiesRepository: {
    findDiagnosticQuizGenerationContext: jest.Mock;
    findOpenQuestionGenerationContext: jest.Mock;
    createDiagnosticQuiz: jest.Mock<
      Promise<DiagnosticQuizActivity>,
      [CreateDiagnosticQuizInput]
    >;
    submitResult: jest.Mock;
    createOpenQuestionActivity: jest.Mock;
    findOpenAnswerEvaluationContext: jest.Mock;
    saveOpenAnswerEvaluation: jest.Mock;
  };
  let diagnosticQuizGenerator: {
    generate: jest.Mock<
      Promise<GeneratedDiagnosticQuiz>,
      [DiagnosticQuizGenerationInput]
    >;
  };
  let openQuestionGenerator: {
    generate: jest.Mock<
      Promise<GeneratedOpenQuestion>,
      [OpenQuestionGenerationInput]
    >;
  };
  let openAnswerEvaluator: {
    evaluate: jest.Mock<
      Promise<GeneratedOpenAnswerEvaluation>,
      [OpenAnswerEvaluationInput]
    >;
  };
  let revisionRepository: {
    findKnowledgeUnits: jest.Mock;
    findMasteryStates: jest.Mock;
    upsertMastery: jest.Mock;
  };

  beforeEach(async () => {
    delete process.env.DIAGNOSTIC_QUIZ_DEFAULT_QUESTION_COUNT;
    delete process.env.DIAGNOSTIC_QUIZ_MAX_QUESTION_COUNT;
    activitiesRepository = {
      findDiagnosticQuizGenerationContext: jest.fn().mockResolvedValue(null),
      findOpenQuestionGenerationContext: jest.fn().mockResolvedValue(null),
      createDiagnosticQuiz: jest.fn<
        Promise<DiagnosticQuizActivity>,
        [CreateDiagnosticQuizInput]
      >((input) =>
        Promise.resolve({
          sessionId: 'session-1',
          type: 'diagnostic_quiz',
          title: input.quiz.title,
          questions: input.quiz.questions.map(
            (
              question: {
                prompt: string;
                choices: Array<{ id: string; label: string }>;
              },
              index: number,
            ) => ({
              id: `question-${index + 1}`,
              prompt: question.prompt,
              choices: question.choices,
            }),
          ),
        }),
      ),
      submitResult: jest.fn().mockResolvedValue({
        correctAnswers: 1,
        totalQuestions: 1,
        score: 1,
        knowledgeUnitId: 'unit-1',
        items: [],
      }),
      findOpenAnswerEvaluationContext: jest.fn().mockResolvedValue({
        sessionId: 'open-session-1',
        subjectId: 'subject-1',
        documentId: null,
        knowledgeUnit: {
          id: 'unit-1',
          subjectId: 'subject-1',
          title: 'Revision constitutionnelle',
          summary: 'La Constitution de 1958 encadre la procedure de revision.',
          sourceChunkIds: [],
        },
        question: {
          id: 'open-question-1',
          prompt:
            'Explique comment la révision constitutionnelle est encadrée.',
          instructions: 'Réponds avec le cours.',
          sourceChunkIds: [],
        },
        chunks: [],
      }),
      createOpenQuestionActivity: jest
        .fn<Promise<OpenQuestionActivity>, []>()
        .mockResolvedValue({
          sessionId: 'open-session-1',
          type: 'open_question',
          version: 1,
          subjectId: 'subject-1',
          documentId: null,
          knowledgeUnitId: 'unit-1',
          question: {
            id: 'open-question-1',
            prompt:
              'Explique avec tes propres mots la notion suivante : Revision constitutionnelle.',
            instructions:
              'Réponds en quelques phrases structurées, en t’appuyant uniquement sur le cours.',
            maxAnswerLength: 4000,
            sources: [],
          },
        }),
      saveOpenAnswerEvaluation: jest
        .fn<Promise<OpenAnswerSubmissionResult>, []>()
        .mockResolvedValue({
          sessionId: 'open-session-1',
          type: 'open_question',
          status: 'submitted',
          evaluation: {
            id: 'evaluation-1',
            status: 'READY',
            score: 16,
            maxScore: 20,
            feedback: 'Réponse solide.',
            presentPoints: ['Procédure encadrée'],
            missingPoints: ['Limite matérielle'],
            errors: [],
            modelAnswer:
              'La révision constitutionnelle suit une procédure encadrée.',
            advice: 'Relis les limites de révision.',
            sources: [],
          },
        }),
    };
    diagnosticQuizGenerator = {
      generate: jest
        .fn<Promise<GeneratedDiagnosticQuiz>, [DiagnosticQuizGenerationInput]>()
        .mockResolvedValue({
          title: 'Diagnostic constitutionnel',
          questions: [
            {
              prompt:
                'Quelle limite materielle encadre la revision constitutionnelle en France ?',
              choices: [
                { id: 'a', label: 'La forme republicaine du gouvernement' },
                { id: 'b', label: 'La suppression du Parlement' },
              ],
              correctChoiceId: 'a',
              explanation:
                'La forme republicaine du gouvernement ne peut pas faire l objet d une revision.',
            },
          ],
        }),
    };
    openQuestionGenerator = {
      generate: jest
        .fn<Promise<GeneratedOpenQuestion>, [OpenQuestionGenerationInput]>()
        .mockResolvedValue({
          version: 1,
          prompt:
            'Explique comment la révision constitutionnelle est encadrée.',
          instructions: 'Réponds avec le cours.',
          maxAnswerLength: 2600,
          sourceChunkIds: [],
          metadata: {
            flowName: 'openQuestionGeneration',
            provider: 'google-genai',
            model: 'googleai/gemini-2.5-flash',
            promptVersion: 'open-question-generation-v1',
            schemaVersion: 'open-question-generation-v1',
            inputSize: 900,
          },
        }),
    };
    openAnswerEvaluator = {
      evaluate: jest
        .fn<
          Promise<GeneratedOpenAnswerEvaluation>,
          [OpenAnswerEvaluationInput]
        >()
        .mockResolvedValue({
          status: 'READY',
          score: 16,
          maxScore: 20,
          feedback: 'Réponse solide.',
          presentPoints: ['Procédure encadrée'],
          missingPoints: ['Limite matérielle'],
          errors: [],
          modelAnswer:
            'La révision constitutionnelle suit une procédure encadrée.',
          advice: 'Relis les limites de révision.',
          sourceChunkIds: [],
          metadata: {
            flowName: 'openAnswerEvaluation',
            provider: 'google-genai',
            model: 'googleai/gemini-2.5-flash',
            promptVersion: 'open-answer-evaluation-v1',
            schemaVersion: 'open-answer-evaluation-v1',
            inputSize: 1100,
          },
        }),
    };
    revisionRepository = {
      findKnowledgeUnits: jest.fn().mockResolvedValue([
        new KnowledgeUnit({
          id: 'unit-1',
          subjectId: 'subject-1',
          title: 'Revision constitutionnelle',
          summary: 'La Constitution de 1958 encadre la procedure de revision.',
        }),
      ]),
      findMasteryStates: jest.fn().mockResolvedValue([]),
      upsertMastery: jest.fn().mockResolvedValue({}),
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
      .overrideProvider(ACTIVITIES_REPOSITORY)
      .useValue(activitiesRepository)
      .overrideProvider(DIAGNOSTIC_QUIZ_GENERATOR)
      .useValue(diagnosticQuizGenerator)
      .overrideProvider(OPEN_QUESTION_GENERATOR)
      .useValue(openQuestionGenerator)
      .overrideProvider(OPEN_ANSWER_EVALUATOR)
      .useValue(openAnswerEvaluator)
      .overrideProvider(REVISION_REPOSITORY)
      .useValue(revisionRepository)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    delete process.env.DIAGNOSTIC_QUIZ_DEFAULT_QUESTION_COUNT;
    delete process.env.DIAGNOSTIC_QUIZ_MAX_QUESTION_COUNT;
  });

  it('registers activity routes through the app module', async () => {
    const nextResponse = await request(app.getHttpServer())
      .post('/activities/next')
      .send({ subjectId: 'subject-1', knowledgeUnitId: 'unit-1' })
      .expect(201);
    const nextBody = nextResponse.body as unknown as NextActivityResponseBody;

    expect(typeof nextBody.sessionId).toBe('string');
    expect(nextBody.type).toBe('diagnostic_quiz');
    expect(nextBody.title).toBe('Diagnostic constitutionnel');
    expect(Array.isArray(nextBody.questions)).toBe(true);
    const [generateInput] =
      diagnosticQuizGenerator.generate.mock.calls[0] ?? [];
    expect(generateInput?.knowledgeUnit.id).toBe('unit-1');
    expect(generateInput?.knowledgeUnit.title).toBe(
      'Revision constitutionnelle',
    );
    expect(generateInput?.questionCount).toBe(10);

    await request(app.getHttpServer())
      .post(`/activities/${nextBody.sessionId}/result`)
      .send({
        answers: [{ questionId: 'question-1', choiceId: 'a' }],
      })
      .expect(201)
      .expect({
        correctAnswers: 1,
        totalQuestions: 1,
        score: 1,
        items: [],
      });
  });

  it('accepts an explicit activity question count up to the configured max', async () => {
    await request(app.getHttpServer())
      .post('/activities/next')
      .send({
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
        questionCount: 20,
      })
      .expect(201);

    const [generateInput] =
      diagnosticQuizGenerator.generate.mock.calls[0] ?? [];
    expect(generateInput?.questionCount).toBe(20);
  });

  it('accepts bounded visual and selection capabilities for the next activity', async () => {
    await request(app.getHttpServer())
      .post('/activities/next')
      .send({
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
        visualsEnabled: true,
        visualTypes: ['CHART', 'DIAGRAM'],
        selectionModes: ['single', 'multiple'],
      })
      .expect(201);

    const [generateInput] =
      diagnosticQuizGenerator.generate.mock.calls[0] ?? [];
    expect(generateInput).toMatchObject({
      visualsEnabled: true,
      visualTypes: ['CHART', 'DIAGRAM'],
      selectionModes: ['single', 'multiple'],
    });
  });

  it('rejects image visual capability while document media is unsupported', async () => {
    await request(app.getHttpServer())
      .post('/activities/next')
      .send({
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
        visualsEnabled: true,
        visualTypes: ['IMAGE'],
      })
      .expect(400);

    expect(diagnosticQuizGenerator.generate).not.toHaveBeenCalled();
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['too high', 21],
    ['decimal', 1.5],
    ['string', '10'],
  ])('rejects %s activity question counts with 400', async (_label, value) => {
    await request(app.getHttpServer())
      .post('/activities/next')
      .send({
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
        questionCount: value,
      })
      .expect(400);

    expect(activitiesRepository.createDiagnosticQuiz).not.toHaveBeenCalled();
    expect(diagnosticQuizGenerator.generate).not.toHaveBeenCalled();
  });

  it('rejects malformed activity start payloads with 400', async () => {
    await request(app.getHttpServer())
      .post('/activities/next')
      .send({ subjectId: '', knowledgeUnitId: 'unit-1' })
      .expect(400);

    expect(activitiesRepository.createDiagnosticQuiz).not.toHaveBeenCalled();
  });

  it('returns 404 when an activity session is not found', async () => {
    activitiesRepository.submitResult.mockRejectedValue(
      new Error('Activity session not found'),
    );

    await request(app.getHttpServer())
      .post('/activities/missing-session/result')
      .send({
        answers: [{ questionId: 'question-1', choiceId: 'a' }],
      })
      .expect(404);
  });

  it('returns 409 when an activity session was already completed', async () => {
    activitiesRepository.submitResult.mockRejectedValue(
      new Error('Activity session already completed'),
    );

    await request(app.getHttpServer())
      .post('/activities/session-1/result')
      .send({
        answers: [{ questionId: 'question-1', choiceId: 'a' }],
      })
      .expect(409);
  });

  it('rejects malformed activity result payloads with 400', async () => {
    await request(app.getHttpServer())
      .post('/activities/session-1/result')
      .send({ answers: null })
      .expect(400);

    await request(app.getHttpServer())
      .post('/activities/session-1/result')
      .send({
        answers: [{ questionId: 'question-1' }],
      })
      .expect(400);

    expect(activitiesRepository.submitResult).not.toHaveBeenCalled();
  });

  it('accepts multiple choice answer payloads for result submission', async () => {
    await request(app.getHttpServer())
      .post('/activities/session-1/result')
      .send({
        answers: [{ questionId: 'question-1', choiceIds: ['a', 'c'] }],
      })
      .expect(201);

    expect(activitiesRepository.submitResult).toHaveBeenCalledWith({
      studentId: 'student-1',
      sessionId: 'session-1',
      answers: [{ questionId: 'question-1', choiceIds: ['a', 'c'] }],
    });
  });

  it('rejects malformed activity session ids with 400', async () => {
    await request(app.getHttpServer())
      .post('/activities/%20/result')
      .send({
        answers: [{ questionId: 'question-1', choiceId: 'a' }],
      })
      .expect(400);

    expect(activitiesRepository.submitResult).not.toHaveBeenCalled();
  });

  it('starts an open question activity without exposing correction data', async () => {
    const response = await request(app.getHttpServer())
      .post('/activities/open-question')
      .send({ subjectId: 'subject-1', knowledgeUnitId: 'unit-1' })
      .expect(201);

    expect(activitiesRepository.createOpenQuestionActivity).toHaveBeenCalled();
    expect(response.body).toEqual({
      sessionId: 'open-session-1',
      type: 'open_question',
      version: 1,
      subjectId: 'subject-1',
      documentId: null,
      knowledgeUnitId: 'unit-1',
      question: {
        id: 'open-question-1',
        prompt:
          'Explique avec tes propres mots la notion suivante : Revision constitutionnelle.',
        instructions:
          'Réponds en quelques phrases structurées, en t’appuyant uniquement sur le cours.',
        maxAnswerLength: 4000,
        sources: [],
      },
    });
    const publicPayload = JSON.stringify(response.body);
    expect(publicPayload).not.toContain('answerText');
    expect(publicPayload).not.toContain('modelAnswer');
    expect(publicPayload).not.toContain('score');
    expect(publicPayload).not.toContain('feedback');
  });

  it('submits an open answer and returns a ready evaluation contract', async () => {
    await request(app.getHttpServer())
      .post('/activities/open-session-1/open-answer')
      .send({
        answerText:
          'La révision constitutionnelle est une procédure encadrée par la Constitution.',
      })
      .expect(201)
      .expect({
        sessionId: 'open-session-1',
        type: 'open_question',
        status: 'submitted',
        evaluation: {
          id: 'evaluation-1',
          status: 'READY',
          score: 16,
          maxScore: 20,
          feedback: 'Réponse solide.',
          presentPoints: ['Procédure encadrée'],
          missingPoints: ['Limite matérielle'],
          errors: [],
          modelAnswer:
            'La révision constitutionnelle suit une procédure encadrée.',
          advice: 'Relis les limites de révision.',
          sources: [],
        },
      });

    expect(activitiesRepository.saveOpenAnswerEvaluation).toHaveBeenCalled();
    expect(openAnswerEvaluator.evaluate).toHaveBeenCalled();
    expect(activitiesRepository.saveOpenAnswerEvaluation).toHaveBeenCalledWith({
      studentId: 'student-1',
      sessionId: 'open-session-1',
      answerText:
        'La révision constitutionnelle est une procédure encadrée par la Constitution.',
      evaluation: expect.objectContaining({
        status: 'READY',
        score: 16,
        maxScore: 20,
      }) as GeneratedOpenAnswerEvaluation,
    });
    expect(revisionRepository.upsertMastery).toHaveBeenCalled();
  });

  it('rejects malformed open question and open answer payloads', async () => {
    await request(app.getHttpServer())
      .post('/activities/open-question')
      .send({ subjectId: '', knowledgeUnitId: 'unit-1' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/activities/open-session-1/open-answer')
      .send({ answerText: '' })
      .expect(400);

    expect(
      activitiesRepository.createOpenQuestionActivity,
    ).not.toHaveBeenCalled();
    expect(
      activitiesRepository.saveOpenAnswerEvaluation,
    ).not.toHaveBeenCalled();
  });
});
