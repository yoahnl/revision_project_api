import type {
  DiagnosticQuizActivity,
  ActivityQuestion,
} from '../../activities/application/activities.repository';
import type { QuestionBankService } from '../../activities/application/question-bank.service';
import { StartRevisionSessionUseCase } from '../../revision-sessions/application/start-revision-session.use-case';
import type { RevisionSessionResponseDto } from '../../revision-sessions/domain/revision-session.entity';
import {
  CourseExamPreparationQuestionCountInvalidError,
  CourseExamPreparationScopeNotReadyError,
  StartCourseExamPreparationSessionUseCase,
} from './start-course-exam-preparation-session.use-case';
import type {
  CourseDetailDto,
  CourseQuickRevisionKnowledgeUnitDto,
  CoursesRepository,
} from './courses.repository';

describe('StartCourseExamPreparationSessionUseCase', () => {
  it('starts an EXAM diagnostic session from the whole course without exposing corrections', async () => {
    const { repository, questionBank, startRevisionSession, useCase } =
      createHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(courseDetail());
    repository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue([
      knowledgeUnit({ id: 'unit-1', documentId: 'document-1' }),
      knowledgeUnit({ id: 'unit-2', documentId: 'document-2' }),
    ]);
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(20);
    questionBank.createCourseQuickDiagnosticQuiz.mockResolvedValue(
      diagnosticQuizActivity(),
    );
    startRevisionSession.execute.mockResolvedValue(revisionSessionResponse());

    const response = await useCase.execute({
      studentId: 'student-1',
      courseId: 'course-1',
      scopeKind: 'course',
      scopeId: 'course-1',
      questionCount: 20,
      complexityProfile: 'exam',
    });

    expect(
      questionBank.createCourseQuickDiagnosticQuiz.mock.calls[0]?.[0],
    ).toEqual({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      knowledgeUnits: [
        { id: 'unit-1', documentId: 'document-1' },
        { id: 'unit-2', documentId: 'document-2' },
      ],
      questionCount: 20,
    });
    expect(startRevisionSession.execute.mock.calls[0]?.[0]).toEqual({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      preferredAction: 'diagnostic_quiz',
      diagnosticQuizActivity: diagnosticQuizActivity(),
      mode: 'EXAM',
    });
    expect(response.session.mode).toBe('EXAM');
    expect(JSON.stringify(response)).not.toContain('correctChoiceId');
    expect(JSON.stringify(response)).not.toContain('correctChoiceIds');
    expect(JSON.stringify(response)).not.toContain('explanation');
  });

  it('starts an EXAM diagnostic session scoped to a ready source', async () => {
    const { repository, questionBank, startRevisionSession, useCase } =
      createHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(courseDetail());
    repository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue([
      knowledgeUnit({ id: 'unit-1', documentId: 'document-1' }),
      knowledgeUnit({ id: 'unit-2', documentId: 'document-2' }),
    ]);
    questionBank.countActiveCourseQuickQuestions.mockImplementation((input) =>
      Promise.resolve(input.knowledgeUnitIds?.includes('unit-1') ? 10 : 20),
    );
    questionBank.createCourseQuickDiagnosticQuiz.mockResolvedValue(
      diagnosticQuizActivity({ sessionId: 'activity-source-1' }),
    );
    startRevisionSession.execute.mockResolvedValue(
      revisionSessionResponse({ activitySessionId: 'activity-source-1' }),
    );

    await useCase.execute({
      studentId: 'student-1',
      courseId: 'course-1',
      scopeKind: 'source',
      scopeId: 'document-1',
      questionCount: 10,
      complexityProfile: 'exam',
    });

    expect(
      questionBank.createCourseQuickDiagnosticQuiz.mock.calls[0]?.[0],
    ).toMatchObject({
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      knowledgeUnits: [{ id: 'unit-1', documentId: 'document-1' }],
      questionCount: 10,
    });
  });

  it('refuses an unavailable source scope before creating a session', async () => {
    const { repository, questionBank, startRevisionSession, useCase } =
      createHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(courseDetail());
    repository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue([
      knowledgeUnit({ id: 'unit-1', documentId: 'document-1' }),
    ]);
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(10);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        scopeKind: 'source',
        scopeId: 'document-missing',
        questionCount: 10,
        complexityProfile: 'exam',
      }),
    ).rejects.toThrow(CourseExamPreparationScopeNotReadyError);

    expect(
      questionBank.createCourseQuickDiagnosticQuiz.mock.calls,
    ).toHaveLength(0);
    expect(startRevisionSession.execute.mock.calls).toHaveLength(0);
  });

  it('refuses an unsupported question count before reserving questions', async () => {
    const { repository, questionBank, startRevisionSession, useCase } =
      createHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(courseDetail());
    repository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue([
      knowledgeUnit({ id: 'unit-1', documentId: 'document-1' }),
    ]);
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(20);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        scopeKind: 'course',
        scopeId: 'course-1',
        questionCount: 15,
        complexityProfile: 'exam',
      }),
    ).rejects.toThrow(CourseExamPreparationQuestionCountInvalidError);

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
    findCourseProgressByIdForStudent: jest.fn(),
    findSubjectProgressForStudent: jest.fn(),
    getLifecycleDecisionForStudent: jest.fn(),
    updateForStudent: jest.fn(),
    archiveForStudent: jest.fn(),
    deleteIfEmpty: jest.fn(),
    findCourseOwnershipContext: jest.fn(),
    findFirstReadyCoursePdfDocumentForCourse: jest.fn(),
    findFirstQuickRevisionKnowledgeUnitForCourseDocument: jest.fn(),
    findReadyQuickRevisionKnowledgeUnitsForCourse: jest.fn(),
    attachDocumentToCourse: jest.fn(),
    backfillFromExistingDocumentsDryRun: jest.fn(),
    backfillFromExistingDocuments: jest.fn(),
  } as unknown as jest.Mocked<CoursesRepository>;
  const questionBank = {
    countActiveCourseQuickQuestions: jest.fn(),
    createCourseQuickDiagnosticQuiz: jest.fn(),
  } as unknown as jest.Mocked<QuestionBankService>;
  const startRevisionSession = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<StartRevisionSessionUseCase>;

  return {
    repository,
    questionBank,
    startRevisionSession,
    useCase: new StartCourseExamPreparationSessionUseCase(
      repository,
      questionBank,
      startRevisionSession,
    ),
  };
}

