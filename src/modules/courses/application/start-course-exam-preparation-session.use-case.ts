import { Inject, Injectable } from '@nestjs/common';
import { QuestionBankService } from '../../activities/application/question-bank.service';
import type { RevisionSessionResponseDto } from '../../revision-sessions/domain/revision-session.entity';
import { StartRevisionSessionUseCase } from '../../revision-sessions/application/start-revision-session.use-case';
import {
  COURSES_REPOSITORY,
  type CourseDetailDto,
  type CourseDocumentDto,
  type CourseQuickRevisionKnowledgeUnitDto,
  type CoursesRepository,
} from './courses.repository';

export type CourseExamPreparationSessionScopeKind = 'course' | 'source';

export interface StartCourseExamPreparationSessionInput {
  studentId: string;
  courseId: string;
  scopeKind: CourseExamPreparationSessionScopeKind;
  scopeId: string;
  questionCount: number;
  complexityProfile: 'exam';
}

export class CourseExamPreparationScopeNotReadyError extends Error {
  readonly code = 'COURSE_EXAM_PREPARATION_SCOPE_NOT_READY';

  constructor() {
    super('Course exam preparation scope is not ready');
  }
}

export class CourseExamPreparationQuestionCountInvalidError extends Error {
  readonly code = 'COURSE_EXAM_PREPARATION_QUESTION_COUNT_INVALID';

  constructor() {
    super('Course exam preparation questionCount must be 10, 20 or 30');
  }
}

export class CourseExamPreparationInsufficientQuestionsError extends Error {
  readonly code = 'COURSE_EXAM_PREPARATION_INSUFFICIENT_QUESTIONS';

  constructor() {
    super('Course exam preparation has insufficient questions');
  }
}

const EXAM_QUESTION_COUNT_OPTIONS = [10, 20, 30] as const;

@Injectable()
export class StartCourseExamPreparationSessionUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
    private readonly questionBank: QuestionBankService,
    private readonly startRevisionSession: StartRevisionSessionUseCase,
  ) {}

  async execute(
    input: StartCourseExamPreparationSessionInput,
  ): Promise<RevisionSessionResponseDto> {
    if (input.complexityProfile !== 'exam') {
      throw new CourseExamPreparationScopeNotReadyError();
    }

    if (!EXAM_QUESTION_COUNT_OPTIONS.includes(input.questionCount as never)) {
      throw new CourseExamPreparationQuestionCountInvalidError();
    }

    const detail = await this.coursesRepository.findDetailByIdForStudent({
      studentId: input.studentId,
      courseId: input.courseId,
    });

    if (!detail) {
      throw new Error('Course not found');
    }

    const readySources = detail.sources.filter(isReadyCoursePdfSource);
    const knowledgeUnits =
      await this.coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse(
        {
          studentId: input.studentId,
          courseId: detail.course.id,
          subjectId: detail.course.subjectId,
        },
      );
    const scopedKnowledgeUnits = resolveScopedKnowledgeUnits({
      detail,
      readySources,
      knowledgeUnits,
      scopeKind: input.scopeKind,
      scopeId: input.scopeId,
    });

    if (scopedKnowledgeUnits.length === 0) {
      throw new CourseExamPreparationScopeNotReadyError();
    }

    const readyQuestionCount =
      await this.questionBank.countActiveCourseQuickQuestions({
        studentId: input.studentId,
        subjectId: detail.course.subjectId,
        courseId: detail.course.id,
        knowledgeUnitIds: scopedKnowledgeUnits.map((unit) => unit.id),
      });

    if (readyQuestionCount < input.questionCount) {
      throw new CourseExamPreparationInsufficientQuestionsError();
    }

    const primaryKnowledgeUnit = scopedKnowledgeUnits[0];
    if (!primaryKnowledgeUnit) {
      throw new CourseExamPreparationScopeNotReadyError();
    }
    const diagnosticQuizActivity =
      await this.questionBank.createCourseQuickDiagnosticQuiz({
        studentId: input.studentId,
        subjectId: detail.course.subjectId,
        courseId: detail.course.id,
        documentId: primaryKnowledgeUnit.documentId,
        knowledgeUnitId: primaryKnowledgeUnit.id,
        knowledgeUnits: scopedKnowledgeUnits.map((unit) => ({
          id: unit.id,
          documentId: unit.documentId,
        })),
        questionCount: input.questionCount,
      });

    return this.startRevisionSession.execute({
      studentId: input.studentId,
      subjectId: detail.course.subjectId,
      courseId: detail.course.id,
      documentId: primaryKnowledgeUnit.documentId,
      knowledgeUnitId: primaryKnowledgeUnit.id,
      preferredAction: 'diagnostic_quiz',
      diagnosticQuizActivity,
      mode: 'EXAM',
    });
  }
}

function resolveScopedKnowledgeUnits(input: {
  detail: CourseDetailDto;
  readySources: CourseDocumentDto[];
  knowledgeUnits: CourseQuickRevisionKnowledgeUnitDto[];
  scopeKind: CourseExamPreparationSessionScopeKind;
  scopeId: string;
}): CourseQuickRevisionKnowledgeUnitDto[] {
  if (input.scopeKind === 'course') {
    return input.scopeId === input.detail.course.id ? input.knowledgeUnits : [];
  }

  const readySource = input.readySources.find(
    (source) => source.documentId === input.scopeId,
  );

  if (!readySource) {
    return [];
  }

  return input.knowledgeUnits.filter(
    (unit) => unit.documentId === readySource.documentId,
  );
}

function isReadyCoursePdfSource(source: CourseDocumentDto): boolean {
  return source.kind === 'COURSE_PDF' && source.status === 'READY';
}
