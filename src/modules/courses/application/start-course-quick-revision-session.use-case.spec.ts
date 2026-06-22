import type {
  DiagnosticQuizActivity,
  ActivityQuestion,
} from '../../activities/application/activities.repository';
import type { QuestionBankService } from '../../activities/application/question-bank.service';
import { StartRevisionSessionUseCase } from '../../revision-sessions/application/start-revision-session.use-case';
import type { RevisionSessionResponseDto } from '../../revision-sessions/domain/revision-session.entity';
import {
  CourseQuickRevisionKnowledgeUnitNotReadyError,
  CourseQuickRevisionQuestionsPreparingError,
  CourseQuickRevisionSourceNotReadyError,
  StartCourseQuickRevisionSessionUseCase,
} from './start-course-quick-revision-session.use-case';
import type { PrepareCourseQuestionBankUseCase } from './course-question-bank-readiness.use-case';
import type {
  CourseDocumentDto,
  CourseQuickRevisionKnowledgeUnitDto,
  CoursesRepository,
} from './courses.repository';

describe('StartCourseQuickRevisionSessionUseCase', () => {
  it('refuses an unknown or cross-student course before selecting a source', async () => {
    const { repository, startRevisionSession, useCase } = createHarness();
    repository.findCourseOwnershipContext.mockResolvedValue(null);

    await expect(
      useCase.execute({ studentId: 'student-2', courseId: 'course-1' }),
    ).rejects.toThrow('Course not found');

    expect(
      repository.findFirstReadyCoursePdfDocumentForCourse.mock.calls,
    ).toHaveLength(0);
    expect(startRevisionSession.execute.mock.calls).toHaveLength(0);
  });

  it('refuses a course without a READY course PDF source', async () => {
    const { repository, startRevisionSession, useCase } = createHarness();
    repository.findCourseOwnershipContext.mockResolvedValue(courseContext());
    repository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(null);

    await expect(
      useCase.execute({ studentId: 'student-1', courseId: 'course-1' }),
    ).rejects.toThrow(CourseQuickRevisionSourceNotReadyError);

    const knowledgeUnitLookupCalls =
      repository.findFirstQuickRevisionKnowledgeUnitForCourseDocument.mock
        .calls;
    expect(knowledgeUnitLookupCalls).toHaveLength(0);
    expect(startRevisionSession.execute.mock.calls).toHaveLength(0);
  });

  it('refuses a READY source without an exploitable knowledge unit', async () => {
    const { repository, startRevisionSession, useCase } = createHarness();
    repository.findCourseOwnershipContext.mockResolvedValue(courseContext());
    repository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      courseDocument(),
    );
    repository.findFirstQuickRevisionKnowledgeUnitForCourseDocument.mockResolvedValue(
      null,
    );

    await expect(
      useCase.execute({ studentId: 'student-1', courseId: 'course-1' }),
    ).rejects.toThrow(CourseQuickRevisionKnowledgeUnitNotReadyError);

    expect(startRevisionSession.execute.mock.calls).toHaveLength(0);
  });

  it('starts a QUICK diagnostic session using only backend-selected context', async () => {
    const { repository, startRevisionSession, questionBank, useCase } =
      createHarness();
    repository.findCourseOwnershipContext.mockResolvedValue(courseContext());
    repository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      courseDocument({ documentId: 'document-ready-1' }),
    );
    repository.findFirstQuickRevisionKnowledgeUnitForCourseDocument.mockResolvedValue(
      knowledgeUnit({ id: 'unit-ready-1' }),
    );
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(12);
    questionBank.createCourseQuickDiagnosticQuiz.mockResolvedValue(
      diagnosticQuizActivity({ questionCount: 12 }),
    );
    startRevisionSession.execute.mockResolvedValue(revisionSessionResponse());

    const response = await useCase.execute({
      studentId: 'student-1',
      courseId: 'course-1',
      questionCount: 12,
    });

    expect(
      repository.findFirstQuickRevisionKnowledgeUnitForCourseDocument.mock
        .calls[0]?.[0],
    ).toEqual({
      studentId: 'student-1',
      courseId: 'course-1',
      subjectId: 'subject-1',
      documentId: 'document-ready-1',
    });
    expect(
      questionBank.countActiveCourseQuickQuestions.mock.calls[0]?.[0],
    ).toEqual({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      knowledgeUnitId: 'unit-ready-1',
    });
    expect(
      questionBank.createCourseQuickDiagnosticQuiz.mock.calls[0]?.[0],
    ).toEqual({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-ready-1',
      knowledgeUnitId: 'unit-ready-1',
      questionCount: 12,
    });
    expect(startRevisionSession.execute.mock.calls[0]?.[0]).toEqual({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-ready-1',
      knowledgeUnitId: 'unit-ready-1',
      preferredAction: 'diagnostic_quiz',
      diagnosticQuizActivity: diagnosticQuizActivity({ questionCount: 12 }),
    });
    expect(response.session.courseId).toBe('course-1');
    expect(response.currentAction?.kind).toBe('DIAGNOSTIC_QUIZ');
  });

  it('starts async preparation instead of generating questions during quick start when the bank is missing questions', async () => {
    const {
      repository,
      startRevisionSession,
      questionBank,
      prepareQuestionBank,
      useCase,
    } = createHarness();
    repository.findCourseOwnershipContext.mockResolvedValue(courseContext());
    repository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      courseDocument({ documentId: 'document-ready-1' }),
    );
    repository.findFirstQuickRevisionKnowledgeUnitForCourseDocument.mockResolvedValue(
      knowledgeUnit({ id: 'unit-ready-1' }),
    );
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(2);
    prepareQuestionBank.execute.mockResolvedValue({
      courseId: 'course-1',
      status: 'PREPARING',
      readyQuestionCount: 2,
      targetQuestionCount: 5,
      canStartQuickRevision: false,
      canPrepare: false,
      userMessage:
        'Les questions sont en préparation. Réessaie dans un instant.',
    });

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        questionCount: 5,
      }),
    ).rejects.toThrow(CourseQuickRevisionQuestionsPreparingError);

    expect(prepareQuestionBank.execute.mock.calls[0]?.[0]).toEqual({
      studentId: 'student-1',
      courseId: 'course-1',
      questionCount: 5,
    });
    expect(
      questionBank.createCourseQuickDiagnosticQuiz.mock.calls,
    ).toHaveLength(0);
    expect(startRevisionSession.execute.mock.calls).toHaveLength(0);
  });
});

