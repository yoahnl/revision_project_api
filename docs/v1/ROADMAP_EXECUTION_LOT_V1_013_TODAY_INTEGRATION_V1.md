# LOT V1-013 — Today integration V1

## 1. Résultat

V1-013 est réalisé côté backend API pour la partie Today contract et recommandation. Today peut maintenant produire une action `rich_closed_exercise` déterministe, contenant `subjectId`, `knowledgeUnitId`, `knowledgeUnitTitle`, `estimatedMinutes`, `priority`, `reason`, `masteryScore` si disponible et `documentId` quand la notion en porte un.

Today ne démarre pas l'exercice rich closed, n'appelle pas Genkit et ne renvoie ni questions ni correction. Le démarrage reste délégué à la page rich closed côté app.

## 2. Sources inspectées

- `src/modules/revision/**`
- `src/modules/activities/application/rich-closed-questions/**`
- `src/modules/activities/interfaces/activities.controller.ts`
- `src/modules/activities/application/start-open-question-activity.use-case.spec.ts`
- `prisma/schema.prisma` pour vérifier que `KnowledgeUnit.documentId` existe déjà
- tests Today/revision/activities existants
- `docs/v1/ROADMAP_EXECUTION_PLAN_V1.md`

## 3. Préflight Git

- repo : `/Users/karim/Project/app-révision/api`
- branche : `main`
- status initial : propre, `git status --short --untracked-files=all` vide
- derniers commits :
  - `fcac895 Fix rich closed generation diagnostics`
  - `48874e7 RAPPORT-123: Mise à jour du générateur GenKit et ajout de la documentation`
  - `88dcecd RAPPORT-123: Corrections et améliorations des cas d'usage et scoreur pour les questions fermées riches`
  - `630cea5 RAPPORT-123: Intégration complète des questions fermées riches avec cas d'usage et persistance`
  - `0eafeb2 RAPPORT-123: Ajout des générateurs de questions fermées riches et profils associés`
- repo frontend : modifié dans son propre rapport V1-013 séparé
- aucun commit créé

## 4. Périmètre réalisé

Backend API :

- ajout de `rich_closed_exercise` au type d'action Today ;
- ajout de `RICH_CLOSED_PRACTICE` comme raison pédagogique ;
- propagation de `documentId` depuis `KnowledgeUnit` quand disponible ;
- sélection déterministe d'une action rich closed parmi les actions Today ;
- tests Today/revision/activities renforcés.

Frontend app : réalisé dans le rapport app séparé.

## 5. Contrat Today

L'action suit le naming existant `action`.

Champs exposés :

- `action: 'rich_closed_exercise'` ;
- `subjectId` ;
- `subjectName` ;
- `documentId` : `string | null` au niveau item ;
- `knowledgeUnitId` ;
- `knowledgeUnitTitle` ;
- `masteryScore` si disponible ;
- `estimatedMinutes` ;
- `priority` ;
- `reasonCode: 'RICH_CLOSED_PRACTICE'` ;
- `reason` ;
- `startPayload` borné à `subjectId`, `knowledgeUnitId` et `documentId` seulement si disponible.

Compatibilité : les actions `diagnostic_quiz`, `open_question` et `revision_session` restent produites. Aucun payload rich closed pré-submit n'est ajouté à Today.

## 6. Algorithme de recommandation

La sélection reste déterministe. `AdaptivePlanService` classe les notions par priorité matière, faiblesse de maîtrise et ancienneté de pratique. Pour chaque notion éligible, il crée des candidats bornés : QCM, questions riches, question ouverte et session de révision. La sélection conserve au plus quatre actions et force la présence des formats principaux quand une notion éligible existe.

`rich_closed_exercise` reçoit une durée estimée de 8 minutes et la raison `RICH_CLOSED_PRACTICE`. Aucun ranking IA, provider IA ou appel Genkit n'intervient dans Today.

## 7. Flow utilisateur

Côté backend, Today recommande seulement l'action. Le frontend lit `startPayload`, affiche la carte et navigue ensuite vers `/activities/rich-closed`. Le démarrage effectif de l'exercice reste dans le flow rich closed existant.

## 8. Anti-fuite / sécurité

- pas de correction pré-submit dans Today ;
- pas de questions dans Today ;
- pas de payload arbitraire rich closed ;
- isolation `studentId` conservée via `findByStudent`, `findKnowledgeUnits(studentId)`, `findMasteryStates(studentId)` et filtrage domaine ;
- `KnowledgeUnit.documentId` est transporté sans migration ni accès cross-student ;
- aucun provider IA n'est appelé depuis Today.

## 9. Fichiers créés/modifiés/supprimés

Fichiers modifiés :

- `src/modules/activities/application/start-open-question-activity.use-case.spec.ts`
- `src/modules/revision/application/get-today-plan.use-case.spec.ts`
- `src/modules/revision/application/get-today-plan.use-case.ts`
- `src/modules/revision/domain/adaptive-plan.service.spec.ts`
- `src/modules/revision/domain/adaptive-plan.service.ts`
- `src/modules/revision/domain/knowledge-unit.entity.ts`
- `src/modules/revision/infrastructure/prisma-revision.repository.spec.ts`
- `src/modules/revision/infrastructure/prisma-revision.repository.ts`
- `src/modules/revision/interfaces/today.controller.spec.ts`
- `docs/v1/ROADMAP_EXECUTION_PLAN_V1.md`
- `docs/v1/ROADMAP_EXECUTION_LOT_V1_013_TODAY_INTEGRATION_V1.md` créé

Fichiers supprimés : aucun.

## 10. Tests ajoutés ou renforcés

- tests `AdaptivePlanService` pour `rich_closed_exercise`, payload borné, document absent et compatibilité des actions ;
- tests `GetTodayPlanUseCase` pour DTO enrichi, raison, `documentId`, absence de questions/correction ;
- test `PrismaRevisionRepository` pour mapping `documentId` et requête isolée par `studentId` ;
- ajustement du test open question pour le nouveau champ `documentId: null` de `KnowledgeUnit`.

## 11. Validations lancées avec résultats

- `npx prettier --write ...` sur les fichiers TypeScript modifiés : passé.
- `npm test -- today --runInBand` : passé, 2 suites, 5 tests.
- `npm test -- revision --runInBand` : passé, 15 suites, 77 tests.
- `npm test -- activities --runInBand` : premier passage échoué sur une attente de test trop stricte liée à `documentId: null`, corrigé ; relance passée, 17 suites passées, 1 suite skipped, 190 tests passés, 1 skipped.
- `npm run lint:check` : passé.
- `npm run build` : passé.
- `git diff --check` : passé.

## 12. Validations non lancées avec justification

- migrations Prisma : non lancées, aucune migration ni modification de schéma.
- provider IA réel / Genkit réel : non lancé, Today ne doit pas appeler d'IA.
- actions Dokploy : non lancées, hors périmètre.

## 13. Risques restants

- Today ne vérifie pas explicitement la présence de chunks source avant recommandation ; le flow rich closed existant reste responsable de refuser une notion sans contexte exploitable.
- La durée 8 minutes est déterministe mais pourra être ajustée après usage réel.

## 14. Recommandation prochain lot

`V1-014 — Revision session integration V1`.

Pas besoin d'un mini-bis Today côté API sauf si l'on veut filtrer strictement les notions rich closed par présence de sources avant affichage.

## 15. Passes de review

- backend contract : OK, `action` unique et champs bornés ;
- backend selection : OK, déterministe et sans IA ;
- frontend parser : traité dans le rapport app ;
- frontend UI : traité dans le rapport app ;
- navigation : traité dans le rapport app ;
- anti-fuite : OK, pas de questions/correction ;
- tests : OK, suites demandées passées.

## 16. Critique honnête du prompt initial

