# QUALITY-00 — CI baseline report — API

## 1. Résumé

QUALITY-00 ajoute une baseline GitHub Actions côté backend NestJS avec un workflow `API CI` déclenché sur `pull_request` et sur `push` vers `main`.

Le workflow vérifie :

- installation via `npm ci` ;
- `npx prisma validate` ;
- `npx prisma generate` ;
- build NestJS ;
- lint ESLint ;
- tests Jest unitaires ;
- tests e2e critiques ;
- `git diff --check`.

Le lot ne modifie aucune logique runtime, aucun schéma Prisma et aucune migration.

## 2. Audit initial

### Workflows existants

Aucun dossier `.github/workflows` n'existait côté API.

### Scripts npm retenus

Scripts disponibles et retenus :

- `build`
- `lint:check`
- `test`
- `test:e2e`
- `prisma:generate`

Scripts exclus :

- `lint`, car il exécute ESLint en mode `--fix` ;
- `format`, car il écrit dans les fichiers ;
- `smoke:diagnostic-quiz-ai`, car il dépend d'un provider IA réel et de secrets.

### Services CI

PostgreSQL n'est pas ajouté à la baseline obligatoire : `prisma validate` et `prisma generate` n'ont pas besoin de DB vivante, et les e2e critiques mockent les providers/repositories.

Redis n'est pas ajouté : `NODE_ENV=test` et `DOCUMENT_PROCESSING_QUEUE_DISABLED=true` activent la queue no-op du module Jobs.

Firebase réel n'est pas requis : les e2e mockent Firebase et injectent un étudiant de test.

## 3. Workflow créé

Créé :

```text
.github/workflows/api-ci.yml
```

## 4. Commandes retenues

```bash
npm ci
npx prisma validate
npx prisma generate
npm run build
npm run lint:check
npm test -- --runInBand
npm run test:e2e -- --runInBand
git diff --check
```

## 5. Variables d'environnement CI

```yaml
CI: "true"
NODE_ENV: test
DATABASE_URL: postgresql://revision:revision@localhost:5432/revision?schema=public
DOCUMENT_PROCESSING_QUEUE_DISABLED: "true"
DOCUMENT_PROCESSING_WORKER_ENABLED: "false"
FIREBASE_PROJECT_ID: revision-ci
FIREBASE_SERVICE_ACCOUNT_JSON: ""
AI_PROVIDER: google
GOOGLE_GENAI_API_KEY: local-dev-key
GENKIT_MODEL: googleai/gemini-2.5-flash
MISTRAL_API_KEY: ""
MIMO_API_KEY: ""
```

Aucune vraie clé n'est utilisée.

## 6. Tests couverts

- Tests unitaires Jest complets.
- Tests e2e Jest complets.
- Prisma validate/generate.
- Build NestJS.
- ESLint check.

## 7. Tests non couverts

- Smoke IA réel.
- Tests d'intégration Prisma DB réelle conditionnés par variables spécifiques.
- Redis/BullMQ réel.
- Déploiement/staging.

## 8. Commandes exécutées

```text
ruby -e "require 'yaml'; Dir['.github/workflows/*.yml'].each { |f| YAML.load_file(f); puts f }"
EXIT_CODE=0
Note locale : Ruby affiche un warning ffi local, sans lien avec le YAML.

npm ci
EXIT_CODE=0
91 vulnerabilities reported by npm audit output.

npx prisma validate
EXIT_CODE=0
The schema at prisma/schema.prisma is valid.

npx prisma generate
EXIT_CODE=0
Generated Prisma Client 7.8.0.

npm run build
EXIT_CODE=0

npm run lint:check
EXIT_CODE=0

npm test -- --runInBand
EXIT_CODE=0
Test Suites: 1 skipped, 85 passed, 85 of 86 total.
Tests: 1 skipped, 740 passed, 741 total.

npm run test:e2e -- --runInBand
EXIT_CODE=0
Test Suites: 2 passed, 2 total.
Tests: 34 passed, 34 total.

git diff --check
EXIT_CODE=0
```

## 9. Impact roadmap

`QUALITY-00` passe à `DONE` dans :

- `docs/roadmap/v2/LOT_TRACKER_V2.md`
- `docs/roadmap/v2/EXECUTION_LOT_TRACKER_V2.md`

Le README pointe vers ce rapport.

## 10. Limites

- Pas de service PostgreSQL live dans la baseline V0.
- Pas de Redis live dans la baseline V0.
- Pas de smoke IA réel.
- `npm audit` signale 91 vulnérabilités transitoires/dépendances ; elles ne sont pas traitées dans ce lot CI.

## 11. Risques

- Les tests d'intégration DB réelle restent à formaliser dans un lot qualité ultérieur.
- Le smoke IA devra devenir un workflow manuel séparé avec secrets protégés si on veut surveiller les providers.

