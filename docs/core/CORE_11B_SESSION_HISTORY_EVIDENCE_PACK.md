# CORE-11B — Session history evidence pack API

## Objectif

Regrouper les preuves non sensibles du lot CORE-11B côté API.

## Baseline

```text
API baseline : d75b0a3b9b6cf5a1076c86ea3751c06cafb4a9d0
```

## Preuves de build/test

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

- `revision-sessions` : 10 suites, 86 tests passés ;
- `courses` : 14 suites, 122 tests passés ;
- `activities` : 21 suites passées, 1 suite skipped existante, 365 tests passés ;
- `question-bank` : 7 suites, 38 tests passés ;
- full Jest : 100 suites passées, 1 suite skipped existante, 861 tests passés ;
- e2e : 2 suites passées, 34 tests passés.

## Preuves fonctionnelles

- `GET /courses/:courseId/revision-sessions/history` filtre par étudiant, cours, `COMPLETED` et `completedAt`.
- `GET /revision-sessions/history` liste globalement les sessions terminées de l'étudiant.
- Les sessions `STARTED`, `ABANDONED` et `COMPLETED` sans `completedAt` sont exclues.
- La liste d'historique ne charge pas les réponses/corrections complètes.
- `GET /revision-sessions/:sessionId/result` reste le point d'entrée pour les corrections détaillées.

## Dokploy

Dokploy MCP consulté :

- projet : `revision app` ;
- application backend : `backEnd` ;
- Redis présent dans l'environnement production ;
- dernier déploiement backend lu : `CORE-11A session draft resume API`, commit `d75b0a3b9b6cf5a1076c86ea3751c06cafb4a9d0`, statut `done`.

CORE-11B n'a pas été déployé pendant ce lot. Runtime post-déploiement requis après commit/push humain.

## Marionette

Marionette est disponible côté environnement Codex/App. La validation CORE-11B complète n'a pas été exécutée contre production car le backend déployé est CORE-11A. Ne pas considérer ce lot comme validé runtime avant déploiement humain.

## Scope

Non réalisés volontairement :

- migration Prisma ;
- historique analytique avancé ;
- dashboard global ;
- refonte UI ;
- modification prompts/providers IA ;
- commit/push.

## Fichiers concernés

Voir `CORE_11B_SESSION_HISTORY_API_REPORT.md` pour la liste complète des fichiers créés/modifiés.
