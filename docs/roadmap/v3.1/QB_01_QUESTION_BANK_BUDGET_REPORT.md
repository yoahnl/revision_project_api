# QB-01 - Question-bank budget planner & overgeneration fix

## 1. HEAD releves

API HEAD au depart : `51572f206a4df21adbb8eea9a5f534c8694134dd`.

App HEAD au depart : `d6529d8086a1813d55c7c2803b3e1fbdec724b57`.

Aucun commit, push, merge, rebase, amend, tag ou deploiement n'a ete effectue.

## 2. Audit initial

`RESET-01` est `DONE` dans les trackers V3.1. `QB-01` etait le prochain lot prioritaire, avant `MODE-01`. Les docs V3.1 API et App etaient synchronisees.

Cote API, la sur-generation venait de `PrepareCourseQuestionBankUseCase` : chaque notion candidate recevait une cible `max(5, ceil(sessionQuestionCount / knowledgeUnitCount))`. Le meme seuil etait recalcule dans `summarizePreparationJobs`, ce qui ignorait les jobs plus petits. `QuestionBankService.prepareCourseQuickQuestionBank` reutilisait aussi le validateur de session 5..30 pour une cible interne par notion.

Cote App, la promesse principale du detail cours affichait le nombre brut du pool, par exemple `9 questions pretes`, alors que ce nombre ne doit pas devenir la promesse produit principale de QB-01.

Sub-agents utilises en lecture seule :

- Roadmap Agent : a confirme `RESET-01 : DONE`, `QB-01` prochain lot, `QB-01` avant `MODE-01`, docs API/App sans ecart.
- API Question Bank Agent : a confirme les deux calculs `max(5, ceil(...))`, les tests existants et le risque quick/exam QCM-only.
- App UX Agent : a confirme que le wording brut etait dans `course_detail_page.dart` et qu'un changement local suffisait.

## 3. Cause exacte du bug 35/65

Le bug confondait trois concepts :

- `sessionQuestionCount` : nombre de questions demande pour la session utilisateur.
- `poolTarget` : nombre total actif souhaite dans le pool pour couvrir cette session.
- `perKnowledgeUnitTarget` : cible interne par notion.

Avec 7 notions et une demande de 10, l'ancien calcul produisait `7 * 5 = 35`. Avec 13 notions et une demande de 10, il produisait `13 * 5 = 65`.

## 4. Architecture retenue

Une fonction pure `buildCourseQuestionBankPreparationPlan` calcule maintenant le plan de preparation sans Nest ni Prisma. Le use case courses l'utilise apres avoir lu les counts actifs par notion via un nouveau port repository groupe.

Le validateur public `resolveQuickQuestionBankQuestionCount` reste borne a 5..30 pour les sessions utilisateur. Un validateur interne separe `resolveQuickQuestionBankPreparationTargetCount` accepte les cibles par notion de 1 a 30.

## 5. Algorithme final

Pour QB-01 V1, `poolTarget = sessionQuestionCount`, borne par le cap actif course-level.

Si le pool actif couvre deja la session, aucun job n'est cree.

Sinon, le deficit reel est distribue sur les notions candidates les moins couvertes, avec tri stable par count actif ascendant puis ordre naturel repository. Les jobs ne sont crees que pour les notions qui recoivent au moins une question a generer.

Exemples couverts par tests :

- 7 notions, session 10 : cibles `2,2,2,1,1,1,1`, total 10.
- 13 notions, session 10 : 10 notions a 1, total 10.
- 13 notions, session 30 : cibles `3,3,3,3,2,2,2,2,2,2,2,2,2`, total 30.
- Pool suffisant : aucun job.
- Pool partiel : jobs limites au deficit.

## 6. Impact API

Ajouts :

- Planner pur et tests dedies.
- Port `countActiveCourseQuickQuestionsByKnowledgeUnit`.
- Implementation Prisma `groupBy` sur `knowledgeUnitId`.
- Validateur interne pour target de preparation 1..30.

Modifications :

- `PrepareCourseQuestionBankUseCase` cree des jobs selon le plan et non plus un job 5-min par notion.
- `summarizePreparationJobs` n'ignore plus les jobs actifs sous 5.
- Le worker reste compatible et transmet les targets internes inferieurs a 5 au service.

Non modifie :

- Prisma schema et migrations.
- Prompts IA et providers IA.
- Rich closed, open question, exam mixte.
- Reservation quick et snapshots de session.

## 7. Impact App

Changement minimal dans `course_detail_page.dart` uniquement :

- La promesse principale devient `Une session rapide peut demarrer maintenant.`
- Le badge readiness devient `Pret`.
- Le nombre brut du pool n'est plus affiche comme promesse principale.

Aucun modele, provider, repository HTTP, route, mode ou navigation n'a ete modifie.

## 8. Avant / apres

Avant :

- `7 KU + 10` pouvait planifier 35 questions.
- `13 KU + 10` pouvait planifier 65 questions.
- Une cible interne a 4 etait rejetee par le validateur 5..30.

