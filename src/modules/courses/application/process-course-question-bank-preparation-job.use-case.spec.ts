import { Logger } from '@nestjs/common';
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
      preparationJobId: 'prep-1',
      questionCount: 5,
    });
    expect(preparationRepository.markCompleted).toHaveBeenCalledWith({
      preparationJobId: 'prep-1',
    });
    expect(preparationRepository.markFailed).not.toHaveBeenCalled();
  });

  it('accepts a per-knowledge-unit target below the session minimum', async () => {
    const { preparationRepository, questionBank, useCase } = createHarness();
    preparationRepository.claimNextPending.mockResolvedValue(
      preparationJob({ targetQuestionCount: 4 }),
    );
    questionBank.countActiveCourseQuickQuestions
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4);
    questionBank.prepareCourseQuickQuestionBank.mockResolvedValue({
      activeBefore: 1,
      activeAfter: 4,
      generatedCount: 3,
      persistedCount: 3,
      duplicateSkippedCount: 0,
      structureSkippedCount: 0,
      aiGenerations: [],
    });

    await expect(
      useCase.execute({ preparationJobId: 'prep-1' }),
    ).resolves.toEqual({
      processed: true,
      preparationJobId: 'prep-1',
    });

    expect(
      questionBank.prepareCourseQuickQuestionBank.mock.calls[0]?.[0],
    ).toMatchObject({
      preparationJobId: 'prep-1',
      questionCount: 4,
    });
    expect(preparationRepository.markCompleted).toHaveBeenCalledWith({
      preparationJobId: 'prep-1',
    });
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

  it('fails with useful metrics when duplicate generations do not reach the target', async () => {
    const { preparationRepository, questionBank, useCase } = createHarness();
    preparationRepository.claimNextPending.mockResolvedValue(preparationJob());
    questionBank.countActiveCourseQuickQuestions
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(4);
    questionBank.prepareCourseQuickQuestionBank.mockResolvedValue({
      activeBefore: 4,
      activeAfter: 4,
      generatedCount: 1,
      persistedCount: 0,
      duplicateSkippedCount: 1,
      structureSkippedCount: 0,
    });

    await expect(
      useCase.execute({ preparationJobId: 'prep-1' }),
    ).rejects.toThrow(
      'Question bank preparation did not reach target: readyAfter=4; target=5; persisted=0; duplicateSkipped=1; structureSkipped=0',
    );

    expect(preparationRepository.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        preparationJobId: 'prep-1',
        maxAttempts: 3,
      }),
    );
  });

  it('fails with useful metrics when structure-only generations do not reach the target', async () => {
    const { preparationRepository, questionBank, useCase } = createHarness();
    preparationRepository.claimNextPending.mockResolvedValue(preparationJob());
    questionBank.countActiveCourseQuickQuestions
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(4);
    questionBank.prepareCourseQuickQuestionBank.mockResolvedValue({
      activeBefore: 4,
      activeAfter: 4,
      generatedCount: 1,
      persistedCount: 0,
      duplicateSkippedCount: 0,
      structureSkippedCount: 1,
    });

    await expect(
      useCase.execute({ preparationJobId: 'prep-1' }),
    ).rejects.toThrow(
      'Question bank preparation did not reach target: readyAfter=4; target=5; persisted=0; duplicateSkipped=0; structureSkipped=1',
    );
  });

  it('logs AI provider model and fallback metadata when a job completes', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const { preparationRepository, questionBank, useCase } = createHarness();
    preparationRepository.claimNextPending.mockResolvedValue(preparationJob());
    questionBank.countActiveCourseQuickQuestions
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5);
    questionBank.prepareCourseQuickQuestionBank.mockResolvedValue({
      activeBefore: 2,
      activeAfter: 5,
      generatedCount: 3,
      persistedCount: 3,
      duplicateSkippedCount: 0,
      structureSkippedCount: 0,
      aiGenerations: [
        {
          provider: 'mistral',
          model: 'mistral-large-latest',
          fallbackUsed: true,
          generatedCount: 3,
          persistedCount: 3,
        },
      ],
    });

    await useCase.execute({ preparationJobId: 'prep-1' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'course_question_bank_worker_completed',
        preparationJobId: 'prep-1',
        aiGenerations: [
          {
            provider: 'mistral',
            model: 'mistral-large-latest',
            fallbackUsed: true,
            generatedCount: 3,
            persistedCount: 3,
          },
        ],
      }),
    );

    logSpy.mockRestore();
  });
});

function createHarness() {
  const preparationRepository = {
    findLatestForCourse: jest.fn(),
    findRecentForCourse: jest.fn(),
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
    prepareCourseQuickQuestionBank: jest.fn().mockResolvedValue({
      activeBefore: 2,
      activeAfter: 5,
      generatedCount: 3,
      persistedCount: 3,
      duplicateSkippedCount: 0,
      structureSkippedCount: 0,
      aiGenerations: [],
    }),
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
