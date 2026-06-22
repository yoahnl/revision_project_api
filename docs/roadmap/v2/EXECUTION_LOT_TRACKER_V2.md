# Execution Lot Tracker V2 — API

Ce tracker reprend les mêmes IDs que le tracker exécutable côté app. Les lots app-only sont conservés pour synchronisation avec `Impact API : Aucun`.

Statuts autorisés : `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`, `DEFERRED`, `REPLACED`.

Horizons autorisés : `FOUNDATION`, `MVP_STABLE`, `MVP_PLUS`, `POST_MVP`, `RELEASE`.

| Lot | Parent macro-lot | Horizon | Impact API | Statut | Dépend de | Objectif API | Validation API | Rapport |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| STAB-00B | STAB-00 | FOUNDATION | Documentation | DONE | STAB-00 | Synchroniser la roadmap API avec la couche exécutable. | Docs et trackers API alignés. | `docs/roadmap/v2/STAB_00B_ROADMAP_V2_HARDENING_REPORT.md` |
| QUALITY-00 | QUALITY-00 | FOUNDATION | Oui | DONE | STAB-00B | Baseline CI API : Prisma, build, lint, tests et e2e critiques. | Pipeline GitHub Actions reproductible sans secrets réels. | `docs/roadmap/v2/QUALITY_00_CI_BASELINE_REPORT.md` |
| STAB-01A | STAB-01 | MVP_STABLE | Aucun attendu | TODO | STAB-00B | Confirmer que le shell n'a pas besoin de nouvelle route. | API inchangée ou besoin documenté. | Repo app |
| STAB-01B | STAB-01 | MVP_STABLE | Aucun attendu | TODO | STAB-01A | Confirmer que Home/Hub/Course utilisent les contrats existants. | API inchangée ou besoin documenté. | Repo app |
| STAB-01C | STAB-01 | MVP_STABLE | Possible | TODO | STAB-01B | Identifier les actions UX qui nécessitent une API. | Aucun bouton `NEEDS_API` sans lot backend. | À créer si API touchée |
| STAB-02A | STAB-02 | MVP_STABLE | Aucun | TODO | STAB-01C | Aucun changement backend. | API inchangée. | Repo app |
| STAB-02B | STAB-02 | MVP_STABLE | Aucun | TODO | STAB-02A | Aucun changement backend. | API inchangée. | Repo app |
| CORE-09A | CORE-09 | MVP_STABLE | Oui | DONE | STAB-01A | Archive/delete semantics des sources. | Tests ownership, usage historique, 409/archive. | `docs/core/CORE_09A_SOURCE_LIFECYCLE_API_REPORT.md` |
| CORE-09B | CORE-09 | MVP_STABLE | Oui | DONE | CORE-09A | Cleanup blob et abstraction storage. | Tests storage, cleanup, repository, jobs, e2e et full Jest. | `docs/core/CORE_09B_STORAGE_CLEANUP_API_REPORT.md` |
| CORE-09C | CORE-09 | MVP_STABLE | Oui | DONE | CORE-09A | Lifecycle subject/course : rename/edit/archive si validé. | Routes lifecycle/PATCH/archive/delete, tests ciblés, e2e, intégration app et hardening CORE-09C-bis. | `docs/core/CORE_09C_SUBJECT_COURSE_LIFECYCLE_API_REPORT.md` |
| CORE-10A | CORE-10 | MVP_STABLE | Oui | DONE | CORE-09A | Async question bank readiness. | Readiness course-level, job de preparation, quick start non bloquant, e2e et full Jest verts. | `docs/core/CORE_10A_ASYNC_QUESTION_BANK_READINESS_API_REPORT.md` |
| CORE-10B | CORE-10 | MVP_STABLE | Oui | DONE | CORE-10A | Multi-KU selection et concurrence. | Fix-2 validé localement et en runtime : readiness stale, logs worker/runtime, métriques IA, Dokploy PREPARING -> READY et session Marionette 20 questions. | `docs/core/CORE_10B_MULTI_KU_SELECTION_CONCURRENCY_API_REPORT.md`, `docs/core/CORE_10B_FIX_PREPARATION_COMPLETION_API_REPORT.md`, `docs/core/CORE_10B_FIX_2_WORKER_PARTIAL_READINESS_API_REPORT.md` |
| CORE-10C | CORE-10 | MVP_STABLE | Oui | DONE | CORE-10B | Découplage QuestionBankService et métriques. | QuestionBankService découplé de Prisma, fallbackUsed propagé, readiness target-aware, repository Prisma testé, full Jest et e2e verts. | `docs/core/CORE_10C_QUESTION_BANK_DECOUPLING_METRICS_API_REPORT.md` |
| CORE-11A | CORE-11 | MVP_STABLE | Oui | TODO | CORE-10A | Draft persistence et resume. | Tests lifecycle/draft/ownership. | À créer |
| CORE-11B | CORE-11 | MVP_STABLE | Oui | TODO | CORE-11A | Historique et détails de sessions terminées. | Tests list/detail/completed. | À créer |
| PLUS-01A | PLUS-01 | MVP_PLUS | Oui | TODO | STAB-02A, CORE-10A, quick lifecycle stable | Route deep course-level open-question V1. | Tests correction/mastery. | À créer |
| PLUS-01B | PLUS-01 | MVP_PLUS | Oui | TODO | PLUS-01A, CORE-11A | Lifecycle/result Deep. | Tests completion/result deep. | À créer |
| PLUS-02 | PLUS-02 | MVP_PLUS | Oui | TODO | STAB-02B, CORE-09A | Fiches complète et pré-examen. | Tests study artifacts. | À créer |
| ADAPT-01 | ADAPT-01 | MVP_PLUS | Oui | TODO | CORE-10B | Recommandation Today. | Tests no data/practiced/stale mastery. | À créer |
| PLUS-03 | PLUS-03 | POST_MVP | Oui | TODO | PLUS-01B, PLUS-02, CORE-11B | Mode examen V1. | Tests lifecycle exam. | À créer |
| GENUI-01 | GENUI-01 | POST_MVP | Oui | TODO | STAB-02B, ADAPT-01, PLUS-01A | Payloads GenUI contrôlés. | Tests schema/fallback. | À créer |
| RELEASE-01 | RELEASE-01 | RELEASE | Oui | TODO | QUALITY-00, lots MVP_STABLE requis | Production readiness API. | Checklist release backend. | À créer |
