import { Inject, Injectable, Logger } from '@nestjs/common';
import { genkit, z } from 'genkit';
import {
  AI_GENERATION_OBSERVER,
  type AiGenerationObserver,
  noopAiGenerationObserver,
} from '../../ai/application/ai-generation-observer';
import {
  type ResolvedArtifactGenkitMetadata,
  resolveArtifactGenkitConfig,
  resolveArtifactGenkitMetadata,
  resolveArtifactMistralFallbackMetadata,
} from '../../ai/infrastructure/document-artifact-genkit-config';
import { isInvalidAiOutputError } from '../../ai/infrastructure/mistral-model-fallback';
import { evaluateRichClosedExerciseQuality } from '../application/rich-closed-questions/rich-closed-question-quality-gate';
import { validateRichClosedExercise } from '../application/rich-closed-questions/rich-closed-question.validator';
import {
  RICH_CLOSED_EXERCISE_VERSION,
  RICH_CLOSED_COGNITIVE_SKILLS,
  RICH_CLOSED_QUESTION_KINDS,
  type RichClosedExercise,
  type RichClosedExerciseValidationIssue,
  type RichClosedQuestionKind,
} from '../application/rich-closed-questions/rich-closed-question.types';
import type {
  GeneratedRichClosedExercise,
  RichClosedQuestionGenerationInput,
  RichClosedQuestionGenerator,
} from '../application/rich-closed-questions/rich-closed-question-generator';
import {
  RICH_CLOSED_QUESTION_COUNT_INVALID,
  resolveRichClosedQuestionTypeMix,
} from '../application/rich-closed-questions/rich-closed-question-generation-profile';
import {
  RICH_CLOSED_IMAGE_ASSET_IDS,
  RICH_CLOSED_IMAGE_ASSETS,
} from '../application/rich-closed-questions/rich-closed-image-assets';

export const RICH_CLOSED_FLOW_NAME = 'richClosedQuestionGeneration';
export const RICH_CLOSED_PROMPT_VERSION = 'rich-closed-v1d-004';
export const RICH_CLOSED_SCHEMA_VERSION = RICH_CLOSED_EXERCISE_VERSION;
export const RICH_CLOSED_GENERATION_FAILED = 'RICH_CLOSED_GENERATION_FAILED';
export const RICH_CLOSED_GENERATION_SCHEMA_INVALID =
  'RICH_CLOSED_GENERATION_SCHEMA_INVALID';
export const RICH_CLOSED_GENERATION_CONTRACT_INVALID =
  'RICH_CLOSED_GENERATION_CONTRACT_INVALID';
export const RICH_CLOSED_GENERATION_QUALITY_REJECTED =
  'RICH_CLOSED_GENERATION_QUALITY_REJECTED';
export const RICH_CLOSED_GENERATION_SOURCE_INVALID =
  'RICH_CLOSED_GENERATION_SOURCE_INVALID';

const DEFAULT_MAX_CHUNKS = 8;
const DEFAULT_MAX_CHARS = 8000;
const MAX_QUESTION_COUNT = 20;

const NonEmptyStringSchema = z.string().trim().min(1);
const DifficultySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
const SourceChunkIdsSchema = z.array(NonEmptyStringSchema).min(1);
const ImageAssetIdSchema = z.enum(RICH_CLOSED_IMAGE_ASSET_IDS);
const ImageAssetLicenseSchema = z.enum([
  'public_domain',
  'own_generated',
  'open_license',
  'internal_placeholder',
]);

const ChoiceSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
  })
  .strict();

const LabelItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
  })
  .strict();

const TimelineEventSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    description: NonEmptyStringSchema.nullable().optional(),
  })
  .strict();

const TrueFalseRowSchema = z
  .object({
    id: NonEmptyStringSchema,
    statement: NonEmptyStringSchema,
    context: NonEmptyStringSchema.nullable().optional(),
  })
  .strict();

const TrueFalseValueSchema = z
  .object({
    rowId: NonEmptyStringSchema,
    value: z.boolean(),
  })
  .strict();

const CauseConsequenceItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    description: NonEmptyStringSchema.nullable().optional(),
  })
  .strict();

const CauseConsequencePairSchema = z
  .object({
    causeId: NonEmptyStringSchema,
    consequenceId: NonEmptyStringSchema,
  })
  .strict();

const InstitutionMatrixAxisItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    description: NonEmptyStringSchema.nullable().optional(),
  })
  .strict();

const InstitutionMatrixOptionSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
  })
  .strict();

const InstitutionMatrixCellSchema = z
  .object({
    id: NonEmptyStringSchema,
    rowId: NonEmptyStringSchema,
    columnId: NonEmptyStringSchema,
    prompt: NonEmptyStringSchema.nullable().optional(),
    options: z.array(InstitutionMatrixOptionSchema).min(2).max(6),
  })
  .strict();

const InstitutionMatrixValueSchema = z
  .object({
    cellId: NonEmptyStringSchema,
    optionId: NonEmptyStringSchema,
  })
  .strict();

const DiagramLayoutSchema = z.enum([
  'vertical_flow',
  'two_column',
  'cycle',
  'hierarchy',
  'plain',
]);

const DiagramGroupSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    description: NonEmptyStringSchema.nullable().optional(),
  })
  .strict();

const DiagramNodeSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    description: NonEmptyStringSchema.nullable().optional(),
    groupId: NonEmptyStringSchema.nullable().optional(),
  })
  .strict();

const DiagramEdgeSchema = z
  .object({
    id: NonEmptyStringSchema,
    fromNodeId: NonEmptyStringSchema,
    toNodeId: NonEmptyStringSchema,
    label: NonEmptyStringSchema.nullable().optional(),
    description: NonEmptyStringSchema.nullable().optional(),
  })
  .strict();

const DiagramSchema = z
  .object({
    title: NonEmptyStringSchema.nullable().optional(),
    description: NonEmptyStringSchema.nullable().optional(),
    layout: DiagramLayoutSchema,
    nodes: z.array(DiagramNodeSchema).min(2).max(8),
    groups: z.array(DiagramGroupSchema).max(4).optional(),
    edges: z.array(DiagramEdgeSchema).max(12),
  })
  .strict();

const DiagramLabelingOptionSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
  })
  .strict();

