# PLUS-02B - QCM result / correction / history integration report

Version commune API/App. Ce rapport est miroir dans les deux repos touches par le lot.

## 1. Audit initial PLUS-02B

Baselines reelles relevees avant travail :

| Repo | HEAD |
| --- | --- |
| API | `b33c6c933d37f7e47fc6bfc8c44b13199047bf53` |
| App | `6012e350f532ad54ab5eb1b9a3a419614d73133f` |

Roadmap V3 lue : `PLUS-02A` est `DONE`, `PLUS-02B` etait le prochain lot logique, `PLUS-02` etait `IN_PROGRESS`. Les trackers V3 existaient deja dans les deux repos.

API existant :

| Zone | Etat initial |
| --- | --- |
| Routes rich closed | `POST /activities/rich-closed/start`, `GET /activities/rich-closed/:sessionId`, `POST /activities/rich-closed/:sessionId/submit`, `GET /activities/rich-closed/:sessionId/result` existaient. |
| Contrat result | Score serveur, `correctAnswers`, `totalQuestions`, `items` de correction existaient, mais le result etait pauvre en metadata session. |
| Correction | Les payloads de correction par type etaient produits par le scorer serveur et relus via result. |
| Persistance | `ActivitySession` stockait payload/result QCM riche. |
| Lien ActivitySession | Solide pour start, submit, get exercise, get result. |
| Lien RevisionSession | Pas de lien propre : les actions rich closed de revision session restent des lanceurs, sans `activitySessionId` durable. |
| Lien Course | Indirect via `Document` et `KnowledgeUnit`. Aucun historique cours QCM riche dedie. |
| Historique CORE-11B | Historique quick revision existant, base sur `RevisionSession`. |
| Ownership | Les lectures result existantes filtrent par `studentId`; l'historique QCM riche n'existait pas encore. |
| Risque fuite | Le payload public et le parser App refusaient deja les champs de correction pre-submit issus de PLUS-02A. |

App existant :

| Zone | Etat initial |
| --- | --- |
| Parser result | Le parser QCM riche savait lire score et corrections, mais sans metadata session complete. |
| Widgets correction | `RichClosedCorrectionList` et presenters couvraient les types supportes de PLUS-02A. |
| Page rich closed | Le flow submit affichait la correction apres soumission. |
| Route result | Aucune route dediee pour rouvrir un result QCM riche termine. |
| Historique cours | Historique quick revision uniquement. |
| Navigation depuis course detail | Ouverture des resultats quick revision uniquement. |
| Loading/error | Les etats existaient pour le flow actif, pas pour la page result relue. |
| Risque calcul client | Le score affiche venait deja du result serveur ; PLUS-02B devait conserver cette regle. |

Ce qui existait deja : contrat rich questions, scorer serveur, result endpoint, correction widgets, protections anti-fuite pre-submit.

Ce qui etait partiel : metadata result, historique QCM riche, route de reouverture, integration course detail.

Ce qui est durci dans PLUS-02B : metadata result serveur, historique cours leger, route result App, parsing history, tests ownership/lightweight/history, non-regression quick.

Ce qui reste reporte : unification complete avec `RevisionSession`, historique exam, quality pool, flags, Rena, Today, image_choice produit.

## 2. Architecture retenue

Choix retenu : historique QCM riche dedie au cours, expose par `GET /courses/:courseId/rich-closed/history`.

Justification :

| Option | Decision |
| --- | --- |
| Forcer `RevisionSession` pour QCM riche | Rejete pour PLUS-02B : le modele actuel ne relie pas proprement une `RevisionSession` rich closed a une `ActivitySession` terminee. |
| Historique activities dedie hors cours | Possible, mais moins utile produit et moins compatible avec l'ecran cours actuel. |
| Historique cours leger | Retenu : stable, borne, compatible CORE-11B sans casser quick revision. |

Le detail result reste charge au clic via `/activities/rich-closed/:sessionId/result`. La liste d'historique ne transporte pas les corrections completes.

