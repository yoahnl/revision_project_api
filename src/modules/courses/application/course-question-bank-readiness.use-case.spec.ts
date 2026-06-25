import type { QuestionBankService } from '../../activities/application/question-bank.service';
import type { CourseQuestionBankPreparationQueue } from '../../jobs/application/course-question-bank-preparation.queue';
import type {
  CourseQuestionBankPreparationJobDto,
  CourseQuestionBankPreparationRepository,
} from './course-question-bank-preparation.repository';
import {
  GetCourseQuestionBankReadinessUseCase,
  PrepareCourseQuestionBankUseCase,
} from './course-question-bank-readiness.use-case';
import type {
  CourseDocumentDto,
  CourseQuickRevisionKnowledgeUnitDto,
  CoursesRepository,
} from './courses.repository';

describe('GetCourseQuestionBankReadinessUseCase', () => {
  it('reports no ready source before looking for questions or jobs', async () => {
    const { coursesRepository, preparationRepository, questionBank, useCase } =
      createReadinessHarness();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      courseContext(),
    );
    coursesRepository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      null,
    );

    await expect(
      useCase.execute({ studentId: 'student-1', courseId: 'course-1' }),
    ).resolves.toMatchObject({
      courseId: 'course-1',
      status: 'NO_READY_SOURCE',
      readyQuestionCount: 0,
      targetQuestionCount: 10,
      canStartQuickRevision: false,
      canPrepare: false,
    });

    expect(
      questionBank.countActiveCourseQuickQuestions.mock.calls,
    ).toHaveLength(0);
    expect(
      preparationRepository.findLatestForCourseContext,
    ).not.toHaveBeenCalled();
  });

  it('reports ready when the active question pool is large enough', async () => {
    const { coursesRepository, questionBank, useCase } =
      createReadinessHarness();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      courseContext(),
    );
    coursesRepository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      courseDocument(),
    );
    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
      [knowledgeUnit()],
    );
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(12);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        questionCount: 12,
      }),
    ).resolves.toMatchObject({
      status: 'READY',
      readyQuestionCount: 12,
      targetQuestionCount: 12,
      canStartQuickRevision: true,
      canPrepare: false,
    });
  });

  it('reports preparing when a preparation job is already pending', async () => {
    const { coursesRepository, preparationRepository, questionBank, useCase } =
      createReadinessHarness();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      courseContext(),
    );
    coursesRepository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      courseDocument(),
    );
    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
      [knowledgeUnit()],
    );
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(2);
    preparationRepository.findRecentForCourse.mockResolvedValue([
      preparationJob({ status: 'PENDING' }),
    ]);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        questionCount: 5,
      }),
    ).resolves.toMatchObject({
      status: 'PREPARING',
      readyQuestionCount: 2,
      targetQuestionCount: 5,
      canStartQuickRevision: false,
      canPrepare: false,
    });
  });

  it('reports preparing when per-KU jobs exist below the requested course-level target', async () => {
    const { coursesRepository, preparationRepository, questionBank, useCase } =
      createReadinessHarness();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      courseContext(),
    );
    coursesRepository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      courseDocument(),
    );
    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
      [
        knowledgeUnit({ id: 'ku-1' }),
        knowledgeUnit({ id: 'ku-2' }),
        knowledgeUnit({ id: 'ku-3' }),
      ],
    );
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(9);
    preparationRepository.findRecentForCourse.mockResolvedValue([
      preparationJob({
        id: 'prep-1',
        knowledgeUnitId: 'ku-1',
        status: 'PENDING',
      }),
      preparationJob({
        id: 'prep-2',
        knowledgeUnitId: 'ku-2',
        status: 'PENDING',
      }),
      preparationJob({
        id: 'prep-3',
        knowledgeUnitId: 'ku-3',
        status: 'PENDING',
      }),
    ]);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        questionCount: 10,
      }),
    ).resolves.toMatchObject({
      status: 'PREPARING',
      readyQuestionCount: 9,
      targetQuestionCount: 10,
      canStartQuickRevision: false,
      canPrepare: false,
    });
  });

  it('reports preparing when per-KU jobs are running below the requested course-level target', async () => {
    const { coursesRepository, preparationRepository, questionBank, useCase } =
      createReadinessHarness();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      courseContext(),
    );
    coursesRepository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      courseDocument(),
    );
    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
      [
        knowledgeUnit({ id: 'ku-1' }),
        knowledgeUnit({ id: 'ku-2' }),
        knowledgeUnit({ id: 'ku-3' }),
      ],
    );
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(9);
    preparationRepository.findRecentForCourse.mockResolvedValue([
      preparationJob({
        id: 'prep-1',
        knowledgeUnitId: 'ku-1',
        status: 'RUNNING',
      }),
      preparationJob({
        id: 'prep-2',
        knowledgeUnitId: 'ku-2',
        status: 'RUNNING',
      }),
      preparationJob({
        id: 'prep-3',
        knowledgeUnitId: 'ku-3',
        status: 'RUNNING',
      }),
    ]);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        questionCount: 10,
      }),
    ).resolves.toMatchObject({
      status: 'PREPARING',
      readyQuestionCount: 9,
      targetQuestionCount: 10,
    });
  });

  it('keeps reporting active smaller per-KU jobs as preparing work', async () => {
    const { coursesRepository, preparationRepository, questionBank, useCase } =
      createReadinessHarness();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      courseContext(),
    );
    coursesRepository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      courseDocument(),
    );
    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
      [
        knowledgeUnit({ id: 'ku-1' }),
        knowledgeUnit({ id: 'ku-2' }),
        knowledgeUnit({ id: 'ku-3' }),
      ],
    );
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(9);
    preparationRepository.findRecentForCourse.mockResolvedValue([
      preparationJob({
        id: 'prep-1',
        knowledgeUnitId: 'ku-1',
        targetQuestionCount: 5,
        status: 'PENDING',
      }),
      preparationJob({
        id: 'prep-2',
        knowledgeUnitId: 'ku-2',
        targetQuestionCount: 5,
        status: 'PENDING',
      }),
      preparationJob({
        id: 'prep-3',
        knowledgeUnitId: 'ku-3',
        targetQuestionCount: 5,
        status: 'PENDING',
      }),
    ]);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        questionCount: 30,
      }),
    ).resolves.toMatchObject({
      status: 'PREPARING',
      readyQuestionCount: 9,
      targetQuestionCount: 30,
      canPrepare: false,
    });
  });

  it('reports failed when only failed per-KU jobs exist below the requested course-level target', async () => {
    const { coursesRepository, preparationRepository, questionBank, useCase } =
      createReadinessHarness();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      courseContext(),
    );
    coursesRepository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      courseDocument(),
    );
    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
      [
        knowledgeUnit({ id: 'ku-1' }),
        knowledgeUnit({ id: 'ku-2' }),
        knowledgeUnit({ id: 'ku-3' }),
      ],
    );
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(9);
    preparationRepository.findRecentForCourse.mockResolvedValue([
      preparationJob({
        id: 'prep-1',
        knowledgeUnitId: 'ku-1',
        status: 'FAILED',
      }),
      preparationJob({
        id: 'prep-2',
        knowledgeUnitId: 'ku-2',
        status: 'FAILED',
      }),
      preparationJob({
        id: 'prep-3',
        knowledgeUnitId: 'ku-3',
        status: 'FAILED',
      }),
    ]);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        questionCount: 10,
      }),
    ).resolves.toMatchObject({
      status: 'FAILED',
      readyQuestionCount: 9,
      targetQuestionCount: 10,
    });
  });

  it('reports not prepared when only stale active jobs remain below the requested target', async () => {
    const { coursesRepository, preparationRepository, questionBank, useCase } =
      createReadinessHarness();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      courseContext(),
    );
    coursesRepository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      courseDocument(),
    );
    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
      [
        knowledgeUnit({ id: 'ku-1' }),
        knowledgeUnit({ id: 'ku-2' }),
        knowledgeUnit({ id: 'ku-3' }),
      ],
    );
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(9);
    preparationRepository.findRecentForCourse.mockResolvedValue([
      preparationJob({
        id: 'prep-stale-pending',
        status: 'PENDING',
        updatedAt: new Date('2026-06-22T08:00:00.000Z'),
      }),
      preparationJob({
        id: 'prep-stale-running',
        status: 'RUNNING',
        lockedAt: new Date('2026-06-22T08:00:00.000Z'),
        updatedAt: new Date('2026-06-22T08:00:00.000Z'),
      }),
    ]);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        questionCount: 10,
      }),
    ).resolves.toMatchObject({
      status: 'NOT_PREPARED',
      readyQuestionCount: 9,
      targetQuestionCount: 10,
      canPrepare: true,
    });
  });

  it('ignores stale failed jobs when deciding whether preparation can be retried', async () => {
    const { coursesRepository, preparationRepository, questionBank, useCase } =
      createReadinessHarness();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      courseContext(),
    );
    coursesRepository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      courseDocument(),
    );
    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
      [knowledgeUnit()],
    );
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(4);
    preparationRepository.findRecentForCourse.mockResolvedValue([
      preparationJob({
        id: 'prep-old-failed',
        status: 'FAILED',
        updatedAt: new Date('2026-06-22T08:00:00.000Z'),
      }),
    ]);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        questionCount: 5,
      }),
    ).resolves.toMatchObject({
      status: 'NOT_PREPARED',
      readyQuestionCount: 4,
      targetQuestionCount: 5,
      canPrepare: true,
    });
  });

  it('reports ready when enough questions exist even if older failed jobs remain', async () => {
    const { coursesRepository, preparationRepository, questionBank, useCase } =
      createReadinessHarness();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      courseContext(),
    );
    coursesRepository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      courseDocument(),
    );
    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
      [
        knowledgeUnit({ id: 'ku-1' }),
        knowledgeUnit({ id: 'ku-2' }),
        knowledgeUnit({ id: 'ku-3' }),
      ],
    );
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(10);
    preparationRepository.findRecentForCourse.mockResolvedValue([
      preparationJob({ status: 'FAILED' }),
    ]);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        questionCount: 10,
      }),
    ).resolves.toMatchObject({
      status: 'READY',
      readyQuestionCount: 10,
      targetQuestionCount: 10,
    });

    expect(preparationRepository.findRecentForCourse).not.toHaveBeenCalled();
  });

  it('reports ready from the total active question pool across multiple knowledge units', async () => {
    const { coursesRepository, questionBank, useCase } =
      createReadinessHarness();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      courseContext(),
    );
    coursesRepository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      courseDocument(),
    );
    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
      [
        knowledgeUnit({ id: 'ku-1' }),
        knowledgeUnit({ id: 'ku-2' }),
        knowledgeUnit({ id: 'ku-3' }),
      ],
    );
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(12);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        questionCount: 10,
      }),
    ).resolves.toMatchObject({
      status: 'READY',
      readyQuestionCount: 12,
      targetQuestionCount: 10,
      canStartQuickRevision: true,
    });

    expect(
      questionBank.countActiveCourseQuickQuestions.mock.calls[0]?.[0],
    ).toEqual({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      knowledgeUnitIds: ['ku-1', 'ku-2', 'ku-3'],
    });
  });
});

