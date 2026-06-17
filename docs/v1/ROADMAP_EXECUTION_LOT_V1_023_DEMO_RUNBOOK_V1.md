# LOT V1-023 — Runbook demo V1

## 1. Resultat

V1-023 est realise cote API/docs. Le runbook canonique `docs/v1/DEMO_RUNBOOK_V1.md` documente une demo locale/dev rejouable, non destructive et honnete pour le parcours rich closed V1. Il separe commandes verifiees, commandes plausibles non lancees et commandes interdites/dangereuses. V1-025 reste a faire.

## 2. Sources inspectees

- `docs/v1/ROADMAP_EXECUTION_PLAN_V1.md`
- Rapports V1-015/V1-016 a V1-022
- Docs demo existantes cote app: `docs/demo/DEMO_SEED_RUNBOOK.md`, `docs/demo/DEMO_SMOKE_CHECKS.md`, `docs/demo/DEMO_DEPLOYMENT_RUNBOOK.md`
- `package.json`, `.env.example`
- `prisma/demo-seed.ts`
- `src/modules/demo-seed/demo-seed.fixtures.ts`
- `test/critical-paths.e2e-spec.ts`
- Controller/use cases rich closed, Today et revision sessions
- Code Flutter route/config pour pointer vers le runbook depuis le rapport app

## 3. Preflight Git

### API

- Branche: `main`
- Status initial: clean au preflight.
- Status courant lors de generation du rapport:

```text
 M docs/v1/ROADMAP_EXECUTION_PLAN_V1.md
?? docs/v1/DEMO_RUNBOOK_V1.md
?? docs/v1/ROADMAP_EXECUTION_LOT_V1_023_DEMO_RUNBOOK_V1.md
```

- Derniers commits:

```text
493888e 022: Intégration des QCM avec choix d'images
5441805 021: Intégration des QCM de calcul
07f6e00 020: Intégration de l'étiquetage de diagrammes
4f51fcd 019: Intégration de la matrice institutionnelle
4092741 018: Intégration de la grille vrai/faux avec cause et conséquence
```

- Aucun commit effectue.

### App

- Branche: `main`
- Repo touche par V1-023 pour le plan/rapport app, et par V1-024 pour le polish.
- Status courant app:

```text
 M docs/v1/ROADMAP_EXECUTION_PLAN_V1.md
 M lib/features/activities/presentation/rich_closed/rich_closed_diagram_labeling_widget.dart
 M lib/features/activities/presentation/rich_closed/rich_closed_image_choice_widget.dart
 M lib/features/activities/presentation/rich_closed/rich_closed_institution_matrix_widget.dart
 M test/features/activities/rich_closed_diagram_labeling_widget_test.dart
 M test/features/activities/rich_closed_image_choice_widget_test.dart
 M test/features/activities/rich_closed_institution_matrix_widget_test.dart
?? docs/v1/ROADMAP_EXECUTION_LOT_V1_023_DEMO_RUNBOOK_V1.md
?? docs/v1/ROADMAP_EXECUTION_LOT_V1_024_UI_ACCESSIBILITY_PERFORMANCE.md
```

## 4. Perimetre realise

### API

- Creation du runbook canonique V1.
- Mise a jour du plan API avec V1-023 realise, V1-024 non applicable cote API, V1-025 a faire.

### App

- Rapport app V1-023 separe, sans duplication massive du runbook.

### Docs

- Distinction claire entre seed dry-run, seed write optionnel local/dev, tests mockes et scenarios utilisateur.

### Tests

- Dry-run seed verifie.
- Validations backend lancees.

## 5. Changements realises

