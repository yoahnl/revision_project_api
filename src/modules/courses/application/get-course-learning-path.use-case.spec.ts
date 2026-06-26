import { GetCourseLearningPathUseCase } from './get-course-learning-path.use-case';
import type { CoursesRepository } from './courses.repository';

describe('GetCourseLearningPathUseCase', () => {
  it('throws not found when the course is missing or not owned by the student', async () => {
    const repository = createRepository();
    repository.findCourseLearningPathByIdForStudent.mockResolvedValue(null);

    await expect(
      new GetCourseLearningPathUseCase(repository).execute({
        studentId: 'student-2',
        courseId: 'course-1',
      }),
    ).rejects.toThrow('Course not found');
  });

  it('returns an add-source empty state when the course has no source', async () => {
    const repository = createRepository();
    repository.findCourseLearningPathByIdForStudent.mockResolvedValue(
      learningPathData({ documents: [], knowledgeUnits: [] }),
    );

    const result = await new GetCourseLearningPathUseCase(repository).execute({
      studentId: 'student-1',
      courseId: 'course-1',
    });

    expect(result.nodes).toEqual([]);
    expect(result.summary).toMatchObject({
      knowledgeUnitCount: 0,
      readySourceCount: 0,
      estimatedGlobalMastery: 0,
      mastery: null,
      coverage: 0,
    });
    expect(result.activeNodeId).toBeNull();
    expect(result.primaryAction).toMatchObject({
      kind: 'ADD_SOURCE',
      label: 'Ajouter une source',
      enabled: true,
      targetKnowledgeUnitId: null,
      targetNodeId: null,
    });
    expect(result.emptyState).toMatchObject({
      actionKind: 'ADD_SOURCE',
      actionLabel: 'Ajouter une source',
    });
  });

  it.each([
    {
      label: 'source in analysis',
      documents: [documentDto({ id: 'doc-uploaded', status: 'UPLOADED' })],
      primaryKind: 'WAIT_FOR_ANALYSIS',
      emptyActionKind: 'WAIT_FOR_ANALYSIS',
      enabled: false,
    },
    {
      label: 'failed sources only',
      documents: [documentDto({ id: 'doc-failed', status: 'FAILED' })],
      primaryKind: 'UNAVAILABLE',
      emptyActionKind: 'RETRY_SOURCE',
      enabled: true,
    },
    {
      label: 'ready source without knowledge units',
      documents: [documentDto({ id: 'doc-ready', status: 'READY' })],
      primaryKind: 'UNAVAILABLE',
      emptyActionKind: 'NONE',
      enabled: false,
    },
  ])(
    'returns an honest empty state for $label',
    async ({ documents, primaryKind, emptyActionKind, enabled }) => {
      const repository = createRepository();
      repository.findCourseLearningPathByIdForStudent.mockResolvedValue(
        learningPathData({ documents, knowledgeUnits: [] }),
      );

      const result = await new GetCourseLearningPathUseCase(repository).execute(
        {
          studentId: 'student-1',
          courseId: 'course-1',
        },
      );

      expect(result.nodes).toEqual([]);
      expect(result.primaryAction).toMatchObject({
        kind: primaryKind,
        enabled,
        targetKnowledgeUnitId: null,
        targetNodeId: null,
      });
      expect(result.emptyState).toMatchObject({
        actionKind: emptyActionKind,
      });
    },
  );

  it('builds real ordered nodes, summary, active node and product-safe copy', async () => {
    const repository = createRepository();
    repository.findCourseLearningPathByIdForStudent.mockResolvedValue(
      learningPathData({
        documents: [
          documentDto({
            id: 'doc-b',
            fileName: 'Chapitre 2.pdf',
            status: 'READY',
            createdAt: new Date('2026-06-12T10:00:00.000Z'),
          }),
          documentDto({
            id: 'doc-a',
            fileName: 'Chapitre 1.pdf',
            status: 'READY',
            createdAt: new Date('2026-06-10T10:00:00.000Z'),
          }),
        ],
        knowledgeUnits: [
          knowledgeUnitDto({
            id: 'unit-solid',
            documentId: 'doc-a',
            title: 'La Constitution',
            displayOrder: 0,
            createdAt: new Date('2026-06-10T10:00:00.000Z'),
            mastery: [{ score: 0.92, lastPracticedAt: null }],
          }),
          knowledgeUnitDto({
            id: 'unit-undiscovered',
            documentId: 'doc-b',
            title: 'Le Conseil constitutionnel',
            displayOrder: null,
            createdAt: new Date('2026-06-12T12:00:00.000Z'),
            mastery: [],
          }),
          knowledgeUnitDto({
            id: 'unit-in-progress',
            documentId: 'doc-a',
            title: 'La séparation des pouvoirs',
            displayOrder: 1,
            createdAt: new Date('2026-06-10T11:00:00.000Z'),
            mastery: [
              {
                score: 0.65,
                lastPracticedAt: new Date('2026-06-15T09:00:00.000Z'),
              },
            ],
          }),
          knowledgeUnitDto({
            id: 'unit-weak',
            documentId: 'doc-b',
            title: 'Le contrôle de constitutionnalité',
            displayOrder: 0,
            createdAt: new Date('2026-06-12T11:00:00.000Z'),
            mastery: [
              {
                score: 0.24,
                lastPracticedAt: new Date('2026-06-14T09:00:00.000Z'),
              },
            ],
          }),
        ],
      }),
    );

    const result = await new GetCourseLearningPathUseCase(repository).execute({
      studentId: 'student-1',
      courseId: 'course-1',
    });

    expect(result.nodes.map((node) => node.knowledgeUnitId)).toEqual([
      'unit-solid',
      'unit-in-progress',
      'unit-weak',
      'unit-undiscovered',
    ]);
    expect(result.nodes.map((node) => node.state)).toEqual([
      'SOLID',
      'IN_PROGRESS',
      'TO_STRENGTHEN',
      'UNDISCOVERED',
    ]);
    expect(result.nodes[0]).toMatchObject({
      title: 'La Constitution',
      order: 0,
      masteryScore: 0.92,
      lastPracticedAt: null,
      source: { documentId: 'doc-a', fileName: 'Chapitre 1.pdf' },
      display: {
        title: 'La Constitution',
        statusLabel: 'Solide',
        metaLabel: 'Chapitre 1.pdf',
        actionLabel: 'Revoir',
        unavailableReason: null,
      },
    });
    expect(result.nodes[2]).toMatchObject({
      id: 'unit-weak',
      state: 'TO_STRENGTHEN',
      masteryScore: 0.24,
      lastPracticedAt: new Date('2026-06-14T09:00:00.000Z'),
      display: {
        statusLabel: 'À renforcer',
        actionLabel: 'Renforcer',
      },
    });
    expect(result.summary).toEqual({
      knowledgeUnitCount: 4,
      solidCount: 1,
      inProgressCount: 1,
      toStrengthenCount: 1,
      undiscoveredCount: 1,
      estimatedGlobalMastery: 0.452,
      mastery: 0.603,
      coverage: 0.75,
      readySourceCount: 2,
    });
    expect(result.activeNodeId).toBe('unit-weak');
    expect(result.primaryAction).toMatchObject({
      kind: 'REVIEW_ACTIVE_NODE',
      label: 'Continuer',
      estimatedMinutes: 20,
      targetKnowledgeUnitId: 'unit-weak',
      targetNodeId: 'unit-weak',
      enabled: true,
      unavailableReason: null,
    });
    expect(result.emptyState).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(
      /diagnostic_quiz|open_question|rich_closed_exercise|QuestionBank|backend|legacy|payload|reasonCode|Prisma|Genkit|GenUI/,
    );
  });
});

function createRepository(): jest.Mocked<CoursesRepository> {
  return {
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
    findCourseLearningPathByIdForStudent: jest.fn(),
    attachDocumentToCourse: jest.fn(),
    backfillFromExistingDocumentsDryRun: jest.fn(),
    backfillFromExistingDocuments: jest.fn(),
  };
}

function learningPathData(overrides: Record<string, unknown> = {}) {
  return {
    course: {
      id: 'course-1',
      subjectId: 'subject-1',
      subjectName: 'Droit constitutionnel',
      title: 'Droit constitutionnel',
      estimatedMinutes: 20,
    },
    documents: [documentDto()],
    knowledgeUnits: [],
    ...overrides,
  };
}

function documentDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-ready',
    courseId: 'course-1',
    fileName: 'Cours.pdf',
    kind: 'COURSE_PDF',
    status: 'READY',
    createdAt: new Date('2026-06-10T10:00:00.000Z'),
    ...overrides,
  };
}

function knowledgeUnitDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 'unit-1',
    subjectId: 'subject-1',
    documentId: 'doc-ready',
    title: 'La Constitution',
    displayOrder: 0,
    createdAt: new Date('2026-06-10T10:00:00.000Z'),
    mastery: [],
    ...overrides,
  };
}
