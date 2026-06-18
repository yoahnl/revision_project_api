import { Inject, Injectable } from '@nestjs/common';
import { GenerateRevisionSheetUseCase } from '../../study-artifacts/application/generate-revision-sheet.use-case';
import { GetRevisionSheetUseCase } from '../../study-artifacts/application/get-revision-sheet.use-case';
import type { RevisionSheetDto } from '../../study-artifacts/application/study-artifacts.repository';
import {
  COURSES_REPOSITORY,
  type CourseDocumentDto,
  type CoursesRepository,
} from './courses.repository';

export class CourseRevisionSheetSourceNotReadyError extends Error {
  readonly code = 'COURSE_REVISION_SHEET_SOURCE_NOT_READY';

  constructor() {
    super('Course has no ready source');
  }
}

type CourseRevisionSheetInput = {
  studentId: string;
  courseId: string;
};

@Injectable()
export class GetCourseRevisionSheetUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
    private readonly getRevisionSheet: GetRevisionSheetUseCase,
  ) {}

  async execute(
    input: CourseRevisionSheetInput,
  ): Promise<RevisionSheetDto | null> {
    const readySource = await this.findBackendSelectedReadySource(input);

    return this.getRevisionSheet.execute({
      studentId: input.studentId,
      documentId: readySource.documentId,
    });
  }

  private async findBackendSelectedReadySource(
    input: CourseRevisionSheetInput,
  ): Promise<CourseDocumentDto> {
    return findBackendSelectedReadySource(this.coursesRepository, input);
  }
}

@Injectable()
export class GenerateCourseRevisionSheetUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
    private readonly generateRevisionSheet: GenerateRevisionSheetUseCase,
  ) {}

  async execute(input: CourseRevisionSheetInput): Promise<RevisionSheetDto> {
    const readySource = await findBackendSelectedReadySource(
      this.coursesRepository,
      input,
    );

    return this.generateRevisionSheet.execute({
      studentId: input.studentId,
      documentId: readySource.documentId,
    });
  }
}

async function findBackendSelectedReadySource(
  coursesRepository: CoursesRepository,
  input: CourseRevisionSheetInput,
) {
  const course = await coursesRepository.findCourseOwnershipContext(input);

  if (!course) {
    throw new Error('Course not found');
  }

  // CORE-04 deliberately keeps course-level sheets single-source: the backend
  // chooses the first READY PDF, so the client never gets to submit documentId.
  const readySource =
    await coursesRepository.findFirstReadyCoursePdfDocumentForCourse(input);

  if (!readySource) {
    throw new CourseRevisionSheetSourceNotReadyError();
  }

  return readySource;
}
