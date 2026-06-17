# LOT V1-025 — Readiness audit V1

## 1. Verdict final

Statut : `NOT_READY_BLOCKED`.

La V1 n'est pas ready: un V1-025B est nécessaire avant de déclarer la readiness finale. La V1 est largement démontrable en local/dev, mais pas validable comme readiness finale tant que le contrat `date_slider` peut accepter une question impossible à répondre.

## 2. Résumé exécutif

L'audit V1-025 a couvert backend API, Flutter, Genkit, seed/runbook, anti-fuite, sécurité, tests et documentation. Les 14 types rich closed sont présents dans les contrats, fixtures, Genkit, parsing Flutter, widgets et corrections. Les validations critiques passent majoritairement: backend rich-closed/activities/revision/lint/build verts; Flutter analyze/tests complets verts; E2E backend vert après deux relances complètes.

Le verdict reste bloqué par F-001: `date_slider` valide `correctYear` dans la plage mais ne vérifie pas qu'il est aligné sur le `step`, alors que le scorer rejette les années soumises non alignées. Cela peut produire une question valide mais impossible à réussir. D'autres findings non bloquants ou à traiter dans le même bis concernent la sanitisation Genkit, le parser anti-fuite Flutter, la stricte fermeture du submit parser, le retry submit UI et les gaps CI/coverage.

Aucun commit n'a été fait. Aucun seed write, migration, déploiement, provider IA réel, téléchargement d'asset ou action Dokploy n'a été lancé.

## 3. Sources inspectées

- API docs V1: `docs/v1/ROADMAP_EXECUTION_PLAN_V1.md`, `docs/v1/DEMO_RUNBOOK_V1.md`, rapports V1-012C à V1-023.
- API rich closed: types, validator, quality gate, public mapper, scorer, fixtures, generation profile, Genkit generator/specs, image assets, calculation helper.
- API intégrations: activities controller, start/get/submit/result use cases, Today, revision sessions, demo seed fixtures, `prisma/demo-seed.ts`, `test/critical-paths.e2e-spec.ts`, `package.json`, `.env.example`.
- App docs V1: plan, rapports V1-009 à V1-024, README.
- App rich closed: domain/parser, API client, flow controller, answer controller, renderer, correction presenter/list/cards, page, router.
- App widgets: V1-A, timeline, date_slider, true_false_grid, cause_consequence, institution_matrix, diagram_labeling, calculation_mcq, image_choice, image asset registry.
- Tests activities/today/revision_sessions/router et revues sub-agents read-only.

## 4. Préflight Git

### API

- Repo : `/Users/karim/Project/app-révision/api`.
- Branche : `main`.
- Status initial : clean.
- Derniers commits : `232a1b3 023: Ajout du runbook de démonstration V1`, `493888e 022: Intégration des QCM avec choix d'images`, `5441805 021: Intégration des QCM de calcul`, `07f6e00 020: Intégration de l'étiquetage de diagrammes`, `4f51fcd 019: Intégration de la matrice institutionnelle`.
- Fichiers modifiés/créés par V1-025 : `docs/v1/ROADMAP_EXECUTION_PLAN_V1.md`, `docs/v1/ROADMAP_EXECUTION_LOT_V1_025_READINESS_AUDIT.md`.
- Aucun commit fait.

### App

- Repo : `/Users/karim/Project/app-révision/revision_app`.
- Branche : `main`.
- Status initial : clean.
- Derniers commits : `e6666fc V1-023: Ajout du Demo Runbook V1 et V1-024: Améliorations UI, accessibilité et performance`, `fcf0da6 V1-022: Ajout du widget Image Choice et registre d'assets pour les exercices riches fermés`, `82cd3ee V1-021: Ajout du widget Calculation MCQ pour les exercices riches fermés`, `be1c3dd V1-020: Ajout du widget Diagram Labeling pour les exercices riches fermés`, `1c5c384 V1-019: Ajout du widget Institution Matrix pour les exercices riches fermés`.
- Fichiers modifiés/créés par V1-025 : `docs/v1/ROADMAP_EXECUTION_PLAN_V1.md`, `docs/v1/ROADMAP_EXECUTION_LOT_V1_025_READINESS_AUDIT.md`.
- Aucun commit fait.

