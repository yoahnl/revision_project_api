# CORE-10B — Multi-KU selection & concurrency API report

Date: 2026-06-22

## Résumé

CORE-10B rend le quick course-level compatible avec plusieurs notions d'un même cours. La readiness agrège désormais le pool de questions sur toutes les KUs prêtes, la préparation async peut couvrir plusieurs KUs, et le snapshot quick répartit les questions de façon simple entre notions.

## Sub-agents / passes

- API Audit Agent : flow quick et points single-KU audités.
- Question Selection Domain Agent : stratégie V1 round-robin multi-KU.
- Concurrency Agent : réservation optimiste sans nouveau modèle.
- API Implementation Agent : services, repositories, migration et tests.
- App Compatibility Agent : aucun changement Flutter requis.
- QA Agent : tests ciblés, e2e, full Jest.
- Reviewer Agent : scope CORE-10B vérifié, CORE-10C non lancé.

## Stratégie multi-KU

Le backend charge maintenant toutes les KUs exploitables d'un cours via `findReadyQuickRevisionKnowledgeUnitsForCourse`.

La sélection quick :

1. récupère les questions actives des KUs prêtes ;
2. groupe les questions par KU ;
3. sélectionne en round-robin selon l'ordre déterministe du repository ;
4. évite de prendre toutes les questions depuis une seule notion si plusieurs notions sont disponibles.

Si une seule KU existe, le comportement reste équivalent à CORE-10A.

## Readiness multi-KU

`GetCourseQuestionBankReadinessUseCase` compte maintenant les questions avec `knowledgeUnitIds`.

Exemples couverts :

- 3 KUs avec un total suffisant -> `READY`;
- total insuffisant + job actif -> `PREPARING`;
- total insuffisant sans job -> `NOT_PREPARED`;
- aucune source READY -> `NO_READY_SOURCE`;
- aucune KU -> `NO_KNOWLEDGE_UNITS`.

## Préparation async multi-KU

`PrepareCourseQuestionBankUseCase` crée/enqueue des jobs de préparation pour les KUs prêtes du cours.

Le worker existant reste inchangé dans son principe : chaque job prépare une KU avec le `QuestionBankService`, sans appel IA dans la requête quick.

## Réservation / concurrence

Aucun modèle `QuestionBankReservation` n'a été ajouté.

La V1 utilise une réservation optimiste :

- lecture des questions actives ;
- sélection équilibrée ;
- update question par question avec garde sur `id`, `studentId`, `askedCount`, `lastAskedAt` et `status`;
- retry court si une question a été modifiée par une autre session.

Cela évite les collisions évidentes sans transaction longue et sans appel IA.

## Changements Prisma

`Question.session` ne référence plus `ActivitySession` via `(sessionId, knowledgeUnitId)`, mais via `sessionId`.

Motif :

- une activité quick peut garder une KU primaire legacy ;
- chaque question peut porter sa propre `knowledgeUnitId`;
- la FK composite empêchait les questions multi-KU dans une même activité.

Migration créée :

```text
prisma/migrations/20260622150000_allow_multi_ku_quick_questions/migration.sql
```

## Changements API

- `QuestionBankService.createCourseQuickDiagnosticQuiz` accepte `knowledgeUnits`.
- `QuestionBankService.countActiveCourseQuickQuestions` accepte `knowledgeUnitIds`.
- `QuestionBankService.reserveQuestions` sélectionne en multi-KU et réserve de manière optimiste.
- `GeneratedDiagnosticQuizQuestion` peut porter `documentId` et `knowledgeUnitId`.
- `PrismaActivitiesRepository.createDiagnosticQuiz` persiste la KU/document par question.
- `SubmitActivityResultUseCase` met à jour la maîtrise par KU réelle des items.
- `CoursesRepository` expose `findReadyQuickRevisionKnowledgeUnitsForCourse`.
- `PrismaCourseQuestionBankPreparationRepository` expose `findLatestForCourse`.

## Changements App

Aucun changement de code Flutter.

Le contrat public CORE-10A reste compatible :

- readiness conserve les mêmes statuts ;
- quick `409 COURSE_QUICK_REVISION_QUESTIONS_PREPARING` reste inchangé ;
- aucune nouvelle page ni UI nécessaire.

## Tests ajoutés/modifiés

- `QuestionBankService` : sélection équilibrée multi-KU et retry de réservation concurrente.
- `StartCourseQuickRevisionSessionUseCase` : pool multi-KU transmis au service question bank.
- `GetCourseQuestionBankReadinessUseCase` : readiness basée sur total multi-KU.
- `PrepareCourseQuestionBankUseCase` : enqueue de jobs par KU.
- `PrismaCoursesRepository` : finder multi-KU actif.
- `PrismaCourseQuestionBankPreparationRepository` : latest job course-level.
- `SubmitActivityResultUseCase` : maîtrise mise à jour par KU réelle.

## Commandes exécutées

