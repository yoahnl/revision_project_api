import { GetCourseDetailUseCase } from './get-course-detail.use-case';
import { ListSubjectCoursesWithStatsUseCase } from './list-subject-courses-with-stats.use-case';
import type { CoursesRepository } from './courses.repository';

describe('Course read use cases', () => {
  it('lists subject courses with source stats', async () => {
    const repository = createRepository();
    repository.listBySubjectForStudentWithStats.mockResolvedValue([
      courseWithStats({ id: 'course-1', sourceCount: 2, readySourceCount: 1 }),
    ]);

    const result = await new ListSubjectCoursesWithStatsUseCase(
      repository,
    ).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });

    expect(repository.listBySubjectForStudentWithStats.mock.calls[0]).toEqual([
      { studentId: 'student-1', subjectId: 'subject-1' },
    ]);
    expect(result[0]?.sourceCount).toBe(2);
    expect(result[0]?.readySourceCount).toBe(1);
  });

  it('returns course detail with subject and sources', async () => {
    const repository = createRepository();
    repository.findDetailByIdForStudent.mockResolvedValue({
      course: courseWithStats(),
      subject: { id: 'subject-1', name: 'Droit constitutionnel' },
      sources: [
        {
          id: 'document-1',
          courseId: 'course-1',
          documentId: 'document-1',
          fileName: 'cours.pdf',
          kind: 'COURSE_PDF',
          status: 'READY',
          errorCode: null,
          createdAt: new Date('2026-06-18T10:00:00.000Z'),
          updatedAt: new Date('2026-06-18T10:00:00.000Z'),
        },
      ],
    });

    const result = await new GetCourseDetailUseCase(repository).execute({
      studentId: 'student-1',
      courseId: 'course-1',
    });

    expect(repository.findDetailByIdForStudent.mock.calls[0]).toEqual([
      { studentId: 'student-1', courseId: 'course-1' },
    ]);
    expect(result.subject.name).toBe('Droit constitutionnel');
    expect(result.sources[0]?.status).toBe('READY');
  });

  it('throws not found when a course is not owned by the student', async () => {
    const repository = createRepository();
    repository.findDetailByIdForStudent.mockResolvedValue(null);

    await expect(
      new GetCourseDetailUseCase(repository).execute({
        studentId: 'student-2',
        courseId: 'course-1',
      }),
    ).rejects.toThrow('Course not found');
  });
});

function createRepository(): jest.Mocked<CoursesRepository> {
  return {
    create: jest.fn(),
    findByIdForStudent: jest.fn(),
    listBySubjectForStudent: jest.fn(),
    deleteIfEmpty: jest.fn(),
    findCourseOwnershipContext: jest.fn(),
    findFirstReadyCoursePdfDocumentForCourse: jest.fn(),
    attachDocumentToCourse: jest.fn(),
    backfillFromExistingDocumentsDryRun: jest.fn(),
    backfillFromExistingDocuments: jest.fn(),
    listBySubjectForStudentWithStats: jest.fn(),
    findDetailByIdForStudent: jest.fn(),
    findCourseProgressByIdForStudent: jest.fn(),
    findSubjectProgressForStudent: jest.fn(),
    findCourseLearningPathByIdForStudent: jest.fn(),
    getLifecycleDecisionForStudent: jest.fn(),
    updateForStudent: jest.fn(),
    archiveForStudent: jest.fn(),
    findFirstQuickRevisionKnowledgeUnitForCourseDocument: jest.fn(),
    findReadyQuickRevisionKnowledgeUnitsForCourse: jest.fn(),
  };
}

function courseWithStats(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    title: 'Droit constitutionnel',
    description: 'Institutions et normes',
    chapterLabel: 'Chapitre 1',
    estimatedMinutes: 30,
    displayOrder: 0,
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
    sourceCount: 0,
    readySourceCount: 0,
    processingSourceCount: 0,
    failedSourceCount: 0,
    ...overrides,
  };
}
