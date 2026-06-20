# Roadmap Update Protocol V2 — API

Ce protocole complète celui du repo Flutter. Il doit être appliqué après chaque lot qui touche le backend.

## Checklist API

Après chaque lot backend, Codex doit :

1. Mettre à jour `LOT_TRACKER_V2.md`.
2. Mettre à jour `API_ROADMAP_V2.md` si l'état réel ou les risques changent.
3. Ajouter le lien vers le rapport de lot dans le tracker.
4. Documenter les routes ajoutées/modifiées.
5. Documenter les migrations Prisma, ou confirmer qu'il n'y en a pas.
6. Documenter les tests auth/ownership/404/409/happy path.
7. Documenter les impacts IA, jobs, stockage et données.
8. Ne jamais supprimer les anciens rapports `docs/core/`.
9. Ne jamais marquer un lot backend terminé sans commandes de validation.

## Template

```md
## Update après LOT-XXX

### Résumé du lot

### Statut réel

### Routes ajoutées ou modifiées

### Migrations Prisma

### Services/repositories principaux

### Tests exécutés

### Ce qui est maintenant vrai

### Ce qui reste faux ou partiel

### Risques ajoutés

### Dette créée

### Prochain lot recommandé
```

## Statut partiel

Le tracker ne possède pas de statut `PARTIAL`. Utiliser `IN_PROGRESS`, `BLOCKED` ou `DEFERRED`, puis expliquer précisément la partie livrée et la partie restante.

## Définition de `REPLACED`

`REPLACED` signifie :

- le lot ne sera pas exécuté sous sa forme initiale ;
- il est remplacé par un ou plusieurs lots identifiés ;
- l'entrée historique reste dans le tracker ;
- les IDs remplaçants sont indiqués ;
- le motif du remplacement est documenté ;
- aucun travail réellement livré n'est effacé.

Un macro-lot qui reçoit des enfants exécutables ne devient pas automatiquement `REPLACED`. Il reste un parent stratégique.

## Agrégation des macro-lots

- `TODO` : aucun lot enfant commencé.
- `IN_PROGRESS` : au moins un enfant commencé et au moins un enfant requis non terminé.
- `DONE` : tous les enfants requis sont `DONE`.
- `BLOCKED` : l'ensemble du macro-lot est bloqué par une dépendance externe.
- `DEFERRED` : le macro-lot est volontairement repoussé.
- `REPLACED` : réservé aux lots abandonnés au profit d'une autre structure.

## Synchronisation App/API

- La source canonique produit vit dans `revision_project_app/docs/roadmap/v2/`.
- Le journal de décisions canonique vit dans `revision_project_app/docs/roadmap/v2/DECISIONS_V2.md`.
- Les deux repos doivent conserver les mêmes IDs et statuts pour les lots communs.
- Un lot app-only peut être référencé avec `Impact API : Aucun`.
- Ne pas créer de rapport backend artificiel quand aucun fichier API n'est modifié.
- Après chaque lot backend, mettre à jour `EXECUTION_LOT_TRACKER_V2.md` en plus du tracker macro si le statut agrégé change.
