# CORE-07B — Quick Revision Hardening (Backend)

## 1. Résumé

CORE-07B côté backend durcit le parcours quick course-level livré en CORE-07. Le lot empêche désormais l'appel `next-action` sur une session `QUICK` liée à un `courseId`, mappe ce conflit en HTTP 409, préserve les visuels QCM dans le payload public de revision session, et renforce les preuves repository autour de `completeQuickSession` et `findResultByIdForStudent`.

Aucune migration Prisma, aucun prompt Genkit, aucun endpoint deep/exam et aucun `CourseSource` n'ont été ajoutés. Aucun commit n'a été fait.

## 2. Audit initial

Sources inspectées côté backend :

- `docs/core/CORE_07_QUICK_REVISION_LIFECYCLE_RESULT_REPORT.md`
- `src/modules/revision-sessions/interfaces/revision-sessions.controller.ts`
- `src/modules/revision-sessions/application/request-next-revision-session-action.use-case.ts`
- `src/modules/revision-sessions/application/request-next-revision-session-action.use-case.spec.ts`
- `src/modules/revision-sessions/application/complete-quick-revision-session.use-case.ts`
- `src/modules/revision-sessions/application/get-revision-session-result.use-case.ts`
- `src/modules/revision-sessions/application/revision-sessions.repository.ts`
- `src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.ts`
- `src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.spec.ts`
- `src/modules/revision-sessions/domain/revision-session.entity.ts`
- `src/modules/revision-sessions/domain/revision-session-result.entity.ts`
- `src/modules/activities/infrastructure/prisma-activities.repository.ts`
- `prisma/schema.prisma`
- `test/critical-paths.e2e-spec.ts`

Constats :

- `next-action` restait possible car `RequestNextRevisionSessionActionUseCase` ne bloquait que les sessions non `STARTED`; une session quick course-level restait `STARTED` jusqu'à `complete`.
- Les flows legacy utilisent encore `next-action`, donc le blocage devait viser uniquement `mode === QUICK` et `courseId !== null`.
- `completeQuickSession` et `findResultByIdForStudent` portaient la logique critique mais avaient peu de tests directs repository.
- Les visuels QCM étaient déjà persistés et mappés dans Activities, mais `findByIdForStudent` côté revision-session ne chargeait pas `Question.visuals`.
- Les endpoints `complete` et `result` étaient déjà protégés; le e2e protégé ne couvrait pas encore explicitement `next-action`.

## 3. Sub-agents / passes utilisées

- Backend Lifecycle Guard Agent : audit du chemin `next-action`, choix du blocage métier en use case et garde défensive repository.
- Repository Result Proof Agent : ajout de tests directs `completeQuickSession` et `findResultByIdForStudent`, idempotence, erreurs et agrégation KnowledgeUnit.
- Diagnostic Visuals Agent : réutilisation conceptuelle du mapper Activities pour exposer uniquement des visuels publics `IMAGE`, `CHART`, `DIAGRAM`.
- QA Agent : validations Jest, e2e, lint, build, anti-`CourseSource` et `git diff --check`.
- Reviewer Agent : auto-review intégrée en section 16.

## 4. Problèmes corrigés

- `POST /revision-sessions/:sessionId/next-action` retourne désormais 409 pour les sessions quick course-level.
- La création d'action est aussi protégée au niveau repository `appendAction`, pour éviter une insertion accidentelle si le use case est contourné.
- `findByIdForStudent` charge et expose les visuels QCM publics, sans correction ni champs sensibles.
- Les tests repository prouvent la complétion idempotente, les erreurs d'activité non soumise/résultat absent, le mauvais type d'action, le mode non supporté, le cross-student/not found et l'agrégation multi-notions.
- Les e2e protègent maintenant `next-action` sans auth et le mapping 409 du blocage quick course-level.

## 5. Garde next-action

Règle backend :

`mode === 'QUICK' && courseId !== null` => `Quick course revision sessions do not support next actions`.

Le controller mappe cette erreur en `409 Conflict`. Les sessions legacy sans `courseId` gardent le comportement historique.

## 6. Tests repository completion/result

Tests ajoutés ou renforcés dans `prisma-revision-sessions.repository.spec.ts` :

- completion happy path ;
- idempotence si session/action déjà complétées ;
- activité non soumise ;
- résultat absent ;
- mauvaise action ;
- mode non supporté ;
- not found / cross-student ;
- lecture résultat sans mutation ;
- session non terminée ;
- résultat absent à la lecture ;
- score clamp/fallback ;
- agrégation multi-KnowledgeUnit avec `MASTERED` / `TO_REVIEW`.

## 7. Contrat visuels QCM

Le payload public de session quick peut maintenant contenir `visuals` par question. Les visuels sont filtrés comme suit :

- `IMAGE` : expose uniquement `imageUrl`, `altText`, `caption`, `sources` si le payload est complet.
- `CHART` : expose `chartType`, `title`, `description`, `data`, `xKey`, `yKeys`, `sources`.
- `DIAGRAM` : expose `title`, `description`, `nodes`, `edges`, `sources`.

Champs non exposés : `correctChoiceId`, `correctChoiceIds`, `explanation`, `feedback`, `storagePath`, `provider`, `promptVersion`, completions brutes.

## 8. Commandes exécutées

- `npx prisma validate` : OK, schéma valide.
- `npx prisma generate` : OK, Prisma Client généré.
- `npm run build` : OK.
- `npm run lint:check` : premier passage KO sur 2 erreurs Prettier dans les specs, corrigées par `npx prettier --write ...`, puis OK.
- `npm test -- request-next-revision-session-action.use-case.spec.ts --runInBand` : OK, 6 tests.
- `npm test -- revision-sessions.controller.spec.ts --runInBand` : OK, 14 tests.
- `npm test -- prisma-revision-sessions.repository.spec.ts --runInBand` : OK, 22 tests.
- `npm test -- revision-sessions --runInBand` : OK, 8 suites, 66 tests.
- `npm test -- activities --runInBand` : OK, 19 suites passées, 1 skipped, 342 tests passés.
- `npm test -- modules/courses --runInBand` : OK, 9 suites, 76 tests.
- `npm run test:e2e -- --runInBand` : OK, 2 suites, 33 tests.
- `npm test -- --runInBand` : OK, 80 suites passées, 1 skipped, 707 tests passés.
- `rg -n "CourseSource" src test docs/core || true` : aucune occurrence dans `src` ou `test`; occurrences documentaires dans anciens rapports seulement.
- `git diff --check` : OK, aucune sortie.

## 9. Preuve anti-CourseSource

Commande exécutée : `rg -n "CourseSource" src test docs/core || true`.

Résultat : aucune occurrence runtime dans `src` ou `test`. Les occurrences restantes sont documentaires dans `docs/core`, sur des rapports et runbooks existants.

## 10. Limites restantes

- Les repository specs restent mockées; un test d'intégration Prisma réel serait plus robuste pour prouver les includes complets sur une vraie base.
- Le mapper visuel revision-session duplique une partie du mapper Activities; une extraction partagée serait préférable si les visuels évoluent.
- Le blocage `next-action` est métier/use case + repository; il n'y a pas de garde décorateur/controller dédiée, ce qui est volontaire pour ne pas dupliquer la logique.

## 11. Risques

- Les payloads visuels `IMAGE` restent exposables si déjà persistés avec `imageUrl`; le lot ne change pas la politique d'assets image existante.
- Si un futur mode quick non course-level devait aussi devenir single-action, il faudra étendre la garde.

## 12. Ce qui reste pour deep/exam

- Définir un lifecycle multi-action dédié.
- Définir résultat multi-action et agrégation pédagogique.
- Décider si `next-action` devient réservé à deep/exam uniquement.

## 13. Auto-review

- Quick course-level bloque `next-action` : oui.
- Non course-level legacy conservé : oui.
- `completeQuickSession` testé directement : oui.
- `findResultByIdForStudent` testé directement : oui.
- Idempotence testée : oui.
- Activity non soumise testée : oui.
- ActivityResult absent testé : oui.
- Agrégation multi-KnowledgeUnit testée : oui.
- Visuels QCM préservés : oui.
- Pas de correction pré-submit : oui.
- Pas de deep/exam : oui.
- Pas de `CourseSource` : oui.
- Aucun commit : oui.

## 14. Points discutables du prompt

- Bloquer `next-action` uniquement côté use case aurait pu suffire, mais la garde repository ajoute une défense utile sans changer le contrat public.
- Les visuels QCM mériteraient un mapper partagé Activities/RevisionSessions; je n'ai pas fait ce refactor pour éviter un changement architectural dans un lot de hardening.
- Les specs Prisma mockées deviennent longues; un futur test d'intégration pourrait mieux prouver la sélection réelle des relations Prisma.
- Le seuil `MASTERED >= 0.8` reste codé dans le domaine existant; le lot le teste indirectement mais ne le rend pas configurable.

## 15. Fichiers créés/modifiés/supprimés

Créés :

- `docs/core/CORE_07B_QUICK_REVISION_HARDENING_REPORT.md`

Modifiés :

- `src/modules/revision-sessions/application/request-next-revision-session-action.use-case.spec.ts`
- `src/modules/revision-sessions/application/request-next-revision-session-action.use-case.ts`
- `src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.spec.ts`
- `src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.ts`
- `src/modules/revision-sessions/interfaces/revision-sessions.controller.spec.ts`
- `src/modules/revision-sessions/interfaces/revision-sessions.controller.ts`
- `test/critical-paths.e2e-spec.ts`

Supprimés : aucun.

## 16. Contenu complet des fichiers créés/modifiés/supprimés

Le rapport courant ne s'inclut pas lui-même pour éviter la récursion.

### src/modules/revision-sessions/application/request-next-revision-session-action.use-case.spec.ts

```ts
import type { StartNextActivityUseCase } from '../../activities/application/start-next-activity.use-case';
import type { StartOpenQuestionActivityUseCase } from '../../activities/application/start-open-question-activity.use-case';
import type { RevisionCoachNextActionGenerator } from './revision-coach-next-action.generator';
import { RequestNextRevisionSessionActionUseCase } from './request-next-revision-session-action.use-case';
import type { RevisionSessionsRepository } from './revision-sessions.repository';

type AppendActionInput = Parameters<
  RevisionSessionsRepository['appendAction']
>[0];

describe('RequestNextRevisionSessionActionUseCase', () => {
  it('creates a diagnostic quiz from a coach decision', async () => {
    const repository = createRepository();
    const generator = createGenerator({
      actionKind: 'DIAGNOSTIC_QUIZ',
      knowledgeUnitId: null,
      reasonCode: 'CHECK_UNDERSTANDING',
    });
    const startNextActivity = createStartNextActivityUseCase();
    const startOpenQuestionActivity = createStartOpenQuestionActivityUseCase();
    const useCase = new RequestNextRevisionSessionActionUseCase(
      repository,
      generator,
      startNextActivity,
      startOpenQuestionActivity,
    );

    const result = await useCase.execute({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(generator.generate.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'revision-session-1',
          subjectId: 'subject-1',
          documentId: 'document-1',
          sessionKnowledgeUnitId: 'unit-1',
          history: [
            {
              kind: 'OPEN_QUESTION',
              status: 'READY',
              displayOrder: 0,
              activitySessionId: 'open-session-1',
              knowledgeUnitId: 'unit-1',
            },
          ],
          availableActions: [
            'DIAGNOSTIC_QUIZ',
            'OPEN_QUESTION',
            'RICH_CLOSED_EXERCISE',
          ],
          allowedKnowledgeUnitIds: ['unit-1', 'unit-2'],
        },
      ],
    ]);
    expect(startNextActivity.execute.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          knowledgeUnitId: undefined,
        },
      ],
    ]);
    expect(startOpenQuestionActivity.execute.mock.calls).toHaveLength(0);
    expect(repository.appendAction.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'revision-session-1',
          action: {
            kind: 'DIAGNOSTIC_QUIZ',
            status: 'READY',
            activitySessionId: 'quiz-session-2',
            documentId: 'document-1',
            knowledgeUnitId: null,
          },
        },
      ],
    ]);
    expect(result.currentAction?.payload).toEqual(diagnosticQuizActivity());
    expect(JSON.stringify(result)).not.toContain('correctChoiceId');
  });

  it('rejects next actions for course-level quick sessions before creating activities', async () => {
    const repository = createRepository();
    repository.findPlanningContextByIdForStudent.mockResolvedValueOnce({
      session: {
        id: 'revision-session-1',
        status: 'STARTED',
        subjectId: 'subject-1',
        courseId: 'course-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-course-1',
        mode: 'QUICK',
      },
      actions: [],
      allowedKnowledgeUnitIds: ['unit-course-1'],
      allowedKnowledgeUnits: [
        {
          id: 'unit-course-1',
          documentId: 'document-1',
          title: 'Notion du cours',
        },
      ],
    });
    const generator = createGenerator({
      actionKind: 'DIAGNOSTIC_QUIZ',
      knowledgeUnitId: null,
      reasonCode: 'CHECK_UNDERSTANDING',
    });
    const startNextActivity = createStartNextActivityUseCase();
    const startOpenQuestionActivity = createStartOpenQuestionActivityUseCase();

    await expect(
      new RequestNextRevisionSessionActionUseCase(
        repository,
        generator,
        startNextActivity,
        startOpenQuestionActivity,
      ).execute({
        studentId: 'student-1',
        sessionId: 'revision-session-1',
      }),
    ).rejects.toThrow(
      'Quick course revision sessions do not support next actions',
    );

    expect(generator.generate.mock.calls).toHaveLength(0);
    expect(startNextActivity.execute.mock.calls).toHaveLength(0);
    expect(startOpenQuestionActivity.execute.mock.calls).toHaveLength(0);
    expect(repository.appendAction.mock.calls).toHaveLength(0);
  });

  it('creates an open question from a coach decision', async () => {
    const repository = createRepository();
    const generator = createGenerator({
      actionKind: 'OPEN_QUESTION',
      knowledgeUnitId: 'unit-2',
      reasonCode: 'REINFORCE_CURRENT_KNOWLEDGE_UNIT',
    });
    const startNextActivity = createStartNextActivityUseCase();
    const startOpenQuestionActivity = createStartOpenQuestionActivityUseCase();

    const result = await new RequestNextRevisionSessionActionUseCase(
      repository,
      generator,
      startNextActivity,
      startOpenQuestionActivity,
    ).execute({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(startOpenQuestionActivity.execute.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-2',
        },
      ],
    ]);
    expect(startNextActivity.execute.mock.calls).toHaveLength(0);
    expect(repository.appendAction.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'revision-session-1',
          action: {
            kind: 'OPEN_QUESTION',
            status: 'READY',
            activitySessionId: 'open-session-2',
            documentId: 'document-1',
            knowledgeUnitId: 'unit-2',
          },
        },
      ],
    ]);
    expect(result.currentAction?.payload).toEqual(openQuestionActivity());
    expect(JSON.stringify(result)).not.toContain('modelAnswer');
    expect(JSON.stringify(result)).not.toContain('score');
  });

  it('uses deterministic rich closed fallback when the coach generator fails', async () => {
    const repository = createRepository();
    const generator = createGenerator(new Error('provider exploded'));
    const startNextActivity = createStartNextActivityUseCase();
    const startOpenQuestionActivity = createStartOpenQuestionActivityUseCase();

    await new RequestNextRevisionSessionActionUseCase(
      repository,
      generator,
      startNextActivity,
      startOpenQuestionActivity,
    ).execute({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(startNextActivity.execute.mock.calls).toHaveLength(0);
    expect(startOpenQuestionActivity.execute.mock.calls).toHaveLength(0);
    expect(repository.appendAction.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'revision-session-1',
          action: {
            kind: 'RICH_CLOSED_EXERCISE',
            status: 'READY',
            activitySessionId: null,
            documentId: 'document-1',
            knowledgeUnitId: 'unit-1',
          },
        },
      ],
    ]);
  });

  it('creates a rich closed launcher from a coach decision without starting activities', async () => {
    const repository = createRepository();
    const generator = createGenerator({
      actionKind: 'RICH_CLOSED_EXERCISE',
      knowledgeUnitId: 'unit-2',
      reasonCode: 'CHECK_UNDERSTANDING',
    });
    const startNextActivity = createStartNextActivityUseCase();
    const startOpenQuestionActivity = createStartOpenQuestionActivityUseCase();

    const result = await new RequestNextRevisionSessionActionUseCase(
      repository,
      generator,
      startNextActivity,
      startOpenQuestionActivity,
    ).execute({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(startNextActivity.execute.mock.calls).toHaveLength(0);
    expect(startOpenQuestionActivity.execute.mock.calls).toHaveLength(0);
    expect(repository.appendAction.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'revision-session-1',
          action: {
            kind: 'RICH_CLOSED_EXERCISE',
            status: 'READY',
            activitySessionId: null,
            documentId: 'document-2',
            knowledgeUnitId: 'unit-2',
          },
        },
      ],
    ]);
    expect(result.currentAction?.payload).toEqual({
      type: 'rich_closed_exercise',
      subjectId: 'subject-1',
      documentId: 'document-2',
      knowledgeUnitId: 'unit-2',
      knowledgeUnitTitle: 'Notion 2',
      reason: 'Questions riches recommandées pour vérifier la compréhension.',
      estimatedMinutes: 8,
      preferredAction: 'rich_closed_exercise',
    });
    expect(JSON.stringify(result)).not.toContain('questions');
    expect(JSON.stringify(result)).not.toContain('correction');
    expect(JSON.stringify(result)).not.toContain('correctChoiceId');
  });

  it('does not persist an action when activity creation fails', async () => {
    const repository = createRepository();
    const generator = createGenerator({
      actionKind: 'DIAGNOSTIC_QUIZ',
      knowledgeUnitId: null,
      reasonCode: 'CHECK_UNDERSTANDING',
    });
    const startNextActivity = createStartNextActivityUseCase();
    startNextActivity.execute.mockRejectedValue(new Error('activity failed'));

    await expect(
      new RequestNextRevisionSessionActionUseCase(
        repository,
        generator,
        startNextActivity,
        createStartOpenQuestionActivityUseCase(),
      ).execute({
        studentId: 'student-1',
        sessionId: 'revision-session-1',
      }),
    ).rejects.toThrow('activity failed');

    expect(repository.appendAction.mock.calls).toHaveLength(0);
  });
});

function createRepository(): jest.Mocked<RevisionSessionsRepository> {
  return {
    ensureStartContext: jest.fn(),
    createWithInitialAction: jest.fn(),
    findByIdForStudent: jest.fn(),
    findPlanningContextByIdForStudent: jest.fn().mockResolvedValue({
      session: {
        id: 'revision-session-1',
        status: 'STARTED',
        subjectId: 'subject-1',
        courseId: null,
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        mode: 'QUICK',
      },
      actions: [
        {
          kind: 'OPEN_QUESTION',
          status: 'READY',
          displayOrder: 0,
          activitySessionId: 'open-session-1',
          knowledgeUnitId: 'unit-1',
        },
      ],
      allowedKnowledgeUnitIds: ['unit-1', 'unit-2'],
      allowedKnowledgeUnits: [
        { id: 'unit-1', documentId: 'document-1', title: 'Notion 1' },
        { id: 'unit-2', documentId: 'document-2', title: 'Notion 2' },
      ],
    }),
    appendAction: jest
      .fn()
      .mockImplementation((input: AppendActionInput) =>
        Promise.resolve(revisionSessionResponse(input)),
      ),
    completeQuickSession: jest.fn(),
    findResultByIdForStudent: jest.fn(),
  };
}

function createGenerator(
  decisionOrError:
    | Awaited<ReturnType<RevisionCoachNextActionGenerator['generate']>>
    | Error,
): jest.Mocked<RevisionCoachNextActionGenerator> {
  return {
    generate:
      decisionOrError instanceof Error
        ? jest.fn().mockRejectedValue(decisionOrError)
        : jest.fn().mockResolvedValue(decisionOrError),
  };
}

function createStartNextActivityUseCase(): jest.Mocked<StartNextActivityUseCase> {
  return {
    execute: jest.fn().mockResolvedValue(diagnosticQuizActivity()),
  } as unknown as jest.Mocked<StartNextActivityUseCase>;
}

function createStartOpenQuestionActivityUseCase(): jest.Mocked<StartOpenQuestionActivityUseCase> {
  return {
    execute: jest.fn().mockResolvedValue(openQuestionActivity()),
  } as unknown as jest.Mocked<StartOpenQuestionActivityUseCase>;
}

function diagnosticQuizActivity() {
  return {
    sessionId: 'quiz-session-2',
    type: 'diagnostic_quiz' as const,
    title: 'QCM suivant',
    subjectId: 'subject-1',
    documentId: null,
    questions: [
      {
        id: 'question-1',
        prompt: 'Quel mécanisme permet de vérifier la compréhension ?',
        choices: [
          { id: 'a', label: 'Un contrôle' },
          { id: 'b', label: 'Une intuition' },
        ],
      },
    ],
  };
}

function openQuestionActivity() {
  return {
    sessionId: 'open-session-2',
    type: 'open_question' as const,
    version: 1,
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-2',
    question: {
      id: 'open-question-2',
      prompt: 'Explique la notion avec le cours.',
      instructions: 'Structure ta réponse.',
      maxAnswerLength: 4000,
      sources: [{ chunkId: 'chunk-1', pageNumber: null, index: 0 }],
    },
  };
}

function revisionSessionResponse(input: AppendActionInput) {
  const payload =
    input.action.kind === 'RICH_CLOSED_EXERCISE'
      ? {
          type: 'rich_closed_exercise' as const,
          subjectId: 'subject-1',
          documentId: input.action.documentId,
          knowledgeUnitId: input.action.knowledgeUnitId ?? 'unit-2',
          reason: 'Questions riches recommandées pour consolider cette notion.',
          estimatedMinutes: 8,
          preferredAction: 'rich_closed_exercise' as const,
        }
      : {
          type:
            input.action.kind === 'OPEN_QUESTION'
              ? ('open_question' as const)
              : ('diagnostic_quiz' as const),
          sessionId: input.action.activitySessionId,
        };

  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED' as const,
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      createdAt: new Date('2026-06-15T10:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-2',
      kind: input.action.kind,
      status: 'READY' as const,
      displayOrder: 1,
      activitySessionId: input.action.activitySessionId,
      documentId: input.action.documentId,
      knowledgeUnitId: input.action.knowledgeUnitId,
      payload,
    },
    history: [
      {
        id: 'action-1',
        kind: 'OPEN_QUESTION' as const,
        status: 'READY' as const,
        displayOrder: 0,
        activitySessionId: 'open-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
      {
        id: 'action-2',
        kind: input.action.kind,
        status: 'READY' as const,
        displayOrder: 1,
        activitySessionId: input.action.activitySessionId,
        documentId: input.action.documentId,
        knowledgeUnitId: input.action.knowledgeUnitId,
      },
    ],
  };
}

```

