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
      items: [
        {
          questionId: 'question-1',
          knowledgeUnitId: 'unit-1',
          prompt: 'Question ?',
          selectedChoiceId: 'a',
          correctChoiceId: 'a',
          isCorrect: true,
          explanation: 'Explication.',
          choiceFeedback: [{ choiceId: 'a', feedback: 'Bien.' }],
          sources: [
            {
              chunkId: 'chunk-1',
              text: 'Extrait source.',
              pageNumber: null,
              index: 0,
            },
          ],
        },
      ],
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
      items: [
        {
          questionId: 'question-1',
          knowledgeUnitId: 'unit-1',
          prompt: 'Question ?',
          selectedChoiceId: 'a',
          correctChoiceId: 'a',
          isCorrect: true,
          explanation: 'Explication.',
          choiceFeedback: [{ choiceId: 'a', feedback: 'Bien.' }],
          sources: [
            {
              chunkId: 'chunk-1',
              text: 'Extrait source.',
              pageNumber: null,
              index: 0,
            },
          ],
        },
      ],
    });
  });
});

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
