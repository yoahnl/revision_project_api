import { StartRevisionSessionUseCase } from './start-revision-session.use-case';
import { GetRevisionSessionUseCase } from './get-revision-session.use-case';
import type { RevisionSessionsRepository } from './revision-sessions.repository';
import type { StartNextActivityUseCase } from '../../activities/application/start-next-activity.use-case';
import type { StartOpenQuestionActivityUseCase } from '../../activities/application/start-open-question-activity.use-case';

type EnsureStartContextInput = Parameters<
  RevisionSessionsRepository['ensureStartContext']
>[0];
type CreateWithInitialActionInput = Parameters<
  RevisionSessionsRepository['createWithInitialAction']
>[0];

describe('StartRevisionSessionUseCase', () => {
  it('creates a diagnostic quiz session by default with a subject only', async () => {
    const repository = createRevisionSessionsRepository();
    const startNextActivity = createStartNextActivityUseCase();
    const startOpenQuestionActivity = createStartOpenQuestionActivityUseCase();
    const useCase = new StartRevisionSessionUseCase(
      repository,
      startNextActivity,
      startOpenQuestionActivity,
    );

    const result = await useCase.execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });

    expect(repository.ensureStartContext.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          documentId: undefined,
          knowledgeUnitId: undefined,
        },
      ],
    ]);
    expect(startNextActivity.execute.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          knowledgeUnitId: undefined,
        },
      ],
    ]);
    expect(startOpenQuestionActivity.execute.mock.calls).toHaveLength(0);
    expect(repository.createWithInitialAction.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          documentId: null,
          knowledgeUnitId: null,
          action: {
            kind: 'DIAGNOSTIC_QUIZ',
            status: 'READY',
            displayOrder: 0,
            activitySessionId: 'quiz-session-1',
            documentId: null,
            knowledgeUnitId: null,
          },
        },
      ],
    ]);
    expect(result.currentAction.kind).toBe('DIAGNOSTIC_QUIZ');
    expect(result.currentAction.payload).toEqual(diagnosticQuizActivity());
    expect(JSON.stringify(result)).not.toContain('correctChoiceId');
    expect(JSON.stringify(result)).not.toContain('feedback');
  });

  it('creates an open question session by default when a knowledge unit is provided', async () => {
    const repository = createRevisionSessionsRepository();
    const startNextActivity = createStartNextActivityUseCase();
    const startOpenQuestionActivity = createStartOpenQuestionActivityUseCase();
    const useCase = new StartRevisionSessionUseCase(
      repository,
      startNextActivity,
      startOpenQuestionActivity,
    );

    const result = await useCase.execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
    });

    expect(startOpenQuestionActivity.execute.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
        },
      ],
    ]);
    expect(startNextActivity.execute.mock.calls).toHaveLength(0);
    expect(repository.createWithInitialAction.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
          action: {
            kind: 'OPEN_QUESTION',
            status: 'READY',
            displayOrder: 0,
            activitySessionId: 'open-session-1',
            documentId: 'document-1',
            knowledgeUnitId: 'unit-1',
          },
        },
      ],
    ]);
    expect(result.currentAction.kind).toBe('OPEN_QUESTION');
    expect(result.currentAction.payload).toEqual(openQuestionActivity());
    expect(JSON.stringify(result)).not.toContain('modelAnswer');
    expect(JSON.stringify(result)).not.toContain('score');
  });

  it('honors diagnostic quiz as an explicit preferred action', async () => {
    const repository = createRevisionSessionsRepository();
    const startNextActivity = createStartNextActivityUseCase();
    const useCase = new StartRevisionSessionUseCase(
      repository,
      startNextActivity,
      createStartOpenQuestionActivityUseCase(),
    );

    const result = await useCase.execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      preferredAction: 'diagnostic_quiz',
    });

    expect(startNextActivity.execute.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
        },
      ],
    ]);
    expect(result.currentAction.kind).toBe('DIAGNOSTIC_QUIZ');
  });

  it('creates a bounded rich closed exercise launcher without starting an activity', async () => {
    const repository = createRevisionSessionsRepository();
    const startNextActivity = createStartNextActivityUseCase();
    const startOpenQuestionActivity = createStartOpenQuestionActivityUseCase();
    const useCase = new StartRevisionSessionUseCase(
      repository,
      startNextActivity,
      startOpenQuestionActivity,
    );

    const result = await useCase.execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      preferredAction: 'rich_closed_exercise',
    });

    expect(startNextActivity.execute.mock.calls).toHaveLength(0);
    expect(startOpenQuestionActivity.execute.mock.calls).toHaveLength(0);
    expect(repository.createWithInitialAction.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
          action: {
            kind: 'RICH_CLOSED_EXERCISE',
            status: 'READY',
            displayOrder: 0,
            activitySessionId: null,
            documentId: 'document-1',
            knowledgeUnitId: 'unit-1',
          },
        },
      ],
    ]);
    expect(result.currentAction.kind).toBe('RICH_CLOSED_EXERCISE');
    expect(result.currentAction.activitySessionId).toBeNull();
    expect(result.currentAction.payload).toEqual({
      type: 'rich_closed_exercise',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      knowledgeUnitTitle: 'Notion 1',
      reason: 'Questions riches recommandées pour consolider cette notion.',
      estimatedMinutes: 8,
      preferredAction: 'rich_closed_exercise',
    });
    expect(JSON.stringify(result)).not.toContain('questions');
    expect(JSON.stringify(result)).not.toContain('correction');
    expect(JSON.stringify(result)).not.toContain('correctChoiceId');
  });

  it('rejects open question preferred action without a knowledge unit', async () => {
    const useCase = new StartRevisionSessionUseCase(
      createRevisionSessionsRepository(),
      createStartNextActivityUseCase(),
      createStartOpenQuestionActivityUseCase(),
    );

    await expect(
      useCase.execute({
        studentId: 'student-1',
        subjectId: 'subject-1',
        preferredAction: 'open_question',
      }),
    ).rejects.toThrow(
      'Open question revision session requires a knowledge unit',
    );
  });

  it('rejects rich closed preferred action without a knowledge unit', async () => {
    const useCase = new StartRevisionSessionUseCase(
      createRevisionSessionsRepository(),
      createStartNextActivityUseCase(),
      createStartOpenQuestionActivityUseCase(),
    );

    await expect(
      useCase.execute({
        studentId: 'student-1',
        subjectId: 'subject-1',
        preferredAction: 'rich_closed_exercise',
      }),
    ).rejects.toThrow('Rich closed revision session requires a knowledge unit');
  });
});