## 5. Périmètre audité

- Backend : contrat rich closed, validators, mapper public, scorer, use cases, controller, E2E.
- Frontend : parser, answer controller, widgets, correction UI, routing, Today, revision sessions.
- Docs : plans V1, rapports V1, runbook.
- Tests : unitaires, widget, controller smoke, E2E, lint/build/analyze.
- Runbook : seed dry-run/write, commandes vérifiées/plausibles/interdites.
- Seed : fixture persistante V1-A et documentation des 14 types par tests/fixtures.
- Genkit : schemas, prompts, mix, fallback repair, mockabilité.
- Sécurité : anti-fuite, image allowlist, absence de widget libre, secrets, commandes dangereuses.

## 6. Matrice de couverture des 14 types

| Type | Backend contract | Backend validator | Public mapper | Scoring | Genkit | Flutter parser | Flutter widget | Correction UI | Tests | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `single_choice` | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| `multiple_choice` | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| `matching` | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| `ordering` | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| `case_qualification` | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| `error_detection` | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| `timeline` | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| `date_slider` | OK | PARTIAL | OK | OK | OK | OK | OK | OK | OK | BLOCKED |
| `true_false_grid` | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| `cause_consequence` | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| `institution_matrix` | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| `diagram_labeling` | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| `calculation_mcq` | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |
| `image_choice` | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK |

## 7. Anti-fuite et sécurité

Le mapper public API est allowlisté et les tests vérifient les 14 types contre les champs privés majeurs. Les endpoints start/get passent par le payload public. Les réponses submit sont revalidées et les champs de correction/rendu libre connus sont rejetés. `image_choice` reste borné par catalogue et n'accepte pas URL/base64/storage/blob/raw image.

Findings à traiter: F-003 côté Flutter accepte certains champs post-submit non stockés en pré-submit; F-008 complète les boucles de tests; F-002 demande de sanitiser les diagnostics Genkit avant logs/repair prompt. Aucun secret réel ni commande destructive n'a été trouvé.

## 8. Scoring et corrections

Le backend est source de vérité du score. Flutter consomme `score`, `correctAnswers`, `totalQuestions` et les corrections backend sans recalcul. `calculation_mcq` est recalculé côté backend par helper déterministe. Les corrections post-submit contiennent prompt, answer soumis, statut, partialScore all-or-nothing, explication, sources et correction typée.

Limite bloquante: pour `date_slider`, le scorer impose l'alignement `(year - minYear) % step === 0`, mais le validator ne l'impose pas à `correctYear`.

## 9. Genkit et génération

Les schemas et prompts listent les 14 types, interdisent widget libre, HTML/SVG/Mermaid/renderPayload et images distantes. Les mixes automatiques 6/8/10/11/12/13/14 sont couverts par génération profile/tests, avec V1-D pour 14. Les tests Genkit restent mockés.

Risques: diagnostics trop bruts dans logs/repair prompt (F-002), mix custom impossible accepté avant quality gate (F-005), schema `cognitiveSkill` plus large que l'allowlist prompt/validator (LOW dans F-002/F-005 backlog).

## 10. Seed, runbook et démo

Le seed persistant reste V1-A à 6 types; le runbook le dit explicitement. Les 14 types sont couverts par fixtures/tests/smoke mockés. Le dry-run seed est non destructif et a été lancé. Le seed write est optionnel, local/dev, gardé. Les scénarios direct rich closed, Today et revision session sont documentés. Le fallback `image_choice` local est documenté.

## 11. Flutter UX/accessibilité/performance

Les 14 types ont un rendu dédié. Les interactions ne sont pas drag-only: ordering/timeline ont boutons, matching/cause/matrix/diagram ont dropdowns, true/false a boutons, date_slider utilise slider natif, image/calculation ont choix tappables. V1-024 a réduit les risques petits écrans et longs labels pour image/matrix/diagram. Restent des dettes mineures: focus clavier `calculation_mcq`, longs labels matching/cause, UI non finale.

