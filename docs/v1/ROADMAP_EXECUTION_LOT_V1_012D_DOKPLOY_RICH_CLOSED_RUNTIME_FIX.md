# LOT V1-012D — Dokploy runtime fix génération rich closed

## 1. Résultat

Le runtime Dokploy a été inspecté avant toute correction aveugle. Le service API déployé correspond bien au commit `48874e770a18b8a5184a7ccabd2ea06955291d24`, qui contient V1-012C, et les logs détaillés `rich.closed.generation.error` sont bien présents.

La cause exploitable observée est double :

- première tentative : `RICH_CLOSED_GENERATION_CONTRACT_INVALID`, avec 6 issues `RICH_CLOSED_COGNITIVE_SKILL_INVALID` sur `questions.0.cognitiveSkill` à `questions.5.cognitiveSkill` ; le count et le mix étaient pourtant corrects ;
- tentative fallback : `RICH_CLOSED_GENERATION_SCHEMA_INVALID`, mais le diagnostic schema runtime restait trop pauvre (`failureType: schema` seulement).

Le code local corrige ces deux angles : le prompt rich closed liste maintenant les `cognitiveSkill` autorisés, impose un objet JSON brut sans Markdown/code fences et rappelle les clés strictes par type ; le diagnostic schema extrait maintenant les issues directes ou imbriquées (`issues`, `cause`, `error`, `details`) et ajoute un aperçu de message scrubbed/tronqué quand aucune issue structurée n’existe.

Aucun redéploiement Dokploy n’a été déclenché, car le service déploie depuis GitHub `main` et les corrections locales ne sont pas commit/push. Un redeploy immédiat aurait seulement redéployé le même commit déjà en production.

## 2. Outils Dokploy MCP utilisés

Actions MCP Dokploy utilisées, sans action destructive :

- `project_search` : recherche du projet Revision.
- `application_search` : identification du service backend API.
- `deployment_allCentralized` : lecture des derniers déploiements centralisés.
- `deployment_all` : lecture des déploiements du service backend.
- `application_one` : lecture de la configuration du service backend. La réponse contenait des champs secrets côté provider GitHub ; ils n’ont pas été recopiés dans ce rapport.
- `application_readAppMonitoring` : vérification monitoring applicatif, sans donnée utile retournée.
- `application_readLogs` : recherche des logs `ai.generation`, `richClosedQuestionGeneration`, `RICH_CLOSED_GENERATION_SCHEMA_INVALID` et `rich.closed.generation.error`.

Aucune action de suppression, reset, migration, changement de secret ou suppression de service n’a été lancée.

## 3. État du service API

- Projet Dokploy identifié : `revision app`.
- Service API identifié : `backEnd` / `revision-app-backend-xlsv4d`.
- Domaine public configuré : `revision-api.yoahn.me`.
- Build type : Dockerfile.
- Repository : `revision_project_api`, branche `main`.
- Dernier déploiement backend inspecté : `SA9roSpJ4S_xIf5JK_xyB`.
- Statut dernier déploiement : `done`.
- Commit déployé : `48874e770a18b8a5184a7ccabd2ea06955291d24`.
- Titre du déploiement : `RAPPORT-123: Mise à jour du générateur GenKit et ajout de la documentation`.
- Date de démarrage : `2026-06-16T23:21:43.246Z`.
- Date de fin : `2026-06-16T23:22:02.315Z`.

Conclusion : V1-012C est bien déployé. Le problème n’est donc pas simplement un service resté sur un ancien build.

Variables runtime déduites ou vérifiées sans exposer de secret :

- `AI_PROVIDER` effectif : `mistral`, confirmé par les logs metadata-only.
- Modèle principal effectif : `mistral/mistral-small-latest`, confirmé par le log `rich.closed.generation.context`.
- Modèle fallback effectif : `mistral/mistral-large-latest`, confirmé par le log d’erreur fallback.
- Fallback différent du modèle principal : oui.
- `MISTRAL_API_KEY` : présence effective déduite des appels provider réalisés ; valeur jamais affichée.
- `RICH_CLOSED_GENERATION_MAX_CHUNKS` / `RICH_CLOSED_GENERATION_MAX_CHARS` : valeur exacte non exposée par Dokploy ; le runtime a sélectionné 1 chunk et 2359 caractères dans le log inspecté.
- `NODE_ENV` : valeur exacte non exposée par les réponses MCP utilisées.