Le prompt est cohérent. Le seul point coûteux est l'exigence de recopier le contenu complet de tous les fichiers touchés dans les rapports : utile pour audit, mais volumineux et redondant avec Git. Sur le fond technique, `documentId` était déjà en Prisma mais absent de l'entité Revision ; le lot pouvait donc le transporter sans migration.

## 17. Contenu complet des fichiers créés/modifiés/supprimés

### Fichier modifié : `src/modules/activities/application/start-open-question-activity.use-case.spec.ts`

~~~ts
import type { RevisionRepository } from '../../revision/application/revision.repository';
import { KnowledgeUnit } from '../../revision/domain/knowledge-unit.entity';
import type { ActivitiesRepository } from './activities.repository';
import type { OpenQuestionGenerator } from './open-question-generator';
import { StartOpenQuestionActivityUseCase } from './start-open-question-activity.use-case';

describe('StartOpenQuestionActivityUseCase', () => {
  it('creates an open question activity for an owned knowledge unit', async () => {
    const activitiesRepository = createActivitiesRepository();
    const revisionRepository = createRevisionRepository();
    const openQuestionGenerator = createOpenQuestionGenerator();
    const knowledgeUnit = new KnowledgeUnit({
      id: 'unit-1',
      subjectId: 'subject-1',
      title: 'Séparation des pouvoirs',
      summary:
        'La séparation des pouvoirs distingue les fonctions législative, exécutive et juridictionnelle.',
    });
    revisionRepository.findKnowledgeUnits.mockResolvedValue([knowledgeUnit]);
    activitiesRepository.findOpenQuestionGenerationContext.mockResolvedValue({
      documentId: 'document-1',
      knowledgeUnit: Object.assign(knowledgeUnit, {
        difficulty: 'MEDIUM' as const,
        sourceChunkIds: ['chunk-1'],
      }),
      chunks: [
        {
          id: 'chunk-1',
          index: 0,
          text: 'La séparation des pouvoirs organise les fonctions de l’État.',
          pageNumber: null,
        },
      ],
    });
    openQuestionGenerator.generate.mockResolvedValue({
      version: 1,
      prompt:
        'Explique pourquoi la séparation des pouvoirs protège contre la concentration du pouvoir.',
      instructions:
        'Réponds en quelques phrases structurées, en t’appuyant uniquement sur le cours.',
      maxAnswerLength: 2500,
      sourceChunkIds: ['chunk-1'],
      metadata: {
        flowName: 'openQuestionGeneration',
        provider: 'google-genai',
        model: 'googleai/gemini-2.5-flash',
        promptVersion: 'open-question-generation-v1',
        schemaVersion: 'open-question-generation-v1',
        inputSize: 1200,
      },
    });
    activitiesRepository.createOpenQuestionActivity.mockResolvedValue(
      openQuestionActivity(),
    );

    const activity = await new StartOpenQuestionActivityUseCase(
      activitiesRepository,
      revisionRepository,
      openQuestionGenerator,
    ).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
    });

    expect(activity).toEqual(openQuestionActivity());
    expect(
      activitiesRepository.findOpenQuestionGenerationContext.mock.calls,
    ).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
        },
      ],
    ]);
    expect(openQuestionGenerator.generate.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnit: {
            id: 'unit-1',
            subjectId: 'subject-1',
            documentId: null,
            title: 'Séparation des pouvoirs',
            summary:
              'La séparation des pouvoirs distingue les fonctions législative, exécutive et juridictionnelle.',
            difficulty: 'MEDIUM',
            sourceChunkIds: ['chunk-1'],
          },
          chunks: [
            {
              id: 'chunk-1',
              index: 0,
              text: 'La séparation des pouvoirs organise les fonctions de l’État.',
              pageNumber: null,
            },
          ],
        },
      ],
    ]);
    expect(activitiesRepository.createOpenQuestionActivity.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          documentId: 'document-1',
          question: {
            prompt:
              'Explique pourquoi la séparation des pouvoirs protège contre la concentration du pouvoir.',
            instructions:
              'Réponds en quelques phrases structurées, en t’appuyant uniquement sur le cours.',
            maxAnswerLength: 2500,
            sourceChunkIds: ['chunk-1'],
            version: 1,
            metadata: {
              flowName: 'openQuestionGeneration',
              provider: 'google-genai',
              model: 'googleai/gemini-2.5-flash',
              promptVersion: 'open-question-generation-v1',
              schemaVersion: 'open-question-generation-v1',
              inputSize: 1200,
            },
          },
        },
      ],
    ]);
  });

  it('rejects a knowledge unit outside the student subject', async () => {
    const activitiesRepository = createActivitiesRepository();
    const revisionRepository = createRevisionRepository();
    revisionRepository.findKnowledgeUnits.mockResolvedValue([
      new KnowledgeUnit({
        id: 'unit-1',
        subjectId: 'subject-2',
        title: 'Séparation des pouvoirs',
        summary: 'Résumé.',
      }),
    ]);

    await expect(
      new StartOpenQuestionActivityUseCase(
        activitiesRepository,
        revisionRepository,
        createOpenQuestionGenerator(),
      ).execute({
        studentId: 'student-1',
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
      }),
    ).rejects.toThrow('Knowledge unit does not belong to student subject');

    expect(
      activitiesRepository.createOpenQuestionActivity.mock.calls,
    ).toHaveLength(0);
  });
});

function createActivitiesRepository(): jest.Mocked<ActivitiesRepository> {
  return {
    findDiagnosticQuizGenerationContext: jest.fn(),
    createDiagnosticQuiz: jest.fn(),
    submitResult: jest.fn(),
    findOpenQuestionGenerationContext: jest.fn(),
    createOpenQuestionActivity: jest.fn(),
    findOpenAnswerEvaluationContext: jest.fn(),
    saveOpenAnswerEvaluation: jest.fn(),
  };
}

function createOpenQuestionGenerator(): jest.Mocked<OpenQuestionGenerator> {
  return {
    generate: jest.fn(),
  };
}

function createRevisionRepository(): jest.Mocked<RevisionRepository> {
  return {
    getActiveGoal: jest.fn(),
    saveGoal: jest.fn(),
    findKnowledgeUnits: jest.fn(),
    findMasteryStates: jest.fn(),
    upsertMastery: jest.fn(),
  };
}

function openQuestionActivity() {
  return {
    sessionId: 'session-1',
    type: 'open_question',
    version: 1,
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    question: {
      id: 'open-question-1',
      prompt:
        'Explique avec tes propres mots la notion suivante : Séparation des pouvoirs.',
      instructions:
        'Réponds en quelques phrases structurées, en t’appuyant uniquement sur le cours.',
      maxAnswerLength: 4000,
      sources: [{ chunkId: 'chunk-1', pageNumber: null, index: 0 }],
    },
  };
}

~~~

### Fichier modifié : `src/modules/revision/application/get-today-plan.use-case.spec.ts`

~~~ts
import type { SubjectsRepository } from '../../subjects/application/subjects.repository';
import { Subject } from '../../subjects/domain/subject.entity';
import {
  AdaptivePlanService,
  type RevisionPlan,
} from '../domain/adaptive-plan.service';
import { KnowledgeUnit } from '../domain/knowledge-unit.entity';
import { MasteryState } from '../domain/mastery-state.entity';
import { RevisionGoal } from '../domain/revision-goal.entity';
import { GetTodayPlanUseCase } from './get-today-plan.use-case';
import type { RevisionRepository } from './revision.repository';

