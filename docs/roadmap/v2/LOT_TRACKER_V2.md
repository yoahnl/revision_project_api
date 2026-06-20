# Lot Tracker V2 — API

Ce tracker suit les macro-lots stratégiques et leur impact API. Le détail exécutable vit dans `EXECUTION_LOT_TRACKER_V2.md`.

Statuts autorisés : `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`, `DEFERRED`, `REPLACED`.

Horizons autorisés : `FOUNDATION`, `MVP_STABLE`, `MVP_PLUS`, `POST_MVP`, `RELEASE`.

| Lot | Titre | Horizon | Impact API | Statut | Dépend de | Lots exécutables | Objectif API | Validation | Rapport |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| STAB-00 | Roadmap V2 canonicalisation | FOUNDATION | Documentation | DONE | Aucun | STAB-00B | Créer l'alignement API V2. | Documents V2 créés. | `docs/roadmap/v2/` |
| STAB-00B | Roadmap V2 hardening, execution slicing & governance | FOUNDATION | Documentation | DONE | STAB-00 | STAB-00B | Durcir la roadmap API et synchroniser les lots exécutables. | Plans et trackers API alignés. | `docs/roadmap/v2/STAB_00B_ROADMAP_V2_HARDENING_REPORT.md` |
| QUALITY-00 | CI baseline | FOUNDATION | Oui | DONE | STAB-00B | QUALITY-00 | Baseline CI API : Prisma, build, lint, tests et e2e critiques. | Pipeline GitHub Actions reproductible sans secrets réels. | `docs/roadmap/v2/QUALITY_00_CI_BASELINE_REPORT.md` |
| STAB-01 | Product navigation & UX coherence | MVP_STABLE | Aucun ou ponctuel | TODO | STAB-00B | STAB-01A, STAB-01B, STAB-01C | Confirmer les besoins API des corrections UX. | API inchangée ou besoin documenté. | Repo app ou rapport API si touché |
| STAB-02 | Frontend design system unification | MVP_STABLE | Aucun | TODO | STAB-01C | STAB-02A, STAB-02B | Aucun changement backend attendu. | API inchangée. | Repo app |
| CORE-09 | Source lifecycle & storage policy | MVP_STABLE | Oui | TODO | STAB-01A | CORE-09A, CORE-09B, CORE-09C | Sécuriser archive/suppression, stockage et lifecycle sujet/cours. | Tests Prisma/API. | À créer |
| CORE-10 | Question bank production hardening | MVP_STABLE | Oui | TODO | CORE-09A | CORE-10A, CORE-10B, CORE-10C | Durcir génération, sélection et disponibilité de la banque. | Tests service/repository/e2e. | À créer |
| CORE-11 | Session resume & history | MVP_STABLE | Oui | TODO | CORE-10A | CORE-11A, CORE-11B | Reprise et historique de sessions. | Tests lifecycle. | À créer |
| PLUS-01 | Deep Revision course-level | MVP_PLUS | Oui | TODO | STAB-02A, CORE-10A | PLUS-01A, PLUS-01B | Route deep + correction ouverte course-level. | Tests IA/correction/mastery. | À créer |
| PLUS-02 | Revision sheet complete / exam modes | MVP_PLUS | Oui | TODO | STAB-02B, CORE-09A | PLUS-02 | Contrats de fiche complète/examen. | Tests study artifacts. | À créer |
| ADAPT-01 | Today / adaptive coach | MVP_PLUS | Oui | TODO | CORE-10B | ADAPT-01 | Recommandation quotidienne. | Tests recommandation. | À créer |
| PLUS-03 | Exam preparation V1 | POST_MVP | Oui | TODO | PLUS-01B, PLUS-02, CORE-11B | PLUS-03 | Mode examen réel. | Tests session exam. | À créer |
| GENUI-01 | Controlled GenUI surface | POST_MVP | Oui | TODO | STAB-02B, ADAPT-01, PLUS-01A | GENUI-01 | Payloads GenUI strictement contrôlés. | Tests schema/fallback. | À créer |
| RELEASE-01 | Production readiness | RELEASE | Oui | TODO | QUALITY-00, lots MVP_STABLE requis | RELEASE-01 | CI complète, stockage, monitoring, quotas, secrets. | Checklist release. | À créer |