## 4. Logs inspectés

Les logs suivants ont été cherchés :

- `ai.generation`
- `richClosedQuestionGeneration`
- `RICH_CLOSED_GENERATION_SCHEMA_INVALID`
- `rich.closed.generation.error`

Extrait non sensible synthétisé :

```text
rich.closed.generation.context
provider: mistral
model: mistral/mistral-small-latest
requestedQuestionCount: 6
selectedChunkCount: 1
selectedChunkCharCount: 2359
```

```text
rich.closed.generation.error
model: mistral/mistral-small-latest
errorCode: RICH_CLOSED_GENERATION_CONTRACT_INVALID
diagnostic.failureType: contract
expectedQuestionCount: 6
actualQuestionCount: 6
expectedQuestionTypeMix == actualQuestionTypeMix
validationIssues:
- RICH_CLOSED_COGNITIVE_SKILL_INVALID at questions.0.cognitiveSkill
- RICH_CLOSED_COGNITIVE_SKILL_INVALID at questions.1.cognitiveSkill
- RICH_CLOSED_COGNITIVE_SKILL_INVALID at questions.2.cognitiveSkill
- RICH_CLOSED_COGNITIVE_SKILL_INVALID at questions.3.cognitiveSkill
- RICH_CLOSED_COGNITIVE_SKILL_INVALID at questions.4.cognitiveSkill
- RICH_CLOSED_COGNITIVE_SKILL_INVALID at questions.5.cognitiveSkill
questionKinds:
- single_choice
- multiple_choice
- matching
- ordering
- case_qualification
- error_detection
```

```text
rich.closed.generation.error
model: mistral/mistral-large-latest
errorCode: RICH_CLOSED_GENERATION_SCHEMA_INVALID
diagnostic.failureType: schema
```

Aucun prompt complet, chunk complet, output IA complet, token, clé API, `DATABASE_URL`, URL Redis ou secret Firebase n’a été recopié.

## 5. Cause racine

Cause racine principale : le modèle principal générait des valeurs `cognitiveSkill` hors allowlist. Le prompt ne listait pas explicitement les seules valeurs autorisées, alors que le validator V1-005B les exige strictement. Le contrat faisait son travail : il rejetait la sortie.

Cause secondaire : le fallback `mistral-large-latest` échouait au niveau schema, mais le diagnostic local ne récupérait que les erreurs `z.ZodError` directes. Les erreurs Genkit/provider peuvent emballer les issues ailleurs (`error.issues`, `error.cause.issues`, `error.error`, `error.details`) ou n’exposer qu’un message. Le log runtime devenait donc trop pauvre pour corriger finement la sortie réelle.

Ce qui n’est pas la cause racine observée :

- le count : 6 attendu, 6 reçu ;
- le mix : mix attendu et mix reçu identiques ;
- un type V1-A absent : les six types attendus étaient présents ;
- le frontend : l’appel au backend et l’affichage d’erreur contrôlée fonctionnent ;
- le non-déploiement V1-012C : V1-012C est bien déployé.

## 6. Corrections appliquées

Corrections code locales :

- Le prompt rich closed indique désormais explicitement `JSON object only`.
- Le prompt interdit explicitement Markdown et code fences.
- Le prompt rappelle qu’aucun champ additionnel n’est autorisé.
- Le prompt liste les `cognitiveSkill` autorisés depuis `RICH_CLOSED_COGNITIVE_SKILLS`.
- Le prompt liste les clés exactes attendues pour les six types V1-A.
- Les erreurs schema utilisent maintenant `buildSchemaGenerationDiagnostic(error)` au lieu de retourner seulement `{ failureType: 'schema' }`.
- Le diagnostic schema extrait les issues directes et imbriquées.
- Le diagnostic schema expose `schemaErrorName`, `schemaIssueCount`, `validationIssues` et, si nécessaire, `schemaErrorMessagePreview` scrubbed/tronqué.
- Les messages de diagnostic schema retirent les fragments secrets connus et les sentinelles de test avant logging.