describe('PrepareCourseQuestionBankUseCase', () => {
  it('creates pending preparation jobs only for the missing deficit', async () => {
    const {
      coursesRepository,
      preparationQueue,
      preparationRepository,
      questionBank,
      useCase,
    } = createPrepareHarness();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      courseContext(),
    );
    coursesRepository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      courseDocument(),
    );
    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
      [
        knowledgeUnit({ id: 'ku-1', documentId: 'document-1' }),
        knowledgeUnit({ id: 'ku-2', documentId: 'document-2' }),
        knowledgeUnit({ id: 'ku-3', documentId: 'document-3' }),
        knowledgeUnit({ id: 'ku-4', documentId: 'document-4' }),
        knowledgeUnit({ id: 'ku-5', documentId: 'document-5' }),
        knowledgeUnit({ id: 'ku-6', documentId: 'document-6' }),
        knowledgeUnit({ id: 'ku-7', documentId: 'document-7' }),
      ],
    );
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(0);
    questionBank.countActiveCourseQuickQuestionsByKnowledgeUnit.mockResolvedValue(
      new Map([
        ['ku-1', 0],
        ['ku-2', 0],
        ['ku-3', 0],
        ['ku-4', 0],
        ['ku-5', 0],
        ['ku-6', 0],
        ['ku-7', 0],
      ]),
    );
    preparationRepository.findRecentForCourse.mockResolvedValue([]);
    preparationRepository.ensurePendingForCourseContext
      .mockResolvedValueOnce({
        job: preparationJob({
          id: 'prep-1',
          documentId: 'document-1',
          knowledgeUnitId: 'ku-1',
          targetQuestionCount: 2,
          status: 'PENDING',
        }),
        created: true,
      })
      .mockResolvedValueOnce({
        job: preparationJob({
          id: 'prep-2',
          documentId: 'document-2',
          knowledgeUnitId: 'ku-2',
          targetQuestionCount: 2,
          status: 'PENDING',
        }),
        created: true,
      })
      .mockResolvedValueOnce({
        job: preparationJob({
          id: 'prep-3',
          documentId: 'document-3',
          knowledgeUnitId: 'ku-3',
          targetQuestionCount: 2,
          status: 'PENDING',
        }),
        created: true,
      })
      .mockResolvedValueOnce({
        job: preparationJob({
          id: 'prep-4',
          documentId: 'document-4',
          knowledgeUnitId: 'ku-4',
          targetQuestionCount: 1,
          status: 'PENDING',
        }),
        created: true,
      })
      .mockResolvedValueOnce({
        job: preparationJob({
          id: 'prep-5',
          documentId: 'document-5',
          knowledgeUnitId: 'ku-5',
          targetQuestionCount: 1,
          status: 'PENDING',
        }),
        created: true,
      })
      .mockResolvedValueOnce({
        job: preparationJob({
          id: 'prep-6',
          documentId: 'document-6',
          knowledgeUnitId: 'ku-6',
          targetQuestionCount: 1,
          status: 'PENDING',
        }),
        created: true,
      })
      .mockResolvedValueOnce({
        job: preparationJob({
          id: 'prep-7',
          documentId: 'document-7',
          knowledgeUnitId: 'ku-7',
          targetQuestionCount: 1,
          status: 'PENDING',
        }),
        created: true,
      });

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        questionCount: 10,
      }),
    ).resolves.toMatchObject({
      status: 'PREPARING',
      readyQuestionCount: 0,
      targetQuestionCount: 10,
      canStartQuickRevision: false,
    });

    expect(
      preparationRepository.ensurePendingForCourseContext,
    ).toHaveBeenCalledTimes(7);

    expect(
      preparationRepository.ensurePendingForCourseContext,
    ).toHaveBeenNthCalledWith(1, {
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'ku-1',
      targetQuestionCount: 2,
    });
    expect(
      preparationRepository.ensurePendingForCourseContext,
    ).toHaveBeenNthCalledWith(2, {
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-2',
      knowledgeUnitId: 'ku-2',
      targetQuestionCount: 2,
    });
    expect(
      preparationRepository.ensurePendingForCourseContext,
    ).toHaveBeenNthCalledWith(3, {
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-3',
      knowledgeUnitId: 'ku-3',
      targetQuestionCount: 2,
    });
    expect(
      preparationRepository.ensurePendingForCourseContext,
    ).toHaveBeenNthCalledWith(4, {
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-4',
      knowledgeUnitId: 'ku-4',
      targetQuestionCount: 1,
    });
    expect(
      preparationRepository.ensurePendingForCourseContext,
    ).toHaveBeenNthCalledWith(5, {
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-5',
      knowledgeUnitId: 'ku-5',
      targetQuestionCount: 1,
    });
    expect(
      preparationRepository.ensurePendingForCourseContext,
    ).toHaveBeenNthCalledWith(6, {
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-6',
      knowledgeUnitId: 'ku-6',
      targetQuestionCount: 1,
    });
    expect(
      preparationRepository.ensurePendingForCourseContext,
    ).toHaveBeenNthCalledWith(7, {
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-7',
      knowledgeUnitId: 'ku-7',
      targetQuestionCount: 1,
    });
    expect(preparationQueue.enqueue).toHaveBeenNthCalledWith(1, {
      preparationJobId: 'prep-1',
    });
    expect(preparationQueue.enqueue).toHaveBeenNthCalledWith(2, {
      preparationJobId: 'prep-2',
    });
    expect(preparationQueue.enqueue).toHaveBeenNthCalledWith(3, {
      preparationJobId: 'prep-3',
    });
    expect(preparationQueue.enqueue).toHaveBeenNthCalledWith(4, {
      preparationJobId: 'prep-4',
    });
    expect(preparationQueue.enqueue).toHaveBeenNthCalledWith(5, {
      preparationJobId: 'prep-5',
    });
    expect(preparationQueue.enqueue).toHaveBeenNthCalledWith(6, {
      preparationJobId: 'prep-6',
    });
    expect(preparationQueue.enqueue).toHaveBeenNthCalledWith(7, {
      preparationJobId: 'prep-7',
    });
  });

  it('does not create preparation jobs when the active pool is sufficient', async () => {
    const {
      coursesRepository,
      preparationQueue,
      preparationRepository,
      questionBank,
      useCase,
    } = createPrepareHarness();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      courseContext(),
    );
    coursesRepository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      courseDocument(),
    );
    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
      [knowledgeUnit({ id: 'ku-1' })],
    );
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(12);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        questionCount: 10,
      }),
    ).resolves.toMatchObject({
      status: 'READY',
      readyQuestionCount: 12,
      targetQuestionCount: 10,
    });

    expect(
      questionBank.countActiveCourseQuickQuestionsByKnowledgeUnit.mock.calls,
    ).toHaveLength(0);
    expect(
      preparationRepository.ensurePendingForCourseContext.mock.calls,
    ).toHaveLength(0);
    expect(preparationQueue.enqueue.mock.calls).toHaveLength(0);
  });
});

