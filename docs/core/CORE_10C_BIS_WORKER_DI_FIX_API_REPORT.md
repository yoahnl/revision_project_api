# CORE-10C-bis — Worker DI fix API report

## Diagnostic exact

CORE-10C a correctement extrait les accès question bank derrière `QUESTION_BANK_REPOSITORY`, mais `JobsModule` instancie son graphe worker question bank localement.

`ActivitiesModule` déclarait bien :

```text
QUESTION_BANK_REPOSITORY -> PrismaQuestionBankRepository
```

mais le provider local du worker `course-question-bank-preparation` ne déclarait pas ce token. En runtime, avec le worker activé, Nest pouvait donc échouer à résoudre `QuestionBankService`.

## Cause racine

`QuestionBankService` dépend maintenant de trois tokens applicatifs :

```text
QUESTION_BANK_REPOSITORY
ACTIVITIES_REPOSITORY
DIAGNOSTIC_QUIZ_GENERATOR
```

`JobsModule` déclarait seulement :

```text
ACTIVITIES_REPOSITORY -> PrismaActivitiesRepository
DIAGNOSTIC_QUIZ_GENERATOR -> GenkitDiagnosticQuizGenerator
```

Le nouveau token `QUESTION_BANK_REPOSITORY` manquait dans le graphe worker.

## Correction appliquée

Correction minimale dans :

```text
src/modules/jobs/jobs.module.ts
```

Ajout du binding local :

```text
QUESTION_BANK_REPOSITORY -> PrismaQuestionBankRepository
```

Le tableau des providers worker question bank a été factorisé dans :

```text
buildCourseQuestionBankPreparationConsumerProviders({ enabled })
```

Cette fonction est exportée uniquement pour rendre le graphe testable sans forcer BullMQ ni contourner `NODE_ENV=test`.

## Preuve du graphe worker

Le test vérifie que lorsque le worker est activé, les providers contiennent :

```text
QUESTION_BANK_REPOSITORY -> PrismaQuestionBankRepository
ACTIVITIES_REPOSITORY -> PrismaActivitiesRepository
DIAGNOSTIC_QUIZ_GENERATOR -> GenkitDiagnosticQuizGenerator
COURSE_QUESTION_BANK_PREPARATION_REPOSITORY -> PrismaCourseQuestionBankPreparationRepository
QuestionBankService
ProcessCourseQuestionBankPreparationJobUseCase
CourseQuestionBankPreparationConsumer
```

Le test rouge initial échouait avec :

```text
TypeError: buildCourseQuestionBankPreparationConsumerProviders is not a function
```

Après correction, le test passe.

## Tests ajoutés ou modifiés

Modifié :

```text
src/modules/jobs/jobs.module.spec.ts
```

Test ajouté :

```text
registers all question bank worker dependencies when the worker is enabled
```

Ce test aurait détecté le binding manquant avant le déploiement du worker.

## Validations exécutées

```bash
npx prettier --write src/modules/jobs/jobs.module.ts src/modules/jobs/jobs.module.spec.ts
```

Résultat : PASS, fichiers inchangés après format.

```bash
npm run build
```

Résultat : PASS.

```bash
npm run lint:check
```

Résultat : PASS.

```bash
npm test -- jobs.module --runInBand
```

Résultat : PASS, 1 suite, 4 tests.

```bash
npm test -- question-bank --runInBand
```

Résultat : PASS, 7 suites, 38 tests.

```bash
npm test -- process-course-question-bank-preparation-job --runInBand
```

Résultat : PASS, 1 suite, 6 tests.

```bash
npm test -- activities --runInBand
```

Résultat : PASS, 21 suites passées, 1 suite skipped, 365 tests passés, 1 test skipped.

```bash
npm test -- courses --runInBand
```

Résultat : PASS, 14 suites, 119 tests.

```bash
npm test -- --runInBand
```

Résultat : PASS, 99 suites passées, 1 suite skipped, 842 tests passés, 1 test skipped.

```bash
git diff --check
```

Résultat : PASS.

Prisma n'a pas été exécuté car le schéma et le client Prisma n'ont pas été modifiés.

## Vérifications complémentaires

Commande :

```bash
rg -n "PrismaService|this\\.prisma|Prisma\\." src/modules/activities/application/question-bank.service.ts src/modules/activities/application/question-bank.repository.ts
```

Résultat : aucune occurrence.

Commande :

```bash
rg -n "QUESTION_BANK_REPOSITORY|PrismaQuestionBankRepository|buildCourseQuestionBankPreparationConsumerProviders|QuestionBankService|CourseQuestionBankPreparationConsumer" src/modules/jobs/jobs.module.ts src/modules/jobs/jobs.module.spec.ts src/modules/activities/activities.module.ts
```

Résultat : le binding existe à la fois dans `ActivitiesModule` et dans le provider local testable du worker `JobsModule`.

## Fichiers modifiés

Créé :

- `docs/core/CORE_10C_BIS_WORKER_DI_FIX_API_REPORT.md`

Modifiés :

- `src/modules/jobs/jobs.module.ts`
- `src/modules/jobs/jobs.module.spec.ts`

Repo app :

- aucun fichier modifié.

## Auto-review finale

- Correction strictement limitée au DI worker question bank.
- Aucun endpoint public modifié.
- Aucun code Flutter modifié.
- Aucun prompt IA modifié.
- Aucun provider IA modifié.
- Aucun import de `ActivitiesModule` dans `JobsModule`.
- `QuestionBankService` reste découplé de Prisma.
- Quick start ne réintroduit pas de génération IA synchrone.
- Full Jest vert.
- Aucun commit effectué.