describe('GetTodayPlanUseCase', () => {
  const now = new Date('2026-06-15T10:00:00.000Z');

  it('returns an empty plan when no active goal exists', async () => {
    const revisionRepository = createRevisionRepository();
    const subjectsRepository = createSubjectsRepository();
    revisionRepository.getActiveGoal.mockResolvedValue(null);

    const plan = await new GetTodayPlanUseCase(
      new AdaptivePlanService(),
      revisionRepository,
      subjectsRepository,
    ).execute({ studentId: 'student-1', now });

    expect(plan).toEqual({ generatedAt: now, items: [] });
    expect(subjectsRepository.findByStudent.mock.calls).toHaveLength(0);
    expect(revisionRepository.findKnowledgeUnits.mock.calls).toHaveLength(0);
    expect(revisionRepository.findMasteryStates.mock.calls).toHaveLength(0);
  });

  it('returns enriched multi-action DTO items', async () => {
    const revisionRepository = createRevisionRepository();
    const subjectsRepository = createSubjectsRepository();
    revisionRepository.getActiveGoal.mockResolvedValue(goal());
    subjectsRepository.findByStudent.mockResolvedValue([
      subject({ id: 'subject-1', name: 'Droit constitutionnel', priority: 5 }),
    ]);
    revisionRepository.findKnowledgeUnits.mockResolvedValue([
      unit({
        id: 'unit-1',
        subjectId: 'subject-1',
        documentId: 'document-1',
        title: 'Séparation',
      }),
      unit({ id: 'unit-2', subjectId: 'subject-1', title: 'Régimes' }),
    ]);
    revisionRepository.findMasteryStates.mockResolvedValue([
      mastery({ knowledgeUnitId: 'unit-1', score: 0.2 }),
      mastery({ knowledgeUnitId: 'unit-2', score: 0.6 }),
    ]);

    const plan = await new GetTodayPlanUseCase(
      new AdaptivePlanService(),
      revisionRepository,
      subjectsRepository,
    ).execute({ studentId: 'student-1', now });

    expect(plan.items).toHaveLength(4);
    expect(plan.items[0]).toEqual(
      expect.objectContaining({
        id: 'subject-1:unit-1:diagnostic_quiz',
        subjectId: 'subject-1',
        subjectName: 'Droit constitutionnel',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        knowledgeUnitTitle: 'Séparation',
        masteryScore: 0.2,
        action: 'diagnostic_quiz',
        estimatedMinutes: 12,
        reasonCode: 'LOW_MASTERY',
        reason: 'À revoir en priorité : cette notion est encore fragile.',
        startPayload: {
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          preferredAction: 'diagnostic_quiz',
        },
      }),
    );
    expect(plan.items.map((item) => item.action)).toEqual(
      expect.arrayContaining([
        'diagnostic_quiz',
        'open_question',
        'rich_closed_exercise',
        'revision_session',
      ]),
    );
    const richClosedItem = plan.items.find(
      (item) => item.action === 'rich_closed_exercise',
    );
    expect(richClosedItem).toEqual(
      expect.objectContaining({
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        knowledgeUnitTitle: 'Séparation',
        estimatedMinutes: 8,
        reasonCode: 'RICH_CLOSED_PRACTICE',
        reason: 'Questions riches recommandées pour consolider la notion.',
        startPayload: {
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
        },
      }),
    );
    expect(richClosedItem).not.toHaveProperty('questions');
    expect(richClosedItem).not.toHaveProperty('correction');
  });

  it('uses null mastery score when no mastery state exists', async () => {
    const revisionRepository = createRevisionRepository();
    const subjectsRepository = createSubjectsRepository();
    revisionRepository.getActiveGoal.mockResolvedValue(goal());
    subjectsRepository.findByStudent.mockResolvedValue([subject()]);
    revisionRepository.findKnowledgeUnits.mockResolvedValue([unit()]);
    revisionRepository.findMasteryStates.mockResolvedValue([]);

    const plan = await new GetTodayPlanUseCase(
      new AdaptivePlanService(),
      revisionRepository,
      subjectsRepository,
    ).execute({ studentId: 'student-1', now });

    expect(plan.items[0]).toMatchObject({
      masteryScore: null,
      action: 'diagnostic_quiz',
    });
  });

  it('throws a controlled error when the domain plan references missing data', async () => {
    const revisionRepository = createRevisionRepository();
    const subjectsRepository = createSubjectsRepository();
    const adaptivePlanService = {
      buildTodayPlan: jest.fn<
        RevisionPlan,
        Parameters<AdaptivePlanService['buildTodayPlan']>
      >(() => ({
        generatedAt: now,
        items: [
          {
            id: 'subject-missing:unit-1:diagnostic_quiz',
            subjectId: 'subject-missing',
            documentId: null,
            knowledgeUnitId: 'unit-1',
            action: 'diagnostic_quiz',
            estimatedMinutes: 12,
            priority: 100,
            reasonCode: 'LOW_MASTERY',
            startPayload: {
              subjectId: 'subject-missing',
              knowledgeUnitId: 'unit-1',
              preferredAction: 'diagnostic_quiz',
            },
          },
        ],
      })),
    };
    revisionRepository.getActiveGoal.mockResolvedValue(goal());
    subjectsRepository.findByStudent.mockResolvedValue([subject()]);
    revisionRepository.findKnowledgeUnits.mockResolvedValue([unit()]);
    revisionRepository.findMasteryStates.mockResolvedValue([]);

    await expect(
      new GetTodayPlanUseCase(
        adaptivePlanService as unknown as AdaptivePlanService,
        revisionRepository,
        subjectsRepository,
      ).execute({ studentId: 'student-1', now }),
    ).rejects.toThrow('Today plan references missing data');
  });
});

function createRevisionRepository(): jest.Mocked<RevisionRepository> {
  return {
    getActiveGoal: jest.fn(),
    saveGoal: jest.fn(),
    findKnowledgeUnits: jest.fn(),
    findMasteryStates: jest.fn(),
    upsertMastery: jest.fn(),
  };
}

function createSubjectsRepository(): jest.Mocked<SubjectsRepository> {
  return {
    create: jest.fn(),
    findByStudent: jest.fn(),
    findByIdForStudent: jest.fn(),
    deleteForStudent: jest.fn(),
  };
}

function goal(
  input: Partial<ConstructorParameters<typeof RevisionGoal>[0]> = {},
) {
  return new RevisionGoal({
    id: 'goal-1',
    studentId: 'student-1',
    targetDate: new Date('2026-07-01T00:00:00.000Z'),
    weeklyMinutes: 240,
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    ...input,
  });
}

function subject(
  input: Partial<ConstructorParameters<typeof Subject>[0]> = {},
) {
  return new Subject({
    id: 'subject-1',
    studentId: 'student-1',
    name: 'Droit',
    priority: 3,
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    ...input,
  });
}

function unit(
  input: Partial<ConstructorParameters<typeof KnowledgeUnit>[0]> = {},
) {
  return new KnowledgeUnit({
    id: 'unit-1',
    subjectId: 'subject-1',
    title: 'Notion',
    summary: 'Résumé',
    ...input,
  });
}

function mastery(
  input: Partial<ConstructorParameters<typeof MasteryState>[0]> = {},
) {
  return new MasteryState({
    studentId: 'student-1',
    knowledgeUnitId: 'unit-1',
    score: 0.5,
    lastPracticedAt: new Date('2026-06-10T10:00:00.000Z'),
    ...input,
  });
}

~~~

### Fichier modifié : `src/modules/revision/application/get-today-plan.use-case.ts`

~~~ts
import { Inject, Injectable } from '@nestjs/common';
import {
  SUBJECTS_REPOSITORY,
  type SubjectsRepository,
} from '../../subjects/application/subjects.repository';
import {
  AdaptivePlanService,
  type RevisionPlanStartPayload,
  type TodayPlanActionType,
  type TodayPlanReasonCode,
} from '../domain/adaptive-plan.service';
import {
  REVISION_REPOSITORY,
  type RevisionRepository,
} from './revision.repository';

