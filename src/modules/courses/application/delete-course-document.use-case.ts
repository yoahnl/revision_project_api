import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  COURSES_REPOSITORY,
  type CoursesRepository,
} from './courses.repository';
import {
  DOCUMENTS_REPOSITORY,
  type DocumentsRepository,
} from '../../documents/application/documents.repository';

@Injectable()
export class DeleteCourseDocumentUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
    documentId: string;
  }): Promise<void> {
    const course = await this.coursesRepository.findCourseOwnershipContext({
      studentId: input.studentId,
      courseId: input.courseId,
    });

    if (!course) {
      throw new NotFoundException('Course source not found');
    }

    // The delete is constrained by courseId too: a student cannot delete a
    // document from another course by reusing a valid documentId.
    const deleted =
      await this.documentsRepository.deleteCourseDocumentForStudent(input);

    if (!deleted) {
      throw new NotFoundException('Course source not found');
    }
  }
}
