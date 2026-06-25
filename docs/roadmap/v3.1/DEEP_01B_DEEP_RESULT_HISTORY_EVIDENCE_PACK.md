# DEEP-01B Evidence Pack - API

Date : 2026-06-25

Repo : API `yoahnl/revision_project_api`

## Baseline

- HEAD initial API : `0373a43419b6112be8b06c2d20cef3abf5f1020c`
- App touchee dans le meme lot : oui, rapport miroir dans le repo App.

## Fichiers applicatifs crees

- `src/modules/revision-sessions/domain/deep-revision-result.entity.ts`

## Fichiers applicatifs modifies

- `src/modules/courses/application/course-deep-revision-session.use-case.ts`
- `src/modules/courses/application/course-deep-revision-session.use-case.spec.ts`
- `src/modules/courses/courses.module.ts`
- `src/modules/courses/interfaces/courses.controller.ts`
- `src/modules/courses/interfaces/courses.controller.spec.ts`
- `src/modules/revision-sessions/application/request-next-revision-session-action.use-case.ts`
- `src/modules/revision-sessions/application/request-next-revision-session-action.use-case.spec.ts`
- `src/modules/revision-sessions/application/revision-sessions.repository.ts`
- `src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.ts`
- `src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.spec.ts`

## Documents modifies ou crees

- `docs/roadmap/v3.1/EXECUTION_LOT_TRACKER_V3_1.md`
- `docs/roadmap/v3.1/LOT_TRACKER_V3_1.md`
- `docs/roadmap/v3.1/DEEP_01B_DEEP_RESULT_HISTORY_REPORT.md`
- `docs/roadmap/v3.1/DEEP_01B_DEEP_RESULT_HISTORY_EVIDENCE_PACK.md`

## Contrats livres

```text
GET /courses/:courseId/deep-revision/sessions/:sessionId/result
GET /courses/:courseId/deep-revision/history?limit=5
```

## Preuve contractuelle

```diff
+ @Get('courses/:courseId/deep-revision/sessions/:sessionId/result')
+ getDeepRevisionResult(...)
+
+ @Get('courses/:courseId/deep-revision/history')
+ getCourseDeepRevisionHistory(...)
```

## Preuve lifecycle

```text
submit deep
-> SubmitOpenAnswerUseCase persiste la correction
-> completeDeepOpenAnswerSession marque action et RevisionSession COMPLETED
-> response conserve evaluation inline et expose resultPath
```

## Preuve result/history

- `findDeepResultByIdForStudent` charge `RevisionSession` owned par l'etudiant.
- Le mapper exige `mode: DEEP`.
- Le mapper exige action `OPEN_QUESTION`, activite `OPEN_QUESTION` et evaluation.
- Le result ne verifie pas que la source est encore `READY`.
- `findCompletedCourseDeepSessionsForStudent` liste uniquement les sessions `DEEP` avec evaluation `READY`.
- L'historique trie par date descendante et borne `limit`.

## Preuve anti-regression

- `RequestNextRevisionSessionActionUseCase` refuse `DEEP` pour eviter un lifecycle multi-action non defini.
- Les resultats quick/exam existants restent dans leurs use cases generiques.
- Aucun prompt/provider IA touche.
- Aucun schema Prisma touche.

## Tests de preuve

```text
course-deep-revision-session.use-case.spec.ts
courses.controller.spec.ts
prisma-revision-sessions.repository.spec.ts
request-next-revision-session-action.use-case.spec.ts
```

## Validations finales

- `npm run build` : OK
- `npm run lint:check` : OK
- `npm test -- open-question --runInBand` : OK
- `npm test -- courses --runInBand` : OK
- `npm test -- activities --runInBand` : OK
- `npm test -- revision-sessions --runInBand` : OK
- `git diff --check` : OK apres creation documentaire finale

## Hors scope confirme

- Pas de Prisma.
- Pas de migration.
- Pas de prompt IA.
- Pas de provider IA.
- Pas d'examen mixte.
- Pas de quality pool.
- Pas de score calcule cote App.
- Pas de faux historique cote App.