## 12. Résultats de validations

| Repo | Commande | Résultat | Notes |
| --- | --- | --- | --- |
| API | `DEMO_SEED_CONFIRM=revision-demo DEMO_FIREBASE_UID=demo-local-uid npm run demo:seed -- --dry-run` | OK | Dry-run, non destructif, seed V1-A listé. |
| API | `npm test -- rich-closed --runInBand` | OK | 10 suites, 245 tests. |
| API | `npm test -- activities --runInBand` | OK | 19 suites passées, 1 skipped; 342 tests passés, 1 skipped. |
| API | `npm run test:e2e -- --runInBand` | Initialement rouge puis OK sur relances | 1 échec initial sur le smoke diagram_labeling; test ciblé OK, puis deux relances full E2E OK, 25/25. Risque de stabilité documenté. |
| API | `npm test -- revision --runInBand` | OK | 15 suites, 87 tests. |
| API | `npm test -- revision-session --runInBand` | OK | 6 suites, 41 tests. |
| API | `npm test -- revision-sessions --runInBand` | OK | 6 suites, 41 tests. |
| API | `npm run lint:check` | OK | ESLint sans erreur. |
| API | `npm run build` | OK | Build Nest OK. |
| API | `git diff --check` | OK avant rapports | Relancé après création des rapports en validation finale. |
| App | `dart format <docs modifiés>` | N/A | V1-025 ne modifie que du Markdown côté app. |
| App | `dart analyze lib test` | OK | No issues found. |
| App | `flutter test test/features/activities --reporter compact` | OK | 231 tests. |
| App | `flutter test test/features/today --reporter compact` | OK | 18 tests. |
| App | `flutter test test/features/revision_sessions --reporter compact` | OK | 21 tests. |
| App | `flutter test test/app/router --reporter compact` | OK | 11 tests. |
| App | `flutter test --reporter compact` | OK | 362 tests. |
| App | `git diff --check` | OK avant rapports | Relancé après création des rapports en validation finale. |

## 13. Validations non lancées

- Seed write réel non lancé: écrit en base et reste optionnel local/dev.
- Provider IA réel non lancé: tests Genkit mockés uniquement.
- Migrations prod/Dokploy/déploiement non lancés: explicitement hors scope.
- Prisma integration full-stack non lancé par défaut: nécessite garde d'environnement disposable; finding F-007.
- Device E2E Flutter réel non lancé: le repo couvre par tests widget/unit/router, finding F-007.
- `dart format` non applicable: seules docs Markdown modifiées côté app.

## 14. Findings

| ID | Sévérité | Repo | Zone | Titre | Impact | Recommandation | Bis requis |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F-001 | BLOCKER | API | Contrat `date_slider` | `correctYear` peut être non sélectionnable par le `step` public | Une question valide peut devenir impossible à répondre; readiness V1 non validable | V1-025B: imposer `(correctYear - minYear) % step === 0` ou adapter scoring/tolérance/slider, avec tests validator/scorer/Flutter | Oui |
| F-002 | HIGH | API | Genkit diagnostics | IDs générés bruts possibles dans logs/prompt de réparation | Données invalides rejetées mais potentiellement réinjectées/logguées | Sanitiser diagnostics, borner `sourceChunkIds`, tester logger/repair prompt | Oui, avec F-001 |
| F-003 | HIGH | App | Parser pré-submit | `isCorrect`, `minAcceptedYear`, `maxAcceptedYear` non rejetés en pré-submit | Payload pré-submit malformé peut transporter des champs post-submit ignorés mais acceptés | Ajouter ces champs à la denylist et tests parser | Oui, avec F-001 |
| F-004 | MEDIUM | API | Submit parser | Clés extra non interdites acceptées puis droppées | Contrat HTTP moins strict qu'un strict closed API contract | Rejeter les clés extra par shape stricte ou documenter canonicalisation | Non si V1-025B traite blockers d'abord |
| F-005 | MEDIUM | API | Genkit mix custom | Mix custom impossible accepté à l'entrée | Échecs de génération prévisibles côté quality gate | Valider la compatibilité mix/quality gate avant génération | Non bloquant seul |
| F-006 | MEDIUM | App | Retry submit | CTA de retry post-échec submit peut no-op | Erreur transitoire laisse l'utilisateur bloqué | Autoriser retry depuis état failed ou restaurer ready avec réponses conservées | Non bloquant seul |
| F-007 | MEDIUM | Tests | Validation stack | Tests par défaut pas full-stack Prisma; pas de CI/coverage gate | Readiness dépend de validations manuelles locales | Ajouter CI, seuils coverage, smoke persistance local disposable | Non bloquant seul |
| F-008 | LOW | API/App | Anti-fuite tests | Boucles de tests omettent `expectedAnswer(s)` dans certains scans | Gap de régression; runtime déjà protégé ailleurs | Ajouter aux listes de tests anti-fuite | Non |
| F-009 | LOW | API | Runbook | `npm run start:prod` recommandé dans runbook local | Wording ambigu même si pas déploiement | Renommer en commande build/start local ou déplacer en non vérifié | Non |
| F-010 | LOW | API | Seed docs/tests | Seed V1-A pas épinglé par spec dédiée | Drift possible du runbook si fixture change | Ajouter assertion sur les 6 questionKind du seed | Non |
| F-011 | LOW | App | UX widgets | Keyboard/focus et longs dropdowns perfectibles | Dette accessibilité/polish | Backlog polish post-V1 | Non |

