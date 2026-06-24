# PLUS-02A - QCM complet / rich questions recovery report

Version commune API/App. Miroir attendu côté App : `revision_project_app/docs/roadmap/v3/PLUS_02A_QCM_RICH_QUESTIONS_RECOVERY_REPORT.md`.

## Résumé

PLUS-02A récupère le socle QCM riche sans ouvrir le chantier examen. Le lot confirme le contrat API `rich_closed_exercise`, l'inventaire des types riches, le parsing/rendu Flutter, les protections anti-fuite pré-submit et les validations de non-régression quick/session/question-bank.

Le lot a volontairement évité Prisma, migrations, prompts IA, providers IA, release, refactor et nouvelle surface UI. Deux réparations bornées ont été faites : alignement `date_slider.correctYear` sur le pas public côté API, et blocage App des champs de correction `minAcceptedYear`/`maxAcceptedYear` dans un payload pré-submit.

## Audit initial PLUS-02A

- Roadmap V3 initiale : `PLUS-02A` était le premier lot recommandé avant préparation examen, quality pool, Rena, Today et release publique.
- Docs auditées : `docs/roadmap/v3`, `docs/roadmap/v2`, `docs/core`, `docs/release`, et `docs/ui` côté App. Le repo API n'a pas de dossier `docs/ui`.
- API auditée : `src/modules/activities`, `src/modules/courses`, `src/modules/revision-sessions`, `src/modules/study-artifacts`, `src/modules/documents`, `prisma/schema.prisma`.
- App auditée : `lib/features/activities`, `lib/features/courses`, `lib/features/revision_sessions`, `lib/features/documents`, `lib/presentation/pages`, `lib/presentation/design_system`, `lib/app/router`.
- Le QCM quick MVP reste `diagnostic_quiz` et n'a pas été modifié.
- Le QCM riche existe déjà sous `rich_closed_exercise` avec routes API, persistance payload/résultat, parser Flutter, renderer, widgets et présentateur de correction.
- Le contrat API supportait déjà 14 `questionKind` riches. L'app les parse et les rend via `RichClosedQuestionRenderer`.
- Le point faible trouvé dans ce lot était `date_slider` : une correction hors pas public pouvait être validée côté API.
- Le deuxième point faible était le garde Flutter anti-fuite : `minAcceptedYear` et `maxAcceptedYear` n'étaient pas encore traités comme champs de correction interdits avant soumission.
- `image_choice` existe techniquement, mais le registre App retourne `assetPath: null`. Le lot ne le revendique donc pas comme support produit complet de visuels inspectables.

## Matrice rich questions

| Type | API | App | Généré / persisté | Parsé / rendu | Testé | Décision PLUS-02A | Justification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `diagnostic_quiz` / QCM simple | Oui | Oui | Oui | Oui | Oui | SUPPORTED_NOW | Socle quick MVP stable, non modifié. |
| `single_choice` | Oui | Oui | Oui | Oui | Oui | SUPPORTED_NOW | Type rich closed de base, choix public sans correction. |
| `multiple_choice` | Oui | Oui | Oui | Oui | Oui | SUPPORTED_NOW | Min/max selections côté contrat App/API. |
| `matching` | Oui | Oui | Oui | Oui | Oui | SUPPORTED_NOW | Paires soumises et correction serveur. |
| `ordering` | Oui | Oui | Oui | Oui | Oui | SUPPORTED_NOW | Ordre public sans `correctOrder` pré-submit. |
| `case_qualification` | Oui | Oui | Oui | Oui | Oui | SUPPORTED_NOW | Cas + choix, correction post-submit. |
| `error_detection` | Oui | Oui | Oui | Oui | Oui | SUPPORTED_NOW | Options d'erreur sans `correctErrorId` pré-submit. |
| `timeline` | Oui | Oui | Oui | Oui | Oui | SUPPORTED_NOW | Événements publics, ordre de correction post-submit. |
| `date_slider` | Oui | Oui | Oui | Oui | Oui | REPAIR_NOW -> SUPPORTED_NOW | Correction réparée pour rester atteignable par le pas public. |
| `true_false_grid` | Oui | Oui | Oui | Oui | Oui | SUPPORTED_NOW | Valeurs de correction uniquement post-submit. |
| `cause_consequence` | Oui | Oui | Oui | Oui | Oui | SUPPORTED_NOW | Paires cause/conséquence bornées. |
| `institution_matrix` | Oui | Oui | Oui | Oui | Oui | SUPPORTED_NOW | Matrice bornée, valeurs post-submit. |
| `diagram_labeling` | Oui | Oui | Oui | Oui | Oui | SUPPORTED_NOW | Diagramme structuré sans SVG/HTML arbitraire. |
| `calculation_mcq` | Oui | Oui | Oui | Oui | Oui | SUPPORTED_NOW | Calcul borné, choix fermé, étapes travaillées post-submit. |
| `image_choice` | Oui | Oui technique | Oui | Fallback texte | Oui technique | POSTPONED produit | Pas d'assets inspectables branchés, seulement registre allowlisté sans `assetPath`. |
| `true_false` simple | Non | Non | Non | Non | Non | POSTPONED | Non présent dans l'enum rich closed actuelle. |
| `fill_blank_dropdown` | Non | Non | Non | Non | Non | POSTPONED | Hors contrat V1 actuel. |
| `hotspot_image` | Non | Non | Non | Non | Non | POSTPONED | Requiert un vrai pipeline visuel, hors PLUS-02A. |
| `odd_one_out` | Non | Non | Non | Non | Non | POSTPONED | Non nécessaire pour stabiliser le QCM riche actuel. |
| `two_axis_sort` | Non | Non | Non | Non | Non | POSTPONED | À réévaluer après PLUS-02B si besoin pédagogique réel. |
| `mini_case_set` | Non | Non | Non | Non | Non | POSTPONED | Se rapproche de l'examen, donc pas dans PLUS-02A. |