Apres :

- `7 KU + 10` planifie 10 questions.
- `13 KU + 10` planifie 10 questions.
- `13 KU + 30` planifie 30 questions.
- Le service et le worker acceptent les targets internes 1..4.

## 9. Tests ajoutes ou adaptes

API :

- `course-question-bank-preparation-plan.spec.ts`
- `course-question-bank-readiness.use-case.spec.ts`
- `question-bank.service.spec.ts`
- `prisma-question-bank.repository.spec.ts`
- `process-course-question-bank-preparation-job.use-case.spec.ts`

App :

- `course_detail_page_test.dart`

## 10. Validations executees

Validations executees et OK :

- API `npm run build` : OK.
- API `npm run lint:check` : OK.
- API `npm test -- course-question-bank-preparation-plan --runInBand` : OK.
- API `npm test -- course-question-bank-readiness --runInBand` : OK.
- API `npm test -- question-bank.service --runInBand` : OK.
- API `npm test -- prisma-question-bank.repository --runInBand` : OK.
- API `npm test -- process-course-question-bank-preparation-job --runInBand` : OK.
- API `npm test -- question-bank --runInBand` : OK.
- API `npm test -- courses --runInBand` : OK.
- API `npm test -- revision-sessions --runInBand` : OK.
- API `git diff --check` : OK.
- App `dart analyze lib test` : OK.
- App `flutter test test/features/courses/course_detail_page_test.dart --reporter compact` : OK.
- App `flutter test test/features/courses --reporter compact` : OK.
- App `git diff --check` : OK.

## 11. Risques restants

Le planner V1 vise `poolTarget = sessionQuestionCount`. Il ne traite pas encore la qualite, la dedup semantique ni les quotas adaptatifs ; ces sujets restent pour `QUALITY-01`.

Si plusieurs jobs historiques actifs existent avec une cible ancienne, la readiness peut rester `PREPARING` jusqu'a completion ou stale. Ce choix evite de masquer un travail reel en cours et supprime la dependance au minimum historique de 5 par notion.

Aucun smoke manuel complet n'a ete execute.

## 12. Fichiers modifies

API :

- `docs/roadmap/v3.1/EXECUTION_LOT_TRACKER_V3_1.md`
- `docs/roadmap/v3.1/LOT_TRACKER_V3_1.md`
- `docs/roadmap/v3.1/QB_01_QUESTION_BANK_BUDGET_REPORT.md`
- `docs/roadmap/v3.1/QB_01_QUESTION_BANK_BUDGET_EVIDENCE_PACK.md`
- `src/modules/activities/application/question-bank.repository.ts`
- `src/modules/activities/application/question-bank.service.ts`
- `src/modules/activities/application/question-bank.service.spec.ts`
- `src/modules/activities/infrastructure/prisma-question-bank.repository.ts`
- `src/modules/activities/infrastructure/prisma-question-bank.repository.spec.ts`
- `src/modules/courses/application/course-question-bank-preparation-plan.ts`
- `src/modules/courses/application/course-question-bank-preparation-plan.spec.ts`
- `src/modules/courses/application/course-question-bank-readiness.use-case.ts`
- `src/modules/courses/application/course-question-bank-readiness.use-case.spec.ts`
- `src/modules/courses/application/process-course-question-bank-preparation-job.use-case.spec.ts`

App :

- `docs/roadmap/v3.1/EXECUTION_LOT_TRACKER_V3_1.md`
- `docs/roadmap/v3.1/LOT_TRACKER_V3_1.md`
- `docs/roadmap/v3.1/QB_01_QUESTION_BANK_BUDGET_REPORT.md`
- `docs/roadmap/v3.1/QB_01_QUESTION_BANK_BUDGET_EVIDENCE_PACK.md`
- `lib/features/courses/presentation/course_detail_page.dart`
- `test/features/courses/course_detail_page_test.dart`

## 13. Evidence pack

Le contenu detaille des modifications est documente dans `QB_01_QUESTION_BANK_BUDGET_EVIDENCE_PACK.md`.

## 14. Auto-review finale

- Le calcul `max(5, ceil(sessionQuestionCount / knowledgeUnitCount))` n'est plus utilise comme cible systematique par notion.
- `sessionQuestionCount` reste borne a 5..30.
- Les targets internes par notion peuvent etre 1..4.
- Les jobs refletent uniquement le deficit reel.
- Pool suffisant => aucun job cree.
- Quick revision et exam QCM-only utilisent encore le pool existant sans changement de mode.
- Aucun prompt IA, provider IA, schema Prisma ou migration n'a ete modifie.
- Aucun secret expose.

## 15. Critique du prompt

Le prompt etait precis et utile. Le point le plus sensible etait la double exigence "ne pas afficher le nombre brut" et "ne pas faire MODE-01" : le changement App a donc ete limite a trois libelles dans le detail cours.
