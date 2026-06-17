# LOT V1-015 + V1-016 — Rich demo seed and smoke V1

## Statut

Réalisé côté API uniquement. Le lot V1-015 ajoute un seed démo rich closed V1-A stable, synthétique et rejouable. Le lot V1-016 renforce le smoke HTTP rich closed, Today et revision sessions autour des 6 types fermés riches.

Aucune modification n'a été faite côté `revision_app/`. Aucun commit, push, rebase, reset, migration Prisma, appel IA réel ou action Dokploy n'a été effectué.

## Résultat V1-015

Le seed démo existant porte maintenant aussi un exercice `RICH_CLOSED_EXERCISE` persistant pour la notion `Régime parlementaire rationalisé` dans le sujet `Droit constitutionnel — Ve République`.

- IDs déterministes : `demo-rich-closed-session-regime-parlementaire`, `demo-rich-closed-payload-regime-parlementaire`, `demo-rich-closed-exercise-regime-parlementaire-v1a`.
- Données synthétiques : chunks, notions, résumé, fiche et exercice sans document réel sensible.
- Pas de provider IA : métadonnées `provider: demo-seed`, `model: demo-fixture`, `inputSize: 0`.
- Seed rejouable : les relations seed touchées passent par `upsert`; le grep ne trouve plus de `deleteMany` dans `prisma/demo-seed.ts` ni `src/modules/demo-seed/demo-seed.fixtures.ts`.
- Validation dry-run : `DEMO_SEED_CONFIRM=revision-demo DEMO_FIREBASE_UID=demo-fixture-uid npm run demo:seed -- --dry-run` liste les 6 types rich closed et masque les secrets.

## Résultat V1-016

Le smoke E2E critique utilise maintenant le fixture rich closed applicatif complet via le public mapper et le scorer backend, au lieu d'une mini-fixture locale à une question.

- `POST /activities/rich-closed/start` vérifie `sessionId`, les 6 types V1-A et les sources, sans correction pré-submit.
- `GET /activities/rich-closed/:sessionId` repasse par le helper anti-fuite récursif.
- `GET /activities/rich-closed/:sessionId/result` renvoie une erreur contrôlée avant submit.
- `POST /activities/rich-closed/:sessionId/submit` accepte une réponse complète et renvoie score/corrections/explanations post-submit.
- Les invalides couvrent unknown choice, réponse manquante, doublon, matching inconnu et ordering incomplet.
- Today recommande `rich_closed_exercise` avec un launcher borné, sans questions ni correction.
- Revision sessions acceptent `preferredAction: rich_closed_exercise` comme launcher borné, sans questions ni correction.

## Sources inspectées

- Modules rich closed : types, fixtures, mapper public, scorer, controller, use cases et repository Prisma.
- Seed et fixtures Prisma : `prisma/demo-seed.ts`, `src/modules/demo-seed/demo-seed.fixtures.ts`, `prisma/schema.prisma`.
- E2E/smoke : `test/critical-paths.e2e-spec.ts`.
- Today/revision : tests et contrôleurs existants liés à `rich_closed_exercise`.
- Frontend : état Git et tests/runbooks existants inspectés au minimum ; aucun fichier app n'a été modifié.

## Git preflight

- API : branche `main`, worktree propre au départ du lot ; dernier commit vu `46d2e83 014: Intégration des sessions de révision et actions associées`.
- App : branche `main`, worktree propre et non touché ; dernier commit vu `13e54e0 V1-014: Intégration des sessions de révision avec tests et documentation`.

## Périmètre

Inclus : seed API, fixture rich closed V1-A, smoke E2E API, plan API, rapport API.

Exclus : V1-017, frontend, Dokploy, migration Prisma, provider IA réel, nouveau type de question, modification des contrats V1-A/scoring/quality gates.

## Stratégie seed

Stratégie hybride légère : réutiliser le seed démo existant et y attacher une session rich closed persistée. Cette option évite un nouveau script parallèle, garde la garde `assertDemoNamespaceAvailable`, reste compatible dry-run et expose des IDs utiles.

Le seed écrit, si exécuté explicitement par un humain avec les variables requises, ne reset pas la base. Il upsert uniquement l'espace de noms démo connu et refuse d'écraser un subject/document/goal démo déjà rattaché à un autre profil étudiant.

## Fixture rich closed V1-A

Le payload contient exactement les 6 types demandés :

- `single_choice`
- `multiple_choice`
- `matching`
- `ordering`
- `case_qualification`
- `error_detection`

Chaque question conserve ses corrections internes dans le payload persistant et porte au moins une source parmi les chunks synthétiques demo. Les routes publiques passent par le public mapper, donc les corrections restent absentes avant submit.

## Anti-fuite

Le smoke E2E utilise `assertNoSensitivePreSubmitFields`, récursif sur objets et tableaux. Il rejette les clés commençant par `correct` et les clés privées suivantes avant submit : `correction`, `correctionPayload`, `explanation`, `feedback`, `choiceFeedback`, `modelAnswer`, `answerText`, `freeTextAnswer`, `textAnswer`, `score`, `partialScore`, `answersPayload`, `storagePath`, `promptVersion`, `completion`.

Post-submit, le résultat rich closed peut contenir `score`, `explanation` et `correction`, conformément au contrat.

## Sécurité et non-destructif

- Aucun secret ajouté.
- Aucun appel réseau IA ou Firebase dans les tests ; Firebase reste mocké.
- Aucun reset, truncate, migration ou commande destructive exécutée.
- Aucun `deleteMany` restant dans les fichiers seed touchés.
- Le dry-run seed masque `DATABASE_URL` et `firebaseUid`.
- Les fixtures sont synthétiques et anonymisées.

## Fichiers

Créé :

- `docs/v1/ROADMAP_EXECUTION_LOT_V1_015_016_RICH_DEMO_SEED_AND_SMOKE.md`

Modifiés :

- `docs/v1/ROADMAP_EXECUTION_PLAN_V1.md`
- `prisma/demo-seed.ts`
- `src/modules/demo-seed/demo-seed.fixtures.ts`
- `test/critical-paths.e2e-spec.ts`

Supprimés : aucun.

Le présent rapport est créé dans `docs/v1/ROADMAP_EXECUTION_LOT_V1_015_016_RICH_DEMO_SEED_AND_SMOKE.md`. Son contenu n'est pas recopié récursivement dans lui-même afin d'éviter une expansion infinie.

