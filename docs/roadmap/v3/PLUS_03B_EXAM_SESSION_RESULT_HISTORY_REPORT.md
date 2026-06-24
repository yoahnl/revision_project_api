# PLUS-03B - Exam session / result / history report

Version commune API/App. Ce rapport est miroir dans les deux repos touchés par le lot.

## 1. Audit initial PLUS-03B

Baselines réelles relevées avant travail :

| Repo | HEAD |
| --- | --- |
| API | `38cd39cec5ca15ed958527eeb839d9c9f8389699` |
| App | `0157cedf7b756df6c2e2c15896b1e72fc45af4d8` |

État roadmap confirmé :

| Élément | État avant lot |
| --- | --- |
| `PLUS-02A` | `DONE` |
| `PLUS-02B` | `DONE` |
| `PLUS-02` | `DONE` |
| `PLUS-03A` | `DONE` |
| `PLUS-03` | `IN_PROGRESS` |
| `PLUS-03B` | `TODO`, prochain lot |

Passes effectuées :

| Passe | Mode | Résultat |
| --- | --- | --- |
| Roadmap Agent | sub-agent réel | Trackers et rapports V3 lus ; `PLUS-03B` confirmé comme suite directe. |
| API Architecture Agent | sub-agent réel | Recommandation de réutiliser `RevisionSession(mode=EXAM)` et `ActivitySession(DIAGNOSTIC_QUIZ)` sans migration. |
| App UX Agent | sub-agent réel | Route session existante réutilisable via `mode=exam`, besoin d'une vraie CTA de démarrage et d'un historique exam distinct. |
| QA / anti-régression | passe principale | Tests quick, QCM riche, result/history et routeurs relancés. |
| Reviewer | passe principale | Vérification finale : pas de scoring client, pas de faux bouton, pas de correction pré-submit. |

Audit API :

| Zone | État initial | Décision PLUS-03B |
| --- | --- | --- |
| `src/modules/courses` | Options/readiness PLUS-03A existaient ; pas de start exam. | Ajouter start course-level `POST /courses/:courseId/exam-preparation/sessions`. |
| `src/modules/revision-sessions` | `EXAM` existait dans domaine/Prisma, mais completion quick seule. | Ajouter use cases et controller dédiés exam, sans toucher au quick. |
| `src/modules/activities` | Scoring diagnostic quiz serveur existant. | Réutiliser `SubmitActivityResultUseCase` comme score canonique. |
| `prisma/schema.prisma` | `RevisionSessionMode.EXAM` déjà disponible. | Aucune migration, aucun changement Prisma. |
| Historique | Historique quick filtré implicitement par parcours quick. | Filtrer explicitement quick et ajouter historique exam séparé. |

Audit App :

| Zone | État initial | Décision PLUS-03B |
| --- | --- | --- |
| `CourseExamPreparationPage` | Page de configuration honnête, sans démarrage. | Ajouter CTA réel `Démarrer l'entraînement` branché au repository. |
| Router | Route session et résultat existaient. | Passer `mode=exam` aux pages session/résultat. |
| Session | Quick premium flow existait. | Ajouter `ExamRevisionSessionFlow` dédié, sans drafts/flags ni score client. |
| Résultat | Page résultat quick existante. | Charger endpoint exam si `mode=exam` et afficher `Examen terminé`. |
| Course detail | Historique quick et QCM riche. | Ajouter historique exam léger avec réouverture résultat `mode=exam`. |

Ce qui était incomplet avant ce lot : l'utilisateur pouvait configurer une préparation examen mais ne pouvait pas la passer, la soumettre, voir un résultat exam ni retrouver l'historique exam.

## 2. Architecture retenue

Choix principal : utiliser les briques existantes sans migration.

| Décision | Justification |
| --- | --- |
| `RevisionSession.mode = EXAM` | Le modèle existe déjà ; il sépare le cycle exam sans nouveau stockage. |
| Action `DIAGNOSTIC_QUIZ` | Le pool de questions et le scorer serveur existent déjà pour les QCM single/multiple. |
| Controller exam dédié | Évite de polluer les routes quick et rend le contrat explicite. |
| Résultat canonique serveur | Le client envoie les réponses ; le score vient de l'API via `SubmitActivityResultUseCase` puis completion exam. |
| Historique exam séparé | Ne mélange pas quick et exam dans les endpoints existants. |
| Pas de timer dur | Hors scope ; aucun auto-submit ni mode surveillé. |

