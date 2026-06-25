import { Inject, Injectable } from '@nestjs/common';
import {
  RICH_CLOSED_QUESTION_KINDS,
  type RichClosedQuestionKind,
} from '../../activities/application/rich-closed-questions/rich-closed-question.types';
import {
  COURSES_REPOSITORY,
  type CourseDetailDto,
  type CourseDocumentDto,
  type CourseQuickRevisionKnowledgeUnitDto,
  type CoursesRepository,
} from './courses.repository';

export type CourseRichRevisionReadinessState =
  | 'READY'
  | 'PARTIALLY_READY'
  | 'NOT_READY'
  | 'BLOCKED';

export type CourseRichRevisionBlocker =
  | 'NO_READY_SOURCE'
  | 'NO_KNOWLEDGE_UNITS';

export type CourseRichRevisionScopeKind = 'knowledge_unit';

export type CourseRichRevisionComplexityProfile = 'standard' | 'advanced';

export interface CourseRichRevisionOptions {
  course: {
    id: string;
    title: string;
    subjectId: string;
  };
  readiness: {
    canStart: boolean;
    state: CourseRichRevisionReadinessState;
    userMessage: string;
    blockers: CourseRichRevisionBlocker[];
    readySourceCount: number;
    readyKnowledgeUnitCount: number;
  };
  scopeOptions: CourseRichRevisionScopeOption[];
  questionCountOptions: number[];
  defaultQuestionCount: number | null;
  supportedQuestionKinds: RichClosedQuestionKind[];
  complexityProfiles: CourseRichRevisionComplexityProfile[];
  defaultConfig: CourseRichRevisionConfig | null;
  nextStep: {
    kind: 'configuration_ready' | 'blocked';
    userMessage: string;
  };
}

export interface CourseRichRevisionScopeOption {
  kind: CourseRichRevisionScopeKind;
  id: string;
  documentId: string;
  label: string;
  sourceLabel: string;
  canSelect: boolean;
}

export interface CourseRichRevisionConfig {
  scopeKind: CourseRichRevisionScopeKind;
  scopeId: string;
  questionCount: number;
  complexityProfile: CourseRichRevisionComplexityProfile;
}

export const COURSE_RICH_REVISION_QUESTION_COUNT_OPTIONS = [6, 10, 13] as const;
export const COURSE_RICH_REVISION_COMPLEXITY_PROFILES = [
  'standard',
  'advanced',
] as const;

const COURSE_RICH_REVISION_SUPPORTED_QUESTION_KINDS =
  RICH_CLOSED_QUESTION_KINDS.filter(
    (kind) => kind !== 'image_choice',
  ) as RichClosedQuestionKind[];

@Injectable()
export class GetCourseRichRevisionOptionsUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseRichRevisionOptions> {
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
        userMessage: 'Ajoute une source pour lancer un QCM complet.',
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

    if (knowledgeUnits.length === 0) {
      return buildBlockedOptions({
        detail,
        state: 'NOT_READY',
        blocker: 'NO_KNOWLEDGE_UNITS',
        userMessage:
          "Aucune notion exploitable n'est disponible pour ce cours.",
        readySourceCount: readySources.length,
        readyKnowledgeUnitCount: 0,
      });
    }

    const scopeOptions = buildScopeOptions({
      readySources,
      knowledgeUnits,
    });
    const [defaultScope] = scopeOptions;

    return {
      course: toCourseSummary(detail),
      readiness: {
        canStart: scopeOptions.length > 0,
        state: 'READY',
        userMessage: 'Ton cours est prêt pour un QCM complet.',
        blockers: [],
        readySourceCount: readySources.length,
        readyKnowledgeUnitCount: knowledgeUnits.length,
      },
      scopeOptions,
      questionCountOptions: [...COURSE_RICH_REVISION_QUESTION_COUNT_OPTIONS],
      defaultQuestionCount: COURSE_RICH_REVISION_QUESTION_COUNT_OPTIONS[0],
      supportedQuestionKinds: [
        ...COURSE_RICH_REVISION_SUPPORTED_QUESTION_KINDS,
      ],
      complexityProfiles: [...COURSE_RICH_REVISION_COMPLEXITY_PROFILES],
      defaultConfig: defaultScope
        ? {
            scopeKind: 'knowledge_unit',
            scopeId: defaultScope.id,
            questionCount: COURSE_RICH_REVISION_QUESTION_COUNT_OPTIONS[0],
            complexityProfile: 'standard',
          }
        : null,
      nextStep: {
        kind: 'configuration_ready',
        userMessage: 'Choisis une notion et démarre le QCM complet.',
      },
    };
  }
}

function buildBlockedOptions(input: {
  detail: CourseDetailDto;
  state: CourseRichRevisionReadinessState;
  blocker: CourseRichRevisionBlocker;
  userMessage: string;
  readySourceCount: number;
  readyKnowledgeUnitCount: number;
}): CourseRichRevisionOptions {
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
    questionCountOptions: [],
    defaultQuestionCount: null,
    supportedQuestionKinds: [...COURSE_RICH_REVISION_SUPPORTED_QUESTION_KINDS],
    complexityProfiles: [...COURSE_RICH_REVISION_COMPLEXITY_PROFILES],
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
}): CourseRichRevisionScopeOption[] {
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
      (option): option is CourseRichRevisionScopeOption => option !== null,
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