## 3. Contrat result final

Result QCM riche final cote serveur :

| Champ | Source |
| --- | --- |
| `sessionId` | `ActivitySession.id` |
| `type` | `rich_closed_exercise` |
| `status` | `completed` |
| `subjectId` | `ActivitySession.subjectId` |
| `documentId` | `ActivitySession.documentId`, nullable |
| `knowledgeUnitId` | `ActivitySession.knowledgeUnitId` |
| `createdAt` | `ActivitySession.createdAt` |
| `completedAt` | `ActivitySession.completedAt` ou date result |
| `durationSeconds` | Difference fiable entre `createdAt` et `completedAt`, sinon `null` |
| `correctAnswers` | Result serveur persiste |
| `totalQuestions` | Result serveur persiste |
| `score` | Result serveur canonique |
| `items` | Correction serveur post-submit |

Regle produit confirmee : le client Flutter parse et affiche ce result ; il ne recalcule pas le score canonique.

## 4. Contrat history final

Endpoint : `GET /courses/:courseId/rich-closed/history?limit=5`.

Item history leger :

| Champ | Description |
| --- | --- |
| `id`, `sessionId` | Identifiant `ActivitySession`. |
| `type`, `status` | `rich_closed_exercise`, `completed`. |
| `title` | Titre du payload QCM riche. |
| `subjectId`, `documentId` | Contexte source. |
| `knowledgeUnit` | Id et titre du KU lie. |
| `course` | Id et titre du cours. |
| `correctAnswers`, `totalQuestions`, `score` | Resume serveur. |
| `completedAt` | Tri et affichage historique. |
| `resultPath` | `/activities/rich-closed/:sessionId/result`. |

Filtrage : cours non archive, sujet non archive, `studentId` proprietaire, sessions `ActivityType.RICH_CLOSED_EXERCISE` terminees, result existant, document lie au cours ou knowledge unit liee a un document du cours.

## 5. Matrice correction par type

| Type | Correction serveur | Rendu App | Test | Decision |
| --- | --- | --- | --- | --- |
| `single_choice` | oui | oui | oui | supported |
| `multiple_choice` | oui | oui | oui | supported |
| `matching` | oui | oui | oui | supported |
| `ordering` | oui | oui | oui | supported |
| `case_qualification` | oui | oui | oui | supported |
| `error_detection` | oui | oui | oui | supported |
| `timeline` | oui | oui | oui | supported |
| `date_slider` | oui | oui | oui | supported |
| `true_false_grid` | oui | oui | oui | supported |
| `cause_consequence` | oui | oui | oui | supported |
| `institution_matrix` | oui | oui | oui | supported |
| `diagram_labeling` | oui | oui | oui | supported |
| `calculation_mcq` | oui | oui | oui | supported |
| `image_choice` | parser/correction technique existants | rendu technique existant | oui technique | postponed produit |

`image_choice` n'est pas vendu comme termine produit : la chaine d'assets inspectables reste reportee.

## 6. Integration App finale

L'App ajoute :

| Zone | Resultat |
| --- | --- |
| Parser result | Metadata session obligatoires : `subjectId`, `knowledgeUnitId`, `createdAt`, `completedAt`, `durationSeconds`. |
| Parser history | Modele `CourseRichClosedHistoryResponse` et item leger. |
| Repository courses | `getCourseRichClosedHistory(courseId, limit)`. |
| Providers | `courseRichClosedHistoryProvider`. |
| Course detail | Historique quick + historique QCM riche affiches ensemble. |
| Result page | `RichClosedExerciseResultPage` recharge exercise public + result serveur par `sessionId`. |
| Score | Affichage du score renvoye par serveur. |
| Correction | `RichClosedCorrectionList` reutilise pour afficher reponse donnee, bonne correction, explication, sources. |
| Retour cours | Bouton retour cours si `courseId` est present en query. |

## 7. Navigation finale

Route App ajoutee : `/activities/rich-closed/:sessionId/result`.

