import type { ActivitiesRepository } from './activities.repository';
import type { OpenAnswerEvaluator } from './open-answer-evaluator';
import type { RevisionRepository } from '../../revision/application/revision.repository';
import { MasteryState } from '../../revision/domain/mastery-state.entity';
import { SubmitOpenAnswerUseCase } from './submit-open-answer.use-case';

describe('SubmitOpenAnswerUseCase', () => {
  it('evaluates a valid open answer, persists READY evaluation and updates mastery', async () => {
    const activitiesRepository = createActivitiesRepository();
    const openAnswerEvaluator = createOpenAnswerEvaluator();
    const revisionRepository = createRevisionRepository();
    const practicedAt = new Date('2026-06-14T10:00:00.000Z');
    activitiesRepository.findOpenAnswerEvaluationContext.mockResolvedValue(
      evaluationContext(),
    );
    openAnswerEvaluator.evaluate.mockResolvedValue(readyEvaluation());
    activitiesRepository.saveOpenAnswerEvaluation.mockResolvedValue(
      readyEvaluationResult(),
    );
    revisionRepository.findMasteryStates.mockResolvedValue([
      new MasteryState({
        studentId: 'student-1',
        knowledgeUnitId: 'unit-1',
        score: 0.4,
        lastPracticedAt: null,
      }),
    ]);

    const result = await new SubmitOpenAnswerUseCase(
      activitiesRepository,
      openAnswerEvaluator,
      revisionRepository,
      () => practicedAt,
    ).execute({
      studentId: 'student-1',
      sessionId: 'session-1',
      answerText:
        'La séparation des pouvoirs organise les fonctions de l’État pour éviter leur concentration.',
    });

    expect(
      activitiesRepository.findOpenAnswerEvaluationContext.mock.calls,
    ).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'session-1',
        },
      ],
    ]);
    expect(openAnswerEvaluator.evaluate.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          documentId: 'document-1',
          activitySessionId: 'session-1',
          knowledgeUnit: evaluationContext().knowledgeUnit,
          question: evaluationContext().question,
          answerText:
            'La séparation des pouvoirs organise les fonctions de l’État pour éviter leur concentration.',
          chunks: evaluationContext().chunks,
        },
      ],
    ]);
    expect(activitiesRepository.saveOpenAnswerEvaluation.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'session-1',
          answerText:
            'La séparation des pouvoirs organise les fonctions de l’État pour éviter leur concentration.',
          evaluation: readyEvaluation(),
        },
      ],
    ]);
    expect(revisionRepository.upsertMastery.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          knowledgeUnitId: 'unit-1',
          score: 0.54,
          lastPracticedAt: practicedAt,
        },
      ],
    ]);
    expect(result).toEqual(readyEvaluationResult());
  });

  it('persists FAILED evaluation without updating mastery when the evaluator fails', async () => {
    const activitiesRepository = createActivitiesRepository();
    const openAnswerEvaluator = createOpenAnswerEvaluator();
    const revisionRepository = createRevisionRepository();
    activitiesRepository.findOpenAnswerEvaluationContext.mockResolvedValue(
      evaluationContext(),
    );
    openAnswerEvaluator.evaluate.mockRejectedValue(
      new Error('OPEN_ANSWER_EVALUATION_SOURCE_INVALID'),
    );
    activitiesRepository.saveOpenAnswerEvaluation.mockResolvedValue(
      failedEvaluationResult(),
    );

    const result = await new SubmitOpenAnswerUseCase(
      activitiesRepository,
      openAnswerEvaluator,
      revisionRepository,
    ).execute({
      studentId: 'student-1',
      sessionId: 'session-1',
      answerText:
        'La séparation des pouvoirs organise les fonctions de l’État pour éviter leur concentration.',
    });

    expect(activitiesRepository.saveOpenAnswerEvaluation.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'session-1',
          answerText:
            'La séparation des pouvoirs organise les fonctions de l’État pour éviter leur concentration.',
          evaluation: {
            status: 'FAILED',
            errorCode: 'OPEN_ANSWER_EVALUATION_SOURCE_INVALID',
          },
        },
      ],
    ]);
    expect(revisionRepository.upsertMastery.mock.calls).toHaveLength(0);
    expect(result).toEqual(failedEvaluationResult());
  });

  it.each([
    ['empty', ''],
    ['blank', '     '],
    ['too short', 'trop court'],
  ])('rejects %s answers', async (_label, answerText) => {
    const activitiesRepository = createActivitiesRepository();

    await expect(
      new SubmitOpenAnswerUseCase(
        activitiesRepository,
        createOpenAnswerEvaluator(),
        createRevisionRepository(),
      ).execute({
        studentId: 'student-1',
        sessionId: 'session-1',
        answerText,
      }),
    ).rejects.toThrow('Open answer is too short');

    expect(
      activitiesRepository.saveOpenAnswerEvaluation.mock.calls,
    ).toHaveLength(0);
  });

  it('rejects answers longer than the contract limit', async () => {
    const activitiesRepository = createActivitiesRepository();

    await expect(
      new SubmitOpenAnswerUseCase(
        activitiesRepository,
        createOpenAnswerEvaluator(),
        createRevisionRepository(),
      ).execute({
        studentId: 'student-1',
        sessionId: 'session-1',
        answerText: 'a'.repeat(4001),
      }),
    ).rejects.toThrow('Open answer is too long');

    expect(
      activitiesRepository.saveOpenAnswerEvaluation.mock.calls,
    ).toHaveLength(0);
  });
});