const DiagramLabelingSlotSchema = z
  .object({
    id: NonEmptyStringSchema,
    anchorType: z.enum(['node', 'edge']),
    anchorId: NonEmptyStringSchema,
    prompt: NonEmptyStringSchema,
    options: z.array(DiagramLabelingOptionSchema).min(2).max(6),
  })
  .strict();

const DiagramLabelingValueSchema = z
  .object({
    slotId: NonEmptyStringSchema,
    optionId: NonEmptyStringSchema,
  })
  .strict();

const CalculationChoiceSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    value: z.number().int(),
  })
  .strict();

const ImageChoiceOptionSchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    imageAssetId: ImageAssetIdSchema,
    altText: NonEmptyStringSchema,
    caption: NonEmptyStringSchema.nullable().optional(),
    creditLabel: NonEmptyStringSchema.nullable().optional(),
    license: ImageAssetLicenseSchema.optional(),
  })
  .strict();

const AbsoluteMajorityThresholdCalculationSchema = z
  .object({
    mode: z.literal('absolute_majority_threshold'),
    validVotes: z.number().int().min(1).max(1_000_000),
  })
  .strict();

const CalculationPartySchema = z
  .object({
    id: NonEmptyStringSchema,
    label: NonEmptyStringSchema,
    votes: z.number().int().min(0).max(1_000_000),
  })
  .strict();

const LargestRemainderTargetPartySeatsCalculationSchema = z
  .object({
    mode: z.literal('largest_remainder_target_party_seats'),
    totalSeats: z.number().int().min(1).max(200),
    targetPartyId: NonEmptyStringSchema,
    parties: z.array(CalculationPartySchema).min(2).max(8),
  })
  .strict();

const CalculationDataSchema = z.discriminatedUnion('mode', [
  AbsoluteMajorityThresholdCalculationSchema,
  LargestRemainderTargetPartySeatsCalculationSchema,
]);

const PairSchema = z
  .object({
    leftId: NonEmptyStringSchema,
    rightId: NonEmptyStringSchema,
  })
  .strict();

const QuestionBaseSchema = {
  id: NonEmptyStringSchema,
  prompt: z.string().trim().min(8),
  difficulty: DifficultySchema,
  cognitiveSkill: NonEmptyStringSchema,
  sourceChunkIds: SourceChunkIdsSchema,
};

const SingleChoiceQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('single_choice'),
    choices: z.array(ChoiceSchema).min(2).max(6),
    correctChoiceId: NonEmptyStringSchema,
    explanation: z.string().trim().min(8),
  })
  .strict();

const MultipleChoiceQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('multiple_choice'),
    choices: z.array(ChoiceSchema).min(2).max(6),
    minSelections: z.number().int().min(1),
    maxSelections: z.number().int().min(1),
    correctChoiceIds: z.array(NonEmptyStringSchema).min(2),
    explanation: z.string().trim().min(8),
  })
  .strict();

const MatchingQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('matching'),
    leftItems: z.array(LabelItemSchema).min(3),
    rightItems: z.array(LabelItemSchema).min(3),
    correctPairs: z.array(PairSchema).min(3),
    explanation: z.string().trim().min(8),
  })
  .strict();

const OrderingQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('ordering'),
    items: z.array(LabelItemSchema).min(3),
    correctOrder: z.array(NonEmptyStringSchema).min(3),
    explanation: z.string().trim().min(8),
  })
  .strict();

const TimelineQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('timeline'),
    instruction: NonEmptyStringSchema.nullable().optional(),
    events: z.array(TimelineEventSchema).min(3).max(6),
    correctOrder: z.array(NonEmptyStringSchema).min(3).max(6),
    explanation: z.string().trim().min(8),
  })
  .strict();

const DateSliderQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('date_slider'),
    instruction: NonEmptyStringSchema.nullable().optional(),
    minYear: z.number().int(),
    maxYear: z.number().int(),
    step: z.number().int().min(1),
    correctYear: z.number().int(),
    toleranceYears: z.number().int().min(0),
    explanation: z.string().trim().min(8),
  })
  .strict();

const TrueFalseGridQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('true_false_grid'),
    instruction: NonEmptyStringSchema.nullable().optional(),
    rows: z.array(TrueFalseRowSchema).min(3).max(8),
    correctValues: z.array(TrueFalseValueSchema).min(3).max(8),
    explanation: z.string().trim().min(8),
  })
  .strict();

const CauseConsequenceQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('cause_consequence'),
    instruction: NonEmptyStringSchema.nullable().optional(),
    causes: z.array(CauseConsequenceItemSchema).min(3).max(6),
    consequences: z.array(CauseConsequenceItemSchema).min(3).max(6),
    correctPairs: z.array(CauseConsequencePairSchema).min(3).max(6),
    explanation: z.string().trim().min(8),
  })
  .strict();

const InstitutionMatrixQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('institution_matrix'),
    instruction: NonEmptyStringSchema.nullable().optional(),
    rows: z.array(InstitutionMatrixAxisItemSchema).min(2).max(5),
    columns: z.array(InstitutionMatrixAxisItemSchema).min(2).max(5),
    cells: z.array(InstitutionMatrixCellSchema).min(3).max(25),
    correctValues: z.array(InstitutionMatrixValueSchema).min(3).max(25),
    explanation: z.string().trim().min(8),
  })
  .strict();

const DiagramLabelingQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('diagram_labeling'),
    instruction: NonEmptyStringSchema.nullable().optional(),
    diagram: DiagramSchema,
    slots: z.array(DiagramLabelingSlotSchema).min(2).max(8),
    correctValues: z.array(DiagramLabelingValueSchema).min(2).max(8),
    explanation: z.string().trim().min(8),
  })
  .strict();

const CalculationMcqQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('calculation_mcq'),
    instruction: NonEmptyStringSchema.nullable().optional(),
    scenario: z.string().trim().min(8).max(900),
    calculation: CalculationDataSchema,
    choices: z.array(CalculationChoiceSchema).min(2).max(6),
    correctChoiceId: NonEmptyStringSchema,
    explanation: z.string().trim().min(8),
  })
  .strict();

const ImageChoiceQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('image_choice'),
    instruction: NonEmptyStringSchema.nullable().optional(),
    choices: z.array(ImageChoiceOptionSchema).min(2).max(6),
    correctChoiceId: NonEmptyStringSchema,
    explanation: z.string().trim().min(8),
  })
  .strict();

const CaseQualificationQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('case_qualification'),
    caseText: z.string().trim().min(8).max(900),
    choices: z.array(ChoiceSchema).min(2).max(6),
    correctChoiceId: NonEmptyStringSchema,
    explanation: z.string().trim().min(8),
  })
  .strict();

const ErrorDetectionQuestionSchema = z
  .object({
    ...QuestionBaseSchema,
    questionKind: z.literal('error_detection'),
    statement: z.string().trim().min(8).max(900),
    errorOptions: z.array(ChoiceSchema).min(2).max(6),
    correctErrorId: NonEmptyStringSchema,
    explanation: z.string().trim().min(8),
  })
  .strict();

const RichClosedQuestionSchema = z.discriminatedUnion('questionKind', [
  SingleChoiceQuestionSchema,
  MultipleChoiceQuestionSchema,
  MatchingQuestionSchema,
  OrderingQuestionSchema,
  CaseQualificationQuestionSchema,
  ErrorDetectionQuestionSchema,
  TimelineQuestionSchema,
  DateSliderQuestionSchema,
  TrueFalseGridQuestionSchema,
  CauseConsequenceQuestionSchema,
  InstitutionMatrixQuestionSchema,
  DiagramLabelingQuestionSchema,
  CalculationMcqQuestionSchema,
  ImageChoiceQuestionSchema,
]);

const GeneratedRichClosedExerciseSchema = z
  .object({
    id: NonEmptyStringSchema,
    version: z.literal(RICH_CLOSED_EXERCISE_VERSION),
    title: NonEmptyStringSchema,
    subjectId: NonEmptyStringSchema,
    documentId: NonEmptyStringSchema.nullable(),
    knowledgeUnitId: NonEmptyStringSchema,
    questions: z.array(RichClosedQuestionSchema).min(1).max(MAX_QUESTION_COUNT),
  })
  .strict();

type RichClosedPromptChunk = {
  id: string;
  index: number;
  text: string;
  pageNumber: number | null;
};

type RichClosedGenerationFailureType =
  | 'schema'
  | 'count'
  | 'mix'
  | 'contract'
  | 'quality'
  | 'source';

interface RichClosedGenerationDiagnosticIssue {
  code: string;
  path?: string;
  severity?: RichClosedExerciseValidationIssue['severity'];
}

interface RichClosedGenerationDiagnostic {
  failureType: RichClosedGenerationFailureType;
  schemaErrorName?: string;
  schemaErrorMessagePreview?: string;
  schemaIssueCount?: number;
  expectedQuestionCount?: number;
  actualQuestionCount?: number | null;
  expectedQuestionTypeMix?: Record<RichClosedQuestionKind, number>;
  actualQuestionTypeMix?: Record<RichClosedQuestionKind, number>;
  validationIssues?: RichClosedGenerationDiagnosticIssue[];
  qualityIssues?: RichClosedGenerationDiagnosticIssue[];
  questionIds?: string[];
  questionKinds?: RichClosedQuestionKind[];
  sourceChunkIds?: string[];
}

@Injectable()
export class GenkitRichClosedQuestionGenerator implements RichClosedQuestionGenerator {
  private readonly logger = new Logger(GenkitRichClosedQuestionGenerator.name);
  private readonly aiByModel = new Map<string, ReturnType<typeof genkit>>();
  private resolvedMetadata?: ResolvedArtifactGenkitMetadata;

  constructor(
    @Inject(AI_GENERATION_OBSERVER)
    private readonly observer: AiGenerationObserver = noopAiGenerationObserver,
  ) {}

  async generate(
    input: RichClosedQuestionGenerationInput,
  ): Promise<GeneratedRichClosedExercise> {
    const primaryMetadata = this.resolveMetadata();
    const fallbackMetadata = resolveArtifactMistralFallbackMetadata(
      primaryMetadata,
      'MISTRAL_RICH_CLOSED_FALLBACK_MODEL',
    );
    const attempts = fallbackMetadata
      ? [primaryMetadata, fallbackMetadata]
      : [primaryMetadata];
    const chunks = selectRichClosedChunks(input);
    const questionTypeMix = resolveRequestedQuestionTypeMix(input);
    const prompt = buildRichClosedPrompt({
      input,
      chunks,
      questionTypeMix,
    });
    const inputSize = prompt.length;
    let previousDiagnostic: RichClosedGenerationDiagnostic | undefined;

    this.logger.log(
      JSON.stringify(
        buildRichClosedContextLog({
          input,
          chunks,
          metadata: primaryMetadata,
          inputSize,
          questionTypeMix,
        }),
      ),
    );

    for (const [index, metadata] of attempts.entries()) {
      const startedAt = Date.now();
      const attemptPrompt =
        index === 0
          ? prompt
          : buildRichClosedRepairPrompt({
              input,
              chunks,
              questionTypeMix,
              previousDiagnostic,
            });
      const attemptInputSize = attemptPrompt.length;

      try {
        const { output } = await this.getAi(metadata).generate({
          prompt: attemptPrompt,
          output: {
            schema: GeneratedRichClosedExerciseSchema,
          },
        });
        const exercise = normalizeGeneratedRichClosedExercise({
          output,
          input,
          chunks,
          metadata,
          inputSize: attemptInputSize,
          questionTypeMix,
        });

        this.logger.log(
          JSON.stringify(
            buildRichClosedOutputLog({ input, exercise, metadata }),
          ),
        );

        this.observer.observe({
          flowName: RICH_CLOSED_FLOW_NAME,
          provider: metadata.provider,
          model: metadata.model,
          promptVersion: RICH_CLOSED_PROMPT_VERSION,
          schemaVersion: RICH_CLOSED_SCHEMA_VERSION,
          inputSize: attemptInputSize,
          durationMs: Date.now() - startedAt,
          status: 'success',
          documentId: input.documentId ?? undefined,
          knowledgeUnitId: input.knowledgeUnit.id,
          subjectId: input.subjectId,
          studentId: input.studentId,
        });

        return exercise;
      } catch (error) {
        const controlledError = toRichClosedGenerationError(error);
        previousDiagnostic = controlledError.diagnostic;

        this.logger.warn(
          JSON.stringify(
            buildRichClosedErrorLog({
              input,
              metadata,
              errorCode: controlledError.code,
              diagnostic: controlledError.diagnostic,
            }),
          ),
        );

        this.observer.observe({
          flowName: RICH_CLOSED_FLOW_NAME,
          provider: metadata.provider,
          model: metadata.model,
          promptVersion: RICH_CLOSED_PROMPT_VERSION,
          schemaVersion: RICH_CLOSED_SCHEMA_VERSION,
          inputSize: attemptInputSize,
          durationMs: Date.now() - startedAt,
          status: 'error',
          errorCode: controlledError.code,
          documentId: input.documentId ?? undefined,
          knowledgeUnitId: input.knowledgeUnit.id,
          subjectId: input.subjectId,
          studentId: input.studentId,
        });

        if (
          index === 0 &&
          attempts.length > 1 &&
          isInvalidAiOutputError(controlledError, [
            RICH_CLOSED_GENERATION_SCHEMA_INVALID,
            RICH_CLOSED_GENERATION_CONTRACT_INVALID,
            RICH_CLOSED_GENERATION_QUALITY_REJECTED,
            RICH_CLOSED_GENERATION_SOURCE_INVALID,
          ])
        ) {
          continue;
        }

        throw controlledError;
      }
    }

    throw new RichClosedQuestionGenerationError(RICH_CLOSED_GENERATION_FAILED);
  }