### src/modules/revision-sessions/application/request-next-revision-session-action.use-case.ts

```ts
import { Inject, Injectable } from '@nestjs/common';
import { StartNextActivityUseCase } from '../../activities/application/start-next-activity.use-case';
import { StartOpenQuestionActivityUseCase } from '../../activities/application/start-open-question-activity.use-case';
import { selectDeterministicRevisionSessionAction } from '../domain/deterministic-revision-session-action-selector';
import type {
  RevisionCoachNextActionDecision,
  RevisionCoachNextActionInput,
} from '../domain/revision-coach-next-action.entity';
import type {
  RevisionSessionActionPayload,
  RevisionSessionResponseDto,
  RevisionSessionRichClosedExercisePayload,
} from '../domain/revision-session.entity';
import {
  REVISION_COACH_NEXT_ACTION_GENERATOR,
  type RevisionCoachNextActionGenerator,
} from './revision-coach-next-action.generator';
import {
  REVISION_SESSIONS_REPOSITORY,
  type RevisionSessionPlanningContext,
  type RevisionSessionsRepository,
} from './revision-sessions.repository';

@Injectable()
export class RequestNextRevisionSessionActionUseCase {
  constructor(
    @Inject(REVISION_SESSIONS_REPOSITORY)
    private readonly revisionSessionsRepository: RevisionSessionsRepository,
    @Inject(REVISION_COACH_NEXT_ACTION_GENERATOR)
    private readonly revisionCoachNextActionGenerator: RevisionCoachNextActionGenerator,
    private readonly startNextActivity: StartNextActivityUseCase,
    private readonly startOpenQuestionActivity: StartOpenQuestionActivityUseCase,
  ) {}

  async execute(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RevisionSessionResponseDto> {
    const context =
      await this.revisionSessionsRepository.findPlanningContextByIdForStudent(
        input,
      );

    if (context.session.status !== 'STARTED') {
      throw new Error('Revision session is not started');
    }

    if (context.session.mode === 'QUICK' && context.session.courseId !== null) {
      throw new Error(
        'Quick course revision sessions do not support next actions',
      );
    }

    const coachInput = toCoachInput(input.studentId, context);
    const decision = await this.resolveDecision(coachInput);
    const actionPayload = await this.createActionPayload({
      studentId: input.studentId,
      subjectId: context.session.subjectId,
      sessionDocumentId: context.session.documentId,
      context,
      decision,
    });
    const response = await this.revisionSessionsRepository.appendAction({
      studentId: input.studentId,
      sessionId: input.sessionId,
      action: {
        kind: decision.actionKind,
        status: 'READY',
        activitySessionId: actionPayload.activitySessionId,
        documentId: actionPayload.documentId,
        knowledgeUnitId: actionPayload.knowledgeUnitId,
      },
    });

    return {
      ...response,
      currentAction: response.currentAction
        ? {
            ...response.currentAction,
            payload: actionPayload.payload,
          }
        : null,
    };
  }

  private async resolveDecision(
    input: RevisionCoachNextActionInput,
  ): Promise<RevisionCoachNextActionDecision> {
    try {
      return normalizeDecision(
        await this.revisionCoachNextActionGenerator.generate(input),
        input,
      );
    } catch {
      return selectDeterministicRevisionSessionAction(input);
    }
  }

  private async createActionPayload(input: {
    studentId: string;
    subjectId: string;
    sessionDocumentId: string | null;
    context: RevisionSessionPlanningContext;
    decision: RevisionCoachNextActionDecision;
  }): Promise<{
    payload: RevisionSessionActionPayload;
    activitySessionId: string | null;
    documentId: string | null;
    knowledgeUnitId: string | null;
  }> {
    if (input.decision.actionKind === 'OPEN_QUESTION') {
      if (!input.decision.knowledgeUnitId) {
        throw new Error('Revision coach no action available');
      }

      const activity = await this.startOpenQuestionActivity.execute({
        studentId: input.studentId,
        subjectId: input.subjectId,
        knowledgeUnitId: input.decision.knowledgeUnitId,
      });

      return {
        payload: activity,
        activitySessionId: activity.sessionId,
        documentId: activity.documentId ?? input.sessionDocumentId,
        knowledgeUnitId: activity.knowledgeUnitId,
      };
    }

    if (input.decision.actionKind === 'RICH_CLOSED_EXERCISE') {
      if (!input.decision.knowledgeUnitId) {
        throw new Error('Revision coach no action available');
      }

      const knowledgeUnit = input.context.allowedKnowledgeUnits.find(
        (unit) => unit.id === input.decision.knowledgeUnitId,
      );
      const documentId = knowledgeUnit?.documentId ?? input.sessionDocumentId;

      return {
        payload: createRichClosedExercisePayload({
          subjectId: input.subjectId,
          documentId,
          knowledgeUnitId: input.decision.knowledgeUnitId,
          knowledgeUnitTitle: knowledgeUnit?.title ?? null,
          reasonCode: input.decision.reasonCode,
        }),
        activitySessionId: null,
        documentId,
        knowledgeUnitId: input.decision.knowledgeUnitId,
      };
    }

    const courseBoundKnowledgeUnitId =
      input.context.session.courseId !== null
        ? (input.decision.knowledgeUnitId ??
          input.context.session.knowledgeUnitId ??
          input.context.allowedKnowledgeUnitIds[0])
        : input.decision.knowledgeUnitId;

    const activity = await this.startNextActivity.execute({
      studentId: input.studentId,
      subjectId: input.subjectId,
      knowledgeUnitId: courseBoundKnowledgeUnitId ?? undefined,
    });

    return {
      payload: activity,
      activitySessionId: activity.sessionId,
      documentId: activity.documentId ?? input.sessionDocumentId,
      knowledgeUnitId: courseBoundKnowledgeUnitId ?? null,
    };
  }
}

function toCoachInput(
  studentId: string,
  context: RevisionSessionPlanningContext,
): RevisionCoachNextActionInput {
  const sessionKnowledgeUnitId =
    context.session.knowledgeUnitId &&
    context.allowedKnowledgeUnitIds.includes(context.session.knowledgeUnitId)
      ? context.session.knowledgeUnitId
      : null;
  const availableActions =
    context.allowedKnowledgeUnitIds.length > 0
      ? (['DIAGNOSTIC_QUIZ', 'OPEN_QUESTION', 'RICH_CLOSED_EXERCISE'] as const)
      : (['DIAGNOSTIC_QUIZ'] as const);

  return {
    studentId,
    sessionId: context.session.id,
    subjectId: context.session.subjectId,
    documentId: context.session.documentId,
    sessionKnowledgeUnitId,
    history: context.actions.map((action) => ({
      kind: action.kind,
      status: action.status,
      displayOrder: action.displayOrder,
      activitySessionId: action.activitySessionId,
      knowledgeUnitId:
        action.knowledgeUnitId &&
        context.allowedKnowledgeUnitIds.includes(action.knowledgeUnitId)
          ? action.knowledgeUnitId
          : null,
    })),
    availableActions: [...availableActions],
    allowedKnowledgeUnitIds: [...context.allowedKnowledgeUnitIds],
  };
}

function normalizeDecision(
  decision: RevisionCoachNextActionDecision,
  input: RevisionCoachNextActionInput,
): RevisionCoachNextActionDecision {
  if (!input.availableActions.includes(decision.actionKind)) {
    throw new Error('REVISION_COACH_ACTION_NOT_ALLOWED');
  }

  if (
    decision.knowledgeUnitId !== null &&
    !input.allowedKnowledgeUnitIds.includes(decision.knowledgeUnitId)
  ) {
    throw new Error('REVISION_COACH_KNOWLEDGE_UNIT_NOT_ALLOWED');
  }

  if (
    (decision.actionKind === 'OPEN_QUESTION' ||
      decision.actionKind === 'RICH_CLOSED_EXERCISE') &&
    (decision.knowledgeUnitId === null ||
      !input.allowedKnowledgeUnitIds.includes(decision.knowledgeUnitId))
  ) {
    throw new Error('REVISION_COACH_KNOWLEDGE_UNIT_NOT_ALLOWED');
  }

  return decision;
}

function createRichClosedExercisePayload(input: {
  subjectId: string;
  documentId: string | null;
  knowledgeUnitId: string;
  knowledgeUnitTitle: string | null;
  reasonCode: RevisionCoachNextActionDecision['reasonCode'];
}): RevisionSessionRichClosedExercisePayload {
  return {
    type: 'rich_closed_exercise',
    subjectId: input.subjectId,
    documentId: input.documentId,
    knowledgeUnitId: input.knowledgeUnitId,
    knowledgeUnitTitle: input.knowledgeUnitTitle,
    reason: revisionRichClosedReason(input.reasonCode),
    estimatedMinutes: 8,
    preferredAction: 'rich_closed_exercise',
  };
}

function revisionRichClosedReason(
  reasonCode: RevisionCoachNextActionDecision['reasonCode'],
): string {
  return {
    ALTERNATE_ACTIVITY_TYPE:
      'Questions riches recommandées pour varier la révision.',
    REINFORCE_CURRENT_KNOWLEDGE_UNIT:
      'Questions riches recommandées pour consolider cette notion.',
    CHECK_UNDERSTANDING:
      'Questions riches recommandées pour vérifier la compréhension.',
    CONTINUE_SESSION_DEFAULT:
      'Questions riches recommandées pour poursuivre la session.',
  }[reasonCode];
}

```

### src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.spec.ts

```ts
import { PrismaRevisionSessionsRepository } from './prisma-revision-sessions.repository';

describe('PrismaRevisionSessionsRepository', () => {
  it('validates subject, document and knowledge unit ownership', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.document.findFirst.mockResolvedValue({ id: 'document-1' });
    prisma.knowledgeUnit.findFirst.mockResolvedValue({
      id: 'unit-1',
      documentId: 'document-1',
      title: 'Notion 1',
    });

    await expect(
      repository.ensureStartContext({
        studentId: 'student-1',
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      }),
    ).resolves.toEqual({
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      knowledgeUnitTitle: 'Notion 1',
    });
    expect(prisma.subject.findFirst).toHaveBeenCalledWith({
      where: { id: 'subject-1', studentId: 'student-1' },
      select: { id: true },
    });
  });

  it('rejects cross-student context as not found', async () => {
    const { repository } = createRepository();

    await expect(
      repository.ensureStartContext({
        studentId: 'student-2',
        subjectId: 'subject-1',
      }),
    ).rejects.toThrow('Revision subject not found');
  });

  it('persists a session and initial action in one transaction', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.create.mockResolvedValue(revisionSessionRecord());
    prisma.revisionSessionAction.create.mockResolvedValue(actionRecord());

    const result = await repository.createWithInitialAction({
      studentId: 'student-1',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      action: {
        kind: 'OPEN_QUESTION',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: 'activity-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    });

    expect(prisma.revisionSession.create).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: null,
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        status: 'STARTED',
        mode: 'QUICK',
      },
    });
    expect(prisma.revisionSessionAction.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'revision-session-1',
        studentId: 'student-1',
        subjectId: 'subject-1',
        kind: 'OPEN_QUESTION',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: 'activity-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    });
    expect(result.history).toHaveLength(1);
    expect(result.currentAction?.kind).toBe('OPEN_QUESTION');
    expect(result.session.courseId).toBeNull();
    expect(result.session.mode).toBe('QUICK');
  });

  it('persists the courseId for course-level quick sessions', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.create.mockResolvedValue(
      revisionSessionRecord({ courseId: 'course-1' }),
    );
    prisma.revisionSessionAction.create.mockResolvedValue(actionRecord());

    const result = await repository.createWithInitialAction({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      action: {
        kind: 'DIAGNOSTIC_QUIZ',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: 'activity-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    });

    expect(prisma.revisionSession.create.mock.calls).toMatchObject([
      [
        {
          data: {
            courseId: 'course-1',
            mode: 'QUICK',
          },
        },
      ],
    ]);
    expect(result.session.courseId).toBe('course-1');
  });

  it('persists a rich closed session action without activity session id', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.create.mockResolvedValue(revisionSessionRecord());
    prisma.revisionSessionAction.create.mockResolvedValue(
      actionRecord({
        kind: 'RICH_CLOSED_EXERCISE',
        activitySessionId: null,
      }),
    );

    const result = await repository.createWithInitialAction({
      studentId: 'student-1',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      action: {
        kind: 'RICH_CLOSED_EXERCISE',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: null,
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    });

    expect(prisma.revisionSessionAction.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'revision-session-1',
        studentId: 'student-1',
        subjectId: 'subject-1',
        kind: 'RICH_CLOSED_EXERCISE',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: null,
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    });
    expect(result.currentAction?.kind).toBe('RICH_CLOSED_EXERCISE');
    expect(result.currentAction?.payload).toEqual({
      type: 'rich_closed_exercise',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      reason: 'Questions riches recommandées pour consolider cette notion.',
      estimatedMinutes: 8,
      preferredAction: 'rich_closed_exercise',
    });
  });

  it('loads an owned session with sorted action history', async () => {
    const { prisma, repository } = createRepository();
    prisma.revisionSession.findFirst.mockResolvedValue({
      ...revisionSessionRecord(),
      actions: [actionRecord()],
    });

    const result = await repository.findByIdForStudent({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(prisma.revisionSession.findFirst).toHaveBeenCalledWith({
      where: { id: 'revision-session-1', studentId: 'student-1' },
      include: {
        actions: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            activitySession: {
              select: {
                id: true,
                subjectId: true,
                documentId: true,
                knowledgeUnitId: true,
                type: true,
                version: true,
                questions: {
                  orderBy: { displayOrder: 'asc' },
                  select: {
                    id: true,
                    knowledgeUnitId: true,
                    prompt: true,
                    difficulty: true,
                    displayOrder: true,
                    choices: true,
                    selectionMode: true,
                    minSelections: true,
                    maxSelections: true,
                    sources: {
                      include: {
                        chunk: {
                          select: {
                            pageNumber: true,
                            index: true,
                          },
                        },
                      },
                    },
                    visuals: {
                      orderBy: { displayOrder: 'asc' },
                      select: {
                        id: true,
                        type: true,
                        displayOrder: true,
                        payload: true,
                        sources: {
                          include: {
                            chunk: {
                              select: {
                                pageNumber: true,
                                index: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    expect(result.currentAction?.payload).toEqual({
      type: 'open_question',
      sessionId: 'activity-session-1',
    });
  });

  it('preserves public diagnostic visuals when loading a quick revision session', async () => {
    const { prisma, repository } = createRepository();
    prisma.revisionSession.findFirst.mockResolvedValue({
      ...revisionSessionRecord({ courseId: 'course-1' }),
      actions: [
        actionRecord({
          kind: 'DIAGNOSTIC_QUIZ',
          activitySession: {
            id: 'activity-session-1',
            subjectId: 'subject-1',
            documentId: 'document-1',
            knowledgeUnitId: 'unit-1',
            type: 'DIAGNOSTIC_QUIZ',
            version: 3,
            questions: [
              diagnosticQuestionRecord({
                visuals: [
                  {
                    id: 'visual-1',
                    type: 'CHART',
                    displayOrder: 0,
                    payload: {
                      chartType: 'bar',
                      title: 'Répartition des pouvoirs',
                      data: [{ label: 'Exécutif', value: 2 }],
                    },
                    sources: [
                      {
                        chunkId: 'chunk-1',
                        chunk: { pageNumber: 4, index: 2 },
                      },
                    ],
                  },
                ],
              }),
            ],
          },
        }),
      ],
    });

    const result = await repository.findByIdForStudent({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    const payload = result.currentAction?.payload as {
      questions: Array<{ visuals?: unknown[] }>;
    };
    const serializedPayload = JSON.stringify(payload);

    expect(payload.questions[0]?.visuals).toEqual([
      {
        id: 'visual-1',
        type: 'CHART',
        displayOrder: 0,
        chartType: 'bar',
        title: 'Répartition des pouvoirs',
        data: [{ label: 'Exécutif', value: 2 }],
        sources: [{ chunkId: 'chunk-1', pageNumber: 4, index: 2 }],
      },
    ]);
    expect(serializedPayload).not.toContain('correctChoiceId');
    expect(serializedPayload).not.toContain('storagePath');
    expect(serializedPayload).not.toContain('promptVersion');
    expect(serializedPayload).not.toContain('provider');
  });

  it('loads a planning context with action activity knowledge units and candidates', async () => {
    const { prisma, repository } = createRepository();
    prisma.revisionSession.findFirst.mockResolvedValue({
      ...revisionSessionRecord(),
      actions: [
        {
          ...actionRecord(),
          knowledgeUnitId: null,
          activitySession: { knowledgeUnitId: 'unit-from-activity' },
        },
      ],
    });
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      { id: 'unit-1', documentId: 'document-1', title: 'Notion 1' },
      {
        id: 'unit-from-activity',
        documentId: 'document-2',
        title: 'Notion 2',
      },
    ]);

    const result = await repository.findPlanningContextByIdForStudent({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(prisma.revisionSession.findFirst).toHaveBeenCalledWith({
      where: { id: 'revision-session-1', studentId: 'student-1' },
      include: {
        actions: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            activitySession: {
              select: { knowledgeUnitId: true },
            },
          },
        },
      },
    });
    expect(prisma.knowledgeUnit.findMany).toHaveBeenCalledWith({
      where: {
        subjectId: 'subject-1',
        subject: { studentId: 'student-1' },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      take: 20,
      select: { id: true, documentId: true, title: true },
    });
    expect(result.actions[0]?.knowledgeUnitId).toBe('unit-from-activity');
    expect(result.allowedKnowledgeUnitIds).toEqual([
      'unit-1',
      'unit-from-activity',
    ]);
    expect(result.allowedKnowledgeUnits).toEqual([
      { id: 'unit-1', documentId: 'document-1', title: 'Notion 1' },
      {
        id: 'unit-from-activity',
        documentId: 'document-2',
        title: 'Notion 2',
      },
    ]);
  });

  it('limits planning candidates to READY course documents for course sessions', async () => {
    const { prisma, repository } = createRepository();
    prisma.revisionSession.findFirst.mockResolvedValue({
      ...revisionSessionRecord({ courseId: 'course-1' }),
      actions: [],
    });
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      { id: 'unit-course-1', documentId: 'document-1', title: 'Notion 1' },
    ]);

    const result = await repository.findPlanningContextByIdForStudent({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(prisma.knowledgeUnit.findMany).toHaveBeenCalledWith({
      where: {
        subjectId: 'subject-1',
        subject: { studentId: 'student-1' },
        document: {
          studentId: 'student-1',
          courseId: 'course-1',
          kind: 'COURSE_PDF',
          status: 'READY',
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      take: 20,
      select: { id: true, documentId: true, title: true },
    });
    expect(result.allowedKnowledgeUnitIds).toEqual(['unit-course-1']);
  });

  it('appends an action with the next display order inside a transaction', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst
      .mockResolvedValueOnce(revisionSessionRecord())
      .mockResolvedValueOnce({
        ...revisionSessionRecord(),
        actions: [
          actionRecord(),
          { ...actionRecord(), id: 'action-2', displayOrder: 1 },
        ],
      });
    prisma.revisionSessionAction.aggregate.mockResolvedValue({
      _max: { displayOrder: 0 },
    });
    prisma.revisionSessionAction.create.mockResolvedValue({
      ...actionRecord(),
      id: 'action-2',
      displayOrder: 1,
      activitySessionId: 'quiz-session-2',
      kind: 'DIAGNOSTIC_QUIZ',
      documentId: null,
      knowledgeUnitId: null,
    });

    const result = await repository.appendAction({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
      action: {
        kind: 'DIAGNOSTIC_QUIZ',
        status: 'READY',
        activitySessionId: 'quiz-session-2',
        documentId: null,
        knowledgeUnitId: null,
      },
    });

    expect(prisma.revisionSessionAction.aggregate).toHaveBeenCalledWith({
      where: { sessionId: 'revision-session-1' },
      _max: { displayOrder: true },
    });
    expect(prisma.revisionSessionAction.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'revision-session-1',
        studentId: 'student-1',
        subjectId: 'subject-1',
        kind: 'DIAGNOSTIC_QUIZ',
        status: 'READY',
        displayOrder: 1,
        activitySessionId: 'quiz-session-2',
        documentId: null,
        knowledgeUnitId: null,
      },
    });
    expect(result.history).toHaveLength(2);
    expect(result.currentAction?.displayOrder).toBe(1);
  });

  it('refuses to append an action to a course-level quick session', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({ courseId: 'course-1', mode: 'QUICK' }),
    );

    await expect(
      repository.appendAction({
        studentId: 'student-1',
        sessionId: 'revision-session-1',
        action: {
          kind: 'DIAGNOSTIC_QUIZ',
          status: 'READY',
          activitySessionId: 'quiz-session-2',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
        },
      }),
    ).rejects.toThrow(
      'Quick course revision sessions do not support next actions',
    );

    expect(prisma.revisionSessionAction.aggregate).not.toHaveBeenCalled();
    expect(prisma.revisionSessionAction.create).not.toHaveBeenCalled();
  });

  it('completes a submitted quick diagnostic session and returns the backend result', async () => {
    const { prisma, repository } = createRepository();
    const completedAt = new Date('2026-06-15T10:05:00.000Z');
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        courseId: 'course-1',
        actions: [diagnosticActionRecord()],
      }),
    );
    prisma.activitySession.findFirst.mockResolvedValue(
      diagnosticActivityRecord({
        result: {
          correctAnswers: 3,
          totalQuestions: 4,
          score: 0.75,
        },
        answers: [
          answerRecord({ knowledgeUnitId: 'unit-a', title: 'Unit A' }),
          answerRecord({
            knowledgeUnitId: 'unit-a',
            title: 'Unit A',
            isCorrect: false,
          }),
          answerRecord({ knowledgeUnitId: 'unit-b', title: 'Unit B' }),
        ],
      }),
    );

    const result = await repository.completeQuickSession({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
      completedAt,
    });

    expect(prisma.revisionSessionAction.update).toHaveBeenCalledWith({
      where: { id: 'action-1' },
      data: { status: 'COMPLETED', completedAt },
    });
    expect(prisma.revisionSession.update).toHaveBeenCalledWith({
      where: { id: 'revision-session-1' },
      data: { status: 'COMPLETED', completedAt },
    });
    expect(result.summary).toEqual({
      correctAnswers: 3,
      totalQuestions: 4,
      score: 0.75,
      durationSeconds: 300,
    });
    expect(result.knowledgeUnits).toEqual([
      {
        knowledgeUnitId: 'unit-a',
        title: 'Unit A',
        correctAnswers: 1,
        totalQuestions: 2,
        score: 0.5,
        state: 'TO_REVIEW',
      },
      {
        knowledgeUnitId: 'unit-b',
        title: 'Unit B',
        correctAnswers: 1,
        totalQuestions: 1,
        score: 1,
        state: 'MASTERED',
      },
    ]);
  });

  it('keeps quick completion idempotent for an already completed session', async () => {
    const { prisma, repository } = createRepository();
    const existingCompletedAt = new Date('2026-06-15T10:03:00.000Z');
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        courseId: 'course-1',
        status: 'COMPLETED',
        completedAt: existingCompletedAt,
        actions: [
          diagnosticActionRecord({
            status: 'COMPLETED',
            completedAt: existingCompletedAt,
          }),
        ],
      }),
    );
    prisma.activitySession.findFirst.mockResolvedValue(
      diagnosticActivityRecord(),
    );

    const result = await repository.completeQuickSession({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
      completedAt: new Date('2026-06-15T10:05:00.000Z'),
    });

    expect(prisma.revisionSessionAction.update).not.toHaveBeenCalled();
    expect(prisma.revisionSession.update).not.toHaveBeenCalled();
    expect(result.session.completedAt).toBe(existingCompletedAt);
  });

  it('refuses to complete a quick session when the diagnostic activity is not submitted', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        courseId: 'course-1',
        actions: [diagnosticActionRecord()],
      }),
    );
    prisma.activitySession.findFirst.mockResolvedValue(
      diagnosticActivityRecord({ status: 'STARTED' }),
    );

    await expect(
      repository.completeQuickSession({
        studentId: 'student-1',
        sessionId: 'revision-session-1',
        completedAt: new Date('2026-06-15T10:05:00.000Z'),
      }),
    ).rejects.toThrow('Revision session activity not submitted');

    expect(prisma.revisionSessionAction.update).not.toHaveBeenCalled();
    expect(prisma.revisionSession.update).not.toHaveBeenCalled();
  });

  it('refuses to complete a quick session without an activity result', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        courseId: 'course-1',
        actions: [diagnosticActionRecord()],
      }),
    );
    prisma.activitySession.findFirst.mockResolvedValue(
      diagnosticActivityRecord({ result: null }),
    );

    await expect(
      repository.completeQuickSession({
        studentId: 'student-1',
        sessionId: 'revision-session-1',
        completedAt: new Date('2026-06-15T10:05:00.000Z'),
      }),
    ).rejects.toThrow('Revision session result not found');

    expect(prisma.revisionSessionAction.update).not.toHaveBeenCalled();
    expect(prisma.revisionSession.update).not.toHaveBeenCalled();
  });

  it('refuses to complete when the current action is not a diagnostic quiz', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        courseId: 'course-1',
        actions: [actionRecord({ kind: 'OPEN_QUESTION' })],
      }),
    );

    await expect(
      repository.completeQuickSession({
        studentId: 'student-1',
        sessionId: 'revision-session-1',
        completedAt: new Date('2026-06-15T10:05:00.000Z'),
      }),
    ).rejects.toThrow('Revision session not ready to complete');

    expect(prisma.activitySession.findFirst).not.toHaveBeenCalled();
  });

  it('refuses to complete unsupported revision session modes', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        mode: 'DEEP',
        actions: [diagnosticActionRecord()],
      }),
    );

    await expect(
      repository.completeQuickSession({
        studentId: 'student-1',
        sessionId: 'revision-session-1',
        completedAt: new Date('2026-06-15T10:05:00.000Z'),
      }),
    ).rejects.toThrow('Revision session completion unsupported');
  });

  it('returns not found when completing a session outside the student ownership', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst.mockResolvedValue(null);

    await expect(
      repository.completeQuickSession({
        studentId: 'student-2',
        sessionId: 'revision-session-1',
        completedAt: new Date('2026-06-15T10:05:00.000Z'),
      }),
    ).rejects.toThrow('Revision session not found');
  });

  it('loads a completed result without mutating the session', async () => {
    const { prisma, repository } = createRepository();
    const completedAt = new Date('2026-06-15T10:05:00.000Z');
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        courseId: 'course-1',
        status: 'COMPLETED',
        completedAt,
        actions: [
          diagnosticActionRecord({
            status: 'COMPLETED',
            completedAt,
          }),
        ],
      }),
    );
    prisma.activitySession.findFirst.mockResolvedValue(
      diagnosticActivityRecord({
        result: {
          correctAnswers: 3,
          totalQuestions: 5,
          score: null,
        },
        answers: [
          answerRecord({ knowledgeUnitId: 'unit-a', title: 'Unit A' }),
          answerRecord({ knowledgeUnitId: 'unit-a', title: 'Unit A' }),
          answerRecord({
            knowledgeUnitId: 'unit-b',
            title: 'Unit B',
            isCorrect: false,
          }),
        ],
      }),
    );

    const result = await repository.findResultByIdForStudent({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(prisma.revisionSessionAction.update).not.toHaveBeenCalled();
    expect(prisma.revisionSession.update).not.toHaveBeenCalled();
    expect(result.summary.score).toBe(0.6);
    expect(result.knowledgeUnits).toEqual([
      {
        knowledgeUnitId: 'unit-a',
        title: 'Unit A',
        correctAnswers: 2,
        totalQuestions: 2,
        score: 1,
        state: 'MASTERED',
      },
      {
        knowledgeUnitId: 'unit-b',
        title: 'Unit B',
        correctAnswers: 0,
        totalQuestions: 1,
        score: 0,
        state: 'TO_REVIEW',
      },
    ]);
  });

  it('refuses to load a result for an incomplete session', async () => {
    const { prisma, repository } = createRepository();
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        courseId: 'course-1',
        actions: [diagnosticActionRecord()],
      }),
    );

    await expect(
      repository.findResultByIdForStudent({
        studentId: 'student-1',
        sessionId: 'revision-session-1',
      }),
    ).rejects.toThrow('Revision session not completed');

    expect(prisma.activitySession.findFirst).not.toHaveBeenCalled();
  });

  it('refuses to load a completed result when the activity result is missing', async () => {
    const { prisma, repository } = createRepository();
    const completedAt = new Date('2026-06-15T10:05:00.000Z');
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        courseId: 'course-1',
        status: 'COMPLETED',
        completedAt,
        actions: [
          diagnosticActionRecord({
            status: 'COMPLETED',
            completedAt,
          }),
        ],
      }),
    );
    prisma.activitySession.findFirst.mockResolvedValue(
      diagnosticActivityRecord({ result: null }),
    );

    await expect(
      repository.findResultByIdForStudent({
        studentId: 'student-1',
        sessionId: 'revision-session-1',
      }),
    ).rejects.toThrow('Revision session result not found');
  });

  it('clamps stored result scores when loading a completed result', async () => {
    const { prisma, repository } = createRepository();
    const completedAt = new Date('2026-06-15T10:05:00.000Z');
    prisma.revisionSession.findFirst.mockResolvedValue(
      revisionSessionRecord({
        courseId: 'course-1',
        status: 'COMPLETED',
        completedAt,
        actions: [
          diagnosticActionRecord({
            status: 'COMPLETED',
            completedAt,
          }),
        ],
      }),
    );
    prisma.activitySession.findFirst.mockResolvedValue(
      diagnosticActivityRecord({
        result: {
          correctAnswers: 0,
          totalQuestions: 0,
          score: 1.5,
        },
        answers: [],
      }),
    );

    const result = await repository.findResultByIdForStudent({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(result.summary.score).toBe(1);
    expect(result.summary.durationSeconds).toBe(300);
    expect(result.knowledgeUnits).toEqual([]);
  });
});

type PrismaRevisionSessionsMock = ReturnType<typeof createPrismaMock>;
type TransactionCallback = (tx: PrismaRevisionSessionsMock) => Promise<unknown>;

function createRepository() {
  const prisma = createPrismaMock();

  return {
    prisma,
    repository: new PrismaRevisionSessionsRepository(prisma as never),
  };
}

function createPrismaMock() {
  const prisma = {
    subject: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    document: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    knowledgeUnit: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(),
    },
    revisionSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    revisionSessionAction: {
      create: jest.fn(),
      aggregate: jest.fn(),
      update: jest.fn(),
    },
    activitySession: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  return prisma;
}

function revisionSessionRecord(
  overrides: Partial<ReturnType<typeof revisionSessionRecordShape>> = {},
) {
  return { ...revisionSessionRecordShape(), ...overrides };
}

function revisionSessionRecordShape() {
  return {
    id: 'revision-session-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    courseId: null,
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    mode: 'QUICK',
    status: 'STARTED',
    createdAt: new Date('2026-06-15T10:00:00.000Z'),
    updatedAt: new Date('2026-06-15T10:00:00.000Z'),
    completedAt: null,
  };
}

function actionRecord(
  overrides: Partial<ReturnType<typeof actionRecordShape>> = {},
) {
  return { ...actionRecordShape(), ...overrides };
}

function actionRecordShape() {
  return {
    id: 'action-1',
    sessionId: 'revision-session-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    kind: 'OPEN_QUESTION',
    status: 'READY',
    displayOrder: 0,
    activitySessionId: 'activity-session-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    createdAt: new Date('2026-06-15T10:00:00.000Z'),
    completedAt: null,
  };
}

function diagnosticActionRecord(
  overrides: Partial<ReturnType<typeof actionRecordShape>> = {},
) {
  return actionRecord({
    kind: 'DIAGNOSTIC_QUIZ',
    activitySessionId: 'activity-session-1',
    ...overrides,
  });
}

function diagnosticQuestionRecord(
  overrides: Partial<ReturnType<typeof diagnosticQuestionRecordShape>> = {},
) {
  return { ...diagnosticQuestionRecordShape(), ...overrides };
}

function diagnosticQuestionRecordShape() {
  return {
    id: 'question-1',
    knowledgeUnitId: 'unit-1',
    prompt: 'Quel principe organise les pouvoirs ?',
    difficulty: 'MEDIUM' as const,
    displayOrder: 0,
    choices: [
      { id: 'choice-1', label: 'La séparation des pouvoirs' },
      { id: 'choice-2', label: 'Le mandat impératif' },
    ],
    selectionMode: 'SINGLE' as const,
    minSelections: null,
    maxSelections: null,
    sources: [],
    visuals: [],
  };
}

function diagnosticActivityRecord(
  overrides: Partial<ReturnType<typeof diagnosticActivityRecordShape>> = {},
) {
  return { ...diagnosticActivityRecordShape(), ...overrides };
}

function diagnosticActivityRecordShape() {
  return {
    id: 'activity-session-1',
    studentId: 'student-1',
    status: 'COMPLETED',
    type: 'DIAGNOSTIC_QUIZ',
    result: {
      correctAnswers: 1,
      totalQuestions: 1,
      score: 1,
    },
    answers: [answerRecord()],
  };
}

function answerRecord(
  overrides: {
    knowledgeUnitId?: string;
    title?: string;
    isCorrect?: boolean;
  } = {},
) {
  return {
    isCorrect: overrides.isCorrect ?? true,
    question: {
      knowledgeUnitId: overrides.knowledgeUnitId ?? 'unit-1',
      knowledgeUnit: {
        title: overrides.title ?? 'Notion 1',
      },
    },
  };
}

```

