# Roadmap V3.1 Creation Report

## 1. HEAD releves

| Repo | HEAD |
| --- | --- |
| API | `18972db47371e59127f86869cab13089d69a324e` |
| App | `41d72438c35fd94a92741fde27f42697a168b7ff` |

## 2. Fichiers audites

API question bank :

- `src/modules/activities/application/question-bank.service.ts`
- `src/modules/activities/application/question-bank.repository.ts`
- `src/modules/activities/infrastructure/prisma-question-bank.repository.ts`
- `src/modules/courses/application/course-question-bank-readiness.use-case.ts`
- `src/modules/courses/application/process-course-question-bank-preparation-job.use-case.ts`
- `src/modules/jobs/infrastructure/course-question-bank-preparation.consumer.ts`
- `src/modules/courses/infrastructure/prisma-course-question-bank-preparation.repository.ts`

API quick / exam :

- `src/modules/courses/application/start-course-quick-revision-session.use-case.ts`
- `src/modules/courses/application/get-course-exam-preparation-options.use-case.ts`
- `src/modules/courses/application/start-course-exam-preparation-session.use-case.ts`
- `src/modules/revision-sessions/application/exam-preparation-sessions.use-cases.ts`
- `src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.ts`

API rich closed :

- `src/modules/activities/application/rich-closed-questions/start-rich-closed-exercise.use-case.ts`
- `src/modules/activities/application/rich-closed-questions/rich-closed-question-generation-profile.ts`
- `src/modules/activities/application/rich-closed-questions/rich-closed-question.types.ts`
- `src/modules/activities/application/rich-closed-questions/submit-rich-closed-exercise.use-case.ts`
- `src/modules/activities/application/rich-closed-questions/get-rich-closed-exercise-result.use-case.ts`
- `src/modules/activities/application/rich-closed-questions/list-course-rich-closed-exercise-history.use-case.ts`

API open question / deep :

- `src/modules/activities/application/start-open-question-activity.use-case.ts`
- `src/modules/activities/application/submit-open-answer.use-case.ts`
- `src/modules/activities/application/open-question-generator.ts`
- `src/modules/activities/application/open-answer-evaluator.ts`
- `src/modules/activities/infrastructure/prisma-activities.repository.ts`
- `src/modules/revision-sessions/application/start-revision-session.use-case.ts`
- `src/modules/revision-sessions/application/request-next-revision-session-action.use-case.ts`
- `src/modules/revision-sessions/domain/revision-session.entity.ts`
- `prisma/schema.prisma`

App course detail / modes :

- `lib/features/courses/presentation/course_detail_page.dart`
- `lib/features/courses/presentation/course_exam_preparation_page.dart`
- `lib/features/courses/application/courses_providers.dart`
- `lib/features/courses/data/http_courses_repository.dart`
- `lib/features/courses/domain/courses_repository.dart`
- `lib/features/courses/domain/course_models.dart`

App activities / rich / open :

- `lib/presentation/pages/activities/activities_page.dart`
- `lib/presentation/pages/activities/open_question_page.dart`
- `lib/presentation/pages/activities/rich_closed_exercise_page.dart`
- `lib/presentation/pages/activities/rich_closed_exercise_result_page.dart`
- `lib/features/activities/application/activity_controller.dart`
- `lib/features/activities/domain/open_question_activity.dart`
- `lib/features/activities/domain/rich_closed_exercise.dart`

App revision sessions :

- `lib/presentation/pages/revision_sessions/revision_session_page.dart`
- `lib/presentation/pages/revision_sessions/revision_session_result_page.dart`
- `lib/features/revision_sessions/presentation/exam_revision_session_flow.dart`
- `lib/features/revision_sessions/application/revision_session_controller.dart`
- `lib/features/revision_sessions/data/http_revision_sessions_api.dart`
- `lib/features/revision_sessions/domain/revision_session.dart`

## 3. Constats API

- La question bank quick borne les sessions a 5..30 questions, avec defaut 10.
- La generation se fait par batch de 2.
- Le cap course-level est 100 questions actives.
- La preparation course-level impose `QUICK_QUESTION_BANK_PREPARATION_MIN_PER_KU = 5`.
- Le target par notion est `max(5, ceil(targetQuestionCount / knowledgeUnitCount))`.
- Ce calcul explique les pools de 35 questions pour 7 notions et 65 questions pour 13 notions.
- Quick et exam utilisent tous les deux `QuestionBankService.createCourseQuickDiagnosticQuiz`.
- La difference quick/exam actuelle est principalement `RevisionSession.mode`, les routes et l'historique.
- Rich closed existe avec 14 types, result et history.
- Open question existe avec generation, soumission, evaluation IA, score, feedback et sources.
- `DEEP` existe dans le modele mais pas comme lifecycle course-level complet.

## 4. Constats App

- `CourseDetailPage` affiche `Revision rapide`, `Revision approfondie`, `Preparation examen`.
- `Revision approfondie` est encore desactivee avec `Bientot disponible`.
- `Preparation examen` peut demarrer une session, mais le flow affiche un QCM.
- `CourseDetailPage` affiche des compteurs de pool comme `X questions pretes`.
- `ActivitiesPage` expose deja `Question ouverte` et `Questions riches`, mais depuis une notion precise.
- `RichClosedExercisePage`, `RichClosedExerciseResultPage` et `OpenQuestionPage` sont reutilisables pour les futurs lots course-level.
- Le domaine App parse `quick`, `deep`, `exam`, mais le flow deep course-level manque.

## 5. Constats produit