### Détails

#### F-001 — BLOCKER — date_slider peut être impossible

Preuve: le validator API vérifie plage, step positif, `correctYear` dans les bornes et tolérance, mais pas l'alignement sur `step`. Le scorer rejette ensuite toute année soumise non alignée. Comme Flutter ne reçoit pas `correctYear` et snappe les réponses sur `minYear + n*step`, un `correctYear` non aligné avec tolérance 0 rend la question impossible.

#### F-002 — HIGH — diagnostics Genkit trop bruts

Les diagnostics de rejet incluent des IDs générés et `sourceChunkIds`, puis sont loggés et réinjectés dans le prompt de réparation. Sanitisation recommandée avant V1 ready.

#### F-003 — HIGH — parser Flutter pré-submit à durcir

`isCorrect`, `minAcceptedYear`, `maxAcceptedYear` sont des champs post-submit et ne sont pas rejetés par la denylist pré-submit. Ils sont ignorés par les modèles publics, mais l'audit demande un rejet strict des champs de correction.

#### F-004 à F-011

Voir tableau ci-dessus. Ces sujets ne changent pas le verdict principal mais doivent être priorisés dans V1-025B ou backlog post-V1 selon sévérité.

## 15. Risques acceptés

- Seed persistant V1-A seulement.
- 14 types démontrés surtout par fixtures/tests/smoke mockés.
- `image_choice` fallback local sans bitmaps licenciés définitifs.
- UI pas finale avant refonte de A à Z.
- Vraie génération dépendante d'un provider IA configuré.
- Pas de déploiement prod dans le runbook.
- Pas de CI/coverage gate committé à ce stade.

## 16. Décision readiness

Décision : non ready. La V1 ne doit pas être vendue comme readiness finale tant que F-001 n'est pas corrigé et testé. Elle peut être montrée comme prototype local/dev avec limites, mais le discours de démo doit préciser que l'audit final a bloqué la validation.

### Réponses explicites aux 48 questions d'audit

