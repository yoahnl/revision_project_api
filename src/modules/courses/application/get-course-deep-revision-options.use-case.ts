import { Inject, Injectable } from '@nestjs/common';
import { OPEN_ANSWER_MIN_LENGTH } from '../../activities/application/submit-open-answer.use-case';
import { OPEN_QUESTION_MAX_ANSWER_LENGTH } from '../../activities/application/start-open-question-activity.use-case';
import {
  COURSES_REPOSITORY,
  type CourseDetailDto,
  type CourseDocumentDto,
  type CourseQuickRevisionKnowledgeUnitDto,
  type CoursesRepository,
} from './courses.repository';

export type CourseDeepRevisionReadinessState =
  | 'READY'
  | 'NOT_READY'
  | 'BLOCKED';

export type CourseDeepRevisionBlocker =
  | 'NO_READY_SOURCE'
  | 'NO_KNOWLEDGE_UNITS';

export type CourseDeepRevisionScopeKind = 'knowledge_unit';

export interface CourseDeepRevisionOptions {
  course: {
    id: string;
    title: string;
    subjectId: string;
  };
  readiness: {
    canStart: boolean;
    state: CourseDeepRevisionReadinessState;
    userMessage: string;
    blockers: CourseDeepRevisionBlocker[];
    readySourceCount: number;
    readyKnowledgeUnitCount: number;
  };
  scopeOptions: CourseDeepRevisionScopeOption[];
  answerGuidelines: CourseDeepRevisionAnswerGuidelines;
  defaultConfig: CourseDeepRevisionConfig | null;
  nextStep: {
    kind: 'configuration_ready' | 'blocked';
    userMessage: string;
  };
}

export interface CourseDeepRevisionScopeOption {
  kind: CourseDeepRevisionScopeKind;
  id: string;
  documentId: string;
  label: string;
  sourceLabel: string;
  canSelect: boolean;
}

export interface CourseDeepRevisionConfig {
  scopeKind: CourseDeepRevisionScopeKind;
  scopeId: string;
}

export interface CourseDeepRevisionAnswerGuidelines {
  minLength: number;
  maxLength: number;
  userMessage: string;
}

export const COURSE_DEEP_REVISION_ANSWER_GUIDELINES: CourseDeepRevisionAnswerGuidelines =
  {
    minLength: OPEN_ANSWER_MIN_LENGTH,
    maxLength: OPEN_QUESTION_MAX_ANSWER_LENGTH,
    userMessage: 'Rédige une réponse structurée avec tes propres mots.',
  };

@Injectable()
export class GetCourseDeepRevisionOptionsUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseDeepRevisionOptions> {
    const detail = await this.coursesRepository.findDetailByIdForStudent(input);

    if (!detail) {
      throw new Error('Course not found');
    }

    const readySources = detail.sources.filter(isReadyCoursePdfSource);
    if (readySources.length === 0) {
      return buildBlockedOptions({
        detail,
        state: 'BLOCKED',
        blocker: 'NO_READY_SOURCE',
        userMessage: 'Ajoute une source pour rédiger une réponse.',
        readySourceCount: 0,
        readyKnowledgeUnitCount: 0,
      });
    }

    const knowledgeUnits =
      await this.coursesRepository.findReadyQuickRevisionKnowledgeUnitsForCourse(
        {
          studentId: input.studentId,
          courseId: detail.course.id,
          subjectId: detail.course.subjectId,
        },
      );
    const scopeOptions = buildScopeOptions({
      readySources,
      knowledgeUnits,
    });

    if (scopeOptions.length === 0) {
      return buildBlockedOptions({
        detail,
        state: 'NOT_READY',
        blocker: 'NO_KNOWLEDGE_UNITS',
        userMessage: 'Aucune notion exploitable.',
        readySourceCount: readySources.length,
        readyKnowledgeUnitCount: 0,
      });
    }

    const [defaultScope] = scopeOptions;

    return {
      course: toCourseSummary(detail),
      readiness: {
        canStart: true,
        state: 'READY',
        userMessage: 'Ton cours est prêt pour une révision approfondie.',
        blockers: [],
        readySourceCount: readySources.length,
        readyKnowledgeUnitCount: scopeOptions.length,
      },
      scopeOptions,
      answerGuidelines: COURSE_DEEP_REVISION_ANSWER_GUIDELINES,
      defaultConfig: {
        scopeKind: 'knowledge_unit',
        scopeId: defaultScope.id,
      },
      nextStep: {
        kind: 'configuration_ready',
        userMessage: 'Choisis une notion et démarre la question ouverte.',
      },
    };
  }
}

function buildBlockedOptions(input: {
  detail: CourseDetailDto;
  state: CourseDeepRevisionReadinessState;
  blocker: CourseDeepRevisionBlocker;
  userMessage: string;
  readySourceCount: number;
  readyKnowledgeUnitCount: number;
}): CourseDeepRevisionOptions {
  return {
    course: toCourseSummary(input.detail),
    readiness: {
      canStart: false,
      state: input.state,
      userMessage: input.userMessage,
      blockers: [input.blocker],
      readySourceCount: input.readySourceCount,
      readyKnowledgeUnitCount: input.readyKnowledgeUnitCount,
    },
    scopeOptions: [],
    answerGuidelines: COURSE_DEEP_REVISION_ANSWER_GUIDELINES,
    defaultConfig: null,
    nextStep: {
      kind: 'blocked',
      userMessage: input.userMessage,
    },
  };
}

function buildScopeOptions(input: {
  readySources: CourseDocumentDto[];
  knowledgeUnits: CourseQuickRevisionKnowledgeUnitDto[];
}): CourseDeepRevisionScopeOption[] {
  const sourceByDocumentId = new Map(
    input.readySources.map((source) => [source.documentId, source]),
  );

  return input.knowledgeUnits
    .map((unit) => {
      const source = sourceByDocumentId.get(unit.documentId);
      if (!source) {
        return null;
      }

      return {
        kind: 'knowledge_unit' as const,
        id: unit.id,
        documentId: unit.documentId,
        label: unit.title?.trim() || 'Notion du cours',
        sourceLabel: source.fileName,
        canSelect: true,
      };
    })
    .filter(
      (option): option is CourseDeepRevisionScopeOption => option !== null,
    );
}

function isReadyCoursePdfSource(source: CourseDocumentDto): boolean {
  return source.kind === 'COURSE_PDF' && source.status === 'READY';
}

function toCourseSummary(detail: CourseDetailDto) {
  return {
    id: detail.course.id,
    title: detail.course.title,
    subjectId: detail.course.subjectId,
  };
}