export interface TodayPlanDto {
  generatedAt: Date;
  items: TodayPlanItemDto[];
}

export interface TodayPlanItemDto {
  id: string;
  subjectId: string;
  subjectName: string;
  documentId: string | null;
  knowledgeUnitId: string | null;
  knowledgeUnitTitle: string | null;
  masteryScore: number | null;
  action: TodayPlanActionType;
  estimatedMinutes: number;
  priority: number;
  reasonCode: TodayPlanReasonCode;
  reason: string;
  startPayload: RevisionPlanStartPayload;
}

@Injectable()
export class GetTodayPlanUseCase {
  constructor(
    private readonly adaptivePlanService: AdaptivePlanService,
    @Inject(REVISION_REPOSITORY)
    private readonly revisionRepository: RevisionRepository,
    @Inject(SUBJECTS_REPOSITORY)
    private readonly subjectsRepository: SubjectsRepository,
  ) {}

  async execute(input: {
    studentId: string;
    now?: Date;
  }): Promise<TodayPlanDto> {
    const now = input.now ?? new Date();
    const goal = await this.revisionRepository.getActiveGoal(input.studentId);

    if (!goal) {
      return { generatedAt: now, items: [] };
    }

    const [subjects, knowledgeUnits, masteryStates] = await Promise.all([
      this.subjectsRepository.findByStudent(input.studentId),
      this.revisionRepository.findKnowledgeUnits(input.studentId),
      this.revisionRepository.findMasteryStates(input.studentId),
    ]);
    const subjectById = new Map(
      subjects.map((subject) => [subject.id, subject]),
    );
    const unitById = new Map(knowledgeUnits.map((unit) => [unit.id, unit]));
    const masteryByUnitId = new Map(
      masteryStates.map((mastery) => [mastery.knowledgeUnitId, mastery]),
    );
    const plan = this.adaptivePlanService.buildTodayPlan({
      now,
      goal,
      subjects,
      knowledgeUnits,
      masteryStates,
    });

    return {
      generatedAt: plan.generatedAt,
      items: plan.items.map((item) => {
        const subject = subjectById.get(item.subjectId);
        const unit = unitById.get(item.knowledgeUnitId);

        if (!subject || !unit) {
          throw new Error('Today plan references missing data');
        }

        return {
          id: item.id,
          subjectId: item.subjectId,
          subjectName: subject.name,
          documentId: item.documentId,
          knowledgeUnitId: item.knowledgeUnitId,
          knowledgeUnitTitle: unit.title,
          masteryScore:
            masteryByUnitId.get(item.knowledgeUnitId)?.score ?? null,
          action: item.action,
          estimatedMinutes: item.estimatedMinutes,
          priority: item.priority,
          reasonCode: item.reasonCode,
          reason: toReason(item.reasonCode),
          startPayload: item.startPayload,
        };
      }),
    };
  }
}

function toReason(reasonCode: TodayPlanReasonCode): string {
  const reasons: Record<TodayPlanReasonCode, string> = {
    LOW_MASTERY: 'À revoir en priorité : cette notion est encore fragile.',
    STALE_PRACTICE:
      'À entretenir : cette notion n’a pas été pratiquée récemment.',
    HIGH_PRIORITY_SUBJECT: 'Matière prioritaire dans ton objectif de révision.',
    MIX_ACTIVITY_TYPE: 'Change de format pour renforcer la mémorisation.',
    RICH_CLOSED_PRACTICE:
      'Questions riches recommandées pour consolider la notion.',
    START_REVISION_SESSION:
      'Lance une session guidée pour enchaîner plusieurs exercices.',
    CONTINUE_PROGRESS: 'Continue ta progression sur cette notion.',
  };

  return reasons[reasonCode];
}

~~~

### Fichier modifié : `src/modules/revision/domain/adaptive-plan.service.spec.ts`

~~~ts
import { Subject } from '../../subjects/domain/subject.entity';
import { AdaptivePlanService } from './adaptive-plan.service';
import { KnowledgeUnit } from './knowledge-unit.entity';
import { MasteryState } from './mastery-state.entity';
import { RevisionGoal } from './revision-goal.entity';

