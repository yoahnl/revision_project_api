# STAB-00B — Roadmap V2 Hardening Report API

## 1. Résumé

Le repo API est aligné avec le durcissement STAB-00B de la Roadmap V2. Il dispose maintenant d'un plan d'exécution backend, d'un tracker exécutable synchronisé avec le repo app, de `QUALITY-00`, des horizons et des règles de mise à jour compatibles avec le journal de décisions canonique côté app.

## 2. Audit initial

Fichiers relus côté API :

- `docs/roadmap/v2/README.md`
- `docs/roadmap/v2/API_ROADMAP_V2.md`
- `docs/roadmap/v2/LOT_TRACKER_V2.md`
- `docs/roadmap/v2/ROADMAP_UPDATE_PROTOCOL.md`
- `docs/core/CORE_06_REAL_PROGRESS_REPORT.md`
- `docs/core/CORE_07_QUICK_REVISION_LIFECYCLE_RESULT_REPORT.md`
- `docs/core/CORE_07B_QUICK_REVISION_HARDENING_REPORT.md`

Fichiers de roadmap app pris en compte :

- `docs/roadmap/v2/REVISION_PROJECT_ROADMAP_V2.md`
- `docs/roadmap/v2/EXECUTION_PLAN_V2.md`
- `docs/roadmap/v2/DECISIONS_V2.md`

## 3. Passes/sub-agents utilisées

- Roadmap Audit Agent : cohérence API/app et risques backend.
- Execution Planning Agent : plan API aligné avec les mêmes IDs.
- UX Governance Agent : confirmation que l'API ne duplique pas la cible UX.
- Quality Governance Agent : introduction de `QUALITY-00` côté API.
- Reviewer Agent : vérification documentaire et absence de modification runtime.

## 4. Problèmes corrigés

- Le tracker API utilise maintenant les mêmes IDs exécutables que le repo app.
- `QUALITY-00` apparaît avant `RELEASE-01`.
- Les horizons sont présents côté API.
- `PLUS-01A` ne dépend plus de tout `CORE-11`.
- `REPLACED` et les règles d'agrégation sont définis côté API.
- Le README API pointe vers le journal de décisions canonique côté app.

## 5. Macro-lots conservés

- `STAB-00`
- `STAB-01`
- `STAB-02`
- `CORE-09`
- `CORE-10`
- `CORE-11`
- `PLUS-01`
- `PLUS-02`
- `PLUS-03`
- `ADAPT-01`
- `GENUI-01`
- `RELEASE-01`

Ajouts :

- `STAB-00B`
- `QUALITY-00`

## 6. Lots exécutables créés

Le tracker API référence les mêmes lots exécutables que le repo app, avec une colonne `Impact API`.

## 7. Nouveau graphe de dépendances

Le graphe API aligné est documenté dans `API_EXECUTION_PLAN_V2.md` et `API_ROADMAP_V2.md`.

## 8. Horizons

Horizons ajoutés :

- `FOUNDATION`
- `MVP_STABLE`
- `MVP_PLUS`
- `POST_MVP`
- `RELEASE`

## 9. QUALITY-00

`QUALITY-00` est ajouté comme baseline CI API : Prisma validate, build, lint, tests Jest et e2e critiques.

## 10. Journal de décisions

Le repo API ne duplique pas `DECISIONS_V2.md`. Il pointe vers :

```text
revision_project_app/docs/roadmap/v2/DECISIONS_V2.md
```

## 11. Matrice de capacités UX

La matrice canonique vit côté app dans `UX_UI_TARGET_V2.md`. Côté API, les capacités `NEEDS_API` doivent être transformées en lots backend explicites, notamment `CORE-09C`.

## 12. Gestion de la référence UI

La référence UI V2 est documentée côté app. Le repo API ne stocke pas de copie de l'asset.

## 13. Synchronisation App/API

- Même IDs pour les lots communs.
- Même statut pour les lots communs.
- Les lots app-only sont présents côté API avec `Impact API : Aucun`.
- Aucun rapport backend artificiel ne doit être créé pour un lot app-only.