## 12. Comment lire les résultats CI

Un PR est acceptable côté API si :

- `API CI / Build, lint, and test API` est vert ;
- Prisma validate/generate passe ;
- build/lint/unit/e2e passent ;
- `git diff --check` ne signale aucune whitespace error.

## 13. Auto-review

- Workflow API créé.
- Aucun secret réel.
- PostgreSQL non requis pour baseline V0.
- Redis explicitement désactivé en test.
- Firebase réel non requis.
- Prisma validate/generate couverts.
- Build API couvert.
- Lint API couvert.
- Tests API couverts.
- E2E critiques couverts.
- YAML valide.
- Trackers mis à jour.
- Rapport créé.
- Aucun runtime modifié.
- Aucun commit effectué.

## 14. Fichiers créés/modifiés

### Créés

- `.github/workflows/api-ci.yml`
- `docs/roadmap/v2/QUALITY_00_CI_BASELINE_REPORT.md`

### Modifiés

- `docs/roadmap/v2/README.md`
- `docs/roadmap/v2/LOT_TRACKER_V2.md`
- `docs/roadmap/v2/EXECUTION_LOT_TRACKER_V2.md`

## 15. Contenu complet des fichiers créés/modifiés

Le rapport courant n'est pas auto-inclus pour éviter une duplication récursive.

### `.github/workflows/api-ci.yml`

```yaml
name: API CI

on:
  pull_request:
  push:
    branches:
      - main

concurrency:
  group: api-ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  api:
    name: Build, lint, and test API
    runs-on: ubuntu-latest
    timeout-minutes: 30

    env:
      CI: "true"
      NODE_ENV: test
      DATABASE_URL: postgresql://revision:revision@localhost:5432/revision?schema=public
      DOCUMENT_PROCESSING_QUEUE_DISABLED: "true"
      DOCUMENT_PROCESSING_WORKER_ENABLED: "false"
      FIREBASE_PROJECT_ID: revision-ci
      FIREBASE_SERVICE_ACCOUNT_JSON: ""
      AI_PROVIDER: google
      GOOGLE_GENAI_API_KEY: local-dev-key
      GENKIT_MODEL: googleai/gemini-2.5-flash
      MISTRAL_API_KEY: ""
      MIMO_API_KEY: ""

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Validate Prisma schema
        run: npx prisma validate

      - name: Generate Prisma client
        run: npx prisma generate

      - name: Build
        run: npm run build

      - name: Lint
        run: npm run lint:check

      - name: Test unit suite
        run: npm test -- --runInBand

      - name: Test e2e suite
        run: npm run test:e2e -- --runInBand

      - name: Check whitespace
        run: git diff --check
```

### `docs/roadmap/v2/README.md`

````md
# Roadmap V2 — Revision Project API

Ce dossier contient la roadmap V2 côté backend NestJS.

La vision produit complète vit principalement côté Flutter dans `revision_project_app/docs/roadmap/v2/REVISION_PROJECT_ROADMAP_V2.md`. Ce dossier API documente l'alignement backend, les lots techniques, les risques et le protocole de mise à jour.

## Fichiers

- `API_ROADMAP_V2.md` : roadmap backend alignée sur la roadmap produit.
- `LOT_TRACKER_V2.md` : tracker des macro-lots avec impact API.
- `API_EXECUTION_PLAN_V2.md` : découpage backend des lots exécutables.
- `EXECUTION_LOT_TRACKER_V2.md` : tracker backend des lots exécutables avec les mêmes IDs que le repo app.
- `ROADMAP_UPDATE_PROTOCOL.md` : règles de mise à jour après chaque lot.
- `STAB_00B_ROADMAP_V2_HARDENING_REPORT.md` : rapport du durcissement de roadmap côté API.
- `QUALITY_00_CI_BASELINE_REPORT.md` : rapport de la baseline CI GitHub Actions côté API.

Les rapports `docs/core/` restent l'historique des lots déjà réalisés.

## Source de vérité

Pour une décision produit, lire d'abord la roadmap app. Pour une décision backend, lire ce dossier puis le dernier rapport `docs/core/`.

Ordre de lecture recommandé côté API :

1. `API_ROADMAP_V2.md`
2. `LOT_TRACKER_V2.md`
3. `API_EXECUTION_PLAN_V2.md`
4. `EXECUTION_LOT_TRACKER_V2.md`
5. `ROADMAP_UPDATE_PROTOCOL.md`
6. le dernier rapport backend

Le journal de décisions canonique vit côté app :

```text
revision_project_app/docs/roadmap/v2/DECISIONS_V2.md
```

Statuts de décisions utilisés par ce journal canonique : `PROPOSED`, `ACCEPTED`, `REJECTED`, `SUPERSEDED`.
````