## Décisions prises

- Conserver `rich_closed_exercise` comme contrat QCM riche post-MVP au lieu de créer un nouveau mode.
- Garder `PLUS-03A` séparé : aucune sélection ou UX examen n'a été ajoutée.
- Réparer `date_slider` maintenant, car une correction inaccessible rendait le type impraticable.
- Renforcer le garde App anti-fuite pour refuser aussi les bornes de correction acceptées après résultat.
- Ne pas activer une entrée directe depuis `CourseDetailPage` : cette surface ne porte pas de `knowledgeUnitId` fiable pour démarrer un rich closed ciblé.
- Classer `image_choice` en support technique mais produit reporté, faute d'assets locaux inspectables.
- Laisser l'intégration result/correction/history complète à `PLUS-02B`.

## Contrat API borné

Routes confirmées :

- `POST /activities/rich-closed/start`
- `GET /activities/rich-closed/:sessionId`
- `POST /activities/rich-closed/:sessionId/submit`
- `GET /activities/rich-closed/:sessionId/result`

Payload start borné :

```json
{
  "subjectId": "subject-id",
  "knowledgeUnitId": "knowledge-unit-id",
  "documentId": "optional-document-id",
  "questionCount": 6,
  "complexityProfile": "exam",
  "questionTypeMix": {
    "single_choice": 1,
    "multiple_choice": 1
  }
}
```

Règles confirmées :

- `subjectId` et `knowledgeUnitId` sont requis.
- `documentId`, `questionCount`, `complexityProfile` et `questionTypeMix` restent optionnels et bornés.
- Le payload pré-submit ne doit pas exposer `correctChoiceId`, `correctChoiceIds`, `correctPairs`, `correctOrder`, `correctValues`, `correctYear`, `correctErrorId`, `explanation`, feedbacks ou scores.
- Les réponses submit sont fermées par `questionKind` et validées côté controller.
- Le score canonique et les corrections restent serveur.

## Intégration App

- `RichClosedExercise.fromJson` parse l'enveloppe `rich_closed_exercise` et échoue fermé sur un `questionKind` inconnu.
- `_assertNoPreSubmitLeaks` refuse les champs de correction dans un exercice avant soumission.
- `RichClosedQuestionRenderer` route les 14 types actuels vers des widgets dédiés.
- `HttpActivitiesApi` démarre, charge, soumet et lit le résultat rich closed.
- Les entrées existantes restent : activités ciblées avec `subjectId`/`knowledgeUnitId`, action Today si disponible, et lancement depuis une action de session `RICH_CLOSED_EXERCISE`.
- Aucune nouvelle UI n'a été ajoutée dans ce lot.

## Support récupéré maintenant

- QCM single et multiple.
- Questions de matching, ordering, qualification de cas, détection d'erreur.
- Questions riches `timeline`, `date_slider`, `true_false_grid`, `cause_consequence`, `institution_matrix`, `diagram_labeling`, `calculation_mcq`.
- Explications et corrections côté résultat, sans fuite pré-submit.
- Sources via `sourceChunkIds` dans les questions.
- Compatibilité technique avec payload/result rich closed existants.

## Reporté explicitement

- `PLUS-02B` : intégration complète result/correction/history QCM riche dans les parcours post-MVP.
- Préparation examen V1 : `PLUS-03A` puis `PLUS-03B`.
- Quality pool, flags, doublons et quotas : `QUALITY-01A/B`.
- Visuels produit réels pour `image_choice` : assets, registry et smoke visuel à cadrer plus tard.
- Types non présents : `true_false`, `fill_blank_dropdown`, `hotspot_image`, `odd_one_out`, `two_axis_sort`, `mini_case_set`.
- Entrée directe Course Detail sans `knowledgeUnitId` fiable.

## Tests ajoutés

- API : test validator refusant un `date_slider.correctYear` dans l'intervalle mais inaccessible avec `step`.
- App : test parser refusant `minAcceptedYear` et `maxAcceptedYear` dans un exercice pré-submit.

## Validations exécutées

API :