## 14. Fichiers créés

- `docs/roadmap/v2/API_EXECUTION_PLAN_V2.md`
- `docs/roadmap/v2/EXECUTION_LOT_TRACKER_V2.md`
- `docs/roadmap/v2/STAB_00B_ROADMAP_V2_HARDENING_REPORT.md`

## 15. Fichiers modifiés

- `docs/roadmap/v2/README.md`
- `docs/roadmap/v2/API_ROADMAP_V2.md`
- `docs/roadmap/v2/LOT_TRACKER_V2.md`
- `docs/roadmap/v2/ROADMAP_UPDATE_PROTOCOL.md`

## 16. Commandes exécutées

Commandes exécutées dans `/Users/karim/Project/app-révision/api` :

```bash
git diff --check
git status --short --untracked-files=all
test -f docs/roadmap/v2/API_ROADMAP_V2.md
test -f docs/roadmap/v2/LOT_TRACKER_V2.md
test -f docs/roadmap/v2/API_EXECUTION_PLAN_V2.md
test -f docs/roadmap/v2/EXECUTION_LOT_TRACKER_V2.md
test -f docs/roadmap/v2/ROADMAP_UPDATE_PROTOCOL.md
rg -n "STAB-00B|QUALITY-00|STAB-01A|STAB-01B|STAB-01C|STAB-02A|STAB-02B|CORE-09A|CORE-10A|CORE-11A|PLUS-01A" docs/roadmap/v2
rg -n "FOUNDATION|MVP_STABLE|MVP_PLUS|POST_MVP|RELEASE" docs/roadmap/v2
rg -n "PROPOSED|ACCEPTED|REJECTED|SUPERSEDED" docs/roadmap/v2
```

Première exécution :

- `git diff --check` : succès, aucune sortie.
- `git status --short --untracked-files=all` :

```text
 M docs/roadmap/v2/API_ROADMAP_V2.md
 M docs/roadmap/v2/LOT_TRACKER_V2.md
 M docs/roadmap/v2/README.md
 M docs/roadmap/v2/ROADMAP_UPDATE_PROTOCOL.md
?? docs/roadmap/v2/API_EXECUTION_PLAN_V2.md
?? docs/roadmap/v2/EXECUTION_LOT_TRACKER_V2.md
?? docs/roadmap/v2/STAB_00B_ROADMAP_V2_HARDENING_REPORT.md
```

- Tous les `test -f` : succès, aucune sortie.
- `rg` IDs : succès.
- `rg` horizons : succès.
- `rg` statuts de décisions : échec initial, car le journal de décisions n'est volontairement pas dupliqué côté API.

Correction appliquée :

- ajout dans le README API d'une note pointant vers le journal canonique app et listant les statuts `PROPOSED`, `ACCEPTED`, `REJECTED`, `SUPERSEDED`.

Deuxième exécution :

- commande complète relancée ;
- résultat : succès, code 0 ;
- `rg` statuts de décisions trouve la note du README API.

Suites applicatives non lancées conformément au périmètre documentaire.

## 17. Limites

- La roadmap API reste volontairement moins produit que la roadmap app.
- Les décisions produit ne sont pas dupliquées côté API.
- La CI n'est pas créée dans ce lot, seulement planifiée.

## 18. Points restant à valider par Yoahn

- Politique finale archive/delete.
- Niveau exact de CI baseline.
- Besoin de routes lifecycle sujet/cours dans `CORE-09C`.
- Timing de Deep par rapport à session resume.

## 19. Auto-review

- STAB-00 reste `DONE`.
- STAB-00B est ajouté.
- QUALITY-00 existe.
- Les macro-lots sont conservés.
- Les lots exécutables sont séparés.
- Les horizons sont présents.
- `REPLACED` et l'agrégation macro sont définis.
- Aucun runtime n'a été modifié.

## 20. Confirmation runtime

Aucun code runtime n'a été modifié.

## 21. Confirmation Git

Aucun commit n'a été effectué.
