# LOT V1-012C — Backend diagnostics génération rich closed

## 1. Résultat

Le lot V1-012C est réalisé côté backend API. La génération rich closed conserve le contrat strict, mais les rejets `RICH_CLOSED_GENERATION_CONTRACT_INVALID`, `RICH_CLOSED_GENERATION_SCHEMA_INVALID`, `RICH_CLOSED_GENERATION_QUALITY_REJECTED` et `RICH_CLOSED_GENERATION_SOURCE_INVALID` sont maintenant diagnostiquables via un log metadata-only.

Le générateur ajoute aussi une tentative de récupération bornée quand un modèle fallback Mistral est configuré : la deuxième tentative utilise un prompt de réparation strict, enrichi par le diagnostic metadata-only de la première tentative. Aucun fallback de démonstration déterministe n'a été ajouté.

## 2. Sources inspectées

- `api/src/modules/activities/infrastructure/genkit-rich-closed-question.generator.ts`
- `api/src/modules/activities/infrastructure/genkit-rich-closed-question.generator.spec.ts`
- `api/src/modules/activities/application/rich-closed-questions/rich-closed-question.validator.ts`
- `api/src/modules/activities/application/rich-closed-questions/rich-closed-question-quality-gate.ts`
- `api/src/modules/activities/application/rich-closed-questions/rich-closed-question-generation-profile.ts`
- `api/src/modules/activities/application/rich-closed-questions/start-rich-closed-exercise.use-case.ts`
- `api/src/modules/activities/interfaces/activities.controller.ts`
- `api/src/modules/activities/application/rich-closed-questions/rich-closed-question.fixtures.ts`
- `api/src/modules/activities/application/rich-closed-questions/rich-closed-question-errors.ts`
- `api/src/modules/ai/application/ai-generation-observer.ts`
- `api/src/modules/ai/infrastructure/document-artifact-genkit-config.ts`
- `api/src/modules/ai/infrastructure/mistral-model-fallback.ts`
- specs rich closed et activities listées par `rg`.

## 3. Préflight Git

Repo API : `/Users/karim/Project/app-révision/api`

Branche : `main`

Statut initial :

```text
## main...origin/main
```

Derniers commits initiaux :

```text
88dcecd RAPPORT-123: Corrections et améliorations des cas d'usage et scoreur pour les questions fermées riches
630cea5 RAPPORT-123: Intégration complète des questions fermées riches avec cas d'usage et persistance
0eafeb2 RAPPORT-123: Ajout des générateurs de questions fermées riches et profils associés
206905b #37-2: corrige et améliore la gestion des questions fermées enrichies
8c402a7 #37-1: ajoute gestion des questions fermées enrichies
```

Note de périmètre documentaire : le prompt interdit toute modification de `revision_app/`. Le plan et le rapport V1-012C ont donc été créés sous `api/docs/v1/` plutôt que dans le plan V1 frontend existant.

## 4. Problème observé

Le flow runtime frontend V1-012B appelle correctement `/activities/rich-closed/start`, mais le backend peut rejeter la génération avec :

```text
RICH_CLOSED_GENERATION_CONTRACT_INVALID
```

Le log observé côté produit contenait déjà `flowName`, `provider`, `model`, `promptVersion`, `schemaVersion`, `status` et `errorCode`, mais pas la cause exploitable du rejet.

## 5. Cause technique identifiée

Les causes possibles étaient déjà différenciées dans le code, mais l'information détaillée était perdue au moment du `throw` :

- `schema` : sortie Genkit absente, non JSON conforme au schema Zod strict, type hors V1-A, champ inconnu comme `feedback` dans un choix.
- `count` : nombre de questions générées différent de `questionCount`.
- `mix` : mix réel des `questionKind` différent du `questionTypeMix` attendu.
- `contract` : validation applicative échouée, par exemple `cognitiveSkill` invalide ou bornes `multiple_choice` incohérentes.
- `quality` : quality gate pédagogique rejetée, par exemple 100 % `single_choice`, manque de cas, manque d'`error_detection`, manque d'interaction structurante.
- `source` : `sourceChunkIds` inconnus, dupliqués ou incohérents avec les chunks autorisés.

## 6. Architecture retenue