describe('AdaptivePlanService', () => {
  const now = new Date('2026-06-15T10:00:00.000Z');

  it('returns an empty plan when no owned knowledge unit is eligible', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [
        subject({ id: 'subject-other', studentId: 'student-2', priority: 5 }),
      ],
      knowledgeUnits: [unit({ id: 'unit-other', subjectId: 'subject-other' })],
      masteryStates: [
        mastery({
          studentId: 'student-2',
          knowledgeUnitId: 'unit-other',
          score: 0.1,
        }),
      ],
    });

    expect(plan.items).toEqual([]);
  });

  it('returns several launchable action types for eligible knowledge units', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [subject({ id: 'subject-1', priority: 5 })],
      knowledgeUnits: [
        unit({ id: 'unit-1', subjectId: 'subject-1', title: 'Contrats' }),
        unit({ id: 'unit-2', subjectId: 'subject-1', title: 'Responsabilite' }),
      ],
      masteryStates: [
        mastery({ knowledgeUnitId: 'unit-1', score: 0.2 }),
        mastery({ knowledgeUnitId: 'unit-2', score: 0.45 }),
      ],
    });

    expect(plan.items).toHaveLength(4);
    expect(plan.items.map((item) => item.action)).toEqual(
      expect.arrayContaining([
        'diagnostic_quiz',
        'open_question',
        'rich_closed_exercise',
        'revision_session',
      ]),
    );
    expect(plan.items[0]).toMatchObject({
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      action: 'diagnostic_quiz',
      reasonCode: 'LOW_MASTERY',
    });
  });

  it('prioritizes low mastery before stronger knowledge units', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [subject({ id: 'subject-1', priority: 3 })],
      knowledgeUnits: [
        unit({ id: 'unit-strong', subjectId: 'subject-1' }),
        unit({ id: 'unit-weak', subjectId: 'subject-1' }),
      ],
      masteryStates: [
        mastery({ knowledgeUnitId: 'unit-strong', score: 0.9 }),
        mastery({ knowledgeUnitId: 'unit-weak', score: 0.1 }),
      ],
    });

    expect(plan.items[0]).toMatchObject({
      knowledgeUnitId: 'unit-weak',
      action: 'diagnostic_quiz',
      reasonCode: 'LOW_MASTERY',
    });
  });

  it('boosts knowledge units that have never been practiced', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [subject({ id: 'subject-1', priority: 3 })],
      knowledgeUnits: [
        unit({ id: 'unit-practiced', subjectId: 'subject-1' }),
        unit({ id: 'unit-never', subjectId: 'subject-1' }),
      ],
      masteryStates: [
        mastery({
          knowledgeUnitId: 'unit-practiced',
          score: 0.5,
          lastPracticedAt: new Date('2026-06-14T10:00:00.000Z'),
        }),
      ],
    });

    expect(plan.items[0]).toMatchObject({
      knowledgeUnitId: 'unit-never',
      reasonCode: 'LOW_MASTERY',
    });
  });

  it('takes subject priority into account', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [
        subject({ id: 'subject-low', name: 'Basse priorite', priority: 1 }),
        subject({ id: 'subject-high', name: 'Haute priorite', priority: 5 }),
      ],
      knowledgeUnits: [
        unit({ id: 'unit-low', subjectId: 'subject-low', title: 'Low' }),
        unit({ id: 'unit-high', subjectId: 'subject-high', title: 'High' }),
      ],
      masteryStates: [
        mastery({ knowledgeUnitId: 'unit-low', score: 0.4 }),
        mastery({ knowledgeUnitId: 'unit-high', score: 0.4 }),
      ],
    });

    expect(plan.items[0]).toMatchObject({
      subjectId: 'subject-high',
      knowledgeUnitId: 'unit-high',
    });
  });

  it('keeps a stable order when scores are tied', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [
        subject({ id: 'subject-b', name: 'Biologie', priority: 3 }),
        subject({ id: 'subject-a', name: 'Anatomie', priority: 3 }),
      ],
      knowledgeUnits: [
        unit({ id: 'unit-b', subjectId: 'subject-b', title: 'Beta' }),
        unit({ id: 'unit-a', subjectId: 'subject-a', title: 'Alpha' }),
      ],
      masteryStates: [
        mastery({ knowledgeUnitId: 'unit-b', score: 0.5 }),
        mastery({ knowledgeUnitId: 'unit-a', score: 0.5 }),
      ],
    });

    expect(plan.items[0]).toMatchObject({
      subjectId: 'subject-a',
      knowledgeUnitId: 'unit-a',
      action: 'diagnostic_quiz',
    });
  });

  it('does not exceed the maximum number of today items', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [subject({ id: 'subject-1', priority: 5 })],
      knowledgeUnits: [
        unit({ id: 'unit-1', subjectId: 'subject-1' }),
        unit({ id: 'unit-2', subjectId: 'subject-1' }),
        unit({ id: 'unit-3', subjectId: 'subject-1' }),
        unit({ id: 'unit-4', subjectId: 'subject-1' }),
      ],
      masteryStates: [],
    });

    expect(plan.items).toHaveLength(4);
  });

  it('proposes open questions only when a knowledge unit is available', () => {
    const emptyPlan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [subject({ id: 'subject-1', priority: 5 })],
      knowledgeUnits: [],
      masteryStates: [],
    });
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [subject({ id: 'subject-1', priority: 5 })],
      knowledgeUnits: [unit({ id: 'unit-1', subjectId: 'subject-1' })],
      masteryStates: [],
    });

    expect(
      emptyPlan.items.some((item) => item.action === 'open_question'),
    ).toBe(false);
    expect(plan.items.some((item) => item.action === 'open_question')).toBe(
      true,
    );
  });

  it('returns rich closed actions with a bounded start payload', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [subject({ id: 'subject-1', priority: 5 })],
      knowledgeUnits: [
        unit({
          id: 'unit-1',
          subjectId: 'subject-1',
          documentId: 'document-1',
        }),
      ],
      masteryStates: [mastery({ knowledgeUnitId: 'unit-1', score: 0.2 })],
    });

    expect(plan.items).toContainEqual(
      expect.objectContaining({
        id: 'subject-1:unit-1:rich_closed_exercise',
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        action: 'rich_closed_exercise',
        estimatedMinutes: 8,
        reasonCode: 'RICH_CLOSED_PRACTICE',
        startPayload: {
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
        },
      }),
    );
  });

  it('omits rich closed document id from start payload when unavailable', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [subject({ id: 'subject-1', priority: 5 })],
      knowledgeUnits: [unit({ id: 'unit-1', subjectId: 'subject-1' })],
      masteryStates: [mastery({ knowledgeUnitId: 'unit-1', score: 0.2 })],
    });
    const richClosedAction = plan.items.find(
      (item) => item.action === 'rich_closed_exercise',
    );

    expect(richClosedAction).toMatchObject({
      documentId: null,
      startPayload: {
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
      },
    });
    expect(richClosedAction?.startPayload).not.toHaveProperty('documentId');
  });

  it('returns revision session actions with explicit start payload', () => {
    const plan = new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects: [subject({ id: 'subject-1', priority: 5 })],
      knowledgeUnits: [unit({ id: 'unit-1', subjectId: 'subject-1' })],
      masteryStates: [],
    });

    expect(plan.items).toContainEqual(
      expect.objectContaining({
        action: 'revision_session',
        startPayload: {
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
        },
      }),
    );
  });

  it('does not mutate inputs', () => {
    const subjects = [subject({ id: 'subject-1', priority: 5 })];
    const units = [unit({ id: 'unit-1', subjectId: 'subject-1' })];
    const masteryStates = [mastery({ knowledgeUnitId: 'unit-1', score: 0.4 })];
    const before = JSON.stringify({
      subjects,
      units,
      masteryStates,
    });

    new AdaptivePlanService().buildTodayPlan({
      now,
      goal: goal(),
      subjects,
      knowledgeUnits: units,
      masteryStates,
    });

    expect(JSON.stringify({ subjects, units, masteryStates })).toBe(before);
  });
});

function goal(
  input: Partial<ConstructorParameters<typeof RevisionGoal>[0]> = {},
) {
  return new RevisionGoal({
    id: 'goal-1',
    studentId: 'student-1',
    targetDate: new Date('2026-07-01T00:00:00.000Z'),
    weeklyMinutes: 240,
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    ...input,
  });
}

function subject(
  input: Partial<ConstructorParameters<typeof Subject>[0]> = {},
) {
  return new Subject({
    id: 'subject-1',
    studentId: 'student-1',
    name: 'Droit',
    priority: 3,
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    ...input,
  });
}

function unit(
  input: Partial<ConstructorParameters<typeof KnowledgeUnit>[0]> = {},
) {
  return new KnowledgeUnit({
    id: 'unit-1',
    subjectId: 'subject-1',
    title: 'Notion',
    summary: 'Résumé',
    ...input,
  });
}

function mastery(
  input: Partial<ConstructorParameters<typeof MasteryState>[0]> = {},
) {
  return new MasteryState({
    studentId: 'student-1',
    knowledgeUnitId: 'unit-1',
    score: 0.5,
    lastPracticedAt: new Date('2026-06-10T10:00:00.000Z'),
    ...input,
  });
}

~~~

### Fichier modifié : `src/modules/revision/domain/adaptive-plan.service.ts`

~~~ts
import { Subject } from '../../subjects/domain/subject.entity';
import { KnowledgeUnit } from './knowledge-unit.entity';
import { MasteryState } from './mastery-state.entity';
import { RevisionGoal } from './revision-goal.entity';

export const TODAY_PLAN_MAX_ITEMS = 4;

export type TodayPlanActionType =
  | 'diagnostic_quiz'
  | 'open_question'
  | 'rich_closed_exercise'
  | 'revision_session';

export type TodayPlanPreferredAction = 'diagnostic_quiz' | 'open_question';

export type TodayPlanReasonCode =
  | 'LOW_MASTERY'
  | 'STALE_PRACTICE'
  | 'HIGH_PRIORITY_SUBJECT'
  | 'MIX_ACTIVITY_TYPE'
  | 'RICH_CLOSED_PRACTICE'
  | 'START_REVISION_SESSION'
  | 'CONTINUE_PROGRESS';

export interface RevisionPlanStartPayload {
  subjectId: string;
  documentId?: string | null;
  knowledgeUnitId?: string;
  preferredAction?: TodayPlanPreferredAction;
}

export interface RevisionPlanItem {
  id: string;
  subjectId: string;
  documentId: string | null;
  knowledgeUnitId: string;
  action: TodayPlanActionType;
  estimatedMinutes: number;
  priority: number;
  reasonCode: TodayPlanReasonCode;
  startPayload: RevisionPlanStartPayload;
}

export interface RevisionPlan {
  generatedAt: Date;
  items: RevisionPlanItem[];
}

type RankedUnit = {
  unit: KnowledgeUnit;
  subject: Subject;
  mastery: MasteryState | undefined;
  rank: number;
  baseReasonCode: TodayPlanReasonCode;
};

type CandidateItem = RevisionPlanItem & {
  unitRank: number;
  subjectPriority: number;
  subjectName: string;
  unitTitle: string;
  actionOrder: number;
};

