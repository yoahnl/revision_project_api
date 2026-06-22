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
    coursesRepository.findFirstQuickRevisionKnowledgeUnitForCourseDocument.mockResolvedValue(
      knowledgeUnit(),
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
    coursesRepository.findFirstQuickRevisionKnowledgeUnitForCourseDocument.mockResolvedValue(
      knowledgeUnit(),
    );
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(2);
    preparationRepository.findLatestForCourseContext.mockResolvedValue(
      preparationJob({ status: 'PENDING' }),
    );

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
});

describe('PrepareCourseQuestionBankUseCase', () => {
  it('creates one pending preparation job and enqueues it when questions are missing', async () => {
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
    coursesRepository.findFirstQuickRevisionKnowledgeUnitForCourseDocument.mockResolvedValue(
      knowledgeUnit(),
    );
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(1);
    preparationRepository.findLatestForCourseContext.mockResolvedValue(null);
    preparationRepository.ensurePendingForCourseContext.mockResolvedValue(
      preparationJob({ id: 'prep-1', status: 'PENDING' }),
    );

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        questionCount: 5,
      }),
    ).resolves.toMatchObject({
      status: 'PREPARING',
      readyQuestionCount: 1,
      targetQuestionCount: 5,
      canStartQuickRevision: false,
    });

    expect(
      preparationRepository.ensurePendingForCourseContext,
    ).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'ku-1',
      targetQuestionCount: 5,
    });
    expect(preparationQueue.enqueue).toHaveBeenCalledWith({
      preparationJobId: 'prep-1',
    });
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
    findFirstQuickRevisionKnowledgeUnitForCourseDocument: jest.fn(),
  } as unknown as jest.Mocked<CoursesRepository>;
}

function createPreparationRepositoryMock() {
  return {
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
    createdAt: new Date('2026-06-22T09:00:00.000Z'),
    updatedAt: new Date('2026-06-22T09:00:00.000Z'),
    ...overrides,
  };
}
