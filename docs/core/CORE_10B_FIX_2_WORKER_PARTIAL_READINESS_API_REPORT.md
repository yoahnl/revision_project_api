# CORE-10B-fix-2 — Worker liveness, partial readiness and API report

## 1. Resume

Ce micro-lot durcit le correctif CORE-10B autour de trois points : readiness partielle, jobs de preparation stale, et observabilite worker/IA.

Le code API est corrige et valide localement. Le lot reste toutefois `BLOCKED` au sens roadmap, car la preuve runtime complete demandee n'est pas disponible : le backend Dokploy actuellement deployee n'inclut pas ce correctif local, et la session Flutter macOS Neralune n'expose pas l'extension Marionette.

## 2. Diagnostic exact

Le cas observe etait :

```text
readyQuestionCount = 9
targetQuestionCount = 10
status = PREPARING
```

La readiness deployee restait bloquee avec des jobs actifs sans preuve de traitement consumer visible. En parallele, l'app pouvait afficher une disponibilite partielle exploitable, mais sans source de verite unique entre action principale, carte quick et selecteur de quantite.

## 3. Causes racines

- La readiness considerait des jobs actifs/failed sans politique de fraicheur.
- Un job `PENDING` ancien ou un `RUNNING` abandonne pouvait maintenir `PREPARING` indefiniment.
- Le repository de preparation ne permettait pas encore une recuperation atomique explicite des jobs `RUNNING` stale.
- Les logs de demarrage JobsModule ne prouvaient pas que le consumer question bank etait effectivement inscrit.
- Les logs worker ne faisaient pas remonter provider/model/fallback IA de maniere correlee au `preparationJobId`.

## 4. Politique jobs stale

Une politique minimale configurable a ete introduite :

```text
COURSE_QUESTION_BANK_PREPARATION_STALE_AFTER_MS
default = 900000 ms
```

La readiness applique cette regle :

```text
READY si readyQuestionCount >= targetQuestionCount
PREPARING si au moins un job actif frais existe
FAILED si au moins un job failed frais existe et aucun job actif frais n'existe
NOT_PREPARED sinon
```

Traitement :

- `PENDING` recent : actif.
- `RUNNING` recent avec `lockedAt` recent : actif.
- `PENDING` stale : ne maintient plus `PREPARING`.
- `RUNNING` stale : recuperable par claim atomique.
- `COMPLETED` : ignore pour le statut.
- `FAILED` stale : n'ecrase plus un etat recuperable.

## 5. Comportement worker

`claimNextPending` accepte maintenant un `staleBefore`.

Le repository Prisma peut reclamer :

- un job `PENDING`;
- un job `RUNNING` dont `lockedAt` est trop ancien.

Le claim reste atomique via `updateMany` conditionnel sur le statut et la fraicheur. Un job stale ne peut donc pas etre "reanime" par deux workers dans le meme chemin nominal.

## 6. Logs worker et runtime

Un logger de configuration runtime a ete ajoute au demarrage du module jobs avec l'evenement :

```text
course_question_bank_worker_runtime_configuration
```

Champs logs sans secret :

- `nodeEnv`;
- `queueDisabled`;
- `questionBankWorkerEnabled`;
- `redisConfigured`;
- `redisConnectionMode`;
- `consumerRegistered`.

Le consumer loggue aussi son initialisation effective :

```text
course_question_bank_worker_started
```

Les logs n'exposent pas d'URL Redis complete, mot de passe, prompt, texte de cours, chunks, reponse IA complete, token Firebase ou contenu personnel.

## 7. Observabilite IA

Le chemin de generation transporte maintenant un `correlationId` equivalent au `preparationJobId`.

Les metriques internes de preparation incluent :

- `aiGenerations`;
- `provider`;
- `model`;
- `fallbackUsed`;
- `generatedCount`;
- `persistedCount`.

Le worker transmet ces metriques dans son evenement de completion. Les logs du generateur contiennent aussi le `correlationId`, ce qui permet de relier :