- `RichClosedQuestionGenerationError` porte désormais un diagnostic interne optionnel.
- `normalizeGeneratedRichClosedExercise` construit ce diagnostic au point exact du rejet.
- Les logs d'erreur incluent `diagnostic`, mais uniquement avec des métadonnées : counts, mix, ids, kinds, sourceChunkIds techniques, codes et paths d'issues.
- L'observer IA reste metadata-only et n'est pas enrichi avec du contenu de prompt ou de chunk.
- La tentative fallback Mistral réutilise le même schema strict, les mêmes validators et les mêmes quality gates.
- La deuxième tentative reçoit un prompt de réparation strict si, et seulement si, un modèle fallback est configuré et que l'erreur est une sortie IA invalide contrôlée.

## 7. Diagnostics ajoutés

Le diagnostic interne peut exposer :

- `failureType` : `schema`, `count`, `mix`, `contract`, `quality` ou `source`.
- `expectedQuestionCount` / `actualQuestionCount`.
- `expectedQuestionTypeMix` / `actualQuestionTypeMix`.
- `validationIssues` avec `code`, `path`, `severity`.
- `qualityIssues` avec `code`, `path`, `severity`.
- `questionIds`.
- `questionKinds`.
- `sourceChunkIds` techniques uniquement.

Aucun texte complet de chunk, aucun prompt complet et aucune clé API ne sont loggés.

## 8. Retry/fallback ajouté ou non ajouté

Ajouté : retry borné via modèle fallback Mistral déjà prévu par l'architecture (`MISTRAL_RICH_CLOSED_FALLBACK_MODEL` ou fallback global). La tentative fallback utilise un prompt de réparation strict qui rappelle le count, le mix, les types V1-A et les structures par type.

Non ajouté : fallback démo déterministe via `RICH_CLOSED_GENERATION_DEMO_FALLBACK=true`. Décision volontaire : ce fallback risquait d'inventer des questions ou de produire une démo trompeuse. Le lot privilégie un diagnostic fiable et un retry strict plutôt qu'un exercice artificiel silencieux.

## 9. Sécurité logs / metadata-only

Les tests vérifient que les logs et observations ne contiennent pas :

- `SENTINEL_FULL_CHUNK_TEXT` ;
- `test-mistral-key` ;
- payload complet généré ;
- prompt complet ;
- texte source complet.

Le payload public pré-submit n'est pas modifié. Les corrections restent internes jusqu'au post-submit.

## 10. Tests ajoutés

Ajouts dans `genkit-rich-closed-question.generator.spec.ts` :

- diagnostic count mismatch avec count attendu/reçu et mix attendu/reçu ;
- diagnostic mix mismatch avec mix attendu/reçu ;
- diagnostic de validation avec code/path `RICH_CLOSED_COGNITIVE_SKILL_INVALID` ;
- diagnostic quality gate avec codes d'issues ;
- diagnostic source invalid avec path `questions.0.sourceChunkIds` ;
- retry avec prompt de réparation strict quand modèle fallback configuré ;
- erreur finale contrôlée quand le fallback échoue aussi ;
- assertions anti-fuite sur chunk sentinelle et clé API factice.

## 11. Validations lancées avec résultats

```bash
cd api
npm test -- genkit-rich-closed-question.generator --runInBand
```

Résultat : OK, 1 suite passée, 15 tests passés.

```bash
cd api
npm test -- rich-closed --runInBand
```

Résultat : OK, 8 suites passées, 90 tests passés.

```bash
cd api
npm test -- activities --runInBand
```

Résultat : OK, 17 suites passées, 1 suite skip existante, 187 tests passés, 1 test skip existant.

```bash
cd api
npm run lint:check
```

Résultat : OK.

```bash
cd api
npm run build
```

Résultat : OK.

```bash
cd api
git diff --check
```

Résultat : OK.

## 12. Validations non lancées avec justification

- Aucun test frontend : interdit par le prompt et aucun fichier `revision_app/` modifié.
- Aucun provider IA réel : interdit par le prompt ; les tests mockent Genkit.
- Aucun seed réel : hors périmètre et interdit.
- Aucune migration Prisma : hors périmètre et non nécessaire.
- `npm run lint` non lancé : interdit car applique `--fix`.
- `npm run format` non lancé : interdit.
- `npm run test:cov` non lancé : interdit.

## 13. Risques restants

