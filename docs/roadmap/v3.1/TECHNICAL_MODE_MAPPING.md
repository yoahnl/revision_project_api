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