Corrections configuration Dokploy : aucune. Le fallback est déjà effectif et différent du modèle principal.

Redéploiement/restart : non lancé. Un redeploy Dokploy sans commit/push redéploierait le commit `48874e7` déjà en place, donc ne publierait pas les corrections locales.

## 7. Sécurité

- Aucun secret Dokploy n’a été recopié.
- Les valeurs de clés API, tokens, `DATABASE_URL`, Redis, Firebase et clés GitHub ne sont pas présentes dans ce rapport.
- Aucun texte complet de chunk n’a été recopié.
- Aucun prompt complet runtime n’a été recopié.
- Aucun output IA complet n’a été recopié.
- Les diagnostics ajoutés restent metadata-only : codes, paths, compteurs, noms d’erreur et preview scrubbed/tronqué.
- Le contrat rich closed reste strict.
- Aucune correction pré-submit n’est exposée.
- Aucun endpoint public n’a été modifié.
- Prisma n’a pas été modifié.

## 8. Tests ajoutés/modifiés

Tests renforcés dans `genkit-rich-closed-question.generator.spec.ts` :

- le prompt doit interdire Markdown/code fences et imposer un objet JSON brut ;
- le prompt doit lister les `cognitiveSkill` autorisés ;
- le prompt doit rappeler les clés exactes par type ;
- une erreur schema avec `issues` directes produit codes et paths ;
- une erreur schema avec `cause.issues` produit codes et paths ;
- une erreur schema avec seulement un message produit une preview scrubbed/tronquée ;
- les diagnostics ne contiennent pas le chunk sentinelle ;
- les diagnostics ne contiennent pas la clé API sentinelle.

## 9. Validations lancées avec résultats

Depuis `/Users/karim/Project/app-révision/api` :

```bash
npm test -- genkit-rich-closed-question.generator --runInBand
```

Résultat : passé, 1 suite, 18 tests.

```bash
npm test -- rich-closed --runInBand
```

Résultat : passé, 8 suites, 93 tests.

```bash
npm test -- activities --runInBand
```

Résultat : passé, 17 suites passées, 1 suite skipped, 190 tests passés, 1 test skipped.

```bash
npm run lint:check
```

Résultat : passé.

```bash
npm run build
```

Résultat : passé.

```bash
git diff --check
```

Résultat : passé après création du rapport.

## 10. Validations non lancées avec justification

- Tests frontend : non lancés, le lot interdit de modifier le frontend et aucune modification `revision_app` n’a été faite.
- Provider IA réel local : non lancé, les tests doivent rester mockés.
- Seed réel : non lancé, hors périmètre.
- Migration Prisma : non lancée, hors périmètre et explicitement interdite.
- Redéploiement Dokploy : non lancé, car les corrections locales ne sont pas commit/push ; redeployer maintenant republierait le même commit déjà déployé.

## 11. Résultat runtime après correction

Le runtime Dokploy actuel n’a pas été modifié, pour éviter un redeploy trompeur du même commit GitHub.

Résultat runtime confirmé avant correction locale :

- V1-012C est déployé ;
- `rich.closed.generation.error` est visible ;
- la première tentative échoue par `RICH_CLOSED_COGNITIVE_SKILL_INVALID` ;
- le fallback échoue par `RICH_CLOSED_GENERATION_SCHEMA_INVALID` avec diagnostic trop pauvre.

Résultat attendu après publication des corrections locales :

- moins d’échecs `RICH_CLOSED_COGNITIVE_SKILL_INVALID`, car le prompt liste les valeurs exactes ;
- si le fallback échoue encore en schema, le log `rich.closed.generation.error` devrait contenir `schemaErrorName`, `schemaIssueCount`, `validationIssues` si disponibles, ou `schemaErrorMessagePreview` scrubbed/tronqué.

Étapes manuelles recommandées après commit/push autorisé :

1. Laisser Dokploy auto-déployer ou déclencher un redeploy du service backend.
2. Ouvrir l’app et relancer “Questions riches” avec le compte de démo.
3. Rechercher `rich.closed.generation.error` dans les logs.
4. Vérifier soit un succès `ai.generation`, soit un diagnostic schema plus précis.

## 12. Risques restants

