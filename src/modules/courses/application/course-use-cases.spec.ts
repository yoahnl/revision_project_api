import { BackfillCoursesFromDocumentsDryRunUseCase } from './backfill-courses-from-documents.use-case';
import { CreateCourseUseCase } from './create-course.use-case';
import { DeleteCourseUseCase } from './delete-course.use-case';
import { GetCourseUseCase } from './get-course.use-case';
import { ListSubjectCoursesUseCase } from './list-subject-courses.use-case';
import type { CourseDto, CoursesRepository } from './courses.repository';

describe('Course use cases', () => {
  it('creates a course with trimmed input for an owned subject', async () => {
    const repository = createRepository();
    const created = courseRecord({ title: 'Loi normale', displayOrder: 2 });
    repository.create.mockResolvedValue(created);

    const result = await new CreateCourseUseCase(repository).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
      title: ' Loi normale ',
      description: ' Chapitre de probabilites ',
      chapterLabel: ' Chapitre 3 ',
      estimatedMinutes: 20,
    });

    expect(repository.create.mock.calls[0]).toEqual([
      {
        studentId: 'student-1',
        subjectId: 'subject-1',
        title: 'Loi normale',
        description: 'Chapitre de probabilites',
        chapterLabel: 'Chapitre 3',
        estimatedMinutes: 20,
      },
    ]);
    expect(result).toBe(created);
  });

  it('rejects invalid course creation input before reaching the repository', async () => {
    const repository = createRepository();

    await expect(
      new CreateCourseUseCase(repository).execute({
        studentId: 'student-1',
        subjectId: 'subject-1',
        title: 'x',
        estimatedMinutes: 0,
      }),
    ).rejects.toThrow('Course title must contain at least 2 characters');

    expect(repository.create.mock.calls).toHaveLength(0);
  });

  it('lists only courses for a student subject', async () => {
    const repository = createRepository();
    const courses = [
      courseRecord({ id: 'course-1', displayOrder: 0 }),
      courseRecord({ id: 'course-2', displayOrder: 1 }),
    ];
    repository.listBySubjectForStudent.mockResolvedValue(courses);

    const result = await new ListSubjectCoursesUseCase(repository).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });

    expect(repository.listBySubjectForStudent.mock.calls[0]).toEqual([
      {
        studentId: 'student-1',
        subjectId: 'subject-1',
      },
    ]);
    expect(result).toEqual(courses);
  });

  it('returns a course only for its owner', async () => {
    const repository = createRepository();
    repository.findByIdForStudent.mockResolvedValue(courseRecord());

    const result = await new GetCourseUseCase(repository).execute({
      studentId: 'student-1',
      courseId: 'course-1',
    });

    expect(result.id).toBe('course-1');
    expect(repository.findByIdForStudent.mock.calls[0]).toEqual([
      {
        studentId: 'student-1',
        courseId: 'course-1',
      },
    ]);
  });

  it('throws not found when a course belongs to another student', async () => {
    const repository = createRepository();
    repository.findByIdForStudent.mockResolvedValue(null);

    await expect(
      new GetCourseUseCase(repository).execute({
        studentId: 'student-2',
        courseId: 'course-1',
      }),
    ).rejects.toThrow('Course not found');
  });

  it('deletes an empty course', async () => {
    const repository = createRepository();
    repository.deleteIfEmpty.mockResolvedValue(true);

    await expect(
      new DeleteCourseUseCase(repository).execute({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).resolves.toEqual({ deleted: true });

    expect(repository.deleteIfEmpty.mock.calls[0]).toEqual([
      {
        studentId: 'student-1',
        courseId: 'course-1',
      },
    ]);
  });

  it('refuses to delete a course containing documents', async () => {
    const repository = createRepository();
    repository.deleteIfEmpty.mockRejectedValue(
      new Error('Course contains documents'),
    );

    await expect(
      new DeleteCourseUseCase(repository).execute({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).rejects.toThrow('Course contains documents');
  });

  it('runs a backfill dry-run without applying writes', async () => {
    const repository = createRepository();
    repository.backfillFromExistingDocumentsDryRun.mockResolvedValue({
      documentsWithoutCourseCount: 2,
      coursesToCreateCount: 2,
      documentsToAttachCount: 2,
      items: [
        {
          documentId: 'document-1',
          studentId: 'student-1',
          subjectId: 'subject-1',
          proposedTitle: 'Cours stats S1',
        },
      ],
    });

    const result = await new BackfillCoursesFromDocumentsDryRunUseCase(
      repository,
    ).execute();

    expect(result.documentsWithoutCourseCount).toBe(2);
    expect(
      repository.backfillFromExistingDocumentsDryRun.mock.calls,
    ).toHaveLength(1);
    expect(repository.backfillFromExistingDocuments.mock.calls).toHaveLength(0);
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

function courseRecord(input: Partial<CourseDto> = {}): CourseDto {
  return {
    id: 'course-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    title: 'Loi normale',
    description: null,
    chapterLabel: null,
    estimatedMinutes: 20,
    displayOrder: 0,
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
    ...input,
  };
}
