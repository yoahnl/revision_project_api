# CORE-09C Subject & Course Lifecycle API Report

## 1. Résumé

CORE-09C ajoute le lifecycle backend des matières et cours : décision `DELETE / ARCHIVE / BLOCK`, rename/edit, archive logique et suppression safe des éléments réellement vides.

## 2. Audit initial

Audit détaillé : `docs/core/CORE_09C_SUBJECT_COURSE_LIFECYCLE_AUDIT.md`.

Zones inspectées :

- `prisma/schema.prisma`
- `src/modules/subjects/`
- `src/modules/courses/`
- `src/modules/documents/`
- `src/modules/activities/`
- `src/modules/revision/`
- `src/modules/revision-sessions/`
- `src/modules/study-artifacts/`
- `test/`

## 3. Sub-agents / passes utilisées

- API Domain Audit Agent : dépendances `Subject`/`Course`, suppressions dangereuses, policy delete/archive/block.
- API Architecture Agent : entities lifecycle, use cases, ports repository, routes minimales.
- API Implementation Agent : migration Prisma, controllers, repositories Prisma, tests.
- App Integration Agent : coordination du contrat consommé côté Flutter.
- UX/Wording Agent : messages utilisateur fournis par l'API et codes machine réservés au contrat.
- QA Agent : suites ciblées, e2e, full Jest.
- Reviewer Agent : scope CORE-09C, aucune modification GenKit/storage cleanup/question bank.

## 4. Politique course lifecycle

Un cours actif vide peut être supprimé.

Un cours actif utilisé doit être archivé s'il possède :

- document actif ou archivé ;
- session de révision ;
- item de banque de questions ;
- historique pédagogique observé.

Un cours est bloqué s'il est déjà archivé ou s'il contient un document en traitement.

## 5. Politique subject lifecycle

Une matière active vide peut être supprimée.

Une matière active utilisée doit être archivée si elle possède :

- cours ;
- documents ;
- notions ;
- états de maîtrise ;
- activity/revision sessions ;
- artefacts IA ;
- questions banque.

Une matière est bloquée si elle est déjà archivée ou si elle contient un document en traitement.

## 6. Migrations Prisma

Migration créée :

`prisma/migrations/20260622160000_subject_course_lifecycle/migration.sql`

Ajouts :

- `Subject.archivedAt`
- `Subject.archivedReason`
- `Course.archivedAt`
- `Course.archivedReason`
- index `Subject_archivedAt_idx`
- index `Course_archivedAt_idx`

Migration additive uniquement, sans cascade nouvelle.

## 7. Endpoints ajoutés/modifiés

Cours :

- `GET /courses/:courseId/lifecycle`
- `PATCH /courses/:courseId`
- `POST /courses/:courseId/archive`
- `DELETE /courses/:courseId` devient safe via policy.

Matières :

- `GET /subjects/:id/lifecycle`
- `PATCH /subjects/:id`
- `POST /subjects/:id/archive`
- `DELETE /subjects/:id` devient safe via policy.

Les listes actives excluent les éléments archivés.

## 8. Changements API

Ajouts principaux :

- `course-lifecycle.entity.ts`
- `subject-lifecycle.entity.ts`
- use cases `Get*Lifecycle`, `Update*`, `Archive*`
- extensions des ports `CoursesRepository` et `SubjectsRepository`
- implémentations Prisma lifecycle-aware.

Les contrôleurs valident les champs PATCH et mappent les erreurs bloquées en `409` structurés.

## 9. UI ajoutée/modifiée

Le code UI vit côté app. Côté API, le contrat renvoie des décisions suffisamment lisibles pour que l'app n'affiche pas les codes techniques.

## 10. Tests

Tests ajoutés/modifiés :

- domain lifecycle cours/matières ;
- repositories Prisma cours/matières ;
- controllers cours/matières ;
- non-régression e2e.

## 11. Commandes exécutées

Résultats frais :