### src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.ts

```ts
import { Injectable } from '@nestjs/common';
import {
  ActivityStatus,
  ActivityType,
  RevisionSessionActionKind,
  RevisionSessionActionStatus,
  RevisionSessionMode,
  RevisionSessionStatus,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type {
  RevisionSessionActionKindValue,
  RevisionSessionActionStatusValue,
  RevisionSessionActionPayload,
  RevisionSessionModeValue,
  RevisionSessionResponseDto,
  RevisionSessionStatusValue,
} from '../domain/revision-session.entity';
import {
  revisionSessionResultStateForScore,
  type RevisionSessionResultDto,
} from '../domain/revision-session-result.entity';
import type {
  RevisionSessionsRepository,
  RevisionSessionPlanningContext,
  RevisionSessionStartContext,
} from '../application/revision-sessions.repository';

type RevisionSessionRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  courseId: string | null;
  documentId: string | null;
  knowledgeUnitId: string | null;
  mode: RevisionSessionModeValue;
  status: RevisionSessionStatusValue;
  createdAt: Date;
  completedAt: Date | null;
  actions?: RevisionSessionActionRecord[];
};

type RevisionSessionActionRecord = {
  id: string;
  sessionId: string;
  studentId: string;
  subjectId: string;
  kind: RevisionSessionActionKindValue;
  status: RevisionSessionActionStatusValue;
  displayOrder: number;
  activitySessionId: string | null;
  documentId: string | null;
  knowledgeUnitId: string | null;
  createdAt: Date;
  completedAt: Date | null;
  activitySession?: {
    id?: string;
    subjectId?: string;
    documentId?: string | null;
    knowledgeUnitId: string;
    type?: string;
    version?: number;
    questions?: RevisionSessionActivityQuestionRecord[];
  } | null;
};

type RevisionSessionActivityQuestionRecord = {
  id: string;
  knowledgeUnitId: string;
  prompt: string;
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  displayOrder: number;
  choices: unknown;
  selectionMode: 'SINGLE' | 'MULTIPLE';
  minSelections: number | null;
  maxSelections: number | null;
  sources?: Array<{
    chunkId: string;
    chunk: {
      pageNumber: number | null;
      index: number;
    };
  }>;
  visuals?: Array<{
    id: string;
    type: 'IMAGE' | 'CHART' | 'DIAGRAM';
    displayOrder: number;
    payload: unknown;
    sources?: Array<{
      chunkId: string;
      chunk: {
        pageNumber: number | null;
        index: number;
      };
    }>;
  }>;
};

type RevisionSessionActivityResultRecord = {
  correctAnswers: number;
  totalQuestions: number;
  score: number | null;
};

type RevisionSessionAnswerRecord = {
  isCorrect: boolean;
  question: {
    knowledgeUnitId: string;
    knowledgeUnit: {
      title: string;
    };
  };
};

type RevisionSessionActivityForResultRecord = {
  id: string;
  studentId: string;
  status: string;
  type: string;
  result: RevisionSessionActivityResultRecord | null;
  answers: RevisionSessionAnswerRecord[];
};

type CompletedRevisionSessionRecord = RevisionSessionRecord & {
  status: 'COMPLETED';
  completedAt: Date;
};

type RevisionSessionActivityWithResultRecord =
  RevisionSessionActivityForResultRecord & {
    result: RevisionSessionActivityResultRecord;
  };

@Injectable()
export class PrismaRevisionSessionsRepository implements RevisionSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ensureStartContext(input: {
    studentId: string;
    subjectId: string;
    documentId?: string;
    knowledgeUnitId?: string;
  }): Promise<RevisionSessionStartContext> {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: input.subjectId,
        studentId: input.studentId,
      },
      select: {
        id: true,
      },
    });

    if (!subject) {
      throw new Error('Revision subject not found');
    }

    let documentId: string | null = null;

    if (input.documentId) {
      const document = await this.prisma.document.findFirst({
        where: {
          id: input.documentId,
          subjectId: input.subjectId,
          studentId: input.studentId,
        },
        select: {
          id: true,
        },
      });

      if (!document) {
        throw new Error('Revision document not found');
      }

      documentId = document.id;
    }

    let knowledgeUnitId: string | null = null;
    let knowledgeUnitTitle: string | null = null;

    if (input.knowledgeUnitId) {
      const knowledgeUnit = await this.prisma.knowledgeUnit.findFirst({
        where: {
          id: input.knowledgeUnitId,
          subjectId: input.subjectId,
          ...(documentId ? { documentId } : {}),
          subject: {
            studentId: input.studentId,
          },
        },
        select: {
          id: true,
          documentId: true,
          title: true,
        },
      });

      if (!knowledgeUnit) {
        throw new Error('Revision knowledge unit not found');
      }

      knowledgeUnitId = knowledgeUnit.id;
      knowledgeUnitTitle = knowledgeUnit.title;
      documentId = documentId ?? knowledgeUnit.documentId;
    }

    return {
      subjectId: input.subjectId,
      documentId,
      knowledgeUnitId,
      knowledgeUnitTitle,
    };
  }

  async createWithInitialAction(input: {
    studentId: string;
    subjectId: string;
    courseId?: string | null;
    documentId: string | null;
    knowledgeUnitId: string | null;
    action: {
      kind: RevisionSessionActionKindValue;
      status: RevisionSessionActionStatusValue;
      displayOrder: number;
      activitySessionId: string | null;
      documentId: string | null;
      knowledgeUnitId: string | null;
    };
  }): Promise<RevisionSessionResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.revisionSession.create({
        data: {
          studentId: input.studentId,
          subjectId: input.subjectId,
          courseId: input.courseId ?? null,
          documentId: input.documentId,
          knowledgeUnitId: input.knowledgeUnitId,
          status: RevisionSessionStatus.STARTED,
          mode: RevisionSessionMode.QUICK,
        },
      });
      const action = await tx.revisionSessionAction.create({
        data: {
          sessionId: session.id,
          studentId: input.studentId,
          subjectId: input.subjectId,
          kind: toPrismaActionKind(input.action.kind),
          status: toPrismaActionStatus(input.action.status),
          displayOrder: input.action.displayOrder,
          activitySessionId: input.action.activitySessionId,
          documentId: input.action.documentId,
          knowledgeUnitId: input.action.knowledgeUnitId,
        },
      });

      return toRevisionSessionResponse(session, [action]);
    });
  }

  async findByIdForStudent(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RevisionSessionResponseDto> {
    const session = (await this.prisma.revisionSession.findFirst({
      where: {
        id: input.sessionId,
        studentId: input.studentId,
      },
      include: {
        actions: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            activitySession: {
              select: {
                id: true,
                subjectId: true,
                documentId: true,
                knowledgeUnitId: true,
                type: true,
                version: true,
                questions: {
                  orderBy: { displayOrder: 'asc' },
                  select: {
                    id: true,
                    knowledgeUnitId: true,
                    prompt: true,
                    difficulty: true,
                    displayOrder: true,
                    choices: true,
                    selectionMode: true,
                    minSelections: true,
                    maxSelections: true,
                    sources: {
                      include: {
                        chunk: {
                          select: {
                            pageNumber: true,
                            index: true,
                          },
                        },
                      },
                    },
                    visuals: {
                      orderBy: { displayOrder: 'asc' },
                      select: {
                        id: true,
                        type: true,
                        displayOrder: true,
                        payload: true,
                        sources: {
                          include: {
                            chunk: {
                              select: {
                                pageNumber: true,
                                index: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })) as RevisionSessionRecord | null;

    if (!session) {
      throw new Error('Revision session not found');
    }

    return toRevisionSessionResponse(session, session.actions ?? []);
  }

  async completeQuickSession(input: {
    studentId: string;
    sessionId: string;
    completedAt: Date;
  }): Promise<RevisionSessionResultDto> {
    return this.prisma.$transaction(async (tx) => {
      const session = (await tx.revisionSession.findFirst({
        where: {
          id: input.sessionId,
          studentId: input.studentId,
        },
        include: {
          actions: {
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      })) as RevisionSessionRecord | null;

      if (!session) {
        throw new Error('Revision session not found');
      }

      if (session.mode !== RevisionSessionMode.QUICK) {
        throw new Error('Revision session completion unsupported');
      }

      const action = selectCurrentAction(session.actions ?? []);

      if (
        !action ||
        action.kind !== RevisionSessionActionKind.DIAGNOSTIC_QUIZ ||
        !action.activitySessionId
      ) {
        throw new Error('Revision session not ready to complete');
      }

      const activity = (await tx.activitySession.findFirst({
        where: {
          id: action.activitySessionId,
          studentId: input.studentId,
          type: ActivityType.DIAGNOSTIC_QUIZ,
        },
        include: {
          result: true,
          answers: {
            include: {
              question: {
                select: {
                  knowledgeUnitId: true,
                  knowledgeUnit: {
                    select: {
                      title: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      })) as RevisionSessionActivityForResultRecord | null;

      if (!activity) {
        throw new Error('Revision session activity not found');
      }

      if (activity.status !== ActivityStatus.COMPLETED) {
        throw new Error('Revision session activity not submitted');
      }

      if (!activity.result) {
        throw new Error('Revision session result not found');
      }

      const completedAt = session.completedAt ?? input.completedAt;
      const activityWithResult: RevisionSessionActivityWithResultRecord = {
        ...activity,
        result: activity.result,
      };
      const completedSession: CompletedRevisionSessionRecord = {
        ...session,
        status: RevisionSessionStatus.COMPLETED,
        completedAt,
      };

      if (session.status !== RevisionSessionStatus.COMPLETED) {
        await tx.revisionSessionAction.update({
          where: { id: action.id },
          data: {
            status: RevisionSessionActionStatus.COMPLETED,
            completedAt,
          },
        });
        await tx.revisionSession.update({
          where: { id: session.id },
          data: {
            status: RevisionSessionStatus.COMPLETED,
            completedAt,
          },
        });
      }

      return toRevisionSessionResult(completedSession, activityWithResult);
    });
  }

  async findResultByIdForStudent(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RevisionSessionResultDto> {
    const session = (await this.prisma.revisionSession.findFirst({
      where: {
        id: input.sessionId,
        studentId: input.studentId,
      },
      include: {
        actions: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    })) as RevisionSessionRecord | null;

    if (!session) {
      throw new Error('Revision session not found');
    }

    if (
      session.status !== RevisionSessionStatus.COMPLETED ||
      !session.completedAt
    ) {
      throw new Error('Revision session not completed');
    }

    const action = selectCurrentAction(session.actions ?? []);

    if (
      !action ||
      action.kind !== RevisionSessionActionKind.DIAGNOSTIC_QUIZ ||
      !action.activitySessionId
    ) {
      throw new Error('Revision session result not found');
    }

    const activity = (await this.prisma.activitySession.findFirst({
      where: {
        id: action.activitySessionId,
        studentId: input.studentId,
        type: ActivityType.DIAGNOSTIC_QUIZ,
      },
      include: {
        result: true,
        answers: {
          include: {
            question: {
              select: {
                knowledgeUnitId: true,
                knowledgeUnit: {
                  select: {
                    title: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })) as RevisionSessionActivityForResultRecord | null;

    if (!activity?.result) {
      throw new Error('Revision session result not found');
    }

    const completedSession: CompletedRevisionSessionRecord = {
      ...session,
      status: RevisionSessionStatus.COMPLETED,
      completedAt: session.completedAt,
    };
    const activityWithResult: RevisionSessionActivityWithResultRecord = {
      ...activity,
      result: activity.result,
    };

    return toRevisionSessionResult(completedSession, activityWithResult);
  }

  async findPlanningContextByIdForStudent(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RevisionSessionPlanningContext> {
    const session = (await this.prisma.revisionSession.findFirst({
      where: {
        id: input.sessionId,
        studentId: input.studentId,
      },
      include: {
        actions: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            activitySession: {
              select: { knowledgeUnitId: true },
            },
          },
        },
      },
    })) as RevisionSessionRecord | null;

    if (!session) {
      throw new Error('Revision session not found');
    }

    const knowledgeUnits = await this.prisma.knowledgeUnit.findMany({
      where: {
        subjectId: session.subjectId,
        subject: { studentId: input.studentId },
        ...(session.courseId
          ? {
              document: {
                studentId: input.studentId,
                courseId: session.courseId,
                kind: 'COURSE_PDF',
                status: 'READY',
              },
            }
          : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      take: 20,
      select: { id: true, documentId: true, title: true },
    });

    return {
      session: {
        id: session.id,
        status: session.status,
        subjectId: session.subjectId,
        courseId: session.courseId,
        documentId: session.documentId,
        knowledgeUnitId: session.knowledgeUnitId,
        mode: session.mode,
      },
      actions: (session.actions ?? []).map((action) => ({
        kind: action.kind,
        status: action.status,
        displayOrder: action.displayOrder,
        activitySessionId: action.activitySessionId,
        knowledgeUnitId:
          action.knowledgeUnitId ??
          action.activitySession?.knowledgeUnitId ??
          null,
      })),
      allowedKnowledgeUnitIds: knowledgeUnits.map((unit) => unit.id),
      allowedKnowledgeUnits: knowledgeUnits.map((unit) => ({
        id: unit.id,
        documentId: unit.documentId,
        title: unit.title,
      })),
    };
  }

  async appendAction(input: {
    studentId: string;
    sessionId: string;
    action: {
      kind: RevisionSessionActionKindValue;
      status: RevisionSessionActionStatusValue;
      activitySessionId: string | null;
      documentId: string | null;
      knowledgeUnitId: string | null;
    };
  }): Promise<RevisionSessionResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.revisionSession.findFirst({
        where: {
          id: input.sessionId,
          studentId: input.studentId,
        },
      });

      if (!session) {
        throw new Error('Revision session not found');
      }

      if (session.mode === 'QUICK' && session.courseId !== null) {
        throw new Error(
          'Quick course revision sessions do not support next actions',
        );
      }

      const maxOrder = await tx.revisionSessionAction.aggregate({
        where: { sessionId: input.sessionId },
        _max: { displayOrder: true },
      });
      const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;

      await tx.revisionSessionAction.create({
        data: {
          sessionId: session.id,
          studentId: input.studentId,
          subjectId: session.subjectId,
          kind: toPrismaActionKind(input.action.kind),
          status: toPrismaActionStatus(input.action.status),
          displayOrder,
          activitySessionId: input.action.activitySessionId,
          documentId: input.action.documentId,
          knowledgeUnitId: input.action.knowledgeUnitId,
        },
      });

      const updatedSession = (await tx.revisionSession.findFirst({
        where: {
          id: input.sessionId,
          studentId: input.studentId,
        },
        include: {
          actions: {
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      })) as RevisionSessionRecord | null;

      if (!updatedSession) {
        throw new Error('Revision session not found');
      }

      return toRevisionSessionResponse(
        updatedSession,
        updatedSession.actions ?? [],
      );
    });
  }
}

function toRevisionSessionResponse(
  session: RevisionSessionRecord,
  actions: RevisionSessionActionRecord[],
): RevisionSessionResponseDto {
  const history = actions.map((action) => ({
    id: action.id,
    kind: action.kind,
    status: action.status,
    displayOrder: action.displayOrder,
    activitySessionId: action.activitySessionId,
    documentId: action.documentId,
    knowledgeUnitId: action.knowledgeUnitId,
  }));
  const currentActionRecord = actions.length
    ? actions[actions.length - 1]
    : undefined;
  const currentAction = currentActionRecord
    ? {
        id: currentActionRecord.id,
        kind: currentActionRecord.kind,
        status: currentActionRecord.status,
        displayOrder: currentActionRecord.displayOrder,
        activitySessionId: currentActionRecord.activitySessionId,
        documentId: currentActionRecord.documentId,
        knowledgeUnitId: currentActionRecord.knowledgeUnitId,
        payload: toActionPayload(currentActionRecord),
      }
    : null;

  return {
    session: {
      id: session.id,
      status: session.status,
      subjectId: session.subjectId,
      courseId: session.courseId,
      documentId: session.documentId,
      knowledgeUnitId: session.knowledgeUnitId,
      mode: session.mode,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
    },
    currentAction,
    history,
  };
}

function toActionPayload(
  action: RevisionSessionActionRecord,
): RevisionSessionActionPayload {
  if (
    action.kind === 'DIAGNOSTIC_QUIZ' &&
    action.activitySession?.type === ActivityType.DIAGNOSTIC_QUIZ &&
    Array.isArray(action.activitySession.questions)
  ) {
    return toDiagnosticQuizPayload(action.activitySession);
  }

  return toMinimalActionPayload(action);
}

function toMinimalActionPayload(
  action: RevisionSessionActionRecord,
): RevisionSessionActionPayload {
  if (action.kind === 'RICH_CLOSED_EXERCISE') {
    return {
      type: 'rich_closed_exercise' as const,
      subjectId: action.subjectId,
      documentId: action.documentId,
      knowledgeUnitId: action.knowledgeUnitId ?? '',
      reason: 'Questions riches recommandées pour consolider cette notion.',
      estimatedMinutes: 8,
      preferredAction: 'rich_closed_exercise' as const,
    };
  }

  return {
    type:
      action.kind === 'OPEN_QUESTION'
        ? ('open_question' as const)
        : ('diagnostic_quiz' as const),
    sessionId: action.activitySessionId,
  };
}

function toDiagnosticQuizPayload(
  activity: NonNullable<RevisionSessionActionRecord['activitySession']>,
) {
  const payload = {
    sessionId: activity.id ?? '',
    type: 'diagnostic_quiz' as const,
    title: 'Quiz de diagnostic',
    questions: (activity.questions ?? []).map(toPublicDiagnosticQuestion),
  };

  if ((activity.version ?? 1) > 1) {
    return {
      ...payload,
      version: activity.version,
      documentId: activity.documentId ?? null,
      subjectId: activity.subjectId,
    };
  }

  return payload;
}

function toPublicDiagnosticQuestion(
  question: RevisionSessionActivityQuestionRecord,
) {
  const sources = (question.sources ?? [])
    .map((source) => ({
      chunkId: source.chunkId,
      pageNumber: source.chunk.pageNumber,
      index: source.chunk.index,
    }))
    .sort((left, right) => left.index - right.index);

  return {
    id: question.id,
    knowledgeUnitId: question.knowledgeUnitId,
    prompt: question.prompt,
    difficulty: question.difficulty,
    ...(question.selectionMode === 'MULTIPLE'
      ? { selectionMode: 'multiple' as const }
      : {}),
    ...(question.minSelections === null
      ? {}
      : { minSelections: question.minSelections }),
    ...(question.maxSelections === null
      ? {}
      : { maxSelections: question.maxSelections }),
    choices: parsePublicQuestionChoices(question.choices),
    ...(sources.length > 0 ? { sources } : {}),
    ...toPublicQuestionVisuals(question.visuals),
  };
}

function toPublicQuestionVisuals(
  visuals: RevisionSessionActivityQuestionRecord['visuals'],
) {
  const publicVisuals = (visuals ?? [])
    .map(toPublicQuestionVisual)
    .filter(
      (
        visual,
      ): visual is NonNullable<ReturnType<typeof toPublicQuestionVisual>> =>
        Boolean(visual),
    )
    .sort((left, right) => left.displayOrder - right.displayOrder);

  return publicVisuals.length > 0 ? { visuals: publicVisuals } : {};
}

function toPublicQuestionVisual(
  visual: NonNullable<RevisionSessionActivityQuestionRecord['visuals']>[number],
) {
  const sources = (visual.sources ?? [])
    .map((source) => ({
      chunkId: source.chunkId,
      pageNumber: source.chunk.pageNumber,
      index: source.chunk.index,
    }))
    .sort((left, right) => left.index - right.index);

  if (visual.type === 'IMAGE') {
    const payload = parseRecord(visual.payload);
    const imageUrl =
      typeof payload.imageUrl === 'string' ? payload.imageUrl : '';
    const altText = typeof payload.altText === 'string' ? payload.altText : '';

    if (!imageUrl || !altText) {
      return null;
    }

    return {
      id: visual.id,
      type: 'IMAGE' as const,
      displayOrder: visual.displayOrder,
      imageUrl,
      altText,
      caption:
        typeof payload.caption === 'string' || payload.caption === null
          ? payload.caption
          : undefined,
      sources,
    };
  }

  if (visual.type === 'CHART') {
    const payload = parseRecord(visual.payload);
    const chartType = parseChartType(payload.chartType);
    const title = typeof payload.title === 'string' ? payload.title : '';
    const data = parseChartData(payload.data);

    if (!chartType || !title || data.length === 0) {
      return null;
    }

    return {
      id: visual.id,
      type: 'CHART' as const,
      displayOrder: visual.displayOrder,
      chartType,
      title,
      description:
        typeof payload.description === 'string' || payload.description === null
          ? payload.description
          : undefined,
      data,
      xKey:
        typeof payload.xKey === 'string' || payload.xKey === null
          ? payload.xKey
          : undefined,
      yKeys: parseOptionalStringArray(payload.yKeys),
      sources,
    };
  }

  const payload = parseRecord(visual.payload);
  const title = typeof payload.title === 'string' ? payload.title : '';
  const nodes = parseDiagramNodes(payload.nodes);
  const edges = parseDiagramEdges(payload.edges);

  if (!title || nodes.length === 0) {
    return null;
  }

  return {
    id: visual.id,
    type: 'DIAGRAM' as const,
    displayOrder: visual.displayOrder,
    title,
    description:
      typeof payload.description === 'string' || payload.description === null
        ? payload.description
        : undefined,
    nodes,
    ...(edges === undefined ? {} : { edges }),
    sources,
  };
}

function parsePublicQuestionChoices(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((choice) => {
      if (typeof choice === 'object' && choice !== null) {
        const record = choice as { id?: unknown; label?: unknown };
        if (typeof record.id !== 'string' || typeof record.label !== 'string') {
          return null;
        }

        return {
          id: record.id,
          label: record.label,
        };
      }

      return null;
    })
    .filter((choice): choice is { id: string; label: string } =>
      Boolean(choice),
    );
}

function parseRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {};
  }

  return input as Record<string, unknown>;
}

function parseChartType(
  input: unknown,
): 'bar' | 'line' | 'pie' | 'scatter' | null {
  return input === 'bar' ||
    input === 'line' ||
    input === 'pie' ||
    input === 'scatter'
    ? input
    : null;
}

function parseChartData(
  input: unknown,
): Array<Record<string, string | number | null>> {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map(parseRecord)
    .map((row) =>
      Object.fromEntries(
        Object.entries(row).filter(
          (entry): entry is [string, string | number | null] =>
            typeof entry[1] === 'string' ||
            typeof entry[1] === 'number' ||
            entry[1] === null,
        ),
      ),
    )
    .filter((row) => Object.keys(row).length > 0);
}

function parseOptionalStringArray(input: unknown): string[] | null | undefined {
  if (input === null) {
    return null;
  }

  if (input === undefined) {
    return undefined;
  }

  if (!Array.isArray(input)) {
    return undefined;
  }

  const values = input.filter(
    (value): value is string => typeof value === 'string',
  );

  return values.length === input.length ? values : undefined;
}

function parseDiagramNodes(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map(parseRecord)
    .map((node) => ({
      id: typeof node.id === 'string' ? node.id : '',
      label: typeof node.label === 'string' ? node.label : '',
    }))
    .filter((node) => node.id.length > 0 && node.label.length > 0);
}

function parseDiagramEdges(input: unknown) {
  if (input === undefined) {
    return undefined;
  }

  if (!Array.isArray(input)) {
    return undefined;
  }

  return input
    .map(parseRecord)
    .map((edge) => ({
      from: typeof edge.from === 'string' ? edge.from : '',
      to: typeof edge.to === 'string' ? edge.to : '',
      label:
        typeof edge.label === 'string' || edge.label === null
          ? edge.label
          : undefined,
    }))
    .filter((edge) => edge.from.length > 0 && edge.to.length > 0);
}

function selectCurrentAction(
  actions: RevisionSessionActionRecord[],
): RevisionSessionActionRecord | undefined {
  return actions.length ? actions[actions.length - 1] : undefined;
}

function toRevisionSessionResult(
  session: CompletedRevisionSessionRecord,
  activity: RevisionSessionActivityWithResultRecord,
): RevisionSessionResultDto {
  const score = normalizeScore(
    activity.result.score,
    activity.result.correctAnswers,
    activity.result.totalQuestions,
  );
  const durationSeconds = Math.max(
    0,
    Math.floor(
      (session.completedAt.getTime() - session.createdAt.getTime()) / 1000,
    ),
  );

  return {
    session: {
      id: session.id,
      subjectId: session.subjectId,
      courseId: session.courseId,
      mode: session.mode,
      status: 'COMPLETED',
      createdAt: session.createdAt,
      completedAt: session.completedAt,
    },
    summary: {
      correctAnswers: activity.result.correctAnswers,
      totalQuestions: activity.result.totalQuestions,
      score,
      durationSeconds,
    },
    knowledgeUnits: aggregateKnowledgeUnitResults(activity.answers),
  };
}

function aggregateKnowledgeUnitResults(
  answers: RevisionSessionAnswerRecord[],
): RevisionSessionResultDto['knowledgeUnits'] {
  const buckets = new Map<
    string,
    {
      title: string;
      correctAnswers: number;
      totalQuestions: number;
    }
  >();

  for (const answer of answers) {
    const knowledgeUnitId = answer.question.knowledgeUnitId;
    const current = buckets.get(knowledgeUnitId) ?? {
      title: answer.question.knowledgeUnit.title,
      correctAnswers: 0,
      totalQuestions: 0,
    };
    buckets.set(knowledgeUnitId, {
      title: current.title,
      correctAnswers: current.correctAnswers + (answer.isCorrect ? 1 : 0),
      totalQuestions: current.totalQuestions + 1,
    });
  }

  return [...buckets.entries()].map(([knowledgeUnitId, bucket]) => {
    const score = safeDivide(bucket.correctAnswers, bucket.totalQuestions);

    return {
      knowledgeUnitId,
      title: bucket.title,
      correctAnswers: bucket.correctAnswers,
      totalQuestions: bucket.totalQuestions,
      score,
      state: revisionSessionResultStateForScore(score),
    };
  });
}

function normalizeScore(
  score: number | null,
  correctAnswers: number,
  totalQuestions: number,
): number {
  if (typeof score === 'number' && Number.isFinite(score)) {
    return clampScore(score);
  }

  return safeDivide(correctAnswers, totalQuestions);
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return clampScore(numerator / denominator);
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(1, score));
}

function toPrismaActionKind(kind: RevisionSessionActionKindValue) {
  if (kind === 'OPEN_QUESTION') {
    return RevisionSessionActionKind.OPEN_QUESTION;
  }

  if (kind === 'RICH_CLOSED_EXERCISE') {
    return RevisionSessionActionKind.RICH_CLOSED_EXERCISE;
  }

  return RevisionSessionActionKind.DIAGNOSTIC_QUIZ;
}

function toPrismaActionStatus(status: RevisionSessionActionStatusValue) {
  if (status === 'COMPLETED') {
    return RevisionSessionActionStatus.COMPLETED;
  }

  if (status === 'FAILED') {
    return RevisionSessionActionStatus.FAILED;
  }

  return RevisionSessionActionStatus.READY;
}

```