### `docs/roadmap/v2/LOT_TRACKER_V2.md`

```md
# Lot Tracker V2 — API

Ce tracker suit les macro-lots stratégiques et leur impact API. Le détail exécutable vit dans `EXECUTION_LOT_TRACKER_V2.md`.

Statuts autorisés : `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`, `DEFERRED`, `REPLACED`.

Horizons autorisés : `FOUNDATION`, `MVP_STABLE`, `MVP_PLUS`, `POST_MVP`, `RELEASE`.

| Lot | Titre | Horizon | Impact API | Statut | Dépend de | Lots exécutables | Objectif API | Validation | Rapport |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| STAB-00 | Roadmap V2 canonicalisation | FOUNDATION | Documentation | DONE | Aucun | STAB-00B | Créer l'alignement API V2. | Documents V2 créés. | `docs/roadmap/v2/` |
| STAB-00B | Roadmap V2 hardening, execution slicing & governance | FOUNDATION | Documentation | DONE | STAB-00 | STAB-00B | Durcir la roadmap API et synchroniser les lots exécutables. | Plans et trackers API alignés. | `docs/roadmap/v2/STAB_00B_ROADMAP_V2_HARDENING_REPORT.md` |
| QUALITY-00 | CI baseline | FOUNDATION | Oui | DONE | STAB-00B | QUALITY-00 | Baseline CI API : Prisma, build, lint, tests et e2e critiques. | Pipeline GitHub Actions reproductible sans secrets réels. | `docs/roadmap/v2/QUALITY_00_CI_BASELINE_REPORT.md` |
| STAB-01 | Product navigation & UX coherence | MVP_STABLE | Aucun ou ponctuel | TODO | STAB-00B | STAB-01A, STAB-01B, STAB-01C | Confirmer les besoins API des corrections UX. | API inchangée ou besoin documenté. | Repo app ou rapport API si touché |
| STAB-02 | Frontend design system unification | MVP_STABLE | Aucun | TODO | STAB-01C | STAB-02A, STAB-02B | Aucun changement backend attendu. | API inchangée. | Repo app |
| CORE-09 | Source lifecycle & storage policy | MVP_STABLE | Oui | TODO | STAB-01A | CORE-09A, CORE-09B, CORE-09C | Sécuriser archive/suppression, stockage et lifecycle sujet/cours. | Tests Prisma/API. | À créer |
| CORE-10 | Question bank production hardening | MVP_STABLE | Oui | TODO | CORE-09A | CORE-10A, CORE-10B, CORE-10C | Durcir génération, sélection et disponibilité de la banque. | Tests service/repository/e2e. | À créer |
| CORE-11 | Session resume & history | MVP_STABLE | Oui | TODO | CORE-10A | CORE-11A, CORE-11B | Reprise et historique de sessions. | Tests lifecycle. | À créer |
| PLUS-01 | Deep Revision course-level | MVP_PLUS | Oui | TODO | STAB-02A, CORE-10A | PLUS-01A, PLUS-01B | Route deep + correction ouverte course-level. | Tests IA/correction/mastery. | À créer |
| PLUS-02 | Revision sheet complete / exam modes | MVP_PLUS | Oui | TODO | STAB-02B, CORE-09A | PLUS-02 | Contrats de fiche complète/examen. | Tests study artifacts. | À créer |
| ADAPT-01 | Today / adaptive coach | MVP_PLUS | Oui | TODO | CORE-10B | ADAPT-01 | Recommandation quotidienne. | Tests recommandation. | À créer |
| PLUS-03 | Exam preparation V1 | POST_MVP | Oui | TODO | PLUS-01B, PLUS-02, CORE-11B | PLUS-03 | Mode examen réel. | Tests session exam. | À créer |
| GENUI-01 | Controlled GenUI surface | POST_MVP | Oui | TODO | STAB-02B, ADAPT-01, PLUS-01A | GENUI-01 | Payloads GenUI strictement contrôlés. | Tests schema/fallback. | À créer |
| RELEASE-01 | Production readiness | RELEASE | Oui | TODO | QUALITY-00, lots MVP_STABLE requis | RELEASE-01 | CI complète, stockage, monitoring, quotas, secrets. | Checklist release. | À créer |
```

### `docs/roadmap/v2/EXECUTION_LOT_TRACKER_V2.md`