- Preparation examen ressemble trop a revision rapide car les deux utilisent le QCM simple.
- QCM complet doit etre une surface distincte de Preparation examen.
- Revision approfondie doit porter la question ouverte et non une fiche.
- Le nombre brut du pool ne doit pas etre la promesse UX principale.
- La future preparation examen mixte doit attendre QCM complet course-level et deep result/history.

## 6. Roadmap produite

Ordre recommande :

1. `RESET-01`
2. `QB-01`
3. `MODE-01`
4. `RICH-01`
5. `DEEP-01A`
6. `DEEP-01B`
7. `EXAM-02A`
8. `EXAM-02B`
9. `EXAM-02C`
10. `QUALITY-01A`
11. `QUALITY-01B`
12. `POLISH-01`
13. `IDENTITY-01`

Le prochain lot recommande est `QB-01 - Question-bank budget planner & overgeneration fix`.

## 7. Decisions structurantes

1. Ne pas relancer `PLUS-01A` avant clarification des modes.
2. Preparation examen actuelle est QCM-only.
3. Preparation examen doit etre renommee temporairement `Preparation examen - QCM`.
4. QCM complet doit etre separe de Preparation examen.
5. Revision approfondie doit porter la question ouverte.
6. Le pool quick ne doit plus piloter toutes les promesses.
7. Les 35/65 questions viennent du minimum par notion.
8. `QB-01` est le prochain lot code prioritaire.
9. L'examen mixte est reporte a `EXAM-02`.
10. Rena est reportee apres `POLISH-01`.

## 8. Fichiers crees

Les memes fichiers ont ete crees dans les deux repos :

- `docs/roadmap/v3.1/ROADMAP_V3_1_PRODUCT_MODES_PLAN.md`
- `docs/roadmap/v3.1/PRODUCT_MODE_CONTRACT.md`
- `docs/roadmap/v3.1/TECHNICAL_MODE_MAPPING.md`
- `docs/roadmap/v3.1/QUESTION_BANK_BUDGET_PLAN.md`
- `docs/roadmap/v3.1/EXECUTION_LOT_TRACKER_V3_1.md`
- `docs/roadmap/v3.1/LOT_TRACKER_V3_1.md`
- `docs/roadmap/v3.1/ROADMAP_V3_1_DECISIONS.md`
- `docs/roadmap/v3.1/ROADMAP_V3_1_HANDOFF_TO_CODEX.md`
- `docs/roadmap/v3.1/ROADMAP_V3_1_CREATION_REPORT.md`

Aucun fichier produit, Prisma, prompt IA ou provider IA n'a ete modifie.

## 9. Validations executees

Validation documentaire attendue :

- API : `git diff --check`
- App : `git diff --check`

Resultat execute :

- API : `git diff --check` OK.
- API : `rg -n "[ \t]$" docs/roadmap/v3.1` OK, aucune correspondance.
- App : `git diff --check` OK.
- App : `rg -n "[ \t]$" docs/roadmap/v3.1` OK, aucune correspondance.

## 10. Risques restants

| Risque | Niveau | Mitigation |
| --- | --- | --- |
| Le rapport ne duplique pas recursivement son propre contenu | Bas | Le rapport est lui-meme le contenu complet du fichier rapport ; la duplication recursive est impossible. |
| QB-01 touche un mecanisme central quick/exam | Moyen | Tests API question bank, courses, revision sessions requis. |
| MODE-01 peut devenir une refonte UI | Moyen | Le limiter au wording, cartes et navigation honnete. |
| EXAM-02 peut absorber trop de scope | Eleve | Le scinder en blueprint, orchestrateur API, flow App. |

## 11. Contenu complet des fichiers crees

Les documents sont miroirs entre API et App. Les contenus complets canoniques ci-dessous s'appliquent aux deux repos. Le present fichier est le rapport complet ; il n'est pas recopie dans lui-meme pour eviter une recursion infinie.

### ROADMAP_V3_1_PRODUCT_MODES_PLAN.md

````markdown
# Roadmap V3.1 - Product Modes Plan

## 1. Etat actuel

Le MVP core est ferme et les chantiers `PLUS-02` et `PLUS-03` sont termines.

Baselines relevees au debut du lot :

| Repo | HEAD |
| --- | --- |
| API | `18972db47371e59127f86869cab13089d69a324e` |
| App | `41d72438c35fd94a92741fde27f42697a168b7ff` |

Le produit dispose deja de briques solides : revision rapide course-level, QCM riche, preparation examen QCM-only, question ouverte, fiches, historique et question bank. Le probleme n'est pas l'absence totale de fonctionnalite, mais la confusion entre les promesses produit.

## 2. Objectif V3.1

V3.1 stabilise la taxonomie produit avant de relancer les lots fonctionnels. La roadmap separe explicitement :

| Surface | Promesse |
| --- | --- |
| Fiche | Je veux comprendre le cours. |
| Revision rapide | Je veux me tester vite. |
| QCM complet | Je veux m'entrainer serieusement avec des questions variees. |
| Revision approfondie | Je veux rediger et recevoir une correction detaillee. |
| Preparation examen - QCM | Je veux un entrainement examen court, actuellement limite aux QCM. |
| Preparation examen mixte | Je veux simuler un entrainement global proche d'un sujet. |

## 3. Ce qui est stable

- Les sessions `QUICK`, `EXAM` et `DEEP` existent dans le modele API.
- La revision rapide course-level peut demarrer une session `QUICK` avec un `DIAGNOSTIC_QUIZ`.
- La preparation examen peut demarrer une session `EXAM`, mais elle reutilise le meme pool QCM simple que quick.
- Le QCM riche existe avec generation, soumission, correction, resultat et historique.
- La question ouverte existe avec generation, soumission, evaluation IA et mise a jour de maitrise.
- L'App sait afficher des sessions quick/exam, des resultats quick/exam, les questions riches et la question ouverte.