### src/modules/revision-sessions/interfaces/revision-sessions.controller.spec.ts

```ts
import { INestApplication } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../../app.module';
import { TOKEN_VERIFIER } from '../../auth/application/token-verifier';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import { CompleteQuickRevisionSessionUseCase } from '../application/complete-quick-revision-session.use-case';
import { GetRevisionSessionUseCase } from '../application/get-revision-session.use-case';
import { GetRevisionSessionResultUseCase } from '../application/get-revision-session-result.use-case';
import { RequestNextRevisionSessionActionUseCase } from '../application/request-next-revision-session-action.use-case';
import { StartRevisionSessionUseCase } from '../application/start-revision-session.use-case';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type { RevisionSessionResponseDto } from '../domain/revision-session.entity';

jest.mock('firebase-admin/app', () => ({
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(),
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

describe('RevisionSessionsController', () => {
  let app: INestApplication<App>;
  let startRevisionSession: { execute: jest.Mock };
  let getRevisionSession: { execute: jest.Mock };
  let requestNextAction: { execute: jest.Mock };
  let completeQuickRevisionSession: { execute: jest.Mock };
  let getRevisionSessionResult: { execute: jest.Mock };

  beforeEach(async () => {
    startRevisionSession = {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    };
    getRevisionSession = {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    };
    requestNextAction = {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    };
    completeQuickRevisionSession = {
      execute: jest.fn().mockResolvedValue(revisionSessionResult()),
    };
    getRevisionSessionResult = {
      execute: jest.fn().mockResolvedValue(revisionSessionResult()),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context
            .switchToHttp()
            .getRequest<{ student?: { id: string } }>();
          request.student = { id: 'student-1' };
          return true;
        },
      })
      .overrideProvider(TOKEN_VERIFIER)
      .useValue({ verify: jest.fn() })
      .overrideProvider(StartRevisionSessionUseCase)
      .useValue(startRevisionSession)
      .overrideProvider(GetRevisionSessionUseCase)
      .useValue(getRevisionSession)
      .overrideProvider(RequestNextRevisionSessionActionUseCase)
      .useValue(requestNextAction)
      .overrideProvider(CompleteQuickRevisionSessionUseCase)
      .useValue(completeQuickRevisionSession)
      .overrideProvider(GetRevisionSessionResultUseCase)
      .useValue(getRevisionSessionResult)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('creates a deterministic revision session for the current student', async () => {
    const response = await request(app.getHttpServer())
      .post('/revision-sessions')
      .send({
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        preferredAction: 'open_question',
      })
      .expect(201);

    expect(startRevisionSession.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      preferredAction: 'open_question',
    });
    const body = response.body as RevisionSessionResponseDto;
    expect(body.currentAction?.kind).toBe('OPEN_QUESTION');
    expect(JSON.stringify(response.body)).not.toContain('correctChoiceId');
    expect(JSON.stringify(response.body)).not.toContain('modelAnswer');
  });

  it('accepts rich closed preferred action as a bounded session action', async () => {
    startRevisionSession.execute.mockResolvedValueOnce(
      richClosedRevisionSessionResponse(),
    );

    const response = await request(app.getHttpServer())
      .post('/revision-sessions')
      .send({
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        preferredAction: 'rich_closed_exercise',
      })
      .expect(201);

    expect(startRevisionSession.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      preferredAction: 'rich_closed_exercise',
    });
    const body = response.body as RevisionSessionResponseDto;
    expect(body.currentAction?.kind).toBe('RICH_CLOSED_EXERCISE');
    expect(body.currentAction?.activitySessionId).toBeNull();
    expect(body.currentAction?.payload).toEqual({
      type: 'rich_closed_exercise',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      reason: 'Questions riches recommandées.',
      estimatedMinutes: 8,
      preferredAction: 'rich_closed_exercise',
    });
    expect(JSON.stringify(response.body)).not.toContain('questions');
    expect(JSON.stringify(response.body)).not.toContain('correction');
  });

  it('rejects malformed create payloads before calling the use case', async () => {
    await request(app.getHttpServer())
      .post('/revision-sessions')
      .send({ subjectId: '', preferredAction: 'open_question' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/revision-sessions')
      .send({ subjectId: 'subject-1', preferredAction: 'chat' })
      .expect(400);

    expect(startRevisionSession.execute).not.toHaveBeenCalled();
  });

  it('maps impossible open question actions to 422', async () => {
    startRevisionSession.execute.mockRejectedValue(
      new Error('Open question revision session requires a knowledge unit'),
    );

    await request(app.getHttpServer())
      .post('/revision-sessions')
      .send({ subjectId: 'subject-1', preferredAction: 'open_question' })
      .expect(422);
  });

  it('maps impossible rich closed actions to 422', async () => {
    startRevisionSession.execute.mockRejectedValue(
      new Error('Rich closed revision session requires a knowledge unit'),
    );

    await request(app.getHttpServer())
      .post('/revision-sessions')
      .send({
        subjectId: 'subject-1',
        preferredAction: 'rich_closed_exercise',
      })
      .expect(422);
  });

  it('loads an owned revision session without creating a new action', async () => {
    await request(app.getHttpServer())
      .get('/revision-sessions/revision-session-1')
      .expect(200);

    expect(getRevisionSession.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });
    expect(startRevisionSession.execute).not.toHaveBeenCalled();
  });

  it('maps unknown sessions to 404', async () => {
    getRevisionSession.execute.mockRejectedValue(
      new Error('Revision session not found'),
    );

    await request(app.getHttpServer())
      .get('/revision-sessions/missing-session')
      .expect(404);
  });

  it('requests a bounded next action for the current student', async () => {
    await request(app.getHttpServer())
      .post('/revision-sessions/revision-session-1/next-action')
      .send({ message: 'ignore me' })
      .expect(201);

    expect(requestNextAction.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });
    expect(JSON.stringify(requestNextAction.execute.mock.calls)).not.toContain(
      'ignore me',
    );
  });

  it('maps next action session and planning errors', async () => {
    requestNextAction.execute.mockRejectedValueOnce(
      new Error('Revision session not found'),
    );

    await request(app.getHttpServer())
      .post('/revision-sessions/missing-session/next-action')
      .expect(404);

    requestNextAction.execute.mockRejectedValueOnce(
      new Error('Revision coach no action available'),
    );

    await request(app.getHttpServer())
      .post('/revision-sessions/revision-session-1/next-action')
      .expect(422);

    requestNextAction.execute.mockRejectedValueOnce(
      new Error('Quick course revision sessions do not support next actions'),
    );

    await request(app.getHttpServer())
      .post('/revision-sessions/revision-session-1/next-action')
      .expect(409);
  });

  it('completes a quick session without accepting client result fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/revision-sessions/revision-session-1/complete')
      .send({})
      .expect(201);
    const body = response.body as ReturnType<typeof revisionSessionResult>;

    expect(completeQuickRevisionSession.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });
    expect(body.summary.score).toBeCloseTo(0.6666666667);
    expect(JSON.stringify(body)).not.toContain('correctChoiceId');
    expect(JSON.stringify(body)).not.toContain('selectedChoiceId');
    expect(JSON.stringify(body)).not.toContain('storagePath');
  });

  it('rejects non-empty complete bodies', async () => {
    await request(app.getHttpServer())
      .post('/revision-sessions/revision-session-1/complete')
      .send({ score: 1, activitySessionId: 'fake' })
      .expect(400);

    expect(completeQuickRevisionSession.execute).not.toHaveBeenCalled();
  });

  it('maps complete lifecycle conflicts', async () => {
    completeQuickRevisionSession.execute.mockRejectedValueOnce(
      new Error('Revision session activity not submitted'),
    );

    await request(app.getHttpServer())
      .post('/revision-sessions/revision-session-1/complete')
      .send({})
      .expect(409);

    completeQuickRevisionSession.execute.mockRejectedValueOnce(
      new Error('Revision session completion unsupported'),
    );

    await request(app.getHttpServer())
      .post('/revision-sessions/revision-session-1/complete')
      .send({})
      .expect(422);
  });

  it('returns a completed quick session result', async () => {
    const response = await request(app.getHttpServer())
      .get('/revision-sessions/revision-session-1/result')
      .expect(200);
    const body = response.body as ReturnType<typeof revisionSessionResult>;

    expect(getRevisionSessionResult.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });
    expect(body.knowledgeUnits).toEqual([
      {
        knowledgeUnitId: 'unit-1',
        title: 'Séparation des pouvoirs',
        correctAnswers: 4,
        totalQuestions: 6,
        score: 0.6666666667,
        state: 'TO_REVIEW',
      },
    ]);
  });

  it('maps result errors', async () => {
    getRevisionSessionResult.execute.mockRejectedValueOnce(
      new Error('Revision session not found'),
    );

    await request(app.getHttpServer())
      .get('/revision-sessions/missing-session/result')
      .expect(404);

    getRevisionSessionResult.execute.mockRejectedValueOnce(
      new Error('Revision session not completed'),
    );

    await request(app.getHttpServer())
      .get('/revision-sessions/revision-session-1/result')
      .expect(409);
  });
});

function revisionSessionResponse() {
  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      createdAt: new Date('2026-06-15T10:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-1',
      kind: 'OPEN_QUESTION',
      status: 'READY',
      displayOrder: 0,
      activitySessionId: 'open-session-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      payload: {
        type: 'open_question',
        sessionId: 'open-session-1',
      },
    },
    history: [
      {
        id: 'action-1',
        kind: 'OPEN_QUESTION',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: 'open-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    ],
  };
}

function richClosedRevisionSessionResponse() {
  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      createdAt: new Date('2026-06-15T10:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-1',
      kind: 'RICH_CLOSED_EXERCISE',
      status: 'READY',
      displayOrder: 0,
      activitySessionId: null,
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      payload: {
        type: 'rich_closed_exercise',
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        reason: 'Questions riches recommandées.',
        estimatedMinutes: 8,
        preferredAction: 'rich_closed_exercise',
      },
    },
    history: [
      {
        id: 'action-1',
        kind: 'RICH_CLOSED_EXERCISE',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: null,
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    ],
  };
}

function revisionSessionResult() {
  return {
    session: {
      id: 'revision-session-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      mode: 'QUICK',
      status: 'COMPLETED',
      createdAt: new Date('2026-06-15T10:00:00.000Z'),
      completedAt: new Date('2026-06-15T10:04:12.000Z'),
    },
    summary: {
      correctAnswers: 4,
      totalQuestions: 6,
      score: 0.6666666667,
      durationSeconds: 252,
    },
    knowledgeUnits: [
      {
        knowledgeUnitId: 'unit-1',
        title: 'Séparation des pouvoirs',
        correctAnswers: 4,
        totalQuestions: 6,
        score: 0.6666666667,
        state: 'TO_REVIEW',
      },
    ],
  };
}

```