- Runbook: objectif demo, perimetre des 14 types, prerequis API/app, commandes verifiees, preparation API, seed, lancement app, scenario utilisateur, smoke checks API/app, troubleshooting, limites, checklist.
- Commandes: les commandes dangereuses sont listees comme interdites; le seed write est marque optionnel local/dev; les commandes non lancees sont separees des validations verifiees.
- Scenario: direct par `sessionId`, Today, revision session, et mention explicite du fallback `image_choice`.
- Smoke: start/get/submit/result, anti-fuite, Today launcher et revision session launcher.
- Limites: seed persistant V1-A seulement; 14 types couverts par tests/fixtures mockes; V1-025 restant.

## 6. Non-objectifs respectes

- Pas de V1-025.
- Pas de nouveau type rich closed.
- Pas de refonte UI massive.
- Pas de provider IA reel dans les tests.
- Pas de deploiement.
- Pas de migration.
- Pas de secret.
- Pas de widget libre.

## 7. Tests ajoutes ou renforces

Aucun test backend ajoute pour V1-023; le lot est documentaire. Le dry-run seed existant a ete execute.

## 8. Validations lancees avec resultats

- `DEMO_SEED_CONFIRM=revision-demo DEMO_FIREBASE_UID=demo-local-uid npm run demo:seed -- --dry-run`: OK, mode dry-run, URL/UID masques, 6 types V1-A listes.
- `npm test -- rich-closed --runInBand`: OK, 10 suites, 245 tests.
- `npm test -- activities --runInBand`: OK, 19 suites passees, 1 suite skipped, 342 tests passes, 1 skipped.
- `npm run test:e2e -- --runInBand`: OK, 2 suites, 25 tests.
- `npm test -- revision --runInBand`: OK, 15 suites, 87 tests.
- `npm test -- revision-session --runInBand`: OK, 6 suites, 41 tests.
- `npm test -- revision-sessions --runInBand`: OK, 6 suites, 41 tests.
- `npm run lint:check`: OK.
- `npm run build`: OK.
- `git diff --check`: OK pour les diffs suivis apres generation finale des rapports; les fichiers docs non suivis sont listes dans le status courant et relus dans les passes de review.

## 9. Validations non lancees avec justification

- Seed write reel non lance: il ecrit en base et reste optionnel local/dev avec UID Firebase de demo explicite.
- `npm install` non lance: dependances deja presentes, validations npm executees.
- Lancement manuel API/app non effectue: couvert par runbook, tests et build; pas necessaire pour modifier docs.
- Aucun provider IA reel lance.
- Aucun deploiement lance.

## 10. Risques restants

- Le seed persistant ne montre que les 6 types V1-A; les 14 types sont verifies par tests/fixtures mockes.
- Une vraie generation `/activities/rich-closed/start` peut dependre d'un provider IA configure.
- La demo `image_choice` reste en fallback local tant que les assets licencies ne sont pas branches.

## 11. Recommandation prochain lot

V1-025 — Revue finale V1 et readiness audit. Aucun bis obligatoire n'est identifie pour V1-023.

## 12. Passes de review

- Documentation/runbook: revue sub-agent a signale chemins sans accent et categories de commandes; corriges.
- Commandes non destructives: dry-run verifie; seed write optionnel et garde.
- UI: hors scope API, traite cote app V1-024.
- Accessibilite: hors scope API, traite cote app V1-024.
- Performance: aucun changement runtime API.
- Anti-fuite: runbook liste les champs interdits pre-submit.
- Tests: validations backend lancees; dry-run lance.
- Securite: pas de secret, pas de prod, pas de deploiement, pas de migration.
- Reviewer final: pass read-only, aucun finding sur le diff final V1-023/V1-024.

## 13. Critique honnete du prompt initial

Le prompt est coherent. La seule tension est le mot "demo V1" face au seed persistant actuel, qui ne contient que V1-A. Le runbook ne masque pas cette limite: il distingue demo stable par seed, smoke automatise 14 types et generation reelle eventuellement dependante du provider IA.

## 14. Contenu complet des fichiers crees/modifies/supprimes

Le present rapport est liste sans s'inclure lui-meme pour eviter une recursion infinie.

### docs/v1/DEMO_RUNBOOK_V1.md