```text
worker -> generation IA -> persistence -> completion
```

## 8. Contrat API final

Le contrat public reste inchange :

```http
GET /courses/:courseId/question-bank/readiness?questionCount=X
POST /courses/:courseId/question-bank/prepare
POST /courses/:courseId/revision-sessions/quick
```

Les statuts publics restent :

```text
NO_READY_SOURCE
NO_KNOWLEDGE_UNITS
NOT_PREPARED
PREPARING
READY
FAILED
```

La readiness reste course-level et target-aware via `questionCount`.

## 9. Dokploy MCP

MCP Dokploy disponible.

Resultats exploitables :

- application backend identifiee : `backEnd`;
- application id utilisee : `anJtJajEdotxzlbqyA9ob`;
- logs applicatifs lisibles via `application.readLogs` sans filtre;
- les recherches filtrees `application.readLogs` avec `search` ont retourne une erreur 500 cote outil;
- le tail brut montre encore des readiness `9/10` en `PREPARING` avec `activeJobCount=5`;
- aucun evenement `course_question_bank_worker_runtime_configuration` ou `course_question_bank_worker_started` n'apparait dans le tail brut consulte, car le backend deployee ne contient pas le correctif local fix-2.

Aucune variable secrete ou URL credentialee n'est reportee dans ce document.

Aucune modification Dokploy n'a ete effectuee.

Conclusion Dokploy : preuve runtime incomplete. Le backend deployee doit recevoir ce correctif avant de pouvoir valider worker liveness, provider/model correles et passage effectif `9/10 -> 10/10`.

## 10. Marionette macOS

Marionette est disponible.

Une app Flutter macOS Neralune est bien lancee en debug :

```text
Package: Neralune
VM service: ws://127.0.0.1:55354/.../ws
```

Connexion Marionette tentee :

```text
ws://127.0.0.1:55354/QiFNi8J3CPY=/ws
```

Resultat :

```text
Failed to connect to app: No isolate found with ext.flutter.marionette.getLogs extension.
Make sure the Flutter app has marionette_flutter initialized.
```

Conclusion Marionette : app Neralune debug presente, mais non instrumentee Marionette. Les scenarios macOS A/B/C/D n'ont pas pu etre executes sans modifier l'app pour initialiser `marionette_flutter`.

## 11. Tests API executes

Commandes executees et resultats :

```text
npx prisma validate -> succes, schema valide
npx prisma generate -> succes, Prisma Client 7.8.0 genere
npm run build -> succes
npm run lint:check -> succes
npm test -- course-question-bank-readiness --runInBand -> 1 suite passed, 11 tests passed
npm test -- process-course-question-bank-preparation-job --runInBand -> 1 suite passed, 6 tests passed
npm test -- prisma-course-question-bank-preparation --runInBand -> 1 suite passed, 4 tests passed
npm test -- jobs.module --runInBand -> 1 suite passed, 2 tests passed
npm test -- question-bank --runInBand -> 6 suites passed, 36 tests passed
npm test -- courses --runInBand -> 14 suites passed, 118 tests passed
npm test -- jobs --runInBand -> 7 suites passed, 19 tests passed
npm test -- activities --runInBand -> 20 suites passed, 1 skipped, 362 tests passed, 1 skipped
npm test -- revision-sessions --runInBand -> 9 suites passed, 70 tests passed
npm run test:e2e -- --runInBand -> 2 suites passed, 34 tests passed
npm test -- --runInBand -> 98 suites passed, 1 skipped, 836 tests passed, 1 skipped
```

## 12. Recherches statiques

Commandes executees :