## 3. Contrat API final

Endpoints ajoutés :

```text
POST /courses/:courseId/exam-preparation/sessions
GET  /courses/:courseId/exam-preparation/history
GET  /exam-preparation/sessions/:sessionId
POST /exam-preparation/sessions/:sessionId/submit
GET  /exam-preparation/sessions/:sessionId/result
```

`POST /courses/:courseId/exam-preparation/sessions` accepte :

```json
{
  "scopeKind": "course",
  "scopeId": "course-1",
  "questionCount": 20,
  "complexityProfile": "exam"
}
```

Garanties API :

| Garantie | Implémentation |
| --- | --- |
| Ownership | Tous les accès passent par `studentId` et les repositories existants. |
| Scope prêt | Le start vérifie cours/source et nombre de questions actif sur le scope. |
| Question count borné | Seuls `10`, `20`, `30` sont acceptés, et jamais au-delà du pool prêt. |
| Pas de correction pré-submit | Le payload de session contient les questions et choix, pas le résultat. |
| Score canonique | `POST /exam-preparation/sessions/:id/submit` délègue au scorer activité puis complète la session exam. |
| Historique séparé | Quick history filtre `QUICK`; exam history filtre `EXAM`. |

## 4. Contrat App final

Contrats App ajoutés :

| Couche | Contrat |
| --- | --- |
| Courses repository | `startCourseExamPreparation({ courseId, config })` et `getCourseExamPreparationHistory({ courseId, limit })`. |
| Revision sessions API | `getExamPreparationSession`, `submitExamPreparationSession`, `getExamPreparationSessionResult`. |
| Controller App | Méthodes miroir avec trim/validation d'ID. |
| Router | `mode` transmis aux pages `/revision-sessions/:sessionId` et `/revision-sessions/:sessionId/result`. |
| Providers | `courseExamPreparationHistoryProvider(courseId)`. |

Le parseur App refuse un payload QCM pré-submit qui contient `correctChoiceId`, `correctChoiceIds`, `explanation`, `feedback` ou `isCorrect`.

## 5. UX finale

Parcours utilisateur livré :

```text
Cours
-> Préparation examen
-> configuration scope + nombre de questions
-> Démarrer l'entraînement
-> session de questions
-> Valider
-> Examen terminé
-> retour au cours
-> historique avec Entraînement examen
-> Voir le résultat
```

Wording utilisateur livré :

| Surface | Wording |
| --- | --- |
| Carte cours | `Préparation examen`, `Configurer`. |
| Page config | `Démarrer l'entraînement`. |
| Session | `Préparation examen`, `Question X sur Y`, `Valider`. |
| Résultat | `Examen terminé`. |
| Historique | `Entraînement examen`, `Voir le résultat`. |

Aucun bouton activé n'est décoratif : la CTA de configuration crée une vraie session, la validation soumet réellement, et l'historique rouvre un résultat.

## 6. États

Readiness PLUS-03A conservée : `READY`, `PARTIALLY_READY`, `NOT_READY`, `BLOCKED`.

Cycle session PLUS-03B :

| État | Comportement |
| --- | --- |
| `STARTED` + `EXAM` | La page session charge le payload exam et affiche les questions. |
| `COMPLETED` + `EXAM` | La page session redirige vers le résultat exam. |
| Result non prêt | L'API renvoie un conflit contrôlé ; l'App affiche une erreur retry. |
| Quick session sur endpoint exam | Refusée comme session introuvable côté exam. |

## 7. Supporté

Livré dans ce lot :

| Domaine | Livré |
| --- | --- |
| API | Start exam, get exam session, submit exam, get exam result, history exam course-level. |
| App | CTA de démarrage, session exam dédiée, soumission, résultat exam, historique exam, réouverture résultat. |
| Tests | Unitaires/use cases/controllers API, repository App, parser HTTP, providers, widgets route/session/result/history. |
| Sécurité produit | Pas de correction pré-submit, pas de score client, pas de session quick mélangée. |

## 8. Reporté après PLUS-03

Hors scope et non livré :

| Sujet | Statut |
| --- | --- |
| Timer dur / auto-submit | Reporté. |
| Mode surveillé / anti-triche | Reporté. |
| Quality pool / doublons / flags | `QUALITY-01`. |
| Coach adaptatif Today | `ADAPT-01`. |
| Rena / animations | `IDENTITY-01`. |
| Préparation examen avancée multi-types rich closed | Futur lot si le pool exam dépasse le QCM diagnostic. |

