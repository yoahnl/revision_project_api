import type { StartNextActivityUseCase } from '../../activities/application/start-next-activity.use-case';
import type { StartOpenQuestionActivityUseCase } from '../../activities/application/start-open-question-activity.use-case';
import type { RevisionCoachNextActionGenerator } from './revision-coach-next-action.generator';
import { RequestNextRevisionSessionActionUseCase } from './request-next-revision-session-action.use-case';
import type { RevisionSessionsRepository } from './revision-sessions.repository';

type AppendActionInput = Parameters<
  RevisionSessionsRepository['appendAction']
>[0];

describe('RequestNextRevisionSessionActionUseCase', () => {
  it('creates a diagnostic quiz from a coach decision', async () => {
    const repository = createRepository();
    const generator = createGenerator({
      actionKind: 'DIAGNOSTIC_QUIZ',
      knowledgeUnitId: null,
      reasonCode: 'CHECK_UNDERSTANDING',
    });
    const startNextActivity = createStartNextActivityUseCase();
    const startOpenQuestionActivity = createStartOpenQuestionActivityUseCase();
    const useCase = new RequestNextRevisionSessionActionUseCase(
      repository,
      generator,
      startNextActivity,
      startOpenQuestionActivity,
    );

    const result = await useCase.execute({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(generator.generate.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'revision-session-1',
          subjectId: 'subject-1',
          documentId: 'document-1',
          sessionKnowledgeUnitId: 'unit-1',
          history: [
            {
              kind: 'OPEN_QUESTION',
              status: 'READY',
              displayOrder: 0,
              activitySessionId: 'open-session-1',
              knowledgeUnitId: 'unit-1',
            },
          ],
          availableActions: ['DIAGNOSTIC_QUIZ', 'OPEN_QUESTION'],
          allowedKnowledgeUnitIds: ['unit-1', 'unit-2'],
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
    expect(repository.appendAction.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'revision-session-1',
          action: {
            kind: 'DIAGNOSTIC_QUIZ',
            status: 'READY',
            activitySessionId: 'quiz-session-2',
            documentId: 'document-1',
            knowledgeUnitId: null,
          },
        },
      ],
    ]);
    expect(result.currentAction?.payload).toEqual(diagnosticQuizActivity());
    expect(JSON.stringify(result)).not.toContain('correctChoiceId');
  });

  it('creates an open question from a coach decision', async () => {
    const repository = createRepository();
    const generator = createGenerator({
      actionKind: 'OPEN_QUESTION',
      knowledgeUnitId: 'unit-2',
      reasonCode: 'REINFORCE_CURRENT_KNOWLEDGE_UNIT',
    });
    const startNextActivity = createStartNextActivityUseCase();
    const startOpenQuestionActivity = createStartOpenQuestionActivityUseCase();

    const result = await new RequestNextRevisionSessionActionUseCase(
      repository,
      generator,
      startNextActivity,
      startOpenQuestionActivity,
    ).execute({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(startOpenQuestionActivity.execute.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-2',
        },
      ],
    ]);
    expect(startNextActivity.execute.mock.calls).toHaveLength(0);
    expect(repository.appendAction.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'revision-session-1',
          action: {
            kind: 'OPEN_QUESTION',
            status: 'READY',
            activitySessionId: 'open-session-2',
            documentId: 'document-1',
            knowledgeUnitId: 'unit-2',
          },
        },
      ],
    ]);
    expect(result.currentAction?.payload).toEqual(openQuestionActivity());
    expect(JSON.stringify(result)).not.toContain('modelAnswer');
    expect(JSON.stringify(result)).not.toContain('score');
  });

  it('uses deterministic fallback when the coach generator fails', async () => {
    const repository = createRepository();
    const generator = createGenerator(new Error('provider exploded'));
    const startNextActivity = createStartNextActivityUseCase();
    const startOpenQuestionActivity = createStartOpenQuestionActivityUseCase();

    await new RequestNextRevisionSessionActionUseCase(
      repository,
      generator,
      startNextActivity,
      startOpenQuestionActivity,
    ).execute({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(startNextActivity.execute.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          knowledgeUnitId: undefined,
        },
      ],
    ]);
    expect(repository.appendAction.mock.calls).toHaveLength(1);
  });

  it('does not persist an action when activity creation fails', async () => {
    const repository = createRepository();
    const generator = createGenerator({
      actionKind: 'DIAGNOSTIC_QUIZ',
      knowledgeUnitId: null,
      reasonCode: 'CHECK_UNDERSTANDING',
    });
    const startNextActivity = createStartNextActivityUseCase();
    startNextActivity.execute.mockRejectedValue(new Error('activity failed'));

    await expect(
      new RequestNextRevisionSessionActionUseCase(
        repository,
        generator,
        startNextActivity,
        createStartOpenQuestionActivityUseCase(),
      ).execute({
        studentId: 'student-1',
        sessionId: 'revision-session-1',
      }),
    ).rejects.toThrow('activity failed');

    expect(repository.appendAction.mock.calls).toHaveLength(0);
  });
});

