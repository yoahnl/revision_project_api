import { GetCourseRichRevisionOptionsUseCase } from './get-course-rich-revision-options.use-case';
import type {
  CourseDetailDto,
  CourseDocumentDto,
  CourseQuickRevisionKnowledgeUnitDto,
  CoursesRepository,
} from './courses.repository';

describe('GetCourseRichRevisionOptionsUseCase', () => {
  it('returns knowledge-unit scoped QCM complet options without answers or corrections', async () => {
    const { repository, useCase } = createHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(
      courseDetail({
        sources: [
          courseDocument({ id: 'document-1', fileName: 'CM.pdf' }),
          courseDocument({
            id: 'document-2',
            documentId: 'document-2',
            fileName: 'TD.pdf',
          }),
          courseDocument({
            id: 'document-archived',
            documentId: 'document-archived',
            fileName: 'Archive.pdf',
            status: 'PROCESSING',
          }),
        ],
      }),
    );
    repository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue([
      knowledgeUnit({
        id: 'ku-1',
        documentId: 'document-1',
        title: 'Responsabilité politique',
      }),
      knowledgeUnit({
        id: 'ku-2',
        documentId: 'document-2',
        title: 'Dissolution',
      }),
    ]);

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
        canStart: true,
        state: 'READY',
        userMessage: 'Ton cours est prêt pour un QCM complet.',
        blockers: [],
        readySourceCount: 2,
        readyKnowledgeUnitCount: 2,
      },
      scopeOptions: [
        {
          kind: 'knowledge_unit',
          id: 'ku-1',
          documentId: 'document-1',
          label: 'Responsabilité politique',
          sourceLabel: 'CM.pdf',
          canSelect: true,
        },
        {
          kind: 'knowledge_unit',
          id: 'ku-2',
          documentId: 'document-2',
          label: 'Dissolution',
          sourceLabel: 'TD.pdf',
          canSelect: true,
        },
      ],
      questionCountOptions: [6, 10, 13],
      defaultQuestionCount: 6,
      supportedQuestionKinds: [
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
        'institution_matrix',
        'diagram_labeling',
        'calculation_mcq',
      ],
      complexityProfiles: ['standard', 'advanced'],
      defaultConfig: {
        scopeKind: 'knowledge_unit',
        scopeId: 'ku-1',
        questionCount: 6,
        complexityProfile: 'standard',
      },
      nextStep: {
        kind: 'configuration_ready',
        userMessage: 'Choisis une notion et démarre le QCM complet.',
      },
    });
    expect(JSON.stringify(options)).not.toMatch(/correct|correction|answer/i);
    expect(options.scopeOptions.map((option) => option.kind)).not.toContain(
      'course',
    );
  });

  it('blocks QCM complet when the course has no ready source', async () => {
    const { repository, useCase } = createHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(
      courseDetail({
        sources: [courseDocument({ status: 'PROCESSING' })],
      }),
    );

    await expect(
      useCase.execute({ studentId: 'student-1', courseId: 'course-1' }),
    ).resolves.toMatchObject({
      readiness: {
        canStart: false,
        state: 'BLOCKED',
        blockers: ['NO_READY_SOURCE'],
        readySourceCount: 0,
        readyKnowledgeUnitCount: 0,
      },
      scopeOptions: [],
      defaultConfig: null,
    });
    expect(
      repository.findReadyQuickRevisionKnowledgeUnitsForCourse,
    ).not.toHaveBeenCalled();
  });

  it('reports no exploitable notion when ready sources have no knowledge units', async () => {
    const { repository, useCase } = createHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(
      courseDetail({
        sources: [courseDocument({ id: 'document-1' })],
      }),
    );
    repository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue(
      [],
    );

    await expect(
      useCase.execute({ studentId: 'student-1', courseId: 'course-1' }),
    ).resolves.toMatchObject({
      readiness: {
        canStart: false,
        state: 'NOT_READY',
        blockers: ['NO_KNOWLEDGE_UNITS'],
        readySourceCount: 1,
        readyKnowledgeUnitCount: 0,
      },
      scopeOptions: [],
      questionCountOptions: [],
      defaultQuestionCount: null,
      defaultConfig: null,
    });
  });

  it('refuses courses outside the current student ownership scope', async () => {
    const { repository, useCase } = createHarness();
    repository.findDetailByIdForStudent.mockResolvedValue(null);

    await expect(
      useCase.execute({ studentId: 'student-1', courseId: 'missing-course' }),
    ).rejects.toThrow('Course not found');
  });
});

function createHarness() {
  const repository = {
    findDetailByIdForStudent: jest.fn(),
    findReadyQuickRevisionKnowledgeUnitsForCourse: jest.fn(),
  };

  return {
    repository,
    useCase: new GetCourseRichRevisionOptionsUseCase(
      repository as unknown as CoursesRepository,
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
  const id = overrides.id ?? 'document-1';

  return {
    id,
    courseId: 'course-1',
    documentId: overrides.documentId ?? id,
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
    title: 'Responsabilité politique',
    ...overrides,
  };
}