## Tests et validations

- `npm test -- rich-closed --runInBand` : réussi, 8 suites / 93 tests.
- `npm run test:e2e -- --runInBand` : réussi, 2 suites / 19 tests.
- `npm test -- activities --runInBand` : réussi, 17 suites passées / 1 skipped, 190 tests passés / 1 skipped.
- `npm test -- revision --runInBand` : réussi, 15 suites / 87 tests.
- `npm test -- revision-session --runInBand` : réussi, 6 suites / 41 tests.
- `npm test -- revision-sessions --runInBand` : réussi, 6 suites / 41 tests.
- `DEMO_SEED_CONFIRM=revision-demo DEMO_FIREBASE_UID=demo-fixture-uid npm run demo:seed -- --dry-run` : réussi, affiche les 6 types rich closed.
- `npm run lint:check` : réussi.
- `npm run build` : réussi.
- `git diff --check` : réussi après création du rapport.

## Validations non lancées

- Commandes Flutter non lancées : `revision_app/` n'a pas été modifié.
- Seed write non lancé : seul le dry-run a été exécuté pour respecter le cadre non destructif.
- Provider IA réel non lancé : tests et seed utilisent fixtures/mocks.
- Dokploy non inspecté ni modifié.

## Risques restants

- Le seed write réel reste dépendant d'une base PostgreSQL configurée ; le lot valide le dry-run et la compilation, pas une écriture en environnement partagé.
- Comme les relations passent par upsert non destructif, d'éventuelles anciennes lignes démo obsolètes ne sont pas supprimées automatiquement. C'est volontaire pour rester non destructif.

## Next lot

V1-017 reste à faire et n'est pas marqué réalisé. Le prochain lot peut s'appuyer sur les IDs seed et le smoke rich closed V1-A consolidé.

## Review passes

- Passe seed : IDs déterministes, dry-run, no secrets, no provider, no `deleteMany` dans les fichiers seed touchés.
- Passe anti-fuite : start/get/Today/revision session contrôlés par helper récursif, post-submit séparé.
- Passe invalides : inconnus, manquants, doublons, matching et ordering invalides.
- Passe frontières : pas de frontend, pas de migration, pas de V1-017, pas de GenUI/widget arbitraire.

## Critique prompt

Question de relecture utilisée : est-ce que ce lot prouve un fixture rich closed V1-A à 6 types, rejouable et sans provider réel, puis protège les surfaces HTTP pré-submit contre les fuites de correction tout en laissant les corrections uniquement après submit ? Réponse : oui côté API, avec seed dry-run, E2E et validations listées ci-dessus.

## Contenu complet des fichiers touchés

### docs/v1/ROADMAP_EXECUTION_PLAN_V1.md

```md
# Roadmap execution plan V1 — API

Ce fichier existe côté API pour les lots backend V1 dont le prompt interdit toute modification de `revision_app/`.

| Lot | Intitulé | Statut | Rapport |
| --- | --- | --- | --- |
| V1-012C | Backend diagnostics génération rich closed | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_012C_BACKEND_RICH_CLOSED_GENERATION_DIAGNOSTICS.md |
| V1-012D | Dokploy runtime fix génération rich closed | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_012D_DOKPLOY_RICH_CLOSED_RUNTIME_FIX.md |
| V1-013 | Today integration V1 | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_013_TODAY_INTEGRATION_V1.md |
| V1-014 | Revision session integration V1 | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_014_REVISION_SESSION_INTEGRATION_V1.md |
| V1-015 | Rich demo fixtures V1 | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_015_016_RICH_DEMO_SEED_AND_SMOKE.md |
| V1-016 | E2E/smoke rich questions V1 | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_015_016_RICH_DEMO_SEED_AND_SMOKE.md |

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

### V1-014 — Revision session integration V1

- Objectif : permettre aux sessions de révision de proposer l'action bornée `RICH_CLOSED_EXERCISE`.
- Pourquoi maintenant : le flow rich closed V1-A existe et Today sait déjà le recommander.
- Périmètre inclus : contrat session, coach next-action, persistance enum, contrôleur, tests anti-fuite.
- Non-objectifs : génération de questions rich closed depuis la session, rendu de widget arbitraire, correction pré-submit, provider IA réel dans les tests.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_014_REVISION_SESSION_INTEGRATION_V1.md`.

### V1-015 — Rich demo fixtures V1

- Objectif : disposer d'un seed démo riche fermé V1-A stable, rejouable et synthétique.
- Pourquoi maintenant : les parcours Today, sessions de révision et rich closed sont intégrés, mais il manquait un jeu démo persistant couvrant les 6 types fermés riches.
- Périmètre inclus : fixture `Droit constitutionnel`, notion `Régime parlementaire rationalisé`, chunks/sources synthétiques, session `RICH_CLOSED_EXERCISE`, payload rich closed V1-A à 6 questions, dry-run non destructif.
- Non-objectifs : migration Prisma, provider IA réel, reset ou suppression de données, nouveau type de question.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_015_016_RICH_DEMO_SEED_AND_SMOKE.md`.

### V1-016 — E2E/smoke rich questions V1

- Objectif : protéger le contrat HTTP rich closed V1-A et les launchers Today/session de révision.
- Pourquoi maintenant : le seed démo doit être validable et les parcours intégrés doivent garantir l'absence de fuite pré-submit.
- Périmètre inclus : smoke `/activities/rich-closed/start`, get, result avant submit, submit, result après submit, invalides, Today rich closed, revision session rich closed, anti-fuite récursif.
- Non-objectifs : refonte frontend, génération Genkit réelle, widgets libres, V1-017.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_015_016_RICH_DEMO_SEED_AND_SMOKE.md`.

```

### prisma/demo-seed.ts

```ts
import 'dotenv/config';
import { resolvePrismaDatabaseUrl } from '../src/shared/infrastructure/prisma/database-url';
import {
  buildDemoSeedFixtures,
  buildDemoSeedPlan,
  buildDemoSeedRuntimeOptions,
  demoSeedIds,
  maskDatabaseUrl,
  type DemoSeedFixtures,
} from '../src/modules/demo-seed/demo-seed.fixtures';

