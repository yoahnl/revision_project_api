import { NotFoundException } from '@nestjs/common';
import type { DocumentsRepository } from '../../documents/application/documents.repository';
import type { SourceLifecycleDecision } from '../../documents/domain/source-lifecycle.entity';
import type { CoursesRepository } from './courses.repository';
import {
  ArchiveCourseSourceUseCase,
  GetCourseSourceLifecycleUseCase,
} from './course-source-lifecycle.use-case';

describe('Course source lifecycle use cases', () => {
  it('loads lifecycle only after checking course ownership', async () => {
    const { coursesRepository, documentsRepository, getUseCase } =
      createUseCases();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      courseOwnership(),
    );
    documentsRepository.getLifecycleDecisionForStudent.mockResolvedValue(
      lifecycleDecision(),
    );

    await expect(
      getUseCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-1',
      }),
    ).resolves.toEqual(lifecycleDecision());

    expect(coursesRepository.findCourseOwnershipContext).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
    });
    expect(
      documentsRepository.getLifecycleDecisionForStudent,
    ).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      documentId: 'document-1',
    });
  });

  it('archives only after checking course ownership', async () => {
    const { coursesRepository, documentsRepository, archiveUseCase } =
      createUseCases();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      courseOwnership(),
    );
    documentsRepository.archiveForStudent.mockResolvedValue(
      lifecycleDecision({
        status: 'ARCHIVED',
        recommendedAction: 'BLOCK',
        canArchive: false,
      }),
    );

    await expect(
      archiveUseCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-1',
      }),
    ).resolves.toMatchObject({
      documentId: 'document-1',
      status: 'ARCHIVED',
    });

    expect(documentsRepository.archiveForStudent).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      documentId: 'document-1',
      reason: 'USER_ARCHIVED_COURSE_SOURCE',
    });
  });

  it('rejects lifecycle reads for courses outside the student ownership', async () => {
    const { coursesRepository, documentsRepository, getUseCase } =
      createUseCases();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(null);

    await expect(
      getUseCase.execute({
        studentId: 'student-1',
        courseId: 'course-2',
        documentId: 'document-1',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(
      documentsRepository.getLifecycleDecisionForStudent,
    ).not.toHaveBeenCalled();
  });

  it('maps a missing course document lifecycle to 404', async () => {
    const { coursesRepository, documentsRepository, getUseCase } =
      createUseCases();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      courseOwnership(),
    );
    documentsRepository.getLifecycleDecisionForStudent.mockResolvedValue(null);

    await expect(
      getUseCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-other',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

function createUseCases() {
  const coursesRepository = {
    findCourseOwnershipContext: jest.fn(),
  };
  const documentsRepository = {
    getLifecycleDecisionForStudent: jest.fn(),
    archiveForStudent: jest.fn(),
  };

  return {
    coursesRepository,
    documentsRepository,
    getUseCase: new GetCourseSourceLifecycleUseCase(
      coursesRepository as unknown as CoursesRepository,
      documentsRepository as unknown as DocumentsRepository,
    ),
    archiveUseCase: new ArchiveCourseSourceUseCase(
      coursesRepository as unknown as CoursesRepository,
      documentsRepository as unknown as DocumentsRepository,
    ),
  };
}

function courseOwnership() {
  return {
    courseId: 'course-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
  };
}

function lifecycleDecision(
  overrides: Partial<SourceLifecycleDecision> = {},
): SourceLifecycleDecision {
  return {
    documentId: 'document-1',
    courseId: 'course-1',
    status: 'ACTIVE',
    recommendedAction: 'ARCHIVE',
    canDelete: false,
    canArchive: true,
    blockingReasons: ['HAS_KNOWLEDGE_UNITS'],
    userMessage: 'Cette source peut etre archivee.',
    ...overrides,
  };
}
