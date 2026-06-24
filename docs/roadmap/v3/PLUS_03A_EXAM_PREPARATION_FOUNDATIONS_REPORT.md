# PLUS-03A - Préparation examen V1 foundations report

Version commune API/App. Ce rapport est miroir dans les deux repos touchés par le lot.

## 1. Audit initial PLUS-03A

Baselines réelles relevées avant travail :

| Repo | HEAD |
| --- | --- |
| API | `0339f806f26a35b1920d22ef1ad2b83fe3ae1237` |
| App | `3cd85076eeb54260b8e22b3450e06d25f227ee49` |

Roadmap V3 lue :

| Élément | État confirmé |
| --- | --- |
| `PLUS-02A` | `DONE` |
| `PLUS-02B` | `DONE` |
| `PLUS-02` | `DONE` |
| `PLUS-03A` | prochain lot recommandé |
| `PLUS-03` | `TODO` avant ce lot, `IN_PROGRESS` après ce lot |

Passes d'audit :

| Passe | Mode | Résultat |
| --- | --- | --- |
| Roadmap Agent | sub-agent réel | Trackers et rapports V3 lus ; cohérence PLUS-02 confirmée. |
| API Architecture Agent | sub-agent réel | Modèles EXAM audités ; recommandation de rester sur un contrat options/readiness sans session exam. |
| Product Contract Agent | passe principale | Contrat `GET /courses/:courseId/exam-preparation/options` retenu. |
| App UX Agent | passe principale | Limite de sub-agents atteinte ; audit App fait en passe séparée et documenté ici. |
| Anti-regression / QA / Reviewer | passe principale | Couverture tests et auto-review finale ci-dessous. |

API existant :

| Zone | État initial |
| --- | --- |
| Routes courses | Détail cours, quick revision course-level, revision sheet, question bank readiness, progress, historique quick et historique rich closed existaient. |
| Question bank readiness | `GET /courses/:courseId/question-bank/readiness` existait et servait quick revision ; pas de contrat dédié examen. |
| Sources/documents | `findDetailByIdForStudent` filtrait déjà ownership, cours non archivé, sujet non archivé et documents non archivés. |
| Knowledge units | `findReadyQuickRevisionKnowledgeUnitsForCourse` existait pour les notions prêtes d'un cours. |
| QCM riche PLUS-02 | Résultat, correction et historique rich closed étaient en place, sans session exam. |
| Revision session modes | Prisma/domain contiennent `EXAM`, mais `POST /revision-sessions` reste QUICK et la completion refuse les modes non QUICK. |
| Study artifacts | Non nécessaires pour PLUS-03A. |
| Risque PLUS-03B | Brancher `RevisionSessionMode.EXAM` maintenant aurait mélangé fondations et session complète. |

App existant :

| Zone | État initial |
| --- | --- |
| Carte "Préparation examen" | Présente sur le détail cours comme placeholder désactivé, sans page dédiée. |
| Course detail | Quick revision, fiche et historiques existaient ; la préparation examen n'était pas une action réelle. |
| Router | Aucune route `/courses/:courseId/exam-preparation`. |
| Providers/repositories courses | Aucun modèle/parser/provider de préparation examen. |
| Design system | `RevisionPageScaffold`, `RevisionGlassCard`, tokens, loading/error states réutilisables. |
| Risque de faux bouton | Fort si un CTA "Démarrer" était ajouté sans session exam ; le lot évite ce bouton. |

Ce qui était fake ou incomplet : la préparation examen était une intention produit, pas un écran ni un contrat réel.

Ce qui est livré dans PLUS-03A : contrat API options/readiness, scopes cours/source, configuration bornée, page App dédiée et carte course detail actionnable.

Ce qui reste reporté à PLUS-03B : création de session exam, soumission, timer, scoring, résultat exam, correction exam et historique exam.

## 2. Architecture retenue

Choix retenu : un endpoint course-level léger et readonly :

```text
GET /courses/:courseId/exam-preparation/options
```

Raisons :

| Décision | Justification |
| --- | --- |
| Readonly | PLUS-03A prépare la configuration ; il ne crée pas encore de session exam. |
| Course-level | Le détail cours est l'entrée produit naturelle et possède déjà ownership/sources/notions. |
| Réutilisation question bank | Les questions actives existantes donnent une borne fiable sans appel IA. |
| Pas de Prisma | Aucun nouveau stockage n'est nécessaire pour une page de configuration. |
| Pas de `POST validate` | La validation de configuration reste locale pour PLUS-03A ; le vrai démarrage sera PLUS-03B. |

