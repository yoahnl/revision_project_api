# RICH-01 — API evidence pack

Date : 2026-06-25

## Baseline

- HEAD initial API : `bd9da8decab03416d5667d2109a69ccc0b9f00a0`

## Fichiers crees

- `src/modules/courses/application/get-course-rich-revision-options.use-case.ts`
- `src/modules/courses/application/get-course-rich-revision-options.use-case.spec.ts`
- `src/modules/courses/application/start-course-rich-revision-session.use-case.ts`
- `src/modules/courses/application/start-course-rich-revision-session.use-case.spec.ts`
- `docs/roadmap/v3.1/RICH_01_COURSE_LEVEL_QCM_COMPLET_REPORT.md`
- `docs/roadmap/v3.1/RICH_01_COURSE_LEVEL_QCM_COMPLET_EVIDENCE_PACK.md`

## Fichiers modifies

- `src/modules/activities/activities.module.ts`
- `src/modules/courses/courses.module.ts`
- `src/modules/courses/interfaces/courses.controller.ts`
- `src/modules/courses/interfaces/courses.controller.spec.ts`
- `docs/roadmap/v3.1/EXECUTION_LOT_TRACKER_V3_1.md`
- `docs/roadmap/v3.1/LOT_TRACKER_V3_1.md`

## Contrat livre

```text
GET /courses/:courseId/rich-revision/options
POST /courses/:courseId/rich-revision/sessions
```

Le contrat `options` retourne uniquement readiness, scopes et configuration. Il ne retourne pas de correction, de reponse attendue, de scoring, de session complete ou de donnees privees.

Le contrat `sessions` accepte seulement :

```json
{
  "scopeKind": "knowledge_unit",
  "scopeId": "ku-1",
  "questionCount": 6,
  "complexityProfile": "standard"
}
```

Les champs techniques refuses dans le body sont :

- `studentId`
- `subjectId`
- `courseId`
- `documentId`
- `knowledgeUnitId`
- `questionTypeMix`

## Elements de preuve

- `GetCourseRichRevisionOptionsUseCase` lit le cours via `findDetailByIdForStudent`.
- Les sources considerees sont uniquement `COURSE_PDF` + `READY`.
- Les notions viennent de `findReadyQuickRevisionKnowledgeUnitsForCourse`.
- `StartCourseRichRevisionSessionUseCase` reconstruit `subjectId`, `documentId` et `knowledgeUnitId` cote serveur avant d'appeler `StartRichClosedExerciseUseCase`.
- `ActivitiesModule` exporte `StartRichClosedExerciseUseCase`; aucun provider IA n'est modifie.
- `CoursesController` valide le body et mappe les erreurs en 400/409 selon le cas.
- Les tests controller verifient que `GET options` ne cree pas de session et ne contient pas de correction/reponse.

## Validations

- `npm run build` : OK
- `npm run lint:check` : OK
- `npm test -- rich-closed --runInBand` : OK
- `npm test -- courses --runInBand` : OK
- `npm test -- activities --runInBand` : OK
- `npm test -- revision-sessions --runInBand` : OK
- `git diff --check` : OK

## Hors scope confirme

- Pas de Prisma.
- Pas de migration.
- Pas de prompt IA.
- Pas de provider IA.
- Pas de session examen.
- Pas de deep revision.
- Pas de dedup ou flag redesign.