Depuis l'historique cours, un item QCM riche ouvre :

```text
AppRoutes.richClosedExerciseResult(sessionId: item.sessionId, courseId: item.course.id)
```

Les routes quick revision existantes ne changent pas :

```text
/revision-sessions/:sessionId/result
```

## 8. Ce qui est supporte

- Result QCM riche complet apres soumission.
- Relecture d'un result QCM riche termine par `sessionId`.
- Historique QCM riche leger au niveau cours.
- Reouverture depuis course detail.
- Corrections visibles uniquement post-submit/result.
- Non-regression quick revision result/history.
- Non-regression question bank readiness.

## 9. Ce qui reste reporte

- Preparation examen `PLUS-03A/PLUS-03B`.
- Unification lifecycle complete avec `RevisionSession`.
- Deep revision.
- Quality pool, doublons, flags.
- Mascotte Rena, Today coach, polish release.
- `image_choice` comme experience produit complete avec assets inspectables.
- Smoke manuel runtime complet : non execute dans ce lot, donc aucune preuve manuelle n'est inventee.

## 10. Tests ajoutes ou adaptes

API :

- `prisma-activities.repository.spec.ts` : metadata result, history cours QCM riche leger, ownership par cours/student, path result.
- `submit-rich-closed-exercise.use-case.spec.ts` : result metadata dans le contrat use case.
- `courses.controller.spec.ts` : endpoint history QCM riche.
- Specs activities existantes : mocks repository complets pour le nouveau port history.

App :

- `rich_closed_exercise_test.dart` : parsing metadata result.
- `rich_closed_exercise_page_test.dart` : page result relue par `sessionId`, sans submit, avec score/correction serveur.
- `http_courses_repository_test.dart` : parsing endpoint history QCM riche.
- `course_detail_page_test.dart` : historique cours vide combine, ouverture result QCM riche depuis history.
- Fakes/fixtures mis a jour pour metadata et history.

## 11. Validations executees

API :

| Commande | Resultat |
| --- | --- |
| `npm run build` | OK |
| `npm run lint:check` | OK |
| `npm test -- rich-closed --runInBand` | OK |
| `npm test -- activities --runInBand` | OK |
| `npm test -- revision-sessions --runInBand` | OK |
| `npm test -- courses --runInBand` | OK |
| `npm test -- question-bank --runInBand` | OK |
| `git diff --check` | OK |

App :

| Commande | Resultat |
| --- | --- |
| `dart analyze lib test` | OK |
| `flutter test test/features/activities --reporter compact` | OK |
| `flutter test test/features/revision_sessions --reporter compact` | OK |
| `flutter test test/features/courses --reporter compact` | OK |
| `flutter test --reporter compact` | OK |
| `git diff --check` | OK |

Prisma : non execute, car `prisma/schema.prisma` et les migrations ne sont pas touches.

## 12. Risques restants

- L'historique QCM riche est volontairement separe de `RevisionSession`; une unification future devra etre traitee dans un lot lifecycle dedie.
- Le lien cours depend des documents du cours et des knowledge units liees a ces documents.
- `durationSeconds` peut etre `null` si les timestamps sont incoherents.
- Le rapport V3 global dit encore que le prochain lot est `PLUS-02A`; non modifie car le prompt PLUS-02B interdit de toucher les docs V3 hors trackers/rapport/evidence pack.

## 13. Fichiers modifies

API :