## 4. Ce qui est volontairement incomplet

- La preparation examen n'est pas encore un mode mixte : elle est QCM-only.
- Le QCM riche n'a pas encore une vraie facade course-level claire depuis `CourseDetailPage`.
- La revision approfondie est encore affichee comme indisponible dans le detail cours.
- La question ouverte n'a pas encore de lifecycle/result/history deep course-level.
- L'historique affiche quick, rich closed et exam, mais sans taxonomie produit unifiee.
- La question bank prepare un minimum par notion et peut produire 35 ou 65 questions pour une demande utilisateur de 10 questions.

## 5. Ordre recommande

| Ordre | Lot | Statut cible | Raison |
| --- | --- | --- | --- |
| 1 | `RESET-01` | `DONE` | Formaliser la taxonomie, le mapping et les trackers V3.1. |
| 2 | `QB-01` | `TODO` | Corriger la sur-generation avant de redefinir les cartes produit. |
| 3 | `MODE-01` | `TODO` | Renommer/clarifier les cartes et eviter les promesses fausses. |
| 4 | `RICH-01` | `TODO` | Reexposer le QCM complet depuis le cours avec une promesse distincte. |
| 5 | `DEEP-01A` | `TODO` | Activer la question ouverte comme coeur de la revision approfondie. |
| 6 | `DEEP-01B` | `TODO` | Ajouter completion, resultat, historique et reopen result pour deep. |
| 7 | `EXAM-02A` | `TODO` | Concevoir l'examen mixte sans casser l'exam QCM-only existant. |
| 8 | `EXAM-02B` | `TODO` | Orchestrer QCM simple, QCM riche et question ouverte cote API. |
| 9 | `EXAM-02C` | `TODO` | Construire le flow App de l'examen mixte. |
| 10 | `QUALITY-01A` | `TODO` | Ameliorer adaptativite et dedup semantique apres stabilisation des modes. |
| 11 | `QUALITY-01B` | `TODO` | Transformer les flags en cycle de remplacement. |
| 12 | `POLISH-01` | `TODO` | Unifier historique, wording, loaders, empty states et erreurs. |
| 13 | `IDENTITY-01` | `TODO` | Integrer Rena apres stabilisation produit et polish UX. |

## 6. Dependances

`QB-01` doit preceder `MODE-01`, car l'UX ne doit pas continuer a afficher le nombre brut du pool comme promesse produit. `MODE-01` doit preceder `RICH-01` et `DEEP-01A`, car les nouvelles entrees course-level doivent utiliser une taxonomie stable.

`EXAM-02A` doit attendre `RICH-01` et `DEEP-01B`, car l'examen mixte depend d'un QCM complet expose et d'une revision approfondie result/history fiable. `QUALITY-01` doit attendre la clarification des modes pour ne pas optimiser un pool dont la responsabilite produit est encore floue.

## 7. Non-objectifs V3.1

- Pas d'implementation API.
- Pas d'implementation App.
- Pas de modification Prisma.
- Pas de migration.
- Pas de modification des prompts IA ou providers IA.
- Pas de refonte UI.
- Pas de suppression de code.
- Pas de commit, push, merge, rebase ou tag.

## 8. Criteres de succes

- Quick, QCM complet, deep et exam ont chacun une promesse claire.
- La preparation examen actuelle est nommee comme QCM-only.
- Le probleme 35/65 questions est explique par le minimum par notion.
- `QB-01` est le prochain lot code prioritaire.
- Les trackers V3.1 sont prets a l'emploi.
- Les documents V3 et V2 existants restent intacts.
````

### PRODUCT_MODE_CONTRACT.md

````markdown
# Product Mode Contract V3.1

## Principes

Un mode produit doit avoir une promesse, une entree utilisateur, une source de donnees, une validation et un historique coherent. Un mode ne doit pas emprunter le wording d'un autre mode s'il n'en livre pas la promesse.

## Fiche

| Champ | Contrat |
| --- | --- |
| Promesse | Je veux comprendre le cours. |
| Contenu cible | Resume structure, notions importantes, definitions, exemples, sources. |
| Entree | Carte ou onglet `Fiche` depuis le cours. |
| Donnees | Study artifacts et revision sheets existants. |
| Resultat | Pas une session notee ; lecture et comprehension. |
| Historique | Pas prioritaire en V3.1. |
| Interdits | Ne pas presenter une fiche comme un entrainement. |

## Revision rapide

| Champ | Contrat |
| --- | --- |
| Promesse | Je veux me tester vite. |
| Contenu cible | 5 ou 10 QCM simples, choix simple ou multiple, session courte. |
| Entree | Carte `Revision rapide` depuis le cours. |
| Donnees | Question bank quick, `DIAGNOSTIC_QUIZ`, session `QUICK`. |
| Resultat | Score simple serveur, corrections simples, historique quick. |
| Compteurs | Afficher une readiness simple, pas le nombre brut du pool comme promesse. |
| Interdits | Ne pas laisser croire que quick couvre les questions riches ou la redaction. |

## QCM complet

| Champ | Contrat |
| --- | --- |
| Promesse | Je veux m'entrainer serieusement avec des questions variees. |
| Contenu cible | 6, 10 ou 13 questions riches. |
| Types | Single choice, multiple choice, matching, ordering, case qualification, error detection, timeline, date slider, true/false grid, cause/consequence, institution matrix, diagram labeling, calculation MCQ. |
| Image choice | Disponible techniquement, mais a garder optionnel si le contenu visuel n'est pas fiable. |
| Entree | Carte `QCM complet` depuis le cours apres `MODE-01`/`RICH-01`. |
| Donnees | Rich closed exercise existant. |
| Resultat | Resultat rich closed existant. |
| Historique | Historique rich closed existant, expose comme `QCM complet`. |
| Interdits | Ne pas melanger avec `Preparation examen`. |