function courseDetail(): CourseDetailDto {
  return {
    course: {
      id: 'course-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
      title: 'Droit constitutionnel',
      description: null,
      chapterLabel: null,
      estimatedMinutes: 90,
      displayOrder: 0,
      createdAt: new Date('2026-06-20T10:00:00.000Z'),
      updatedAt: new Date('2026-06-20T10:00:00.000Z'),
      sourceCount: 2,
      readySourceCount: 2,
      processingSourceCount: 0,
      failedSourceCount: 0,
    },
    subject: {
      id: 'subject-1',
      name: 'Droit',
    },
    sources: [
      {
        id: 'source-1',
        courseId: 'course-1',
        documentId: 'document-1',
        fileName: 'CM.pdf',
        kind: 'COURSE_PDF',
        status: 'READY',
        errorCode: null,
        createdAt: new Date('2026-06-20T10:00:00.000Z'),
        updatedAt: new Date('2026-06-20T10:00:00.000Z'),
      },
      {
        id: 'source-2',
        courseId: 'course-1',
        documentId: 'document-2',
        fileName: 'TD.pdf',
        kind: 'COURSE_PDF',
        status: 'READY',
        errorCode: null,
        createdAt: new Date('2026-06-20T10:00:00.000Z'),
        updatedAt: new Date('2026-06-20T10:00:00.000Z'),
      },
    ],
  };
}

function knowledgeUnit(
  overrides: Partial<CourseQuickRevisionKnowledgeUnitDto> = {},
): CourseQuickRevisionKnowledgeUnitDto {
  return {
    id: 'unit-1',
    subjectId: 'subject-1',
    documentId: 'document-1',
    title: 'Contrôle parlementaire',
    ...overrides,
  };
}

function diagnosticQuizActivity(
  overrides: Partial<DiagnosticQuizActivity> & { questionCount?: number } = {},
): DiagnosticQuizActivity {
  const questionCount = overrides.questionCount ?? 2;
  const activity: DiagnosticQuizActivity = {
    sessionId: overrides.sessionId ?? 'activity-exam-1',
    type: 'diagnostic_quiz',
    title: 'Préparation examen',
    version: 3,
    documentId: 'document-1',
    subjectId: 'subject-1',
    questions: Array.from({ length: questionCount }, (_, index) =>
      activityQuestion(index + 1),
    ),
  };

  return {
    ...activity,
    ...overrides,
    questions: overrides.questions ?? activity.questions,
  };
}

function activityQuestion(index: number): ActivityQuestion {
  return {
    id: `question-${index}`,
    knowledgeUnitId: `unit-${index}`,
    prompt: `Question ${index} ?`,
    choices: [
      { id: 'a', label: 'Réponse A' },
      { id: 'b', label: 'Réponse B' },
    ],
  };
}

function revisionSessionResponse(
  overrides: { activitySessionId?: string } = {},
): RevisionSessionResponseDto {
  return {
    session: {
      id: 'exam-session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      mode: 'EXAM',
      createdAt: new Date('2026-06-20T10:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-1',
      kind: 'DIAGNOSTIC_QUIZ',
      status: 'READY',
      displayOrder: 0,
      activitySessionId: overrides.activitySessionId ?? 'activity-exam-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      payload: diagnosticQuizActivity({
        sessionId: overrides.activitySessionId ?? 'activity-exam-1',
      }),
    },
    history: [],
    draftAnswers: [],
  };
}
