import { Inject, Injectable } from '@nestjs/common';
import {
  REVISION_REPOSITORY,
  type RevisionRepository,
} from '../../../revision/application/revision.repository';
import type { KnowledgeUnit } from '../../../revision/domain/knowledge-unit.entity';
import {
  ACTIVITIES_REPOSITORY,
  type ActivitiesRepository,
} from '../activities.repository';
import {
  RICH_CLOSED_SOURCE_CONTEXT_EMPTY,
  RICH_CLOSED_START_INVALID_INPUT,
} from './rich-closed-question-errors';
import { resolveRichClosedQuestionTypeMix } from './rich-closed-question-generation-profile';
import {
  RICH_CLOSED_QUESTION_GENERATOR,
  type RichClosedComplexityProfile,
  type RichClosedQuestionGenerator,
} from './rich-closed-question-generator';
import { evaluateRichClosedExerciseQuality } from './rich-closed-question-quality-gate';
import {
  RICH_CLOSED_QUESTION_KINDS,
  type RichClosedPublicExerciseEnvelope,
  type RichClosedQuestionKind,
} from './rich-closed-question.types';
import { validateRichClosedExercise } from './rich-closed-question.validator';

export interface StartRichClosedExerciseInput {
  studentId: string;
  subjectId: string;
  documentId?: string | null;
  knowledgeUnitId: string;
  questionCount?: number;
  complexityProfile?: RichClosedComplexityProfile;
  questionTypeMix?: Partial<Record<RichClosedQuestionKind, number>>;
}

const DEFAULT_RICH_CLOSED_QUESTION_COUNT = 6;

@Injectable()
export class StartRichClosedExerciseUseCase {
  constructor(
    @Inject(ACTIVITIES_REPOSITORY)
    private readonly activitiesRepository: ActivitiesRepository,
    @Inject(REVISION_REPOSITORY)
    private readonly revisionRepository: RevisionRepository,
    @Inject(RICH_CLOSED_QUESTION_GENERATOR)
    private readonly generator: RichClosedQuestionGenerator,
  ) {}

  async execute(
    input: StartRichClosedExerciseInput,
  ): Promise<RichClosedPublicExerciseEnvelope> {
    const questionCount =
      input.questionCount ?? DEFAULT_RICH_CLOSED_QUESTION_COUNT;
    const complexityProfile = input.complexityProfile ?? 'exam';
    const questionTypeMix =
      input.questionTypeMix ??
      resolveRichClosedQuestionTypeMix({
        questionCount,
        complexityProfile,
      });
    assertRichClosedQuestionTypeMix({
      questionCount,
      questionTypeMix,
    });
    const knowledgeUnit = await this.findKnowledgeUnit(input);
    const generationContext =
      await this.activitiesRepository.findRichClosedGenerationContext({
        studentId: input.studentId,
        subjectId: input.subjectId,
        knowledgeUnitId: knowledgeUnit.id,
      });

    if (!generationContext || generationContext.chunks.length === 0) {
      throw new Error(RICH_CLOSED_SOURCE_CONTEXT_EMPTY);
    }

    const requestedDocumentId = input.documentId ?? undefined;
    const documentId = requestedDocumentId ?? generationContext.documentId;

    if (
      requestedDocumentId !== undefined &&
      requestedDocumentId !== generationContext.documentId
    ) {
      throw new Error(RICH_CLOSED_START_INVALID_INPUT);
    }

    const exercise = await this.generator.generate({
      studentId: input.studentId,
      subjectId: input.subjectId,
      documentId,
      knowledgeUnit: generationContext.knowledgeUnit,
      chunks: generationContext.chunks.map((chunk) => ({
        ...chunk,
        pageNumber: chunk.pageNumber ?? null,
      })),
      questionCount,
      questionTypeMix,
      complexityProfile,
    });
    const knownSourceChunkIds = new Set(
      generationContext.chunks.map((chunk) => chunk.id),
    );
    const validation = validateRichClosedExercise(exercise, {
      knownSourceChunkIds,
    });

    if (!validation.accepted) {
      throw new Error(RICH_CLOSED_START_INVALID_INPUT);
    }

    const quality = evaluateRichClosedExerciseQuality(exercise, {
      knownSourceChunkIds,
    });

    if (!quality.accepted) {
      throw new Error(RICH_CLOSED_START_INVALID_INPUT);
    }

    return this.activitiesRepository.createRichClosedExerciseSession({
      studentId: input.studentId,
      subjectId: input.subjectId,
      knowledgeUnitId: knowledgeUnit.id,
      documentId,
      exercise,
      qualityMetrics: quality.metrics,
      generationMetadata: exercise.metadata,
    });
  }

  private async findKnowledgeUnit(input: {
    studentId: string;
    subjectId: string;
    knowledgeUnitId: string;
  }): Promise<KnowledgeUnit> {
    const knowledgeUnits = await this.revisionRepository.findKnowledgeUnits(
      input.studentId,
    );
    const knowledgeUnit = knowledgeUnits.find(
      (unit) =>
        unit.id === input.knowledgeUnitId && unit.subjectId === input.subjectId,
    );

    if (!knowledgeUnit) {
      throw new Error(RICH_CLOSED_START_INVALID_INPUT);
    }

    return knowledgeUnit;
  }
}

export function assertRichClosedQuestionTypeMix(input: {
  questionCount: number;
  questionTypeMix: Partial<Record<RichClosedQuestionKind, number>>;
}): void {
  const entries = Object.entries(input.questionTypeMix);
  const allowedKinds = new Set<string>(RICH_CLOSED_QUESTION_KINDS);

  if (entries.length === 0) {
    throw new Error(RICH_CLOSED_START_INVALID_INPUT);
  }

  for (const [kind, count] of entries) {
    if (
      !allowedKinds.has(kind) ||
      !Number.isInteger(count) ||
      Number(count) < 0
    ) {
      throw new Error(RICH_CLOSED_START_INVALID_INPUT);
    }
  }

  const total = entries.reduce((sum, [, count]) => sum + Number(count), 0);

  if (total !== input.questionCount) {
    throw new Error(RICH_CLOSED_START_INVALID_INPUT);
  }
}
