# RELEASE-01A — Runtime smoke API report

## Verdict

`DONE`, après confirmation opérateur du smoke MVP complet.

Le backend CORE-11B est déployé et démarre correctement. Les migrations sont appliquées, Redis est présent, BullMQ démarre, le worker question bank est enregistré et les routes critiques CORE-10/CORE-11A/CORE-11B sont exposées. `GET /health/readiness` a été ajouté pour vérifier Prisma/PostgreSQL sans exposer de secret. Le smoke MVP complet a été confirmé manuellement par l'opérateur humain du projet après le gate RELEASE-01A. Codex n'a pas exécuté ce parcours complet lui-même.

## Confirmation opérateur

Le smoke MVP complet a été confirmé manuellement par l'opérateur humain du projet après le gate RELEASE-01A. Codex n'a pas exécuté ce parcours complet lui-même ; cette clôture documente une confirmation opérateur. Aucun secret, token Firebase, URL privée sensible ou PDF de test n'est documenté dans ce rapport.

## Audit initial avant correction

### API runtime

- `GET /health` existe via `src/health.controller.ts` et retourne `{ "status": "ok" }`.
- `GET /health/readiness` vérifie PostgreSQL via Prisma et retourne `status=ready` si la requête légère réussit. Il doit être disponible après déploiement du lot RELEASE-01A.
- `src/app.module.ts` enregistre `HealthController`.
- `src/main.ts` démarre NestJS sur `process.env.PORT ?? 3000` avec CORS configuré.
- `Dockerfile` lance `prisma migrate deploy` au démarrage si `RUN_PRISMA_MIGRATIONS=true`, puis `node -r dotenv/config dist/src/main.js`.
- `package.json` contient `prisma:migrate:deploy`, `build`, `lint:check`, `test` et `test:e2e`.
- Aucun `docker-compose.yml` n'est présent dans le repo API.

### Prisma / migrations

- La migration CORE-11A est présente : `prisma/migrations/20260623010000_core_11a_session_drafts/migration.sql`.
- Elle crée `RevisionQuestionDraftAnswer` avec :
  - unicité par `studentId`, `sessionId`, `questionId` ;
  - index session, activity session et question ;
  - foreign keys vers `StudentProfile`, `RevisionSession`, `ActivitySession` et `Question`.
- Les logs Dokploy du backend CORE-11B indiquent `17 migrations found` puis `No pending migrations to apply`.

### Redis / workers / queues

- `JobsModule` configure BullMQ si `NODE_ENV !== test` et `DOCUMENT_PROCESSING_QUEUE_DISABLED !== true`.
- Redis est configuré par `REDIS_URL` ou `REDIS_HOST`/`REDIS_PORT`.
- Le worker question bank est activé par défaut en production si la queue n'est pas désactivée, sauf si `COURSE_QUESTION_BANK_PREPARATION_WORKER_ENABLED=false`.
- Les logs backend CORE-11B indiquent :
  - `BullModule dependencies initialized` ;
  - `course_question_bank_worker_started` ;
  - `course_question_bank_worker_runtime_configuration` avec `queueDisabled=false`, `questionBankWorkerEnabled=true`, `redisConfigured=true`, `consumerRegistered=true`.

### Endpoints critiques

Les logs de boot CORE-11B exposent les routes nécessaires au smoke :

- `POST /subjects`
- `POST /subjects/:subjectId/courses`
- `POST /courses/:courseId/source/course-pdf`
- `GET /courses/:courseId/question-bank/readiness`
- `POST /courses/:courseId/question-bank/prepare`
- `POST /courses/:courseId/revision-sessions/quick`
- `GET /courses/:courseId/revision-sessions/resumable`
- `GET /courses/:courseId/revision-sessions/history`
- `GET /revision-sessions/history`
- `GET /revision-sessions/:sessionId`
- `PUT /revision-sessions/:sessionId/questions/:questionId/draft-answer`
- `DELETE /revision-sessions/:sessionId/questions/:questionId/draft-answer`
- `POST /revision-sessions/:sessionId/complete`
- `GET /revision-sessions/:sessionId/result`

## Dokploy

Lecture seule uniquement.

- Projet : `revision app`.
- Backend : `backEnd`, application status `done`.
- Frontend : `frontEnd`, application status `done`.
- PostgreSQL : `revision-postgres`, application status `done`.
- Redis : `redis`, application status `done`.

Déploiements observés :

- API CORE-11B déployée : oui.
- Commit API déployé : `1804aee2ea9bf68d2b12d68a1e4b955c06c3935e`.
- App CORE-11B déployée : oui.
- Commit App déployé : `fbdb1e824732bd56151b4b0ebbd11d531ffc4ccb`.

Logs consultés :

- Backend : démarrage NestJS, migrations, routes et worker question bank.
- Redis : sauvegardes RDB régulières terminées avec succès.
- PostgreSQL : instance prête, checkpoints réguliers.

Secrets : aucun secret n'a été copié dans ce rapport.

## Etat migration Prisma