```md
# Demo runbook V1 — Rich closed

Ce runbook est la source canonique pour rejouer une demo V1 locale/dev de Revision Project autour du parcours rich closed.

Il est volontairement strict : aucune commande destructive n'est requise, aucun secret n'est donne en exemple, aucun deploiement n'est inclus, et les commandes qui peuvent ecrire en base sont separees des commandes de verification.

## 1. Objectif de la demo

La demo V1 doit prouver que Revision Project sait :

- exposer et consommer des exercices rich closed V1 ;
- lancer un parcours direct `activities/rich-closed` ;
- proposer un launcher Today vers `rich_closed_exercise` ;
- proposer un launcher revision session vers `rich_closed_exercise` ;
- soumettre des reponses fermees et afficher une correction post-submit ;
- garder les corrections hors payload pre-submit ;
- borner les catalogues et les types de questions ;
- refuser les widgets libres et les rendus JSON arbitraires.

La demo ne prouve pas la readiness finale de production. V1-025 reste le lot separe de revue finale/readiness audit.

## 2. Perimetre fonctionnel couvert

La V1 rich closed couvre 14 types fermes :

- V1-A : `single_choice`, `multiple_choice`, `matching`, `ordering`, `case_qualification`, `error_detection` ;
- V1-B : `timeline`, `date_slider`, `true_false_grid`, `cause_consequence` ;
- V1-C : `institution_matrix`, `diagram_labeling`, `calculation_mcq` ;
- V1-D : `image_choice`.

Etat demo important :

- Le seed persistant actuel cree un exercice rich closed V1-A stable a 6 questions.
- Les 14 types sont verifies par fixtures, tests unitaires et smoke E2E mocke.
- `image_choice` utilise un catalogue d'assets allowliste cote API et un fallback local cote Flutter tant qu'aucun bitmap licencie n'est branche.

## 3. Prerequis

### API

- Repo : `/Users/karim/Project/app-révision/api` ou chemin local equivalent.
- Node verifie pendant ce lot : `v26.0.0`.
- npm verifie pendant ce lot : `11.12.1`.
- Package manager utilise par le repo : npm.
- PostgreSQL local/dev si un seed write optionnel est lance.
- Firebase Auth/Admin configure pour les appels HTTP authentifies.
- `.env.example` fournit les variables attendues sans secret reel.
- `DATABASE_URL` par defaut local : `postgresql://revision:revision@localhost:5432/revision?schema=public`.

Variables API utiles, sans valeur secrete :

```bash
DATABASE_URL="postgresql://revision:revision@localhost:5432/revision?schema=public"
REDIS_HOST="localhost"
REDIS_PORT="6379"
FIREBASE_PROJECT_ID="<firebase-project-id>"
FIREBASE_SERVICE_ACCOUNT_JSON=""
DOCUMENT_STORAGE_ROOT="storage/revision-documents"
AI_PROVIDER="genkit"
GOOGLE_GENAI_API_KEY="<local-dev-key-or-empty>"
MISTRAL_API_KEY=""
```

Les providers IA ne sont pas necessaires pour les tests mockes. Une vraie generation rich closed via `/activities/rich-closed/start` peut dependre de la configuration IA de l'environnement.

### App Flutter

- Repo : `/Users/karim/Project/app-révision/revision_app` ou chemin local equivalent.
- Flutter verifie pendant ce lot : `3.44.0`.
- Dart SDK verifie pendant ce lot : `3.12.1`.
- `pubspec.yaml` declare `environment.sdk: ^3.12.0`.
- Device, simulateur ou Chrome selon l'environnement local.
- URL API configuree par dart-define :

```bash
--dart-define=API_BASE_URL=http://localhost:3000
```

La valeur par defaut de l'app pointe vers une API distante ; pour une demo locale, passer explicitement `API_BASE_URL`.

## 4. Commandes verifiees pendant ce lot

Ces commandes ont ete lancees localement pendant V1-023/V1-024 :

