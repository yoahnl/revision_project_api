# Roadmap execution plan V1 — API

Ce fichier existe côté API pour les lots backend V1 dont le prompt interdit toute modification de `revision_app/`.

| Lot | Intitulé | Statut | Rapport |
| --- | --- | --- | --- |
| V1-012C | Backend diagnostics génération rich closed | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_012C_BACKEND_RICH_CLOSED_GENERATION_DIAGNOSTICS.md |
| V1-012D | Dokploy runtime fix génération rich closed | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_012D_DOKPLOY_RICH_CLOSED_RUNTIME_FIX.md |
| V1-013 | Today integration V1 | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_013_TODAY_INTEGRATION_V1.md |
| V1-014 | Revision session integration V1 | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_014_REVISION_SESSION_INTEGRATION_V1.md |
| V1-015 | Rich demo fixtures V1 | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_015_016_RICH_DEMO_SEED_AND_SMOKE.md |
| V1-016 | E2E/smoke rich questions V1 | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_015_016_RICH_DEMO_SEED_AND_SMOKE.md |

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