Le déploiement CORE-11B API a exécuté la séquence de migration au boot. Les logs indiquent que toutes les migrations connues sont appliquées.

Résultat : pas de blocker migration visible côté Dokploy.

## Etat API health/readiness

`GET /health` est disponible pour le liveness minimal.

`GET /health/readiness` est disponible pour le readiness DB minimal :

- succès : `status=ready`, `checks.database=ok` ;
- échec : HTTP 503, `status=not_ready`, `checks.database=unavailable`.

## Etat Redis / workers

Redis existe côté Dokploy et les logs montrent une instance vivante. Le backend CORE-11B initialise BullMQ et enregistre le consumer question bank. Aucune preuve de job de préparation exécuté pendant ce lot n'a été produite.

## Corrections faites

Correction de code API :

- ajout de `GET /health/readiness` avec check Prisma/PostgreSQL ;
- injection de `PrismaModule` dans `AppModule` pour le contrôleur santé ;
- tests unitaires du succès et de l'échec readiness.

Corrections documentaires :

- création du rapport API RELEASE-01A ;
- création du runbook smoke MVP ;
- création de l'evidence pack ;
- mise à jour des trackers API.

## Tests exécutés

Résultats :

- `npx prisma validate` : OK, schema valid.
- `npx prisma generate` : OK, Prisma Client 7.8.0 généré.
- `npm run build` : OK.
- `npm run lint:check` : OK.
- `npm test -- health --runInBand` : 1 suite passed, 3 tests passed.
- `npm test -- revision-sessions --runInBand` : 10 suites passed, 86 tests passed.
- `npm test -- courses --runInBand` : 14 suites passed, 122 tests passed.
- `npm test -- activities --runInBand` : 21 suites passed, 1 suite skipped, 365 tests passed, 1 skipped.
- `npm test -- question-bank --runInBand` : 7 suites passed, 38 tests passed.
- `npm test -- --runInBand` : 100 suites passed, 1 suite skipped, 863 tests passed, 1 skipped.
- `npm run test:e2e -- --runInBand` : 2 suites passed, 34 tests passed.
- `git diff --check` : OK.

## Smoke runtime

Non exécuté de bout en bout par Codex.

Le smoke MVP complet a ensuite été confirmé manuellement par l'opérateur humain du projet. Cette preuve est une confirmation opérateur, pas une exécution Codex.

Preuves partielles obtenues :

- CORE-11B API et App déployés ;
- migrations appliquées ;
- backend NestJS démarré ;
- routes nécessaires exposées ;
- worker question bank enregistré ;
- health/readiness DB ajouté localement et couvert par test unitaire ;
- PostgreSQL et Redis vivants.

## Blockers release

Pas de blocker technique détecté dans les fichiers ou logs audités.

La réserve de validation RELEASE-01A est levée par confirmation opérateur. RELEASE-01A est donc clôturé en `DONE`.

## Risques restants

- La preuve runtime complète reste une confirmation opérateur et non une exécution Codex.
- Pas de validation Marionette Codex du parcours complet avec PDF réel.
- Endpoint readiness DB dédié ajouté côté code : `GET /health/readiness`. Il vérifie PostgreSQL via Prisma avec une requête légère.
- Pas de script smoke automatisé, volontairement évité pour ne pas produire une fausse preuve sans auth/dataset contrôlés.

## Fichiers créés/modifiés

Créés côté API :

- `docs/release/RELEASE_01A_RUNTIME_SMOKE_API_REPORT.md`
- `docs/release/RELEASE_01A_MVP_RUNTIME_SMOKE_RUNBOOK.md`
- `docs/release/RELEASE_01A_RUNTIME_SMOKE_EVIDENCE_PACK.md`
- `docs/release/RELEASE_01A_OPERATOR_CONFIRMED_CLOSURE_API_REPORT.md`

Modifiés côté API :

- `src/health.controller.ts`
- `src/health.controller.spec.ts`
- `src/app.module.ts`
- `docs/roadmap/v2/EXECUTION_LOT_TRACKER_V2.md`
- `docs/roadmap/v2/LOT_TRACKER_V2.md`

## Auto-review finale

- Aucune preuve runtime complète n'a été inventée.
- Aucun secret n'a été recopié.
- Modifications backend limitées au health/readiness et à son wiring NestJS.
- Aucun prompt IA, provider IA, worker ou route produit n'a été modifié.
- Le statut `DONE` est utilisé uniquement après confirmation opérateur du smoke MVP complet.

## Critique du prompt

Le prompt est volontairement strict et adapté à un gate release. La seule tension est que le smoke complet dépend d'un utilisateur authentifié et d'un PDF réel ; sans credentials ni consigne de mutation runtime, Codex peut préparer le gate et vérifier l'infra, mais pas prouver honnêtement le parcours complet.

## Confirmation Git

Ce rapport initial a été créé avant le commit/push du gate RELEASE-01A. La clôture operator-confirmed ultérieure est documentée dans `docs/release/RELEASE_01A_OPERATOR_CONFIRMED_CLOSURE_API_REPORT.md`.