function createReadinessHarness() {
  const coursesRepository = createCoursesRepositoryMock();
  const preparationRepository = createPreparationRepositoryMock();
  const questionBank = createQuestionBankMock();

  return {
    coursesRepository,
    preparationRepository,
    questionBank,
    useCase: new GetCourseQuestionBankReadinessUseCase(
      coursesRepository,
      preparationRepository,
      questionBank,
    ),
  };
}

function createPrepareHarness() {
  const coursesRepository = createCoursesRepositoryMock();
  const preparationRepository = createPreparationRepositoryMock();
  const questionBank = createQuestionBankMock();
  const preparationQueue = {
    enqueue: jest.fn().mockResolvedValue(undefined),
  } satisfies {
    [K in keyof CourseQuestionBankPreparationQueue]: jest.Mock;
  };

  return {
    coursesRepository,
    preparationRepository,
    preparationQueue,
    questionBank,
    useCase: new PrepareCourseQuestionBankUseCase(
      coursesRepository,
      preparationRepository,
      questionBank,
      preparationQueue,
    ),
  };
}

function createCoursesRepositoryMock() {
  return {
    findCourseOwnershipContext: jest.fn(),
    findFirstReadyCoursePdfDocumentForCourse: jest.fn(),
    findReadyQuickRevisionKnowledgeUnitsForCourse: jest.fn(),
  } as unknown as jest.Mocked<CoursesRepository>;
}

