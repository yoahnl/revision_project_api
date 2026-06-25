import { Inject, Injectable } from '@nestjs/common';
import type { RichClosedPublicExerciseEnvelope } from '../../activities/application/rich-closed-questions/rich-closed-question.types';
import { StartRichClosedExerciseUseCase } from '../../activities/application/rich-closed-questions/start-rich-closed-exercise.use-case';
import {
  COURSE_RICH_REVISION_COMPLEXITY_PROFILES,
  COURSE_RICH_REVISION_QUESTION_COUNT_OPTIONS,
  type CourseRichRevisionComplexityProfile,
  type CourseRichRevisionScopeKind,
} from './get-course-rich-revision-options.use-case';
import {
  COURSES_REPOSITORY,
  type CoursesRepository,
} from './courses.repository';

export interface StartCourseRichRevisionSessionInput {
  studentId: string;
  courseId: string;
  scopeKind: CourseRichRevisionScopeKind;
  scopeId: string;
  questionCount: number;
  complexityProfile: CourseRichRevisionComplexityProfile;
}

export class CourseRichRevisionScopeNotReadyError extends Error {
  readonly code = 'COURSE_RICH_REVISION_SCOPE_NOT_READY';

  constructor() {
    super('Course rich revision scope is not ready');
  }
}

export class CourseRichRevisionQuestionCountInvalidError extends Error {
  readonly code = 'COURSE_RICH_REVISION_QUESTION_COUNT_INVALID';

  constructor() {
    super('Course rich revision questionCount must be 6, 10 or 13');
  }
}

@Injectable()
export class StartCourseRichRevisionSessionUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
    private readonly startRichClosedExercise: StartRichClosedExerciseUseCase,
  ) {}

  async execute(
    input: StartCourseRichRevisionSessionInput,
  ): Promise<RichClosedPublicExerciseEnvelope> {
    if (input.scopeKind !== 'knowledge_unit') {
      throw new CourseRichRevisionScopeNotReadyError();
    }

    if (
      !COURSE_RICH_REVISION_QUESTION_COUNT_OPTIONS.includes(
        input.questionCount as never,
      )
    ) {
      throw new CourseRichRevisionQuestionCountInvalidError();
    }

    if (
      !COURSE_RICH_REVISION_COMPLEXITY_PROFILES.includes(
        input.complexityProfile,
      )
    ) {
      throw new CourseRichRevisionScopeNotReadyError();
    }

    const detail = await this.coursesRepository.findDetailByIdForStudent({
      studentId: input.studentId,
      courseId: input.courseId,
    });

    if (!detail) {
      throw new Error('Course not found');
    }

    const knowledgeUnits =
      await this.coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse(
        {
          studentId: input.studentId,
          courseId: detail.course.id,
          subjectId: detail.course.subjectId,
        },
      );
    const selectedKnowledgeUnit = knowledgeUnits.find(
      (unit) => unit.id === input.scopeId,
    );

    if (!selectedKnowledgeUnit) {
      throw new CourseRichRevisionScopeNotReadyError();
    }

    return this.startRichClosedExercise.execute({
      studentId: input.studentId,
      subjectId: detail.course.subjectId,
      documentId: selectedKnowledgeUnit.documentId,
      knowledgeUnitId: selectedKnowledgeUnit.id,
      questionCount: input.questionCount,
      complexityProfile: input.complexityProfile,
    });
  }
}
