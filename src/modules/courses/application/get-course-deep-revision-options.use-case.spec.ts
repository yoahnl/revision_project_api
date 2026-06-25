import { GetCourseDeepRevisionOptionsUseCase } from './get-course-deep-revision-options.use-case';
import type {
  CourseDetailDto,
  CourseDocumentDto,
  CourseQuickRevisionKnowledgeUnitDto,
  CoursesRepository,
} from './courses.repository';

describe('GetCourseDeepRevisionOptionsUseCase', () => {
  it('returns knowledge-unit scoped deep revision options without answer or correction data', async () => {
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
            id: 'document-processing',
            documentId: 'document-processing',
            fileName: 'Processing.pdf',
            status: 'PROCESSING',
          }),
        ],
      }),
    );
    repository.findReadyQuickRevisionKnowledgeUnitsForCourse.mockResolvedValue([
      knowledgeUnit({
        id: 'ku-1',
        documentId: 'document-1',
        title: 'La souveraineté',
      }),
      knowledgeUnit({
        id: 'ku-2',
        documentId: 'document-2',
        title: 'Le contrôle de constitutionnalité',
      }),
      knowledgeUnit({
        id: 'ku-processing',
        documentId: 'document-processing',
        title: 'Notion en traitement',
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
        userMessage: 'Ton cours est prêt pour une révision approfondie.',
        blockers: [],
        readySourceCount: 2,
        readyKnowledgeUnitCount: 2,
      },
      scopeOptions: [
        {
          kind: 'knowledge_unit',
          id: 'ku-1',
          documentId: 'document-1',
          label: 'La souveraineté',
          sourceLabel: 'CM.pdf',
          canSelect: true,
        },
        {
          kind: 'knowledge_unit',
          id: 'ku-2',
          documentId: 'document-2',
          label: 'Le contrôle de constitutionnalité',
          sourceLabel: 'TD.pdf',
          canSelect: true,
        },
      ],
      answerGuidelines: {
        minLength: 12,
        maxLength: 4000,
        userMessage: 'Rédige une réponse structurée avec tes propres mots.',
      },
      defaultConfig: {
        scopeKind: 'knowledge_unit',
        scopeId: 'ku-1',
      },
      nextStep: {
        kind: 'configuration_ready',
        userMessage: 'Choisis une notion et démarre la question ouverte.',
      },
    });
    expect(JSON.stringify(options)).not.toMatch(
      /answerText|modelAnswer|evaluation|correction|score/i,
    );
    expect(options.scopeOptions.map((option) => option.kind)).not.toContain(
      'course',
    );
  });

  it('blocks deep revision when the course has no ready source', async () => {
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
        userMessage: 'Ajoute une source pour rédiger une réponse.',
        readySourceCount: 0,
        readyKnowledgeUnitCount: 0,
      },
      scopeOptions: [],
      defaultConfig: null,
      nextStep: {
        kind: 'blocked',
        userMessage: 'Ajoute une source pour rédiger une réponse.',
      },
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
        userMessage: 'Aucune notion exploitable.',
        readySourceCount: 1,
        readyKnowledgeUnitCount: 0,
      },
      scopeOptions: [],
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
    useCase: new GetCourseDeepRevisionOptionsUseCase(
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
      createdAt: new Date('2026-06-25T10:00:00.000Z'),
      updatedAt: new Date('2026-06-25T10:00:00.000Z'),
      sourceCount: overrides.sources?.length ?? 0,
      readySourceCount:
        overrides.sources?.filter((source) => source.status === 'READY')
          .length ?? 0,
      processingSourceCount:
        overrides.sources?.filter((source) => source.status === 'PROCESSING')
          .length ?? 0,
      failedSourceCount:
        overrides.sources?.filter((source) => source.status === 'FAILED')
          .length ?? 0,
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
    createdAt: new Date('2026-06-25T10:00:00.000Z'),
    updatedAt: new Date('2026-06-25T10:00:00.000Z'),
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
