import { Inject, Injectable } from '@nestjs/common';
import type { RevisionSessionResponseDto } from '../../revision-sessions/domain/revision-session.entity';
import { StartRevisionSessionUseCase } from '../../revision-sessions/application/start-revision-session.use-case';
import {
  COURSES_REPOSITORY,
  type CoursesRepository,
} from './courses.repository';

const COURSE_QUICK_REVISION_QUESTION_COUNT = 6;

export class CourseQuickRevisionSourceNotReadyError extends Error {
  readonly code = 'COURSE_QUICK_REVISION_SOURCE_NOT_READY';

  constructor() {
    super('Course has no ready source');
  }
}

export class CourseQuickRevisionKnowledgeUnitNotReadyError extends Error {
  readonly code = 'COURSE_QUICK_REVISION_KNOWLEDGE_UNIT_NOT_READY';

  constructor() {
    super('Course has no ready knowledge unit');
  }
}

export class CourseQuickRevisionGenerationFailedError extends Error {
  readonly code = 'COURSE_QUICK_REVISION_GENERATION_FAILED';

  constructor(readonly cause?: unknown) {
    super('Course quick revision generation failed');
  }
}

@Injectable()
export class StartCourseQuickRevisionSessionUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
    private readonly startRevisionSession: StartRevisionSessionUseCase,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
  }): Promise<RevisionSessionResponseDto> {
    const course =
      await this.coursesRepository.findCourseOwnershipContext(input);

    if (!course) {
      throw new Error('Course not found');
    }

    // CORE-05 keeps quick revision single-source. The client submits only
    // courseId; the backend chooses the first READY course PDF deterministically.
    const readySource =
      await this.coursesRepository.findFirstReadyCoursePdfDocumentForCourse(
        input,
      );

    if (!readySource) {
      throw new CourseQuickRevisionSourceNotReadyError();
    }

    const knowledgeUnit =
      await this.coursesRepository.findFirstQuickRevisionKnowledgeUnitForCourseDocument(
        {
          studentId: input.studentId,
          courseId: course.courseId,
          subjectId: course.subjectId,
          documentId: readySource.documentId,
        },
      );

    if (!knowledgeUnit) {
      throw new CourseQuickRevisionKnowledgeUnitNotReadyError();
    }

    try {
      return await this.startRevisionSession.execute({
        studentId: input.studentId,
        subjectId: course.subjectId,
        courseId: course.courseId,
        documentId: readySource.documentId,
        knowledgeUnitId: knowledgeUnit.id,
        preferredAction: 'diagnostic_quiz',
        questionCount: COURSE_QUICK_REVISION_QUESTION_COUNT,
      });
    } catch (error) {
      // The Course API has already verified ownership, READY source and KU.
      // Any downstream failure here means the quick quiz could not be built.
      throw new CourseQuickRevisionGenerationFailedError(error);
    }
  }
}
