# RELEASE-01A — Runtime smoke evidence pack

## Verdict

`READY_FOR_RUNTIME`, suivi comme `IN_PROGRESS` dans les trackers.

## Preuves Dokploy

Lecture seule.

### Services

- Projet Dokploy : `revision app`.
- Backend : `backEnd`, status `done`.
- Frontend : `frontEnd`, status `done`.
- PostgreSQL : `revision-postgres`, status `done`.
- Redis : `redis`, status `done`.

### Déploiements CORE-11B

- API : `CORE-11B session history API`, commit `1804aee2ea9bf68d2b12d68a1e4b955c06c3935e`, status `done`.
- App : `CORE-11B session history app`, commit `fbdb1e824732bd56151b4b0ebbd11d531ffc4ccb`, status `done`.

### Logs backend observés

Extraits non sensibles :

```text
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma/schema.prisma.
17 migrations found in prisma/migrations
No pending migrations to apply.
Starting Nest application...
BullModule dependencies initialized
course_question_bank_worker_started
JobsModule dependencies initialized
Mapped {/health, GET} route
Mapped {/courses/:courseId/question-bank/readiness, GET} route
Mapped {/courses/:courseId/question-bank/prepare, POST} route
Mapped {/courses/:courseId/revision-sessions/quick, POST} route
Mapped {/courses/:courseId/revision-sessions/resumable, GET} route
Mapped {/courses/:courseId/revision-sessions/history, GET} route
Mapped {/revision-sessions/history, GET} route
Mapped {/revision-sessions/:sessionId/result, GET} route
Mapped {/revision-sessions/:sessionId/questions/:questionId/draft-answer, PUT} route
Mapped {/revision-sessions/:sessionId/questions/:questionId/draft-answer, DELETE} route
course_question_bank_worker_runtime_configuration
queueDisabled: false
questionBankWorkerEnabled: true
redisConfigured: true
consumerRegistered: true
Nest application successfully started
```

### Logs Redis observés

Redis effectue des sauvegardes RDB régulières avec `Background saving terminated with success`.

### Logs PostgreSQL observés

PostgreSQL indique `database system is ready to accept connections` et des checkpoints réguliers. Aucun échec récent n'a été relevé dans les logs consultés.

## Preuves code / configuration

### API

- `src/health.controller.ts` expose `GET /health`.
- `src/health.controller.ts` expose localement `GET /health/readiness` avec un check Prisma/PostgreSQL. Cette correction n'est pas encore déployée tant que le lot n'est pas commit/push.
- `Dockerfile` exécute `prisma migrate deploy` si `RUN_PRISMA_MIGRATIONS=true`.
- `package.json` contient `prisma:migrate:deploy`.
- `JobsModule` loggue la configuration worker sans secret.
- La migration `20260623010000_core_11a_session_drafts` existe.

### App

- `AppConfig.apiBaseUrl` pointe par défaut vers `https://revision-api.yoahn.me`.
- `ios/ci_scripts/ci_post_clone.sh` passe `API_BASE_URL` via `--dart-define`.
- `dev/marionette_main.dart` existe.
- `dev/README.md` documente le lancement Marionette macOS/iOS.
- Les logs Marionette n'impriment pas les headers ni les bodies.

## Commandes locales exécutées

```text
npx prisma validate -> OK, schema valid
npx prisma generate -> OK, Prisma Client 7.8.0 generated
npm run build -> OK
npm run lint:check -> OK
npm test -- health --runInBand -> 1 suite passed, 3 tests passed
npm test -- revision-sessions --runInBand -> 10 suites passed, 86 tests passed
npm test -- courses --runInBand -> 14 suites passed, 122 tests passed
npm test -- activities --runInBand -> 21 suites passed, 1 skipped, 365 tests passed, 1 skipped
npm test -- question-bank --runInBand -> 7 suites passed, 38 tests passed
npm test -- --runInBand -> 100 suites passed, 1 skipped, 863 tests passed, 1 skipped
npm run test:e2e -- --runInBand -> 2 suites passed, 34 tests passed
git diff --check -> OK
```

## Smoke MVP complet

Non exécuté.

Raison : aucun token Firebase temporaire ni session utilisateur contrôlée n'a été fourni à Codex pour créer la matière, uploader un PDF, préparer la banque et compléter la session en production. Marionette peut être utilisée après connexion utilisateur via le runbook.

## Fichiers créés

- `docs/release/RELEASE_01A_RUNTIME_SMOKE_API_REPORT.md`
- `docs/release/RELEASE_01A_MVP_RUNTIME_SMOKE_RUNBOOK.md`
- `docs/release/RELEASE_01A_RUNTIME_SMOKE_EVIDENCE_PACK.md`

## Fichiers modifiés

- `docs/roadmap/v2/EXECUTION_LOT_TRACKER_V2.md`
- `docs/roadmap/v2/LOT_TRACKER_V2.md`
- `src/health.controller.ts`
- `src/health.controller.spec.ts`
- `src/app.module.ts`

## Contenu complet des fichiers créés

Le contenu complet est présent dans les fichiers listés ci-dessus. Ce pack ne s'inclut pas lui-même pour éviter une section récursive.

## Limite de preuve

Le gate est préparé, l'infrastructure CORE-11B est déployée, mais RELEASE-01A n'est pas `DONE` tant que le parcours MVP complet du runbook n'a pas été exécuté et signé PASS.