describe('GetRevisionSessionUseCase', () => {
  it('returns an owned revision session without creating a new action', async () => {
    const repository = createRevisionSessionsRepository();

    const result = await new GetRevisionSessionUseCase(repository).execute({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(repository.findByIdForStudent.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'revision-session-1',
        },
      ],
    ]);
    expect(repository.createWithInitialAction.mock.calls).toHaveLength(0);
    expect(result.currentAction?.payload).toEqual({
      type: 'open_question',
      sessionId: 'open-session-1',
    });
  });
});

function createRevisionSessionsRepository(): jest.Mocked<RevisionSessionsRepository> {
  return {
    ensureStartContext: jest
      .fn()
      .mockImplementation((input: EnsureStartContextInput) =>
        Promise.resolve({
          subjectId: input.subjectId,
          documentId: input.knowledgeUnitId ? 'document-1' : null,
          knowledgeUnitId: input.knowledgeUnitId ?? null,
          knowledgeUnitTitle: input.knowledgeUnitId ? 'Notion 1' : null,
        }),
      ),
    createWithInitialAction: jest
      .fn()
      .mockImplementation((input: CreateWithInitialActionInput) =>
        Promise.resolve(
          revisionSessionResponse(
            input.action.kind,
            input.action.activitySessionId ?? 'activity-session-1',
          ),
        ),
      ),
    findByIdForStudent: jest
      .fn()
      .mockResolvedValue(
        revisionSessionResponse('OPEN_QUESTION', 'open-session-1'),
      ),
    findResumableCourseSessionForStudent: jest.fn(),
    findCompletedCourseSessionsForStudent: jest.fn(),
    findCompletedSessionsForStudent: jest.fn(),
    saveDraftAnswer: jest.fn(),
    deleteDraftAnswer: jest.fn(),
    findPlanningContextByIdForStudent: jest.fn(),
    appendAction: jest.fn(),
    completeQuickSession: jest.fn(),
    findResultByIdForStudent: jest.fn(),
  };
}