Le contrat est volontairement conservateur : il n'expose que les types de questions réellement soutenus par le pool quick actuel (`single_choice`, `multiple_choice`) même si PLUS-02 a livré davantage de types rich closed.

## 3. Contrat API final

Endpoint final :

```text
GET /courses/:courseId/exam-preparation/options
```

Réponse type :

```json
{
  "course": {
    "id": "course-1",
    "title": "Droit constitutionnel",
    "subjectId": "subject-1"
  },
  "readiness": {
    "canPrepare": true,
    "state": "READY",
    "userMessage": "Ton cours est prêt pour une préparation examen.",
    "blockers": [],
    "readySourceCount": 2,
    "readyKnowledgeUnitCount": 3,
    "availableQuestionCount": 24
  },
  "scopeOptions": [
    {
      "kind": "course",
      "id": "course-1",
      "label": "Tout le cours",
      "readyQuestionCount": 24,
      "readyKnowledgeUnitCount": 3,
      "canSelect": true
    }
  ],
  "questionCountOptions": [10, 20],
  "defaultQuestionCount": 20,
  "supportedQuestionKinds": ["single_choice", "multiple_choice"],
  "defaultConfig": {
    "scopeKind": "course",
    "scopeId": "course-1",
    "questionCount": 20,
    "complexityProfile": "exam"
  },
  "nextStep": {
    "kind": "configuration_ready",
    "userMessage": "Configuration prête. La session complète arrive ensuite."
  }
}
```

Garanties :

| Garantie | Implémentation |
| --- | --- |
| Ownership | `findDetailByIdForStudent({ studentId, courseId })`. |
| Cours archivé refusé | Réutilise le filtre repository `archivedAt: null`. |
| Sources archivées ignorées | Réutilise le filtre documents `archivedAt: null`. |
| Sources prêtes uniquement | `COURSE_PDF` + `READY`. |
| Pas de réponses/corrections | Le use case ne charge aucun exercice ni result. |
| Pas de session exam | Aucun appel à `RevisionSession`, aucune écriture base. |
| Pas d'IA | Aucun provider/générateur appelé. |

## 4. Contrat App final

Ajouts App :

| Zone | Résultat |
| --- | --- |
| Domain | Modèles `CourseExamPreparationOptions`, readiness, scope, config et next step. |
| Repository | `getExamPreparationOptions(courseId)`. |
| HTTP | GET `/courses/{courseId}/exam-preparation/options`, parser typé, 404 mappé en `CourseNotFoundException`. |
| Provider | `courseExamPreparationOptionsProvider(courseId)`. |
| Route | `/courses/:courseId/exam-preparation`. |
| Page | `CourseExamPreparationPage`. |
| Fake tests | `InMemoryCoursesRepository` sait retourner les options examen. |

La carte du détail cours ouvre désormais la page dédiée au lieu de rester un placeholder.

## 5. UX finale

La page "Préparation examen" affiche :

| Élément | Wording/Comportement |
| --- | --- |
| Titre | `Préparation examen` |
| Description | `Construis un entraînement plus proche d’un sujet d’examen, à partir de ce cours.` |
| État | `Prêt`, `Partiellement prêt`, `Pas encore prêt`, `Action nécessaire`. |
| Scopes | `Tout le cours` et sources prêtes sélectionnables si assez de questions. |
| Questions | Chips de nombre de questions bornés par le backend. |
| Types | Libellés simples : `choix simple`, `choix multiple`. |
| Étape suivante | `Configuration prête. La session complète arrive ensuite.` |
| Retour | Flèche de retour réelle vers le cours. |

Interdictions respectées :

| Interdit | Statut |
| --- | --- |
| Bouton "Démarrer l'examen" sans session | Aucun bouton de ce type. |
| Bouton activé sans action | Aucun faux bouton ajouté. |
| Jargon utilisateur `backend`, `payload`, `RevisionSession`, `EXAM mode` | Aucun wording utilisateur de ce type. |
| Score canonique côté client | Aucun score exam calculé. |

## 6. États readiness