1. Oui, fonctionnellement les 14 interactions dépassent le QCM simple, mais readiness bloquée par F-001.
2. Tous les types sont exploitables en tests/widgets; `date_slider` a un cas contractuel impossible.
3. Oui, la démo est honnête: seed persistant V1-A, 14 types par tests/fixtures.
4. Oui pour une V1 technique, avec limite visible du fallback local.
5. Oui, dans runbook et rapports, avec limites UI/assets/seed/provider.
6. Globalement oui, sauf `date_slider` step/correctYear.
7. Oui côté mapper public actuel; app parser a un durcissement à faire sur champs post-submit.
8. Oui, les answers sont fermées/minimales; parser submit API canonicalise mais accepte extra keys droppées.
9. Partiellement: validators riches, mais F-001 et F-004 restent.
10. Oui, mapper allowlisté, notamment types sensibles/image.
11. Oui, backend source de vérité.
12. Non pour rich closed; Flutter affiche le score backend.
13. Oui, corrections post-submit typées et explicatives.
14. Oui, `calculation_mcq` est recalculé côté backend.
15. Oui, partial score all-or-nothing cohérent, pas de partial pédagogique fin.
16. Oui côté API public mapper; gaps de test et parser app documentés.
17. Oui côté API/app image_choice; aucun rendu distant trouvé.
18. Oui, pas de widget libre/HTML/SVG/Mermaid/WebView/Canvas libre rendu.
19. Oui, pas de secret réel trouvé; placeholders locaux seulement.
20. Oui, runbook sépare interdit/dry-run/local-dev; wording `start:prod` à clarifier.
21. Oui globalement; diagnostics Genkit à sanitiser.
22. Non, allowlist/schema/validator rejettent les types non autorisés.
23. Non, prompts/tests interdisent widget libre.
24. Oui, tests Genkit mockés.
25. Partiellement: diagnostics utiles mais trop bruts dans logs/repair prompt.
26. Oui, 14 rendus dédiés.
27. Oui pour V1, avec dette polish mineure.
28. Oui, pas de drag-only obligatoire.
29. Partiellement: V1-024 a amélioré plusieurs menus; matching/cause restent perfectibles.
30. Oui, local/fallback sans réseau.
31. Oui côté UI normale; parser pré-submit doit rejeter davantage de champs post-submit.
32. Acceptables pour V1; retry submit failed à corriger.
33. Oui, démo local/dev non dangereuse.
34. Oui, dry-run non destructif.
35. Oui, seed write optionnel local/dev et gardé.
36. Oui.
37. Oui.
38. Majoritairement oui; un E2E initial a flaké puis deux full reruns OK; readiness bloquée par audit contrat, pas par tests.
39. Oui, analyze/tests Flutter verts.
40. Oui pour smoke controller/UI; pas full-stack Prisma/device E2E.
41. Oui globalement, avec gaps LOW/ HIGH app parser.
42. Oui, aucune validation destructive.
43. Oui, non lancées justifiées.
44. Oui après mise à jour: V1-025 est Bloqué dans les deux plans.
45. Oui, traçabilité riche des lots V1.
46. Oui: marqué Bloqué, pas Réalisé.
47. Oui, findings et risques acceptés listés.
48. Oui: V1-025B ciblé, puis reprise readiness.

## 17. Recommandation post-V1

Recommandation immédiate : `V1-025B — Readiness blockers fix`.

Périmètre suggéré V1-025B: corriger et tester `date_slider` step/correctYear; durcir parser Flutter pré-submit pour champs post-submit; sanitiser diagnostics Genkit; compléter tests anti-fuite; corriger retry submit si temps. Après V1-025B, relancer l'audit readiness ciblé avant de passer à refonte UI/assets réels/beta hardening.

## 18. Non-objectifs respectés

- Pas de nouveau type.
- Pas de migration.
- Pas de provider IA réel.
- Pas de déploiement.
- Pas de refonte.
- Pas de secret.
- Pas de widget libre.
- Pas de score Flutter.
- Pas de correction pré-submit ajoutée.
- Pas de seed write réel.
- Pas d'image distante ou asset téléchargé.
- Aucun commit Git.

## 19. Critique honnête du prompt initial

Le prompt était long mais adapté à un audit final: il a empêché de corriger en douce le blocker et force un verdict honnête. La seule rigidité est que certains critères relèvent d'une readiness production/CI plus large que la V1 locale/dev; l'audit les classe donc en MEDIUM plutôt qu'en blockers.

## 20. Contenu complet des fichiers créés/modifiés/supprimés

Le présent rapport est listé sans s'inclure lui-même pour éviter une récursion infinie.

### docs/v1/ROADMAP_EXECUTION_PLAN_V1.md

