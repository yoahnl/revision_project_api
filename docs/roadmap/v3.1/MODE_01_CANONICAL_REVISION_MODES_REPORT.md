# MODE-01 - Canonical revision modes & honest UX

## 1. HEADs

API HEAD releve au depart : `9db002dc1bbcfbad8947e7916cd362c21d5ec4c2`.

App HEAD releve au depart : `f8aa5737dac79121a852e30893d3bf4c3514ca8b`.

Aucun commit, push, merge, rebase, amend, tag ou deploiement n'a ete effectue.

## 2. Audit initial MODE-01

`RESET-01` est `DONE`. `QB-01` est `DONE`. `MODE-01` etait le prochain lot apres `QB-01`. `RICH-01` et `DEEP-01A` attendent `MODE-01`; `EXAM-02` attend `RICH-01` et `DEEP-01B`.

API audit lecture seule :

- `courses.controller.ts` expose deja les routes exam-preparation options, sessions et history.
- `get-course-exam-preparation-options.use-case.ts` retourne readiness, scopes, question counts et `complexityProfile: exam`.
- `start-course-exam-preparation-session.use-case.ts` cree une session `EXAM` avec une action `DIAGNOSTIC_QUIZ`.
- `exam-preparation-sessions.use-cases.ts` charge, soumet et ouvre le result exam QCM-only.
- Aucun endpoint ne livre un examen mixte et aucun changement API n'etait necessaire.

App audit : `CourseDetailPage`, `CourseExamPreparationPage`, `RevisionSessionPage`, `ExamRevisionSessionFlow` et `RevisionSessionResultPage` utilisaient encore des libelles trop larges (`Preparation examen`, `Examen termine`, `Questions riches`) sur les surfaces course-level ou result/history.

Les sub-agents n'etaient pas disponibles via l'outil de decouverte dans ce tour. Le travail a ete execute en passes separees : Roadmap, App UX, API Contract, QA, Anti-regression, Reviewer.

## 3. Decisions prises

- API product code inchange.
- `Preparation examen` est clarifiee cote App en `Preparation examen - QCM`.
- `QCM complet` est visible depuis le cours mais desactive avec badge `Bientot`.
- `Revision approfondie` reste desactivee et porte la promesse question ouverte/redaction/correction.
- L'historique course-level affiche `Revision rapide`, `QCM complet`, `Preparation examen - QCM`.
- `RICH-01` devient le prochain lot recommande.

## 4. Documents et trackers

Trackers V3.1 mis a jour dans les deux repos :

- `EXECUTION_LOT_TRACKER_V3_1.md` : `MODE-01` passe `DONE`.
- `LOT_TRACKER_V3_1.md` : parent `MODE` passe `DONE`.

Rapports crees :

- App : `MODE_01_CANONICAL_REVISION_MODES_REPORT.md`
- App : `MODE_01_CANONICAL_REVISION_MODES_EVIDENCE_PACK.md`
- API : `MODE_01_CANONICAL_REVISION_MODES_REPORT.md`

Le rapport App est la version canonique pour les diffs de code. Le present rapport API documente que le code API est reste inchange.

## 5. Validations executees

Validations confirmees :

- `dart analyze lib test` : OK.
- `flutter test test/features/courses --reporter compact` : OK.
- `flutter test test/features/revision_sessions --reporter compact` : OK.
- `flutter test test/app/router --reporter compact` : OK.
- `git diff --check` App : OK.
- `git diff --check` API : OK.
- `flutter test test/features/courses/course_exam_preparation_page_test.dart --reporter compact` : OK.
- `flutter test test/features/revision_sessions/revision_session_page_test.dart --reporter compact` : OK.
- `flutter test test/features/revision_sessions/revision_session_result_page_test.dart --reporter compact` : OK.
- `flutter test test/features/courses/course_detail_page_test.dart --reporter compact` : OK.

## 6. Risques restants

- Activities/Today gardent des entrees `Questions riches` hors facade course-level. `RICH-01` devra harmoniser ces surfaces sans promettre trop tot un QCM complet course-level.
- Les messages API exam restent techniquement `exam-preparation`; l'App normalise les textes affiches.

## 6 bis. Prochain lot recommande

`RICH-01 - Course-level QCM complet`.

Raison : la carte `QCM complet` est maintenant visible mais desactivee. Le prochain lot doit brancher une facade course-level reelle sans melanger ce mode avec `Preparation examen - QCM`.

## 7. Auto-review finale

- Aucun endpoint API modifie.
- Aucun schema Prisma, migration, prompt IA ou provider IA modifie.
- Aucun examen mixte introduit.
- Aucun secret expose.
- Ancienne roadmap V3.1 conservee et trackers mis a jour.

## 8. Critique du prompt

Le prompt etait precis et a bien protege les frontieres entre MODE-01, RICH-01, DEEP-01A et EXAM-02. Le principal arbitrage etait de ne pas renommer globalement toutes les anciennes surfaces `Questions riches` pour eviter de livrer une promesse course-level avant `RICH-01`.