export class AdaptivePlanService {
  buildTodayPlan(input: {
    now: Date;
    goal: RevisionGoal;
    subjects: Subject[];
    knowledgeUnits: KnowledgeUnit[];
    masteryStates: MasteryState[];
  }): RevisionPlan {
    const rankedUnits = this.rankKnowledgeUnits(input);

    return {
      generatedAt: input.now,
      items: selectTodayItems(rankedUnits).map(toRevisionPlanItem),
    };
  }

  private rankKnowledgeUnits(input: {
    now: Date;
    goal: RevisionGoal;
    subjects: Subject[];
    knowledgeUnits: KnowledgeUnit[];
    masteryStates: MasteryState[];
  }): RankedUnit[] {
    const eligibleSubjects = input.subjects.filter(
      (subject) => subject.studentId === input.goal.studentId,
    );
    const subjectById = new Map(
      eligibleSubjects.map((subject) => [subject.id, subject]),
    );
    const masteryByUnit = new Map(
      input.masteryStates
        .filter((state) => state.studentId === input.goal.studentId)
        .map((state) => [state.knowledgeUnitId, state]),
    );

    return input.knowledgeUnits
      .map((unit) => {
        const subject = subjectById.get(unit.subjectId);

        if (!subject) {
          return null;
        }

        const mastery = masteryByUnit.get(unit.id);
        const masteryScore = mastery?.score ?? 0;
        const lowMasteryBoost = (1 - masteryScore) * 100;
        const staleBoost = resolveStaleBoost({
          now: input.now,
          lastPracticedAt: mastery?.lastPracticedAt ?? null,
        });
        const rank = subject.priority * 100 + lowMasteryBoost + staleBoost;

        return {
          unit,
          subject,
          mastery,
          rank,
          baseReasonCode: resolveBaseReasonCode({
            subject,
            mastery,
            staleBoost,
          }),
        };
      })
      .filter((item): item is RankedUnit => item !== null)
      .sort(compareRankedUnits);
  }
}

function selectTodayItems(rankedUnits: RankedUnit[]): CandidateItem[] {
  const candidates = rankedUnits.flatMap(toCandidates).sort(compareCandidates);
  const selected: CandidateItem[] = [];
  const selectedIds = new Set<string>();

  addFirstCandidateOfAction(
    'diagnostic_quiz',
    candidates,
    selected,
    selectedIds,
  );
  addFirstCandidateOfAction(
    'rich_closed_exercise',
    candidates,
    selected,
    selectedIds,
  );
  addFirstCandidateOfAction('open_question', candidates, selected, selectedIds);
  addFirstCandidateOfAction(
    'revision_session',
    candidates,
    selected,
    selectedIds,
  );

  for (const candidate of candidates) {
    if (selected.length >= TODAY_PLAN_MAX_ITEMS) {
      break;
    }

    addCandidate(candidate, selected, selectedIds);
  }

  return selected.sort(compareCandidates).slice(0, TODAY_PLAN_MAX_ITEMS);
}

function addFirstCandidateOfAction(
  action: TodayPlanActionType,
  candidates: CandidateItem[],
  selected: CandidateItem[],
  selectedIds: Set<string>,
) {
  const candidate = candidates.find((item) => item.action === action);

  if (candidate) {
    addCandidate(candidate, selected, selectedIds);
  }
}

function addCandidate(
  candidate: CandidateItem,
  selected: CandidateItem[],
  selectedIds: Set<string>,
) {
  if (
    selected.length >= TODAY_PLAN_MAX_ITEMS ||
    selectedIds.has(candidate.id)
  ) {
    return;
  }

  selected.push(candidate);
  selectedIds.add(candidate.id);
}

function toCandidates(rankedUnit: RankedUnit): CandidateItem[] {
  return [
    toCandidate({
      rankedUnit,
      action: 'diagnostic_quiz',
      estimatedMinutes: 12,
      actionBoost: 30,
      actionOrder: 0,
      reasonCode: rankedUnit.baseReasonCode,
      startPayload: {
        subjectId: rankedUnit.subject.id,
        knowledgeUnitId: rankedUnit.unit.id,
        preferredAction: 'diagnostic_quiz',
      },
    }),
    toCandidate({
      rankedUnit,
      action: 'rich_closed_exercise',
      estimatedMinutes: 8,
      actionBoost: 25,
      actionOrder: 1,
      reasonCode: 'RICH_CLOSED_PRACTICE',
      startPayload: {
        subjectId: rankedUnit.subject.id,
        ...(rankedUnit.unit.documentId === null
          ? {}
          : { documentId: rankedUnit.unit.documentId }),
        knowledgeUnitId: rankedUnit.unit.id,
      },
    }),
    toCandidate({
      rankedUnit,
      action: 'open_question',
      estimatedMinutes: 18,
      actionBoost: 20,
      actionOrder: 2,
      reasonCode: 'MIX_ACTIVITY_TYPE',
      startPayload: {
        subjectId: rankedUnit.subject.id,
        ...(rankedUnit.unit.documentId === null
          ? {}
          : { documentId: rankedUnit.unit.documentId }),
        knowledgeUnitId: rankedUnit.unit.id,
        preferredAction: 'open_question',
      },
    }),
    toCandidate({
      rankedUnit,
      action: 'revision_session',
      estimatedMinutes: 25,
      actionBoost: 10,
      actionOrder: 3,
      reasonCode: 'START_REVISION_SESSION',
      startPayload: {
        subjectId: rankedUnit.subject.id,
        ...(rankedUnit.unit.documentId === null
          ? {}
          : { documentId: rankedUnit.unit.documentId }),
        knowledgeUnitId: rankedUnit.unit.id,
      },
    }),
  ];
}

function toCandidate(input: {
  rankedUnit: RankedUnit;
  action: TodayPlanActionType;
  estimatedMinutes: number;
  actionBoost: number;
  actionOrder: number;
  reasonCode: TodayPlanReasonCode;
  startPayload: RevisionPlanStartPayload;
}): CandidateItem {
  const priority = Math.round(input.rankedUnit.rank + input.actionBoost);

  return {
    id: `${input.rankedUnit.subject.id}:${input.rankedUnit.unit.id}:${input.action}`,
    subjectId: input.rankedUnit.subject.id,
    documentId: input.rankedUnit.unit.documentId,
    knowledgeUnitId: input.rankedUnit.unit.id,
    action: input.action,
    estimatedMinutes: input.estimatedMinutes,
    priority,
    reasonCode: input.reasonCode,
    startPayload: input.startPayload,
    unitRank: input.rankedUnit.rank,
    subjectPriority: input.rankedUnit.subject.priority,
    subjectName: input.rankedUnit.subject.name,
    unitTitle: input.rankedUnit.unit.title,
    actionOrder: input.actionOrder,
  };
}

function toRevisionPlanItem(candidate: CandidateItem): RevisionPlanItem {
  return {
    id: candidate.id,
    subjectId: candidate.subjectId,
    documentId: candidate.documentId,
    knowledgeUnitId: candidate.knowledgeUnitId,
    action: candidate.action,
    estimatedMinutes: candidate.estimatedMinutes,
    priority: candidate.priority,
    reasonCode: candidate.reasonCode,
    startPayload: candidate.startPayload,
  };
}

function resolveBaseReasonCode(input: {
  subject: Subject;
  mastery: MasteryState | undefined;
  staleBoost: number;
}): TodayPlanReasonCode {
  if (!input.mastery || input.mastery.score < 0.4) {
    return 'LOW_MASTERY';
  }

  if (!input.mastery.lastPracticedAt || input.staleBoost >= 20) {
    return 'STALE_PRACTICE';
  }

  if (input.subject.priority >= 4) {
    return 'HIGH_PRIORITY_SUBJECT';
  }

  return 'CONTINUE_PROGRESS';
}