### src/modules/revision-sessions/interfaces/revision-sessions.controller.ts

```ts
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import type { RevisionSessionPreferredAction } from '../domain/revision-session.entity';
import { CompleteQuickRevisionSessionUseCase } from '../application/complete-quick-revision-session.use-case';
import { GetRevisionSessionUseCase } from '../application/get-revision-session.use-case';
import { GetRevisionSessionResultUseCase } from '../application/get-revision-session-result.use-case';
import { RequestNextRevisionSessionActionUseCase } from '../application/request-next-revision-session-action.use-case';
import { StartRevisionSessionUseCase } from '../application/start-revision-session.use-case';

class StartRevisionSessionDto {
  subjectId!: string;
  documentId?: string;
  knowledgeUnitId?: string;
  preferredAction?: string;
}

interface ValidatedStartRevisionSessionBody {
  subjectId: string;
  documentId?: string;
  knowledgeUnitId?: string;
  preferredAction?: RevisionSessionPreferredAction;
}

@Controller('revision-sessions')
@UseGuards(FirebaseAuthGuard)
export class RevisionSessionsController {
  constructor(
    private readonly startRevisionSession: StartRevisionSessionUseCase,
    private readonly getRevisionSession: GetRevisionSessionUseCase,
    private readonly requestNextAction: RequestNextRevisionSessionActionUseCase,
    private readonly completeQuickRevisionSession: CompleteQuickRevisionSessionUseCase,
    private readonly getRevisionSessionResult: GetRevisionSessionResultUseCase,
  ) {}

  @Post()
  start(
    @CurrentStudent() student: { id: string },
    @Body() body: StartRevisionSessionDto,
  ) {
    const validatedBody = validateStartRevisionSessionBody(body);

    return this.startRevisionSession
      .execute({
        studentId: student.id,
        subjectId: validatedBody.subjectId,
        documentId: validatedBody.documentId,
        knowledgeUnitId: validatedBody.knowledgeUnitId,
        preferredAction: validatedBody.preferredAction,
      })
      .catch((error: unknown) => {
        normalizeRevisionSessionError(error);
      });
  }

  @Get(':sessionId')
  get(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Revision session id',
    );

    return this.getRevisionSession
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
      })
      .catch((error: unknown) => {
        normalizeRevisionSessionError(error);
      });
  }

  @Post(':sessionId/next-action')
  nextAction(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Revision session id',
    );

    return this.requestNextAction
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
      })
      .catch((error: unknown) => {
        normalizeRevisionSessionError(error);
      });
  }

  @Post(':sessionId/complete')
  complete(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
    @Body() body: Record<string, unknown> | undefined,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Revision session id',
    );
    validateEmptyBody(body);

    return this.completeQuickRevisionSession
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
      })
      .catch((error: unknown) => {
        normalizeRevisionSessionError(error);
      });
  }

  @Get(':sessionId/result')
  result(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Revision session id',
    );

    return this.getRevisionSessionResult
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
      })
      .catch((error: unknown) => {
        normalizeRevisionSessionError(error);
      });
  }
}

function validateStartRevisionSessionBody(
  input: StartRevisionSessionDto,
): ValidatedStartRevisionSessionBody {
  return {
    subjectId: validateRequiredId(input?.subjectId, 'Subject id'),
    documentId: validateOptionalId(input?.documentId, 'Document id'),
    knowledgeUnitId: validateOptionalId(
      input?.knowledgeUnitId,
      'Knowledge unit id',
    ),
    preferredAction: validatePreferredAction(input?.preferredAction),
  };
}

function validateRequiredId(input: unknown, label: string): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new BadRequestException(`${label} is required`);
  }

  return input.trim();
}

function validateOptionalId(input: unknown, label: string): string | undefined {
  if (input === undefined) {
    return undefined;
  }

  return validateRequiredId(input, label);
}

function validatePreferredAction(
  input: unknown,
): RevisionSessionPreferredAction | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (typeof input !== 'string') {
    throw new BadRequestException('Revision session preferred action invalid');
  }

  const normalized = input.trim();

  if (
    normalized !== 'diagnostic_quiz' &&
    normalized !== 'open_question' &&
    normalized !== 'rich_closed_exercise'
  ) {
    throw new BadRequestException('Revision session preferred action invalid');
  }

  return normalized;
}

function validateEmptyBody(input: Record<string, unknown> | undefined): void {
  if (input && Object.keys(input).length > 0) {
    throw new BadRequestException(
      'Revision session complete body must be empty',
    );
  }
}

function normalizeRevisionSessionError(error: unknown): never {
  if (error instanceof Error) {
    if (
      error.message === 'Revision subject not found' ||
      error.message === 'Revision document not found' ||
      error.message === 'Revision knowledge unit not found' ||
      error.message === 'Revision session not found'
    ) {
      throw new NotFoundException(error.message);
    }

    if (
      error.message ===
        'Open question revision session requires a knowledge unit' ||
      error.message === 'Rich closed revision session requires a knowledge unit'
    ) {
      throw new UnprocessableEntityException(error.message);
    }

    if (error.message === 'Revision coach no action available') {
      throw new UnprocessableEntityException(error.message);
    }

    if (
      error.message === 'Revision session is not started' ||
      error.message ===
        'Quick course revision sessions do not support next actions'
    ) {
      throw new ConflictException(error.message);
    }

    if (
      error.message === 'Revision session not ready to complete' ||
      error.message === 'Revision session activity not found' ||
      error.message === 'Revision session activity not submitted' ||
      error.message === 'Revision session result not found' ||
      error.message === 'Revision session not completed'
    ) {
      throw new ConflictException(error.message);
    }

    if (error.message === 'Revision session completion unsupported') {
      throw new UnprocessableEntityException(error.message);
    }
  }

  throw error;
}

```

### test/critical-paths.e2e-spec.ts

