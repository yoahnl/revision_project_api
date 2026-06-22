# CORE-10B-fix — Preparation completion API report

## 1. Diagnostic exact

CORE-10B avait bien introduit des jobs de preparation par Knowledge Unit, mais la readiness continuait a chercher un job course-level dont `targetQuestionCount` etait superieur ou egal au nombre de questions demande au niveau cours.

Cas observe :

```text
questionCount=10
3 KUs candidates
jobs crees par KU avec targetQuestionCount=5
readyQuestionCount=9
readiness cherche un job target >= 10
aucun job trouve
status NOT_PREPARED
```

Le parcours utilisateur restait bloque meme apres `POST /courses/:courseId/question-bank/prepare`.

## 2. Cause racine

La cause racine est une incoherence entre deux niveaux de modele :

- preparation : per-KU ;
- readiness : course-level avec filtre `targetQuestionCount >= requestedTarget`.

Un second risque existait dans la reservation optimiste : en cas de conflit au milieu d'une transaction, le code retournait `[]`, ce qui pouvait committer des increments deja faits avant le conflit.

## 3. Correctif readiness

La readiness consulte maintenant les jobs recents du cours sans filtrer par target global.

Regle appliquee :

```text
readyQuestionCount >= target -> READY
sinon au moins un job PENDING/RUNNING -> PREPARING
sinon au moins un job FAILED -> FAILED
sinon -> NOT_PREPARED
```

Ce correctif couvre les jobs per-KU `targetQuestionCount=5` pour une demande course-level `questionCount=10`.

## 4. Correctif worker / queue

`ensurePendingForCourseContext` indique maintenant si le job a ete cree ou reutilise. `PrepareCourseQuestionBankUseCase` enqueue systematiquement les jobs assures, y compris les jobs `PENDING` existants. Le queue BullMQ utilisait deja `jobId: preparationJobId`, ce qui rend l'enqueue idempotent cote BullMQ.

## 5. Correctif persistence

`QuestionBankService.prepareCourseQuickQuestionBank` retourne maintenant des metriques internes :

- `activeBefore`;
- `activeAfter`;
- `generatedCount`;
- `persistedCount`;
- `duplicateSkippedCount`;
- `structureSkippedCount`.

Le worker echoue avec une erreur exploitable si `readyAfter` reste sous target, par exemple lorsque le provider ne renvoie que des duplicats ou des questions filtrees comme structure PDF.

## 6. Correctif reservation

Un conflit de reservation au milieu d'une transaction lance maintenant une erreur interne controlee. Prisma rollback alors les updates precedents de cette transaction, puis `reserveQuestions` retente une selection.

## 7. Logs ajoutes

Logs NestJS ajoutes sans contenu de cours, prompt, reponse IA complete, token ou donnee personnelle brute :

- readiness : `courseId`, student hash tronque, target, ready count, active/failed jobs, status ;
- prepare request : target, ready initial, nombre de KUs candidates, jobs crees/reutilises ;
- worker : job recu, claim, readyBefore, generation/persistence metrics, readyAfter, completed/failed ;
- service preparation : batches generes/persistes/skipped.

## 8. Dokploy MCP

MCP Dokploy disponible.

Resultats :

- projet detecte : `revision app` ;
- application backend detectee : `backEnd` / `revision-app-backend-xlsv4d` ;
- dernier deploiement detecte : `CORE-10B multi-KU question selection`, commit `824cedcdf3b0efcf5bacbe14e40d7e6c562fcbf9` ;
- Redis est present dans l'environnement Dokploy ;
- logs backend lisibles via `application.readLogs` ;
- logs montrent `BullModule` et `JobsModule` initialises ;
- les variables d'environnement sont redigees par Dokploy, donc les valeurs exactes de `COURSE_QUESTION_BANK_PREPARATION_WORKER_ENABLED`, `REDIS_URL`, `REDIS_HOST` et `REDIS_PORT` n'ont pas pu etre confirmees ;
- la recherche filtree `course_question_bank` via `application.readLogs` a retourne une erreur 500 cote outil.

Aucune modification Dokploy n'a ete effectuee.

## 9. Marionette macOS

Marionette est disponible, mais aucune application Neralune Flutter debug avec VM service URI n'a ete detectee.

Process observes :

- plusieurs serveurs Marionette MCP ;
- un Flutter macOS `grimaldi`, qui n'est pas Neralune ;
- aucun processus `revision_app` / Neralune connectable.

Verification Marionette macOS non executee : aucune session Neralune connectable n'etait disponible.

## 10. Tests et validations

Commandes executees cote API :

```bash
npx prisma validate
npx prisma generate
npm run build
npm run lint:check
npm test -- question-bank --runInBand
npm test -- courses --runInBand
npm test -- jobs --runInBand
npm test -- activities --runInBand
npm test -- revision-sessions --runInBand
npm run test:e2e -- --runInBand
npm test -- --runInBand
git diff --check
```

Resultats :