function createPreparationRepositoryMock() {
  return {
    findLatestForCourse: jest.fn(),
    findRecentForCourse: jest.fn(),
    findLatestForCourseContext: jest.fn(),
    ensurePendingForCourseContext: jest.fn(),
    claimNextPending: jest.fn(),
    markCompleted: jest.fn(),
    markFailed: jest.fn(),
  } satisfies {
    [K in keyof CourseQuestionBankPreparationRepository]: jest.Mock;
  };
}

function createQuestionBankMock() {
  return {
    countActiveCourseQuickQuestions: jest.fn(),
    countActiveCourseQuickQuestionsByKnowledgeUnit: jest.fn(),
    prepareCourseQuickQuestionBank: jest.fn(),
  } as unknown as jest.Mocked<QuestionBankService>;
}

function courseContext() {
  return {
    courseId: 'course-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
  };
}

function courseDocument(
  overrides: Partial<CourseDocumentDto> = {},
): CourseDocumentDto {
  return {
    id: 'document-1',
    courseId: 'course-1',
    documentId: 'document-1',
    fileName: 'cours.pdf',
    kind: 'COURSE_PDF',
    status: 'READY',
    errorCode: null,
    createdAt: new Date('2026-06-22T09:00:00.000Z'),
    updatedAt: new Date('2026-06-22T09:00:00.000Z'),
    ...overrides,
  };
}

function knowledgeUnit(
  overrides: Partial<CourseQuickRevisionKnowledgeUnitDto> = {},
): CourseQuickRevisionKnowledgeUnitDto {
  return {
    id: 'ku-1',
    subjectId: 'subject-1',
    documentId: 'document-1',
    title: 'La souveraineté',
    ...overrides,
  };
}

function preparationJob(
  overrides: Partial<CourseQuestionBankPreparationJobDto> = {},
): CourseQuestionBankPreparationJobDto {
  const now = new Date();

  return {
    id: 'prep-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    courseId: 'course-1',
    documentId: 'document-1',
    knowledgeUnitId: 'ku-1',
    targetQuestionCount: 5,
    status: 'PENDING',
    attempts: 0,
    lastError: null,
    lockedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