- `src/modules/activities/activities.module.ts`
- `src/modules/activities/application/activities.repository.ts`
- `src/modules/activities/application/rich-closed-questions/rich-closed-question.types.ts`
- `src/modules/activities/application/rich-closed-questions/list-course-rich-closed-exercise-history.use-case.ts`
- `src/modules/activities/application/rich-closed-questions/start-rich-closed-exercise.use-case.spec.ts`
- `src/modules/activities/application/rich-closed-questions/submit-rich-closed-exercise.use-case.spec.ts`
- `src/modules/activities/application/start-open-question-activity.use-case.spec.ts`
- `src/modules/activities/application/submit-open-answer.use-case.spec.ts`
- `src/modules/activities/infrastructure/prisma-activities.repository.spec.ts`
- `src/modules/activities/infrastructure/prisma-activities.repository.ts`
- `src/modules/courses/interfaces/courses.controller.spec.ts`
- `src/modules/courses/interfaces/courses.controller.ts`
- `docs/roadmap/v3/EXECUTION_LOT_TRACKER_V3.md`
- `docs/roadmap/v3/LOT_TRACKER_V3.md`
- `docs/roadmap/v3/PLUS_02B_QCM_RESULT_CORRECTION_HISTORY_REPORT.md`
- `docs/roadmap/v3/PLUS_02B_QCM_RESULT_CORRECTION_HISTORY_EVIDENCE_PACK.md`

App :

- `lib/app/router/app_router.dart`
- `lib/app/router/app_routes.dart`
- `lib/features/activities/data/demo_activity_api.dart`
- `lib/features/activities/domain/rich_closed_exercise.dart`
- `lib/features/courses/application/courses_providers.dart`
- `lib/features/courses/data/http_courses_repository.dart`
- `lib/features/courses/domain/course_models.dart`
- `lib/features/courses/domain/courses_repository.dart`
- `lib/features/courses/presentation/course_detail_page.dart`
- `lib/features/revision_sessions/presentation/quick_revision_quiz_flow.dart`
- `lib/presentation/pages/activities/rich_closed_exercise_result_page.dart`
- `test/fakes/in_memory_courses_repository.dart`
- `test/features/activities/fixtures/rich_closed_exercise_fixtures.dart`
- `test/features/activities/rich_closed_correction_presenter_test.dart`
- `test/features/activities/rich_closed_exercise_page_test.dart`
- `test/features/activities/rich_closed_exercise_test.dart`
- `test/features/courses/course_detail_page_test.dart`
- `test/features/courses/http_courses_repository_test.dart`
- `docs/roadmap/v3/EXECUTION_LOT_TRACKER_V3.md`
- `docs/roadmap/v3/LOT_TRACKER_V3.md`
- `docs/roadmap/v3/PLUS_02B_QCM_RESULT_CORRECTION_HISTORY_REPORT.md`
- `docs/roadmap/v3/PLUS_02B_QCM_RESULT_CORRECTION_HISTORY_EVIDENCE_PACK.md`

## 14. Contenu complet / evidence pack

Evidence pack dedie :

```text
docs/roadmap/v3/PLUS_02B_QCM_RESULT_CORRECTION_HISTORY_EVIDENCE_PACK.md
```

Le pack contient les diffs complets des fichiers produit/test modifies dans chaque repo, hors documents V3 du lot pour eviter un artefact auto-recursif. Les documents V3 crees ou modifies sont listés dans ce rapport et dans les trackers.

## 15. Auto-review finale

| Controle | Resultat |
| --- | --- |
| Score calcule cote client | Non. Le client affiche `score`, `correctAnswers`, `totalQuestions` serveur. |
| Fuite pre-submit | Non detectee. Le payload public reste separe du result et les parsers anti-fuite restent en place. |
| Examen introduit | Non. |
| Quality pool introduit | Non. |
| Quick result/history casse | Non, validations ciblees OK. |
| Result QCM riche reouvrable | Oui, route dediee App + endpoint result existant. |
| Historique absent | Non, historique cours leger livre. |
| Trackers coherents | Oui, `PLUS-02B` et `PLUS-02` passes a `DONE`. |
| Secrets exposes | Aucun secret ajoute. |
| Commit/push | Aucun commit, aucun push. |

## 16. Critique du prompt

Le prompt est precis et utile sur les garde-fous. La demande de contenu complet des fichiers modifies dans le rapport/evidence pack est lourde et peut devenir auto-recursive quand les documents eux-memes sont crees dans le lot. Le compromis retenu documente le diff complet produit/test dans un evidence pack et liste explicitement les documents V3 crees/modifies.

