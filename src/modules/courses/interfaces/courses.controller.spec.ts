import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CourseContainsDocumentsError } from '../domain/course.entity';
import { CreateCourseUseCase } from '../application/create-course.use-case';
import { DeleteCourseUseCase } from '../application/delete-course.use-case';
import { GetCourseDetailUseCase } from '../application/get-course-detail.use-case';
import { ListSubjectCoursesWithStatsUseCase } from '../application/list-subject-courses-with-stats.use-case';
import { CoursesController } from './courses.controller';

describe('CoursesController', () => {
  it('lists courses for the current student and subject', async () => {
    const { controller, listCourses } = createController();
    listCourses.execute.mockResolvedValue([courseWithStats()]);

    await expect(
      controller.listForSubject(currentStudent, 'subject-1'),
    ).resolves.toEqual([publicCourse()]);

    expect(listCourses.execute.mock.calls[0]).toEqual([
      { studentId: 'student-1', subjectId: 'subject-1' },
    ]);
  });

  it('creates a course with validated trimmed input', async () => {
    const { controller, createCourse } = createController();
    createCourse.execute.mockResolvedValue(courseWithStats());

    await expect(
      controller.createForSubject(currentStudent, ' subject-1 ', {
        title: ' Droit constitutionnel ',
        description: ' Institutions ',
        chapterLabel: ' Chapitre 1 ',
        estimatedMinutes: 30,
      }),
    ).resolves.toEqual(publicCourse());

    expect(createCourse.execute.mock.calls[0]).toEqual([
      {
        studentId: 'student-1',
        subjectId: 'subject-1',
        title: 'Droit constitutionnel',
        description: 'Institutions',
        chapterLabel: 'Chapitre 1',
        estimatedMinutes: 30,
      },
    ]);
  });

  it('rejects invalid course creation body as 400', () => {
    const { controller, createCourse } = createController();

    expect(() =>
      controller.createForSubject(currentStudent, 'subject-1', {
        title: 'x',
      }),
    ).toThrow(BadRequestException);
    expect(createCourse.execute.mock.calls).toHaveLength(0);
  });

  it('returns detail with subject and sources', async () => {
    const { controller, getCourseDetail } = createController();
    getCourseDetail.execute.mockResolvedValue({
      course: courseWithStats({ sourceCount: 1, readySourceCount: 1 }),
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

    await expect(
      controller.getCourse(currentStudent, 'course-1'),
    ).resolves.toEqual({
      course: publicCourse({ sourceCount: 1, readySourceCount: 1 }),
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
          createdAt: '2026-06-18T10:00:00.000Z',
          updatedAt: '2026-06-18T10:00:00.000Z',
        },
      ],
    });
  });

  it('maps course not found to 404', async () => {
    const { controller, getCourseDetail } = createController();
    getCourseDetail.execute.mockRejectedValue(new Error('Course not found'));

    await expect(
      controller.getCourse(currentStudent, 'other-student-course'),
    ).rejects.toThrow(NotFoundException);
  });

  it('deletes empty courses and maps document conflicts to 409', async () => {
    const { controller, deleteCourse } = createController();
    deleteCourse.execute.mockResolvedValueOnce({ deleted: true });

    await expect(
      controller.deleteCourse(currentStudent, 'course-1'),
    ).resolves.toEqual(undefined);

    deleteCourse.execute.mockRejectedValueOnce(
      new CourseContainsDocumentsError(),
    );

    await expect(
      controller.deleteCourse(currentStudent, 'course-1'),
    ).rejects.toThrow(ConflictException);
  });
});

const currentStudent = {
  id: 'student-1',
  firebaseUid: 'firebase-1',
  email: 'student@example.test',
  displayName: 'Student',
};

function createController() {
  const createCourse = { execute: jest.fn() };
  const listCourses = { execute: jest.fn() };
  const getCourseDetail = { execute: jest.fn() };
  const deleteCourse = { execute: jest.fn() };

  return {
    controller: new CoursesController(
      createCourse as unknown as CreateCourseUseCase,
      listCourses as unknown as ListSubjectCoursesWithStatsUseCase,
      getCourseDetail as unknown as GetCourseDetailUseCase,
      deleteCourse as unknown as DeleteCourseUseCase,
    ),
    createCourse,
    listCourses,
    getCourseDetail,
    deleteCourse,
  };
}

function courseWithStats(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    title: 'Droit constitutionnel',
    description: 'Institutions',
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

function publicCourse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    subjectId: 'subject-1',
    title: 'Droit constitutionnel',
    description: 'Institutions',
    chapterLabel: 'Chapitre 1',
    estimatedMinutes: 30,
    displayOrder: 0,
    createdAt: '2026-06-18T10:00:00.000Z',
    updatedAt: '2026-06-18T10:00:00.000Z',
    sourceCount: 0,
    readySourceCount: 0,
    processingSourceCount: 0,
    failedSourceCount: 0,
    ...overrides,
  };
}