  private getAi(
    metadata: ResolvedArtifactGenkitMetadata,
  ): ReturnType<typeof genkit> {
    const cacheKey = `${metadata.provider}:${metadata.model}`;
    const existingAi = this.aiByModel.get(cacheKey);

    if (existingAi) {
      return existingAi;
    }

    const ai = genkit(resolveArtifactGenkitConfig(metadata).config);
    this.aiByModel.set(cacheKey, ai);

    return ai;
  }

  private resolveMetadata(): ResolvedArtifactGenkitMetadata {
    this.resolvedMetadata ??= resolveArtifactGenkitMetadata();
    return this.resolvedMetadata;
  }
}

export class RichClosedQuestionGenerationError extends Error {
  constructor(
    readonly code: string,
    readonly diagnostic?: RichClosedGenerationDiagnostic,
  ) {
    super(code);
    this.name = 'RichClosedQuestionGenerationError';
  }
}

function normalizeGeneratedRichClosedExercise(input: {
  output: unknown;
  input: RichClosedQuestionGenerationInput;
  chunks: RichClosedPromptChunk[];
  metadata: ResolvedArtifactGenkitMetadata;
  inputSize: number;
  questionTypeMix: Record<RichClosedQuestionKind, number>;
}): GeneratedRichClosedExercise {
  const parsed = parseRichClosedGenerationOutput(input.output);
  const exercise: RichClosedExercise = {
    id: parsed.id,
    version: parsed.version,
    title: parsed.title,
    subjectId: input.input.subjectId,
    documentId: input.input.documentId ?? null,
    knowledgeUnitId: input.input.knowledgeUnit.id,
    questions: parsed.questions,
  };
  const knownSourceChunkIds = new Set(input.chunks.map((chunk) => chunk.id));

  if (exercise.questions.length !== input.input.questionCount) {
    throw new RichClosedQuestionGenerationError(
      RICH_CLOSED_GENERATION_CONTRACT_INVALID,
      buildRichClosedGenerationDiagnostic({
        exercise,
        expectedQuestionCount: input.input.questionCount,
        expectedQuestionTypeMix: input.questionTypeMix,
        failureType: 'count',
      }),
    );
  }

  const validation = validateRichClosedExercise(exercise, {
    knownSourceChunkIds,
  });

  if (!validation.accepted) {
    const sourceIssue = hasSourceIssue(validation.issues);

    throw new RichClosedQuestionGenerationError(
      sourceIssue
        ? RICH_CLOSED_GENERATION_SOURCE_INVALID
        : RICH_CLOSED_GENERATION_CONTRACT_INVALID,
      buildRichClosedGenerationDiagnostic({
        exercise,
        expectedQuestionCount: input.input.questionCount,
        expectedQuestionTypeMix: input.questionTypeMix,
        failureType: sourceIssue ? 'source' : 'contract',
        validationIssues: validation.issues,
      }),
    );
  }

  const quality = evaluateRichClosedExerciseQuality(exercise, {
    knownSourceChunkIds,
  });

  if (!quality.accepted) {
    const sourceIssue = hasSourceIssue(quality.issues);

    throw new RichClosedQuestionGenerationError(
      sourceIssue
        ? RICH_CLOSED_GENERATION_SOURCE_INVALID
        : RICH_CLOSED_GENERATION_QUALITY_REJECTED,
      buildRichClosedGenerationDiagnostic({
        exercise,
        expectedQuestionCount: input.input.questionCount,
        expectedQuestionTypeMix: input.questionTypeMix,
        failureType: sourceIssue ? 'source' : 'quality',
        qualityIssues: quality.issues,
      }),
    );
  }

  if (!matchesQuestionTypeMix(exercise, input.questionTypeMix)) {
    throw new RichClosedQuestionGenerationError(
      RICH_CLOSED_GENERATION_CONTRACT_INVALID,
      buildRichClosedGenerationDiagnostic({
        exercise,
        expectedQuestionCount: input.input.questionCount,
        expectedQuestionTypeMix: input.questionTypeMix,
        failureType: 'mix',
      }),
    );
  }

  return {
    ...exercise,
    metadata: {
      flowName: RICH_CLOSED_FLOW_NAME,
      provider: input.metadata.provider,
      model: input.metadata.model,
      promptVersion: RICH_CLOSED_PROMPT_VERSION,
      schemaVersion: RICH_CLOSED_SCHEMA_VERSION,
      inputSize: input.inputSize,
    },
  };
}

function parseRichClosedGenerationOutput(output: unknown): RichClosedExercise {
  if (output === undefined || output === null) {
    throw new RichClosedQuestionGenerationError(
      RICH_CLOSED_GENERATION_SCHEMA_INVALID,
      { failureType: 'schema', actualQuestionCount: null },
    );
  }

  try {
    return GeneratedRichClosedExerciseSchema.parse(
      output,
    ) as RichClosedExercise;
  } catch (error) {
    throw new RichClosedQuestionGenerationError(
      RICH_CLOSED_GENERATION_SCHEMA_INVALID,
      buildSchemaGenerationDiagnostic(error),
    );
  }
}