```md
# Execution Lot Tracker V2 — API

Ce tracker reprend les mêmes IDs que le tracker exécutable côté app. Les lots app-only sont conservés pour synchronisation avec `Impact API : Aucun`.

Statuts autorisés : `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`, `DEFERRED`, `REPLACED`.

Horizons autorisés : `FOUNDATION`, `MVP_STABLE`, `MVP_PLUS`, `POST_MVP`, `RELEASE`.

| Lot | Parent macro-lot | Horizon | Impact API | Statut | Dépend de | Objectif API | Validation API | Rapport |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| STAB-00B | STAB-00 | FOUNDATION | Documentation | DONE | STAB-00 | Synchroniser la roadmap API avec la couche exécutable. | Docs et trackers API alignés. | `docs/roadmap/v2/STAB_00B_ROADMAP_V2_HARDENING_REPORT.md` |
| QUALITY-00 | QUALITY-00 | FOUNDATION | Oui | DONE | STAB-00B | Baseline CI API : Prisma, build, lint, tests et e2e critiques. | Pipeline GitHub Actions reproductible sans secrets réels. | `docs/roadmap/v2/QUALITY_00_CI_BASELINE_REPORT.md` |
| STAB-01A | STAB-01 | MVP_STABLE | Aucun attendu | TODO | STAB-00B | Confirmer que le shell n'a pas besoin de nouvelle route. | API inchangée ou besoin documenté. | Repo app |
| STAB-01B | STAB-01 | MVP_STABLE | Aucun attendu | TODO | STAB-01A | Confirmer que Home/Hub/Course utilisent les contrats existants. | API inchangée ou besoin documenté. | Repo app |
| STAB-01C | STAB-01 | MVP_STABLE | Possible | TODO | STAB-01B | Identifier les actions UX qui nécessitent une API. | Aucun bouton `NEEDS_API` sans lot backend. | À créer si API touchée |
| STAB-02A | STAB-02 | MVP_STABLE | Aucun | TODO | STAB-01C | Aucun changement backend. | API inchangée. | Repo app |
| STAB-02B | STAB-02 | MVP_STABLE | Aucun | TODO | STAB-02A | Aucun changement backend. | API inchangée. | Repo app |
| CORE-09A | CORE-09 | MVP_STABLE | Oui | TODO | STAB-01A | Archive/delete semantics des sources. | Tests ownership, usage historique, 409/archive. | À créer |
| CORE-09B | CORE-09 | MVP_STABLE | Oui | TODO | CORE-09A | Cleanup blob et abstraction storage. | Tests storage et cleanup. | À créer |
| CORE-09C | CORE-09 | MVP_STABLE | Oui | TODO | CORE-09A | Lifecycle subject/course : rename/edit/archive si validé. | Tests auth/404/409/happy path. | À créer |
| CORE-10A | CORE-10 | MVP_STABLE | Oui | TODO | CORE-09A | Async question bank readiness. | Jobs, retries, status readiness. | À créer |
| CORE-10B | CORE-10 | MVP_STABLE | Oui | TODO | CORE-10A | Multi-KU selection et concurrence. | Tests sélection, distribution, locking. | À créer |
| CORE-10C | CORE-10 | MVP_STABLE | Oui | TODO | CORE-10B | Découplage QuestionBankService et métriques. | Unit tests + repository tests. | À créer |
| CORE-11A | CORE-11 | MVP_STABLE | Oui | TODO | CORE-10A | Draft persistence et resume. | Tests lifecycle/draft/ownership. | À créer |
| CORE-11B | CORE-11 | MVP_STABLE | Oui | TODO | CORE-11A | Historique et détails de sessions terminées. | Tests list/detail/completed. | À créer |
| PLUS-01A | PLUS-01 | MVP_PLUS | Oui | TODO | STAB-02A, CORE-10A, quick lifecycle stable | Route deep course-level open-question V1. | Tests correction/mastery. | À créer |
| PLUS-01B | PLUS-01 | MVP_PLUS | Oui | TODO | PLUS-01A, CORE-11A | Lifecycle/result Deep. | Tests completion/result deep. | À créer |
| PLUS-02 | PLUS-02 | MVP_PLUS | Oui | TODO | STAB-02B, CORE-09A | Fiches complète et pré-examen. | Tests study artifacts. | À créer |
| ADAPT-01 | ADAPT-01 | MVP_PLUS | Oui | TODO | CORE-10B | Recommandation Today. | Tests no data/practiced/stale mastery. | À créer |
| PLUS-03 | PLUS-03 | POST_MVP | Oui | TODO | PLUS-01B, PLUS-02, CORE-11B | Mode examen V1. | Tests lifecycle exam. | À créer |
| GENUI-01 | GENUI-01 | POST_MVP | Oui | TODO | STAB-02B, ADAPT-01, PLUS-01A | Payloads GenUI contrôlés. | Tests schema/fallback. | À créer |
| RELEASE-01 | RELEASE-01 | RELEASE | Oui | TODO | QUALITY-00, lots MVP_STABLE requis | Production readiness API. | Checklist release backend. | À créer |
```

## 16. Confirmation

Aucun code runtime n'a été modifié.

Aucun commit n'a été effectué.
