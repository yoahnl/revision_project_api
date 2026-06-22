import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  COURSES_REPOSITORY,
  type CoursesRepository,
} from './courses.repository';
import {
  DOCUMENTS_REPOSITORY,
  type DocumentsRepository,
} from '../../documents/application/documents.repository';
import type { SourceLifecycleDecision } from '../../documents/domain/source-lifecycle.entity';

@Injectable()
export class GetCourseSourceLifecycleUseCase {
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
  }): Promise<SourceLifecycleDecision> {
    await this.ensureCourseOwned(input);

    const decision =
      await this.documentsRepository.getLifecycleDecisionForStudent(input);

    if (!decision) {
      throw new NotFoundException('Course source not found');
    }

    return decision;
  }

  private async ensureCourseOwned(input: {
    studentId: string;
    courseId: string;
  }): Promise<void> {
    const course = await this.coursesRepository.findCourseOwnershipContext({
      studentId: input.studentId,
      courseId: input.courseId,
    });

    if (!course) {
      throw new NotFoundException('Course source not found');
    }
  }
}

@Injectable()
export class ArchiveCourseSourceUseCase {
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
  }): Promise<SourceLifecycleDecision> {
    const course = await this.coursesRepository.findCourseOwnershipContext({
      studentId: input.studentId,
      courseId: input.courseId,
    });

    if (!course) {
      throw new NotFoundException('Course source not found');
    }

    const decision = await this.documentsRepository.archiveForStudent({
      ...input,
      reason: 'USER_ARCHIVED_COURSE_SOURCE',
    });

    if (!decision) {
      throw new NotFoundException('Course source not found');
    }

    return decision;
  }
}