## Revision approfondie

| Champ | Contrat |
| --- | --- |
| Promesse | Je veux rediger et recevoir une correction detaillee. |
| Contenu cible | Question ouverte, reponse longue, correction IA, score si disponible, points reussis, points manquants, erreurs, reponse modele, conseils, sources. |
| Entree | Carte `Revision approfondie` depuis le cours apres `DEEP-01A`. |
| Donnees | Open question existant, evaluation IA existante, session `DEEP` a finaliser. |
| Resultat | A construire dans `DEEP-01B`. |
| Historique | A construire dans `DEEP-01B`. |
| Interdits | Ne pas reduire deep a une fiche ou a un QCM. |

## Preparation examen - QCM

| Champ | Contrat |
| --- | --- |
| Nom temporaire | `Preparation examen - QCM`. |
| Promesse | Je veux un entrainement examen court, actuellement limite aux QCM. |
| Contenu actuel | QCM simples issus du pool quick, session `EXAM`, resultat/historique exam. |
| Entree | Page `Preparation examen` existante, wording a clarifier dans `MODE-01`. |
| Donnees | Question bank quick, `DIAGNOSTIC_QUIZ`, routes exam preparation. |
| Resultat | Resultat exam existant, score serveur. |
| Historique | Historique exam existant. |
| Interdits | Ne pas pretendre que ce mode contient deja QCM riche + question ouverte. |

## Preparation examen mixte

| Champ | Contrat |
| --- | --- |
| Lot | `EXAM-02A`, `EXAM-02B`, `EXAM-02C`. |
| Promesse cible | Je veux simuler un entrainement global proche d'un sujet. |
| Contenu cible | Section QCM simple, section questions riches, section question ouverte, resultat global, historique examen. |
| Donnees | Quick pool, rich closed, open question/deep. |
| Resultat | Score serveur agrege, detail par section. |
| Interdits | Ne pas le lancer avant `RICH-01` et `DEEP-01B`. |
````

### TECHNICAL_MODE_MAPPING.md

````markdown
# Technical Mode Mapping V3.1

## API - question bank

Audit des fichiers :

- `src/modules/activities/application/question-bank.service.ts`
- `src/modules/activities/application/question-bank.repository.ts`
- `src/modules/activities/infrastructure/prisma-question-bank.repository.ts`
- `src/modules/courses/application/course-question-bank-readiness.use-case.ts`
- `src/modules/courses/application/process-course-question-bank-preparation-job.use-case.ts`
- `src/modules/jobs/infrastructure/course-question-bank-preparation.consumer.ts`
- `src/modules/courses/infrastructure/prisma-course-question-bank-preparation.repository.ts`

Constats :

- `QUICK_QUESTION_BANK_MIN_QUESTION_COUNT = 5`.
- `QUICK_QUESTION_BANK_DEFAULT_QUESTION_COUNT = 10`.
- `QUICK_QUESTION_BANK_MAX_QUESTION_COUNT = 30`.
- `QUICK_QUESTION_BANK_GENERATION_BATCH_SIZE = 2`.
- `QUICK_QUESTION_BANK_ACTIVE_CAP_PER_COURSE = 100`.
- `QUICK_QUESTION_BANK_PREPARATION_MIN_PER_KU = 5`.
- `PrepareCourseQuestionBankUseCase` calcule `targetQuestionCountPerKnowledgeUnit = max(5, ceil(targetQuestionCount / knowledgeUnitCount))`.
- Un job est assure pour chaque knowledge unit candidate avec ce `targetQuestionCountPerKnowledgeUnit`.
- Le worker appelle `prepareCourseQuickQuestionBank` pour une knowledge unit et cherche a atteindre le target du job.
- Les jobs recents sont consideres utiles si leur target est au moins le target attendu par notion.

Conclusion 35/65 :

- Demande 10 questions sur 7 notions : `max(5, ceil(10 / 7)) = 5`, donc 7 jobs peuvent viser 5 questions chacun, soit 35 questions actives.
- Demande 10 questions sur 13 notions : `max(5, ceil(10 / 13)) = 5`, donc 13 jobs peuvent viser 5 questions chacun, soit 65 questions actives.
- Le systeme confond `sessionQuestionCount` et `poolTarget` par notion.

## API - quick / exam

Audit des fichiers :

- `src/modules/courses/application/start-course-quick-revision-session.use-case.ts`
- `src/modules/courses/application/get-course-exam-preparation-options.use-case.ts`
- `src/modules/courses/application/start-course-exam-preparation-session.use-case.ts`
- `src/modules/revision-sessions/application/exam-preparation-sessions.use-cases.ts`
- `src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.ts`

Constats :

- Quick demarre une session `QUICK` avec `preferredAction: diagnostic_quiz`.
- Quick utilise `QuestionBankService.createCourseQuickDiagnosticQuiz`.
- Exam demarre une session `EXAM`, mais utilise aussi `QuestionBankService.createCourseQuickDiagnosticQuiz`.
- Exam accepte actuellement 10, 20 ou 30 questions.
- Exam et quick divergent surtout par le `mode`, les routes de chargement/soumission/resultat et l'historique.
- Exam n'utilise pas encore rich closed ni open question.

## API - rich closed

Audit des fichiers :

- `src/modules/activities/application/rich-closed-questions/start-rich-closed-exercise.use-case.ts`
- `src/modules/activities/application/rich-closed-questions/rich-closed-question-generation-profile.ts`
- `src/modules/activities/application/rich-closed-questions/rich-closed-question.types.ts`
- `src/modules/activities/application/rich-closed-questions/submit-rich-closed-exercise.use-case.ts`
- `src/modules/activities/application/rich-closed-questions/get-rich-closed-exercise-result.use-case.ts`
- `src/modules/activities/application/rich-closed-questions/list-course-rich-closed-exercise-history.use-case.ts`