```bash
node --version
npm --version
flutter --version
dart --version
DEMO_SEED_CONFIRM=revision-demo DEMO_FIREBASE_UID=demo-local-uid npm run demo:seed -- --dry-run
```

Le dry-run seed a retourne `mode: "dry-run"`, une URL DB masquee, un UID Firebase masque, le sujet `demo-subject-droit-constitutionnel`, la session `demo-rich-closed-session-regime-parlementaire` et les 6 types V1-A.

Les validations completes du lot sont listees dans les rapports V1-023/V1-024.

## 5. Commandes API

### Validations API verifiees pendant ce lot

Depuis le repo API :

```bash
npm run lint:check
npm run build
npm test -- rich-closed --runInBand
npm test -- activities --runInBand
npm run test:e2e -- --runInBand
```

### Commandes API recommandees mais non lancees pendant ce lot

Installation, si les dependances ne sont pas deja presentes :

```bash
npm install
```

Lancement local :

```bash
npm run start:dev
```

ou, apres build deja verifie :

```bash
npm run start:prod
```

Logs attendus :

- Nest demarre sans erreur ;
- port par defaut : `3000` si `PORT` n'est pas defini ;
- erreurs Firebase/DB explicites si la configuration locale manque.

## 6. Seed demo

### Dry-run non destructif

Commande verifiee :

```bash
DEMO_SEED_CONFIRM=revision-demo DEMO_FIREBASE_UID=demo-local-uid npm run demo:seed -- --dry-run
```

Cette commande :

- n'ecrit pas en base ;
- ne se connecte pas a Prisma avant de sortir ;
- masque l'URL DB ;
- masque l'UID Firebase ;
- liste le plan demo et les IDs `demo-*`.

### Seed write optionnel local/dev

Cette commande est optionnelle, non lancee pendant ce lot, et reservee a une base locale/dev explicitement dediee a la demo :

```bash
DEMO_SEED_CONFIRM=revision-demo \
DEMO_FIREBASE_UID=<uid-firebase-demo> \
DEMO_STUDENT_EMAIL=demo-revision@example.test \
npm run demo:seed
```

Garde-fous existants :

- refuse `NODE_ENV=production` ;
- exige `DEMO_SEED_CONFIRM=revision-demo` ;
- exige `DEMO_FIREBASE_UID` ou `DEMO_STUDENT_FIREBASE_UID` ;
- utilise des `upsert` sur le namespace demo ;
- refuse d'ecrire si le namespace demo appartient deja a un autre student.

Ne jamais lancer ce seed sur une base de production.

## 7. Lancement app

### Validations app verifiees pendant ce lot

Depuis le repo Flutter :

```bash
dart analyze lib test
flutter test test/features/activities --reporter compact
flutter test --reporter compact
```

### Commandes app recommandees mais non lancees pendant ce lot

Installation des dependances, si necessaire :

```bash
flutter pub get
```

Lancement local :

```bash
flutter run --dart-define=API_BASE_URL=http://localhost:3000
```

Si le simulateur n'est pas disponible, lancer d'abord :

```bash
flutter devices
```

Puis choisir le device :

```bash
flutter run -d <device-id> --dart-define=API_BASE_URL=http://localhost:3000
```

## 8. Scenario demo utilisateur

### Scenario stable avec seed V1-A

1. Lancer l'API en local.
2. Lancer le dry-run seed pour verifier les fixtures.
3. Si l'environnement local/dev est pret, lancer le seed write optionnel avec un compte Firebase demo.
4. Lancer l'app avec `API_BASE_URL=http://localhost:3000`.
5. Se connecter avec le compte Firebase demo correspondant a l'UID seede.
6. Ouvrir directement :

```text
/activities/rich-closed?sessionId=demo-rich-closed-session-regime-parlementaire
```

7. Verifier que l'exercice se charge sans correction pre-submit.
8. Repondre aux 6 questions V1-A.
9. Soumettre.
10. Verifier le score, les corrections et les explications post-submit.