```md
# Roadmap execution plan V1 — API

Ce fichier existe côté API pour les lots backend V1 dont le prompt interdit toute modification de `revision_app/`.

| Lot     | Intitulé                                   | Statut  | Rapport                                                                             |
| ------- | ------------------------------------------ | ------- | ----------------------------------------------------------------------------------- |
| V1-012C | Backend diagnostics génération rich closed | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_012C_BACKEND_RICH_CLOSED_GENERATION_DIAGNOSTICS.md |
| V1-012D | Dokploy runtime fix génération rich closed | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_012D_DOKPLOY_RICH_CLOSED_RUNTIME_FIX.md            |
| V1-013  | Today integration V1                       | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_013_TODAY_INTEGRATION_V1.md                        |
| V1-014  | Revision session integration V1            | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_014_REVISION_SESSION_INTEGRATION_V1.md             |
| V1-015  | Rich demo fixtures V1                      | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_015_016_RICH_DEMO_SEED_AND_SMOKE.md                |
| V1-016  | E2E/smoke rich questions V1                | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_015_016_RICH_DEMO_SEED_AND_SMOKE.md                |
| V1-017  | Timeline/date slider V1-B                  | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_017_TIMELINE_DATE_SLIDER.md                        |
| V1-018  | True/false grid + cause/consequence V1-B   | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_018_TRUE_FALSE_GRID_CAUSE_CONSEQUENCE.md           |
| V1-019  | Institution matrix V1-C                    | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_019_INSTITUTION_MATRIX.md                          |
| V1-020  | Diagram labeling V1-C                      | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_020_DIAGRAM_LABELING.md                            |
| V1-021  | Calculation MCQ modes de scrutin V1-C      | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_021_CALCULATION_MCQ.md                             |
| V1-022  | Image choice/personnages historiques V1-D  | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_022_IMAGE_CHOICE.md                                |
| V1-023  | Runbook demo V1                            | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_023_DEMO_RUNBOOK_V1.md                             |
| V1-024  | Polish UI/accessibilité/performance        | Non applicable côté API (app-only) | Voir revision_app/docs/v1/ROADMAP_EXECUTION_LOT_V1_024_UI_ACCESSIBILITY_PERFORMANCE.md |
| V1-025  | Revue finale V1 et readiness audit         | Bloqué | docs/v1/ROADMAP_EXECUTION_LOT_V1_025_READINESS_AUDIT.md                            |

## Lots détaillés

### V1-012C — Backend diagnostics génération rich closed

- Objectif : diagnostiquer et fiabiliser les échecs Genkit rich closed.
- Pourquoi maintenant : la page front existe mais la génération backend échoue en runtime avec `RICH_CLOSED_GENERATION_CONTRACT_INVALID`.
- Périmètre inclus : diagnostics metadata-only, catégorisation des rejets, prompt de réparation sur modèle fallback configuré, tests mockés.
- Non-objectifs : frontend, Today, revision sessions, Prisma, endpoints publics.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_012C_BACKEND_RICH_CLOSED_GENERATION_DIAGNOSTICS.md`.

### V1-012D — Dokploy runtime fix génération rich closed

- Objectif : vérifier le runtime Dokploy réel et rendre `RICH_CLOSED_GENERATION_SCHEMA_INVALID` exploitable.
- Pourquoi maintenant : V1-012C est déployé, mais le fallback Mistral échoue encore avec un diagnostic schema trop pauvre.
- Périmètre inclus : inspection Dokploy, prompt strict, diagnostics schema imbriqués, tests mockés.
- Non-objectifs : frontend, Today, revision sessions, Prisma, endpoints publics, redeploy sans commit déployable.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_012D_DOKPLOY_RICH_CLOSED_RUNTIME_FIX.md`.

### V1-013 — Today integration V1

- Objectif : permettre à Today de recommander une action déterministe `rich_closed_exercise`.
- Pourquoi maintenant : la page rich closed complète existe et peut prendre le relais au clic utilisateur.
- Périmètre inclus : contrat Today, sélection déterministe, propagation optionnelle de `documentId`, tests Today/revision/activities.
- Non-objectifs : Genkit depuis Today, revision sessions, endpoints rich closed, Prisma schema ou migration.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_013_TODAY_INTEGRATION_V1.md`.