function hasSourceIssue(issues: RichClosedExerciseValidationIssue[]): boolean {
  return issues.some((issue) => issue.code.includes('SOURCE'));
}

function matchesQuestionTypeMix(
  exercise: RichClosedExercise,
  questionTypeMix: Record<RichClosedQuestionKind, number>,
): boolean {
  const actualCounts = countQuestionTypeMix(exercise);

  return RICH_CLOSED_QUESTION_KINDS.every(
    (kind) => actualCounts[kind] === questionTypeMix[kind],
  );
}

function countQuestionTypeMix(
  exercise: RichClosedExercise,
): Record<RichClosedQuestionKind, number> {
  const actualCounts = Object.fromEntries(
    RICH_CLOSED_QUESTION_KINDS.map((kind) => [kind, 0]),
  ) as Record<RichClosedQuestionKind, number>;

  for (const question of exercise.questions) {
    actualCounts[question.questionKind] += 1;
  }

  return actualCounts;
}

function resolveRequestedQuestionTypeMix(
  input: RichClosedQuestionGenerationInput,
): Record<RichClosedQuestionKind, number> {
  const fallbackMix = resolveRichClosedQuestionTypeMix({
    questionCount: input.questionCount,
    complexityProfile: input.complexityProfile,
  });
  const requestedEntries = Object.entries(input.questionTypeMix);

  if (requestedEntries.length === 0) {
    return fallbackMix;
  }

  const mix = { ...fallbackMix };
  for (const kind of RICH_CLOSED_QUESTION_KINDS) {
    mix[kind] = input.questionTypeMix[kind] ?? 0;
  }

  if (
    Object.values(mix).some((count) => !Number.isInteger(count) || count < 0) ||
    Object.values(mix).reduce((total, count) => total + count, 0) !==
      input.questionCount
  ) {
    throw new RichClosedQuestionGenerationError(
      RICH_CLOSED_GENERATION_CONTRACT_INVALID,
    );
  }

  return mix;
}

