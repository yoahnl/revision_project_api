import type { ActivitiesRepository } from '../activities.repository';
import {
  RICH_CLOSED_SESSION_ALREADY_COMPLETED,
  RICH_CLOSED_SESSION_NOT_COMPLETED,
  RICH_CLOSED_SUBMIT_INVALID_INPUT,
} from './rich-closed-question-errors';
import { richClosedExerciseFixture } from './rich-closed-question.fixtures';
import { scoreRichClosedExerciseSubmission } from './rich-closed-question-scorer';
import type { RichClosedAnswer } from './rich-closed-question.types';
import { GetRichClosedExerciseResultUseCase } from './get-rich-closed-exercise-result.use-case';
import { GetRichClosedExerciseUseCase } from './get-rich-closed-exercise.use-case';
import { SubmitRichClosedExerciseUseCase } from './submit-rich-closed-exercise.use-case';

describe('rich closed exercise use cases', () => {
  it('gets public pre-submit exercise without correction', async () => {
    const repository = createActivitiesRepository();
    const result = await new GetRichClosedExerciseUseCase(repository).execute({
      studentId: 'student-1',
      sessionId: 'rich-session-1',
    });

    expect(
      repository.getRichClosedExerciseForStudent.mock.calls[0]?.[0],
    ).toEqual({
      studentId: 'student-1',
      sessionId: 'rich-session-1',
    });
    expect(JSON.stringify(result)).not.toContain('correctChoiceId');
    expect(JSON.stringify(result)).not.toContain('explanation');
  });

  it('scores and persists a submitted exercise', async () => {
    const repository = createActivitiesRepository();
    const result = await new SubmitRichClosedExerciseUseCase(
      repository,
    ).execute({
      studentId: 'student-1',
      sessionId: 'rich-session-1',
      answers: correctAnswers(),
    });

    expect(
      repository.saveRichClosedExerciseResult.mock.calls[0]?.[0],
    ).toMatchObject({
      studentId: 'student-1',
      sessionId: 'rich-session-1',
      answers: correctAnswers(),
      result: {
        correctAnswers: 6,
        totalQuestions: 6,
        score: 1,
      },
    });
    expect(result.correctAnswers).toBe(6);
  });

  it('rejects invalid submitted answers', async () => {
    const repository = createActivitiesRepository();

    await expect(
      new SubmitRichClosedExerciseUseCase(repository).execute({
        studentId: 'student-1',
        sessionId: 'rich-session-1',
        answers: [
          {
            questionId: 'unknown-question',
            questionKind: 'single_choice',
            choiceId: 'choice-a',
          },
        ],
      }),
    ).rejects.toThrow(RICH_CLOSED_SUBMIT_INVALID_INPUT);
    expect(repository.saveRichClosedExerciseResult.mock.calls).toHaveLength(0);
  });

  it('rejects double submit when the session is not started', async () => {
    const repository = createActivitiesRepository();
    repository.getInternalRichClosedExerciseForStudent.mockResolvedValue({
      sessionId: 'rich-session-1',
      status: 'COMPLETED',
      exercise: richClosedExerciseFixture(),
      result: scoreRichClosedExerciseSubmission({
        sessionId: 'rich-session-1',
        exercise: richClosedExerciseFixture(),
        answers: correctAnswers(),
      }),
    });

    await expect(
      new SubmitRichClosedExerciseUseCase(repository).execute({
        studentId: 'student-1',
        sessionId: 'rich-session-1',
        answers: correctAnswers(),
      }),
    ).rejects.toThrow(RICH_CLOSED_SESSION_ALREADY_COMPLETED);
    expect(repository.saveRichClosedExerciseResult.mock.calls).toHaveLength(0);
  });

  it('gets a post-submit result or rejects an unsubmitted session', async () => {
    const repository = createActivitiesRepository();

    await expect(
      new GetRichClosedExerciseResultUseCase(repository).execute({
        studentId: 'student-1',
        sessionId: 'rich-session-1',
      }),
    ).resolves.toMatchObject({
      sessionId: 'rich-session-1',
      status: 'completed',
    });

    repository.getRichClosedExerciseResultForStudent.mockRejectedValueOnce(
      new Error(RICH_CLOSED_SESSION_NOT_COMPLETED),
    );
    await expect(
      new GetRichClosedExerciseResultUseCase(repository).execute({
        studentId: 'student-1',
        sessionId: 'rich-session-2',
      }),
    ).rejects.toThrow(RICH_CLOSED_SESSION_NOT_COMPLETED);
  });
});

function createActivitiesRepository(): jest.Mocked<ActivitiesRepository> {
  const exercise = richClosedExerciseFixture();
  const result = scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-1',
    exercise,
    answers: correctAnswers(),
  });

  return {
    findDiagnosticQuizGenerationContext: jest.fn(),
    findOpenQuestionGenerationContext: jest.fn(),
    createDiagnosticQuiz: jest.fn(),
    createOpenQuestionActivity: jest.fn(),
    submitResult: jest.fn(),
    findOpenAnswerEvaluationContext: jest.fn(),
    saveOpenAnswerEvaluation: jest.fn(),
    findRichClosedGenerationContext: jest.fn(),
    createRichClosedExerciseSession: jest.fn(),
    getRichClosedExerciseForStudent: jest.fn().mockResolvedValue({
      sessionId: 'rich-session-1',
      type: 'rich_closed_exercise',
      id: exercise.id,
      version: exercise.version,
      title: exercise.title,
      subjectId: exercise.subjectId,
      documentId: exercise.documentId,
      knowledgeUnitId: exercise.knowledgeUnitId,
      questions: [],
    }),
    getInternalRichClosedExerciseForStudent: jest.fn().mockResolvedValue({
      sessionId: 'rich-session-1',
      status: 'STARTED',
      exercise,
      result: null,
    }),
    saveRichClosedExerciseResult: jest.fn().mockResolvedValue(result),
    getRichClosedExerciseResultForStudent: jest.fn().mockResolvedValue(result),
  };
}

function correctAnswers(): RichClosedAnswer[] {
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