Constats :

- Les types existent : `single_choice`, `multiple_choice`, `matching`, `ordering`, `case_qualification`, `error_detection`, `timeline`, `date_slider`, `true_false_grid`, `cause_consequence`, `institution_matrix`, `diagram_labeling`, `calculation_mcq`, `image_choice`.
- Le nombre de questions rich closed est valide de 1 a 20.
- Le defaut de demarrage est 6 questions.
- Les profils de complexite disponibles sont `standard`, `exam`, `advanced`.
- La distribution limite le ratio de `single_choice` a 40%.
- `image_choice` apparait seulement dans les mixes les plus larges et doit rester prudent cote produit.
- Le resultat et l'historique existent deja.
- Il manque une facade course-level claire : choix du cours/notion, presets 6/10/13, wording `QCM complet`, navigation depuis `CourseDetailPage`.

## API - open question / deep

Audit des fichiers :

- `src/modules/activities/application/start-open-question-activity.use-case.ts`
- `src/modules/activities/application/submit-open-answer.use-case.ts`
- `src/modules/activities/application/open-question-generator.ts`
- `src/modules/activities/application/open-answer-evaluator.ts`
- `src/modules/activities/infrastructure/prisma-activities.repository.ts`
- `src/modules/revision-sessions/application/start-revision-session.use-case.ts`
- `src/modules/revision-sessions/application/request-next-revision-session-action.use-case.ts`
- `src/modules/revision-sessions/domain/revision-session.entity.ts`
- `prisma/schema.prisma`

Constats :

- `RevisionSessionModeValue` contient `QUICK`, `DEEP`, `EXAM`.
- `RevisionSessionActionKindValue` contient `DIAGNOSTIC_QUIZ`, `OPEN_QUESTION`, `RICH_CLOSED_EXERCISE`.
- `StartRevisionSessionUseCase` peut demarrer une action `OPEN_QUESTION`.
- La question ouverte genere une question depuis une knowledge unit.
- Si aucun contexte source n'est disponible, un fallback sans chunks existe.
- La soumission open answer appelle un evaluateur IA, sauvegarde score, feedback, points presents/manquants, erreurs, modele, conseils et sources.
- Il manque un lifecycle `DEEP` course-level complet : start dedie, completion, result, history, reopen result.

## App - course detail / modes

Audit des fichiers :

- `lib/features/courses/presentation/course_detail_page.dart`
- `lib/features/courses/presentation/course_exam_preparation_page.dart`
- `lib/features/courses/application/courses_providers.dart`
- `lib/features/courses/data/http_courses_repository.dart`
- `lib/features/courses/domain/courses_repository.dart`
- `lib/features/courses/domain/course_models.dart`

Constats :

- `CourseDetailPage` affiche `Revision rapide`, `Revision approfondie`, `Preparation examen`.
- `Revision approfondie` est desactivee avec `Bientot disponible`.
- `Preparation examen` ouvre une page dediee et peut demarrer un entrainement.
- L'UI expose encore des compteurs comme `X questions pretes`.
- L'historique combine quick, rich closed et exam dans une meme zone, avec labels differents mais sans taxonomie finale.
- Le QCM riche existe dans l'historique mais pas comme carte principale distincte `QCM complet`.

## App - activities / rich / open

Audit des fichiers :

- `lib/presentation/pages/activities/activities_page.dart`
- `lib/presentation/pages/activities/open_question_page.dart`
- `lib/presentation/pages/activities/rich_closed_exercise_page.dart`
- `lib/presentation/pages/activities/rich_closed_exercise_result_page.dart`
- `lib/features/activities/application/activity_controller.dart`
- `lib/features/activities/domain/open_question_activity.dart`
- `lib/features/activities/domain/rich_closed_exercise.dart`

Constats :

- La page activities expose `QCM`, `Question ouverte`, `Revision IA`, `Questions riches`.
- `Question ouverte` et `Questions riches` demandent une notion precise.
- `RichClosedExercisePage` et `RichClosedExerciseResultPage` existent.
- `OpenQuestionPage` affiche la question, la saisie, la correction et les sources.
- Ces briques sont reutilisables pour des entrees course-level, mais l'utilisateur ne les voit pas encore comme modes stables depuis le cours.

## App - revision sessions

Audit des fichiers :

- `lib/presentation/pages/revision_sessions/revision_session_page.dart`
- `lib/presentation/pages/revision_sessions/revision_session_result_page.dart`
- `lib/features/revision_sessions/presentation/exam_revision_session_flow.dart`
- `lib/features/revision_sessions/application/revision_session_controller.dart`
- `lib/features/revision_sessions/data/http_revision_sessions_api.dart`
- `lib/features/revision_sessions/domain/revision_session.dart`

Constats :

- Le domaine App parse `quick`, `deep`, `exam`.
- Le flow quick course-level et le flow exam ont des chemins distincts.
- `ExamRevisionSessionFlow` affiche une preparation examen QCM-only.
- La page generique sait afficher des payloads diagnostic quiz, open question et rich closed launcher.
- Le mode `DEEP` est parse mais pas encore livre comme flow course-level complet.
````

### QUESTION_BANK_BUDGET_PLAN.md

````markdown
# Question Bank Budget Plan V3.1

## Probleme

La question bank quick prepare aujourd'hui un minimum par notion. Ce choix protege la diversite du pool, mais il rend le nombre visible cote produit trompeur.

Le comportement actuel :

