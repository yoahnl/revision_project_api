import { GenerateRevisionSheetUseCase } from '../../study-artifacts/application/generate-revision-sheet.use-case';
import { GetRevisionSheetUseCase } from '../../study-artifacts/application/get-revision-sheet.use-case';
import type { RevisionSheetDto } from '../../study-artifacts/application/study-artifacts.repository';
import {
  CourseRevisionSheetSourceNotReadyError,
  GenerateCourseRevisionSheetUseCase,
  GetCourseRevisionSheetUseCase,
} from './course-revision-sheet.use-case';
import type {
  CourseDocumentDto,
  CoursesRepository,
} from './courses.repository';

describe('Course revision sheet use cases', () => {
  it('refuses an unknown or cross-student course before selecting a document', async () => {
    const { repository, getRevisionSheet } = createUseCases();
    repository.findCourseOwnershipContext.mockResolvedValue(null);

    await expect(
      new GetCourseRevisionSheetUseCase(repository, getRevisionSheet).execute({
        studentId: 'student-2',
        courseId: 'course-1',
      }),
    ).rejects.toThrow('Course not found');

    expect(
      repository.findFirstReadyCoursePdfDocumentForCourse.mock.calls,
    ).toHaveLength(0);
    expect(getRevisionSheet.execute.mock.calls).toHaveLength(0);
  });

  it('refuses a course without a READY course PDF source', async () => {
    const { repository, getRevisionSheet } = createUseCases();
    repository.findCourseOwnershipContext.mockResolvedValue({
      courseId: 'course-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
    });
    repository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(null);

    await expect(
      new GetCourseRevisionSheetUseCase(repository, getRevisionSheet).execute({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).rejects.toThrow(CourseRevisionSheetSourceNotReadyError);

    expect(getRevisionSheet.execute.mock.calls).toHaveLength(0);
  });

  it('gets the document-level sheet for the backend-selected READY source', async () => {
    const { repository, getRevisionSheet } = createUseCases();
    repository.findCourseOwnershipContext.mockResolvedValue({
      courseId: 'course-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
    });
    repository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      courseDocument({ documentId: 'document-ready-1' }),
    );
    getRevisionSheet.execute.mockResolvedValue(revisionSheet());

    const result = await new GetCourseRevisionSheetUseCase(
      repository,
      getRevisionSheet,
    ).execute({ studentId: 'student-1', courseId: 'course-1' });

    expect(
      repository.findFirstReadyCoursePdfDocumentForCourse.mock.calls,
    ).toEqual([[{ studentId: 'student-1', courseId: 'course-1' }]]);
    expect(getRevisionSheet.execute.mock.calls).toEqual([
      [{ studentId: 'student-1', documentId: 'document-ready-1' }],
    ]);
    expect(result?.id).toBe('sheet-1');
  });

  it('generates the document-level sheet for the backend-selected READY source', async () => {
    const { repository, generateRevisionSheet } = createUseCases();
    repository.findCourseOwnershipContext.mockResolvedValue({
      courseId: 'course-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
    });
    repository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      courseDocument({ documentId: 'document-ready-1' }),
    );
    generateRevisionSheet.execute.mockResolvedValue(revisionSheet());

    const result = await new GenerateCourseRevisionSheetUseCase(
      repository,
      generateRevisionSheet,
    ).execute({ studentId: 'student-1', courseId: 'course-1' });

    expect(generateRevisionSheet.execute.mock.calls).toEqual([
      [{ studentId: 'student-1', documentId: 'document-ready-1' }],
    ]);
    expect(result.id).toBe('sheet-1');
  });
});

function createUseCases() {
  const repository = {
    create: jest.fn(),
    findByIdForStudent: jest.fn(),
    listBySubjectForStudent: jest.fn(),
    listBySubjectForStudentWithStats: jest.fn(),
    findDetailByIdForStudent: jest.fn(),
    deleteIfEmpty: jest.fn(),
    findCourseOwnershipContext: jest.fn(),
    findFirstReadyCoursePdfDocumentForCourse: jest.fn(),
    attachDocumentToCourse: jest.fn(),
    backfillFromExistingDocumentsDryRun: jest.fn(),
    backfillFromExistingDocuments: jest.fn(),
  } as unknown as jest.Mocked<CoursesRepository>;
  const getRevisionSheet = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<GetRevisionSheetUseCase>;
  const generateRevisionSheet = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<GenerateRevisionSheetUseCase>;

  return { repository, getRevisionSheet, generateRevisionSheet };
}

function courseDocument(
  overrides: Partial<CourseDocumentDto> = {},
): CourseDocumentDto {
  return {
    id: 'document-ready-1',
    courseId: 'course-1',
    documentId: 'document-ready-1',
    fileName: 'cours.pdf',
    kind: 'COURSE_PDF',
    status: 'READY',
    errorCode: null,
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
    ...overrides,
  };
}

function revisionSheet(
  overrides: Partial<RevisionSheetDto> = {},
): RevisionSheetDto {
  return {
    id: 'sheet-1',
    documentId: 'document-ready-1',
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
    sections: [],
    ...overrides,
  };
}