### Scenario Today

1. Ouvrir l'app.
2. Aller sur Today.
3. Verifier qu'une action `rich_closed_exercise` peut apparaitre quand une notion eligible existe.
4. Cliquer l'action rich closed.
5. Verifier que l'app ouvre la page rich closed avec `subjectId` et `knowledgeUnitId`.

Ce scenario peut declencher une generation rich closed reelle selon la configuration API. En demo sans provider IA, preferer le scenario stable par `sessionId` ou les tests automatises.

### Scenario revision session

1. Ouvrir une session de revision avec une notion eligible.
2. Demander ou selectionner une action rich closed.
3. Verifier que la session propose un launcher borne, sans payload de questions ni correction.
4. Cliquer le launcher.
5. Verifier l'ouverture de la page rich closed.

Comme Today, ce scenario peut dependre de la generation backend si aucun exercice persistant n'est charge par `sessionId`.

### Verification `image_choice`

`image_choice` est couvert par fixtures/tests V1-D. Dans l'app, le widget affiche un fallback local neutre `Image non disponible` tant qu'aucun bitmap licencie n'est branche. Aucun `Image.network`, aucune URL image, aucun base64, aucun storage path et aucun WebView ne sont attendus.

## 9. Smoke checks API

Endpoints rich closed :

```bash
API_URL=http://localhost:3000
TOKEN=<firebase-id-token-demo>

curl -sS -X POST "$API_URL/activities/rich-closed/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subjectId": "demo-subject-droit-constitutionnel",
    "knowledgeUnitId": "demo-ku-regime-parlementaire",
    "questionCount": 6,
    "complexityProfile": "exam"
  }'

curl -sS "$API_URL/activities/rich-closed/<session-id>" \
  -H "Authorization: Bearer $TOKEN"

curl -sS "$API_URL/activities/rich-closed/<session-id>/result" \
  -H "Authorization: Bearer $TOKEN"

curl -sS -X POST "$API_URL/activities/rich-closed/<session-id>/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"answers":[{"questionId":"<question-id>","questionKind":"single_choice","choiceId":"<choice-id>"}]}'
```

Checks attendus :

- start/get pre-submit ne contiennent pas `correct*`, `explanation`, `score`, `feedback`, `modelAnswer`, `renderPayload`, `imageUrl`, `base64`, `storagePath`, `blob` ;
- result avant submit renvoie une erreur controlee ;
- submit incomplet ou invalide renvoie une erreur controlee ;
- result apres submit contient score/correction/explication ;
- Today renvoie seulement un launcher borne ;
- revision session renvoie seulement un launcher borne.

Pour couvrir les 14 types sans provider IA, lancer les tests E2E mockes :

```bash
npm run test:e2e -- --runInBand
```

## 10. Smoke checks app

Depuis l'app :

- la page rich closed charge avec `sessionId` ou avec `subjectId` + `knowledgeUnitId` ;
- le bouton submit reste disabled tant que les reponses obligatoires sont incompletes ;
- le bouton submit devient enabled quand l'exercice est complet ;
- aucune correction n'est visible avant submit ;
- la correction est visible uniquement apres submit ;
- les longs libelles restent lisibles ou tronques proprement ;
- les dropdowns longs gardent le libelle complet via tooltip ;
- `image_choice` affiche le fallback local neutre ;
- Today navigue vers rich closed sans exposer de correction ;
- revision session navigue vers rich closed sans exposer de correction.

## 11. Troubleshooting

### API ne demarre pas

- Verifier `node --version`.
- Verifier `npm install`.
- Verifier `.env`.
- Verifier que PostgreSQL est accessible si une route touche Prisma.

### DB non configuree

- Lancer uniquement le dry-run seed.
- Configurer `DATABASE_URL` local/dev.
- Ne pas utiliser une base prod.

### Seed refuse