function createRepository(): jest.Mocked<RevisionSessionsRepository> {
  return {
    ensureStartContext: jest.fn(),
    createWithInitialAction: jest.fn(),
    findByIdForStudent: jest.fn(),
    findPlanningContextByIdForStudent: jest.fn().mockResolvedValue({
      session: {
        id: 'revision-session-1',
        status: 'STARTED',
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
      actions: [
        {
          kind: 'OPEN_QUESTION',
          status: 'READY',
          displayOrder: 0,
          activitySessionId: 'open-session-1',
          knowledgeUnitId: 'unit-1',
        },
      ],
      allowedKnowledgeUnitIds: ['unit-1', 'unit-2'],
    }),
    appendAction: jest
      .fn()
      .mockImplementation((input: AppendActionInput) =>
        Promise.resolve(revisionSessionResponse(input)),
      ),
  };
}

function createGenerator(
  decisionOrError:
    | Awaited<ReturnType<RevisionCoachNextActionGenerator['generate']>>
    | Error,
): jest.Mocked<RevisionCoachNextActionGenerator> {
  return {
    generate:
      decisionOrError instanceof Error
        ? jest.fn().mockRejectedValue(decisionOrError)
        : jest.fn().mockResolvedValue(decisionOrError),
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

function diagnosticQuizActivity() {
  return {
    sessionId: 'quiz-session-2',
    type: 'diagnostic_quiz' as const,
    title: 'QCM suivant',
    subjectId: 'subject-1',
    documentId: null,
    questions: [
      {
        id: 'question-1',
        prompt: 'Quel mécanisme permet de vérifier la compréhension ?',
        choices: [
          { id: 'a', label: 'Un contrôle' },
          { id: 'b', label: 'Une intuition' },
        ],
      },
    ],
  };
}

function openQuestionActivity() {
  return {
    sessionId: 'open-session-2',
    type: 'open_question' as const,
    version: 1,
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-2',
    question: {
      id: 'open-question-2',
      prompt: 'Explique la notion avec le cours.',
      instructions: 'Structure ta réponse.',
      maxAnswerLength: 4000,
      sources: [{ chunkId: 'chunk-1', pageNumber: null, index: 0 }],
    },
  };
}

function revisionSessionResponse(input: AppendActionInput) {
  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED' as const,
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      createdAt: new Date('2026-06-15T10:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-2',
      kind: input.action.kind,
      status: 'READY' as const,
      displayOrder: 1,
      activitySessionId: input.action.activitySessionId,
      documentId: input.action.documentId,
      knowledgeUnitId: input.action.knowledgeUnitId,
      payload: {
        type:
          input.action.kind === 'OPEN_QUESTION'
            ? ('open_question' as const)
            : ('diagnostic_quiz' as const),
        sessionId: input.action.activitySessionId,
      },
    },
    history: [
      {
        id: 'action-1',
        kind: 'OPEN_QUESTION' as const,
        status: 'READY' as const,
        displayOrder: 0,
        activitySessionId: 'open-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
      {
        id: 'action-2',
        kind: input.action.kind,
        status: 'READY' as const,
        displayOrder: 1,
        activitySessionId: input.action.activitySessionId,
        documentId: input.action.documentId,
        knowledgeUnitId: input.action.knowledgeUnitId,
      },
    ],
  };
}