- `npx prisma validate` : exit `0`, schema valid.
- `npx prisma generate` : exit `0`, client généré.
- `npm run build` : exit `0`.
- `npm run lint:check` : exit `0`.
- `npm test -- subjects --runInBand` : exit `0`, 6 suites / 25 tests.
- `npm test -- courses --runInBand` : exit `0`, 11 suites / 90 tests.
- `npm test -- lifecycle --runInBand` : exit `0`, 4 suites / 16 tests.
- `npm test -- documents --runInBand` : exit `0`, 12 suites / 92 tests.
- `npm test -- revision-sessions --runInBand` : exit `0`, 9 suites / 70 tests.
- `npm run test:e2e -- --runInBand` : exit `0`, 2 suites / 34 tests.
- `npm test -- --runInBand` : exit `1`.

Full Jest échoue uniquement sur `modules/activities/infrastructure/genkit-diagnostic-quiz.generator.spec.ts` avec deux tests qui font `jest.spyOn(global, 'fetch')` alors que `fetch` n'existe pas sur l'objet global dans cet environnement. GenKit était hors scope CORE-09C et n'a pas été modifié.

## 12. Recherches statiques

Recherches finales :

```bash
rg -n "subject\\.delete|course\\.delete|deleteIfEmpty|deleteCourse|deleteSubject|archiveCourse|archiveSubject|archivedAt|archivedReason|CourseLifecycle|SubjectLifecycle" src prisma test --glob '!src/generated/prisma/**'
```

Résultat : 333 lignes. Occurrences attendues dans Prisma, migrations, repositories, controllers, domain policies et tests.

```bash
rg -n "COURSE_DELETE_BLOCKED|SUBJECT_DELETE_BLOCKED|HAS_REVISION_SESSIONS|HAS_QUESTION_BANK_ITEMS|foreign key|constraint|Prisma|cascade" src test --glob '!src/generated/prisma/**'
```

Résultat : 240 lignes. Occurrences attendues dans tests, repositories Prisma, erreurs domaine et modules infrastructure. Aucun texte utilisateur public n'est produit par le backend.

## CORE-09C-bis hardening fixes

- `PATCH /courses/:courseId` retourne désormais un `CourseListItemResponse` complet après update : `sourceCount`, `readySourceCount`, `processingSourceCount` et `failedSourceCount` sont recalculés côté repository avant la réponse.
- `DELETE /subjects/:id` mappe maintenant `SubjectDeleteBlockedError` vers `409 Conflict`, comme les autres décisions lifecycle bloquées.
- Les recherches de cours actifs refusent les cours dont la matière parente est archivée via `subject.archivedAt = null`, ce qui protège le détail cours, la progression, quick revision, upload/attachment, lifecycle, archive et delete par le contexte d'ownership actif.
- Les uploads/listes legacy de documents par matière refusent aussi les matières archivées.
- Le test GenKit diagnostic quiz initialise `global.fetch` dans le setup Jest si l'environnement full Jest ne l'expose pas, sans modifier la logique GenKit de production.

Tests ciblés exécutés pendant le durcissement :

- `npm test -- subjects.controller --runInBand` : OK, 9 tests.
- `npm test -- prisma-courses.repository --runInBand` : OK, 27 tests.
- `npm test -- genkit-diagnostic-quiz --runInBand` : OK, 31 tests.
- `npm test -- documents --runInBand` : OK, 94 tests.
- `npm test -- courses.controller --runInBand` : OK, 27 tests.
- `npx prisma validate` : OK.
- `npx prisma generate` : OK.
- `npm run build` : OK.
- `npm run lint:check` : OK après retrait d'un cast inutile dans le setup de test GenKit.
- `npm test -- subjects --runInBand` : OK, 6 suites, 26 tests.
- `npm test -- courses --runInBand` : OK, 11 suites, 94 tests.
- `npm test -- lifecycle --runInBand` : OK, 4 suites, 16 tests.
- `npm test -- revision-sessions --runInBand` : OK, 9 suites, 70 tests.
- `npm run test:e2e -- --runInBand` : OK, 2 suites, 34 tests.
- `npm test -- --runInBand` : OK, 93 suites passées, 1 suite skipped, 800 tests passés, 1 test skipped.

