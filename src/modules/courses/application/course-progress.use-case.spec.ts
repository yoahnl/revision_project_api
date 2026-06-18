import {
  GetCourseProgressUseCase,
  GetSubjectProgressUseCase,
} from './course-progress.use-case';
import type { CoursesRepository } from './courses.repository';

describe('Course progress use cases', () => {
  it('loads course progress for an owned course', async () => {
    const repository = createRepository();
    repository.findCourseProgressByIdForStudent.mockResolvedValue(
      courseProgress({ state: 'PRACTICED' }),
    );

    const result = await new GetCourseProgressUseCase(repository).execute({
      studentId: 'student-1',
      courseId: 'course-1',
    });

    expect(repository.findCourseProgressByIdForStudent.mock.calls[0]).toEqual([
      { studentId: 'student-1', courseId: 'course-1' },
    ]);
    expect(result.estimatedGlobalMastery).toBe(0.18);
    expect(result.state).toBe('PRACTICED');
  });

  it('throws not found when course progress is requested cross-student', async () => {
    const repository = createRepository();
    repository.findCourseProgressByIdForStudent.mockResolvedValue(null);

    await expect(
      new GetCourseProgressUseCase(repository).execute({
        studentId: 'student-2',
        courseId: 'course-1',
      }),
    ).rejects.toThrow('Course not found');
  });

  it('loads subject progress for an owned subject', async () => {
    const repository = createRepository();
    repository.findSubjectProgressForStudent.mockResolvedValue(
      subjectProgress(),
    );

    const result = await new GetSubjectProgressUseCase(repository).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });

    expect(repository.findSubjectProgressForStudent.mock.calls[0]).toEqual([
      { studentId: 'student-1', subjectId: 'subject-1' },
    ]);
    expect(result.courses).toHaveLength(1);
    expect(result.readyCourseCount).toBe(1);
  });

  it('throws not found when subject progress is requested cross-student', async () => {
    const repository = createRepository();
    repository.findSubjectProgressForStudent.mockResolvedValue(null);

    await expect(
      new GetSubjectProgressUseCase(repository).execute({
        studentId: 'student-2',
        subjectId: 'subject-1',
      }),
    ).rejects.toThrow('Course subject not found');
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
    findFirstQuickRevisionKnowledgeUnitForCourseDocument: jest.fn(),
    attachDocumentToCourse: jest.fn(),
    backfillFromExistingDocumentsDryRun: jest.fn(),
    backfillFromExistingDocuments: jest.fn(),
    listBySubjectForStudentWithStats: jest.fn(),
    findDetailByIdForStudent: jest.fn(),
    findCourseProgressByIdForStudent: jest.fn(),
    findSubjectProgressForStudent: jest.fn(),
  };
}

function courseProgress(overrides: Record<string, unknown> = {}) {
  return {
    courseId: 'course-1',
    subjectId: 'subject-1',
    knowledgeUnitCount: 12,
    practicedKnowledgeUnitCount: 3,
    coverage: 0.25,
    mastery: 0.72,
    estimatedGlobalMastery: 0.18,
    readySourceCount: 1,
    processingSourceCount: 0,
    failedSourceCount: 0,
    lastPracticedAt: new Date('2026-06-18T12:00:00.000Z'),
    state: 'PRACTICED',
    ...overrides,
  } as const;
}

function subjectProgress() {
  return {
    subjectId: 'subject-1',
    knowledgeUnitCount: 12,
    practicedKnowledgeUnitCount: 3,
    coverage: 0.25,
    mastery: 0.72,
    estimatedGlobalMastery: 0.18,
    courseCount: 1,
    readyCourseCount: 1,
    lastPracticedAt: new Date('2026-06-18T12:00:00.000Z'),
    courses: [
      {
        courseId: 'course-1',
        title: 'Institutions',
        knowledgeUnitCount: 12,
        practicedKnowledgeUnitCount: 3,
        coverage: 0.25,
        mastery: 0.72,
        estimatedGlobalMastery: 0.18,
        state: 'PRACTICED',
      },
    ],
  } as const;
}
