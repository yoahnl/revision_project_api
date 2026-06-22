import type { QuestionBankService } from '../../activities/application/question-bank.service';
import type {
  CourseQuestionBankPreparationRepository,
  CourseQuestionBankPreparationJobDto,
} from './course-question-bank-preparation.repository';
import { ProcessCourseQuestionBankPreparationJobUseCase } from './process-course-question-bank-preparation-job.use-case';

describe('ProcessCourseQuestionBankPreparationJobUseCase', () => {
  it('prepares the question bank through the service and marks the job completed', async () => {
    const { preparationRepository, questionBank, useCase } = createHarness();
    preparationRepository.claimNextPending.mockResolvedValue(preparationJob());
    questionBank.countActiveCourseQuickQuestions
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5);

    await expect(
      useCase.execute({ preparationJobId: 'prep-1' }),
    ).resolves.toEqual({
      processed: true,
      preparationJobId: 'prep-1',
    });

    expect(
      questionBank.prepareCourseQuickQuestionBank.mock.calls[0]?.[0],
    ).toEqual({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'ku-1',
      questionCount: 5,
    });
    expect(preparationRepository.markCompleted).toHaveBeenCalledWith({
      preparationJobId: 'prep-1',
    });
    expect(preparationRepository.markFailed).not.toHaveBeenCalled();
  });

  it('marks already prepared jobs completed without calling the generator service', async () => {
    const { preparationRepository, questionBank, useCase } = createHarness();
    preparationRepository.claimNextPending.mockResolvedValue(preparationJob());
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(5);

    await expect(
      useCase.execute({ preparationJobId: 'prep-1' }),
    ).resolves.toEqual({
      processed: true,
      preparationJobId: 'prep-1',
    });

    expect(questionBank.prepareCourseQuickQuestionBank.mock.calls).toHaveLength(
      0,
    );
    expect(preparationRepository.markCompleted).toHaveBeenCalledWith({
      preparationJobId: 'prep-1',
    });
  });

  it('records preparation failures for retry', async () => {
    const { preparationRepository, questionBank, useCase } = createHarness();
    const failure = new Error('provider timeout');
    preparationRepository.claimNextPending.mockResolvedValue(preparationJob());
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(0);
    questionBank.prepareCourseQuickQuestionBank.mockRejectedValue(failure);

    await expect(
      useCase.execute({ preparationJobId: 'prep-1' }),
    ).rejects.toThrow('provider timeout');

    expect(preparationRepository.markFailed).toHaveBeenCalledWith({
      preparationJobId: 'prep-1',
      error: failure,
      maxAttempts: 3,
    });
    expect(preparationRepository.markCompleted).not.toHaveBeenCalled();
  });
});

function createHarness() {
  const preparationRepository = {
    findLatestForCourseContext: jest.fn(),
    ensurePendingForCourseContext: jest.fn(),
    claimNextPending: jest.fn(),
    markCompleted: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  } satisfies {
    [K in keyof CourseQuestionBankPreparationRepository]: jest.Mock;
  };
  const questionBank = {
    countActiveCourseQuickQuestions: jest.fn(),
    prepareCourseQuickQuestionBank: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<QuestionBankService>;

  return {
    preparationRepository,
    questionBank,
    useCase: new ProcessCourseQuestionBankPreparationJobUseCase(
      preparationRepository,
      questionBank,
    ),
  };
}

function preparationJob(
  overrides: Partial<CourseQuestionBankPreparationJobDto> = {},
): CourseQuestionBankPreparationJobDto {
  return {
    id: 'prep-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    courseId: 'course-1',
    documentId: 'document-1',
    knowledgeUnitId: 'ku-1',
    targetQuestionCount: 5,
    status: 'RUNNING',
    attempts: 0,
    lastError: null,
    lockedAt: new Date('2026-06-22T10:00:00.000Z'),
    completedAt: null,
    createdAt: new Date('2026-06-22T09:00:00.000Z'),
    updatedAt: new Date('2026-06-22T10:00:00.000Z'),
    ...overrides,
  };
}