- Le retry fallback dépend de la présence d'un modèle fallback Mistral configuré ; sans fallback, le backend échoue toujours strictement mais avec diagnostic.
- Le diagnostic rend la cause exploitable mais ne garantit pas qu'un provider réel respectera le mix exact à la tentative suivante.
- Le run n'a pas appelé de provider réel ; un rejeu staging contrôlé reste nécessaire pour mesurer le comportement de Mistral en conditions réelles.
- Le plan V1 principal côté `revision_app` n'a pas été modifié, car ce lot interdisait explicitement toute modification de `revision_app/`.

## 14. Recommandation prochain lot

Recommandation : rejouer `/activities/rich-closed/start` sur une DB locale/staging avec un vrai provider et un modèle fallback configuré, puis poursuivre vers `V1-013 — Today integration V1` si le taux de succès runtime est acceptable.

Si les diagnostics montrent encore des rejets fréquents de mix/count, prévoir un micro-lot de prompt tuning ou de génération en deux phases avant Today.

## 15. Passes de review

- Generator : diagnostics ajoutés au point de rejet, pas après coup.
- Validators : règles conservées, aucune détente globale.
- Quality gate : conservée et désormais diagnostiquée.
- Logging : metadata-only, pas de texte complet de chunk, pas de prompt complet, pas de secret.
- Retry/fallback : borné au fallback model déjà prévu, pas de fallback démo trompeur.
- Tests : mocks Genkit, aucun provider réel, assertions anti-fuite.
- Sécurité : aucune correction pré-submit exposée, aucun endpoint public modifié.

## 16. Critique honnête du prompt initial

Le prompt était précis sur le problème runtime et les garde-fous. La seule ambiguïté réelle concerne la documentation : il demandait `docs/v1/...` tout en interdisant toute modification de `revision_app/`, alors que les rapports V1 précédents sont côté app. L'option la plus sûre a été de créer `api/docs/v1/...` et de documenter explicitement ce choix.

Le fallback démo était volontairement optionnel ; ne pas l'ajouter est cohérent avec la phrase “je préfère un diagnostic propre sans fallback plutôt qu'un fallback dégueulasse”.

## 17. Contenu complet des fichiers créés/modifiés/supprimés

### `src/modules/activities/infrastructure/genkit-rich-closed-question.generator.ts`

```ts
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

```
### `src/modules/activities/infrastructure/genkit-rich-closed-question.generator.spec.ts`

