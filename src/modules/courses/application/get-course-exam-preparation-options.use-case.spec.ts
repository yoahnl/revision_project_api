import type { QuestionBankService } from '../../activities/application/question-bank.service';
import { GetCourseExamPreparationOptionsUseCase } from './get-course-exam-preparation-options.use-case';
import type {
  CourseDetailDto,
  CourseDocumentDto,
  CourseQuickRevisionKnowledgeUnitDto,
  CoursesRepository,
} from './courses.repository';

describe('GetCourseExamPreparationOptionsUseCase', () => {
  it('returns bounded exam options for a ready course without answers or corrections', async () => {
    const { coursesRepository, questionBank, useCase } = createHarness();
    coursesRepository.findDetailByIdForStudent.mockResolvedValue(
      courseDetail({
        sources: [
          courseDocument({ id: 'document-1', fileName: 'CM.pdf' }),
          courseDocument({
            id: 'document-2',
            documentId: 'document-2',
            fileName: 'TD.pdf',
          }),
        ],
      }),
    );
    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
      [
        knowledgeUnit({ id: 'ku-1', documentId: 'document-1' }),
        knowledgeUnit({ id: 'ku-2', documentId: 'document-1' }),
        knowledgeUnit({ id: 'ku-3', documentId: 'document-2' }),
      ],
    );
    questionBank.countActiveCourseQuickQuestions.mockImplementation(
      (input: { knowledgeUnitIds?: string[] }) => {
        if (!input.knowledgeUnitIds || input.knowledgeUnitIds.length === 3) {
          return Promise.resolve(24);
        }

        return Promise.resolve(
          input.knowledgeUnitIds.includes('ku-3') ? 8 : 16,
        );
      },
    );

    const options = await useCase.execute({
      studentId: 'student-1',
      courseId: 'course-1',
    });

    expect(options).toEqual({
      course: {
        id: 'course-1',
        title: 'Droit constitutionnel',
        subjectId: 'subject-1',
      },
      readiness: {
        canPrepare: true,
        state: 'READY',
        userMessage: 'Ton cours est prêt pour une préparation examen.',
        blockers: [],
        readySourceCount: 2,
        readyKnowledgeUnitCount: 3,
        availableQuestionCount: 24,
      },
      scopeOptions: [
        {
          kind: 'course',
          id: 'course-1',
          label: 'Tout le cours',
          readyQuestionCount: 24,
          readyKnowledgeUnitCount: 3,
          canSelect: true,
        },
        {
          kind: 'source',
          id: 'document-1',
          label: 'CM.pdf',
          readyQuestionCount: 16,
          readyKnowledgeUnitCount: 2,
          canSelect: true,
        },
        {
          kind: 'source',
          id: 'document-2',
          label: 'TD.pdf',
          readyQuestionCount: 8,
          readyKnowledgeUnitCount: 1,
          canSelect: false,
        },
      ],
      questionCountOptions: [10, 20],
      defaultQuestionCount: 20,
      supportedQuestionKinds: ['single_choice', 'multiple_choice'],
      defaultConfig: {
        scopeKind: 'course',
        scopeId: 'course-1',
        questionCount: 20,
        complexityProfile: 'exam',
      },
      nextStep: {
        kind: 'configuration_ready',
        userMessage:
          'Configuration prête. Tu peux démarrer un entraînement examen.',
      },
    });
    expect(JSON.stringify(options)).not.toMatch(/correct|correction|answer/i);
  });

  it('blocks exam preparation when the course has no ready source', async () => {
    const { coursesRepository, questionBank, useCase } = createHarness();
    coursesRepository.findDetailByIdForStudent.mockResolvedValue(
      courseDetail({
        sources: [courseDocument({ status: 'PROCESSING' })],
      }),
    );
    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
      [],
    );

    await expect(
      useCase.execute({ studentId: 'student-1', courseId: 'course-1' }),
    ).resolves.toMatchObject({
      readiness: {
        canPrepare: false,
        state: 'BLOCKED',
        blockers: ['NO_READY_SOURCE'],
        readySourceCount: 0,
        readyKnowledgeUnitCount: 0,
        availableQuestionCount: 0,
      },
      scopeOptions: [],
      questionCountOptions: [],
      defaultQuestionCount: null,
      defaultConfig: null,
    });
    expect(questionBank.countActiveCourseQuickQuestions).not.toHaveBeenCalled();
  });

  it('blocks exam preparation when ready sources have no usable knowledge units', async () => {
    const { coursesRepository, questionBank, useCase } = createHarness();
    coursesRepository.findDetailByIdForStudent.mockResolvedValue(
      courseDetail({
        sources: [courseDocument({ id: 'document-1' })],
      }),
    );
    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
      [],
    );

    await expect(
      useCase.execute({ studentId: 'student-1', courseId: 'course-1' }),
    ).resolves.toMatchObject({
      readiness: {
        canPrepare: false,
        state: 'BLOCKED',
        blockers: ['NO_KNOWLEDGE_UNITS'],
        readySourceCount: 1,
        readyKnowledgeUnitCount: 0,
        availableQuestionCount: 0,
      },
      scopeOptions: [],
      questionCountOptions: [],
      defaultQuestionCount: null,
      defaultConfig: null,
    });
    expect(questionBank.countActiveCourseQuickQuestions).not.toHaveBeenCalled();
  });

  it('reports partially ready when only a small bounded configuration is possible', async () => {
    const { coursesRepository, questionBank, useCase } = createHarness();
    coursesRepository.findDetailByIdForStudent.mockResolvedValue(
      courseDetail({
        sources: [courseDocument({ id: 'document-1' })],
      }),
    );
    coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
      [knowledgeUnit({ documentId: 'document-1' })],
    );
    questionBank.countActiveCourseQuickQuestions.mockResolvedValue(12);

    await expect(
      useCase.execute({ studentId: 'student-1', courseId: 'course-1' }),
    ).resolves.toMatchObject({
      readiness: {
        canPrepare: true,
        state: 'PARTIALLY_READY',
        availableQuestionCount: 12,
      },
      questionCountOptions: [10],
      defaultQuestionCount: 10,
      defaultConfig: {
        scopeKind: 'course',
        scopeId: 'course-1',
        questionCount: 10,
        complexityProfile: 'exam',
      },
    });
  });

  it('refuses courses outside the current student ownership scope', async () => {
    const { coursesRepository, useCase } = createHarness();
    coursesRepository.findDetailByIdForStudent.mockResolvedValue(null);

    await expect(
      useCase.execute({ studentId: 'student-1', courseId: 'missing-course' }),
    ).rejects.toThrow('Course not found');
  });
});