| État API | UI | Condition |
| --- | --- | --- |
| `READY` | `Prêt` | Au moins 20 questions disponibles. |
| `PARTIALLY_READY` | `Partiellement prêt` | Au moins 10 questions, moins de 20. |
| `NOT_READY` | `Pas encore prêt` | Notions prêtes mais moins de 10 questions. |
| `BLOCKED` | `Action nécessaire` | Aucune source prête ou aucune notion exploitable. |

Blockers :

| Blocker | Message |
| --- | --- |
| `NO_READY_SOURCE` | Ajouter une source prête. |
| `NO_KNOWLEDGE_UNITS` | Aucune notion exploitable trouvée. |
| `INSUFFICIENT_QUESTIONS` | Préparer davantage de questions. |

## 7. Ce qui est supporté

Supporté dans PLUS-03A :

- readiness course-level ;
- scopes cours entier et source prête ;
- options de nombre de questions `[10, 20, 30]` bornées au nombre disponible ;
- configuration par défaut `complexityProfile: exam` ;
- page dédiée App ;
- navigation depuis course detail ;
- états loading/error/not found ;
- tests API/App ciblés.

## 8. Ce qui est reporté à PLUS-03B

Reporté :

- création de session examen ;
- soumission examen ;
- résultat examen ;
- correction examen ;
- historique examen ;
- timer obligatoire ;
- scoring exam ;
- exploitation complète des types rich closed en mode exam ;
- validation POST persistée ;
- statistiques examen.

## 9. Tests ajoutés

API :

| Fichier | Couverture |
| --- | --- |
| `src/modules/courses/application/get-course-exam-preparation-options.use-case.spec.ts` | Ready, no ready source, no knowledge units, partial config, ownership, absence réponses/corrections. |
| `src/modules/courses/interfaces/courses.controller.spec.ts` | Route `GET /courses/:courseId/exam-preparation/options`, trim courseId et délégation use case. |

App :

| Fichier | Couverture |
| --- | --- |
| `test/features/courses/http_courses_repository_test.dart` | Parser options exam et endpoint HTTP sans données de réponse/correction. |
| `test/features/courses/course_detail_page_test.dart` | La carte course detail ouvre une vraie route dédiée. |
| `test/features/courses/course_exam_preparation_page_test.dart` | État ready, état blocked, sélection question count, absence de bouton fake. |
| `test/fakes/in_memory_courses_repository.dart` | Fake repository compatible provider/page. |

## 10. Validations exécutées

API :

| Commande | Résultat |
| --- | --- |
| `npm run build` | OK |
| `npm run lint:check` | OK après correction d'un mock async sans await. |
| `npm test -- get-course-exam-preparation-options --runInBand` | OK, 5 tests. |
| `npm test -- courses --runInBand` | OK, 15 suites, 129 tests. |
| `npm test -- activities --runInBand` | OK, 21 suites passées, 1 skipped, 366 tests passés. |
| `npm test -- revision-sessions --runInBand` | OK, 10 suites, 86 tests. |
| `npm test -- question-bank --runInBand` | OK, 7 suites, 38 tests. |
| `git diff --check` | OK après création du rapport. |

App :

| Commande | Résultat |
| --- | --- |
| `dart analyze lib test` | OK, no issues found. |
| `flutter test test/features/courses --reporter compact` | OK, 86 tests. |
| `flutter test test/features/activities --reporter compact` | OK, 232 tests. |
| `flutter test test/features/revision_sessions --reporter compact` | OK, 42 tests. |
| `flutter test --reporter compact` | OK, 501 tests. |
| `git diff --check` | OK après création du rapport. |

Notes validation :

- Les premières exécutions parallèles Flutter de `courses`/`revision_sessions` ont échoué sur des artefacts Flutter concurrents (`native_assets` / `ios/Flutter/ephemeral`) ; les mêmes suites relancées séquentiellement passent.
- Aucun `npx prisma validate` ou `npx prisma generate` exécuté, car Prisma n'a pas été touché.
- Smoke manuel non exécuté ; la preuve disponible est automatisée.

## 11. Risques restants

