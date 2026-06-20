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
