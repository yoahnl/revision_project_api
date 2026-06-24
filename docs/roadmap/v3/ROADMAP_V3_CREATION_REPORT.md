Audit initial de l’état post-MVP
=================================

## Audit initial

Baselines vérifiées :

| Repo | Baseline attendue | Baseline observée |
| --- | --- | --- |
| API | `4e0f0c398b6faddd11465362a3720246c9c79a72` | `4e0f0c398b6faddd11465362a3720246c9c79a72` |
| App | `467b6c18ed66b71a614bca35be11fa4079cebf22` | `467b6c18ed66b71a614bca35be11fa4079cebf22` |

Documents audités :

- API : `docs/roadmap/v2/`, `docs/core/`, `docs/release/`, `docs/ui/`, `README.md` si présent.
- App : `docs/roadmap/v2/`, `docs/core/`, `docs/release/`, `docs/ui/`, `README.md` si présent.

Zones produit auditées :

- API : `src/modules/activities`, `src/modules/courses`, `src/modules/revision-sessions`, `src/modules/study-artifacts`, `src/modules/documents`, `prisma/schema.prisma`.
- App : `lib/features/activities`, `lib/features/courses`, `lib/features/revision_sessions`, `lib/features/documents`, `lib/presentation/pages`, `lib/presentation/design_system`, `lib/app/router`.

Constats :

- Le MVP core est fermé : `CORE-09`, `CORE-10`, `CORE-11`, `RELEASE-01A` et `RELEASE-01` sont documentés comme `DONE`.
- Le smoke MVP complet a été confirmé manuellement par l'opérateur humain dans les rapports release.
- Les surfaces quick revision, readiness question bank, session draft/resume, result et history existent et doivent rester protégées.
- L'API contient déjà des briques rich closed, sources, visuels, scoring, résultats, flags de questions de session et modes `QUICK`, `DEEP`, `EXAM`.
- L'App contient déjà des widgets rich closed, routes revision session/result, page Today, design system et écrans course/sheet/progress.
- Les fiches complètes, l'examen complet, la deep revision complète, la qualité du pool, Rena, Today adaptatif final et TestFlight/App Store ne sont pas considérés livrés par le MVP.
- L'API avait des changements non commités préexistants dans des fichiers IA/génération et un rapport core. Ils n'ont pas été modifiés par ce lot.

## Décisions prises

- La V3 devient la source de reprise post-MVP, sans supprimer V2.
- Les documents V3 sont créés dans les deux repos comme miroirs synchronisés.
- Le prochain lot recommandé est `PLUS-02A - QCM complet / rich questions recovery`.
- QCM complet et préparation examen sont séparés.
- La qualité du question pool attend la stabilisation QCM/examen.
- Rena est séparée des lots fonctionnels critiques.
- Today/coach adaptatif est placé après les fondations pédagogiques et qualité.
- La release publique devient `RELEASE-02A`, distincte du smoke runtime `RELEASE-01A`.

## Documents créés

- `docs/roadmap/v3/ROADMAP_V3_POST_MVP_PLAN.md`
- `docs/roadmap/v3/EXECUTION_LOT_TRACKER_V3.md`
- `docs/roadmap/v3/LOT_TRACKER_V3.md`
- `docs/roadmap/v3/ROADMAP_V3_DECISIONS.md`
- `docs/roadmap/v3/ROADMAP_V3_HANDOFF_TO_CODEX.md`
- `docs/roadmap/v3/ROADMAP_V3_CREATION_REPORT.md`

## Ordre recommandé

1. `PLUS-02A`
2. `PLUS-02B`
3. `PLUS-03A`
4. `PLUS-03B`
5. `PLUS-01A`
6. `PLUS-01B`
7. `PLUS-04A`
8. `PLUS-04B`
9. `QUALITY-01A`
10. `QUALITY-01B`
11. `POLISH-01A`
12. `POLISH-01B`
13. `IDENTITY-01A`
14. `IDENTITY-01B`
15. `ADAPT-01A`
16. `ADAPT-01B`
17. `RELEASE-02A`

