# PLUS-03B - Evidence pack API

Ce pack documente les preuves API du lot. Les docs du lot sont exclues des statistiques pour éviter l'auto-récursion.

## Fichiers API produit/test

Modifiés :

```text
src/modules/activities/activities.module.ts
src/modules/courses/application/get-course-exam-preparation-options.use-case.spec.ts
src/modules/courses/application/get-course-exam-preparation-options.use-case.ts
src/modules/courses/courses.module.ts
src/modules/courses/interfaces/courses.controller.spec.ts
src/modules/courses/interfaces/courses.controller.ts
src/modules/revision-sessions/application/revision-sessions.repository.ts
src/modules/revision-sessions/application/start-revision-session.use-case.ts
src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.spec.ts
src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.ts
src/modules/revision-sessions/revision-sessions.module.ts
```

Créés :

```text
src/modules/courses/application/start-course-exam-preparation-session.use-case.spec.ts
src/modules/courses/application/start-course-exam-preparation-session.use-case.ts
src/modules/revision-sessions/application/exam-preparation-sessions.use-cases.spec.ts
src/modules/revision-sessions/application/exam-preparation-sessions.use-cases.ts
src/modules/revision-sessions/interfaces/exam-preparation-sessions.controller.spec.ts
src/modules/revision-sessions/interfaces/exam-preparation-sessions.controller.ts
```

## Diff stat API hors docs

```text
src/modules/activities/activities.module.ts        |   1 +
...ourse-exam-preparation-options.use-case.spec.ts |   3 +-
...get-course-exam-preparation-options.use-case.ts |   3 +-
src/modules/courses/courses.module.ts              |   3 +
.../courses/interfaces/courses.controller.spec.ts  |  96 ++++++++++++++-
.../courses/interfaces/courses.controller.ts       | 117 ++++++++++++++++++
.../application/revision-sessions.repository.ts    |  13 ++
.../application/start-revision-session.use-case.ts |   4 +
.../prisma-revision-sessions.repository.spec.ts    | 132 +++++++++++++++++++++
.../prisma-revision-sessions.repository.ts         |  66 ++++++++++-
.../revision-sessions/revision-sessions.module.ts  |  14 ++-
11 files changed, 444 insertions(+), 8 deletions(-)
```

Note : les 6 fichiers créés sont non suivis tant qu'aucun commit n'est fait ; ils sont listés ci-dessus.

## Contrats ajoutés

```text
POST /courses/:courseId/exam-preparation/sessions
GET  /courses/:courseId/exam-preparation/history
GET  /exam-preparation/sessions/:sessionId
POST /exam-preparation/sessions/:sessionId/submit
GET  /exam-preparation/sessions/:sessionId/result
```

## Preuves de non-régression API

```text
npm run build                                             OK
npm run lint:check                                        OK
npm test -- exam-preparation-sessions --runInBand         OK
npm test -- courses --runInBand                           OK
npm test -- activities --runInBand                        OK
npm test -- revision-sessions --runInBand                 OK
npm test -- question-bank --runInBand                     OK
```

## Garde-fous vérifiés

| Garde-fou | Preuve |
| --- | --- |
| Pas de migration Prisma | `prisma/schema.prisma` non modifié. |
| Pas de prompt/provider IA | Aucun fichier prompt/provider modifié. |
| Pas de score client | Scoring dans `SubmitActivityResultUseCase`, appelé par l'API. |
| Quick history isolé | Repository filtre `RevisionSessionMode.QUICK` pour les historiques quick. |
| Exam history isolé | Nouveau `findCompletedCourseExamSessionsForStudent` filtre `RevisionSessionMode.EXAM`. |
| Session exam complète mais bornée | Start, get, submit, result, history livrés ; timer/surveillé hors scope. |

## Revue des fichiers clés

| Fichier | Rôle |
| --- | --- |
| `start-course-exam-preparation-session.use-case.ts` | Valide scope/count et démarre `RevisionSession` en `EXAM`. |
| `exam-preparation-sessions.use-cases.ts` | Charge, soumet, complète et lit les résultats exam. |
| `exam-preparation-sessions.controller.ts` | Routes dédiées exam et validation stricte du body. |
| `prisma-revision-sessions.repository.ts` | Completion exam et historiques quick/exam séparés. |
| `courses.controller.ts` | Routes course-level start/history. |

## Smoke manuel

Non exécuté par Codex. Les tests widget/API couvrent le parcours automatisé, mais aucun simulateur ou environnement humain n'a été piloté manuellement dans ce lot.
