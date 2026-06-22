import { MasteryState } from '../../revision/domain/mastery-state.entity';
import type { RevisionRepository } from '../../revision/application/revision.repository';
import type { ActivitiesRepository } from './activities.repository';
import { SubmitActivityResultUseCase } from './submit-activity-result.use-case';

type MockedActivitiesRepository = {
  createDiagnosticQuiz: jest.MockedFunction<
    ActivitiesRepository['createDiagnosticQuiz']
  >;
  submitResult: jest.MockedFunction<ActivitiesRepository['submitResult']>;
};

type MockedRevisionRepository = {
  getActiveGoal: jest.MockedFunction<RevisionRepository['getActiveGoal']>;
  saveGoal: jest.MockedFunction<RevisionRepository['saveGoal']>;
  findKnowledgeUnits: jest.MockedFunction<
    RevisionRepository['findKnowledgeUnits']
  >;
  findMasteryStates: jest.MockedFunction<
    RevisionRepository['findMasteryStates']
  >;
  upsertMastery: jest.MockedFunction<RevisionRepository['upsertMastery']>;
};

describe('SubmitActivityResultUseCase', () => {
  it('updates mastery with the quiz result before returning the public score', async () => {
    const practicedAt = new Date('2026-06-12T10:00:00.000Z');
    const activitiesRepository = createActivitiesRepository();
    const revisionRepository = createRevisionRepository();
    activitiesRepository.submitResult.mockResolvedValue({
      correctAnswers: 8,
      totalQuestions: 10,
      score: 0.8,
      knowledgeUnitId: 'unit-1',
      items: Array.from({ length: 10 }, (_, index) =>
        resultItem({
          questionId: `question-${index + 1}`,
          knowledgeUnitId: 'unit-1',
          isCorrect: index < 8,
        }),
      ),
    });
    revisionRepository.findMasteryStates.mockResolvedValue([
      new MasteryState({
        studentId: 'student-1',
        knowledgeUnitId: 'unit-1',
        score: 0.4,
        lastPracticedAt: new Date('2026-06-01T10:00:00.000Z'),
      }),
    ]);
    revisionRepository.upsertMastery.mockResolvedValue(
      new MasteryState({
        studentId: 'student-1',
        knowledgeUnitId: 'unit-1',
        score: 0.54,
        lastPracticedAt: practicedAt,
      }),
    );

    const useCase = new SubmitActivityResultUseCase(
      activitiesRepository,
      revisionRepository,
      () => practicedAt,
    );

    const result = await useCase.execute({
      studentId: 'student-1',
      sessionId: 'session-1',
      answers: [{ questionId: 'question-1', choiceId: 'a' }],
    });

    expect(activitiesRepository.submitResult).toHaveBeenCalledWith({
      studentId: 'student-1',
      sessionId: 'session-1',
      answers: [{ questionId: 'question-1', choiceId: 'a' }],
    });
    expect(revisionRepository.findMasteryStates).toHaveBeenCalledWith(
      'student-1',
    );
    expect(revisionRepository.upsertMastery).toHaveBeenCalledWith({
      studentId: 'student-1',
      knowledgeUnitId: 'unit-1',
      score: 0.54,
      lastPracticedAt: practicedAt,
    });
    expect(result).toEqual({
      correctAnswers: 8,
      totalQuestions: 10,
      score: 0.8,
      items: Array.from({ length: 10 }, (_, index) =>
        resultItem({
          questionId: `question-${index + 1}`,
          knowledgeUnitId: 'unit-1',
          isCorrect: index < 8,
        }),
      ),
    });
  });

  it('updates mastery per knowledge unit when a quick quiz spans multiple notions', async () => {
    const practicedAt = new Date('2026-06-12T10:00:00.000Z');
    const activitiesRepository = createActivitiesRepository();
    const revisionRepository = createRevisionRepository();
    activitiesRepository.submitResult.mockResolvedValue({
      correctAnswers: 3,
      totalQuestions: 4,
      score: 0.75,
      knowledgeUnitId: 'unit-1',
      items: [
        resultItem({
          questionId: 'question-1',
          knowledgeUnitId: 'unit-1',
          isCorrect: true,
        }),
        resultItem({
          questionId: 'question-2',
          knowledgeUnitId: 'unit-1',
          isCorrect: false,
        }),
        resultItem({
          questionId: 'question-3',
          knowledgeUnitId: 'unit-2',
          isCorrect: true,
        }),
        resultItem({
          questionId: 'question-4',
          knowledgeUnitId: 'unit-2',
          isCorrect: true,
        }),
      ],
    });
    revisionRepository.findMasteryStates.mockResolvedValue([
      new MasteryState({
        studentId: 'student-1',
        knowledgeUnitId: 'unit-1',
        score: 0.4,
        lastPracticedAt: null,
      }),
      new MasteryState({
        studentId: 'student-1',
        knowledgeUnitId: 'unit-2',
        score: 0.2,
        lastPracticedAt: null,
      }),
    ]);
    revisionRepository.upsertMastery.mockImplementation((input) =>
      Promise.resolve(new MasteryState(input)),
    );

    const useCase = new SubmitActivityResultUseCase(
      activitiesRepository,
      revisionRepository,
      () => practicedAt,
    );

    await useCase.execute({
      studentId: 'student-1',
      sessionId: 'session-1',
      answers: [
        { questionId: 'question-1', choiceId: 'a' },
        { questionId: 'question-2', choiceId: 'b' },
        { questionId: 'question-3', choiceId: 'a' },
        { questionId: 'question-4', choiceId: 'a' },
      ],
    });

    expect(
      revisionRepository.upsertMastery.mock.calls.map(([input]) => input),
    ).toEqual([
      {
        studentId: 'student-1',
        knowledgeUnitId: 'unit-1',
        score: 0.435,
        lastPracticedAt: practicedAt,
      },
      {
        studentId: 'student-1',
        knowledgeUnitId: 'unit-2',
        score: 0.48,
        lastPracticedAt: practicedAt,
      },
    ]);
  });
});

function resultItem(overrides: {
  questionId: string;
  knowledgeUnitId: string;
  isCorrect: boolean;
}) {
  return {
    questionId: overrides.questionId,
    knowledgeUnitId: overrides.knowledgeUnitId,
    prompt: 'Question ?',
    selectedChoiceId: overrides.isCorrect ? 'a' : 'b',
    correctChoiceId: 'a',
    isCorrect: overrides.isCorrect,
    explanation: 'Explication.',
    choiceFeedback: [],
    sources: [],
  };
}

function createActivitiesRepository(): MockedActivitiesRepository {
  return {
    createDiagnosticQuiz: jest.fn(),
    findDiagnosticQuizGenerationContext: jest.fn(),
    submitResult: jest.fn(),
  };
}

function createRevisionRepository(): MockedRevisionRepository {
  return {
    getActiveGoal: jest.fn(),
    saveGoal: jest.fn(),
    findKnowledgeUnits: jest.fn(),
    findMasteryStates: jest.fn(),
    upsertMastery: jest.fn(),
  };
}