## Lots créés

- `PLUS-02A` - QCM complet / rich questions recovery.
- `PLUS-02B` - QCM result/correction/history integration.
- `PLUS-03A` - Exam preparation V1 foundations.
- `PLUS-03B` - Exam preparation session/result/history.
- `PLUS-01A` - Deep revision course-level open question.
- `PLUS-01B` - Deep revision lifecycle/result.
- `PLUS-04A` - Fiches complètes course-level V1.
- `PLUS-04B` - Fiches complètes sources, navigation et état vide.
- `QUALITY-01A` - Question pool audit & duplicate detection design.
- `QUALITY-01B` - Flag system redesign.
- `POLISH-01A` - MVP UX cleanup.
- `POLISH-01B` - Empty states, errors, loaders, wording.
- `IDENTITY-01A` - Rena mascot integration design.
- `IDENTITY-01B` - Rena animation implementation.
- `ADAPT-01A` - Today recommendation foundations.
- `ADAPT-01B` - Today UI and coach.
- `RELEASE-02A` - TestFlight/App Store preparation.

## Risques

- Lancer l'examen avant QCM riche stabilisé.
- Optimiser la qualité du pool avant d'avoir stabilisé les modes qui l'utilisent.
- Mélanger Rena avec des corrections UX ou loaders non terminés.
- Confondre smoke runtime MVP et distribution publique.
- Toucher aux changements non commités existants de l'API.

## Prochain lot recommandé

`PLUS-02A - QCM complet / rich questions recovery`.

Ce lot doit restaurer ou reconstruire proprement les questions riches, QCM single/multiple, explications, sources, visuels, correction claire et compatibilité avec les sessions.

## Fichiers modifiés

API :

- `docs/roadmap/v3/ROADMAP_V3_POST_MVP_PLAN.md`
- `docs/roadmap/v3/EXECUTION_LOT_TRACKER_V3.md`
- `docs/roadmap/v3/LOT_TRACKER_V3.md`
- `docs/roadmap/v3/ROADMAP_V3_DECISIONS.md`
- `docs/roadmap/v3/ROADMAP_V3_HANDOFF_TO_CODEX.md`
- `docs/roadmap/v3/ROADMAP_V3_CREATION_REPORT.md`

App :

- `docs/roadmap/v3/ROADMAP_V3_POST_MVP_PLAN.md`
- `docs/roadmap/v3/EXECUTION_LOT_TRACKER_V3.md`
- `docs/roadmap/v3/LOT_TRACKER_V3.md`
- `docs/roadmap/v3/ROADMAP_V3_DECISIONS.md`
- `docs/roadmap/v3/ROADMAP_V3_HANDOFF_TO_CODEX.md`
- `docs/roadmap/v3/ROADMAP_V3_CREATION_REPORT.md`

## Validations exécutées

- API : `git diff --check` exécuté, OK.
- App : `git diff --check` exécuté, OK.
- API : vérification directe des nouveaux Markdown V3 pour espaces finaux et newline final, OK.
- App : vérification directe des nouveaux Markdown V3 pour espaces finaux et newline final, OK.
- Aucun lint documentaire spécifique n'a été identifié pendant l'audit initial.
- Aucun test Dart/Flutter/Jest full n'est requis pour ce lot documentaire.

## Auto-review finale

- La roadmap V3 est créée.
- Les trackers V3 sont créés.
- Le handoff Codex est créé.
- L'ordre post-MVP est clarifié.
- Le prochain lot recommandé est clair.
- Aucun code produit n'est volontairement modifié par ce lot.
- La roadmap V2 est conservée.

## Critique du prompt

Le prompt est précis et protège bien le projet contre un redémarrage chaotique. La seule tension est le renommage de `PLUS-02` : en V2 il couvrait fiche complète/exam modes, alors qu'en V3 il devient QCM complet. La V3 résout cela en créant `PLUS-04` pour les fiches complètes afin de ne pas perdre ce besoin produit.
