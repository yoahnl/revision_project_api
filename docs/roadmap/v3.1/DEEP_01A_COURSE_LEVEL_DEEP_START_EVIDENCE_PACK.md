# DEEP-01A Evidence Pack - API

Date : 2026-06-25

Repo : API `yoahnl/revision_project_api`

## Baseline

- HEAD initial API : `53b88f0a0db21633369866af87aade6456d69f05`
- App touchee dans le meme lot : oui, rapport miroir dans le repo App.

## Fichiers applicatifs crees

- `src/modules/courses/application/get-course-deep-revision-options.use-case.ts`
- `src/modules/courses/application/get-course-deep-revision-options.use-case.spec.ts`
- `src/modules/courses/application/course-deep-revision-session.use-case.ts`
- `src/modules/courses/application/course-deep-revision-session.use-case.spec.ts`

## Fichiers applicatifs modifies

- `src/modules/courses/interfaces/courses.controller.ts`
- `src/modules/courses/interfaces/courses.controller.spec.ts`
- `src/modules/courses/courses.module.ts`
- `src/modules/activities/activities.module.ts`
- `src/modules/revision-sessions/revision-sessions.module.ts`

## Documents modifies ou crees

- `docs/roadmap/v3.1/EXECUTION_LOT_TRACKER_V3_1.md`
- `docs/roadmap/v3.1/LOT_TRACKER_V3_1.md`
- `docs/roadmap/v3.1/DEEP_01A_COURSE_LEVEL_DEEP_START_REPORT.md`
- `docs/roadmap/v3.1/DEEP_01A_COURSE_LEVEL_DEEP_START_EVIDENCE_PACK.md`

## Contrats livres

```text
GET  /courses/:courseId/deep-revision/options
POST /courses/:courseId/deep-revision/sessions
POST /courses/:courseId/deep-revision/sessions/:sessionId/submit
```

## Preuve contractuelle

```diff
+ @Get('courses/:courseId/deep-revision/options')
+ getDeepRevisionOptions(...)
+
+ @Post('courses/:courseId/deep-revision/sessions')
+ startDeepRevisionSession(...)
+
+ @Post('courses/:courseId/deep-revision/sessions/:sessionId/submit')
+ submitDeepRevisionAnswer(...)
```

## Preuve de garde-fous

- Options : course ownership via `findDetailByIdForStudent`.
- Options : sources limitees a `COURSE_PDF` pretes.
- Options : aucune creation de session.
- Start : scope impose a `knowledge_unit`.
- Start : delegation a `StartRevisionSessionUseCase` avec `mode: DEEP` et `preferredAction: open_question`.
- Start : refus si le moteur retourne une action non open question.
- Start : refus si le payload open question n'est pas rattache a une source.
- Submit : session owned/course/mode/status/action verifies avant correction.
- Submit : contexte d'evaluation rattache a une source de cours prete.
- Submit : delegation a `SubmitOpenAnswerUseCase`.

## Tests de preuve

```text
GetCourseDeepRevisionOptionsUseCase
StartCourseDeepRevisionSessionUseCase
SubmitCourseDeepRevisionAnswerUseCase
CoursesController deep revision routes
```

Cas couverts :

- course prete ;
- course sans source prete ;
- source prete sans notion ;
- ownership ;
- scope non pret ;
- body technique refuse ;
- answer vide ou trop long refuse ;
- aucune correction/reponse dans options ;
- aucune session creee par options ;
- non regression open question, courses, activities et revision sessions.

## Validations finales

- `npm run build` : OK
- `npm run lint:check` : OK
- `npm test -- open-question --runInBand` : OK
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
- Pas de result deep.
- Pas d'historique deep.
- Pas de reopen result deep.
- Pas de quality pool.
- Pas de score calcule cote App.
- Pas de fallback question ouverte sans source.

