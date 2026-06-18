import { NotFoundException } from '@nestjs/common';
import { DeleteCourseDocumentUseCase } from './delete-course-document.use-case';
import type { CoursesRepository } from './courses.repository';
import type { DocumentsRepository } from '../../documents/application/documents.repository';

describe('DeleteCourseDocumentUseCase', () => {
  it('deletes a document only after checking course ownership', async () => {
    const { coursesRepository, documentsRepository, useCase } = createUseCase();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue({
      courseId: 'course-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
    });
    documentsRepository.deleteCourseDocumentForStudent.mockResolvedValue(true);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-1',
      }),
    ).resolves.toBeUndefined();

    expect(coursesRepository.findCourseOwnershipContext).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
    });
    expect(
      documentsRepository.deleteCourseDocumentForStudent,
    ).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      documentId: 'document-1',
    });
  });

  it('throws 404 without deleting when the course is not owned', async () => {
    const { coursesRepository, documentsRepository, useCase } = createUseCase();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(null);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-2',
        documentId: 'document-1',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(
      documentsRepository.deleteCourseDocumentForStudent,
    ).not.toHaveBeenCalled();
  });

  it('throws 404 when the document is not attached to the course', async () => {
    const { coursesRepository, documentsRepository, useCase } = createUseCase();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue({
      courseId: 'course-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
    });
    documentsRepository.deleteCourseDocumentForStudent.mockResolvedValue(false);

    await expect(
      useCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-other',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

function createUseCase() {
  const coursesRepository = {
    findCourseOwnershipContext: jest.fn(),
  };
  const documentsRepository = {
    deleteCourseDocumentForStudent: jest.fn(),
  };

  return {
    coursesRepository,
    documentsRepository,
    useCase: new DeleteCourseDocumentUseCase(
      coursesRepository as unknown as CoursesRepository,
      documentsRepository as unknown as DocumentsRepository,
    ),
  };
}