```ts
import { INestApplication, NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { TOKEN_VERIFIER } from '../src/modules/auth/application/token-verifier';
import { FirebaseAuthGuard } from '../src/modules/auth/interfaces/firebase-auth.guard';
import { StartNextActivityUseCase } from '../src/modules/activities/application/start-next-activity.use-case';
import { StartOpenQuestionActivityUseCase } from '../src/modules/activities/application/start-open-question-activity.use-case';
import { SubmitActivityResultUseCase } from '../src/modules/activities/application/submit-activity-result.use-case';
import { SubmitOpenAnswerUseCase } from '../src/modules/activities/application/submit-open-answer.use-case';
import { CreateCourseUseCase } from '../src/modules/courses/application/create-course.use-case';
import { DeleteCourseDocumentUseCase } from '../src/modules/courses/application/delete-course-document.use-case';
import { DeleteCourseUseCase } from '../src/modules/courses/application/delete-course.use-case';
import {
  CourseRevisionSheetSourceNotReadyError,
  GenerateCourseRevisionSheetUseCase,
  GetCourseRevisionSheetUseCase,
} from '../src/modules/courses/application/course-revision-sheet.use-case';
import {
  GetCourseProgressUseCase,
  GetSubjectProgressUseCase,
} from '../src/modules/courses/application/course-progress.use-case';
import { GetCourseDetailUseCase } from '../src/modules/courses/application/get-course-detail.use-case';
import { ListSubjectCoursesWithStatsUseCase } from '../src/modules/courses/application/list-subject-courses-with-stats.use-case';
import { UploadCoursePdfForCourseUseCase } from '../src/modules/courses/application/upload-course-pdf-for-course.use-case';
import {
  CourseQuickRevisionKnowledgeUnitNotReadyError,
  CourseQuickRevisionSourceNotReadyError,
  StartCourseQuickRevisionSessionUseCase,
} from '../src/modules/courses/application/start-course-quick-revision-session.use-case';
import { CourseContainsDocumentsError } from '../src/modules/courses/domain/course.entity';
import {
  richClosedExerciseFixture,
  richClosedV1BExerciseFixture,
  richClosedV1BFullExerciseFixture,
  richClosedV1CCalculationExerciseFixture,
  richClosedV1CExerciseFixture,
  richClosedV1CFullExerciseFixture,
  richClosedV1DImageChoiceExerciseFixture,
} from '../src/modules/activities/application/rich-closed-questions/rich-closed-question.fixtures';
import { GetRichClosedExerciseResultUseCase } from '../src/modules/activities/application/rich-closed-questions/get-rich-closed-exercise-result.use-case';
import { GetRichClosedExerciseUseCase } from '../src/modules/activities/application/rich-closed-questions/get-rich-closed-exercise.use-case';
import { toRichClosedPublicExerciseEnvelope } from '../src/modules/activities/application/rich-closed-questions/rich-closed-question-public.mapper';
import { scoreRichClosedExerciseSubmission } from '../src/modules/activities/application/rich-closed-questions/rich-closed-question-scorer';
import type {
  RichClosedAnswer,
  RichClosedQuestionKind,
} from '../src/modules/activities/application/rich-closed-questions/rich-closed-question.types';
import { StartRichClosedExerciseUseCase } from '../src/modules/activities/application/rich-closed-questions/start-rich-closed-exercise.use-case';
import { SubmitRichClosedExerciseUseCase } from '../src/modules/activities/application/rich-closed-questions/submit-rich-closed-exercise.use-case';
import { GetDocumentUseCase } from '../src/modules/documents/application/get-document.use-case';
import { ListDocumentKnowledgeUnitsUseCase } from '../src/modules/documents/application/list-document-knowledge-units.use-case';
import { GetTodayPlanUseCase } from '../src/modules/revision/application/get-today-plan.use-case';
import { CompleteQuickRevisionSessionUseCase } from '../src/modules/revision-sessions/application/complete-quick-revision-session.use-case';
import { GetRevisionSessionUseCase } from '../src/modules/revision-sessions/application/get-revision-session.use-case';
import { GetRevisionSessionResultUseCase } from '../src/modules/revision-sessions/application/get-revision-session-result.use-case';
import { RequestNextRevisionSessionActionUseCase } from '../src/modules/revision-sessions/application/request-next-revision-session-action.use-case';
import { StartRevisionSessionUseCase } from '../src/modules/revision-sessions/application/start-revision-session.use-case';
import { GenerateDocumentSummaryUseCase } from '../src/modules/study-artifacts/application/generate-document-summary.use-case';
import { GenerateRevisionSheetUseCase } from '../src/modules/study-artifacts/application/generate-revision-sheet.use-case';
import { GetDocumentSummaryUseCase } from '../src/modules/study-artifacts/application/get-document-summary.use-case';
import { GetRevisionSheetUseCase } from '../src/modules/study-artifacts/application/get-revision-sheet.use-case';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';

jest.mock('firebase-admin/app', () => ({
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(),
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

type CriticalPathMocks = ReturnType<typeof createCriticalPathMocks>;
type KnowledgeUnitsResponse = ReturnType<typeof documentKnowledgeUnits>;
type SummaryResponse = ReturnType<typeof documentSummary>;
type RevisionSheetResponse = ReturnType<typeof revisionSheet>;
type TodayPlanResponse = ReturnType<typeof todayPlan>;
type ActivityResponse = ReturnType<typeof diagnosticQuizActivity>;
type OpenQuestionResponse = ReturnType<typeof openQuestionActivity>;

const currentStudent = {
  id: 'student-demo-test',
  firebaseUid: 'firebase-demo-test-uid',
  email: 'demo-revision@example.test',
  displayName: 'Demo Revision',
};

describe('Critical demo paths (e2e)', () => {
  describe('protected routes', () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
      app = await createAppWithRealAuthGuard();
    });

    afterEach(async () => {
      await app?.close();
    });

    it('rejects critical demo routes without a bearer token', async () => {
      // This suite keeps the real FirebaseAuthGuard behavior for missing-token
      // checks, but the verifier itself is mocked so no Firebase network call
      // can happen even if a future test adds a token.
      const server = app.getHttpServer();

      await request(server).get('/today').expect(401);
      await request(server).get('/documents/document-1').expect(401);
      await request(server)
        .get('/documents/document-1/knowledge-units')
        .expect(401);
      await request(server)
        .post('/activities/next')
        .send({ subjectId: 'subject-1' })
        .expect(401);
      await request(server)
        .post('/activities/open-question')
        .send({ subjectId: 'subject-1', knowledgeUnitId: 'unit-1' })
        .expect(401);
      await request(server)
        .post('/activities/rich-closed/start')
        .send({ subjectId: 'subject-1', knowledgeUnitId: 'unit-1' })
        .expect(401);
      await request(server)
        .post('/revision-sessions')
        .send({ subjectId: 'subject-1' })
        .expect(401);
      await request(server)
        .post('/revision-sessions/revision-session-1/next-action')
        .send({})
        .expect(401);
      await request(server)
        .post('/revision-sessions/revision-session-1/complete')
        .send({})
        .expect(401);
      await request(server)
        .get('/revision-sessions/revision-session-1/result')
        .expect(401);
      await request(server).get('/subjects/subject-1/courses').expect(401);
      await request(server)
        .post('/subjects/subject-1/courses')
        .send({ title: 'Droit constitutionnel' })
        .expect(401);
      await request(server).get('/courses/course-1').expect(401);
      await request(server).get('/courses/course-1/progress').expect(401);
      await request(server).get('/subjects/subject-1/progress').expect(401);
      await request(server).delete('/courses/course-1').expect(401);
      await request(server)
        .delete('/courses/course-1/sources/document-1')
        .expect(401);
      await request(server).get('/courses/course-1/revision-sheet').expect(401);
      await request(server)
        .post('/courses/course-1/revision-sheet')
        .expect(401);
      await request(server)
        .post('/courses/course-1/revision-sessions/quick')
        .send({})
        .expect(401);
      await request(server)
        .post('/courses/course-1/source/course-pdf')
        .attach('file', Buffer.from('%PDF-1.7'), {
          filename: 'cours.pdf',
          contentType: 'application/pdf',
        })
        .expect(401);
    });
  });

  describe('authenticated contracts', () => {
    let app: INestApplication<App>;
    let mocks: CriticalPathMocks;

    beforeEach(async () => {
      mocks = createCriticalPathMocks();
      app = await createAuthenticatedApp(mocks);
    });

    afterEach(async () => {
      await app?.close();
    });

    it('routes document and knowledge-unit reads with ownership context and no storage path leak', async () => {
      const server = app.getHttpServer();

      const documentResponse = await request(server)
        .get('/documents/document-1')
        .expect(200);

      expect(mocks.getDocument.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        documentId: 'document-1',
      });
      expect(documentResponse.body).toMatchObject({
        id: 'document-1',
        subjectId: 'subject-1',
        status: 'READY',
      });
      assertNoSensitivePreSubmitFields(documentResponse.body);

      const knowledgeUnitsResponse = await request(server)
        .get('/documents/document-1/knowledge-units')
        .expect(200);
      const knowledgeUnitsBody =
        knowledgeUnitsResponse.body as KnowledgeUnitsResponse;

      expect(mocks.listDocumentKnowledgeUnits.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        documentId: 'document-1',
      });
      expect(knowledgeUnitsBody.items[0].sources[0]).toMatchObject({
        chunkId: 'chunk-1',
        pageNumber: 1,
        index: 0,
      });
      assertNoSensitivePreSubmitFields(knowledgeUnitsResponse.body);
    });

    it('serves the Course API happy path with owned subject/course context', async () => {
      const server = app.getHttpServer();

      const createResponse = await request(server)
        .post('/subjects/subject-1/courses')
        .send({
          title: ' Droit constitutionnel ',
          description: ' Institutions ',
          chapterLabel: ' Chapitre 1 ',
          estimatedMinutes: 30,
        })
        .expect(201);

      expect(mocks.createCourse.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        title: 'Droit constitutionnel',
        description: 'Institutions',
        chapterLabel: 'Chapitre 1',
        estimatedMinutes: 30,
      });
      expect(createResponse.body).toMatchObject({
        id: 'course-1',
        subjectId: 'subject-1',
        title: 'Droit constitutionnel',
        sourceCount: 0,
      });

      const listResponse = await request(server)
        .get('/subjects/subject-1/courses')
        .expect(200);
      const listBody = listResponse.body as Array<{
        id: string;
        readySourceCount: number;
      }>;

      expect(mocks.listCoursesWithStats.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
      });
      expect(listBody).toHaveLength(1);
      expect(listBody[0]).toMatchObject({
        id: 'course-1',
        readySourceCount: 1,
      });

      const detailResponse = await request(server)
        .get('/courses/course-1')
        .expect(200);
      const detailBody = detailResponse.body as {
        course: { id: string; sourceCount: number };
        subject: { id: string; name: string };
        sources: Array<{
          id: string;
          courseId: string;
          documentId: string;
          status: string;
        }>;
      };

      expect(mocks.getCourseDetail.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        courseId: 'course-1',
      });
      expect(detailBody).toMatchObject({
        course: {
          id: 'course-1',
          sourceCount: 1,
        },
        subject: {
          id: 'subject-1',
          name: 'Droit constitutionnel',
        },
      });
      expect(detailBody.sources[0]).toMatchObject({
        id: 'document-1',
        courseId: 'course-1',
        documentId: 'document-1',
        status: 'READY',
      });

      const courseProgressResponse = await request(server)
        .get('/courses/course-1/progress')
        .expect(200);

      expect(mocks.getCourseProgress.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        courseId: 'course-1',
      });
      expect(courseProgressResponse.body).toMatchObject({
        courseId: 'course-1',
        subjectId: 'subject-1',
        knowledgeUnitCount: 12,
        practicedKnowledgeUnitCount: 3,
        coverage: 0.25,
        mastery: 0.72,
        estimatedGlobalMastery: 0.18,
        readySourceCount: 1,
        processingSourceCount: 0,
        failedSourceCount: 0,
        state: 'PRACTICED',
      });
      assertNoSensitivePreSubmitFields(courseProgressResponse.body);
      expect(JSON.stringify(courseProgressResponse.body)).not.toContain(
        'storagePath',
      );
      expect(JSON.stringify(courseProgressResponse.body)).not.toContain(
        'correctChoiceId',
      );

      const subjectProgressResponse = await request(server)
        .get('/subjects/subject-1/progress')
        .expect(200);

      expect(mocks.getSubjectProgress.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
      });
      expect(subjectProgressResponse.body).toMatchObject({
        subjectId: 'subject-1',
        knowledgeUnitCount: 12,
        practicedKnowledgeUnitCount: 3,
        coverage: 0.25,
        mastery: 0.72,
        estimatedGlobalMastery: 0.18,
        courseCount: 1,
        readyCourseCount: 1,
        courses: [
          {
            courseId: 'course-1',
            title: 'Droit constitutionnel',
            state: 'PRACTICED',
          },
        ],
      });
      assertNoSensitivePreSubmitFields(subjectProgressResponse.body);
      expect(JSON.stringify(subjectProgressResponse.body)).not.toContain(
        'storagePath',
      );

      await request(server).delete('/courses/course-1').expect(204);

      expect(mocks.deleteCourse.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        courseId: 'course-1',
      });

      await request(server)
        .delete('/courses/course-1/sources/document-1')
        .expect(204);

      expect(mocks.deleteCourseDocument.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        courseId: 'course-1',
        documentId: 'document-1',
      });
    });

    it('maps Course API validation, not found and conflict errors', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/subjects/subject-1/courses')
        .send({ title: 'x' })
        .expect(400);

      mocks.getCourseDetail.execute.mockRejectedValueOnce(
        new Error('Course not found'),
      );
      await request(server).get('/courses/other-student-course').expect(404);

      mocks.getCourseProgress.execute.mockRejectedValueOnce(
        new Error('Course not found'),
      );
      await request(server)
        .get('/courses/other-student-course/progress')
        .expect(404);

      mocks.getSubjectProgress.execute.mockRejectedValueOnce(
        new Error('Course subject not found'),
      );
      await request(server)
        .get('/subjects/other-student-subject/progress')
        .expect(404);

      mocks.deleteCourse.execute.mockRejectedValueOnce(
        new CourseContainsDocumentsError(),
      );
      await request(server)
        .delete('/courses/course-with-documents')
        .expect(409);

      mocks.deleteCourseDocument.execute.mockRejectedValueOnce(
        new NotFoundException('Course source not found'),
      );
      await request(server)
        .delete('/courses/course-1/sources/other-document')
        .expect(404);
    });

    it('uploads a real course PDF source without client-provided subject context', async () => {
      const server = app.getHttpServer();

      const response = await request(server)
        .post('/courses/course-1/source/course-pdf')
        .attach('file', Buffer.from('%PDF-1.7'), {
          filename: 'cours.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      type CoursePdfUploadInput = {
        studentId: string;
        firebaseUid: string;
        courseId: string;
        originalFileName: string;
        content: Buffer;
        mimeType: string;
      };
      const uploadExecute = mocks.uploadCoursePdfForCourse
        .execute as jest.MockedFunction<
        (input: CoursePdfUploadInput) => Promise<unknown>
      >;
      const uploadInput = uploadExecute.mock.calls[0][0];

      expect(uploadInput.content).toBeInstanceOf(Buffer);
      expect(uploadInput).toMatchObject({
        studentId: currentStudent.id,
        firebaseUid: currentStudent.firebaseUid,
        courseId: 'course-1',
        originalFileName: 'cours.pdf',
        mimeType: 'application/pdf',
      });
      expect(response.body).toMatchObject({
        id: 'document-1',
        courseId: 'course-1',
        documentId: 'document-1',
        fileName: 'cours.pdf',
        kind: 'COURSE_PDF',
        status: 'UPLOADED',
      });
      expect(
        JSON.stringify(mocks.uploadCoursePdfForCourse.execute.mock.calls),
      ).not.toContain('subjectId');
    });

    it('maps Course PDF upload validation and ownership errors', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/courses/course-1/source/course-pdf')
        .attach('file', Buffer.from('not a pdf'), {
          filename: 'notes.txt',
          contentType: 'text/plain',
        })
        .expect(400);

      await request(server)
        .post('/courses/course-1/source/course-pdf')
        .field('subjectId', 'client-subject')
        .attach('file', Buffer.from('%PDF-1.7'), {
          filename: 'cours.pdf',
          contentType: 'application/pdf',
        })
        .expect(400);

      mocks.uploadCoursePdfForCourse.execute.mockRejectedValueOnce(
        new Error('Course not found'),
      );

      await request(server)
        .post('/courses/other-student-course/source/course-pdf')
        .attach('file', Buffer.from('%PDF-1.7'), {
          filename: 'cours.pdf',
          contentType: 'application/pdf',
        })
        .expect(404);
    });

    it('serves course-level revision sheets through the backend-selected READY source', async () => {
      const server = app.getHttpServer();

      const getResponse = await request(server)
        .get('/courses/course-1/revision-sheet')
        .expect(200);
      const getBody = getResponse.body as RevisionSheetResponse;

      expect(mocks.getCourseRevisionSheet.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        courseId: 'course-1',
      });
      expect(getBody.documentId).toBe('document-1');
      assertNoSensitivePreSubmitFields(getBody);
      expect(JSON.stringify(getBody)).not.toContain('storagePath');
      expect(JSON.stringify(getBody)).not.toContain('provider');
      expect(JSON.stringify(getBody)).not.toContain('promptVersion');

      const postResponse = await request(server)
        .post('/courses/course-1/revision-sheet')
        .send({ documentId: 'client-picked-document', subjectId: 'subject-1' })
        .expect(201);

      expect(mocks.generateCourseRevisionSheet.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        courseId: 'course-1',
      });
      expect(
        JSON.stringify(mocks.generateCourseRevisionSheet.execute.mock.calls),
      ).not.toContain('client-picked-document');
      expect(postResponse.body).toMatchObject({
        id: 'sheet-1',
        documentId: 'document-1',
        subjectId: 'subject-1',
      });
    });

    it('maps course-level revision sheet readiness errors to 409', async () => {
      mocks.generateCourseRevisionSheet.execute.mockRejectedValueOnce(
        new CourseRevisionSheetSourceNotReadyError(),
      );

      await request(app.getHttpServer())
        .post('/courses/course-without-ready-source/revision-sheet')
        .expect(409);
    });

    it('starts a course-level quick revision session without client-owned ids', async () => {
      const response = await request(app.getHttpServer())
        .post('/courses/course-1/revision-sessions/quick')
        .send({})
        .expect(201);

      expect(
        mocks.startCourseQuickRevisionSession.execute.mock.calls,
      ).toMatchObject([
        [
          {
            studentId: currentStudent.id,
            courseId: 'course-1',
          },
        ],
      ]);
      const responseBody = response.body as {
        session?: Record<string, unknown>;
        currentAction?: Record<string, unknown>;
      };
      expect(responseBody.session).toMatchObject({
        id: 'revision-session-1',
        courseId: 'course-1',
        mode: 'QUICK',
      });
      expect(responseBody.currentAction).toMatchObject({
        kind: 'DIAGNOSTIC_QUIZ',
      });
      expect(JSON.stringify(responseBody)).not.toContain('correctChoiceId');
      expect(JSON.stringify(responseBody)).not.toContain('correctAnswers');
      expect(JSON.stringify(responseBody)).not.toContain('score');
      expect(
        JSON.stringify(
          mocks.startCourseQuickRevisionSession.execute.mock.calls,
        ),
      ).not.toContain('client-picked-document');
    });

    it('rejects client-owned quick revision ids and maps readiness errors', async () => {
      await request(app.getHttpServer())
        .post('/courses/course-1/revision-sessions/quick')
        .send({
          subjectId: 'client-subject',
          documentId: 'client-picked-document',
          knowledgeUnitId: 'client-unit',
        })
        .expect(400);

      mocks.startCourseQuickRevisionSession.execute.mockRejectedValueOnce(
        new CourseQuickRevisionSourceNotReadyError(),
      );

      await request(app.getHttpServer())
        .post('/courses/course-without-ready-source/revision-sessions/quick')
        .send({})
        .expect(409);

      mocks.startCourseQuickRevisionSession.execute.mockRejectedValueOnce(
        new CourseQuickRevisionKnowledgeUnitNotReadyError(),
      );

      await request(app.getHttpServer())
        .post('/courses/course-without-ready-unit/revision-sessions/quick')
        .send({})
        .expect(409);
    });

    it('maps missing documents to a clean 404 response', async () => {
      mocks.getDocument.execute.mockRejectedValueOnce(
        new NotFoundException('Document not found'),
      );

      await request(app.getHttpServer())
        .get('/documents/missing-document')
        .expect(404);
    });

    it('serves ready summary and revision sheet without internal metadata', async () => {
      const server = app.getHttpServer();

      const summaryResponse = await request(server)
        .get('/documents/document-1/summary')
        .expect(200);
      const summaryBody = summaryResponse.body as SummaryResponse;

      expect(mocks.getDocumentSummary.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        documentId: 'document-1',
      });
      expect(summaryBody.title).toBe('Synthèse de démonstration');
      assertNoSensitivePreSubmitFields(summaryResponse.body);
      expect(JSON.stringify(summaryResponse.body)).not.toContain('provider');
      expect(JSON.stringify(summaryResponse.body)).not.toContain(
        'promptVersion',
      );

      const sheetResponse = await request(server)
        .get('/documents/document-1/revision-sheet')
        .expect(200);
      const sheetBody = sheetResponse.body as RevisionSheetResponse;

      expect(mocks.getRevisionSheet.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        documentId: 'document-1',
      });
      expect(sheetBody.sections).toHaveLength(1);
      assertNoSensitivePreSubmitFields(sheetResponse.body);
      expect(JSON.stringify(sheetResponse.body)).not.toContain('provider');
      expect(JSON.stringify(sheetResponse.body)).not.toContain('promptVersion');
    });

    it('returns a deterministic multi-action TodayPlan for the current student', async () => {
      const response = await request(app.getHttpServer())
        .get('/today')
        .expect(200);
      const todayBody = response.body as TodayPlanResponse;

      expect(mocks.getTodayPlan.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
      });
      expect(todayBody.items.map((item) => item.action)).toEqual([
        'diagnostic_quiz',
        'open_question',
        'rich_closed_exercise',
        'revision_session',
      ]);
      const richClosedItem = todayBody.items.find(
        (item) => item.action === 'rich_closed_exercise',
      );
      expect(richClosedItem).toMatchObject({
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        startPayload: {
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
        },
      });
      expect(richClosedItem).not.toHaveProperty('questions');
      expect(richClosedItem).not.toHaveProperty('correction');
      assertNoSensitivePreSubmitFields(response.body);
      expect(JSON.stringify(response.body)).not.toContain('other-student');
    });

    it('starts a QCM with bounded v3 options and no correction leak', async () => {
      const response = await request(app.getHttpServer())
        .post('/activities/next')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 12,
          visualsEnabled: true,
          visualTypes: ['CHART', 'DIAGRAM'],
          selectionModes: ['single', 'multiple'],
        })
        .expect(201);
      const responseBody = response.body as ActivityResponse;

      expect(mocks.startNextActivity.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
        questionCount: 12,
        visualsEnabled: true,
        visualTypes: ['CHART', 'DIAGRAM'],
        selectionModes: ['single', 'multiple'],
      });
      expect(responseBody.type).toBe('diagnostic_quiz');
      assertNoSensitivePreSubmitFields(response.body);
    });

    it('rejects invalid QCM payloads before calling the use case', async () => {
      await request(app.getHttpServer())
        .post('/activities/next')
        .send({
          subjectId: 'subject-1',
          questionCount: 25,
          visualTypes: ['IMAGE'],
        })
        .expect(400);

      expect(mocks.startNextActivity.execute).not.toHaveBeenCalled();
    });

    it('submits QCM answers and maps critical submit errors', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/activities/quiz-session-1/result')
        .send({
          answers: [
            { questionId: 'question-1', choiceId: 'choice-1' },
            { questionId: 'question-2', choiceIds: ['choice-2', 'choice-3'] },
          ],
        })
        .expect(201);

      expect(mocks.submitActivityResult.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'quiz-session-1',
        answers: [
          { questionId: 'question-1', choiceId: 'choice-1' },
          { questionId: 'question-2', choiceIds: ['choice-2', 'choice-3'] },
        ],
      });

      await request(server)
        .post('/activities/quiz-session-1/result')
        .send({ answers: [{ questionId: 'question-1' }] })
        .expect(400);

      mocks.submitActivityResult.execute.mockRejectedValueOnce(
        new Error('Activity session not found'),
      );
      await request(server)
        .post('/activities/missing-session/result')
        .send({ answers: [{ questionId: 'question-1', choiceId: 'choice-1' }] })
        .expect(404);

      mocks.submitActivityResult.execute.mockRejectedValueOnce(
        new Error('Activity session already submitted'),
      );
      await request(server)
        .post('/activities/submitted-session/result')
        .send({ answers: [{ questionId: 'question-1', choiceId: 'choice-1' }] })
        .expect(409);

      mocks.submitActivityResult.execute.mockRejectedValueOnce(
        new Error('Generated diagnostic quiz is invalid'),
      );
      await request(server)
        .post('/activities/invalid-generation/result')
        .send({ answers: [{ questionId: 'question-1', choiceId: 'choice-1' }] })
        .expect(422);
    });

    it('starts an open question without exposing correction fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/activities/open-question')
        .send({ subjectId: 'subject-1', knowledgeUnitId: 'unit-1' })
        .expect(201);
      const responseBody = response.body as OpenQuestionResponse;

      expect(mocks.startOpenQuestionActivity.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
      });
      expect(responseBody.type).toBe('open_question');
      assertNoSensitivePreSubmitFields(response.body);
    });

    it('validates open question start and submit payloads', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/activities/open-question')
        .send({ subjectId: 'subject-1' })
        .expect(400);
      expect(mocks.startOpenQuestionActivity.execute).not.toHaveBeenCalled();

      await request(server)
        .post('/activities/open-session-1/open-answer')
        .send({ answerText: '   ' })
        .expect(400);
      expect(mocks.submitOpenAnswer.execute).not.toHaveBeenCalled();
    });

    it('submits an open answer and maps critical evaluation errors', async () => {
      const server = app.getHttpServer();
      const answerText =
        'La distinction entre les régimes parlementaire et présidentiel repose sur la responsabilité politique du gouvernement et sur la séparation institutionnelle des pouvoirs.';

      await request(server)
        .post('/activities/open-session-1/open-answer')
        .send({ answerText })
        .expect(201);

      expect(mocks.submitOpenAnswer.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'open-session-1',
        answerText,
      });

      mocks.submitOpenAnswer.execute.mockRejectedValueOnce(
        new Error('Activity session not found'),
      );
      await request(server)
        .post('/activities/missing-session/open-answer')
        .send({ answerText })
        .expect(404);

      mocks.submitOpenAnswer.execute.mockRejectedValueOnce(
        new Error('Activity session is not an open question'),
      );
      await request(server)
        .post('/activities/quiz-session/open-answer')
        .send({ answerText })
        .expect(400);

      mocks.submitOpenAnswer.execute.mockRejectedValueOnce(
        new Error('OPEN_ANSWER_EVALUATION_INVALID'),
      );
      await request(server)
        .post('/activities/open-session-invalid/open-answer')
        .send({ answerText })
        .expect(422);
    });

    it('routes rich closed start, get, submit and result without pre-submit leaks', async () => {
      const server = app.getHttpServer();

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 6,
        })
        .expect(201);

      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 6,
        complexityProfile: 'exam',
        questionTypeMix: undefined,
      });
      const startBody = startResponse.body as ReturnType<
        typeof richClosedPublicExercise
      >;
      expect(startBody.type).toBe('rich_closed_exercise');
      expect(
        startBody.questions.map(
          (question: { questionKind: RichClosedQuestionKind }) =>
            question.questionKind,
        ),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
      ]);
      expect(
        startBody.questions.every(
          (question: { sourceChunkIds?: unknown[] }) =>
            Array.isArray(question.sourceChunkIds) &&
            question.sourceChunkIds.length > 0,
        ),
      ).toBe(true);
      assertNoSensitivePreSubmitFields(startBody);

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-1')
        .expect(200);
      expect(mocks.getRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-1',
      });
      assertNoSensitivePreSubmitFields(getResponse.body);

      mocks.getRichClosedExerciseResult.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_SESSION_NOT_COMPLETED'),
      );
      await request(server)
        .get('/activities/rich-closed/rich-session-1/result')
        .expect(409);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-1/submit')
        .send({ answers: richClosedAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-1',
        answers: richClosedAnswers(),
      });
      const submitBody = submitResponse.body as {
        items: Array<Record<string, unknown>>;
      };
      expect(submitBody).toMatchObject({
        correctAnswers: 6,
        totalQuestions: 6,
        score: 1,
      });
      expect(submitBody.items).toHaveLength(6);
      expect(submitBody.items[0]).toHaveProperty('correction');
      expect(JSON.stringify(submitBody)).toContain('explanation');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-1/result')
        .expect(200);
      expect(mocks.getRichClosedExerciseResult.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-1',
      });
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 6,
        totalQuestions: 6,
      });
    });

    it('routes rich closed V1-B timeline and date slider without pre-submit leaks', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BPublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BPublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1BResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 8,
          questionTypeMix,
        })
        .expect(201);

      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };
      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 8,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map(
          (question: { questionKind: RichClosedQuestionKind }) =>
            question.questionKind,
        ),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
      ]);
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).not.toContain('correctYear');
      expect(JSON.stringify(startBody)).not.toContain('correctOrder');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1b')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1b/submit')
        .send({ answers: richClosedV1BAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1b',
        answers: richClosedV1BAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 8,
        totalQuestions: 8,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctYear');
      expect(JSON.stringify(submitResponse.body)).toContain('correctOrder');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1b/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 8,
        totalQuestions: 8,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1b/submit')
        .send({
          answers: replaceRichClosedV1BAnswer({
            questionId: 'date-slider-1',
            questionKind: 'date_slider',
            year: 1958.5,
          } as unknown as RichClosedAnswer),
        })
        .expect(400);

      const semanticInvalidSubmissions = [
        replaceRichClosedV1BAnswer({
          questionId: 'timeline-1',
          questionKind: 'timeline',
          orderedEventIds: ['event-1', 'event-1', 'event-3'],
        }),
        replaceRichClosedV1BAnswer({
          questionId: 'timeline-1',
          questionKind: 'timeline',
          orderedEventIds: ['event-1', 'event-2', 'unknown-event'],
        }),
        replaceRichClosedV1BAnswer({
          questionId: 'timeline-1',
          questionKind: 'timeline',
          orderedEventIds: ['event-1', 'event-2'],
        }),
        replaceRichClosedV1BAnswer({
          questionId: 'date-slider-1',
          questionKind: 'date_slider',
          year: 1971,
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-v1b/submit')
          .send({ answers })
          .expect(400);
      }
    });

    it('routes rich closed V1-B true/false grid and cause/consequence without pre-submit leaks', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
        true_false_grid: 1,
        cause_consequence: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BFullPublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BFullPublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BFullResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1BFullResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 10,
          questionTypeMix,
        })
        .expect(201);

      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };
      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 10,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map((question) => question.questionKind),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
      ]);
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).not.toContain('correctValues');
      expect(JSON.stringify(startBody)).not.toContain('correctPairs');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1b-full')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1b-full/submit')
        .send({ answers: richClosedV1BFullAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1b-full',
        answers: richClosedV1BFullAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 10,
        totalQuestions: 10,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctValues');
      expect(JSON.stringify(submitResponse.body)).toContain('correctPairs');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1b-full/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 10,
        totalQuestions: 10,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1b-full/submit')
        .send({
          answers: replaceRichClosedV1BFullAnswer({
            questionId: 'true-false-grid-1',
            questionKind: 'true_false_grid',
            values: [
              { rowId: 'row-1', value: true },
              { rowId: 'row-2', value: false },
              { rowId: 'row-3', value: 'true' },
            ],
          }),
        })
        .expect(400);

      const semanticInvalidSubmissions = [
        replaceRichClosedV1BFullAnswer({
          questionId: 'true-false-grid-1',
          questionKind: 'true_false_grid',
          values: [
            { rowId: 'row-1', value: true },
            { rowId: 'row-1', value: false },
            { rowId: 'row-3', value: true },
          ],
        }),
        replaceRichClosedV1BFullAnswer({
          questionId: 'true-false-grid-1',
          questionKind: 'true_false_grid',
          values: [
            { rowId: 'row-1', value: true },
            { rowId: 'row-2', value: false },
          ],
        }),
        replaceRichClosedV1BFullAnswer({
          questionId: 'cause-consequence-1',
          questionKind: 'cause_consequence',
          pairs: [
            { causeId: 'cause-1', consequenceId: 'consequence-1' },
            { causeId: 'cause-1', consequenceId: 'consequence-2' },
            { causeId: 'cause-3', consequenceId: 'consequence-3' },
          ],
        }),
        replaceRichClosedV1BFullAnswer({
          questionId: 'cause-consequence-1',
          questionKind: 'cause_consequence',
          pairs: [
            { causeId: 'cause-1', consequenceId: 'consequence-1' },
            { causeId: 'cause-2', consequenceId: 'unknown-consequence' },
            { causeId: 'cause-3', consequenceId: 'consequence-3' },
          ],
        }),
        replaceRichClosedV1BFullAnswer({
          questionId: 'cause-consequence-1',
          questionKind: 'cause_consequence',
          pairs: [
            { causeId: 'cause-1', consequenceId: 'consequence-1' },
            { causeId: 'cause-2', consequenceId: 'consequence-2' },
          ],
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-v1b-full/submit')
          .send({ answers })
          .expect(400);
      }
    });

    it('routes rich closed V1-C institution matrix without pre-submit leaks', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
        true_false_grid: 1,
        cause_consequence: 1,
        institution_matrix: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CPublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CPublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1CResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 11,
          questionTypeMix,
        })
        .expect(201);

      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };
      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 11,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map((question) => question.questionKind),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
        'institution_matrix',
      ]);
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).not.toContain('correctValues');
      expect(JSON.stringify(startBody)).not.toContain('explanation');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1c/submit')
        .send({ answers: richClosedV1CAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1c',
        answers: richClosedV1CAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 11,
        totalQuestions: 11,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctValues');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 11,
        totalQuestions: 11,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1c/submit')
        .send({
          answers: replaceRichClosedV1CAnswer({
            questionId: 'institution-matrix-1',
            questionKind: 'institution_matrix',
            values: [
              {
                cellId: 'cell-president-legitimacy',
                optionId: 'option-legitimacy-election',
              },
              {
                cellId: 'cell-government-responsibility',
                optionId: 42,
              },
              {
                cellId: 'cell-assembly-action',
                optionId: 'option-action-censure',
              },
            ],
          }),
        })
        .expect(400);

      const semanticInvalidSubmissions = [
        replaceRichClosedV1CAnswer({
          questionId: 'institution-matrix-1',
          questionKind: 'institution_matrix',
          values: [
            {
              cellId: 'cell-president-legitimacy',
              optionId: 'option-legitimacy-election',
            },
            {
              cellId: 'cell-president-legitimacy',
              optionId: 'option-legitimacy-confidence',
            },
            {
              cellId: 'cell-assembly-action',
              optionId: 'option-action-censure',
            },
          ],
        }),
        replaceRichClosedV1CAnswer({
          questionId: 'institution-matrix-1',
          questionKind: 'institution_matrix',
          values: [
            {
              cellId: 'unknown-cell',
              optionId: 'option-legitimacy-election',
            },
            {
              cellId: 'cell-government-responsibility',
              optionId: 'option-responsibility-assembly',
            },
            {
              cellId: 'cell-assembly-action',
              optionId: 'option-action-censure',
            },
          ],
        }),
        replaceRichClosedV1CAnswer({
          questionId: 'institution-matrix-1',
          questionKind: 'institution_matrix',
          values: [
            {
              cellId: 'cell-president-legitimacy',
              optionId: 'option-action-censure',
            },
            {
              cellId: 'cell-government-responsibility',
              optionId: 'option-responsibility-assembly',
            },
            {
              cellId: 'cell-assembly-action',
              optionId: 'option-action-censure',
            },
          ],
        }),
        replaceRichClosedV1CAnswer({
          questionId: 'institution-matrix-1',
          questionKind: 'institution_matrix',
          values: [
            {
              cellId: 'cell-president-legitimacy',
              optionId: 'option-legitimacy-election',
            },
            {
              cellId: 'cell-government-responsibility',
              optionId: 'option-responsibility-assembly',
            },
          ],
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-v1c/submit')
          .send({ answers })
          .expect(400);
      }
    });

    it('routes rich closed V1-C diagram labeling without arbitrary render payloads', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
        true_false_grid: 1,
        cause_consequence: 1,
        institution_matrix: 1,
        diagram_labeling: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CFullPublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CFullPublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CFullResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1CFullResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 12,
          questionTypeMix,
        })
        .expect(201);

      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };
      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 12,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map((question) => question.questionKind),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
        'institution_matrix',
        'diagram_labeling',
      ]);
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).not.toContain('correctValues');
      expect(JSON.stringify(startBody)).not.toContain('explanation');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c-full')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1c-full/submit')
        .send({ answers: richClosedV1CFullAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1c-full',
        answers: richClosedV1CFullAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 12,
        totalQuestions: 12,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctValues');
      expect(JSON.stringify(submitResponse.body)).not.toContain(
        'renderPayload',
      );
      expect(JSON.stringify(submitResponse.body)).not.toContain('mermaid');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c-full/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 12,
        totalQuestions: 12,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1c-full/submit')
        .send({
          answers: replaceRichClosedV1CFullAnswer({
            questionId: 'diagram-labeling-1',
            questionKind: 'diagram_labeling',
            values: [
              { slotId: 'slot-government-role', optionId: 'option-government' },
              { slotId: 'slot-censure', optionId: 42 },
              { slotId: 'slot-nomination', optionId: 'option-nomination' },
            ],
          }),
        })
        .expect(400);

      await request(server)
        .post('/activities/rich-closed/rich-session-v1c-full/submit')
        .send({
          answers: replaceRichClosedV1CFullAnswer({
            questionId: 'diagram-labeling-1',
            questionKind: 'diagram_labeling',
            values: [
              { slotId: 'slot-government-role', optionId: 'option-government' },
              {
                slotId: 'slot-censure',
                optionId: 'option-motion-censure',
              },
              { slotId: 'slot-nomination', optionId: 'option-nomination' },
            ],
            renderPayload: { widget: 'free-form' },
          }),
        })
        .expect(400);

      const semanticInvalidSubmissions = [
        replaceRichClosedV1CFullAnswer({
          questionId: 'diagram-labeling-1',
          questionKind: 'diagram_labeling',
          values: [
            { slotId: 'slot-government-role', optionId: 'option-government' },
            { slotId: 'slot-government-role', optionId: 'option-president' },
            { slotId: 'slot-nomination', optionId: 'option-nomination' },
          ],
        }),
        replaceRichClosedV1CFullAnswer({
          questionId: 'diagram-labeling-1',
          questionKind: 'diagram_labeling',
          values: [
            { slotId: 'unknown-slot', optionId: 'option-government' },
            { slotId: 'slot-censure', optionId: 'option-motion-censure' },
            { slotId: 'slot-nomination', optionId: 'option-nomination' },
          ],
        }),
        replaceRichClosedV1CFullAnswer({
          questionId: 'diagram-labeling-1',
          questionKind: 'diagram_labeling',
          values: [
            {
              slotId: 'slot-government-role',
              optionId: 'option-motion-censure',
            },
            { slotId: 'slot-censure', optionId: 'option-motion-censure' },
            { slotId: 'slot-nomination', optionId: 'option-nomination' },
          ],
        }),
        replaceRichClosedV1CFullAnswer({
          questionId: 'diagram-labeling-1',
          questionKind: 'diagram_labeling',
          values: [
            { slotId: 'slot-government-role', optionId: 'option-government' },
            { slotId: 'slot-censure', optionId: 'option-motion-censure' },
          ],
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-v1c-full/submit')
          .send({ answers })
          .expect(400);
      }
    });

    it('routes rich closed V1-C calculation MCQ without formula leaks', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
        true_false_grid: 1,
        cause_consequence: 1,
        institution_matrix: 1,
        diagram_labeling: 1,
        calculation_mcq: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CCalculationPublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CCalculationPublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CCalculationResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1CCalculationResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 13,
          questionTypeMix,
        })
        .expect(201);
      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };

      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 13,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map((question) => question.questionKind),
      ).toContain('calculation_mcq');
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).toContain('scenario');
      expect(JSON.stringify(startBody)).toContain('calculation');
      expect(JSON.stringify(startBody)).toContain('value');
      expect(JSON.stringify(startBody)).not.toContain('correctChoiceId');
      expect(JSON.stringify(startBody)).not.toContain('expectedValue');
      expect(JSON.stringify(startBody)).not.toContain('workedSteps');
      expect(JSON.stringify(startBody)).not.toContain('formula');
      expect(JSON.stringify(startBody)).not.toContain('renderPayload');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c-calculation')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1c-calculation/submit')
        .send({ answers: richClosedV1CCalculationAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1c-calculation',
        answers: richClosedV1CCalculationAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 13,
        totalQuestions: 13,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctChoiceId');
      expect(JSON.stringify(submitResponse.body)).toContain('expectedValue');
      expect(JSON.stringify(submitResponse.body)).toContain('workedSteps');
      expect(JSON.stringify(submitResponse.body)).not.toContain('formula');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c-calculation/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 13,
        totalQuestions: 13,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1c-calculation/submit')
        .send({
          answers: replaceRichClosedV1CCalculationAnswer({
            questionId: 'calculation-mcq-majority-1',
            questionKind: 'calculation_mcq',
            choiceId: 289,
          }),
        })
        .expect(400);

      await request(server)
        .post('/activities/rich-closed/rich-session-v1c-calculation/submit')
        .send({
          answers: replaceRichClosedV1CCalculationAnswer({
            questionId: 'calculation-mcq-majority-1',
            questionKind: 'calculation_mcq',
            choiceId: 'choice-289',
            formula: 'floor(validVotes / 2) + 1',
          }),
        })
        .expect(400);

      mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
      );
      await request(server)
        .post('/activities/rich-closed/rich-session-v1c-calculation/submit')
        .send({
          answers: replaceRichClosedV1CCalculationAnswer({
            questionId: 'calculation-mcq-majority-1',
            questionKind: 'calculation_mcq',
            choiceId: 'unknown-choice',
          }),
        })
        .expect(400);
    });

    it('routes rich closed V1-D image choice without image asset leaks', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
        true_false_grid: 1,
        cause_consequence: 1,
        institution_matrix: 1,
        diagram_labeling: 1,
        calculation_mcq: 1,
        image_choice: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1DImageChoicePublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1DImageChoicePublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1DImageChoiceResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1DImageChoiceResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 14,
          questionTypeMix,
        })
        .expect(201);
      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };

      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 14,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map((question) => question.questionKind),
      ).toContain('image_choice');
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).toContain(
        'image-choice-historical-figure-001-v1',
      );
      expect(JSON.stringify(startBody)).toContain('altText');
      expect(JSON.stringify(startBody)).toContain('internal_placeholder');
      expect(JSON.stringify(startBody)).not.toContain('correctChoiceId');
      expect(JSON.stringify(startBody)).not.toContain('semanticLabel');
      expect(JSON.stringify(startBody)).not.toContain('answerHint');
      expect(JSON.stringify(startBody)).not.toContain('imageUrl');
      expect(JSON.stringify(startBody)).not.toContain('base64');
      expect(JSON.stringify(startBody)).not.toContain('blob');
      expect(JSON.stringify(startBody)).not.toContain('storagePath');
      expect(JSON.stringify(startBody)).not.toContain('de-gaulle');
      expect(JSON.stringify(startBody)).not.toContain('napoleon');
      expect(JSON.stringify(startBody)).not.toContain('simone');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1d-image-choice')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);
      expect(JSON.stringify(getResponse.body)).not.toContain('de-gaulle');
      expect(JSON.stringify(getResponse.body)).not.toContain('napoleon');
      expect(JSON.stringify(getResponse.body)).not.toContain('simone');

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1d-image-choice/submit')
        .send({ answers: richClosedV1DImageChoiceAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1d-image-choice',
        answers: richClosedV1DImageChoiceAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 14,
        totalQuestions: 14,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctChoiceId');
      expect(JSON.stringify(submitResponse.body)).not.toContain('imageUrl');
      expect(JSON.stringify(submitResponse.body)).not.toContain('base64');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1d-image-choice/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 14,
        totalQuestions: 14,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1d-image-choice/submit')
        .send({
          answers: replaceRichClosedV1DImageChoiceAnswer({
            questionId: 'image-choice-1',
            questionKind: 'image_choice',
            choiceId: 42,
          }),
        })
        .expect(400);

      await request(server)
        .post('/activities/rich-closed/rich-session-v1d-image-choice/submit')
        .send({
          answers: replaceRichClosedV1DImageChoiceAnswer({
            questionId: 'image-choice-1',
            questionKind: 'image_choice',
            choiceId: 'choice-image-a',
            imageUrl: 'https://example.invalid/image.png',
            blob: 'blob://unsafe',
          }),
        })
        .expect(400);

      mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
      );
      await request(server)
        .post('/activities/rich-closed/rich-session-v1d-image-choice/submit')
        .send({
          answers: replaceRichClosedV1DImageChoiceAnswer({
            questionId: 'image-choice-1',
            questionKind: 'image_choice',
            choiceId: 'unknown-choice',
          }),
        })
        .expect(400);
    });

    it('validates and maps rich closed errors', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 5,
        })
        .expect(400);
      expect(mocks.startRichClosedExercise.execute).not.toHaveBeenCalled();

      await request(server)
        .post('/activities/rich-closed/rich-session-1/submit')
        .send({
          answers: [
            {
              questionId: 'single-1',
              questionKind: 'single_choice',
              choiceId: 'choice-a',
              modelAnswer: 'interdit',
            },
          ],
        })
        .expect(400);
      expect(mocks.submitRichClosedExercise.execute).not.toHaveBeenCalled();

      await request(server)
        .post('/activities/rich-closed/rich-session-1/submit')
        .send({
          answers: [
            ...richClosedAnswers(),
            {
              questionId: 'single-1',
              questionKind: 'single_choice',
              choiceId: 'choice-a',
            },
          ],
        })
        .expect(400);
      expect(mocks.submitRichClosedExercise.execute).not.toHaveBeenCalled();

      const semanticInvalidSubmissions = [
        replaceRichClosedAnswer({
          questionId: 'single-1',
          questionKind: 'single_choice',
          choiceId: 'unknown-choice',
        }),
        richClosedAnswers().filter(
          (answer) => answer.questionId !== 'single-1',
        ),
        replaceRichClosedAnswer({
          questionId: 'matching-1',
          questionKind: 'matching',
          pairs: [
            { leftId: 'left-1', rightId: 'right-1' },
            { leftId: 'left-2', rightId: 'unknown-right' },
            { leftId: 'left-3', rightId: 'right-3' },
          ],
        }),
        replaceRichClosedAnswer({
          questionId: 'ordering-1',
          questionKind: 'ordering',
          orderedIds: ['item-1', 'item-2'],
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-1/submit')
          .send({ answers })
          .expect(400);
      }

      mocks.getRichClosedExercise.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_SESSION_NOT_FOUND'),
      );
      await request(server)
        .get('/activities/rich-closed/missing-session')
        .expect(404);

      mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_SESSION_ALREADY_COMPLETED'),
      );
      await request(server)
        .post('/activities/rich-closed/rich-session-1/submit')
        .send({ answers: richClosedAnswers() })
        .expect(409);

      mocks.startRichClosedExercise.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_GENERATION_QUALITY_REJECTED'),
      );
      await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 6,
        })
        .expect(422);
    });

    it('routes revision sessions and next actions without free-message leakage', async () => {
      const server = app.getHttpServer();

      const startResponse = await request(server)
        .post('/revision-sessions')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          preferredAction: 'open_question',
        })
        .expect(201);

      expect(mocks.startRevisionSession.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        preferredAction: 'open_question',
      });
      assertNoSensitivePreSubmitFields(startResponse.body);

      await request(server)
        .get('/revision-sessions/revision-session-1')
        .expect(200);
      expect(mocks.getRevisionSession.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'revision-session-1',
      });

      await request(server)
        .post('/revision-sessions/revision-session-1/next-action')
        .send({ message: 'ignore this free text' })
        .expect(201);

      expect(mocks.requestNextAction.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'revision-session-1',
      });
      expect(
        JSON.stringify(mocks.requestNextAction.execute.mock.calls),
      ).not.toContain('ignore this free text');

      mocks.requestNextAction.execute.mockRejectedValueOnce(
        new Error('Quick course revision sessions do not support next actions'),
      );
      await request(server)
        .post('/revision-sessions/course-quick-session/next-action')
        .send({})
        .expect(409);

      await request(server)
        .post('/revision-sessions/revision-session-1/complete')
        .send({ score: 1 })
        .expect(400);

      const completeResponse = await request(server)
        .post('/revision-sessions/revision-session-1/complete')
        .send({})
        .expect(201);

      expect(mocks.completeQuickRevisionSession.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'revision-session-1',
      });
      expect(JSON.stringify(completeResponse.body)).not.toContain(
        'correctChoiceId',
      );
      expect(JSON.stringify(completeResponse.body)).not.toContain(
        'selectedChoiceId',
      );

      const resultResponse = await request(server)
        .get('/revision-sessions/revision-session-1/result')
        .expect(200);

      expect(mocks.getRevisionSessionResult.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'revision-session-1',
      });
      expect(JSON.stringify(resultResponse.body)).not.toContain(
        'correctChoiceId',
      );
    });

    it('routes rich closed revision sessions as bounded launchers', async () => {
      mocks.startRevisionSession.execute.mockResolvedValueOnce(
        richClosedRevisionSessionResponse(),
      );

      const response = await request(app.getHttpServer())
        .post('/revision-sessions')
        .send({
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
          preferredAction: 'rich_closed_exercise',
        })
        .expect(201);

      expect(mocks.startRevisionSession.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        preferredAction: 'rich_closed_exercise',
      });
      const body = response.body as ReturnType<
        typeof richClosedRevisionSessionResponse
      >;

      expect(body.currentAction).toMatchObject({
        kind: 'RICH_CLOSED_EXERCISE',
        activitySessionId: null,
        payload: {
          type: 'rich_closed_exercise',
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
          preferredAction: 'rich_closed_exercise',
        },
      });
      expect(body.currentAction.payload).not.toHaveProperty('questions');
      expect(body.currentAction.payload).not.toHaveProperty('correction');
      assertNoSensitivePreSubmitFields(body);
    });

    it('validates and maps revision session errors', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/revision-sessions')
        .send({ subjectId: 'subject-1', preferredAction: 'chat' })
        .expect(400);
      expect(mocks.startRevisionSession.execute).not.toHaveBeenCalled();

      mocks.startRevisionSession.execute.mockRejectedValueOnce(
        new Error('Open question revision session requires a knowledge unit'),
      );
      await request(server)
        .post('/revision-sessions')
        .send({ subjectId: 'subject-1', preferredAction: 'open_question' })
        .expect(422);

      mocks.getRevisionSession.execute.mockRejectedValueOnce(
        new Error('Revision session not found'),
      );
      await request(server)
        .get('/revision-sessions/missing-session')
        .expect(404);
    });
  });
});

async function createAppWithRealAuthGuard(): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(TOKEN_VERIFIER)
    .useValue({ verify: jest.fn() })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}

async function createAuthenticatedApp(
  mocks: CriticalPathMocks,
): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(FirebaseAuthGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        // The e2e suite verifies controller contracts, not Firebase itself.
        // Injecting an explicit fake student keeps every request scoped while
        // avoiding Firebase Admin and BootstrapStudentUseCase side effects.
        const httpRequest = context
          .switchToHttp()
          .getRequest<{ student?: typeof currentStudent }>();
        httpRequest.student = currentStudent;
        return true;
      },
    })
    .overrideProvider(TOKEN_VERIFIER)
    .useValue({ verify: jest.fn() })
    .overrideProvider(PrismaService)
    .useValue({})
    .overrideProvider(GetDocumentUseCase)
    .useValue(mocks.getDocument)
    .overrideProvider(ListDocumentKnowledgeUnitsUseCase)
    .useValue(mocks.listDocumentKnowledgeUnits)
    .overrideProvider(GetDocumentSummaryUseCase)
    .useValue(mocks.getDocumentSummary)
    .overrideProvider(GenerateDocumentSummaryUseCase)
    .useValue(mocks.generateDocumentSummary)
    .overrideProvider(GetRevisionSheetUseCase)
    .useValue(mocks.getRevisionSheet)
    .overrideProvider(GenerateRevisionSheetUseCase)
    .useValue(mocks.generateRevisionSheet)
    .overrideProvider(GetTodayPlanUseCase)
    .useValue(mocks.getTodayPlan)
    .overrideProvider(CreateCourseUseCase)
    .useValue(mocks.createCourse)
    .overrideProvider(ListSubjectCoursesWithStatsUseCase)
    .useValue(mocks.listCoursesWithStats)
    .overrideProvider(GetCourseDetailUseCase)
    .useValue(mocks.getCourseDetail)
    .overrideProvider(GetCourseProgressUseCase)
    .useValue(mocks.getCourseProgress)
    .overrideProvider(GetSubjectProgressUseCase)
    .useValue(mocks.getSubjectProgress)
    .overrideProvider(DeleteCourseUseCase)
    .useValue(mocks.deleteCourse)
    .overrideProvider(DeleteCourseDocumentUseCase)
    .useValue(mocks.deleteCourseDocument)
    .overrideProvider(UploadCoursePdfForCourseUseCase)
    .useValue(mocks.uploadCoursePdfForCourse)
    .overrideProvider(GetCourseRevisionSheetUseCase)
    .useValue(mocks.getCourseRevisionSheet)
    .overrideProvider(GenerateCourseRevisionSheetUseCase)
    .useValue(mocks.generateCourseRevisionSheet)
    .overrideProvider(StartCourseQuickRevisionSessionUseCase)
    .useValue(mocks.startCourseQuickRevisionSession)
    .overrideProvider(StartNextActivityUseCase)
    .useValue(mocks.startNextActivity)
    .overrideProvider(StartOpenQuestionActivityUseCase)
    .useValue(mocks.startOpenQuestionActivity)
    .overrideProvider(SubmitActivityResultUseCase)
    .useValue(mocks.submitActivityResult)
    .overrideProvider(SubmitOpenAnswerUseCase)
    .useValue(mocks.submitOpenAnswer)
    .overrideProvider(StartRichClosedExerciseUseCase)
    .useValue(mocks.startRichClosedExercise)
    .overrideProvider(GetRichClosedExerciseUseCase)
    .useValue(mocks.getRichClosedExercise)
    .overrideProvider(SubmitRichClosedExerciseUseCase)
    .useValue(mocks.submitRichClosedExercise)
    .overrideProvider(GetRichClosedExerciseResultUseCase)
    .useValue(mocks.getRichClosedExerciseResult)
    .overrideProvider(StartRevisionSessionUseCase)
    .useValue(mocks.startRevisionSession)
    .overrideProvider(GetRevisionSessionUseCase)
    .useValue(mocks.getRevisionSession)
    .overrideProvider(CompleteQuickRevisionSessionUseCase)
    .useValue(mocks.completeQuickRevisionSession)
    .overrideProvider(GetRevisionSessionResultUseCase)
    .useValue(mocks.getRevisionSessionResult)
    .overrideProvider(RequestNextRevisionSessionActionUseCase)
    .useValue(mocks.requestNextAction)
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}

function createCriticalPathMocks() {
  return {
    getDocument: {
      execute: jest.fn().mockResolvedValue(publicDocument()),
    },
    listDocumentKnowledgeUnits: {
      execute: jest.fn().mockResolvedValue(documentKnowledgeUnits()),
    },
    getDocumentSummary: {
      execute: jest.fn().mockResolvedValue(documentSummary()),
    },
    generateDocumentSummary: {
      execute: jest.fn().mockResolvedValue(documentSummary()),
    },
    getRevisionSheet: {
      execute: jest.fn().mockResolvedValue(revisionSheet()),
    },
    generateRevisionSheet: {
      execute: jest.fn().mockResolvedValue(revisionSheet()),
    },
    getTodayPlan: {
      execute: jest.fn().mockResolvedValue(todayPlan()),
    },
    createCourse: {
      execute: jest.fn().mockResolvedValue(courseWithStats({ sourceCount: 0 })),
    },
    listCoursesWithStats: {
      execute: jest.fn().mockResolvedValue([
        courseWithStats({
          sourceCount: 1,
          readySourceCount: 1,
        }),
      ]),
    },
    getCourseDetail: {
      execute: jest.fn().mockResolvedValue(courseDetail()),
    },
    getCourseProgress: {
      execute: jest.fn().mockResolvedValue(courseProgress()),
    },
    getSubjectProgress: {
      execute: jest.fn().mockResolvedValue(subjectProgress()),
    },
    deleteCourse: {
      execute: jest.fn().mockResolvedValue({ deleted: true }),
    },
    deleteCourseDocument: {
      execute: jest.fn().mockResolvedValue(undefined),
    },
    uploadCoursePdfForCourse: {
      execute: jest.fn().mockResolvedValue(courseDocument()),
    },
    getCourseRevisionSheet: {
      execute: jest.fn().mockResolvedValue(revisionSheet()),
    },
    generateCourseRevisionSheet: {
      execute: jest.fn().mockResolvedValue(revisionSheet()),
    },
    startCourseQuickRevisionSession: {
      execute: jest
        .fn()
        .mockResolvedValue(courseQuickRevisionSessionResponse()),
    },
    startNextActivity: {
      execute: jest.fn().mockResolvedValue(diagnosticQuizActivity()),
    },
    startOpenQuestionActivity: {
      execute: jest.fn().mockResolvedValue(openQuestionActivity()),
    },
    submitActivityResult: {
      execute: jest.fn().mockResolvedValue(qcmSubmissionResult()),
    },
    submitOpenAnswer: {
      execute: jest.fn().mockResolvedValue(openAnswerSubmissionResult()),
    },
    startRichClosedExercise: {
      execute: jest.fn().mockResolvedValue(richClosedPublicExercise()),
    },
    getRichClosedExercise: {
      execute: jest.fn().mockResolvedValue(richClosedPublicExercise()),
    },
    submitRichClosedExercise: {
      execute: jest.fn().mockResolvedValue(richClosedResult()),
    },
    getRichClosedExerciseResult: {
      execute: jest.fn().mockResolvedValue(richClosedResult()),
    },
    startRevisionSession: {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    },
    getRevisionSession: {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    },
    completeQuickRevisionSession: {
      execute: jest.fn().mockResolvedValue(revisionSessionResultResponse()),
    },
    getRevisionSessionResult: {
      execute: jest.fn().mockResolvedValue(revisionSessionResultResponse()),
    },
    requestNextAction: {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    },
  };
}

function courseWithStats(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    studentId: currentStudent.id,
    subjectId: 'subject-1',
    title: 'Droit constitutionnel',
    description: 'Institutions',
    chapterLabel: 'Chapitre 1',
    estimatedMinutes: 30,
    displayOrder: 0,
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
    sourceCount: 0,
    readySourceCount: 0,
    processingSourceCount: 0,
    failedSourceCount: 0,
    ...overrides,
  };
}

function courseDetail() {
  return {
    course: courseWithStats({
      sourceCount: 1,
      readySourceCount: 1,
    }),
    subject: {
      id: 'subject-1',
      name: 'Droit constitutionnel',
    },
    sources: [
      {
        id: 'document-1',
        courseId: 'course-1',
        documentId: 'document-1',
        fileName: 'cours.pdf',
        kind: 'COURSE_PDF',
        status: 'READY',
        errorCode: null,
        createdAt: new Date('2026-06-18T10:00:00.000Z'),
        updatedAt: new Date('2026-06-18T10:00:00.000Z'),
      },
    ],
  };
}

function courseProgress(overrides: Record<string, unknown> = {}) {
  return {
    courseId: 'course-1',
    subjectId: 'subject-1',
    knowledgeUnitCount: 12,
    practicedKnowledgeUnitCount: 3,
    coverage: 0.25,
    mastery: 0.72,
    estimatedGlobalMastery: 0.18,
    readySourceCount: 1,
    processingSourceCount: 0,
    failedSourceCount: 0,
    lastPracticedAt: new Date('2026-06-18T12:00:00.000Z'),
    state: 'PRACTICED',
    ...overrides,
  };
}

function subjectProgress() {
  return {
    subjectId: 'subject-1',
    knowledgeUnitCount: 12,
    practicedKnowledgeUnitCount: 3,
    coverage: 0.25,
    mastery: 0.72,
    estimatedGlobalMastery: 0.18,
    courseCount: 1,
    readyCourseCount: 1,
    lastPracticedAt: new Date('2026-06-18T12:00:00.000Z'),
    courses: [
      {
        courseId: 'course-1',
        title: 'Droit constitutionnel',
        knowledgeUnitCount: 12,
        practicedKnowledgeUnitCount: 3,
        coverage: 0.25,
        mastery: 0.72,
        estimatedGlobalMastery: 0.18,
        state: 'PRACTICED',
      },
    ],
  };
}

function courseDocument() {
  return {
    id: 'document-1',
    courseId: 'course-1',
    documentId: 'document-1',
    fileName: 'cours.pdf',
    kind: 'COURSE_PDF',
    status: 'UPLOADED',
    errorCode: null,
    createdAt: new Date('2026-06-18T12:00:00.000Z'),
    updatedAt: new Date('2026-06-18T12:00:00.000Z'),
  };
}

function publicDocument() {
  return {
    id: 'document-1',
    subjectId: 'subject-1',
    kind: 'COURSE_PDF',
    fileName: 'demo-droit-constitutionnel.pdf',
    mimeType: 'application/pdf',
    status: 'READY',
    errorCode: null,
  };
}

function documentKnowledgeUnits() {
  return {
    documentId: 'document-1',
    items: [
      {
        id: 'unit-1',
        subjectId: 'subject-1',
        documentId: 'document-1',
        title: 'Séparation des pouvoirs',
        summary: 'La séparation des pouvoirs organise les institutions.',
        difficulty: 'MEDIUM',
        displayOrder: 0,
        sources: [
          {
            chunkId: 'chunk-1',
            pageNumber: 1,
            index: 0,
          },
        ],
      },
    ],
  };
}

function documentSummary() {
  return {
    id: 'summary-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY',
    title: 'Synthèse de démonstration',
    content: 'La Ve République articule stabilité exécutive et contrôle.',
    keyPoints: ['Séparation des pouvoirs', 'Contrôle constitutionnel'],
    limits: 'Synthèse courte issue des fixtures de démonstration.',
    errorCode: null,
    metadata: {
      provider: 'demo-seed',
      promptVersion: 'demo-seed-v1',
    },
    storagePath: 'internal/demo.pdf',
    sources: [
      {
        chunkId: 'chunk-1',
        text: 'Extrait borné.',
        pageNumber: 1,
        index: 0,
        relevanceScore: 0.9,
      },
    ],
  };
}

function revisionSheet() {
  return {
    id: 'sheet-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY',
    title: 'Fiche de démonstration',
    introduction: 'Fiche courte de droit constitutionnel.',
    keyPoints: ['Pouvoir exécutif', 'Parlement'],
    commonMistakes: ['Confondre régime parlementaire et présidentiel.'],
    mustKnow: ['Responsabilité politique du gouvernement.'],
    practiceSuggestions: ['Comparer deux institutions.'],
    errorCode: null,
    metadata: {
      provider: 'demo-seed',
      promptVersion: 'demo-seed-v1',
    },
    sections: [
      {
        id: 'section-1',
        displayOrder: 0,
        title: 'Institutions',
        content: 'Le régime organise les rapports entre les pouvoirs.',
        sources: [
          {
            chunkId: 'chunk-2',
            text: 'Extrait de fiche borné.',
            pageNumber: 2,
            index: 1,
            relevanceScore: 0.8,
          },
        ],
      },
    ],
  };
}

function todayPlan() {
  return {
    generatedAt: new Date('2026-06-15T12:00:00.000Z'),
    items: [
      {
        id: 'today-1',
        subjectId: 'subject-1',
        subjectName: 'Droit constitutionnel',
        knowledgeUnitId: 'unit-1',
        knowledgeUnitTitle: 'Séparation des pouvoirs',
        masteryScore: 0.2,
        action: 'diagnostic_quiz',
        estimatedMinutes: 12,
        priority: 170,
        reasonCode: 'LOW_MASTERY',
        reason: 'À revoir en priorité.',
        startPayload: {
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          preferredAction: 'diagnostic_quiz',
        },
      },
      {
        id: 'today-2',
        subjectId: 'subject-1',
        subjectName: 'Droit constitutionnel',
        knowledgeUnitId: 'unit-2',
        knowledgeUnitTitle: 'Contrôle de constitutionnalité',
        masteryScore: null,
        action: 'open_question',
        estimatedMinutes: 18,
        priority: 140,
        reasonCode: 'MIX_ACTIVITY_TYPE',
        reason: 'Change de format pour renforcer la mémorisation.',
        startPayload: {
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-2',
          preferredAction: 'open_question',
        },
      },
      {
        id: 'today-3',
        subjectId: 'subject-1',
        subjectName: 'Droit constitutionnel',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        knowledgeUnitTitle: 'Séparation des pouvoirs',
        masteryScore: 0.2,
        action: 'rich_closed_exercise',
        estimatedMinutes: 8,
        priority: 130,
        reasonCode: 'RICH_CLOSED_PRACTICE',
        reason: 'Questions riches recommandées pour consolider la notion.',
        startPayload: {
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
        },
      },
      {
        id: 'today-4',
        subjectId: 'subject-1',
        subjectName: 'Droit constitutionnel',
        knowledgeUnitId: 'unit-1',
        knowledgeUnitTitle: 'Séparation des pouvoirs',
        masteryScore: 0.2,
        action: 'revision_session',
        estimatedMinutes: 25,
        priority: 120,
        reasonCode: 'START_REVISION_SESSION',
        reason: 'Lance une session guidée.',
        startPayload: {
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
        },
      },
    ],
  };
}

function diagnosticQuizActivity() {
  return {
    sessionId: 'quiz-session-1',
    type: 'diagnostic_quiz',
    title: 'QCM de démonstration',
    questions: [
      {
        id: 'question-1',
        prompt: 'Quel principe organise les pouvoirs ?',
        difficulty: 'MEDIUM',
        selectionMode: 'single',
        choices: [
          { id: 'choice-1', label: 'La séparation des pouvoirs' },
          { id: 'choice-2', label: 'La confusion des pouvoirs' },
        ],
        sources: [{ chunkId: 'chunk-1', pageNumber: 1, index: 0 }],
      },
    ],
  };
}

function qcmSubmissionResult() {
  return {
    correctAnswers: 2,
    totalQuestions: 2,
    score: 1,
    knowledgeUnitId: 'unit-1',
    items: [
      {
        questionId: 'question-1',
        selectedChoiceId: 'choice-1',
        correctChoiceId: 'choice-1',
        isCorrect: true,
      },
    ],
  };
}

function openQuestionActivity() {
  return {
    sessionId: 'open-session-1',
    type: 'open_question',
    version: 1,
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    question: {
      id: 'open-question-1',
      prompt: 'Explique la séparation des pouvoirs.',
      instructions: 'Structure ta réponse en deux paragraphes.',
      maxAnswerLength: 2500,
      sources: [{ chunkId: 'chunk-1', pageNumber: 1, index: 0 }],
    },
  };
}

function openAnswerSubmissionResult() {
  return {
    sessionId: 'open-session-1',
    type: 'open_question',
    status: 'submitted',
    evaluation: {
      id: 'evaluation-1',
      status: 'READY',
      score: 16,
      maxScore: 20,
      feedback: 'Réponse structurée.',
      presentPoints: ['Séparation institutionnelle'],
      missingPoints: ['Responsabilité politique'],
      errors: [],
      modelAnswer: 'La séparation des pouvoirs distingue les fonctions.',
      advice: 'Revois le régime parlementaire.',
      sources: [
        {
          chunkId: 'chunk-1',
          text: 'Extrait post-submit borné.',
          pageNumber: 1,
          index: 0,
        },
      ],
    },
  };
}

function richClosedPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-1',
    exercise: richClosedExerciseFixture(),
  });
}

function richClosedV1BPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1b',
    exercise: richClosedV1BExerciseFixture(),
  });
}

function richClosedV1BFullPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1b-full',
    exercise: richClosedV1BFullExerciseFixture(),
  });
}

function richClosedV1CPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1c',
    exercise: richClosedV1CExerciseFixture(),
  });
}

function richClosedV1CFullPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1c-full',
    exercise: richClosedV1CFullExerciseFixture(),
  });
}

function richClosedV1CCalculationPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1c-calculation',
    exercise: richClosedV1CCalculationExerciseFixture(),
  });
}

function richClosedV1DImageChoicePublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1d-image-choice',
    exercise: richClosedV1DImageChoiceExerciseFixture(),
  });
}

function richClosedResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-1',
    exercise: richClosedExerciseFixture(),
    answers: richClosedAnswers(),
  });
}

function richClosedV1BResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1b',
    exercise: richClosedV1BExerciseFixture(),
    answers: richClosedV1BAnswers(),
  });
}

function richClosedV1BFullResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1b-full',
    exercise: richClosedV1BFullExerciseFixture(),
    answers: richClosedV1BFullAnswers(),
  });
}

function richClosedV1CResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1c',
    exercise: richClosedV1CExerciseFixture(),
    answers: richClosedV1CAnswers(),
  });
}

function richClosedV1CFullResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1c-full',
    exercise: richClosedV1CFullExerciseFixture(),
    answers: richClosedV1CFullAnswers(),
  });
}

function richClosedV1CCalculationResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1c-calculation',
    exercise: richClosedV1CCalculationExerciseFixture(),
    answers: richClosedV1CCalculationAnswers(),
  });
}

function richClosedV1DImageChoiceResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1d-image-choice',
    exercise: richClosedV1DImageChoiceExerciseFixture(),
    answers: richClosedV1DImageChoiceAnswers(),
  });
}

function richClosedAnswers(): RichClosedAnswer[] {
  return [
    {
      questionId: 'single-1',
      questionKind: 'single_choice',
      choiceId: 'choice-a',
    },
    {
      questionId: 'multiple-1',
      questionKind: 'multiple_choice',
      choiceIds: ['choice-a', 'choice-b'],
    },
    {
      questionId: 'matching-1',
      questionKind: 'matching',
      pairs: [
        { leftId: 'left-1', rightId: 'right-1' },
        { leftId: 'left-2', rightId: 'right-2' },
        { leftId: 'left-3', rightId: 'right-3' },
      ],
    },
    {
      questionId: 'ordering-1',
      questionKind: 'ordering',
      orderedIds: ['item-1', 'item-2', 'item-3'],
    },
    {
      questionId: 'case-1',
      questionKind: 'case_qualification',
      choiceId: 'choice-a',
    },
    {
      questionId: 'error-1',
      questionKind: 'error_detection',
      errorId: 'error-a',
    },
  ];
}

function richClosedV1BAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedAnswers(),
    {
      questionId: 'timeline-1',
      questionKind: 'timeline',
      orderedEventIds: ['event-1', 'event-2', 'event-3'],
    },
    {
      questionId: 'date-slider-1',
      questionKind: 'date_slider',
      year: 1958,
    },
  ];
}

function richClosedV1BFullAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedV1BAnswers(),
    {
      questionId: 'true-false-grid-1',
      questionKind: 'true_false_grid',
      values: [
        { rowId: 'row-1', value: true },
        { rowId: 'row-2', value: false },
        { rowId: 'row-3', value: true },
      ],
    },
    {
      questionId: 'cause-consequence-1',
      questionKind: 'cause_consequence',
      pairs: [
        { causeId: 'cause-1', consequenceId: 'consequence-1' },
        { causeId: 'cause-2', consequenceId: 'consequence-2' },
        { causeId: 'cause-3', consequenceId: 'consequence-3' },
      ],
    },
  ];
}

function richClosedV1CAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedV1BFullAnswers(),
    {
      questionId: 'institution-matrix-1',
      questionKind: 'institution_matrix',
      values: [
        {
          cellId: 'cell-president-legitimacy',
          optionId: 'option-legitimacy-election',
        },
        {
          cellId: 'cell-government-responsibility',
          optionId: 'option-responsibility-assembly',
        },
        {
          cellId: 'cell-assembly-action',
          optionId: 'option-action-censure',
        },
      ],
    },
  ];
}

function richClosedV1CFullAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedV1CAnswers(),
    {
      questionId: 'diagram-labeling-1',
      questionKind: 'diagram_labeling',
      values: [
        {
          slotId: 'slot-government-role',
          optionId: 'option-government',
        },
        {
          slotId: 'slot-censure',
          optionId: 'option-motion-censure',
        },
        {
          slotId: 'slot-nomination',
          optionId: 'option-nomination',
        },
      ],
    },
  ];
}

function richClosedV1CCalculationAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedV1CFullAnswers(),
    {
      questionId: 'calculation-mcq-majority-1',
      questionKind: 'calculation_mcq',
      choiceId: 'choice-289',
    },
  ];
}

function richClosedV1DImageChoiceAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedV1CCalculationAnswers(),
    {
      questionId: 'image-choice-1',
      questionKind: 'image_choice',
      choiceId: 'choice-image-a',
    },
  ];
}

function replaceRichClosedAnswer(answer: RichClosedAnswer): RichClosedAnswer[] {
  return richClosedAnswers().map((currentAnswer) =>
    currentAnswer.questionId === answer.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1BAnswer(
  answer: RichClosedAnswer,
): RichClosedAnswer[] {
  return richClosedV1BAnswers().map((currentAnswer) =>
    currentAnswer.questionId === answer.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1BFullAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return richClosedV1BFullAnswers().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1CAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return richClosedV1CAnswers().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1CFullAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return richClosedV1CFullAnswers().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1CCalculationAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return richClosedV1CCalculationAnswers().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1DImageChoiceAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return richClosedV1DImageChoiceAnswers().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function revisionSessionResponse() {
  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      courseId: null,
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      mode: 'QUICK',
      createdAt: new Date('2026-06-15T12:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-1',
      kind: 'OPEN_QUESTION',
      status: 'READY',
      displayOrder: 0,
      activitySessionId: 'open-session-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      payload: openQuestionActivity(),
    },
    history: [
      {
        id: 'action-1',
        kind: 'OPEN_QUESTION',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: 'open-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    ],
  };
}

function courseQuickRevisionSessionResponse() {
  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      mode: 'QUICK',
      createdAt: new Date('2026-06-15T12:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-1',
      kind: 'DIAGNOSTIC_QUIZ',
      status: 'READY',
      displayOrder: 0,
      activitySessionId: 'quiz-session-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      payload: diagnosticQuizActivity(),
    },
    history: [
      {
        id: 'action-1',
        kind: 'DIAGNOSTIC_QUIZ',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: 'quiz-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    ],
  };
}

function revisionSessionResultResponse() {
  return {
    session: {
      id: 'revision-session-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      mode: 'QUICK',
      status: 'COMPLETED',
      createdAt: new Date('2026-06-15T12:00:00.000Z'),
      completedAt: new Date('2026-06-15T12:05:00.000Z'),
    },
    summary: {
      correctAnswers: 1,
      totalQuestions: 2,
      score: 0.5,
      durationSeconds: 300,
    },
    knowledgeUnits: [
      {
        knowledgeUnitId: 'unit-1',
        title: 'Séparation des pouvoirs',
        correctAnswers: 1,
        totalQuestions: 2,
        score: 0.5,
        state: 'TO_REVIEW',
      },
    ],
  };
}

function richClosedRevisionSessionResponse() {
  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      courseId: null,
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      mode: 'QUICK',
      createdAt: new Date('2026-06-15T12:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-rich-1',
      kind: 'RICH_CLOSED_EXERCISE',
      status: 'READY',
      displayOrder: 0,
      activitySessionId: null,
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      payload: {
        type: 'rich_closed_exercise',
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        reason: 'Questions riches recommandées.',
        estimatedMinutes: 8,
        preferredAction: 'rich_closed_exercise',
      },
    },
    history: [
      {
        id: 'action-rich-1',
        kind: 'RICH_CLOSED_EXERCISE',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: null,
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    ],
  };
}

function assertNoSensitivePreSubmitFields(payload: unknown): void {
  expect(collectSensitivePreSubmitFields(payload)).toEqual([]);
}

const forbiddenPreSubmitFields = new Set([
  'correction',
  'correctionPayload',
  'explanation',
  'feedback',
  'choiceFeedback',
  'modelAnswer',
  'answerText',
  'freeTextAnswer',
  'textAnswer',
  'score',
  'partialScore',
  'expectedValue',
  'workedSteps',
  'answersPayload',
  'semanticLabel',
  'answerHint',
  'storagePath',
  'promptVersion',
  'completion',
  'html',
  'svg',
  'rawSvg',
  'mermaid',
  'markdown',
  'widget',
  'component',
  'renderPayload',
  'style',
  'css',
  'script',
  'formula',
  'expression',
  'rawFormula',
  'calculationCode',
  'javascript',
  'python',
  'imageUrl',
  'assetUrl',
  'url',
  'remoteUrl',
  'src',
  'href',
  'bucketPath',
  'cdnUrl',
  'base64',
  'dataUri',
  'blob',
  'rawImage',
  'assetPath',
  'canvas',
  'code',
  'markup',
]);

function collectSensitivePreSubmitFields(
  value: unknown,
  path: string[] = [],
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectSensitivePreSubmitFields(item, [...path, String(index)]),
    );
  }

  if (typeof value !== 'object' || value === null) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const nextPath = [...path, key];
    const currentViolation =
      key.startsWith('correct') || forbiddenPreSubmitFields.has(key)
        ? [nextPath.join('.')]
        : [];

    return [
      ...currentViolation,
      ...collectSensitivePreSubmitFields(nestedValue, nextPath),
    ];
  });
}

```