```text
sessionQuestionCount = demande utilisateur, par exemple 10
knowledgeUnitCount = nombre de notions candidates
targetQuestionCountPerKnowledgeUnit = max(5, ceil(sessionQuestionCount / knowledgeUnitCount))
jobCount = knowledgeUnitCount
poolPreparedPotential = targetQuestionCountPerKnowledgeUnit * knowledgeUnitCount
```

Exemples :

| Demande | Notions | Target par notion | Pool potentiel |
| --- | ---: | ---: | ---: |
| 10 | 7 | 5 | 35 |
| 10 | 13 | 5 | 65 |
| 20 | 7 | 5 | 35 |
| 30 | 7 | 5 | 35 |

## Decision

`QB-01` doit separer trois notions :

| Nom | Sens |
| --- | --- |
| `sessionQuestionCount` | Nombre demande pour la session utilisateur. |
| `poolTarget` | Nombre total souhaite dans le pool pour servir les sessions proches. |
| `perKnowledgeUnitTarget` | Budget cible par notion, calcule depuis le deficit reel et borne. |

## Contrat QB-01

Un lot `QB-01` reussi doit garantir :

- Une demande de 10 questions sur 7 notions ne cree pas 35 questions par defaut.
- Une demande de 10 questions sur 13 notions ne cree pas 65 questions par defaut.
- Si le pool course-level est deja suffisant, aucun job n'est cree.
- Les jobs sont crees seulement pour un deficit reel.
- Le systeme garde une repartition raisonnable entre notions sans viser 5 questions partout.
- Le cap course-level reste respecte.
- La readiness distingue clairement `readyForSession` et `poolExpansionInProgress`.

## Algorithme cible

1. Calculer `sessionQuestionCount` avec les bornes existantes 5..30.
2. Compter les questions actives course-level sur les notions candidates.
3. Si `activeCourseCount >= sessionQuestionCount`, ne creer aucun job.
4. Calculer `deficit = sessionQuestionCount - activeCourseCount`.
5. Selectionner les notions les moins couvertes.
6. Distribuer le deficit sur ces notions, avec un petit buffer optionnel mais borne.
7. Creer des jobs uniquement pour les notions dont `activeKnowledgeUnitCount < perKnowledgeUnitTarget`.
8. Ne pas depasser le cap course-level.

## Exemple cible

| Situation | Comportement cible |
| --- | --- |
| 7 notions, 0 question, demande 10 | Creer environ 10 a 14 questions, pas 35. |
| 13 notions, 0 question, demande 10 | Creer environ 10 a 16 questions, pas 65. |
| 13 notions, 12 questions actives, demande 10 | Aucun job. |
| 13 notions, 8 questions actives, demande 10 | Creer seulement le deficit utile, pas 13 jobs de 5. |

## Donnees a exposer apres QB-01

La readiness devrait exposer ou permettre de deduire :

- `readyQuestionCount`
- `sessionQuestionCount`
- `poolTarget`
- `missingForSession`
- `isPreparing`
- `canStartQuickRevision`
- `canPrepareMore`

## Non-objectifs QB-01

- Pas de dedup semantique.
- Pas de flag lifecycle.
- Pas de refonte rich closed.
- Pas d'examen mixte.
- Pas de changement de prompts IA sauf necessite separee et explicite.
````

### EXECUTION_LOT_TRACKER_V3_1.md

````markdown
# Execution Lot Tracker V3.1

Statuts autorises : `TODO`, `IN_PROGRESS`, `BLOCKED`, `READY_FOR_REVIEW`, `DONE`, `POSTPONED`.

| Lot | Parent | Horizon | Repo(s) | Statut | Depend de | Objectif | Validation attendue | Rapport attendu | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RESET-01 | RESET | H0 | API + App | DONE | Aucun | Creer la taxonomie produit, le mapping technique, les trackers et le handoff V3.1. | `git diff --check` dans les deux repos. | `ROADMAP_V3_1_CREATION_REPORT.md` | Lot documentaire uniquement. |
| QB-01 | QB | H1 | API + App | TODO | RESET-01 | Corriger la sur-generation question bank et separer session count / pool target / per-KU target. | Tests API question bank/readiness + tests App readiness si wording change. | `QB_01_QUESTION_BANK_BUDGET_REPORT.md` | Prochain lot recommande. |
| MODE-01 | MODE | H1 | App + API si necessaire | TODO | QB-01 | Stabiliser les cartes course-level et le wording des modes. | Tests widget course detail + tests repository si contrat change. | `MODE_01_CANONICAL_REVISION_MODES_REPORT.md` | Renommer exam actuel en `Preparation examen - QCM`. |
| RICH-01 | RICH | H1 | API + App | TODO | MODE-01 | Reexposer QCM complet depuis le cours. | Tests API rich history/start + tests App route/page/course detail. | `RICH_01_COURSE_LEVEL_QCM_COMPLET_REPORT.md` | Presets 6/10/13. |
| DEEP-01A | DEEP | H2 | API + App | TODO | MODE-01 | Activer question ouverte depuis le cours. | Tests API open question ownership + tests App page/flow. | `DEEP_01A_COURSE_LEVEL_DEEP_START_REPORT.md` | Pas encore result/history deep complet. |
| DEEP-01B | DEEP | H2 | API + App | TODO | DEEP-01A | Ajouter lifecycle, completion, result, history et reopen result deep. | Tests API session DEEP + tests App result/history. | `DEEP_01B_DEEP_RESULT_HISTORY_REPORT.md` | Necessaire avant examen mixte. |
| EXAM-02A | EXAM | H3 | API + App | TODO | RICH-01, DEEP-01B | Concevoir le blueprint examen mixte versionne. | Doc review + contract tests si types ajoutes. | `EXAM_02A_MIXED_EXAM_BLUEPRINT_REPORT.md` | Pas d'orchestrateur complet. |
| EXAM-02B | EXAM | H3 | API | TODO | EXAM-02A | Creer l'orchestrateur API examen mixte et le resultat agrege. | Tests API sections/scoring/history. | `EXAM_02B_MIXED_EXAM_ORCHESTRATOR_REPORT.md` | Score final serveur. |
| EXAM-02C | EXAM | H3 | App | TODO | EXAM-02B | Creer le flow App examen mixte. | Tests App flow sections/result. | `EXAM_02C_MIXED_EXAM_APP_FLOW_REPORT.md` | Remplace progressivement exam QCM-only. |
| QUALITY-01A | QUALITY | H4 | API | TODO | RICH-01, QB-01 | Adapter le pool et reduire les doublons semantiques. | Tests duplicate/audit/pool quality. | `QUALITY_01A_ADAPTIVE_POOL_DEDUP_REPORT.md` | Apres stabilisation des modes. |
| QUALITY-01B | QUALITY | H4 | API + App | TODO | QUALITY-01A | Transformer les flags en cycle de remplacement. | Tests flags + tests App signalement. | `QUALITY_01B_FLAG_REPLACEMENT_REPORT.md` | Ne pas faire avant dedup. |
| POLISH-01 | POLISH | H5 | App + API si necessaire | TODO | MODE-01, RICH-01, DEEP-01B | Unifier historique, wording, empty states, loaders et erreurs. | Tests widget history/errors + smoke manuel. | `POLISH_01_UNIFIED_HISTORY_UX_REPORT.md` | Avant mascotte. |
| IDENTITY-01 | IDENTITY | H6 | App | TODO | POLISH-01 | Integrer Rena et les micro-interactions. | Tests widget/animation + smoke visuel. | `IDENTITY_01_RENA_INTEGRATION_REPORT.md` | Reporte apres polish UX. |
````

