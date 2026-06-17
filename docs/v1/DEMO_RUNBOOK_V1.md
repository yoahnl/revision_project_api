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