async function main(): Promise<void> {
  const options = buildDemoSeedRuntimeOptions({
    env: process.env,
    argv: process.argv.slice(2),
  });
  const databaseUrl = resolvePrismaDatabaseUrl();
  const now = new Date();

  if (options.dryRun) {
    const fixtures = buildDemoSeedFixtures({
      studentId: 'demo-student-profile',
      now,
    });
    const plan = buildDemoSeedPlan(fixtures);

    printSeedSummary({
      mode: 'dry-run',
      databaseUrl,
      firebaseUid: options.firebaseUid,
      fixtures,
      deletePlan: plan.deletePlan,
    });
    return;
  }

  const [{ PrismaPg }, { getPrismaClientClass }] = await Promise.all([
    import('@prisma/adapter-pg'),
    Promise.resolve(require('../src/generated/prisma/internal/class')),
  ]);
  const PrismaClient = getPrismaClientClass();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    await prisma.$connect();

    const student = await prisma.studentProfile.upsert({
      where: { firebaseUid: options.firebaseUid },
      create: {
        id: 'demo-student-profile',
        firebaseUid: options.firebaseUid,
        email: options.email,
        displayName: options.displayName,
      },
      update: {
        email: options.email,
        displayName: options.displayName,
      },
    });
    const fixtures = buildDemoSeedFixtures({
      studentId: student.id,
      now,
    });
    const plan = buildDemoSeedPlan(fixtures);

    await prisma.$transaction(async (tx) => {
      await assertDemoNamespaceAvailable(tx, student.id);
      await seedFixtures(tx, fixtures);
    });

    printSeedSummary({
      mode: 'write',
      databaseUrl,
      firebaseUid: options.firebaseUid,
      fixtures,
      deletePlan: plan.deletePlan,
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function assertDemoNamespaceAvailable(
  tx: TransactionClient,
  studentId: string,
): Promise<void> {
  const [subject, document, goal] = await Promise.all([
    tx.subject.findUnique({
      where: { id: demoSeedIds.subjectId },
      select: { studentId: true },
    }),
    tx.document.findUnique({
      where: { id: demoSeedIds.documentId },
      select: { studentId: true },
    }),
    tx.revisionGoal.findUnique({
      where: { id: demoSeedIds.goalId },
      select: { studentId: true },
    }),
  ]);

  for (const record of [subject, document, goal]) {
    if (record && record.studentId !== studentId) {
      throw new Error(
        'Demo namespace already belongs to another student profile',
      );
    }
  }
}

async function seedFixtures(
  tx: TransactionClient,
  fixtures: DemoSeedFixtures,
): Promise<void> {
  await tx.subject.upsert({
    where: { id: fixtures.subject.id },
    create: fixtures.subject,
    update: {
      studentId: fixtures.subject.studentId,
      name: fixtures.subject.name,
      priority: fixtures.subject.priority,
    },
  });

  await tx.document.upsert({
    where: { id: fixtures.document.id },
    create: fixtures.document,
    update: {
      studentId: fixtures.document.studentId,
      subjectId: fixtures.document.subjectId,
      kind: fixtures.document.kind,
      fileName: fixtures.document.fileName,
      storagePath: fixtures.document.storagePath,
      mimeType: fixtures.document.mimeType,
      status: fixtures.document.status,
      errorCode: null,
    },
  });

  for (const chunk of fixtures.chunks) {
    await tx.documentChunk.upsert({
      where: { id: chunk.id },
      create: chunk,
      update: {
        documentId: chunk.documentId,
        subjectId: chunk.subjectId,
        index: chunk.index,
        text: chunk.text,
        charStart: chunk.charStart,
        charEnd: chunk.charEnd,
        pageNumber: chunk.pageNumber,
      },
    });
  }

  for (const unit of fixtures.knowledgeUnits) {
    await tx.knowledgeUnit.upsert({
      where: { id: unit.id },
      create: unit,
      update: unit,
    });
  }

  for (const source of fixtures.knowledgeUnitSources) {
    await tx.knowledgeUnitSource.upsert({
      where: {
        knowledgeUnitId_chunkId: {
          knowledgeUnitId: source.knowledgeUnitId,
          chunkId: source.chunkId,
        },
      },
      create: source,
      update: {
        subjectId: source.subjectId,
        relevanceScore: source.relevanceScore,
      },
    });
  }

  await tx.revisionGoal.upsert({
    where: { id: fixtures.goal.id },
    create: fixtures.goal,
    update: {
      studentId: fixtures.goal.studentId,
      targetDate: fixtures.goal.targetDate,
      weeklyMinutes: fixtures.goal.weeklyMinutes,
    },
  });

  for (const mastery of fixtures.masteryStates) {
    await tx.masteryState.upsert({
      where: {
        studentId_knowledgeUnitId: {
          studentId: mastery.studentId,
          knowledgeUnitId: mastery.knowledgeUnitId,
        },
      },
      create: mastery,
      update: {
        subjectId: mastery.subjectId,
        score: mastery.score,
        lastPracticedAt: mastery.lastPracticedAt,
      },
    });
  }

  const summary = await tx.summary.upsert({
    where: { documentId: fixtures.summary.documentId },
    create: fixtures.summary,
    update: {
      subjectId: fixtures.summary.subjectId,
      studentId: fixtures.summary.studentId,
      status: fixtures.summary.status,
      title: fixtures.summary.title,
      content: fixtures.summary.content,
      keyPoints: fixtures.summary.keyPoints,
      limits: fixtures.summary.limits,
      generatedAt: fixtures.summary.generatedAt,
      flowName: fixtures.summary.flowName,
      provider: fixtures.summary.provider,
      model: fixtures.summary.model,
      promptVersion: fixtures.summary.promptVersion,
      schemaVersion: fixtures.summary.schemaVersion,
      inputSize: fixtures.summary.inputSize,
      sourceStrategy: fixtures.summary.sourceStrategy,
      errorCode: fixtures.summary.errorCode,
    },
  });
  for (const source of fixtures.summarySources) {
    await tx.summarySource.upsert({
      where: {
        summaryId_chunkId: {
          summaryId: summary.id,
          chunkId: source.chunkId,
        },
      },
      create: {
        ...source,
        summaryId: summary.id,
      },
      update: {
        subjectId: source.subjectId,
        relevanceScore: source.relevanceScore,
      },
    });
  }

  const revisionSheet = await tx.revisionSheet.upsert({
    where: { documentId: fixtures.revisionSheet.documentId },
    create: fixtures.revisionSheet,
    update: {
      subjectId: fixtures.revisionSheet.subjectId,
      studentId: fixtures.revisionSheet.studentId,
      status: fixtures.revisionSheet.status,
      title: fixtures.revisionSheet.title,
      introduction: fixtures.revisionSheet.introduction,
      keyPoints: fixtures.revisionSheet.keyPoints,
      commonMistakes: fixtures.revisionSheet.commonMistakes,
      mustKnow: fixtures.revisionSheet.mustKnow,
      practiceSuggestions: fixtures.revisionSheet.practiceSuggestions,
      generatedAt: fixtures.revisionSheet.generatedAt,
      flowName: fixtures.revisionSheet.flowName,
      provider: fixtures.revisionSheet.provider,
      model: fixtures.revisionSheet.model,
      promptVersion: fixtures.revisionSheet.promptVersion,
      schemaVersion: fixtures.revisionSheet.schemaVersion,
      inputSize: fixtures.revisionSheet.inputSize,
      sourceStrategy: fixtures.revisionSheet.sourceStrategy,
      errorCode: fixtures.revisionSheet.errorCode,
    },
  });
  for (const section of fixtures.revisionSheetSections) {
    await tx.revisionSheetSection.upsert({
      where: { id: section.id },
      create: {
        ...section,
        revisionSheetId: revisionSheet.id,
      },
      update: {
        revisionSheetId: revisionSheet.id,
        subjectId: section.subjectId,
        displayOrder: section.displayOrder,
        title: section.title,
        content: section.content,
      },
    });
  }

  for (const source of fixtures.revisionSheetSectionSources) {
    await tx.revisionSheetSectionSource.upsert({
      where: {
        sectionId_chunkId: {
          sectionId: source.sectionId,
          chunkId: source.chunkId,
        },
      },
      create: source,
      update: {
        subjectId: source.subjectId,
        relevanceScore: source.relevanceScore,
      },
    });
  }

  await tx.activitySession.upsert({
    where: { id: fixtures.richClosedActivitySession.id },
    create: fixtures.richClosedActivitySession,
    update: {
      studentId: fixtures.richClosedActivitySession.studentId,
      subjectId: fixtures.richClosedActivitySession.subjectId,
      knowledgeUnitId: fixtures.richClosedActivitySession.knowledgeUnitId,
      documentId: fixtures.richClosedActivitySession.documentId,
      version: fixtures.richClosedActivitySession.version,
      type: fixtures.richClosedActivitySession.type,
      status: fixtures.richClosedActivitySession.status,
      generationFlowName: fixtures.richClosedActivitySession.generationFlowName,
      generationProvider: fixtures.richClosedActivitySession.generationProvider,
      generationModel: fixtures.richClosedActivitySession.generationModel,
      generationPromptVersion:
        fixtures.richClosedActivitySession.generationPromptVersion,
      generationSchemaVersion:
        fixtures.richClosedActivitySession.generationSchemaVersion,
      generationInputSize:
        fixtures.richClosedActivitySession.generationInputSize,
    },
  });

  await tx.richClosedExercisePayload.upsert({
    where: {
      activitySessionId: fixtures.richClosedExercisePayload.activitySessionId,
    },
    create: fixtures.richClosedExercisePayload,
    update: {
      version: fixtures.richClosedExercisePayload.version,
      title: fixtures.richClosedExercisePayload.title,
      subjectId: fixtures.richClosedExercisePayload.subjectId,
      documentId: fixtures.richClosedExercisePayload.documentId,
      knowledgeUnitId: fixtures.richClosedExercisePayload.knowledgeUnitId,
      exercisePayload: fixtures.richClosedExercisePayload.exercisePayload,
      generationMetadata: fixtures.richClosedExercisePayload.generationMetadata,
      qualityMetrics: fixtures.richClosedExercisePayload.qualityMetrics,
    },
  });
}

function printSeedSummary(input: {
  mode: 'dry-run' | 'write';
  databaseUrl: string;
  firebaseUid: string;
  fixtures: DemoSeedFixtures;
  deletePlan: ReturnType<typeof buildDemoSeedPlan>['deletePlan'];
}): void {
  const summary = {
    mode: input.mode,
    databaseUrl: maskDatabaseUrl(input.databaseUrl),
    firebaseUid: maskFirebaseUid(input.firebaseUid),
    subjectId: input.fixtures.subject.id,
    documentId: input.fixtures.document.id,
    chunks: input.fixtures.chunks.length,
    knowledgeUnits: input.fixtures.knowledgeUnits.length,
    masteryStates: input.fixtures.masteryStates.length,
    summaryId: input.fixtures.summary.id,
    revisionSheetId: input.fixtures.revisionSheet.id,
    richClosedSessionId: input.fixtures.richClosedActivitySession.id,
    richClosedExerciseId:
      input.fixtures.richClosedExercisePayload.exercisePayload.id,
    richClosedQuestionKinds:
      input.fixtures.richClosedExercisePayload.exercisePayload.questions.map(
        (question) => question.questionKind,
      ),
    deletePlan: input.deletePlan,
  };

  console.log(JSON.stringify(summary, null, 2));
}

function maskFirebaseUid(firebaseUid: string): string {
  if (firebaseUid.length <= 8) {
    return '***';
  }

  return `${firebaseUid.slice(0, 4)}***${firebaseUid.slice(-4)}`;
}

type TransactionClient = any;

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Demo seed failed: ${message}`);
  process.exitCode = 1;
});

```

### src/modules/demo-seed/demo-seed.fixtures.ts

```ts
import { richClosedExerciseFixture } from '../activities/application/rich-closed-questions/rich-closed-question.fixtures';
import type {
  RichClosedExercise,
  RichClosedQuestion,
} from '../activities/application/rich-closed-questions/rich-closed-question.types';

type DemoSeedEnv = {
  NODE_ENV?: string;
  DEMO_SEED_CONFIRM?: string;
  DEMO_FIREBASE_UID?: string;
  DEMO_STUDENT_FIREBASE_UID?: string;
  DEMO_STUDENT_EMAIL?: string;
  DEMO_STUDENT_DISPLAY_NAME?: string;
  DEMO_SEED_DRY_RUN?: string;
};

export type DemoSeedRuntimeOptions = {
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  dryRun: boolean;
};

export type DemoSeedSubjectFixture = {
  id: string;
  studentId: string;
  name: string;
  priority: number;
};

export type DemoSeedDocumentFixture = {
  id: string;
  studentId: string;
  subjectId: string;
  kind: 'COURSE_PDF';
  fileName: string;
  storagePath: string;
  mimeType: 'application/pdf';
  status: 'READY';
};

export type DemoSeedChunkFixture = {
  id: string;
  documentId: string;
  subjectId: string;
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
  pageNumber: number;
};

export type DemoSeedKnowledgeUnitFixture = {
  id: string;
  subjectId: string;
  documentId: string;
  title: string;
  summary: string;
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH';
  displayOrder: number;
  confidence: number;
  extractionPromptVersion: string;
  extractionSchemaVersion: string;
};

export type DemoSeedKnowledgeUnitSourceFixture = {
  knowledgeUnitId: string;
  subjectId: string;
  chunkId: string;
  relevanceScore: number;
};

export type DemoSeedRevisionGoalFixture = {
  id: string;
  studentId: string;
  targetDate: Date;
  weeklyMinutes: number;
};

export type DemoSeedMasteryStateFixture = {
  studentId: string;
  subjectId: string;
  knowledgeUnitId: string;
  score: number;
  lastPracticedAt: Date | null;
};

export type DemoSeedSummaryFixture = {
  id: string;
  documentId: string;
  subjectId: string;
  studentId: string;
  status: 'READY';
  title: string;
  content: string;
  keyPoints: string[];
  limits: string;
  generatedAt: Date;
  flowName: string;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  inputSize: number;
  sourceStrategy: 'DOCUMENT_CHUNKS';
  errorCode: null;
};

export type DemoSeedSummarySourceFixture = {
  summaryId: string;
  subjectId: string;
  chunkId: string;
  relevanceScore: number;
};

export type DemoSeedRevisionSheetFixture = {
  id: string;
  documentId: string;
  subjectId: string;
  studentId: string;
  status: 'READY';
  title: string;
  introduction: string;
  keyPoints: string[];
  commonMistakes: string[];
  mustKnow: string[];
  practiceSuggestions: string[];
  generatedAt: Date;
  flowName: string;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  inputSize: number;
  sourceStrategy: 'DOCUMENT_CHUNKS';
  errorCode: null;
};

export type DemoSeedRevisionSheetSectionFixture = {
  id: string;
  revisionSheetId: string;
  subjectId: string;
  displayOrder: number;
  title: string;
  content: string;
};

export type DemoSeedRevisionSheetSectionSourceFixture = {
  sectionId: string;
  subjectId: string;
  chunkId: string;
  relevanceScore: number;
};

export type DemoSeedRichClosedActivitySessionFixture = {
  id: string;
  studentId: string;
  subjectId: string;
  knowledgeUnitId: string;
  documentId: string;
  version: number;
  type: 'RICH_CLOSED_EXERCISE';
  status: 'STARTED';
  generationFlowName: string;
  generationProvider: string;
  generationModel: string;
  generationPromptVersion: string;
  generationSchemaVersion: string;
  generationInputSize: number;
};

export type DemoSeedRichClosedExercisePayloadFixture = {
  id: string;
  activitySessionId: string;
  version: string;
  title: string;
  subjectId: string;
  documentId: string;
  knowledgeUnitId: string;
  exercisePayload: RichClosedExercise;
  generationMetadata: {
    flowName: string;
    provider: string;
    model: string;
    promptVersion: string;
    schemaVersion: string;
    inputSize: number;
  };
  qualityMetrics: {
    accepted: true;
    questionKinds: string[];
    sourceChunkIds: string[];
  };
};

export type DemoSeedFixtures = {
  subject: DemoSeedSubjectFixture;
  document: DemoSeedDocumentFixture;
  chunks: DemoSeedChunkFixture[];
  knowledgeUnits: DemoSeedKnowledgeUnitFixture[];
  knowledgeUnitSources: DemoSeedKnowledgeUnitSourceFixture[];
  goal: DemoSeedRevisionGoalFixture;
  masteryStates: DemoSeedMasteryStateFixture[];
  summary: DemoSeedSummaryFixture;
  summarySources: DemoSeedSummarySourceFixture[];
  revisionSheet: DemoSeedRevisionSheetFixture;
  revisionSheetSections: DemoSeedRevisionSheetSectionFixture[];
  revisionSheetSectionSources: DemoSeedRevisionSheetSectionSourceFixture[];
  richClosedActivitySession: DemoSeedRichClosedActivitySessionFixture;
  richClosedExercisePayload: DemoSeedRichClosedExercisePayloadFixture;
};

export const demoSeedIds = {
  subjectId: 'demo-subject-droit-constitutionnel',
  documentId: 'demo-document-constitution-veme',
  goalId: 'demo-revision-goal-constitution',
  summaryId: 'demo-summary-constitution',
  revisionSheetId: 'demo-sheet-constitution',
  richClosedActivitySessionId: 'demo-rich-closed-session-regime-parlementaire',
  richClosedExercisePayloadId: 'demo-rich-closed-payload-regime-parlementaire',
  richClosedExerciseId: 'demo-rich-closed-exercise-regime-parlementaire-v1a',
  chunkIds: [
    'demo-chunk-constitution-001',
    'demo-chunk-constitution-002',
    'demo-chunk-constitution-003',
    'demo-chunk-constitution-004',
    'demo-chunk-constitution-005',
    'demo-chunk-constitution-006',
  ],
  knowledgeUnitIds: {
    separationPowers: 'demo-ku-separation-pouvoirs',
    constitutionalReview: 'demo-ku-controle-constitutionnalite',
    rationalizedParliamentary: 'demo-ku-regime-parlementaire',
    governmentResponsibility: 'demo-ku-responsabilite-gouvernement',
    nationalSovereignty: 'demo-ku-souverainete-nationale',
    presidentialPowers: 'demo-ku-pouvoirs-president',
  },
};

const demoSeedVersion = 'demo-seed-v1';

export function buildDemoSeedRuntimeOptions(input: {
  env: DemoSeedEnv;
  argv: string[];
}): DemoSeedRuntimeOptions {
  if (input.env.NODE_ENV === 'production') {
    throw new Error('Demo seed is not allowed with NODE_ENV=production');
  }

  if (input.env.DEMO_SEED_CONFIRM !== 'revision-demo') {
    throw new Error('DEMO_SEED_CONFIRM=revision-demo is required');
  }

  const firebaseUid = (
    input.env.DEMO_FIREBASE_UID ??
    input.env.DEMO_STUDENT_FIREBASE_UID ??
    ''
  ).trim();

  if (!firebaseUid) {
    throw new Error(
      'DEMO_FIREBASE_UID or DEMO_STUDENT_FIREBASE_UID is required',
    );
  }

  return {
    firebaseUid,
    email: trimOptional(input.env.DEMO_STUDENT_EMAIL),
    displayName: trimOptional(input.env.DEMO_STUDENT_DISPLAY_NAME),
    dryRun:
      input.argv.includes('--dry-run') || input.env.DEMO_SEED_DRY_RUN === '1',
  };
}

export function buildDemoSeedFixtures(input: {
  studentId: string;
  now: Date;
}): DemoSeedFixtures {
  const chunks = buildChunks();
  const knowledgeUnits = buildKnowledgeUnits();
  const generatedAt = new Date(input.now);

  return {
    subject: {
      id: demoSeedIds.subjectId,
      studentId: input.studentId,
      name: 'Droit constitutionnel — Ve République',
      priority: 5,
    },
    document: {
      id: demoSeedIds.documentId,
      studentId: input.studentId,
      subjectId: demoSeedIds.subjectId,
      kind: 'COURSE_PDF',
      fileName: 'demo-droit-constitutionnel-veme-republique.pdf',
      storagePath: 'demo://droit-constitutionnel-veme-republique',
      mimeType: 'application/pdf',
      status: 'READY',
    },
    chunks,
    knowledgeUnits,
    knowledgeUnitSources: buildKnowledgeUnitSources(),
    goal: {
      id: demoSeedIds.goalId,
      studentId: input.studentId,
      targetDate: daysAfter(input.now, 30),
      weeklyMinutes: 240,
    },
    masteryStates: buildMasteryStates(input.studentId, input.now),
    summary: buildSummary(input.studentId, generatedAt),
    summarySources: [
      summarySource(0, 0.92),
      summarySource(1, 0.88),
      summarySource(2, 0.86),
      summarySource(3, 0.82),
    ],
    revisionSheet: buildRevisionSheet(input.studentId, generatedAt),
    revisionSheetSections: buildRevisionSheetSections(),
    revisionSheetSectionSources: buildRevisionSheetSectionSources(),
    richClosedActivitySession: buildRichClosedActivitySession(input.studentId),
    richClosedExercisePayload: buildRichClosedExercisePayload(),
  };
}

export function buildDemoSeedPlan(fixtures: DemoSeedFixtures) {
  return {
    fixtures,
    deletePlan: {
      revisionSheetSectionIds: fixtures.revisionSheetSections.map(
        (section) => section.id,
      ),
      revisionSheetIds: [fixtures.revisionSheet.id],
      summaryIds: [fixtures.summary.id],
      richClosedExercisePayloadIds: [fixtures.richClosedExercisePayload.id],
      richClosedActivitySessionIds: [fixtures.richClosedActivitySession.id],
      revisionGoalIds: [fixtures.goal.id],
      knowledgeUnitIds: fixtures.knowledgeUnits.map((unit) => unit.id),
      chunkIds: fixtures.chunks.map((chunk) => chunk.id),
      documentIds: [fixtures.document.id],
      subjectIds: [fixtures.subject.id],
    },
  };
}

export function maskDatabaseUrl(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return '<invalid-database-url>';
  }
}

function trimOptional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function daysAfter(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function daysBefore(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

function buildChunks(): DemoSeedChunkFixture[] {
  const texts = [
    'La séparation des pouvoirs distingue les fonctions législative, exécutive et juridictionnelle. Dans la Ve République, cette séparation est organisée mais reste souple afin de permettre la coopération entre institutions.',
    'Le gouvernement est politiquement responsable devant l’Assemblée nationale. La motion de censure et la question de confiance encadrent cette responsabilité et structurent les rapports entre exécutif et Parlement.',
    'Le Conseil constitutionnel contrôle la conformité des lois à la Constitution. Ce contrôle protège la hiérarchie des normes et limite les atteintes aux droits et libertés constitutionnellement garantis.',
    'La rationalisation du parlementarisme encadre la procédure législative et les moyens de contrôle du Parlement. Elle vise à stabiliser l’action gouvernementale tout en maintenant une responsabilité politique.',
    'La souveraineté nationale s’exprime par le suffrage et par la représentation. Le peuple délègue l’exercice du pouvoir à des représentants, tout en conservant une place centrale dans la légitimité des institutions.',
    'Le Président de la République dispose de pouvoirs propres et de pouvoirs partagés. Son rôle varie selon la majorité parlementaire et l’équilibre politique entre le chef de l’État, le gouvernement et le Parlement.',
  ];

  let cursor = 0;

  return texts.map((text, index) => {
    const charStart = cursor;
    const charEnd = cursor + text.length;
    cursor = charEnd + 1;

    return {
      id: demoSeedIds.chunkIds[index],
      documentId: demoSeedIds.documentId,
      subjectId: demoSeedIds.subjectId,
      index,
      text,
      charStart,
      charEnd,
      pageNumber: index + 1,
    };
  });
}

function buildKnowledgeUnits(): DemoSeedKnowledgeUnitFixture[] {
  return [
    unit({
      id: demoSeedIds.knowledgeUnitIds.separationPowers,
      title: 'Séparation des pouvoirs',
      summary:
        'Principe d’organisation qui distingue les fonctions de l’État tout en permettant leur collaboration.',
      difficulty: 'LOW',
      displayOrder: 0,
      confidence: 0.96,
    }),
    unit({
      id: demoSeedIds.knowledgeUnitIds.constitutionalReview,
      title: 'Contrôle de constitutionnalité',
      summary:
        'Contrôle exercé pour vérifier qu’une loi respecte la Constitution et les droits protégés.',
      difficulty: 'MEDIUM',
      displayOrder: 1,
      confidence: 0.93,
    }),
    unit({
      id: demoSeedIds.knowledgeUnitIds.rationalizedParliamentary,
      title: 'Régime parlementaire rationalisé',
      summary:
        'Ensemble de mécanismes qui stabilisent le gouvernement et organisent les rapports avec le Parlement.',
      difficulty: 'HIGH',
      displayOrder: 2,
      confidence: 0.91,
    }),
    unit({
      id: demoSeedIds.knowledgeUnitIds.governmentResponsibility,
      title: 'Responsabilité politique du gouvernement',
      summary:
        'Principe selon lequel le gouvernement peut être renversé par l’Assemblée nationale selon des procédures encadrées.',
      difficulty: 'MEDIUM',
      displayOrder: 3,
      confidence: 0.9,
    }),
    unit({
      id: demoSeedIds.knowledgeUnitIds.nationalSovereignty,
      title: 'Souveraineté nationale',
      summary:
        'Fondement de la légitimité démocratique exercée par le suffrage et la représentation.',
      difficulty: 'LOW',
      displayOrder: 4,
      confidence: 0.94,
    }),
    unit({
      id: demoSeedIds.knowledgeUnitIds.presidentialPowers,
      title: 'Pouvoirs du Président',
      summary:
        'Compétences propres et partagées du Président, variables selon le contexte majoritaire.',
      difficulty: 'MEDIUM',
      displayOrder: 5,
      confidence: 0.92,
    }),
  ];
}

function unit(input: {
  id: string;
  title: string;
  summary: string;
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH';
  displayOrder: number;
  confidence: number;
}): DemoSeedKnowledgeUnitFixture {
  return {
    id: input.id,
    subjectId: demoSeedIds.subjectId,
    documentId: demoSeedIds.documentId,
    title: input.title,
    summary: input.summary,
    difficulty: input.difficulty,
    displayOrder: input.displayOrder,
    confidence: input.confidence,
    extractionPromptVersion: demoSeedVersion,
    extractionSchemaVersion: demoSeedVersion,
  };
}

function buildKnowledgeUnitSources(): DemoSeedKnowledgeUnitSourceFixture[] {
  return [
    source(demoSeedIds.knowledgeUnitIds.separationPowers, 0, 0.95),
    source(demoSeedIds.knowledgeUnitIds.governmentResponsibility, 1, 0.94),
    source(demoSeedIds.knowledgeUnitIds.constitutionalReview, 2, 0.96),
    source(demoSeedIds.knowledgeUnitIds.rationalizedParliamentary, 3, 0.93),
    source(demoSeedIds.knowledgeUnitIds.nationalSovereignty, 4, 0.94),
    source(demoSeedIds.knowledgeUnitIds.presidentialPowers, 5, 0.92),
    source(demoSeedIds.knowledgeUnitIds.rationalizedParliamentary, 1, 0.81),
  ];
}

function source(
  knowledgeUnitId: string,
  chunkIndex: number,
  relevanceScore: number,
): DemoSeedKnowledgeUnitSourceFixture {
  return {
    knowledgeUnitId,
    subjectId: demoSeedIds.subjectId,
    chunkId: demoSeedIds.chunkIds[chunkIndex],
    relevanceScore,
  };
}

function buildMasteryStates(
  studentId: string,
  now: Date,
): DemoSeedMasteryStateFixture[] {
  return [
    mastery(
      studentId,
      demoSeedIds.knowledgeUnitIds.separationPowers,
      0.2,
      daysBefore(now, 16),
    ),
    mastery(
      studentId,
      demoSeedIds.knowledgeUnitIds.constitutionalReview,
      0.55,
      daysBefore(now, 8),
    ),
    mastery(
      studentId,
      demoSeedIds.knowledgeUnitIds.rationalizedParliamentary,
      0.75,
      daysBefore(now, 2),
    ),
    mastery(
      studentId,
      demoSeedIds.knowledgeUnitIds.governmentResponsibility,
      0.35,
      null,
    ),
  ];
}

function mastery(
  studentId: string,
  knowledgeUnitId: string,
  score: number,
  lastPracticedAt: Date | null,
): DemoSeedMasteryStateFixture {
  return {
    studentId,
    subjectId: demoSeedIds.subjectId,
    knowledgeUnitId,
    score,
    lastPracticedAt,
  };
}

function buildSummary(
  studentId: string,
  generatedAt: Date,
): DemoSeedSummaryFixture {
  return {
    id: demoSeedIds.summaryId,
    documentId: demoSeedIds.documentId,
    subjectId: demoSeedIds.subjectId,
    studentId,
    status: 'READY',
    title: 'Synthèse demo — Ve République',
    content:
      'La Ve République combine un exécutif fort, un Parlement encadré et des mécanismes de contrôle constitutionnel. La séparation des pouvoirs reste centrale, mais elle s’exprime dans un régime parlementaire rationalisé.',
    keyPoints: [
      'Séparation des pouvoirs organisée et souple.',
      'Responsabilité politique du gouvernement devant l’Assemblée nationale.',
      'Contrôle de constitutionnalité comme garantie normative.',
      'Président renforcé selon le contexte majoritaire.',
    ],
    limits:
      'Fixture synthétique de démonstration, sans appel IA et sans document PDF réel.',
    generatedAt,
    flowName: 'demoSeedSummary',
    provider: 'demo-seed',
    model: 'demo-fixture',
    promptVersion: demoSeedVersion,
    schemaVersion: demoSeedVersion,
    inputSize: 0,
    sourceStrategy: 'DOCUMENT_CHUNKS',
    errorCode: null,
  };
}

function summarySource(
  chunkIndex: number,
  relevanceScore: number,
): DemoSeedSummarySourceFixture {
  return {
    summaryId: demoSeedIds.summaryId,
    subjectId: demoSeedIds.subjectId,
    chunkId: demoSeedIds.chunkIds[chunkIndex],
    relevanceScore,
  };
}

function buildRevisionSheet(
  studentId: string,
  generatedAt: Date,
): DemoSeedRevisionSheetFixture {
  return {
    id: demoSeedIds.revisionSheetId,
    documentId: demoSeedIds.documentId,
    subjectId: demoSeedIds.subjectId,
    studentId,
    status: 'READY',
    title: 'Fiche demo — Droit constitutionnel',
    introduction:
      'Cette fiche de démonstration résume les notions clés pour tester les parcours de révision sans IA.',
    keyPoints: [
      'Identifier les fonctions de l’État.',
      'Relier responsabilité gouvernementale et parlementarisme.',
      'Comprendre le rôle du Conseil constitutionnel.',
    ],
    commonMistakes: [
      'Confondre séparation stricte et séparation souple des pouvoirs.',
      'Oublier que le gouvernement reste responsable devant l’Assemblée nationale.',
    ],
    mustKnow: [
      'Motion de censure.',
      'Contrôle de constitutionnalité.',
      'Rationalisation du parlementarisme.',
    ],
    practiceSuggestions: [
      'Faire un QCM ciblé sur les pouvoirs.',
      'Répondre à une question ouverte sur la responsabilité politique.',
    ],
    generatedAt,
    flowName: 'demoSeedRevisionSheet',
    provider: 'demo-seed',
    model: 'demo-fixture',
    promptVersion: demoSeedVersion,
    schemaVersion: demoSeedVersion,
    inputSize: 0,
    sourceStrategy: 'DOCUMENT_CHUNKS',
    errorCode: null,
  };
}

function buildRevisionSheetSections(): DemoSeedRevisionSheetSectionFixture[] {
  return [
    {
      id: 'demo-sheet-section-constitution-001',
      revisionSheetId: demoSeedIds.revisionSheetId,
      subjectId: demoSeedIds.subjectId,
      displayOrder: 0,
      title: 'Institutions et séparation des pouvoirs',
      content:
        'La Ve République distingue les fonctions institutionnelles tout en prévoyant des interactions constantes entre exécutif, Parlement et juge constitutionnel.',
    },
    {
      id: 'demo-sheet-section-constitution-002',
      revisionSheetId: demoSeedIds.revisionSheetId,
      subjectId: demoSeedIds.subjectId,
      displayOrder: 1,
      title: 'Parlementarisme rationalisé',
      content:
        'Les mécanismes de responsabilité et de procédure cherchent à éviter l’instabilité gouvernementale tout en conservant un contrôle parlementaire.',
    },
    {
      id: 'demo-sheet-section-constitution-003',
      revisionSheetId: demoSeedIds.revisionSheetId,
      subjectId: demoSeedIds.subjectId,
      displayOrder: 2,
      title: 'Contrôle constitutionnel',
      content:
        'Le Conseil constitutionnel garantit la conformité des lois aux normes constitutionnelles et protège les libertés fondamentales.',
    },
  ];
}

function buildRevisionSheetSectionSources(): DemoSeedRevisionSheetSectionSourceFixture[] {
  return [
    sectionSource('demo-sheet-section-constitution-001', 0, 0.94),
    sectionSource('demo-sheet-section-constitution-002', 3, 0.92),
    sectionSource('demo-sheet-section-constitution-003', 2, 0.93),
  ];
}

function sectionSource(
  sectionId: string,
  chunkIndex: number,
  relevanceScore: number,
): DemoSeedRevisionSheetSectionSourceFixture {
  return {
    sectionId,
    subjectId: demoSeedIds.subjectId,
    chunkId: demoSeedIds.chunkIds[chunkIndex],
    relevanceScore,
  };
}

function buildRichClosedActivitySession(
  studentId: string,
): DemoSeedRichClosedActivitySessionFixture {
  return {
    id: demoSeedIds.richClosedActivitySessionId,
    studentId,
    subjectId: demoSeedIds.subjectId,
    knowledgeUnitId: demoSeedIds.knowledgeUnitIds.rationalizedParliamentary,
    documentId: demoSeedIds.documentId,
    version: 1,
    type: 'RICH_CLOSED_EXERCISE',
    status: 'STARTED',
    generationFlowName: 'demoSeedRichClosedExercise',
    generationProvider: 'demo-seed',
    generationModel: 'demo-fixture',
    generationPromptVersion: demoSeedVersion,
    generationSchemaVersion: demoSeedVersion,
    generationInputSize: 0,
  };
}

function buildRichClosedExercisePayload(): DemoSeedRichClosedExercisePayloadFixture {
  const exercise = buildRichClosedExercise();
  const sourceChunkIds = Array.from(
    new Set(exercise.questions.flatMap((question) => question.sourceChunkIds)),
  );

  return {
    id: demoSeedIds.richClosedExercisePayloadId,
    activitySessionId: demoSeedIds.richClosedActivitySessionId,
    version: exercise.version,
    title: exercise.title,
    subjectId: demoSeedIds.subjectId,
    documentId: demoSeedIds.documentId,
    knowledgeUnitId: demoSeedIds.knowledgeUnitIds.rationalizedParliamentary,
    exercisePayload: exercise,
    generationMetadata: {
      flowName: 'demoSeedRichClosedExercise',
      provider: 'demo-seed',
      model: 'demo-fixture',
      promptVersion: demoSeedVersion,
      schemaVersion: demoSeedVersion,
      inputSize: 0,
    },
    qualityMetrics: {
      accepted: true,
      questionKinds: exercise.questions.map(
        (question) => question.questionKind,
      ),
      sourceChunkIds,
    },
  };
}

function buildRichClosedExercise(): RichClosedExercise {
  const exercise = richClosedExerciseFixture();

  return {
    ...exercise,
    id: demoSeedIds.richClosedExerciseId,
    title: 'Régime parlementaire rationalisé — exercice fermé riche V1-A',
    subjectId: demoSeedIds.subjectId,
    documentId: demoSeedIds.documentId,
    knowledgeUnitId: demoSeedIds.knowledgeUnitIds.rationalizedParliamentary,
    questions: exercise.questions.map((question) =>
      withDemoSources(question, demoSourcesForQuestion(question.questionKind)),
    ),
  };
}

function demoSourcesForQuestion(
  questionKind: RichClosedQuestion['questionKind'],
): string[] {
  switch (questionKind) {
    case 'single_choice':
    case 'multiple_choice':
    case 'case_qualification':
      return [demoSeedIds.chunkIds[1], demoSeedIds.chunkIds[3]];
    case 'matching':
    case 'ordering':
      return [demoSeedIds.chunkIds[3]];
    case 'error_detection':
      return [demoSeedIds.chunkIds[1]];
  }
}

function withDemoSources(
  question: RichClosedQuestion,
  sourceChunkIds: string[],
): RichClosedQuestion {
  return {
    ...question,
    sourceChunkIds,
  };
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
import { richClosedExerciseFixture } from '../src/modules/activities/application/rich-closed-questions/rich-closed-question.fixtures';
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
import { GetRevisionSessionUseCase } from '../src/modules/revision-sessions/application/get-revision-session.use-case';
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
    requestNextAction: {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    },
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

function richClosedResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-1',
    exercise: richClosedExerciseFixture(),
    answers: richClosedAnswers(),
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

function replaceRichClosedAnswer(answer: RichClosedAnswer): RichClosedAnswer[] {
  return richClosedAnswers().map((currentAnswer) =>
    currentAnswer.questionId === answer.questionId ? answer : currentAnswer,
  );
}

function revisionSessionResponse() {
  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
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

function richClosedRevisionSessionResponse() {
  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
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
  'answersPayload',
  'storagePath',
  'promptVersion',
  'completion',
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