### LOT_TRACKER_V3_1.md

````markdown
# Parent Lot Tracker V3.1

Statuts autorises : `TODO`, `IN_PROGRESS`, `BLOCKED`, `READY_FOR_REVIEW`, `DONE`, `POSTPONED`.

| Parent | Nom | Horizon | Repo(s) | Statut | Depend de | Lots executables | Objectif produit | Definition of done | Rapports |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RESET | Product modes reset | H0 | API + App | DONE | Aucun | RESET-01 | Clarifier les modes et l'ordre de reprise. | Docs V3.1 crees dans les deux repos, prochain lot recommande clair. | `ROADMAP_V3_1_CREATION_REPORT.md` |
| QB | Question bank budget | H1 | API + App | TODO | RESET | QB-01 | Arreter la sur-generation et rendre la readiness honnete. | 35/65 corriges, jobs limites au deficit reel, tests verts. | `QB_01_QUESTION_BANK_BUDGET_REPORT.md` |
| MODE | Canonical revision modes | H1 | App + API si necessaire | TODO | QB | MODE-01 | Afficher des cartes de cours coherentes et honnetes. | Quick, QCM complet, deep, exam QCM nommes clairement. | `MODE_01_CANONICAL_REVISION_MODES_REPORT.md` |
| RICH | Course-level QCM complet | H1 | API + App | TODO | MODE | RICH-01 | Rendre les questions riches accessibles depuis le cours. | Page/entry course-level, presets, result et history branches. | `RICH_01_COURSE_LEVEL_QCM_COMPLET_REPORT.md` |
| DEEP | Revision approfondie | H2 | API + App | TODO | MODE | DEEP-01A, DEEP-01B | Transformer la question ouverte en mode course-level complet. | Start, correction, result, history et reopen result disponibles. | `DEEP_01A...`, `DEEP_01B...` |
| EXAM | Preparation examen mixte | H3 | API + App | TODO | RICH, DEEP | EXAM-02A, EXAM-02B, EXAM-02C | Passer de exam QCM-only a un entrainement mixte. | Blueprint, orchestrateur API, flow App et resultat agrege. | `EXAM_02A...`, `EXAM_02B...`, `EXAM_02C...` |
| QUALITY | Pool quality and flags | H4 | API + App | TODO | QB, RICH | QUALITY-01A, QUALITY-01B | Ameliorer qualite, doublons et remplacement. | Dedup/adaptativite puis lifecycle flag livres et testes. | `QUALITY_01A...`, `QUALITY_01B...` |
| POLISH | Unified UX cleanup | H5 | App + API si necessaire | TODO | MODE, RICH, DEEP | POLISH-01 | Rendre l'experience lisible et coherente. | Historique unifie, wording, loaders, empty states, erreurs. | `POLISH_01_UNIFIED_HISTORY_UX_REPORT.md` |
| IDENTITY | Rena mascot | H6 | App | TODO | POLISH | IDENTITY-01 | Ajouter l'identite vivante apres stabilisation. | Mascotte et animations integrees sans masquer les modes. | `IDENTITY_01_RENA_INTEGRATION_REPORT.md` |
````

### ROADMAP_V3_1_DECISIONS.md

````markdown
# Roadmap V3.1 Decisions

## Decisions structurantes