```bash
rg -n "createCourseQuickDiagnosticQuiz|StartCourseQuickRevision|QuestionBankPreparation|QuestionBankReadiness|COURSE_QUICK_REVISION_QUESTIONS_PREPARING|genkit|generate" src test --glob '!src/generated/prisma/**'
rg -n "QuestionBankReadiness|questions en préparation|COURSE_QUICK_REVISION_QUESTIONS_PREPARING|CourseQuickRevisionUnavailable|startCourseQuickRevision|prepareQuestionBank" lib test
rg -n "course_question_bank_worker_runtime_configuration|course_question_bank_worker_started|COURSE_QUESTION_BANK_PREPARATION_STALE_AFTER_MS|aiGenerations|fallbackUsed|preparationJobId" src test --glob '!src/generated/prisma/**'
```

Resultat : occurrences attendues dans les modules activities/courses/jobs et leurs tests. `StartCourseQuickRevisionSessionUseCase` reste sur une selection depuis la banque preparee et ne relance pas de generation IA longue dans la requete quick.

## 13. Fichiers modifies

- `src/modules/activities/application/diagnostic-quiz-generator.ts`
- `src/modules/activities/application/question-bank.service.spec.ts`
- `src/modules/activities/application/question-bank.service.ts`
- `src/modules/activities/infrastructure/genkit-diagnostic-quiz.generator.ts`
- `src/modules/courses/application/course-question-bank-preparation.repository.ts`
- `src/modules/courses/application/course-question-bank-readiness.use-case.spec.ts`
- `src/modules/courses/application/course-question-bank-readiness.use-case.ts`
- `src/modules/courses/application/process-course-question-bank-preparation-job.use-case.spec.ts`
- `src/modules/courses/application/process-course-question-bank-preparation-job.use-case.ts`
- `src/modules/courses/infrastructure/prisma-course-question-bank-preparation.repository.spec.ts`
- `src/modules/courses/infrastructure/prisma-course-question-bank-preparation.repository.ts`
- `src/modules/jobs/infrastructure/course-question-bank-preparation.consumer.ts`
- `src/modules/jobs/jobs.module.spec.ts`
- `src/modules/jobs/jobs.module.ts`
- `docs/roadmap/v2/EXECUTION_LOT_TRACKER_V2.md`
- `docs/roadmap/v2/LOT_TRACKER_V2.md`

## 14. Fichiers crees

- `docs/core/CORE_10B_FIX_2_WORKER_PARTIAL_READINESS_API_REPORT.md`

## 15. Limites restantes

- Le backend Dokploy actuellement deployee ne contient pas encore le correctif local fix-2.
- Les logs runtime fix-2 `course_question_bank_worker_runtime_configuration` et `course_question_bank_worker_started` ne peuvent donc pas etre observes en production avant deploiement.
- L'app macOS Neralune est lancee en debug mais n'initialise pas l'extension Marionette.
- Le scenario strict `9 questions -> prepare 10 -> worker completed -> readiness READY -> quick 10` n'a pas pu etre prouve runtime dans cet environnement.

## 16. Roadmap

Etat conserve :

```text
CORE-10B = BLOCKED
CORE-10 = IN_PROGRESS
CORE-10C = TODO
```

Raison : validations locales OK, mais definition de done runtime non satisfaite.

## 17. Auto-review

- Pas de CORE-10C demarre.
- Pas de changement provider IA.
- Pas de changement prompt IA.
- Pas de generation IA synchrone reintroduite dans quick.
- Logs ajoutes sans contenu sensible.
- Jobs stale testes.
- Claim stale RUNNING atomique teste.
- Provider/model/fallback IA remontes dans les metriques internes.
- Dokploy consulte mais preuve worker fix-2 non disponible.
- Marionette tente mais non connectable faute d'extension app.
- Aucun commit effectue.

## 18. Critique du prompt

La demande de preuve Marionette est pertinente pour fermer le lot, mais elle suppose que l'app initialise deja `marionette_flutter`. Ce n'est pas le cas dans la session Neralune detectee. Ajouter cette instrumentation pourrait etre un micro-lot QA separe, car le faire ici aurait modifie le runtime app au-dela du strict fix.

