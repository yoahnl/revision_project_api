import type { ActivitiesRepository } from './activities.repository';
import { SubmitOpenAnswerUseCase } from './submit-open-answer.use-case';

describe('SubmitOpenAnswerUseCase', () => {
  it('submits a valid open answer and returns a pending evaluation contract', async () => {
    const activitiesRepository = createActivitiesRepository();
    activitiesRepository.submitOpenAnswer.mockResolvedValue(
      pendingEvaluationResult(),
    );

    const result = await new SubmitOpenAnswerUseCase(
      activitiesRepository,
    ).execute({
      studentId: 'student-1',
      sessionId: 'session-1',
      answerText:
        'La séparation des pouvoirs organise les fonctions de l’État pour éviter leur concentration.',
    });

    expect(activitiesRepository.submitOpenAnswer.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'session-1',
          answerText:
            'La séparation des pouvoirs organise les fonctions de l’État pour éviter leur concentration.',
        },
      ],
    ]);
    expect(result).toEqual(pendingEvaluationResult());
  });

  it.each([
    ['empty', ''],
    ['blank', '     '],
    ['too short', 'trop court'],
  ])('rejects %s answers', async (_label, answerText) => {
    const activitiesRepository = createActivitiesRepository();

    await expect(
      new SubmitOpenAnswerUseCase(activitiesRepository).execute({
        studentId: 'student-1',
        sessionId: 'session-1',
        answerText,
      }),
    ).rejects.toThrow('Open answer is too short');

    expect(activitiesRepository.submitOpenAnswer.mock.calls).toHaveLength(0);
  });

  it('rejects answers longer than the contract limit', async () => {
    const activitiesRepository = createActivitiesRepository();

    await expect(
      new SubmitOpenAnswerUseCase(activitiesRepository).execute({
        studentId: 'student-1',
        sessionId: 'session-1',
        answerText: 'a'.repeat(4001),
      }),
    ).rejects.toThrow('Open answer is too long');

    expect(activitiesRepository.submitOpenAnswer.mock.calls).toHaveLength(0);
  });
});

function createActivitiesRepository(): jest.Mocked<ActivitiesRepository> {
  return {
    findDiagnosticQuizGenerationContext: jest.fn(),
    createDiagnosticQuiz: jest.fn(),
    submitResult: jest.fn(),
    findOpenQuestionGenerationContext: jest.fn(),
    createOpenQuestionActivity: jest.fn(),
    submitOpenAnswer: jest.fn(),
  };
}

function pendingEvaluationResult() {
  return {
    sessionId: 'session-1',
    type: 'open_question',
    status: 'submitted',
    evaluation: {
      id: 'evaluation-1',
      status: 'PENDING',
      score: null,
      maxScore: null,
      feedback: null,
      presentPoints: [],
      missingPoints: [],
      errors: [],
      modelAnswer: null,
      advice: null,
      sources: [],
    },
  };
}
