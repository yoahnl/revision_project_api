# CORE-11A — Session draft resume evidence pack

## Objectif

Regrouper les preuves non sensibles du lot CORE-11A.

## API — preuves de build/test

Commandes vertes :

- `npx prisma validate`
- `npx prisma generate`
- `npm run build`
- `npm run lint:check`
- `npm test -- revision-sessions --runInBand`
- `npm test -- courses --runInBand`
- `npm test -- activities --runInBand`
- `npm test -- question-bank --runInBand`
- `npm test -- --runInBand`
- `npm run test:e2e -- --runInBand`

Résultats clés :

- full Jest : 99 suites passées, 1 suite skipped, 851 tests passés, 1 test skipped ;
- e2e : 2 suites passées, 34 tests passés.

## API — migration

Migration créée :

```text
prisma/migrations/20260623010000_core_11a_session_drafts/migration.sql
```

`npx prisma migrate dev --name core_11a_session_drafts` échoue localement car PostgreSQL n'est pas joignable sur `localhost:5432`. `nc -zv localhost 5432` retourne `Connection refused` et `npx prisma migrate status` retourne `P1001`.

## App — preuves de test

Commandes vertes :

- `dart analyze lib test`
- `flutter test test/features/revision_sessions --reporter compact`
- `flutter test test/features/courses/course_detail_page_test.dart --reporter compact`
- `flutter test test/features/courses/http_courses_repository_test.dart --reporter compact`
- `flutter test --reporter compact`

Résultats clés :

- full Flutter : 488 tests passés.

## Dokploy

Dokploy MCP disponible.

Consulté :

- projet `revision app` ;
- application `backEnd` ;
- dernier déploiement lu : commit `aae5dff81dc659d1c625e3f2d6792d1675254bd4`.

CORE-11A n'est pas déployé dans Dokploy pendant ce lot.

## Marionette

Marionette MCP disponible.

Runtime complet non exécuté pour CORE-11A car le backend CORE-11A n'est ni déployé ni migré localement faute de PostgreSQL accessible.

## Scope

Non réalisés volontairement :

- CORE-11B historique ;
- Deep/Exam ;
- Today adaptatif ;
- refonte UI ;
- modification prompts/providers IA ;
- commit/push.