function createHarness() {
  const repository = {
    create: jest.fn(),
    findByIdForStudent: jest.fn(),
    listBySubjectForStudent: jest.fn(),
    listBySubjectForStudentWithStats: jest.fn(),
    findDetailByIdForStudent: jest.fn(),
    deleteIfEmpty: jest.fn(),
    findCourseOwnershipContext: jest.fn(),
    findFirstReadyCoursePdfDocumentForCourse: jest.fn(),
    findFirstQuickRevisionKnowledgeUnitForCourseDocument: jest.fn(),
    attachDocumentToCourse: jest.fn(),
    backfillFromExistingDocumentsDryRun: jest.fn(),
    backfillFromExistingDocuments: jest.fn(),
  } as unknown as jest.Mocked<CoursesRepository>;
  const startRevisionSession = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<StartRevisionSessionUseCase>;
  const questionBank = {
    countActiveCourseQuickQuestions: jest.fn(),
    createCourseQuickDiagnosticQuiz: jest.fn(),
  } as unknown as jest.Mocked<QuestionBankService>;
  const prepareQuestionBank = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<PrepareCourseQuestionBankUseCase>;

  return {
    repository,
    startRevisionSession,
    questionBank,
    prepareQuestionBank,
    useCase: new StartCourseQuickRevisionSessionUseCase(
      repository,
      startRevisionSession,
      questionBank,
      prepareQuestionBank,
    ),
  };
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
    id: 'document-ready-1',
    courseId: 'course-1',
    documentId: 'document-ready-1',
    fileName: 'cours.pdf',
    kind: 'COURSE_PDF',
    status: 'READY',
    errorCode: null,
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
    ...overrides,
  };
}

function knowledgeUnit(
  overrides: Partial<CourseQuickRevisionKnowledgeUnitDto> = {},
): CourseQuickRevisionKnowledgeUnitDto {
  return {
    id: 'unit-ready-1',
    subjectId: 'subject-1',
    documentId: 'document-ready-1',
    title: 'Contrôle parlementaire',
    ...overrides,
  };
}

function revisionSessionResponse(): RevisionSessionResponseDto {
  return {
    session: {
      id: 'session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-ready-1',
      knowledgeUnitId: 'unit-ready-1',
      mode: 'QUICK',
      createdAt: new Date('2026-06-18T10:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-1',
      kind: 'DIAGNOSTIC_QUIZ',
      status: 'READY',
      displayOrder: 0,
      activitySessionId: 'activity-1',
      documentId: 'document-ready-1',
      knowledgeUnitId: 'unit-ready-1',
      payload: {
        type: 'diagnostic_quiz',
        sessionId: 'activity-1',
      },
    },
    history: [],
  };
}

function diagnosticQuizActivity(input: {
  questionCount: number;
}): DiagnosticQuizActivity {
  return {
    sessionId: 'activity-1',
    type: 'diagnostic_quiz',
    title: 'Révision rapide',
    version: 3,
    documentId: 'document-ready-1',
    subjectId: 'subject-1',
    questions: Array.from({ length: input.questionCount }, (_value, index) =>
      diagnosticQuestion(index),
    ),
  };
}

function diagnosticQuestion(index: number): ActivityQuestion {
  return {
    id: `question-${index + 1}`,
    knowledgeUnitId: 'unit-ready-1',
    prompt: `Question ${index + 1}`,
    choices: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
  };
}