function resolveStaleBoost(input: {
  now: Date;
  lastPracticedAt: Date | null;
}): number {
  if (!input.lastPracticedAt) {
    return 30;
  }

  const daysSincePractice = Math.max(
    0,
    (input.now.getTime() - input.lastPracticedAt.getTime()) /
      (1000 * 60 * 60 * 24),
  );

  return Math.min(30, daysSincePractice);
}

function compareRankedUnits(a: RankedUnit, b: RankedUnit): number {
  return (
    b.rank - a.rank ||
    b.subject.priority - a.subject.priority ||
    a.subject.name.localeCompare(b.subject.name) ||
    a.subject.id.localeCompare(b.subject.id) ||
    a.unit.title.localeCompare(b.unit.title) ||
    a.unit.id.localeCompare(b.unit.id)
  );
}

function compareCandidates(a: CandidateItem, b: CandidateItem): number {
  return (
    b.priority - a.priority ||
    b.unitRank - a.unitRank ||
    b.subjectPriority - a.subjectPriority ||
    a.subjectName.localeCompare(b.subjectName) ||
    a.subjectId.localeCompare(b.subjectId) ||
    a.unitTitle.localeCompare(b.unitTitle) ||
    a.knowledgeUnitId.localeCompare(b.knowledgeUnitId) ||
    a.actionOrder - b.actionOrder
  );
}

~~~

### Fichier modifié : `src/modules/revision/domain/knowledge-unit.entity.ts`

~~~ts
export class KnowledgeUnit {
  readonly id: string;
  readonly subjectId: string;
  readonly documentId: string | null;
  readonly title: string;
  readonly summary: string;

  constructor(input: {
    id: string;
    subjectId: string;
    documentId?: string | null;
    title: string;
    summary: string;
  }) {
    if (input.title.trim().length < 2) {
      throw new Error(
        'Knowledge unit title must contain at least 2 characters',
      );
    }

    this.id = input.id;
    this.subjectId = input.subjectId;
    this.documentId = input.documentId ?? null;
    this.title = input.title.trim();
    this.summary = input.summary.trim();
  }
}

~~~

### Fichier modifié : `src/modules/revision/infrastructure/prisma-revision.repository.spec.ts`

~~~ts
import { PrismaRevisionRepository } from './prisma-revision.repository';

type RevisionGoalRecord = {
  id: string;
  studentId: string;
  targetDate: Date;
  weeklyMinutes: number;
  createdAt: Date;
};

type KnowledgeUnitRecord = {
  id: string;
  subjectId: string;
  documentId: string | null;
  title: string;
  summary: string;
  createdAt: Date;
};

type MasteryStateRecord = {
  studentId: string;
  subjectId: string;
  knowledgeUnitId: string;
  score: number;
  lastPracticedAt: Date | null;
  updatedAt: Date;
};

describe('PrismaRevisionRepository', () => {
  const targetDate = new Date('2026-06-30T00:00:00.000Z');
  const createdAt = new Date('2026-06-12T10:00:00.000Z');
  const practicedAt = new Date('2026-06-12T12:00:00.000Z');

  const createRepository = () => {
    const prisma = {
      revisionGoal: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      knowledgeUnit: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      masteryState: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };

    return {
      prisma,
      repository: new PrismaRevisionRepository(prisma as never),
    };
  };

  const goalRecord = (
    input: Partial<RevisionGoalRecord> = {},
  ): RevisionGoalRecord => ({
    id: 'goal-1',
    studentId: 'student-1',
    targetDate,
    weeklyMinutes: 240,
    createdAt,
    ...input,
  });

  const knowledgeUnitRecord = (
    input: Partial<KnowledgeUnitRecord> = {},
  ): KnowledgeUnitRecord => ({
    id: 'unit-1',
    subjectId: 'subject-1',
    documentId: null,
    title: 'Cellules',
    summary: 'Bases de biologie cellulaire',
    createdAt,
    ...input,
  });

  const masteryRecord = (
    input: Partial<MasteryStateRecord> = {},
  ): MasteryStateRecord => ({
    studentId: 'student-1',
    subjectId: 'subject-1',
    knowledgeUnitId: 'unit-1',
    score: 0.6,
    lastPracticedAt: practicedAt,
    updatedAt: createdAt,
    ...input,
  });

  it('saves a valid revision goal through Prisma', async () => {
    const { prisma, repository } = createRepository();
    prisma.revisionGoal.create.mockResolvedValue(goalRecord());

    const goal = await repository.saveGoal({
      studentId: 'student-1',
      targetDate,
      weeklyMinutes: 240,
    });

    expect(prisma.revisionGoal.create).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        targetDate,
        weeklyMinutes: 240,
      },
    });
    expect(goal).toMatchObject({
      id: 'goal-1',
      studentId: 'student-1',
      targetDate,
      weeklyMinutes: 240,
      createdAt,
    });
  });

  it('rejects invalid revision goals before writing to Prisma', async () => {
    const { prisma, repository } = createRepository();

    await expect(
      repository.saveGoal({
        studentId: 'student-1',
        targetDate,
        weeklyMinutes: 10,
      }),
    ).rejects.toThrow('Weekly revision time must be at least 30 minutes');

    expect(prisma.revisionGoal.create).not.toHaveBeenCalled();
  });

  it('rejects invalid mastery before ownership lookup or upsert', async () => {
    const { prisma, repository } = createRepository();

    await expect(
      repository.upsertMastery({
        studentId: 'student-1',
        knowledgeUnitId: 'unit-1',
        score: 1.2,
        lastPracticedAt: practicedAt,
      }),
    ).rejects.toThrow('Mastery score must be between 0 and 1');

    expect(prisma.knowledgeUnit.findFirst).not.toHaveBeenCalled();
    expect(prisma.masteryState.upsert).not.toHaveBeenCalled();
  });

  it('does not upsert mastery when the knowledge unit is not owned by the student', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findFirst.mockResolvedValue(null);

    await expect(
      repository.upsertMastery({
        studentId: 'student-1',
        knowledgeUnitId: 'unit-2',
        score: 0.6,
        lastPracticedAt: practicedAt,
      }),
    ).rejects.toThrow('Knowledge unit does not belong to student');

    expect(prisma.knowledgeUnit.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'unit-2',
        subject: {
          studentId: 'student-1',
        },
      },
    });
    expect(prisma.masteryState.upsert).not.toHaveBeenCalled();
  });

  it('loads only student knowledge units and maps document ids', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      knowledgeUnitRecord({ documentId: 'document-1' }),
    ]);

    const units = await repository.findKnowledgeUnits('student-1');

    expect(prisma.knowledgeUnit.findMany).toHaveBeenCalledWith({
      where: {
        subject: {
          studentId: 'student-1',
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({
      id: 'unit-1',
      subjectId: 'subject-1',
      documentId: 'document-1',
    });
  });

  it('upserts mastery after verifying the student owns the knowledge unit', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findFirst.mockResolvedValue(knowledgeUnitRecord());
    prisma.masteryState.upsert.mockResolvedValue(masteryRecord());

    const mastery = await repository.upsertMastery({
      studentId: 'student-1',
      knowledgeUnitId: 'unit-1',
      score: 0.6,
      lastPracticedAt: practicedAt,
    });

    expect(prisma.knowledgeUnit.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'unit-1',
        subject: {
          studentId: 'student-1',
        },
      },
    });
    expect(prisma.masteryState.upsert).toHaveBeenCalledWith({
      where: {
        studentId_knowledgeUnitId: {
          studentId: 'student-1',
          knowledgeUnitId: 'unit-1',
        },
      },
      create: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
        score: 0.6,
        lastPracticedAt: practicedAt,
      },
      update: {
        subjectId: 'subject-1',
        score: 0.6,
        lastPracticedAt: practicedAt,
      },
    });
    expect(mastery).toMatchObject({
      studentId: 'student-1',
      knowledgeUnitId: 'unit-1',
      score: 0.6,
      lastPracticedAt: practicedAt,
    });
  });
});

