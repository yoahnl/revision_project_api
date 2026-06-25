import { Inject, Injectable } from '@nestjs/common';
import {
  ACTIVITIES_REPOSITORY,
  type ActivitiesRepository,
  type OpenAnswerSubmissionResult,
  type OpenQuestionActivity,
} from '../../activities/application/activities.repository';
import { SubmitOpenAnswerUseCase } from '../../activities/application/submit-open-answer.use-case';
import { OPEN_ANSWER_MIN_LENGTH } from '../../activities/application/submit-open-answer.use-case';
import { StartRevisionSessionUseCase } from '../../revision-sessions/application/start-revision-session.use-case';
import {
  REVISION_SESSIONS_REPOSITORY,
  type RevisionSessionsRepository,
} from '../../revision-sessions/application/revision-sessions.repository';
import type {
  RevisionSessionResponseDto,
  RevisionSessionStatusValue,
} from '../../revision-sessions/domain/revision-session.entity';
import {
  COURSE_DEEP_REVISION_ANSWER_GUIDELINES,
  type CourseDeepRevisionScopeKind,
} from './get-course-deep-revision-options.use-case';
import {
  COURSES_REPOSITORY,
  type CourseDetailDto,
  type CourseDocumentDto,
  type CourseQuickRevisionKnowledgeUnitDto,
  type CoursesRepository,
} from './courses.repository';

export interface StartCourseDeepRevisionSessionInput {
  studentId: string;
  courseId: string;
  scopeKind: CourseDeepRevisionScopeKind;
  scopeId: string;
}

export interface CourseDeepRevisionSessionResponse {
  session: {
    id: string;
    mode: 'DEEP';
    status: RevisionSessionStatusValue;
    courseId: string;
  };
  question: OpenQuestionActivity['question'];
  scope: {
    kind: 'knowledge_unit';
    id: string;
    label: string;
    sourceLabel: string;
  };
  answerGuidelines: {
    minLength: number;
    maxLength: number;
  };
}

export interface CourseDeepRevisionSubmitResponse {
  session: {
    id: string;
    mode: 'DEEP';
    status: 'SUBMITTED';
    courseId: string;
  };
  evaluation: OpenAnswerSubmissionResult['evaluation'];
}

export class CourseDeepRevisionScopeNotReadyError extends Error {
  readonly code = 'COURSE_DEEP_REVISION_SCOPE_NOT_READY';

  constructor() {
    super('Course deep revision scope is not ready');
  }
}

export class CourseDeepRevisionSessionNotReadyError extends Error {
  readonly code = 'COURSE_DEEP_REVISION_SESSION_NOT_READY';

  constructor() {
    super('Course deep revision session is not ready');
  }
}

export class CourseDeepRevisionAnswerInvalidError extends Error {
  readonly code = 'COURSE_DEEP_REVISION_ANSWER_INVALID';

  constructor(message = 'Course deep revision answer is invalid') {
    super(message);
  }
}

@Injectable()
export class StartCourseDeepRevisionSessionUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
    private readonly startRevisionSession: StartRevisionSessionUseCase,
  ) {}

  async execute(
    input: StartCourseDeepRevisionSessionInput,
  ): Promise<CourseDeepRevisionSessionResponse> {
    if (input.scopeKind !== 'knowledge_unit') {
      throw new CourseDeepRevisionScopeNotReadyError();
    }

    const detail = await this.coursesRepository.findDetailByIdForStudent({
      studentId: input.studentId,
      courseId: input.courseId,
    });

    if (!detail) {
      throw new Error('Course not found');
    }

    const readyScope = await this.findReadyScope({
      studentId: input.studentId,
      detail,
      scopeId: input.scopeId,
    });

    const session = await this.startRevisionSession.execute({
      studentId: input.studentId,
      subjectId: detail.course.subjectId,
      courseId: detail.course.id,
      documentId: readyScope.unit.documentId,
      knowledgeUnitId: readyScope.unit.id,
      preferredAction: 'open_question',
      mode: 'DEEP',
    });
    const questionPayload = resolveStartedOpenQuestionPayload(session);

    assertGroundedOpenQuestion(questionPayload, readyScope);

    return {
      session: {
        id: session.session.id,
        mode: 'DEEP',
        status: session.session.status,
        courseId: detail.course.id,
      },
      question: questionPayload.question,
      scope: {
        kind: 'knowledge_unit',
        id: readyScope.unit.id,
        label: readyScope.unit.title?.trim() || 'Notion du cours',
        sourceLabel: readyScope.source.fileName,
      },
      answerGuidelines: {
        minLength: COURSE_DEEP_REVISION_ANSWER_GUIDELINES.minLength,
        maxLength: COURSE_DEEP_REVISION_ANSWER_GUIDELINES.maxLength,
      },
    };
  }

  private async findReadyScope(input: {
    studentId: string;
    detail: CourseDetailDto;
    scopeId: string;
  }): Promise<ReadyDeepScope> {
    const readySources = input.detail.sources.filter(isReadyCoursePdfSource);
    const sourceByDocumentId = new Map(
      readySources.map((source) => [source.documentId, source]),
    );
    const knowledgeUnits =
      await this.coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse(
        {
          studentId: input.studentId,
          courseId: input.detail.course.id,
          subjectId: input.detail.course.subjectId,
        },
      );
    const unit = knowledgeUnits.find(
      (candidate) => candidate.id === input.scopeId,
    );
    const source = unit ? sourceByDocumentId.get(unit.documentId) : null;

    if (!unit || !source) {
      throw new CourseDeepRevisionScopeNotReadyError();
    }

    return { unit, source };
  }
}

