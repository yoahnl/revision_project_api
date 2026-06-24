# Roadmap V3 handoff to Codex - Neralune post-MVP

Version commune API/App. Miroir attendu côté App : `revision_project_app/docs/roadmap/v3/ROADMAP_V3_HANDOFF_TO_CODEX.md`.

## Où en est le projet

Neralune, anciennement Revision Project, sort d'un MVP core fermé. Les baselines de reprise sont :

- API : `4e0f0c398b6faddd11465362a3720246c9c79a72`
- App : `467b6c18ed66b71a614bca35be11fa4079cebf22`

Les lots `CORE-09`, `CORE-10`, `CORE-11`, `RELEASE-01A` et `RELEASE-01` sont considérés `DONE`. Le smoke MVP complet a été confirmé manuellement par l'opérateur humain. La suite doit être calme, lotie et vérifiable.

## Ce qui est stable

- Source/course/subject lifecycle : delete/archive safe.
- Course question bank : readiness, préparation async, sélection multi-KU, concurrence.
- Quick revision : session, draft/resume, complete, result, history.
- App shell : navigation principale, cours, sources, fiche V0, progression, historique, résultat.
- Rich closed building blocks : API et App contiennent déjà des types, widgets et résultats partiels utiles.
- Today/coach : fondations présentes, mais pas encore produit adaptatif final.

## Ce qui ne doit pas être cassé

- Quick revision MVP.
- Session result/history existants.
- Source lifecycle et ownership.
- Readiness question bank course-level.
- Trackers V2 et rapports historiques.
- Prompts IA, providers IA, Prisma et migrations hors lot explicitement prévu.
- Secrets et variables d'environnement réelles.

## Comment lire les trackers V3

1. Lire `ROADMAP_V3_POST_MVP_PLAN.md` pour l'ordre et les dépendances.
2. Lire `LOT_TRACKER_V3.md` pour les parents produit.
3. Lire `EXECUTION_LOT_TRACKER_V3.md` pour les lots exécutables.
4. Lire `ROADMAP_V3_DECISIONS.md` si l'ordre semble surprenant.
5. Pour chaque lot, créer un rapport dédié dans `docs/roadmap/v3/`.

Statuts autorisés : `TODO`, `IN_PROGRESS`, `BLOCKED`, `READY_FOR_REVIEW`, `DONE`, `POSTPONED`.

## Prochain lot recommandé

`PLUS-02B - QCM result/correction/history integration`.

Pourquoi : `PLUS-02A` a récupéré le contrat rich closed, les types supportés, le rendu App et deux gardes de cohérence. Le parent `PLUS-02` reste `IN_PROGRESS` tant que résultat, correction claire, historique et compatibilité session/result/history ne sont pas durcis comme parcours produit complet.

## Validations à exécuter pour le prochain lot

À adapter selon les fichiers touchés, mais au minimum :

- API : tests ciblés rich closed result/correction/history, revision sessions, question bank si touché.
- App : tests ciblés correction/result/history rich closed, revision sessions et navigation depuis les actions existantes.
- Toujours : `git diff --check` dans chaque repo touché.
- Ne pas lancer full Flutter/Jest si aucun code correspondant n'a été modifié.

## Pièges à éviter

- Ne pas rouvrir `PLUS-02A` pour ajouter examen, quality pool ou nouvelles familles non supportées.
- Ne pas fusionner `PLUS-02B` avec `PLUS-03A`.
- Ne pas lancer `QUALITY-01` avant QCM/exam stabilisés.
- Ne pas utiliser Rena pour masquer des loaders ou erreurs non polis.
- Ne pas transformer Today en coach adaptatif tant que les signaux produit sont incomplets.
- Ne pas documenter de secret dans les rapports release.
- Ne pas modifier les changements non commités préexistants dans l'API sauf demande explicite.
- Ne pas supprimer ou réécrire V2.