Backend intact côté périmètre : aucun changement GenKit runtime, aucun changement prompts/providers, aucun changement storage cleanup, aucun lancement CORE-10A.

Confirmation Git : aucun commit effectué pendant CORE-09C-bis.

## 13. Limitations

- Pas de restauration d'archive.
- Pas de page historique des archives.
- Pas de lifecycle d'archive visible admin.
- Le full Jest est de nouveau vert ; il reste une suite/test skipped préexistante.

## 14. Dette restante

- Storage cloud futur.
- Historique/restauration des archives.
- CORE-10A peut maintenant s'appuyer sur un lifecycle source/cours/matière plus stable.

## 15. Fichiers créés/modifiés/supprimés

Créés :

- `prisma/migrations/20260622160000_subject_course_lifecycle/migration.sql`
- `src/modules/courses/domain/course-lifecycle.entity.ts`
- `src/modules/courses/domain/course-lifecycle.entity.spec.ts`
- `src/modules/courses/application/get-course-lifecycle.use-case.ts`
- `src/modules/courses/application/update-course.use-case.ts`
- `src/modules/courses/application/archive-course.use-case.ts`
- `src/modules/subjects/domain/subject-lifecycle.entity.ts`
- `src/modules/subjects/domain/subject-lifecycle.entity.spec.ts`
- `src/modules/subjects/application/get-subject-lifecycle.use-case.ts`
- `src/modules/subjects/application/update-subject.use-case.ts`
- `src/modules/subjects/application/archive-subject.use-case.ts`
- `docs/core/CORE_09C_SUBJECT_COURSE_LIFECYCLE_AUDIT.md`
- `docs/core/CORE_09C_SUBJECT_COURSE_LIFECYCLE_API_REPORT.md`

Modifiés :

- `prisma/schema.prisma`
- `src/modules/courses/application/courses.repository.ts`
- `src/modules/courses/courses.module.ts`
- `src/modules/courses/infrastructure/prisma-courses.repository.ts`
- `src/modules/courses/infrastructure/prisma-courses.repository.spec.ts`
- `src/modules/courses/interfaces/courses.controller.ts`
- `src/modules/courses/interfaces/courses.controller.spec.ts`
- `src/modules/subjects/application/subjects.repository.ts`
- `src/modules/subjects/subjects.module.ts`
- `src/modules/subjects/infrastructure/prisma-subjects.repository.ts`
- `src/modules/subjects/infrastructure/prisma-subjects.repository.spec.ts`
- `src/modules/subjects/interfaces/subjects.controller.ts`
- `src/modules/subjects/interfaces/subjects.controller.spec.ts`
- `docs/roadmap/v2/API_ROADMAP_V2.md`
- `docs/roadmap/v2/EXECUTION_LOT_TRACKER_V2.md`
- `docs/roadmap/v2/LOT_TRACKER_V2.md`

Supprimés : aucun.

## 16. Contenu complet des fichiers créés/modifiés/supprimés

Le contenu complet est disponible dans le diff Git local. Ce rapport ne s'inclut pas lui-même pour éviter une récursion documentaire.

## 17. Auto-review

- CORE-09A/B restent intacts.
- GenKit, prompts IA, storage cleanup et question bank n'ont pas été modifiés.
- Les suppressions cours/matières passent par une policy lifecycle.
- Les archives disparaissent des listes actives.
- Les codes machine restent côté API/tests et ne sont pas destinés aux libellés utilisateur.

## 18. Critique du prompt

Le prompt CORE-09C-bis est volontairement chirurgical et pertinent : il corrige des incohérences de contrat/API plutôt qu'un nouveau lot produit. La seule subtilité est que le fix GenKit demandé concerne le setup Jest, pas GenKit lui-même ; le correctif reste donc strictement dans le périmètre de test.

## 19. Confirmation aucun commit

Aucun commit, amend, merge, rebase, push, tag ou branche n'a été créé.