### V1-014 — Revision session integration V1

- Objectif : permettre aux sessions de révision de proposer l'action bornée `RICH_CLOSED_EXERCISE`.
- Pourquoi maintenant : le flow rich closed V1-A existe et Today sait déjà le recommander.
- Périmètre inclus : contrat session, coach next-action, persistance enum, contrôleur, tests anti-fuite.
- Non-objectifs : génération de questions rich closed depuis la session, rendu de widget arbitraire, correction pré-submit, provider IA réel dans les tests.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_014_REVISION_SESSION_INTEGRATION_V1.md`.

### V1-015 — Rich demo fixtures V1

- Objectif : disposer d'un seed démo riche fermé V1-A stable, rejouable et synthétique.
- Pourquoi maintenant : les parcours Today, sessions de révision et rich closed sont intégrés, mais il manquait un jeu démo persistant couvrant les 6 types fermés riches.
- Périmètre inclus : fixture `Droit constitutionnel`, notion `Régime parlementaire rationalisé`, chunks/sources synthétiques, session `RICH_CLOSED_EXERCISE`, payload rich closed V1-A à 6 questions, dry-run non destructif.
- Non-objectifs : migration Prisma, provider IA réel, reset ou suppression de données, nouveau type de question.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_015_016_RICH_DEMO_SEED_AND_SMOKE.md`.

### V1-016 — E2E/smoke rich questions V1

- Objectif : protéger le contrat HTTP rich closed V1-A et les launchers Today/session de révision.
- Pourquoi maintenant : le seed démo doit être validable et les parcours intégrés doivent garantir l'absence de fuite pré-submit.
- Périmètre inclus : smoke `/activities/rich-closed/start`, get, result avant submit, submit, result après submit, invalides, Today rich closed, revision session rich closed, anti-fuite récursif.
- Non-objectifs : refonte frontend, génération Genkit réelle, widgets libres, V1-017.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_015_016_RICH_DEMO_SEED_AND_SMOKE.md`.

### V1-017 — Timeline/date slider V1-B

- Objectif : ajouter les types rich closed fermés `timeline` et `date_slider`.
- Pourquoi maintenant : V1-A, Today, revision sessions, seed et smoke sont stabilisés.
- Périmètre inclus : contrat backend, validation, mapper public anti-fuite, scoring, Genkit mockable, fixture V1-B dédiée, smoke E2E.
- Non-objectifs : V1-018, widgets libres, provider IA réel, migration Prisma.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_017_TIMELINE_DATE_SLIDER.md`.

### V1-018 — True/false grid + cause/consequence V1-B

- Objectif : ajouter les types rich closed fermés `true_false_grid` et `cause_consequence`.
- Pourquoi maintenant : V1-017 a stabilisé les extensions V1-B `timeline` et `date_slider`; le moteur peut accueillir deux interactions fermées supplémentaires.
- Périmètre inclus : contrat backend, validation, mapper public anti-fuite, parsing submit, scoring, correction post-submit, Genkit mockable, fixture V1-B full dédiée, smoke E2E.
- Non-objectifs : V1-019, `institution_matrix`, `diagram_labeling`, `calculation_mcq`, `image_choice`, widgets libres, provider IA réel, migration Prisma.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_018_TRUE_FALSE_GRID_CAUSE_CONSEQUENCE.md`.

### V1-019 — Institution matrix V1-C

- Objectif : ajouter le type rich closed fermé `institution_matrix`.
- Pourquoi maintenant : V1-018 a stabilisé les interactions fermées à cellules/paires, ce qui permet d'introduire une matrice institutionnelle bornée.
- Périmètre inclus : contrat backend, validation stricte rows/columns/cells/options, mapper public anti-fuite, parsing submit, scoring full-correct, correction post-submit, Genkit mockable, fixture V1-C dédiée, smoke E2E.
- Non-objectifs : V1-020, `diagram_labeling`, `calculation_mcq`, `image_choice`, `fill_blank_dropdown`, widgets libres, provider IA réel, migration Prisma.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_019_INSTITUTION_MATRIX.md`.

### V1-020 — Diagram labeling V1-C

