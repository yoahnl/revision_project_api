import { Inject, Injectable } from '@nestjs/common';
import {
  QUICK_QUESTION_BANK_COUNT_INVALID,
  QUICK_QUESTION_BANK_INSUFFICIENT_QUESTIONS,
  QUICK_QUESTION_BANK_SOURCE_CONTEXT_NOT_READY,
  QuestionBankService,
  resolveQuickQuestionBankQuestionCount,
} from '../../activities/application/question-bank.service';
import type { CourseQuestionBankReadiness } from '../domain/course-question-bank-readiness.entity';
import type { RevisionSessionResponseDto } from '../../revision-sessions/domain/revision-session.entity';
import { StartRevisionSessionUseCase } from '../../revision-sessions/application/start-revision-session.use-case';
import {
  COURSES_REPOSITORY,
  type CoursesRepository,
} from './courses.repository';
import { PrepareCourseQuestionBankUseCase } from './course-question-bank-readiness.use-case';

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

export class CourseQuickRevisionQuestionCountInvalidError extends Error {
  readonly code = 'COURSE_QUICK_REVISION_QUESTION_COUNT_INVALID';

  constructor() {
    super(
      'Course quick revision questionCount must be an integer between 5 and 30',
    );
  }
}

export class CourseQuickRevisionQuestionsPreparingError extends Error {
  readonly code = 'COURSE_QUICK_REVISION_QUESTIONS_PREPARING';

  constructor(readonly readiness?: CourseQuestionBankReadiness) {
    super('Course quick revision questions are being prepared');
  }
}

@Injectable()
export class StartCourseQuickRevisionSessionUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
    private readonly startRevisionSession: StartRevisionSessionUseCase,
    private readonly questionBank: QuestionBankService,
    private readonly prepareQuestionBank: PrepareCourseQuestionBankUseCase,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
    questionCount?: number;
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

    let questionCount: number;
    try {
      questionCount = resolveQuickQuestionBankQuestionCount(
        input.questionCount,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === QUICK_QUESTION_BANK_COUNT_INVALID
      ) {
        throw new CourseQuickRevisionQuestionCountInvalidError();
      }

      throw error;
    }
    const readyQuestionCount =
      await this.questionBank.countActiveCourseQuickQuestions({
        studentId: input.studentId,
        subjectId: course.subjectId,
        courseId: course.courseId,
        knowledgeUnitId: knowledgeUnit.id,
      });

    if (readyQuestionCount < questionCount) {
      const readiness = await this.prepareQuestionBank.execute({
        studentId: input.studentId,
        courseId: course.courseId,
        questionCount,
      });

      throw new CourseQuickRevisionQuestionsPreparingError(readiness);
    }

    try {
      const diagnosticQuizActivity =
        await this.questionBank.createCourseQuickDiagnosticQuiz({
          studentId: input.studentId,
          subjectId: course.subjectId,
          courseId: course.courseId,
          documentId: readySource.documentId,
          knowledgeUnitId: knowledgeUnit.id,
          questionCount,
        });

      return await this.startRevisionSession.execute({
        studentId: input.studentId,
        subjectId: course.subjectId,
        courseId: course.courseId,
        documentId: readySource.documentId,
        knowledgeUnitId: knowledgeUnit.id,
        preferredAction: 'diagnostic_quiz',
        diagnosticQuizActivity,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === QUICK_QUESTION_BANK_COUNT_INVALID
      ) {
        throw new CourseQuickRevisionQuestionCountInvalidError();
      }

      if (
        error instanceof Error &&
        (error.message === QUICK_QUESTION_BANK_SOURCE_CONTEXT_NOT_READY ||
          error.message === QUICK_QUESTION_BANK_INSUFFICIENT_QUESTIONS)
      ) {
        const readiness = await this.prepareQuestionBank.execute({
          studentId: input.studentId,
          courseId: course.courseId,
          questionCount,
        });

        throw new CourseQuickRevisionQuestionsPreparingError(readiness);
      }

      // The Course API has already verified ownership, READY source and KU.
      // Any downstream failure here means the quick quiz could not be built.
      throw new CourseQuickRevisionGenerationFailedError(error);
    }
  }
}