| Risque | Décision |
| --- | --- |
| Le pool utilisé est encore le quick question bank | Accepté pour PLUS-03A ; quality pool et richer exam attendent les lots suivants. |
| Les types supportés sont conservateurs | L'API annonce `single_choice` et `multiple_choice` seulement pour ne pas promettre un examen riche non livré. |
| Pas de validation POST | Accepté : la session réelle et la validation serveur de démarrage sont pour PLUS-03B. |
| Estimation qualité/duplication absente | Reportée à `QUALITY-01`. |
| Certains placeholders MVP anciens existent hors route principale | Non touchés pour éviter une refonte hors scope. |

## 12. Fichiers modifiés

API :

- `src/modules/courses/application/get-course-exam-preparation-options.use-case.ts`
- `src/modules/courses/application/get-course-exam-preparation-options.use-case.spec.ts`
- `src/modules/courses/courses.module.ts`
- `src/modules/courses/interfaces/courses.controller.ts`
- `src/modules/courses/interfaces/courses.controller.spec.ts`
- `docs/roadmap/v3/EXECUTION_LOT_TRACKER_V3.md`
- `docs/roadmap/v3/LOT_TRACKER_V3.md`
- `docs/roadmap/v3/PLUS_03A_EXAM_PREPARATION_FOUNDATIONS_REPORT.md`
- `docs/roadmap/v3/PLUS_03A_EXAM_PREPARATION_FOUNDATIONS_EVIDENCE_PACK.md`

App :

- `lib/app/router/app_router.dart`
- `lib/app/router/app_routes.dart`
- `lib/features/courses/application/courses_providers.dart`
- `lib/features/courses/data/http_courses_repository.dart`
- `lib/features/courses/domain/course_models.dart`
- `lib/features/courses/domain/courses_repository.dart`
- `lib/features/courses/presentation/course_detail_page.dart`
- `lib/features/courses/presentation/course_exam_preparation_page.dart`
- `test/fakes/in_memory_courses_repository.dart`
- `test/features/courses/course_detail_page_test.dart`
- `test/features/courses/course_exam_preparation_page_test.dart`
- `test/features/courses/http_courses_repository_test.dart`
- `docs/roadmap/v3/EXECUTION_LOT_TRACKER_V3.md`
- `docs/roadmap/v3/LOT_TRACKER_V3.md`
- `docs/roadmap/v3/PLUS_03A_EXAM_PREPARATION_FOUNDATIONS_REPORT.md`
- `docs/roadmap/v3/PLUS_03A_EXAM_PREPARATION_FOUNDATIONS_EVIDENCE_PACK.md`

## 13. Contenu complet / evidence pack

Le contenu complet des changements produit/test est capturé dans les evidence packs :

- API : `docs/roadmap/v3/PLUS_03A_EXAM_PREPARATION_FOUNDATIONS_EVIDENCE_PACK.md`
- App : `docs/roadmap/v3/PLUS_03A_EXAM_PREPARATION_FOUNDATIONS_EVIDENCE_PACK.md`

Les documents V3 du lot sont exclus des evidence packs pour éviter un artefact auto-récursif ; ils sont listés ci-dessus.

## 14. Auto-review finale

| Question | Réponse |
| --- | --- |
| L'examen complet a-t-il été introduit par erreur ? | Non. |
| Un bouton fake existe-t-il ? | Non. |
| Un result/historique exam a-t-il été ajouté ? | Non. |
| Le contrat expose-t-il des corrections ou réponses ? | Non, testé par sérialisation. |
| L'App affiche-t-elle du jargon technique ? | Non. |
| Quick revision est-elle non régressée ? | Oui, suites API/App courses et revision_sessions OK. |
| QCM riche est-il non régressé ? | Oui, suites activities, rich closed et full Flutter OK. |
| Les trackers sont-ils cohérents ? | Oui : `PLUS-03A` `DONE`, `PLUS-03` `IN_PROGRESS`. |
| Rapport et evidence pack présents ? | Oui, dans les deux repos. |
| Secrets exposés ? | Aucun secret ajouté. |
| Commit/push effectués ? | Non. |

## 15. Critique du prompt

Le prompt est utilement strict sur le découpage entre fondations et session exam complète. Le principal risque vient de la largeur des validations et des passes sub-agents : l'environnement n'a pas permis tous les agents dédiés, donc les passes restantes ont été faites manuellement et documentées. La contrainte "types de questions utilisables" peut pousser à promettre tout PLUS-02 ; le choix conservateur ici évite cette dérive.