- Red TDD : `npm test -- rich-closed-question.validator --runInBand` a échoué avant correctif sur le cas `date_slider` inaccessible.
- Green TDD : `npm test -- rich-closed-question.validator --runInBand` : 83 tests OK.
- `npx prettier --write src/modules/activities/application/rich-closed-questions/rich-closed-question.validator.ts src/modules/activities/application/rich-closed-questions/rich-closed-question.validator.spec.ts` : OK.
- `npm run build` : OK.
- `npm run lint:check` : OK.
- `npm test -- rich-closed --runInBand` : 10 suites, 245 tests OK.
- `npm test -- activities --runInBand` : 21 suites OK, 1 suite skipped existante, 365 tests OK.
- `npm test -- revision-sessions --runInBand` : 10 suites, 86 tests OK.
- `npm test -- question-bank --runInBand` : 7 suites, 38 tests OK.
- `git diff --check` : OK.
- Lint Markdown : aucun script Markdown dédié trouvé dans `package.json`.

App :

- Red TDD : `flutter test test/features/activities/rich_closed_exercise_test.dart --reporter compact` a échoué avant correctif sur les champs `minAcceptedYear`/`maxAcceptedYear`.
- Green TDD : `flutter test test/features/activities/rich_closed_exercise_test.dart --reporter compact` : 41 tests OK.
- `dart format lib/features/activities/domain/rich_closed_exercise.dart test/features/activities/rich_closed_exercise_test.dart` : OK, 0 fichier changé après format.
- `dart analyze lib test` : OK.
- `flutter test test/features/activities --reporter compact` : OK.
- `flutter test test/features/revision_sessions --reporter compact` : 42 tests OK.
- `flutter test test/features/courses --reporter compact` : 80 tests OK.
- `git diff --check` : OK.
- Lint Markdown : aucun lint Markdown dédié trouvé côté App.

## Risques

- Des payloads `date_slider` anciens déjà persistés avant ce correctif pourraient rester incohérents ; aucun nettoyage de données n'a été fait.
- `image_choice` peut être testé techniquement, mais ne doit pas être vendu comme expérience visuelle complète tant que les assets ne sont pas branchés.
- Le résultat/historique QCM riche existe partiellement, mais le durcissement produit complet reste dans `PLUS-02B`.
- Aucune validation runtime manuelle n'a été relancée dans ce lot documentaire/technique borné.

## Fichiers modifiés

API :

- `src/modules/activities/application/rich-closed-questions/rich-closed-question.validator.ts`
- `src/modules/activities/application/rich-closed-questions/rich-closed-question.validator.spec.ts`
- `docs/roadmap/v3/EXECUTION_LOT_TRACKER_V3.md`
- `docs/roadmap/v3/LOT_TRACKER_V3.md`
- `docs/roadmap/v3/PLUS_02A_QCM_RICH_QUESTIONS_RECOVERY_REPORT.md`
- `docs/roadmap/v3/PLUS_02A_QCM_RICH_QUESTIONS_RECOVERY_EVIDENCE_PACK.md`

App :

- `lib/features/activities/domain/rich_closed_exercise.dart`
- `test/features/activities/rich_closed_exercise_test.dart`
- `docs/roadmap/v3/EXECUTION_LOT_TRACKER_V3.md`
- `docs/roadmap/v3/LOT_TRACKER_V3.md`
- `docs/roadmap/v3/PLUS_02A_QCM_RICH_QUESTIONS_RECOVERY_REPORT.md`
- `docs/roadmap/v3/PLUS_02A_QCM_RICH_QUESTIONS_RECOVERY_EVIDENCE_PACK.md`

## Evidence pack

Le contenu exact des modifications clés est consigné dans `docs/roadmap/v3/PLUS_02A_QCM_RICH_QUESTIONS_RECOVERY_EVIDENCE_PACK.md` pour éviter de gonfler ce rapport avec des diffs longs.

## Subagents / passes

- Roadmap/docs : statut V3, dépendances et trackers.
- API contract : routes, DTO, validation, persistance, session compatibility.
- App rendering : parser, renderer, widgets, anti-leak.
- Legacy/inventory : types supportés et types à reporter.
- QA/review : validations et non-régressions quick/session/question-bank.

## Prochain lot recommandé

`PLUS-02B - QCM result/correction/history integration`.

Le contrat et le rendu rich closed sont suffisamment bornés pour passer au durcissement produit du résultat, de la correction claire et de l'historique. `PLUS-03A` doit encore attendre cette intégration pour ne pas construire l'examen sur un résultat QCM incomplet.

## Auto-review finale

- Aucun commit, push, merge, rebase, tag ou déploiement.
- Aucun changement Prisma ou migration.
- Aucun changement provider IA ou prompt IA.
- Aucun chantier examen, quality pool, Rena, Today, deep revision, fiches complètes ou release.
- Quick revision, draft/resume, result/history et readiness question bank validés par suites ciblées.
- Trackers V2 conservés.
- Trackers V3 mis à jour.
- Aucun secret exposé.

## Critique du prompt

Le prompt est bon sur les frontières de scope, mais il mélange "QCM complet" et "visuels" alors que `image_choice` est techniquement présent sans vraie chaîne d'assets côté App. La décision prudente est de supporter le contrat riche existant, réparer les fuites et marquer les visuels produit complets comme reportés plutôt que de sur-promettre.
