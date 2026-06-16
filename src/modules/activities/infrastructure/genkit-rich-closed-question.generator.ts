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

export const RICH_CLOSED_FLOW_NAME = 'richClosedQuestionGeneration';
export const RICH_CLOSED_PROMPT_VERSION = 'rich-closed-v1a-001';
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
    'Tu dois produire uniquement les types V1-A: single_choice, multiple_choice, matching, ordering, case_qualification, error_detection.',
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
    'Tu dois produire multiple_choice avec au moins 2 bonnes réponses.',
    'Tu dois éviter les questions de pure restitution.',
    'Tu dois éviter les prompts commençant par “Qui”, “Quand”, “Quelle date”, “Quelle est la définition”, sauf nécessité exceptionnelle.',
    'Tu dois produire des explications privées de correction.',
    'Tu ne dois jamais inclure de modelAnswer, answerText, freeTextAnswer, textAnswer, HTML, SVG, Mermaid, markdown rendu libre ou widget libre.',
    'Tu ne dois jamais produire de widget libre.',
    'Tu ne dois jamais produire true_false, true_false_grid, timeline, date_slider, image_choice, diagram_labeling, institution_matrix, cause_consequence, calculation_mcq ou fill_blank_dropdown.',
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
    '- case_qualification: caseText, choices, correctChoiceId, explanation.',
    '- error_detection: statement, errorOptions, correctErrorId, explanation.',
    'Tu dois respecter le nombre exact de questions, le mix exact, et uniquement les sourceChunkIds autorisés.',
    buildRichClosedPrompt(input),
  ].join('\n\n');
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
      { failureType: 'schema' },
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
  const zodIssues =
    error instanceof z.ZodError
      ? error.issues.map((issue) => ({
          code: issue.code,
          path: issue.path.join('.'),
          severity: 'error' as const,
        }))
      : undefined;

  return {
    failureType: 'schema',
    ...(zodIssues === undefined ? {} : { validationIssues: zodIssues }),
  };
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