function buildRichClosedPrompt(input: {
  input: RichClosedQuestionGenerationInput;
  chunks: RichClosedPromptChunk[];
  questionTypeMix: Record<RichClosedQuestionKind, number>;
}): string {
  return [
    'Tu es un tuteur universitaire qui génère un exercice de questions fermées riches en français.',
    `Tu dois générer un exercice rich closed ${RICH_CLOSED_EXERCISE_VERSION}.`,
    'Tu dois respecter exactement les questionKind demandés.',
    'Tu dois respecter questionTypeMix.',
    `questionTypeMix: ${JSON.stringify(input.questionTypeMix)}`,
    'Tu dois produire uniquement les types rich closed autorisés: single_choice, multiple_choice, matching, ordering, case_qualification, error_detection, timeline, date_slider, true_false_grid, cause_consequence, institution_matrix, diagram_labeling, calculation_mcq, image_choice.',
    'timeline, date_slider, true_false_grid et cause_consequence sont des types V1-B fermés: ils ne doivent jamais demander une réponse libre.',
    'institution_matrix, diagram_labeling et calculation_mcq sont des types V1-C fermés: ils ne doivent jamais demander une réponse libre.',
    'image_choice est un type V1-D fermé: il doit choisir une image dans le catalogue contrôlé, sans réponse libre.',
    'Tu dois produire des questions fermées.',
    'Tu dois interdire toute réponse libre.',
    'Tu dois utiliser les chunks fournis comme seule source de vérité.',
    'Tu dois référencer uniquement des sourceChunkIds existants.',
    'Tu dois inclure au moins une source par question quand des chunks existent.',
    'Tu dois produire des distracteurs plausibles mais non ambigus.',
    'Tu dois produire case_qualification avec un cas court et qualifiable.',
    'Tu dois produire error_detection avec une erreur dominante unique.',
    'Tu dois produire matching avec au moins 3 paires univoques.',
    'Tu dois produire ordering avec au moins 3 items et un ordre complet.',
    'Tu dois produire timeline avec 3 à 6 events, des ids uniques, et un correctOrder complet.',
    'Tu dois produire date_slider avec des années entières, minYear < maxYear, step >= 1, correctYear dans les bornes et toleranceYears >= 0.',
    'Tu dois produire true_false_grid avec 3 à 8 rows, des ids uniques, et un correctValues booléen complet.',
    'Tu dois produire cause_consequence avec 3 à 6 causes/consequences, des ids uniques, et des correctPairs univoques.',
    'Tu dois produire institution_matrix avec 2 à 5 rows, 2 à 5 columns, 3 à 12 cells idéalement, des options fermées par cellule, et sans matrice encyclopédique.',
    'Tu dois produire diagram_labeling avec un diagramme sémantique simple: 2 à 8 nodes, 0 à 12 edges, 2 à 8 slots, 2 à 6 options fermées par slot, et des slots ancrés à des nodes ou edges existants.',
    'Tu dois produire calculation_mcq uniquement avec les modes absolute_majority_threshold ou largest_remainder_target_party_seats, des petits nombres lisibles, des choices à value uniques, une seule choice dont value correspond au calcul, et sans égalité de reste ambiguë.',
    'Pour calculation_mcq, le backend recalculera expectedValue: correctChoiceId doit pointer vers la choice dont value correspond au résultat déterministe.',
    'Tu dois produire image_choice uniquement avec imageAssetId issus du catalogue image contrôlé, des choices fermées, un altText exactement égal au publicAltText du catalogue, un correctChoiceId privé, et sans URL, image générée, base64, blob, storagePath, semanticLabel ni widget.',
    'Pour image_choice, label et caption sont publics et ne doivent jamais contenir ni recopier le semanticLabel: utilise des labels neutres comme “Image A”, “Image B”, et des captions non révélatrices.',
    `Catalogue image contrôlé V1-D: ${formatImageAssetCatalogForPrompt()}`,
    'Tu ne dois jamais produire de formule libre, expression, rawFormula, calculationCode, eval, Function, JavaScript, Python, D’Hondt, Sainte-Laguë, plus forte moyenne, seuil électoral, votes blancs ou votes nuls.',
    'Tu dois produire multiple_choice avec au moins 2 bonnes réponses.',
    'Tu dois éviter les questions de pure restitution.',
    'Tu dois éviter les prompts commençant par “Qui”, “Quand”, “Quelle date”, “Quelle est la définition”, sauf nécessité exceptionnelle.',
    'Tu dois produire des explications privées de correction.',
    'Les corrections privées correctChoiceId, correctChoiceIds, correctPairs, correctOrder, correctValues, correctErrorId et correctYear ne doivent jamais être exposées dans un payload public pré-submit.',
    'Tu ne dois jamais inclure de semanticLabel ni answerHint dans une question générée.',
    'Tu ne dois jamais inclure de modelAnswer, answerText, freeTextAnswer, textAnswer, HTML, SVG, Mermaid, markdown rendu libre, widget libre, renderPayload, imageUrl, assetUrl, url, remoteUrl, src, href, storagePath, bucketPath, cdnUrl, base64, dataUri, blob, rawImage, assetPath, canvas, code, formula, expression, rawFormula, calculationCode, script ou markup.',
    'Tu ne dois jamais produire de widget libre.',
    'Tu ne dois jamais produire un diagramme sous forme de code, balisage, HTML, SVG, Mermaid, Canvas, image URL ou widget libre.',
    'Tu ne dois jamais produire true_false, fill_blank_dropdown, widget libre, ni aucun type V1-023 ou suivant.',
    'Types V1-023+ interdits: fill_blank_dropdown.',
    'Tu dois retourner un JSON object only: un objet JSON brut, sans Markdown, sans code fences, sans texte avant ou après.',
    'Aucun champ additionnel n’est autorisé.',
    `cognitiveSkill autorisés: ${RICH_CLOSED_COGNITIVE_SKILLS.join(', ')}`,
    'Clés communes exactes par question: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds.',
    'Clés exactes single_choice: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, choices, correctChoiceId, explanation.',
    'Clés exactes multiple_choice: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, choices, minSelections, maxSelections, correctChoiceIds, explanation.',
    'Clés exactes matching: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, leftItems, rightItems, correctPairs, explanation.',
    'Clés exactes ordering: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, items, correctOrder, explanation.',
    'Clés exactes timeline: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, events, correctOrder, explanation.',
    'Clés exactes date_slider: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, minYear, maxYear, step, correctYear, toleranceYears, explanation.',
    'Clés exactes true_false_grid: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, rows, correctValues, explanation.',
    'Clés exactes cause_consequence: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, causes, consequences, correctPairs, explanation.',
    'Clés exactes institution_matrix: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, rows, columns, cells, correctValues, explanation.',
    'Clés exactes diagram_labeling: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, diagram, slots, correctValues, explanation.',
    'Clés exactes calculation_mcq: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, scenario, calculation, choices, correctChoiceId, explanation.',
    'Clés exactes image_choice: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, instruction optionnel, choices, correctChoiceId, explanation. Chaque choice contient seulement id, label, imageAssetId, altText, caption optionnel, creditLabel optionnel, license optionnel.',
    'Clés exactes calculation absolute_majority_threshold: mode, validVotes.',
    'Clés exactes calculation largest_remainder_target_party_seats: mode, totalSeats, targetPartyId, parties; chaque party a id, label, votes.',
    'Clés exactes case_qualification: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, caseText, choices, correctChoiceId, explanation.',
    'Clés exactes error_detection: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, statement, errorOptions, correctErrorId, explanation.',
    'Tu dois retourner uniquement du JSON strict conforme au schema demandé.',
    `Prompt version: ${RICH_CLOSED_PROMPT_VERSION}.`,
    `Schema version: ${RICH_CLOSED_SCHEMA_VERSION}.`,
    `Question count: ${input.input.questionCount}.`,
    `Complexity profile: ${input.input.complexityProfile}.`,
    `Titre de la notion: ${input.input.knowledgeUnit.title}`,
    `Résumé de la notion: ${input.input.knowledgeUnit.summary}`,
    JSON.stringify(toPromptPayload(input.input, input.chunks)),
  ].join('\n\n');
}

function buildRichClosedRepairPrompt(input: {
  input: RichClosedQuestionGenerationInput;
  chunks: RichClosedPromptChunk[];
  questionTypeMix: Record<RichClosedQuestionKind, number>;
  previousDiagnostic?: RichClosedGenerationDiagnostic;
}): string {
  return [
    'Tentative de réparation stricte de génération rich closed.',
    'La tentative précédente a été rejetée avant toute utilisation.',
    'Tu dois corriger uniquement la structure de sortie, sans inventer de source et sans relâcher le contrat.',
    `Diagnostic metadata-only précédent: ${JSON.stringify(input.previousDiagnostic ?? {})}`,
    'Rappels de structure par type:',
    '- single_choice: choices, correctChoiceId, explanation.',
    '- multiple_choice: choices, minSelections, maxSelections, correctChoiceIds, explanation.',
    '- matching: leftItems, rightItems, correctPairs, explanation.',
    '- ordering: items, correctOrder, explanation.',
    '- timeline: events (3 à 6), correctOrder complet, explanation.',
    '- date_slider: minYear, maxYear, step, correctYear, toleranceYears, explanation.',
    '- true_false_grid: rows (3 à 8), correctValues booléens complets, explanation.',
    '- cause_consequence: causes, consequences, correctPairs univoques, explanation.',
    '- institution_matrix: rows (2 à 5), columns (2 à 5), cells (3 à 12 idéalement), options fermées par cellule, correctValues complets, explanation.',
    '- diagram_labeling: diagram sémantique (2 à 8 nodes, 0 à 12 edges), slots (2 à 8) ancrés à des nodes/edges existants, options fermées par slot, correctValues complets, explanation, sans HTML/SVG/Mermaid/widget.',
    '- calculation_mcq: scenario, calculation en mode absolute_majority_threshold ou largest_remainder_target_party_seats, choices avec value uniques, correctChoiceId, explanation, sans formule libre, sans D’Hondt, sans code.',
    '- image_choice: choices (2 à 6) avec imageAssetId du catalogue contrôlé, altText public exact, label/caption neutres qui ne recopient pas semanticLabel, correctChoiceId, explanation, sans URL, image générée, base64, blob, storagePath, semanticLabel ni widget.',
    '- case_qualification: caseText, choices, correctChoiceId, explanation.',
    '- error_detection: statement, errorOptions, correctErrorId, explanation.',
    'Tu dois respecter le nombre exact de questions, le mix exact, et uniquement les sourceChunkIds autorisés.',
    buildRichClosedPrompt(input),
  ].join('\n\n');
}

