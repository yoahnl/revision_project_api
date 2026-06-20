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