- La correction locale n’est pas encore déployée tant qu’aucun commit/push n’est fait.
- Mistral peut encore produire une sortie schema-invalid ; le diagnostic sera meilleur mais un micro-lot prompt/schema tuning peut rester nécessaire selon le prochain log réel.
- Le prompt est plus strict, mais pas garanti à 100 % avec un provider IA non déterministe.
- Les env exactes restent partiellement masquées par Dokploy ; le comportement effectif a été déduit des logs.
- La génération dépend d’un seul chunk sur le cas observé, ce qui peut limiter la richesse pédagogique du mix.

## 13. Recommandation prochain lot

Après publication et validation runtime de ce correctif :

- si la génération rich closed réussit : passer à `V1-013 — Today integration V1` ;
- si le prochain log révèle une issue schema précise : faire un micro-lot prompt/schema tuning ciblé à partir du diagnostic enrichi.

## 14. Critique honnête du prompt initial

Le prompt était très bon sur le point essentiel : ne pas patcher à l’aveugle et vérifier Dokploy d’abord. La contrainte “corriger le runtime” entre toutefois en tension avec “ne pas commit/push” : Dokploy déployant depuis GitHub, une correction locale ne peut pas être réellement publiée sans action Git interdite. Le lot peut donc produire une correction locale validée et un diagnostic runtime fiable, mais pas confirmer le succès runtime post-correction sans une publication autorisée.

## 15. Contenu complet des fichiers créés/modifiés/supprimés

### Fichier modifié : `src/modules/activities/infrastructure/genkit-rich-closed-question.generator.ts`

~~~ts
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
    'Tu dois retourner un JSON object only: un objet JSON brut, sans Markdown, sans code fences, sans texte avant ou après.',
    'Aucun champ additionnel n’est autorisé.',
    `cognitiveSkill autorisés: ${RICH_CLOSED_COGNITIVE_SKILLS.join(', ')}`,
    'Clés communes exactes par question: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds.',
    'Clés exactes single_choice: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, choices, correctChoiceId, explanation.',
    'Clés exactes multiple_choice: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, choices, minSelections, maxSelections, correctChoiceIds, explanation.',
    'Clés exactes matching: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, leftItems, rightItems, correctPairs, explanation.',
    'Clés exactes ordering: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, items, correctOrder, explanation.',
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

~~~

### Fichier modifié : `src/modules/activities/infrastructure/genkit-rich-closed-question.generator.spec.ts`