## 9. Tests ajoutés

API :

| Fichier | Couverture |
| --- | --- |
| `start-course-exam-preparation-session.use-case.spec.ts` | Start course/source, scope indisponible, question count invalide. |
| `exam-preparation-sessions.use-cases.spec.ts` | Get EXAM only, submit via scorer serveur, refus quick. |
| `exam-preparation-sessions.controller.spec.ts` | Routes get/submit/result, rejet champs result client. |
| `prisma-revision-sessions.repository.spec.ts` | Mode EXAM, completion exam, historique exam séparé. |
| `courses.controller.spec.ts` | Start course-level et history course-level. |

App :

| Fichier | Couverture |
| --- | --- |
| `course_exam_preparation_page_test.dart` | CTA réelle, config transmise, navigation session exam. |
| `revision_session_page_test.dart` | Chargement `mode=exam`, soumission endpoint exam, redirection result exam. |
| `revision_session_result_page_test.dart` | Chargement result exam. |
| `course_detail_page_test.dart` | Historique exam et réouverture result. |
| `http_revision_sessions_api_test.dart` | Endpoints exam, anti-fuite correction pré-submit. |
| `http_courses_repository_test.dart` | Start/history exam course-level. |
| `courses_providers_test.dart` | Provider historique exam. |

## 10. Validations exécutées

API :

```text
npm run build
npm run lint:check
npm test -- exam-preparation-sessions --runInBand
npm test -- courses --runInBand
npm test -- activities --runInBand
npm test -- revision-sessions --runInBand
npm test -- question-bank --runInBand
```

App :

```text
dart analyze lib test
flutter test test/features/courses --reporter compact
flutter test test/features/activities --reporter compact
flutter test test/features/revision_sessions --reporter compact
flutter test --reporter compact
```

À finaliser après création docs :

```text
git diff --check
```

Smoke manuel recommandé non exécuté par Codex : pas d'ouverture simulateur manuelle d'un cours prêt/non prêt dans ce lot.

## 11. Risques restants

| Risque | Niveau | Note |
| --- | --- | --- |
| Exam V1 basé sur QCM diagnostic | Moyen | Suffisant pour V1 ; les formats rich closed avancés restent hors scope. |
| Pas de timer | Bas | Explicitement hors scope. |
| Historique combiné côté course detail | Bas | L'UI distingue `Entraînement examen`, quick et questions riches. |
| Qualité du pool | Moyen | Dépend de `QUALITY-01`, non traité ici. |

## 12. Fichiers modifiés

Voir evidence packs :

| Repo | Evidence |
| --- | --- |
| API | `docs/roadmap/v3/PLUS_03B_EXAM_SESSION_RESULT_HISTORY_EVIDENCE_PACK.md` |
| App | `docs/roadmap/v3/PLUS_03B_EXAM_SESSION_RESULT_HISTORY_EVIDENCE_PACK.md` |

## 13. Contenu / evidence pack

Le détail des fichiers modifiés, nouveaux fichiers, preuves de diff et preuves de validation est dans l'evidence pack du repo correspondant.

## 14. Auto-review finale

| Question | Réponse |
| --- | --- |
| L'examen complet a-t-il été introduit hors scope ? | Non : V1 livre session/résultat/historique, sans timer, surveillé, coach ni quality pool. |
| Un bouton fake existe-t-il ? | Non : config démarre une session réelle, session valide une soumission réelle, historique ouvre un résultat réel. |
| Un score client a-t-il été introduit ? | Non : le score vient du serveur. |
| Des corrections/réponses sont-elles exposées avant submit ? | Non : API ne les expose pas ; App refuse aussi les payloads QCM leakés. |
| Quick/QCM riche sont-ils isolés ? | Oui : quick history filtre `QUICK`, rich closed reste sur ses routes, exam utilise ses endpoints. |
| Prisma/migrations/prompts/providers IA touchés ? | Non. |
| Trackers cohérents ? | Oui : `PLUS-03B` `DONE`, `PLUS-03` `DONE`. |

## 15. Critique du prompt

Prompt clair et bien borné. Le seul point ambigu est la demande de "contenu complet" des fichiers modifiés : pour éviter un rapport illisible, ce lot fournit un evidence pack structuré par repo et laisse le diff complet disponible via le workspace Git. La contrainte de non-commit/non-push a été respectée.