~~~

### Fichier modifié : `src/modules/revision/infrastructure/prisma-revision.repository.ts`

~~~ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { RevisionRepository } from '../application/revision.repository';
import { KnowledgeUnit } from '../domain/knowledge-unit.entity';
import { MasteryState } from '../domain/mastery-state.entity';
import { RevisionGoal } from '../domain/revision-goal.entity';

type RevisionGoalRecord = {
  id: string;
  studentId: string;
  targetDate: Date;
  weeklyMinutes: number;
  createdAt: Date;
};

type KnowledgeUnitRecord = {
  id: string;
  subjectId: string;
  documentId: string | null;
  title: string;
  summary: string;
};

type MasteryStateRecord = {
  studentId: string;
  subjectId: string;
  knowledgeUnitId: string;
  score: number;
  lastPracticedAt: Date | null;
};

@Injectable()
export class PrismaRevisionRepository implements RevisionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveGoal(studentId: string): Promise<RevisionGoal | null> {
    const record = await this.prisma.revisionGoal.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });

    return record ? this.toRevisionGoal(record) : null;
  }

  async saveGoal(input: {
    studentId: string;
    targetDate: Date;
    weeklyMinutes: number;
  }): Promise<RevisionGoal> {
    const goal = new RevisionGoal({
      id: 'validation-goal',
      studentId: input.studentId,
      targetDate: input.targetDate,
      weeklyMinutes: input.weeklyMinutes,
      createdAt: new Date(0),
    });

    const record = await this.prisma.revisionGoal.create({
      data: {
        studentId: goal.studentId,
        targetDate: goal.targetDate,
        weeklyMinutes: goal.weeklyMinutes,
      },
    });

    return this.toRevisionGoal(record);
  }

  async findKnowledgeUnits(studentId: string): Promise<KnowledgeUnit[]> {
    const records = await this.prisma.knowledgeUnit.findMany({
      where: {
        subject: {
          studentId,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return records.map((record) => this.toKnowledgeUnit(record));
  }

  async findMasteryStates(studentId: string): Promise<MasteryState[]> {
    const records = await this.prisma.masteryState.findMany({
      where: { studentId },
      orderBy: { updatedAt: 'asc' },
    });

    return records.map((record) => this.toMasteryState(record));
  }

  async upsertMastery(input: {
    studentId: string;
    knowledgeUnitId: string;
    score: number;
    lastPracticedAt: Date;
  }): Promise<MasteryState> {
    const mastery = new MasteryState({
      studentId: input.studentId,
      knowledgeUnitId: input.knowledgeUnitId,
      score: input.score,
      lastPracticedAt: input.lastPracticedAt,
    });

    const knowledgeUnit = await this.prisma.knowledgeUnit.findFirst({
      where: {
        id: mastery.knowledgeUnitId,
        subject: {
          studentId: mastery.studentId,
        },
      },
    });

    if (!knowledgeUnit) {
      throw new Error('Knowledge unit does not belong to student');
    }

    const record = await this.prisma.masteryState.upsert({
      where: {
        studentId_knowledgeUnitId: {
          studentId: mastery.studentId,
          knowledgeUnitId: mastery.knowledgeUnitId,
        },
      },
      create: {
        studentId: mastery.studentId,
        subjectId: knowledgeUnit.subjectId,
        knowledgeUnitId: mastery.knowledgeUnitId,
        score: mastery.score,
        lastPracticedAt: mastery.lastPracticedAt,
      },
      update: {
        subjectId: knowledgeUnit.subjectId,
        score: mastery.score,
        lastPracticedAt: mastery.lastPracticedAt,
      },
    });

    return this.toMasteryState(record);
  }

  private toRevisionGoal(record: RevisionGoalRecord): RevisionGoal {
    return new RevisionGoal({
      id: record.id,
      studentId: record.studentId,
      targetDate: record.targetDate,
      weeklyMinutes: record.weeklyMinutes,
      createdAt: record.createdAt,
    });
  }

  private toKnowledgeUnit(record: KnowledgeUnitRecord): KnowledgeUnit {
    return new KnowledgeUnit({
      id: record.id,
      subjectId: record.subjectId,
      documentId: record.documentId,
      title: record.title,
      summary: record.summary,
    });
  }

  private toMasteryState(record: MasteryStateRecord): MasteryState {
    return new MasteryState({
      studentId: record.studentId,
      knowledgeUnitId: record.knowledgeUnitId,
      score: record.score,
      lastPracticedAt: record.lastPracticedAt,
    });
  }
}

~~~

### Fichier modifié : `src/modules/revision/interfaces/today.controller.spec.ts`

~~~ts
import { GetTodayPlanUseCase } from '../application/get-today-plan.use-case';
import { TodayController } from './today.controller';

describe('TodayController', () => {
  it('loads today plan for the current student', async () => {
    const execute = jest.fn().mockResolvedValue({
      generatedAt: new Date('2026-06-15T10:00:00.000Z'),
      items: [
        {
          id: 'subject-1:unit-1:diagnostic_quiz',
          subjectId: 'subject-1',
          subjectName: 'Droit',
          documentId: null,
          knowledgeUnitId: 'unit-1',
          knowledgeUnitTitle: 'Séparation',
          masteryScore: 0.2,
          action: 'diagnostic_quiz',
          estimatedMinutes: 12,
          priority: 560,
          reasonCode: 'LOW_MASTERY',
          reason: 'À revoir en priorité : cette notion est encore fragile.',
          startPayload: {
            subjectId: 'subject-1',
            knowledgeUnitId: 'unit-1',
            preferredAction: 'diagnostic_quiz',
          },
        },
      ],
    });
    const controller = new TodayController({
      execute,
    } as unknown as GetTodayPlanUseCase);

    await expect(controller.get({ id: 'student-1' })).resolves.toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ action: 'diagnostic_quiz' })],
      }),
    );
    expect(execute).toHaveBeenCalledWith({ studentId: 'student-1' });
  });
});

~~~

### Fichier modifié : `docs/v1/ROADMAP_EXECUTION_PLAN_V1.md`

~~~md
# Roadmap execution plan V1 — API

Ce fichier existe côté API pour les lots backend V1 dont le prompt interdit toute modification de `revision_app/`.

| Lot | Intitulé | Statut | Rapport |
| --- | --- | --- | --- |
| V1-012C | Backend diagnostics génération rich closed | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_012C_BACKEND_RICH_CLOSED_GENERATION_DIAGNOSTICS.md |
| V1-012D | Dokploy runtime fix génération rich closed | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_012D_DOKPLOY_RICH_CLOSED_RUNTIME_FIX.md |
| V1-013 | Today integration V1 | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_013_TODAY_INTEGRATION_V1.md |

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

### V1-013 — Today integration V1

- Objectif : permettre à Today de recommander une action déterministe `rich_closed_exercise`.
- Pourquoi maintenant : la page rich closed complète existe et peut prendre le relais au clic utilisateur.
- Périmètre inclus : contrat Today, sélection déterministe, propagation optionnelle de `documentId`, tests Today/revision/activities.
- Non-objectifs : Genkit depuis Today, revision sessions, endpoints rich closed, Prisma schema ou migration.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_013_TODAY_INTEGRATION_V1.md`.

~~~

### Fichier créé : `docs/v1/ROADMAP_EXECUTION_LOT_V1_013_TODAY_INTEGRATION_V1.md`

Le présent fichier est le rapport créé pour V1-013 côté API. Son contenu complet correspond au document affiché ici. Il n'est pas recopié récursivement dans lui-même, car cela créerait une expansion infinie.
