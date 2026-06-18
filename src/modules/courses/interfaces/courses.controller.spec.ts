import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CourseContainsDocumentsError } from '../domain/course.entity';
import {
  CourseRevisionSheetSourceNotReadyError,
  GenerateCourseRevisionSheetUseCase,
  GetCourseRevisionSheetUseCase,
} from '../application/course-revision-sheet.use-case';
import { CreateCourseUseCase } from '../application/create-course.use-case';
import { DeleteCourseUseCase } from '../application/delete-course.use-case';
import { GetCourseDetailUseCase } from '../application/get-course-detail.use-case';
import { ListSubjectCoursesWithStatsUseCase } from '../application/list-subject-courses-with-stats.use-case';
import { UploadCoursePdfForCourseUseCase } from '../application/upload-course-pdf-for-course.use-case';
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

  it('uploads a course PDF with course-derived context only', async () => {
    const { controller, uploadCoursePdfForCourse } = createController();
    uploadCoursePdfForCourse.execute.mockResolvedValue(courseDocument());

    await expect(
      controller.uploadCoursePdfForCourse(
        currentStudent,
        ' course-1 ',
        uploadedPdf(),
      ),
    ).resolves.toEqual(publicCourseDocument());

    expect(uploadCoursePdfForCourse.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      firebaseUid: 'firebase-1',
      courseId: 'course-1',
      originalFileName: 'cours.pdf',
      content: Buffer.from('%PDF-1.7'),
      mimeType: 'application/pdf',
    });
  });

  it('rejects missing and invalid course PDF uploads before the use case', () => {
    const { controller, uploadCoursePdfForCourse } = createController();

    expect(() =>
      controller.uploadCoursePdfForCourse(
        currentStudent,
        'course-1',
        undefined,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      controller.uploadCoursePdfForCourse(currentStudent, 'course-1', {
        ...uploadedPdf(),
        originalname: 'notes.txt',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      controller.uploadCoursePdfForCourse(currentStudent, 'course-1', {
        ...uploadedPdf(),
        mimetype: 'text/plain',
      }),
    ).toThrow(BadRequestException);
    expect(uploadCoursePdfForCourse.execute).not.toHaveBeenCalled();
  });

  it('rejects client-provided course upload ownership fields', () => {
    const { controller, uploadCoursePdfForCourse } = createController();

    expect(() =>
      controller.uploadCoursePdfForCourse(
        currentStudent,
        'course-1',
        uploadedPdf(),
        { subjectId: 'subject-1' },
      ),
    ).toThrow(BadRequestException);

    expect(uploadCoursePdfForCourse.execute).not.toHaveBeenCalled();
  });

  it('maps unknown course uploads to 404', async () => {
    const { controller, uploadCoursePdfForCourse } = createController();
    uploadCoursePdfForCourse.execute.mockRejectedValue(
      new Error('Course not found'),
    );

    await expect(
      controller.uploadCoursePdfForCourse(
        currentStudent,
        'other-student-course',
        uploadedPdf(),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('gets a course-level revision sheet without exposing internal metadata', async () => {
    const { controller, getCourseRevisionSheet } = createController();
    getCourseRevisionSheet.execute.mockResolvedValue(revisionSheet());

    await expect(
      controller.getCourseRevisionSheet(currentStudent, ' course-1 '),
    ).resolves.toEqual(publicRevisionSheet());

    expect(getCourseRevisionSheet.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
    });
    expect(
      JSON.stringify(
        await controller.getCourseRevisionSheet(currentStudent, 'course-1'),
      ),
    ).not.toContain('promptVersion');
  });

  it('generates a course-level revision sheet via the backend-selected source', async () => {
    const { controller, generateCourseRevisionSheet } = createController();
    generateCourseRevisionSheet.execute.mockResolvedValue(revisionSheet());

    await expect(
      controller.generateCourseRevisionSheet(currentStudent, 'course-1'),
    ).resolves.toEqual(publicRevisionSheet());

    expect(generateCourseRevisionSheet.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
    });
  });

  it('maps course-level revision sheet errors to 404 and 409', async () => {
    const { controller, getCourseRevisionSheet, generateCourseRevisionSheet } =
      createController();
    getCourseRevisionSheet.execute.mockResolvedValueOnce(null);

    await expect(
      controller.getCourseRevisionSheet(currentStudent, 'course-1'),
    ).rejects.toThrow(NotFoundException);

    generateCourseRevisionSheet.execute.mockRejectedValueOnce(
      new CourseRevisionSheetSourceNotReadyError(),
    );

    await expect(
      controller.generateCourseRevisionSheet(currentStudent, 'course-1'),
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
  const uploadCoursePdfForCourse = { execute: jest.fn() };
  const getCourseRevisionSheet = { execute: jest.fn() };
  const generateCourseRevisionSheet = { execute: jest.fn() };

  return {
    controller: new CoursesController(
      createCourse as unknown as CreateCourseUseCase,
      listCourses as unknown as ListSubjectCoursesWithStatsUseCase,
      getCourseDetail as unknown as GetCourseDetailUseCase,
      deleteCourse as unknown as DeleteCourseUseCase,
      uploadCoursePdfForCourse as unknown as UploadCoursePdfForCourseUseCase,
      getCourseRevisionSheet as unknown as GetCourseRevisionSheetUseCase,
      generateCourseRevisionSheet as unknown as GenerateCourseRevisionSheetUseCase,
    ),
    createCourse,
    listCourses,
    getCourseDetail,
    deleteCourse,
    uploadCoursePdfForCourse,
    getCourseRevisionSheet,
    generateCourseRevisionSheet,
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

function uploadedPdf() {
  return {
    originalname: 'cours.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7'),
    size: 8,
  };
}

function courseDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document-1',
    courseId: 'course-1',
    documentId: 'document-1',
    fileName: 'cours.pdf',
    kind: 'COURSE_PDF',
    status: 'UPLOADED',
    errorCode: null,
    createdAt: new Date('2026-06-18T12:00:00.000Z'),
    updatedAt: new Date('2026-06-18T12:00:00.000Z'),
    ...overrides,
  };
}

function publicCourseDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document-1',
    courseId: 'course-1',
    documentId: 'document-1',
    fileName: 'cours.pdf',
    kind: 'COURSE_PDF',
    status: 'UPLOADED',
    errorCode: null,
    createdAt: '2026-06-18T12:00:00.000Z',
    updatedAt: '2026-06-18T12:00:00.000Z',
    ...overrides,
  };
}

function revisionSheet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sheet-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY',
    title: 'Fiche de cours',
    introduction: 'Introduction',
    keyPoints: ['Point clé'],
    commonMistakes: ['Erreur fréquente'],
    mustKnow: ['À savoir'],
    practiceSuggestions: ['S’entraîner'],
    errorCode: null,
    metadata: {
      flowName: 'documentRevisionSheetGeneration',
      provider: 'mock',
      model: 'mock-model',
      promptVersion: 'generate-revision-sheet-v1',
      schemaVersion: 'revision-sheet-v1',
      generatedAt: new Date('2026-06-18T10:00:00.000Z'),
      sourceStrategy: 'DOCUMENT_CHUNKS_AND_KNOWLEDGE_UNITS',
    },
    sections: [
      {
        id: 'section-1',
        displayOrder: 0,
        title: 'Institutions',
        content: 'Le Parlement contrôle le Gouvernement.',
        sources: [
          {
            chunkId: 'chunk-1',
            text: 'Extrait source',
            pageNumber: 1,
            index: 0,
            relevanceScore: 0.9,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function publicRevisionSheet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sheet-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY',
    title: 'Fiche de cours',
    introduction: 'Introduction',
    keyPoints: ['Point clé'],
    commonMistakes: ['Erreur fréquente'],
    mustKnow: ['À savoir'],
    practiceSuggestions: ['S’entraîner'],
    errorCode: null,
    sections: [
      {
        id: 'section-1',
        displayOrder: 0,
        title: 'Institutions',
        content: 'Le Parlement contrôle le Gouvernement.',
        sources: [
          {
            chunkId: 'chunk-1',
            text: 'Extrait source',
            pageNumber: 1,
            index: 0,
          },
        ],
      },
    ],
    ...overrides,
  };
}
