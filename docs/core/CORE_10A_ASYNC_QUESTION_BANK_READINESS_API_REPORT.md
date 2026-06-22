# CORE-10A Async Question Bank Readiness API Report

## 1. Resume

CORE-10A rend la revision rapide non bloquante cote generation IA. Le backend expose un etat de readiness course-level, cree une intention de preparation async et refuse le demarrage quick avec un `409` lisible tant que les questions ne sont pas pretes.

## 2. Audit initial

L'audit a confirme que le chemin quick pouvait appeler la generation depuis `QuestionBankService.createCourseQuickDiagnosticQuiz`. Les jobs existaient deja dans `JobsModule`, mais aucun job de preparation question bank n'existait.

## 3. Sub-agents / passes

- API Audit Agent : lecture `QuestionBankService`, quick start et jobs.
- Async Job Architecture Agent : choix d'une table de jobs persistante + queue BullMQ.
- Question Bank Domain Agent : contrat readiness V0 course-level.
- API Implementation Agent : migration, repository, use cases, controller, worker.
- QA Agent : suites unitaires, controller, e2e et full Jest.
- Reviewer Agent : verification du scope CORE-10A sans CORE-10B/C.

## 4. Architecture retenue

La readiness est calculee par `GetCourseQuestionBankReadinessUseCase`. La preparation passe par `PrepareCourseQuestionBankUseCase`, qui reutilise ou cree un job actif, puis enqueue un job BullMQ. Le traitement effectif est fait par `ProcessCourseQuestionBankPreparationJobUseCase`.

## 5. Readiness contract

Statuts :

- `NO_READY_SOURCE`
- `NO_KNOWLEDGE_UNITS`
- `NOT_PREPARED`
- `PREPARING`
- `READY`
- `FAILED`

Le contrat retourne aussi `readyQuestionCount`, `targetQuestionCount`, `canStartQuickRevision`, `canPrepare` et `userMessage`.

## 6. Job / queue

Migration additive :

- `CourseQuestionBankPreparationJob`

Queue :

- `COURSE_QUESTION_BANK_PREPARATION_QUEUE`
- queue BullMQ `course-question-bank-preparation`
- consumer activable par `COURSE_QUESTION_BANK_PREPARATION_WORKER_ENABLED=true`

## 7. API endpoints

Ajoutes :

- `GET /courses/:courseId/question-bank/readiness`
- `POST /courses/:courseId/question-bank/prepare`

Modifie :

- `POST /courses/:courseId/revision-sessions/quick`

Si la banque n'est pas prete, quick prepare en async puis retourne `409 COURSE_QUICK_REVISION_QUESTIONS_PREPARING`.

## 8. App integration

Le contrat backend est consomme par le repo Flutter via les endpoints readiness/prepare. Les erreurs quick `409` transportent `readiness` et restent mappees en message utilisateur.

## 9. Tests ajoutes / modifies

Ajoutes :

- readiness use case ;
- prepare use case ;
- process preparation job use case ;
- queue BullMQ ;
- consumer ;
- quick start non bloquant.

Modifies :

- `QuestionBankService` specs ;
- courses controller specs ;
- jobs module specs.

## 10. Commandes executees

- `npx prisma validate` : OK.
- `npx prisma generate` : OK.
- `npm run build` : OK.
- `npm run lint:check` : OK.
- `npm test -- question-bank --runInBand` : 5 suites, 16 tests OK.
- `npm test -- courses --runInBand` : 13 suites, 103 tests OK.
- `npm test -- activities --runInBand` : 20 suites OK, 1 skipped, 355 tests OK.
- `npm test -- revision-sessions --runInBand` : 9 suites, 70 tests OK.
- `npm test -- jobs --runInBand` : 7 suites, 18 tests OK.
- `npm test -- lifecycle --runInBand` : 4 suites, 16 tests OK.
- `npm run test:e2e -- --runInBand` : 2 suites, 34 tests OK.
- `npm test -- --runInBand` : 97 suites OK, 1 skipped, 813 tests OK.

## 11. Recherches statiques

Recherches executees en fin de lot :

- `rg -n "createCourseQuickDiagnosticQuiz|StartCourseQuickRevision|QuestionBankPreparation|QuestionBankReadiness|COURSE_QUICK_REVISION_QUESTIONS_PREPARING|genkit|generate" src test --glob '!src/generated/prisma/**'`

Verification : quick start ne lance plus de generation GenKit longue quand la banque n'est pas prete. La generation reste contenue dans la preparation async.

## 12. Limitations

La V0 reste course-level et reutilise la logique existante de generation. Elle ne resout pas encore la selection multi-KU avancee ni le locking fin entre sessions concurrentes.

## 13. Dette CORE-10B

- selection multi-KU ;
- repartition par difficulte/maitrise ;
- concurrence de reservation ;
- meilleure strategie anti-doublons.

## 14. Dette CORE-10C

- decoupler `QuestionBankService` ;
- ajouter metriques cout/qualite ;
- instrumentation plus riche.

## 15. Fichiers crees / modifies

Crees : migration Prisma, repository preparation, use cases readiness/prepare/process, domaine readiness, queue, consumer, specs, audit et rapport.

Modifies : `QuestionBankService`, quick start use case, controller courses, modules courses/jobs, specs existantes, trackers roadmap.

## 16. Auto-review

- Pas de CORE-10B/C.
- Pas de changement provider IA.
- Pas de prompt IA modifie.
- Pas de changement CORE-09.
- Pas de commit effectue.

## 17. Critique du prompt

Le prompt demandait une integration async complete. Le scope est coherent pour CORE-10A, mais la partie worker activable par env devra etre verifiee en environnement deploiement pour confirmer que la queue tourne bien hors tests.

## 18. Confirmation

Aucun commit n'a ete effectue.