- Objectif : ajouter le type rich closed fermé `diagram_labeling`.
- Pourquoi maintenant : V1-019 a stabilisé les matrices institutionnelles fermées; le moteur peut accepter un schéma textuel borné sans rendu arbitraire.
- Périmètre inclus : contrat backend diagram/nodes/edges/slots/options, validation stricte, mapper public anti-fuite, parsing submit, scoring full-correct, correction post-submit, Genkit mockable, fixture V1-C full dédiée, smoke E2E.
- Non-objectifs : V1-021, `calculation_mcq`, `image_choice`, `fill_blank_dropdown`, HTML/SVG/Mermaid/Canvas/image URL/widget libre, provider IA réel, migration Prisma.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_020_DIAGRAM_LABELING.md`.

### V1-021 — Calculation MCQ modes de scrutin V1-C

- Objectif : ajouter le type rich closed fermé `calculation_mcq` pour calculs bornés de modes de scrutin.
- Pourquoi maintenant : V1-020 a stabilisé le dernier type V1-C non calculatoire; on peut ajouter un QCM calculé sans ouvrir de formule libre.
- Périmètre inclus : contrat backend, validation stricte des deux modes autorisés, recalcul déterministe backend, mapper public anti-fuite, parsing submit, scoring full-correct, correction post-submit, Genkit mockable, fixture V1-C calculation dédiée, smoke E2E.
- Non-objectifs : V1-022, `image_choice`, `fill_blank_dropdown`, formule libre, eval/Function/parser d'expression, D'Hondt, Sainte-Laguë, seuils électoraux, votes blancs/nuls, provider IA réel, migration Prisma.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_021_CALCULATION_MCQ.md`.

### V1-022 — Image choice/personnages historiques V1-D

- Objectif : ajouter le type rich closed fermé `image_choice`.
- Pourquoi maintenant : V1-021 a stabilisé les QCM calculés; on peut ouvrir un choix d'image borné sans URL distante ni widget libre.
- Périmètre inclus : catalogue contrôlé d'assets image, contrat backend, validation stricte des choix et IDs allowlistés, mapper public anti-fuite, parsing submit, scoring full-correct, correction post-submit, Genkit mockable, fixture V1-D dédiée, smoke E2E.
- Non-objectifs : V1-023, `fill_blank_dropdown`, upload d'images, URL distante, base64, storage path, rendu libre, provider IA réel, migration Prisma.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_022_IMAGE_CHOICE.md`.

### V1-023 — Runbook demo V1

- Objectif : créer un runbook local/dev clair, rejouable, non destructif et honnête pour démontrer la V1 rich closed.
- Pourquoi maintenant : les 14 types V1 existent; il faut rendre le parcours présentable avant l'audit final.
- Périmètre inclus : runbook canonique `docs/v1/DEMO_RUNBOOK_V1.md`, commandes vérifiées/non vérifiées/interdites, seed dry-run, scénarios direct/Today/revision session, anti-fuite, limites connues.
- Non-objectifs : V1-025, readiness audit, déploiement, migration, provider IA réel, nouveau type de question.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_023_DEMO_RUNBOOK_V1.md`.

### V1-024 — Polish UI/accessibilité/performance

- Objectif : améliorer côté Flutter la robustesse de démo du parcours rich closed sans refonte.
- Pourquoi maintenant : la V1 est fonctionnelle; il faut réduire les risques d'overflow et clarifier les fallbacks avant présentation.
- Périmètre API : non applicable hors documentation de plan, car le polish est app-only.
- Rapport attendu : voir `revision_app/docs/v1/ROADMAP_EXECUTION_LOT_V1_024_UI_ACCESSIBILITY_PERFORMANCE.md`.

### V1-025 — Revue finale V1 et readiness audit

- Objectif : auditer la readiness finale V1 après runbook et polish.
- Statut : bloqué par l'audit V1-025; readiness non validée.
- Blocker principal : `date_slider` peut valider une correction `correctYear` non sélectionnable par le `step` public.
- Suite recommandée : `V1-025B — Readiness blockers fix`.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_025_READINESS_AUDIT.md`.

```