function createHarness() {
  const coursesRepository = {
    findDetailByIdForStudent: jest.fn(),
    findReadyQuickRevisionKnowledgeUnitsForCourse: jest.fn(),
  };
  const questionBank = {
    countActiveCourseQuickQuestions: jest.fn(),
  };

  return {
    coursesRepository,
    questionBank,
    useCase: new GetCourseExamPreparationOptionsUseCase(
      coursesRepository as unknown as CoursesRepository,
      questionBank as unknown as QuestionBankService,
    ),
  };
}

function courseDetail(
  overrides: Partial<CourseDetailDto> = {},
): CourseDetailDto {
  return {
    course: {
      id: 'course-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
      title: 'Droit constitutionnel',
      description: null,
      chapterLabel: null,
      estimatedMinutes: null,
      displayOrder: 0,
      createdAt: new Date('2026-06-18T10:00:00.000Z'),
      updatedAt: new Date('2026-06-18T10:00:00.000Z'),
      sourceCount: overrides.sources?.length ?? 0,
      readySourceCount:
        overrides.sources?.filter((source) => source.status === 'READY')
          .length ?? 0,
      processingSourceCount: 0,
      failedSourceCount: 0,
    },
    subject: {
      id: 'subject-1',
      name: 'Droit public',
    },
    sources: [],
    ...overrides,
  };
}

function courseDocument(
  overrides: Partial<CourseDocumentDto> = {},
): CourseDocumentDto {
  return {
    id: 'document-1',
    courseId: 'course-1',
    documentId: 'document-1',
    fileName: 'CM.pdf',
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
    id: 'ku-1',
    subjectId: 'subject-1',
    documentId: 'document-1',
    title: 'Séparation des pouvoirs',
    ...overrides,
  };
}
