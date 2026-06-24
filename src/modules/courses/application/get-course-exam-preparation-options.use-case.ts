import { Inject, Injectable } from '@nestjs/common';
import { QuestionBankService } from '../../activities/application/question-bank.service';
import {
  COURSES_REPOSITORY,
  type CourseDetailDto,
  type CourseDocumentDto,
  type CourseQuickRevisionKnowledgeUnitDto,
  type CoursesRepository,
} from './courses.repository';

export type CourseExamPreparationReadinessState =
  | 'READY'
  | 'PARTIALLY_READY'
  | 'NOT_READY'
  | 'BLOCKED';

export type CourseExamPreparationBlocker =
  | 'NO_READY_SOURCE'
  | 'NO_KNOWLEDGE_UNITS'
  | 'INSUFFICIENT_QUESTIONS';

export type CourseExamPreparationScopeKind = 'course' | 'source';

export interface CourseExamPreparationOptions {
  course: {
    id: string;
    title: string;
    subjectId: string;
  };
  readiness: {
    canPrepare: boolean;
    state: CourseExamPreparationReadinessState;
    userMessage: string;
    blockers: CourseExamPreparationBlocker[];
    readySourceCount: number;
    readyKnowledgeUnitCount: number;
    availableQuestionCount: number;
  };
  scopeOptions: CourseExamPreparationScopeOption[];
  questionCountOptions: number[];
  defaultQuestionCount: number | null;
  supportedQuestionKinds: string[];
  defaultConfig: CourseExamPreparationConfig | null;
  nextStep: {
    kind: 'configuration_ready' | 'needs_questions' | 'blocked';
    userMessage: string;
  };
}

export interface CourseExamPreparationScopeOption {
  kind: CourseExamPreparationScopeKind;
  id: string;
  label: string;
  readyQuestionCount: number;
  readyKnowledgeUnitCount: number;
  canSelect: boolean;
}

export interface CourseExamPreparationConfig {
  scopeKind: CourseExamPreparationScopeKind;
  scopeId: string;
  questionCount: number;
  complexityProfile: 'exam';
}

const QUESTION_COUNT_OPTIONS = [10, 20, 30] as const;
const READY_DEFAULT_QUESTION_COUNT = 20;
const SUPPORTED_EXAM_QUESTION_KINDS = [
  'single_choice',
  'multiple_choice',
] as const;

@Injectable()
export class GetCourseExamPreparationOptionsUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
    private readonly questionBank: QuestionBankService,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseExamPreparationOptions> {
    const detail = await this.coursesRepository.findDetailByIdForStudent(input);

    if (!detail) {
      throw new Error('Course not found');
    }

    const readySources = detail.sources.filter(isReadyCoursePdfSource);
    if (readySources.length === 0) {
      return buildBlockedOptions({
        detail,
        blocker: 'NO_READY_SOURCE',
        userMessage:
          'Ajoute une source prête avant de configurer une préparation examen.',
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
        blocker: 'NO_KNOWLEDGE_UNITS',
        userMessage:
          "Aucune notion exploitable n'a encore été trouvée pour ce cours.",
        readySourceCount: readySources.length,
        readyKnowledgeUnitCount: 0,
      });
    }

    const availableQuestionCount =
      await this.questionBank.countActiveCourseQuickQuestions({
        studentId: input.studentId,
        subjectId: detail.course.subjectId,
        courseId: detail.course.id,
        knowledgeUnitIds: knowledgeUnits.map((unit) => unit.id),
      });
    const sourceOptions = await this.buildSourceOptions({
      studentId: input.studentId,
      detail,
      readySources,
      knowledgeUnits,
    });
    const questionCountOptions = QUESTION_COUNT_OPTIONS.filter(
      (count) => count <= availableQuestionCount,
    );
    const defaultQuestionCount =
      resolveDefaultQuestionCount(questionCountOptions);
    const state = resolveReadinessState(availableQuestionCount);
    const canPrepare = defaultQuestionCount !== null;

    return {
      course: toCourseSummary(detail),
      readiness: {
        canPrepare,
        state,
        userMessage: readinessMessage(state),
        blockers: state === 'NOT_READY' ? ['INSUFFICIENT_QUESTIONS'] : [],
        readySourceCount: readySources.length,
        readyKnowledgeUnitCount: knowledgeUnits.length,
        availableQuestionCount,
      },
      scopeOptions: [
        {
          kind: 'course',
          id: detail.course.id,
          label: 'Tout le cours',
          readyQuestionCount: availableQuestionCount,
          readyKnowledgeUnitCount: knowledgeUnits.length,
          canSelect: canPrepare,
        },
        ...sourceOptions,
      ],
      questionCountOptions,
      defaultQuestionCount,
      supportedQuestionKinds: [...SUPPORTED_EXAM_QUESTION_KINDS],
      defaultConfig: defaultQuestionCount
        ? {
            scopeKind: 'course',
            scopeId: detail.course.id,
            questionCount: defaultQuestionCount,
            complexityProfile: 'exam',
          }
        : null,
      nextStep: nextStepForState(state),
    };
  }

  private async buildSourceOptions(input: {
    studentId: string;
    detail: CourseDetailDto;
    readySources: CourseDocumentDto[];
    knowledgeUnits: CourseQuickRevisionKnowledgeUnitDto[];
  }): Promise<CourseExamPreparationScopeOption[]> {
    const options: CourseExamPreparationScopeOption[] = [];

    for (const source of input.readySources) {
      const sourceKnowledgeUnits = input.knowledgeUnits.filter(
        (unit) => unit.documentId === source.documentId,
      );
      const readyQuestionCount =
        sourceKnowledgeUnits.length === 0
          ? 0
          : await this.questionBank.countActiveCourseQuickQuestions({
              studentId: input.studentId,
              subjectId: input.detail.course.subjectId,
              courseId: input.detail.course.id,
              knowledgeUnitIds: sourceKnowledgeUnits.map((unit) => unit.id),
            });

      options.push({
        kind: 'source',
        id: source.documentId,
        label: source.fileName,
        readyQuestionCount,
        readyKnowledgeUnitCount: sourceKnowledgeUnits.length,
        canSelect: readyQuestionCount >= QUESTION_COUNT_OPTIONS[0],
      });
    }

    return options;
  }
}