- Verifier que `NODE_ENV` n'est pas `production`.
- Ajouter `DEMO_SEED_CONFIRM=revision-demo`.
- Ajouter `DEMO_FIREBASE_UID` ou `DEMO_STUDENT_FIREBASE_UID`.
- Si le namespace demo appartient a un autre student, utiliser une base demo propre.

### Firebase/Auth

- Le seed ne cree pas de compte Firebase.
- Recuperer un ID token depuis un compte demo existant.
- Ne jamais coller un token dans Git ou dans un rapport.

### CORS / API URL

- Verifier `API_BASE_URL` cote app.
- Verifier `PORT` cote API.
- Verifier que l'origin localhost est autorisee.

### Tests E2E rouges

- Lancer `npm test -- activities --runInBand` pour isoler.
- Verifier les fixtures rich closed.
- Verifier que les tests IA restent mockes.

### Flutter analyze rouge

- Lancer `dart format <fichiers modifies>`.
- Relancer `dart analyze lib test`.

### Simulateur indisponible

- Lancer `flutter devices`.
- Demarrer un simulateur ou utiliser Chrome si supporte par le projet.

### `image_choice` affiche un fallback

C'est attendu tant qu'aucun asset bitmap licencie n'est branche. Le fallback doit rester local, neutre et sans fuite semantique.

### Genkit indisponible

- Les tests ne doivent pas appeler de provider reel.
- Pour une demo sans provider, utiliser le seed V1-A par `sessionId` et les smokes mockes.

## 12. Limites connues

- Le seed persistant actuel couvre V1-A a 6 questions ; les 14 types V1 sont couverts par fixtures/tests mockes.
- `image_choice` utilise encore un fallback local tant que les bitmaps licencies ne sont pas branches.
- L'UI rich closed reste provisoire et a seulement recu un polish cible.
- Ce runbook vise local/dev, pas production.
- Aucun deploiement Dokploy n'est fait dans ce lot.
- Aucune migration prod n'est lancee dans ce lot.
- V1-025 readiness audit reste a faire.

## 13. Commandes non lancees mais plausibles

Ces commandes sont plausibles dans un environnement local/dev complet, mais doivent etre confirmees par l'operateur :

```bash
npm install
npm run start:dev
flutter pub get
flutter run --dart-define=API_BASE_URL=http://localhost:3000
```

Le seed write est optionnel et reserve a local/dev :

```bash
DEMO_SEED_CONFIRM=revision-demo DEMO_FIREBASE_UID=<uid-firebase-demo> npm run demo:seed
```

## 14. Commandes interdites ou dangereuses

Ne pas lancer pour cette demo :

```bash
git reset --hard
git clean -fd
git push
git tag
npm run prisma:migrate:deploy
NODE_ENV=production npm run demo:seed
dart fix --apply
dart format .
```

Ne pas faire :

- seed sur production ;
- deploiement Dokploy ;
- appel provider IA reel dans les tests ;
- telechargement d'asset image ;
- ajout d'URL image, base64, storage path, CDN path ou WebView ;
- readiness audit V1-025.

## 15. Checklist de demo

- [ ] API `npm run build` OK.
- [ ] API tests critiques OK.
- [ ] Seed dry-run OK.
- [ ] App `dart analyze lib test` OK.
- [ ] App tests critiques OK.
- [ ] App lancee avec `API_BASE_URL` local.
- [ ] Flow rich closed charge.
- [ ] Submit disabled avant reponses completes.
- [ ] Correction visible seulement post-submit.
- [ ] Anti-fuite pre-submit verifie.
- [ ] Today launcher verifie.
- [ ] Revision session launcher verifie.
- [ ] `image_choice` fallback connu et explique.
- [ ] V1-025 non realise.

```

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
| V1-025  | Revue finale V1 et readiness audit         | À faire | À créer                                                                             |

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
- Statut : à faire séparément.
- Non-objectifs du présent plan : ne pas marquer réalisé dans V1-023/V1-024.

```