1. On ne lance pas `PLUS-01A` avant clarification des modes. La revision approfondie doit etre redessinee comme `DEEP-01A` puis `DEEP-01B`.
2. La preparation examen actuelle est QCM-only. Elle utilise une session `EXAM`, mais son activite principale reste un `DIAGNOSTIC_QUIZ`.
3. La preparation examen doit etre renommee temporairement `Preparation examen - QCM` cote utilisateur.
4. `QCM complet` doit etre separe de `Preparation examen`. Les questions riches portent la promesse d'entrainement varie ; l'exam porte a terme une promesse mixte.
5. `Revision approfondie` doit porter la question ouverte, la redaction et la correction IA detaillee.
6. Le pool quick ne doit plus piloter toutes les promesses produit. Il sert quick et exam QCM-only, pas QCM complet ni deep.
7. Les 35/65 questions viennent du minimum par notion : `max(5, ceil(questionCount / knowledgeUnitCount))`.
8. Le prochain lot code prioritaire est `QB-01` apres `RESET-01`.
9. L'examen mixte doit etre un chantier ulterieur `EXAM-02`, apres QCM complet course-level et deep result/history.
10. Rena / mascotte est reportee apres `POLISH-01`, car l'identite ne doit pas compenser une taxonomie confuse.

## Decisions de wording

| Surface actuelle | Wording V3.1 recommande | Raison |
| --- | --- | --- |
| Revision rapide | Revision rapide | Promesse courte et deja fonctionnelle. |
| Preparation examen | Preparation examen - QCM | Evite de promettre un examen mixte. |
| Questions riches | QCM complet | Plus clair depuis un cours. |
| Revision approfondie | Revision approfondie | A associer explicitement a la question ouverte. |
| Historique | Historique, puis filtres/labels par mode | Evite l'empilement indifferencie. |

## Decisions de priorite

`QB-01` passe avant `MODE-01`, car la readiness et les compteurs influencent l'UX. `MODE-01` passe avant `RICH-01` et `DEEP-01A`, car les nouvelles entrees doivent s'inscrire dans une taxonomie stable.

`QUALITY-01` attend que quick, QCM complet, deep et exam soient separes. Sinon le travail de qualite risque de corriger le mauvais pool.
````

### ROADMAP_V3_1_HANDOFF_TO_CODEX.md

````markdown
# Roadmap V3.1 Handoff To Codex

## Etat actuel stable

- API HEAD audite : `18972db47371e59127f86869cab13089d69a324e`.
- App HEAD audite : `41d72438c35fd94a92741fde27f42697a168b7ff`.
- MVP core, `PLUS-02` et `PLUS-03` sont termines.
- Quick course-level fonctionne.
- Preparation examen fonctionne en QCM-only avec session/result/history.
- QCM riche fonctionne techniquement avec result/history.
- Question ouverte fonctionne techniquement avec evaluation IA.

## Problemes critiques

1. Quick et exam utilisent le meme pool QCM simple.
2. Exam est nomme trop largement alors qu'il est QCM-only.
3. QCM complet existe mais n'est pas une carte course-level stable.
4. Deep existe par briques open question mais pas comme mode course-level complet.
5. La question bank peut generer 35/65 questions a cause du minimum par notion.
6. L'historique empile les modes sans taxonomie finale.

## Ordre recommande

1. `QB-01`
2. `MODE-01`
3. `RICH-01`
4. `DEEP-01A`
5. `DEEP-01B`
6. `EXAM-02A`
7. `EXAM-02B`
8. `EXAM-02C`
9. `QUALITY-01A`
10. `QUALITY-01B`
11. `POLISH-01`
12. `IDENTITY-01`

## Prochain lot recommande

`QB-01 - Question-bank budget planner & overgeneration fix`.

Objectif du prochain prompt : corriger la sur-generation en separant `sessionQuestionCount`, `poolTarget` et `perKnowledgeUnitTarget`.

Validation attendue :

- Tests API sur `course-question-bank-readiness`.
- Tests API sur `question-bank.service`.
- Tests repository/job si le contrat de jobs change.
- `npm run build`.
- `npm run lint:check`.
- `npm test -- question-bank --runInBand`.
- `npm test -- courses --runInBand`.
- `git diff --check`.

## Pieges a eviter

- Ne pas relancer `PLUS-01A` tel quel.
- Ne pas presenter exam comme mixte avant `EXAM-02`.
- Ne pas melanger QCM complet et preparation examen.
- Ne pas corriger les 35/65 uniquement par wording App.
- Ne pas modifier prompts IA pendant `QB-01` sauf necessite explicite.
- Ne pas casser quick, exam QCM-only, rich closed result/history ou open question.
- Ne pas afficher le nombre brut du pool comme promesse principale.

## Regles pour les futurs lots

- Chaque lot doit rester petit ou moyen.
- Chaque lot doit avoir tests cibles et rapport.
- Les changements App doivent eviter les faux boutons.
- Les scores canoniques restent serveur.
- Les documents V2 et V3 existants ne doivent pas etre reecrits.
- Les trackers V3.1 doivent etre mis a jour a chaque lot.
````

## 12. Auto-review finale

| Question | Verdict |
| --- | --- |
| La roadmap distingue quick / QCM complet / deep / exam ? | Oui. |
| Le probleme 35/65 est-il explique ? | Oui, par `QUICK_QUESTION_BANK_PREPARATION_MIN_PER_KU = 5`. |
| Le prochain lot `QB-01` est-il precis ? | Oui. |
| QCM complet est-il separe de Preparation examen ? | Oui. |
| Revision approfondie porte-t-elle la question ouverte ? | Oui. |
| Preparation examen mixte est-elle reportee ? | Oui, vers `EXAM-02`. |
| Aucun code produit modifie ? | Oui. |
| Aucun commit/push effectue ? | Oui. |
| Documents presents dans les deux repos ? | Oui. |

## 13. Critique du prompt

Prompt clair et necessaire : il corrige une derive frequente ou la roadmap technique avance plus vite que la promesse utilisateur. La seule contrainte delicate est le "contenu complet" dans le rapport : le rapport inclut les contenus canoniques des documents crees et evite uniquement la duplication recursive de lui-meme.