- `npx prisma validate` : succes ;
- `npx prisma generate` : succes ;
- `npm run build` : succes ;
- `npm run lint:check` : succes apres correction d'un acces mock trop peu type ;
- `npm test -- question-bank --runInBand` : 6 suites passed, 32 tests passed ;
- `npm test -- courses --runInBand` : 14 suites passed, 114 tests passed ;
- `npm test -- jobs --runInBand` : 7 suites passed, 18 tests passed ;
- `npm test -- activities --runInBand` : 20 suites passed, 1 skipped, 362 tests passed ;
- `npm test -- revision-sessions --runInBand` : 9 suites passed, 70 tests passed ;
- `npm run test:e2e -- --runInBand` : 2 suites passed, 34 tests passed ;
- `npm test -- --runInBand` : 98 suites passed, 1 skipped, 831 tests passed ;
- `git diff --check` : succes.

## 11. Preuves testees

Tests ajoutes ou modifies pour prouver :

- `readyQuestionCount=9`, 3 jobs per-KU `PENDING` target 5, demande 10 -> `PREPARING` ;
- meme cas avec jobs `RUNNING` -> `PREPARING` ;
- meme cas avec jobs `FAILED` -> `FAILED` ;
- `readyQuestionCount=10` -> `READY` meme avec anciens jobs failed ;
- provider genere 1 question valide a 9/10 -> `activeAfter=10`, `persistedCount=1` ;
- provider genere uniquement des duplicats -> `persistedCount=0`, `duplicateSkippedCount=1`, worker failed utilement ;
- provider genere uniquement du contenu filtre structure PDF -> `structureSkippedCount=1`, worker failed utilement ;
- conflit de reservation au milieu -> rollback transactionnel par erreur interne + retry ;
- quick start avec banque insuffisante declenche preparation et n'appelle pas la creation de quiz ;
- quick start avec banque prete cree une session sans generation IA synchrone.

## 12. Recherches statiques

Commandes executees :

```bash
rg -n "createCourseQuickDiagnosticQuiz|StartCourseQuickRevision|QuestionBankPreparation|QuestionBankReadiness|COURSE_QUICK_REVISION_QUESTIONS_PREPARING|genkit|generate" src test --glob '!src/generated/prisma/**'
rg -n "findFirstQuickRevisionKnowledgeUnitForCourseDocument|countActiveCourseQuickQuestions|prepareCourseQuickQuestionBank|createCourseQuickDiagnosticQuiz|reserveQuestions|QuestionBankReservation|QuestionBankItemStatus|knowledgeUnitId" src test --glob '!src/generated/prisma/**'
```

Resultat : occurrences attendues dans les modules activites/courses/jobs, les tests, et les generateurs IA existants. `StartCourseQuickRevisionSessionUseCase` ne lance pas de generation GenKit ; il compte la banque et appelle la preparation async si le pool est insuffisant.

## 13. Fichiers crees

- `docs/core/CORE_10B_FIX_PREPARATION_COMPLETION_API_REPORT.md`

## 14. Fichiers modifies

- `docs/roadmap/v2/EXECUTION_LOT_TRACKER_V2.md`
- `docs/roadmap/v2/LOT_TRACKER_V2.md`
- `src/modules/activities/application/question-bank.service.ts`
- `src/modules/activities/application/question-bank.service.spec.ts`
- `src/modules/courses/application/course-question-bank-preparation.repository.ts`
- `src/modules/courses/application/course-question-bank-readiness.use-case.ts`
- `src/modules/courses/application/course-question-bank-readiness.use-case.spec.ts`
- `src/modules/courses/application/process-course-question-bank-preparation-job.use-case.ts`
- `src/modules/courses/application/process-course-question-bank-preparation-job.use-case.spec.ts`
- `src/modules/courses/infrastructure/prisma-course-question-bank-preparation.repository.ts`
- `src/modules/courses/infrastructure/prisma-course-question-bank-preparation.repository.spec.ts`

## 15. Etat final

Code et tests API : corriges.

Statut roadmap : `CORE-10B` repasse `BLOCKED` tant que la preuve runtime macOS/prod exigee n'est pas disponible. `CORE-10` reste `IN_PROGRESS`.

## 16. Dette CORE-10C

- extraire plus proprement les metriques de qualite/cout ;
- reduire le bruit des logs en tests si necessaire ;
- eventuellement exposer une observabilite plus structuree que des logs NestJS ;
- affiner la strategie de generation multi-KU au dela du minimum V1.

## 17. Auto-review

- CORE-10C non commence ;
- pas de changement provider IA ;
- pas de changement prompt IA ;
- pas de modele lourd de reservation ajoute ;
- pas de code Flutter runtime modifie ;
- pas de commentaire code ajoute ;
- logs sans contenu source/prompt/reponse IA complete ;
- tests API complets verts ;
- runtime macOS non prouve.

## 18. Critique du prompt

La definition de done exige une preuve runtime macOS et Dokploy. C'est sain, mais impossible a satisfaire sans app Neralune debug connectable et sans deploy du correctif. Le statut `BLOCKED` est donc plus honnete que `DONE`.

## 19. Git

Aucun commit n'a ete effectue pendant l'execution initiale du lot. Commit et push realises ensuite sur demande explicite de Yoahn.