@Injectable()
export class SubmitCourseDeepRevisionAnswerUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
    @Inject(REVISION_SESSIONS_REPOSITORY)
    private readonly revisionSessionsRepository: RevisionSessionsRepository,
    @Inject(ACTIVITIES_REPOSITORY)
    private readonly activitiesRepository: ActivitiesRepository,
    private readonly submitOpenAnswer: SubmitOpenAnswerUseCase,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
    sessionId: string;
    answer: string;
  }): Promise<CourseDeepRevisionSubmitResponse> {
    const answerText = input.answer.trim();

    if (answerText.length < OPEN_ANSWER_MIN_LENGTH) {
      throw new CourseDeepRevisionAnswerInvalidError(
        'Course deep revision answer is too short',
      );
    }

    if (answerText.length > COURSE_DEEP_REVISION_ANSWER_GUIDELINES.maxLength) {
      throw new CourseDeepRevisionAnswerInvalidError(
        'Course deep revision answer is too long',
      );
    }

    const detail = await this.coursesRepository.findDetailByIdForStudent({
      studentId: input.studentId,
      courseId: input.courseId,
    });

    if (!detail) {
      throw new Error('Course not found');
    }

    const session = await this.revisionSessionsRepository.findByIdForStudent({
      studentId: input.studentId,
      sessionId: input.sessionId,
    });
    const activitySessionId = resolveDeepActivitySessionId(session, detail);
    const evaluationContext =
      await this.activitiesRepository.findOpenAnswerEvaluationContext({
        studentId: input.studentId,
        sessionId: activitySessionId,
      });
    const readyScope = await findReadyScope({
      coursesRepository: this.coursesRepository,
      studentId: input.studentId,
      detail,
      scopeId: evaluationContext.knowledgeUnit.id,
    });

    if (
      evaluationContext.subjectId !== detail.course.subjectId ||
      evaluationContext.documentId !== readyScope.unit.documentId ||
      evaluationContext.chunks.length === 0
    ) {
      throw new CourseDeepRevisionSessionNotReadyError();
    }

    const result = await this.submitOpenAnswer.execute({
      studentId: input.studentId,
      sessionId: activitySessionId,
      answerText,
    });

    return {
      session: {
        id: session.session.id,
        mode: 'DEEP',
        status: 'SUBMITTED',
        courseId: detail.course.id,
      },
      evaluation: result.evaluation,
    };
  }
}

interface ReadyDeepScope {
  unit: CourseQuickRevisionKnowledgeUnitDto;
  source: CourseDocumentDto;
}

async function findReadyScope(input: {
  coursesRepository: CoursesRepository;
  studentId: string;
  detail: CourseDetailDto;
  scopeId: string;
}): Promise<ReadyDeepScope> {
  const readySources = input.detail.sources.filter(isReadyCoursePdfSource);
  const sourceByDocumentId = new Map(
    readySources.map((source) => [source.documentId, source]),
  );
  const knowledgeUnits =
    await input.coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse(
      {
        studentId: input.studentId,
        courseId: input.detail.course.id,
        subjectId: input.detail.course.subjectId,
      },
    );
  const unit = knowledgeUnits.find(
    (candidate) => candidate.id === input.scopeId,
  );
  const source = unit ? sourceByDocumentId.get(unit.documentId) : null;

  if (!unit || !source) {
    throw new CourseDeepRevisionScopeNotReadyError();
  }

  return { unit, source };
}

function resolveStartedOpenQuestionPayload(
  session: RevisionSessionResponseDto,
): OpenQuestionActivity {
  const payload = session.currentAction?.payload;

  if (
    session.session.mode !== 'DEEP' ||
    session.currentAction?.kind !== 'OPEN_QUESTION' ||
    !isOpenQuestionPayload(payload)
  ) {
    throw new CourseDeepRevisionSessionNotReadyError();
  }

  return payload;
}

function assertGroundedOpenQuestion(
  payload: OpenQuestionActivity,
  scope: ReadyDeepScope,
): void {
  if (
    payload.documentId !== scope.unit.documentId ||
    payload.knowledgeUnitId !== scope.unit.id ||
    payload.question.sources.length === 0
  ) {
    throw new CourseDeepRevisionScopeNotReadyError();
  }
}

function resolveDeepActivitySessionId(
  session: RevisionSessionResponseDto,
  detail: CourseDetailDto,
): string {
  if (
    session.session.mode !== 'DEEP' ||
    session.session.courseId !== detail.course.id ||
    session.session.status !== 'STARTED' ||
    session.currentAction?.kind !== 'OPEN_QUESTION' ||
    !session.currentAction.activitySessionId
  ) {
    throw new CourseDeepRevisionSessionNotReadyError();
  }

  return session.currentAction.activitySessionId;
}

function isOpenQuestionPayload(
  payload:
    | NonNullable<RevisionSessionResponseDto['currentAction']>['payload']
    | undefined,
): payload is OpenQuestionActivity {
  return Boolean(
    payload &&
    typeof payload === 'object' &&
    'type' in payload &&
    payload.type === 'open_question' &&
    'question' in payload,
  );
}

function isReadyCoursePdfSource(source: CourseDocumentDto): boolean {
  return source.kind === 'COURSE_PDF' && source.status === 'READY';
}