function buildBlockedOptions(input: {
  detail: CourseDetailDto;
  blocker: CourseExamPreparationBlocker;
  userMessage: string;
  readySourceCount: number;
  readyKnowledgeUnitCount: number;
}): CourseExamPreparationOptions {
  return {
    course: toCourseSummary(input.detail),
    readiness: {
      canPrepare: false,
      state: 'BLOCKED',
      userMessage: input.userMessage,
      blockers: [input.blocker],
      readySourceCount: input.readySourceCount,
      readyKnowledgeUnitCount: input.readyKnowledgeUnitCount,
      availableQuestionCount: 0,
    },
    scopeOptions: [],
    questionCountOptions: [],
    defaultQuestionCount: null,
    supportedQuestionKinds: [...SUPPORTED_EXAM_QUESTION_KINDS],
    defaultConfig: null,
    nextStep: {
      kind: 'blocked',
      userMessage: input.userMessage,
    },
  };
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

function resolveDefaultQuestionCount(
  options: readonly number[],
): number | null {
  if (options.length === 0) {
    return null;
  }

  return options.includes(READY_DEFAULT_QUESTION_COUNT)
    ? READY_DEFAULT_QUESTION_COUNT
    : options[options.length - 1];
}

function resolveReadinessState(
  availableQuestionCount: number,
): CourseExamPreparationReadinessState {
  if (availableQuestionCount >= READY_DEFAULT_QUESTION_COUNT) {
    return 'READY';
  }

  if (availableQuestionCount >= QUESTION_COUNT_OPTIONS[0]) {
    return 'PARTIALLY_READY';
  }

  return 'NOT_READY';
}

function readinessMessage(state: CourseExamPreparationReadinessState): string {
  if (state === 'READY') {
    return 'Ton cours est prêt pour une préparation examen.';
  }

  if (state === 'PARTIALLY_READY') {
    return 'Ton cours permet une préparation courte.';
  }

  return 'Prépare plus de questions avant de configurer ce mode.';
}

function nextStepForState(state: CourseExamPreparationReadinessState) {
  if (state === 'NOT_READY') {
    return {
      kind: 'needs_questions' as const,
      userMessage:
        'Prépare davantage de questions avant de valider une configuration.',
    };
  }

  return {
    kind: 'configuration_ready' as const,
    userMessage: 'Configuration prête. La session complète arrive ensuite.',
  };
}