```ts
type GenerateInput = {
  prompt: string;
  output: {
    schema: unknown;
  };
};

type GenkitInput = {
  plugins: unknown[];
  model: string;
};

type OpenAICompatibleInput = {
  name: string;
  apiKey?: string;
  baseURL?: string;
};

const mockMistralPlugin = { name: 'mistral-plugin' };
const mockGooglePlugin = { name: 'google-plugin' };
const mockGenerate = jest.fn<Promise<{ output?: unknown }>, [GenerateInput]>();
const mockGenkit = jest.fn<{ generate: typeof mockGenerate }, [GenkitInput]>(
  () => ({ generate: mockGenerate }),
);
const mockOpenAICompatible = jest.fn<unknown, [OpenAICompatibleInput]>(
  () => mockMistralPlugin,
);
const mockGoogleAI = jest.fn<unknown, []>(() => mockGooglePlugin);

jest.mock('genkit', () => ({
  ...jest.requireActual<typeof import('genkit')>('genkit'),
  genkit: mockGenkit,
}));

jest.mock('@genkit-ai/compat-oai', () => ({
  __esModule: true,
  default: mockOpenAICompatible,
  openAICompatible: mockOpenAICompatible,
}));

jest.mock('@genkit-ai/google-genai', () => ({
  googleAI: mockGoogleAI,
}));

import { Logger } from '@nestjs/common';
import {
  GenkitRichClosedQuestionGenerator,
  RICH_CLOSED_GENERATION_CONTRACT_INVALID,
  RICH_CLOSED_GENERATION_QUALITY_REJECTED,
  RICH_CLOSED_GENERATION_SCHEMA_INVALID,
  RICH_CLOSED_GENERATION_SOURCE_INVALID,
  RICH_CLOSED_PROMPT_VERSION,
} from './genkit-rich-closed-question.generator';
import {
  richClosedExerciseFixture,
  richClosedQuestionFixture,
} from '../application/rich-closed-questions/rich-closed-question.fixtures';
import type {
  AiGenerationObservation,
  AiGenerationObserver,
} from '../../ai/application/ai-generation-observer';
import type { RichClosedExercise } from '../application/rich-closed-questions/rich-closed-question.types';

describe('GenkitRichClosedQuestionGenerator', () => {
  const originalAiProvider = process.env.AI_PROVIDER;
  const originalMistralApiKey = process.env.MISTRAL_API_KEY;
  const originalMistralModel = process.env.MISTRAL_MODEL;
  const originalMistralFallbackModel = process.env.MISTRAL_FALLBACK_MODEL;
  const originalMistralRichClosedFallbackModel =
    process.env.MISTRAL_RICH_CLOSED_FALLBACK_MODEL;
  const originalGenkitModel = process.env.GENKIT_MODEL;
  const originalMaxChunks = process.env.RICH_CLOSED_GENERATION_MAX_CHUNKS;
  const originalMaxChars = process.env.RICH_CLOSED_GENERATION_MAX_CHARS;
  let loggerLogSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerLogSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    loggerWarnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    restoreEnv('AI_PROVIDER', originalAiProvider);
    restoreEnv('MISTRAL_API_KEY', originalMistralApiKey);
    restoreEnv('MISTRAL_MODEL', originalMistralModel);
    restoreEnv('MISTRAL_FALLBACK_MODEL', originalMistralFallbackModel);
    restoreEnv(
      'MISTRAL_RICH_CLOSED_FALLBACK_MODEL',
      originalMistralRichClosedFallbackModel,
    );
    restoreEnv('GENKIT_MODEL', originalGenkitModel);
    restoreEnv('RICH_CLOSED_GENERATION_MAX_CHUNKS', originalMaxChunks);
    restoreEnv('RICH_CLOSED_GENERATION_MAX_CHARS', originalMaxChars);
    mockOpenAICompatible.mockClear();
    mockGoogleAI.mockClear();
    mockGenkit.mockClear();
    mockGenerate.mockReset();
    loggerLogSpy.mockRestore();
    loggerWarnSpy.mockRestore();
  });

  it('does not initialize Genkit when imported or constructed', () => {
    new GenkitRichClosedQuestionGenerator();

    expect(mockOpenAICompatible).not.toHaveBeenCalled();
    expect(mockGoogleAI).not.toHaveBeenCalled();
    expect(mockGenkit).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('generates a validated V1-A rich closed exercise with metadata only observations', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    mockGenerate.mockResolvedValue({ output: generatedExercise() });
    const observer = createObserver();

    const exercise = await new GenkitRichClosedQuestionGenerator(
      observer,
    ).generate(generationInput());

    expect(mockOpenAICompatible).toHaveBeenCalledWith({
      name: 'mistral',
      apiKey: 'test-mistral-key',
      baseURL: 'https://api.mistral.ai/v1',
    });
    expect(mockGenkit).toHaveBeenCalledWith({
      plugins: [mockMistralPlugin],
      model: 'mistral/mistral-small-latest',
    });
    const [generateInput] = mockGenerate.mock.calls[0] ?? [];
    expect(generateInput?.prompt).toContain('rich-closed-question-v1');
    expect(generateInput?.prompt).toContain('questionTypeMix');
    expect(generateInput?.prompt).toContain('single_choice');
    expect(generateInput?.prompt).toContain('case_qualification');
    expect(generateInput?.prompt).toContain('error_detection');
    expect(generateInput?.prompt).toContain(
      'Tu dois produire des questions fermées.',
    );
    expect(generateInput?.prompt).toContain(
      'Tu ne dois jamais inclure de modelAnswer',
    );
    expect(generateInput?.prompt).toContain(
      'Tu ne dois jamais produire de widget libre',
    );
    expect(generateInput?.output.schema).toBeDefined();
    expect(exercise).toMatchObject({
      id: 'rich-exercise-1',
      version: 'rich-closed-question-v1',
      metadata: {
        flowName: 'richClosedQuestionGeneration',
        provider: 'mistral',
        model: 'mistral/mistral-small-latest',
        promptVersion: RICH_CLOSED_PROMPT_VERSION,
        schemaVersion: 'rich-closed-question-v1',
      },
    });
    const observation = getObservedObservation(observer);
    expect(observation.status).toBe('success');
    expect(observation.flowName).toBe('richClosedQuestionGeneration');
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'SENTINEL_FULL_CHUNK_TEXT',
    );
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'test-mistral-key',
    );
  });

  it('logs metadata-only diagnostics when generated question count is wrong', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: generatedExercise().questions.slice(0, 5),
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_CONTRACT_INVALID });

    const errorLog = getLastRichClosedErrorLog(loggerWarnSpy);
    expect(errorLog.diagnostic).toMatchObject({
      failureType: 'count',
      expectedQuestionCount: 6,
      actualQuestionCount: 5,
      expectedQuestionTypeMix: {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
      },
      actualQuestionTypeMix: {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 0,
      },
    });
    expect(errorLog.diagnostic.questionKinds).toEqual([
      'single_choice',
      'multiple_choice',
      'matching',
      'ordering',
      'case_qualification',
    ]);
    expectNoSensitiveDiagnosticLog(errorLog);
  });

  it('logs metadata-only diagnostics when generated question type mix is wrong', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          {
            ...richClosedQuestionFixture('multiple_choice'),
            id: 'multiple-mix-1',
          },
          richClosedQuestionFixture('matching'),
          richClosedQuestionFixture('ordering'),
          richClosedQuestionFixture('case_qualification'),
          richClosedQuestionFixture('error_detection'),
          {
            ...richClosedQuestionFixture('case_qualification'),
            id: 'case-mix-2',
          },
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_CONTRACT_INVALID });

    const errorLog = getLastRichClosedErrorLog(loggerWarnSpy);
    expect(errorLog.diagnostic).toMatchObject({
      failureType: 'mix',
      expectedQuestionTypeMix: {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
      },
      actualQuestionTypeMix: {
        single_choice: 0,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 2,
        error_detection: 1,
      },
    });
    expectNoSensitiveDiagnosticLog(errorLog);
  });

  it('rejects output with a question kind outside V1-A', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          {
            ...richClosedQuestionFixture('single_choice'),
            questionKind: 'timeline',
          },
        ],
      },
    });
    const observer = createObserver();

    await expect(
      new GenkitRichClosedQuestionGenerator(observer).generate(
        generationInput(),
      ),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });

    expect(getObservedObservation(observer).errorCode).toBe(
      RICH_CLOSED_GENERATION_SCHEMA_INVALID,
    );
  });

  it('rejects output dominated by single_choice through the quality gate', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: Array.from({ length: 6 }, (_value, index) => ({
          ...richClosedQuestionFixture('single_choice'),
          id: `single-${index + 1}`,
          prompt: `Question de choix unique ${index + 1}`,
        })),
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_QUALITY_REJECTED });
  });

  it('rejects output containing feedback on choices', async () => {
    const exercise = generatedExercise();
    const firstQuestion = exercise.questions[0];
    if (firstQuestion.questionKind !== 'single_choice') {
      throw new Error('Fixture first question must be single_choice');
    }
    mockGenerate.mockResolvedValue({
      output: {
        ...exercise,
        questions: [
          {
            ...firstQuestion,
            choices: [
              {
                ...firstQuestion.choices[0],
                feedback: 'Feedback privé interdit dans la sortie Genkit V1-A.',
              },
              ...firstQuestion.choices.slice(1),
            ],
          },
          ...exercise.questions.slice(1),
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });
  });

  it('rejects output with unknown source chunks', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          {
            ...richClosedQuestionFixture('single_choice'),
            sourceChunkIds: ['chunk-unknown'],
          },
          ...generatedExercise().questions.slice(1),
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SOURCE_INVALID });
  });

  it('rejects output with invalid cognitiveSkill through contract validation', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          {
            ...richClosedQuestionFixture('single_choice'),
            cognitiveSkill: 'creative_writing',
          },
          ...generatedExercise().questions.slice(1),
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_CONTRACT_INVALID });

    expect(getLastRichClosedErrorLog(loggerWarnSpy).diagnostic).toMatchObject({
      failureType: 'contract',
      validationIssues: [
        {
          code: 'RICH_CLOSED_COGNITIVE_SKILL_INVALID',
          path: 'questions.0.cognitiveSkill',
        },
      ],
    });
  });

  it('rejects output with invalid multiple_choice bounds through contract validation', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          richClosedQuestionFixture('single_choice'),
          {
            ...richClosedQuestionFixture('multiple_choice'),
            minSelections: 1,
            maxSelections: 1,
            correctChoiceIds: ['choice-a', 'choice-b'],
          },
          ...generatedExercise().questions.slice(2),
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_CONTRACT_INVALID });
  });

  it('logs quality gate issue codes when quality rejects the generation', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: Array.from({ length: 6 }, (_value, index) => ({
          ...richClosedQuestionFixture('single_choice'),
          id: `single-quality-${index + 1}`,
          prompt: `Question de choix unique ${index + 1}`,
        })),
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_QUALITY_REJECTED });

    const errorLog = getLastRichClosedErrorLog(loggerWarnSpy);
    const diagnostic = errorLog.diagnostic as {
      failureType?: string;
      qualityIssues?: Array<{ code: string }>;
    };
    expect(diagnostic.failureType).toBe('quality');
    expect(diagnostic.qualityIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'RICH_CLOSED_GATE_TOO_MANY_SINGLE_CHOICE',
        }),
      ]),
    );
    expectNoSensitiveDiagnosticLog(errorLog);
  });

  it('keeps source invalid categorized and logs source issue paths', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          {
            ...richClosedQuestionFixture('single_choice'),
            sourceChunkIds: ['chunk-unknown'],
          },
          ...generatedExercise().questions.slice(1),
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SOURCE_INVALID });

    expect(getLastRichClosedErrorLog(loggerWarnSpy).diagnostic).toMatchObject({
      failureType: 'source',
      validationIssues: [
        {
          code: 'RICH_CLOSED_SOURCE_UNKNOWN',
          path: 'questions.0.sourceChunkIds',
        },
      ],
    });
  });

  it('retries with a stricter repair prompt when fallback model is configured after contract invalid output', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    process.env.MISTRAL_RICH_CLOSED_FALLBACK_MODEL = 'mistral-large-latest';
    mockGenerate
      .mockResolvedValueOnce({
        output: {
          ...generatedExercise(),
          questions: generatedExercise().questions.slice(0, 5),
        },
      })
      .mockResolvedValueOnce({ output: generatedExercise() });
    const observer = createObserver();

    const exercise = await new GenkitRichClosedQuestionGenerator(
      observer,
    ).generate(generationInput());

    expect(exercise.id).toBe('rich-exercise-1');
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(mockGenerate.mock.calls[1][0].prompt).toContain(
      'Tentative de réparation stricte',
    );
    expect(mockGenerate.mock.calls[1][0].prompt).toContain('Question count: 6');
    expect(mockGenerate.mock.calls[1][0].prompt).toContain('questionTypeMix');
    expect(
      observer.observe.mock.calls.map(([observation]) => observation),
    ).toEqual([
      expect.objectContaining({
        status: 'error',
        errorCode: RICH_CLOSED_GENERATION_CONTRACT_INVALID,
        model: 'mistral/mistral-small-latest',
      }),
      expect.objectContaining({
        status: 'success',
        model: 'mistral/mistral-large-latest',
      }),
    ]);
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'SENTINEL_FULL_CHUNK_TEXT',
    );
    expect(JSON.stringify(loggerWarnSpy.mock.calls)).not.toContain(
      'SENTINEL_FULL_CHUNK_TEXT',
    );
    expect(JSON.stringify(loggerWarnSpy.mock.calls)).not.toContain(
      'test-mistral-key',
    );
  });

  it('returns the final controlled error when fallback model also fails', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    process.env.MISTRAL_RICH_CLOSED_FALLBACK_MODEL = 'mistral-large-latest';
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: generatedExercise().questions.slice(0, 5),
      },
    });
    const observer = createObserver();

    await expect(
      new GenkitRichClosedQuestionGenerator(observer).generate(
        generationInput(),
      ),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_CONTRACT_INVALID });

    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(
      observer.observe.mock.calls.map(([observation]) => observation),
    ).toEqual([
      expect.objectContaining({
        status: 'error',
        errorCode: RICH_CLOSED_GENERATION_CONTRACT_INVALID,
      }),
      expect.objectContaining({
        status: 'error',
        errorCode: RICH_CLOSED_GENERATION_CONTRACT_INVALID,
      }),
    ]);
    expect(getLastRichClosedErrorLog(loggerWarnSpy).diagnostic).toMatchObject({
      failureType: 'count',
      expectedQuestionCount: 6,
      actualQuestionCount: 5,
    });
  });

  it('returns controlled errors without leaking generated payloads', async () => {
    mockGenerate.mockResolvedValue({
      output: {
        ...generatedExercise(),
        questions: [
          {
            ...richClosedQuestionFixture('single_choice'),
            sourceChunkIds: ['SENTINEL_SECRET_CHUNK'],
          },
          ...generatedExercise().questions.slice(1),
        ],
      },
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({
      code: RICH_CLOSED_GENERATION_SOURCE_INVALID,
      message: RICH_CLOSED_GENERATION_SOURCE_INVALID,
    });

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.not.toThrow('SENTINEL_SECRET_CHUNK');
  });
});

function generatedExercise(): RichClosedExercise {
  return richClosedExerciseFixture();
}

function generationInput() {
  return {
    studentId: 'student-1',
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnit: {
      id: 'unit-1',
      subjectId: 'subject-1',
      title: 'Régime parlementaire rationalisé',
      summary:
        'La responsabilité politique du gouvernement et les mécanismes de rationalisation encadrent les rapports entre Parlement et exécutif.',
      difficulty: 'MEDIUM' as const,
      sourceChunkIds: ['chunk-1'],
    },
    chunks: [
      {
        id: 'chunk-1',
        index: 0,
        text: 'SENTINEL_FULL_CHUNK_TEXT',
        pageNumber: null,
      },
    ],
    questionCount: 6,
    questionTypeMix: {
      single_choice: 1,
      multiple_choice: 1,
      matching: 1,
      ordering: 1,
      case_qualification: 1,
      error_detection: 1,
    },
    complexityProfile: 'exam' as const,
  };
}

function createObserver() {
  return {
    observe: jest.fn<void, [AiGenerationObservation]>(),
  } satisfies AiGenerationObserver & {
    observe: jest.Mock<void, [AiGenerationObservation]>;
  };
}

function getObservedObservation(
  observer: ReturnType<typeof createObserver>,
): AiGenerationObservation {
  expect(observer.observe).toHaveBeenCalledTimes(1);

  return observer.observe.mock.calls[0][0];
}

function getLastRichClosedErrorLog(loggerWarnSpy: jest.SpyInstance): {
  diagnostic?: unknown;
  [key: string]: unknown;
} {
  const parsedLogs = loggerWarnSpy.mock.calls.flatMap(([message]) => {
    const parsed: unknown = JSON.parse(String(message));

    return isLogRecord(parsed) ? [parsed] : [];
  });
  const errorLogs = parsedLogs.filter(
    (log) => log.event === 'rich.closed.generation.error',
  );

  expect(errorLogs.length).toBeGreaterThan(0);

  return errorLogs[errorLogs.length - 1];
}

function isLogRecord(
  value: unknown,
): value is { event?: string; diagnostic?: unknown; [key: string]: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expectNoSensitiveDiagnosticLog(log: unknown) {
  const serialized = JSON.stringify(log);

  expect(serialized).not.toContain('SENTINEL_FULL_CHUNK_TEXT');
  expect(serialized).not.toContain('test-mistral-key');
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

```
### `docs/v1/ROADMAP_EXECUTION_PLAN_V1.md`

```md
# Roadmap execution plan V1 — API

Ce fichier existe côté API pour les lots backend V1 dont le prompt interdit toute modification de `revision_app/`.

| Lot | Intitulé | Statut | Rapport |
| --- | --- | --- | --- |
| V1-012C | Backend diagnostics génération rich closed | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_012C_BACKEND_RICH_CLOSED_GENERATION_DIAGNOSTICS.md |

## Lots détaillés

### V1-012C — Backend diagnostics génération rich closed

- Objectif : diagnostiquer et fiabiliser les échecs Genkit rich closed.
- Pourquoi maintenant : la page front existe mais la génération backend échoue en runtime avec `RICH_CLOSED_GENERATION_CONTRACT_INVALID`.
- Périmètre inclus : diagnostics metadata-only, catégorisation des rejets, prompt de réparation sur modèle fallback configuré, tests mockés.
- Non-objectifs : frontend, Today, revision sessions, Prisma, endpoints publics.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_012C_BACKEND_RICH_CLOSED_GENERATION_DIAGNOSTICS.md`.

```