function createActivitiesRepository(): jest.Mocked<ActivitiesRepository> {
  return {
    findDiagnosticQuizGenerationContext: jest.fn(),
    createDiagnosticQuiz: jest.fn(),
    submitResult: jest.fn(),
    findOpenQuestionGenerationContext: jest.fn(),
    createOpenQuestionActivity: jest.fn(),
    findOpenAnswerEvaluationContext: jest.fn(),
    saveOpenAnswerEvaluation: jest.fn(),
  };
}

function createOpenAnswerEvaluator(): jest.Mocked<OpenAnswerEvaluator> {
  return {
    evaluate: jest.fn(),
  };
}

function createRevisionRepository(): jest.Mocked<RevisionRepository> {
  return {
    getActiveGoal: jest.fn(),
    saveGoal: jest.fn(),
    findKnowledgeUnits: jest.fn(),
    findMasteryStates: jest.fn().mockResolvedValue([]),
    upsertMastery: jest.fn(),
  };
}

function evaluationContext() {
  return {
    sessionId: 'session-1',
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnit: {
      id: 'unit-1',
      subjectId: 'subject-1',
      title: 'Séparation des pouvoirs',
      summary: 'Résumé.',
      sourceChunkIds: ['chunk-1'],
    },
    question: {
      id: 'open-question-1',
      prompt: 'Explique la notion.',
      instructions: 'Réponds avec le cours.',
      sourceChunkIds: ['chunk-1'],
    },
    chunks: [
      {
        id: 'chunk-1',
        index: 0,
        text: 'La séparation des pouvoirs organise les fonctions de l’État.',
        pageNumber: null,
      },
    ],
  };
}

function readyEvaluation() {
  return {
    status: 'READY' as const,
    score: 16,
    maxScore: 20,
    feedback: 'Réponse solide.',
    presentPoints: ['Point présent'],
    missingPoints: ['Point manquant'],
    errors: [],
    modelAnswer: 'Réponse modèle.',
    advice: 'Conseil.',
    sourceChunkIds: ['chunk-1'],
    metadata: {
      flowName: 'openAnswerEvaluation',
      provider: 'google-genai',
      model: 'googleai/gemini-2.5-flash',
      promptVersion: 'open-answer-evaluation-v1',
      schemaVersion: 'open-answer-evaluation-v1',
      inputSize: 1400,
    },
  };
}

function readyEvaluationResult() {
  return {
    sessionId: 'session-1',
    type: 'open_question',
    status: 'submitted',
    evaluation: {
      id: 'evaluation-1',
      status: 'READY',
      score: 16,
      maxScore: 20,
      feedback: 'Réponse solide.',
      presentPoints: ['Point présent'],
      missingPoints: ['Point manquant'],
      errors: [],
      modelAnswer: 'Réponse modèle.',
      advice: 'Conseil.',
      sources: [
        {
          chunkId: 'chunk-1',
          text: 'La séparation des pouvoirs organise les fonctions de l’État.',
          pageNumber: null,
          index: 0,
        },
      ],
    },
  };
}

function failedEvaluationResult() {
  return {
    sessionId: 'session-1',
    type: 'open_question',
    status: 'submitted',
    evaluation: {
      id: 'evaluation-1',
      status: 'FAILED',
      score: null,
      maxScore: null,
      feedback: null,
      presentPoints: [],
      missingPoints: [],
      errors: ['OPEN_ANSWER_EVALUATION_SOURCE_INVALID'],
      modelAnswer: null,
      advice: null,
      sources: [],
    },
  };
}