function createStartNextActivityUseCase(): jest.Mocked<StartNextActivityUseCase> {
  return {
    execute: jest.fn().mockResolvedValue(diagnosticQuizActivity()),
  } as unknown as jest.Mocked<StartNextActivityUseCase>;
}

function createStartOpenQuestionActivityUseCase(): jest.Mocked<StartOpenQuestionActivityUseCase> {
  return {
    execute: jest.fn().mockResolvedValue(openQuestionActivity()),
  } as unknown as jest.Mocked<StartOpenQuestionActivityUseCase>;
}

function revisionSessionResponse(
  kind: 'DIAGNOSTIC_QUIZ' | 'OPEN_QUESTION' | 'RICH_CLOSED_EXERCISE',
  activitySessionId: string,
) {
  const isKnowledgeUnitAction =
    kind === 'OPEN_QUESTION' || kind === 'RICH_CLOSED_EXERCISE';

  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED' as const,
      subjectId: 'subject-1',
      documentId: isKnowledgeUnitAction ? 'document-1' : null,
      knowledgeUnitId: isKnowledgeUnitAction ? 'unit-1' : null,
      createdAt: new Date('2026-06-15T10:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-1',
      kind,
      status: 'READY' as const,
      displayOrder: 0,
      activitySessionId:
        kind === 'RICH_CLOSED_EXERCISE' ? null : activitySessionId,
      documentId: isKnowledgeUnitAction ? 'document-1' : null,
      knowledgeUnitId: isKnowledgeUnitAction ? 'unit-1' : null,
      payload:
        kind === 'RICH_CLOSED_EXERCISE'
          ? {
              type: 'rich_closed_exercise',
              subjectId: 'subject-1',
              documentId: 'document-1',
              knowledgeUnitId: 'unit-1',
              reason:
                'Questions riches recommandées pour consolider cette notion.',
              estimatedMinutes: 8,
              preferredAction: 'rich_closed_exercise',
            }
          : kind === 'OPEN_QUESTION'
            ? { type: 'open_question', sessionId: activitySessionId }
            : { type: 'diagnostic_quiz', sessionId: activitySessionId },
    },
    history: [
      {
        id: 'action-1',
        kind,
        status: 'READY' as const,
        displayOrder: 0,
        activitySessionId:
          kind === 'RICH_CLOSED_EXERCISE' ? null : activitySessionId,
        documentId: isKnowledgeUnitAction ? 'document-1' : null,
        knowledgeUnitId: isKnowledgeUnitAction ? 'unit-1' : null,
      },
    ],
  };
}

function diagnosticQuizActivity() {
  return {
    sessionId: 'quiz-session-1',
    type: 'diagnostic_quiz' as const,
    title: 'Diagnostic constitutionnel',
    subjectId: 'subject-1',
    documentId: null,
    questions: [
      {
        id: 'question-1',
        prompt: 'Quel principe protège contre la concentration du pouvoir ?',
        choices: [
          { id: 'a', label: 'La séparation des pouvoirs' },
          { id: 'b', label: 'La confusion des pouvoirs' },
        ],
      },
    ],
  };
}

function openQuestionActivity() {
  return {
    sessionId: 'open-session-1',
    type: 'open_question' as const,
    version: 1,
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    question: {
      id: 'open-question-1',
      prompt: 'Explique la séparation des pouvoirs.',
      instructions: 'Réponds avec le cours.',
      maxAnswerLength: 4000,
      sources: [{ chunkId: 'chunk-1', pageNumber: null, index: 0 }],
    },
  };
}