```bash
npm test -- question-bank --runInBand
# PASS — 5 suites, 19 tests

npm test -- courses --runInBand
# PASS — 14 suites, 106 tests

npx prisma validate
# PASS — schema valid

npx prisma generate
# PASS — Prisma Client generated

npm run build
# PASS

npm run lint:check
# PASS

npm test -- activities --runInBand
# PASS — 20 suites passed, 1 skipped, 358 tests passed, 1 skipped

npm test -- revision-sessions --runInBand
# PASS — 9 suites, 70 tests

npm test -- jobs --runInBand
# PASS — 7 suites, 18 tests

npm test -- lifecycle --runInBand
# PASS — 4 suites, 16 tests

npm test -- --runInBand
# PASS — 98 suites passed, 1 skipped, 819 tests passed, 1 skipped

npm run test:e2e -- --runInBand
# Première exécution en parallèle du full Jest : timeout isolé sur un test mocké.
# Relance seule : PASS — 2 suites, 34 tests

git diff --check
# PASS — aucune erreur

git status --short --untracked-files=all
# Voir liste des fichiers CORE-10B modifiés/créés dans ce rapport
```

## Recherches statiques

```bash
rg -n "findFirstQuickRevisionKnowledgeUnitForCourseDocument|countActiveCourseQuickQuestions|prepareCourseQuickQuestionBank|createCourseQuickDiagnosticQuiz|reserveQuestions|QuestionBankReservation|QuestionBankItemStatus|knowledgeUnitId" src test --glob '!src/generated/prisma/**'
```

Résultat : occurrences nombreuses attendues dans les flows legacy, tests, relations métier, quick service et repositories. `StartCourseQuickRevisionSessionUseCase` ne dépend plus de `findFirstQuickRevisionKnowledgeUnitForCourseDocument`.

```bash
rg -n "createCourseQuickDiagnosticQuiz|diagnosticQuizGenerator|generate\\(" src/modules/courses src/modules/activities/application/question-bank.service.ts --glob '!src/generated/prisma/**'
```

Résultat : l'appel IA `diagnosticQuizGenerator.generate` reste uniquement dans `prepareCourseQuickQuestionBank` / `ensureQuestionPool`, pas dans le démarrage quick.

## Limitations

- Pas de stratégie adaptative avancée.
- Pas de modèle historique de réservation.
- Le contexte `ActivitySession.knowledgeUnitId` reste une KU primaire legacy.
- La préparation V1 peut préparer plusieurs KUs de manière volontairement généreuse.

## Dette CORE-10C

- Découpler `QuestionBankService`.
- Ajouter métriques qualité/coût.
- Extraire une vraie stratégie de sélection testable en domaine.
- Ajouter observabilité fine sur préparation et réservation.

## Fichiers créés

- `docs/core/CORE_10B_MULTI_KU_SELECTION_CONCURRENCY_AUDIT.md`
- `docs/core/CORE_10B_MULTI_KU_SELECTION_CONCURRENCY_API_REPORT.md`
- `prisma/migrations/20260622150000_allow_multi_ku_quick_questions/migration.sql`
- `src/modules/courses/infrastructure/prisma-course-question-bank-preparation.repository.spec.ts`

## Fichiers modifiés

- `prisma/schema.prisma`
- `src/modules/activities/application/diagnostic-quiz-generator.ts`
- `src/modules/activities/application/question-bank.service.ts`
- `src/modules/activities/application/question-bank.service.spec.ts`
- `src/modules/activities/application/submit-activity-result.use-case.ts`
- `src/modules/activities/application/submit-activity-result.use-case.spec.ts`
- `src/modules/activities/infrastructure/prisma-activities.repository.ts`
- `src/modules/courses/application/course-question-bank-preparation.repository.ts`
- `src/modules/courses/application/course-question-bank-readiness.use-case.ts`
- `src/modules/courses/application/course-question-bank-readiness.use-case.spec.ts`
- `src/modules/courses/application/courses.repository.ts`
- `src/modules/courses/application/start-course-quick-revision-session.use-case.ts`
- `src/modules/courses/application/start-course-quick-revision-session.use-case.spec.ts`
- `src/modules/courses/infrastructure/prisma-course-question-bank-preparation.repository.ts`
- `src/modules/courses/infrastructure/prisma-courses.repository.ts`
- `src/modules/courses/infrastructure/prisma-courses.repository.spec.ts`
- `docs/roadmap/v2/EXECUTION_LOT_TRACKER_V2.md`
- `docs/roadmap/v2/LOT_TRACKER_V2.md`

## Auto-review

- CORE-10A non refait.
- CORE-10C non lancé.
- Aucun provider IA modifié.
- Aucun prompt IA modifié.
- Aucun changement Flutter runtime.
- Quick start ne lance toujours pas de génération IA longue.
- Readiness et préparation restent compatibles avec l'app.
- Aucun commit effectué.

## Critique du prompt

La demande de concurrence pourrait pousser vers un modèle de réservation dédié. Pour CORE-10B, l'option retenue est plus conservatrice : réservation optimiste sans nouveau modèle. C'est cohérent avec le périmètre, mais CORE-10C devra décider si l'on veut une réservation historisée.