~~~ts
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
    expect(generateInput?.prompt).toContain('JSON object only');
    expect(generateInput?.prompt).toContain('sans Markdown');
    expect(generateInput?.prompt).toContain('sans code fences');
    expect(generateInput?.prompt).toContain(
      'cognitiveSkill autorisés: memorization, comprehension, comparison, classification, case_application, procedure, error_detection, causality',
    );
    expect(generateInput?.prompt).toContain(
      'Clés exactes single_choice: id, questionKind, prompt, difficulty, cognitiveSkill, sourceChunkIds, choices, correctChoiceId, explanation.',
    );
    expect(generateInput?.prompt).toContain(
      'Aucun champ additionnel n’est autorisé.',
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

  it('logs schema diagnostics from direct issues without leaking sensitive context', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    const schemaError = new Error('Schema parser saw SENTINEL_FULL_CHUNK_TEXT');
    Object.assign(schemaError, {
      issues: [
        {
          code: 'invalid_type',
          path: ['questions', 0, 'choices'],
        },
      ],
    });
    mockGenerate.mockRejectedValue(schemaError);

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });

    const errorLog = getLastRichClosedErrorLog(loggerWarnSpy);
    expect(errorLog.diagnostic).toMatchObject({
      failureType: 'schema',
      schemaErrorName: 'Error',
      schemaIssueCount: 1,
      validationIssues: [
        {
          code: 'invalid_type',
          path: 'questions.0.choices',
          severity: 'error',
        },
      ],
    });
    expect(JSON.stringify(errorLog)).not.toContain('SENTINEL_FULL_CHUNK_TEXT');
    expect(JSON.stringify(errorLog)).not.toContain('test-mistral-key');
  });

  it('logs schema diagnostics from nested cause issues', async () => {
    const schemaError = new Error('Wrapper output error');
    Object.assign(schemaError, {
      cause: {
        issues: [
          {
            code: 'unrecognized_keys',
            path: ['questions', 2, 'extra'],
          },
        ],
      },
    });
    mockGenerate.mockRejectedValue(schemaError);

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });

    expect(getLastRichClosedErrorLog(loggerWarnSpy).diagnostic).toMatchObject({
      failureType: 'schema',
      schemaIssueCount: 1,
      validationIssues: [
        {
          code: 'unrecognized_keys',
          path: 'questions.2.extra',
          severity: 'error',
        },
      ],
    });
  });

  it('logs a scrubbed and truncated schema message when no issues are available', async () => {
    process.env.AI_PROVIDER = 'mistral';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    mockGenerate.mockRejectedValue(
      new Error(
        `JSON output invalid ${'x'.repeat(300)} SENTINEL_FULL_CHUNK_TEXT test-mistral-key`,
      ),
    );

    await expect(
      new GenkitRichClosedQuestionGenerator().generate(generationInput()),
    ).rejects.toMatchObject({ code: RICH_CLOSED_GENERATION_SCHEMA_INVALID });

    const errorLog = getLastRichClosedErrorLog(loggerWarnSpy);
    expect(errorLog.diagnostic).toMatchObject({
      failureType: 'schema',
      schemaErrorName: 'Error',
      schemaIssueCount: 0,
    });
    expect(JSON.stringify(errorLog)).not.toContain('SENTINEL_FULL_CHUNK_TEXT');
    expect(JSON.stringify(errorLog)).not.toContain('test-mistral-key');
    expect(
      String(
        (errorLog.diagnostic as { schemaErrorMessagePreview?: string })
          .schemaErrorMessagePreview,
      ).length,
    ).toBeLessThanOrEqual(220);
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

~~~

### Fichier modifié : `docs/v1/ROADMAP_EXECUTION_PLAN_V1.md`

~~~md
# Roadmap execution plan V1 — API

Ce fichier existe côté API pour les lots backend V1 dont le prompt interdit toute modification de `revision_app/`.

| Lot | Intitulé | Statut | Rapport |
| --- | --- | --- | --- |
| V1-012C | Backend diagnostics génération rich closed | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_012C_BACKEND_RICH_CLOSED_GENERATION_DIAGNOSTICS.md |
| V1-012D | Dokploy runtime fix génération rich closed | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_012D_DOKPLOY_RICH_CLOSED_RUNTIME_FIX.md |

## Lots détaillés

### V1-012C — Backend diagnostics génération rich closed

- Objectif : diagnostiquer et fiabiliser les échecs Genkit rich closed.
- Pourquoi maintenant : la page front existe mais la génération backend échoue en runtime avec `RICH_CLOSED_GENERATION_CONTRACT_INVALID`.
- Périmètre inclus : diagnostics metadata-only, catégorisation des rejets, prompt de réparation sur modèle fallback configuré, tests mockés.
- Non-objectifs : frontend, Today, revision sessions, Prisma, endpoints publics.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_012C_BACKEND_RICH_CLOSED_GENERATION_DIAGNOSTICS.md`.

### V1-012D — Dokploy runtime fix génération rich closed

- Objectif : vérifier le runtime Dokploy réel et rendre `RICH_CLOSED_GENERATION_SCHEMA_INVALID` exploitable.
- Pourquoi maintenant : V1-012C est déployé, mais le fallback Mistral échoue encore avec un diagnostic schema trop pauvre.
- Périmètre inclus : inspection Dokploy, prompt strict, diagnostics schema imbriqués, tests mockés.
- Non-objectifs : frontend, Today, revision sessions, Prisma, endpoints publics, redeploy sans commit déployable.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_012D_DOKPLOY_RICH_CLOSED_RUNTIME_FIX.md`.

~~~

### Fichier créé : `docs/v1/ROADMAP_EXECUTION_LOT_V1_012D_DOKPLOY_RICH_CLOSED_RUNTIME_FIX.md`

Le présent fichier est le rapport créé pour V1-012D. Son contenu complet correspond au document affiché ici. Il n’est pas recopié récursivement dans lui-même, car cela créerait une expansion infinie.