function formatImageAssetCatalogForPrompt(): string {
  return JSON.stringify(
    RICH_CLOSED_IMAGE_ASSETS.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      semanticLabel: asset.semanticLabel,
      publicAltText: asset.publicAltText,
      creditLabel: asset.creditLabel ?? null,
      license: asset.license,
    })),
  );
}

function toPromptPayload(
  input: RichClosedQuestionGenerationInput,
  chunks: RichClosedPromptChunk[],
) {
  return {
    subjectId: input.subjectId,
    documentId: input.documentId ?? null,
    knowledgeUnit: {
      id: input.knowledgeUnit.id,
      subjectId: input.knowledgeUnit.subjectId,
      title: input.knowledgeUnit.title,
      summary: input.knowledgeUnit.summary,
      difficulty: input.knowledgeUnit.difficulty ?? null,
      sourceChunkIds: input.knowledgeUnit.sourceChunkIds ?? [],
    },
    allowedSourceChunkIds: chunks.map((chunk) => chunk.id),
    chunks: chunks.map((chunk) => ({
      id: chunk.id,
      index: chunk.index,
      pageNumber: chunk.pageNumber,
      text: chunk.text,
    })),
  };
}

function selectRichClosedChunks(
  input: RichClosedQuestionGenerationInput,
): RichClosedPromptChunk[] {
  const chunks = deduplicateChunks(input.chunks);
  const sourceChunkIds = new Set(input.knowledgeUnit.sourceChunkIds ?? []);
  const prioritizedChunks = [
    ...chunks.filter((chunk) => sourceChunkIds.has(chunk.id)),
    ...chunks.filter((chunk) => !sourceChunkIds.has(chunk.id)),
  ];
  const maxChunks = resolvePositiveInteger(
    process.env.RICH_CLOSED_GENERATION_MAX_CHUNKS,
    DEFAULT_MAX_CHUNKS,
  );
  const maxChars = resolvePositiveInteger(
    process.env.RICH_CLOSED_GENERATION_MAX_CHARS,
    DEFAULT_MAX_CHARS,
  );
  let remainingChars = maxChars;

  return prioritizedChunks.slice(0, maxChunks).flatMap((chunk) => {
    if (remainingChars <= 0) {
      return [];
    }

    const text = chunk.text.slice(0, remainingChars);
    remainingChars -= text.length;

    if (text.trim().length === 0) {
      return [];
    }

    return [{ ...chunk, text }];
  });
}

function deduplicateChunks(
  chunks: RichClosedQuestionGenerationInput['chunks'],
): RichClosedPromptChunk[] {
  const chunksById = new Map<
    string,
    RichClosedQuestionGenerationInput['chunks'][number]
  >();

  for (const chunk of chunks) {
    if (chunk.text.trim().length > 0 && !chunksById.has(chunk.id)) {
      chunksById.set(chunk.id, chunk);
    }
  }

  return [...chunksById.values()].sort(
    (left, right) => left.index - right.index,
  );
}

function buildRichClosedContextLog(input: {
  input: RichClosedQuestionGenerationInput;
  chunks: RichClosedPromptChunk[];
  metadata: ResolvedArtifactGenkitMetadata;
  inputSize: number;
  questionTypeMix: Record<RichClosedQuestionKind, number>;
}) {
  return {
    event: 'rich.closed.generation.context',
    flowName: RICH_CLOSED_FLOW_NAME,
    provider: input.metadata.provider,
    model: input.metadata.model,
    requestedQuestionCount: input.input.questionCount,
    questionTypeMix: input.questionTypeMix,
    complexityProfile: input.input.complexityProfile,
    providedChunkCount: input.input.chunks.length,
    selectedChunkCount: input.chunks.length,
    selectedChunkCharCount: input.chunks.reduce(
      (total, chunk) => total + chunk.text.length,
      0,
    ),
    inputSize: input.inputSize,
    documentId: input.input.documentId ?? undefined,
    subjectId: input.input.subjectId,
    knowledgeUnitId: input.input.knowledgeUnit.id,
    studentId: input.input.studentId,
  };
}

function buildRichClosedOutputLog(input: {
  input: RichClosedQuestionGenerationInput;
  exercise: GeneratedRichClosedExercise;
  metadata: ResolvedArtifactGenkitMetadata;
}) {
  const quality = evaluateRichClosedExerciseQuality(input.exercise);

  return {
    event: 'rich.closed.generation.output',
    flowName: RICH_CLOSED_FLOW_NAME,
    provider: input.metadata.provider,
    model: input.metadata.model,
    outputQuestionCount: input.exercise.questions.length,
    questionKindCounts: quality.metrics.questionKindCounts,
    difficultyCounts: quality.metrics.difficultyCounts,
    cognitiveSkillCounts: quality.metrics.cognitiveSkillCounts,
    sourcedQuestionCount: quality.metrics.sourcedQuestionCount,
    documentId: input.input.documentId ?? undefined,
    subjectId: input.input.subjectId,
    knowledgeUnitId: input.input.knowledgeUnit.id,
    studentId: input.input.studentId,
  };
}

function buildRichClosedErrorLog(input: {
  input: RichClosedQuestionGenerationInput;
  metadata: ResolvedArtifactGenkitMetadata;
  errorCode: string;
  diagnostic?: RichClosedGenerationDiagnostic;
}) {
  return {
    event: 'rich.closed.generation.error',
    flowName: RICH_CLOSED_FLOW_NAME,
    provider: input.metadata.provider,
    model: input.metadata.model,
    errorCode: input.errorCode,
    ...(input.diagnostic === undefined ? {} : { diagnostic: input.diagnostic }),
    documentId: input.input.documentId ?? undefined,
    subjectId: input.input.subjectId,
    knowledgeUnitId: input.input.knowledgeUnit.id,
    studentId: input.input.studentId,
  };
}

function resolvePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function toRichClosedGenerationError(
  error: unknown,
): RichClosedQuestionGenerationError {
  if (error instanceof RichClosedQuestionGenerationError) {
    return error;
  }

  if (
    error instanceof Error &&
    error.message === RICH_CLOSED_QUESTION_COUNT_INVALID
  ) {
    return new RichClosedQuestionGenerationError(
      RICH_CLOSED_GENERATION_CONTRACT_INVALID,
      { failureType: 'count' },
    );
  }

  if (
    error instanceof Error &&
    (error.name === 'ZodError' ||
      error.message.toLowerCase().includes('schema') ||
      error.message.toLowerCase().includes('json') ||
      error.message.toLowerCase().includes('output'))
  ) {
    return new RichClosedQuestionGenerationError(
      RICH_CLOSED_GENERATION_SCHEMA_INVALID,
      buildSchemaGenerationDiagnostic(error),
    );
  }

  return new RichClosedQuestionGenerationError(RICH_CLOSED_GENERATION_FAILED);
}

function buildRichClosedGenerationDiagnostic(input: {
  exercise: RichClosedExercise;
  expectedQuestionCount: number;
  expectedQuestionTypeMix: Record<RichClosedQuestionKind, number>;
  failureType: RichClosedGenerationFailureType;
  validationIssues?: RichClosedExerciseValidationIssue[];
  qualityIssues?: RichClosedExerciseValidationIssue[];
}): RichClosedGenerationDiagnostic {
  return {
    failureType: input.failureType,
    expectedQuestionCount: input.expectedQuestionCount,
    actualQuestionCount: input.exercise.questions.length,
    expectedQuestionTypeMix: input.expectedQuestionTypeMix,
    actualQuestionTypeMix: countQuestionTypeMix(input.exercise),
    ...(input.validationIssues === undefined
      ? {}
      : { validationIssues: toDiagnosticIssues(input.validationIssues) }),
    ...(input.qualityIssues === undefined
      ? {}
      : { qualityIssues: toDiagnosticIssues(input.qualityIssues) }),
    questionIds: input.exercise.questions.map((question) => question.id),
    questionKinds: input.exercise.questions.map(
      (question) => question.questionKind,
    ),
    sourceChunkIds: Array.from(
      new Set(
        input.exercise.questions.flatMap((question) => question.sourceChunkIds),
      ),
    ),
  };
}

function buildSchemaGenerationDiagnostic(
  error: unknown,
): RichClosedGenerationDiagnostic {
  const schemaIssues = findSchemaIssues(error);
  const errorName = error instanceof Error ? error.name : typeof error;
  const messagePreview =
    error instanceof Error ? scrubSchemaErrorMessage(error.message) : undefined;

  return {
    failureType: 'schema',
    schemaErrorName: errorName,
    schemaIssueCount: schemaIssues.length,
    ...(messagePreview === undefined
      ? {}
      : { schemaErrorMessagePreview: messagePreview }),
    ...(schemaIssues.length === 0 ? {} : { validationIssues: schemaIssues }),
  };
}

function findSchemaIssues(
  error: unknown,
): RichClosedGenerationDiagnosticIssue[] {
  const seen = new Set<unknown>();
  const pending: unknown[] = [error];

  while (pending.length > 0) {
    const current = pending.shift();

    if (current === null || current === undefined || seen.has(current)) {
      continue;
    }

    seen.add(current);

    if (current instanceof z.ZodError) {
      return current.issues.map(toSchemaDiagnosticIssue);
    }

    if (typeof current !== 'object') {
      continue;
    }

    const record = current as Record<string, unknown>;
    const issues = readUnknownIssues(record.issues);

    if (issues.length > 0) {
      return issues;
    }

    pending.push(record.cause, record.error, record.details);
  }

  return [];
}

function readUnknownIssues(
  issues: unknown,
): RichClosedGenerationDiagnosticIssue[] {
  if (!Array.isArray(issues)) {
    return [];
  }

  return issues.flatMap((issue) => {
    if (typeof issue !== 'object' || issue === null || Array.isArray(issue)) {
      return [];
    }

    const record = issue as Record<string, unknown>;
    const code =
      typeof record.code === 'string' && record.code.trim().length > 0
        ? record.code
        : 'schema_issue';
    const path = normalizeSchemaIssuePath(record.path);

    return [
      {
        code,
        ...(path === undefined ? {} : { path }),
        severity: 'error' as const,
      },
    ];
  });
}

function toSchemaDiagnosticIssue(
  issue: z.ZodIssue,
): RichClosedGenerationDiagnosticIssue {
  return {
    code: issue.code,
    path: issue.path.join('.'),
    severity: 'error',
  };
}

function normalizeSchemaIssuePath(path: unknown): string | undefined {
  if (Array.isArray(path)) {
    return path.map(String).join('.');
  }

  if (typeof path === 'string' && path.trim().length > 0) {
    return path;
  }

  return undefined;
}

function scrubSchemaErrorMessage(message: string): string | undefined {
  const scrubbed = redactKnownSensitiveFragments(message)
    .replace(/SENTINEL_[A-Z0-9_]+/g, '[redacted-sentinel]')
    .replace(/\s+/g, ' ')
    .trim();

  if (scrubbed.length === 0) {
    return undefined;
  }

  return scrubbed.slice(0, 220);
}

function redactKnownSensitiveFragments(value: string): string {
  const secretValues = [
    process.env.MISTRAL_API_KEY,
    process.env.DATABASE_URL,
    process.env.REDIS_URL,
    process.env.FIREBASE_PRIVATE_KEY,
  ].filter(
    (secret): secret is string =>
      typeof secret === 'string' && secret.trim().length > 0,
  );

  return secretValues.reduce(
    (scrubbed, secret) => scrubbed.split(secret).join('[redacted-secret]'),
    value,
  );
}

function toDiagnosticIssues(
  issues: RichClosedExerciseValidationIssue[],
): RichClosedGenerationDiagnosticIssue[] {
  return issues.map((issue) => ({
    code: issue.code,
    ...(issue.path === undefined ? {} : { path: issue.path }),
    severity: issue.severity,
  }));
}
