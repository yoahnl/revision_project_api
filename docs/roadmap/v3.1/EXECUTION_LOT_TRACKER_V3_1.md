# Execution Lot Tracker V3.1

Statuts autorises : `TODO`, `IN_PROGRESS`, `BLOCKED`, `READY_FOR_REVIEW`, `DONE`, `POSTPONED`.

| Lot | Parent | Horizon | Repo(s) | Statut | Depend de | Objectif | Validation attendue | Rapport attendu | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RESET-01 | RESET | H0 | API + App | DONE | Aucun | Creer la taxonomie produit, le mapping technique, les trackers et le handoff V3.1. | `git diff --check` dans les deux repos. | `ROADMAP_V3_1_CREATION_REPORT.md` | Lot documentaire uniquement. |
| QB-01 | QB | H1 | API + App | TODO | RESET-01 | Corriger la sur-generation question bank et separer session count / pool target / per-KU target. | Tests API question bank/readiness + tests App readiness si wording change. | `QB_01_QUESTION_BANK_BUDGET_REPORT.md` | Prochain lot recommande. |
| MODE-01 | MODE | H1 | App + API si necessaire | TODO | QB-01 | Stabiliser les cartes course-level et le wording des modes. | Tests widget course detail + tests repository si contrat change. | `MODE_01_CANONICAL_REVISION_MODES_REPORT.md` | Renommer exam actuel en `Preparation examen - QCM`. |
| RICH-01 | RICH | H1 | API + App | TODO | MODE-01 | Reexposer QCM complet depuis le cours. | Tests API rich history/start + tests App route/page/course detail. | `RICH_01_COURSE_LEVEL_QCM_COMPLET_REPORT.md` | Presets 6/10/13. |
| DEEP-01A | DEEP | H2 | API + App | TODO | MODE-01 | Activer question ouverte depuis le cours. | Tests API open question ownership + tests App page/flow. | `DEEP_01A_COURSE_LEVEL_DEEP_START_REPORT.md` | Pas encore result/history deep complet. |
| DEEP-01B | DEEP | H2 | API + App | TODO | DEEP-01A | Ajouter lifecycle, completion, result, history et reopen result deep. | Tests API session DEEP + tests App result/history. | `DEEP_01B_DEEP_RESULT_HISTORY_REPORT.md` | Necessaire avant examen mixte. |
| EXAM-02A | EXAM | H3 | API + App | TODO | RICH-01, DEEP-01B | Concevoir le blueprint examen mixte versionne. | Doc review + contract tests si types ajoutes. | `EXAM_02A_MIXED_EXAM_BLUEPRINT_REPORT.md` | Pas d'orchestrateur complet. |
| EXAM-02B | EXAM | H3 | API | TODO | EXAM-02A | Creer l'orchestrateur API examen mixte et le resultat agrege. | Tests API sections/scoring/history. | `EXAM_02B_MIXED_EXAM_ORCHESTRATOR_REPORT.md` | Score final serveur. |
| EXAM-02C | EXAM | H3 | App | TODO | EXAM-02B | Creer le flow App examen mixte. | Tests App flow sections/result. | `EXAM_02C_MIXED_EXAM_APP_FLOW_REPORT.md` | Remplace progressivement exam QCM-only. |
| QUALITY-01A | QUALITY | H4 | API | TODO | RICH-01, QB-01 | Adapter le pool et reduire les doublons semantiques. | Tests duplicate/audit/pool quality. | `QUALITY_01A_ADAPTIVE_POOL_DEDUP_REPORT.md` | Apres stabilisation des modes. |
| QUALITY-01B | QUALITY | H4 | API + App | TODO | QUALITY-01A | Transformer les flags en cycle de remplacement. | Tests flags + tests App signalement. | `QUALITY_01B_FLAG_REPLACEMENT_REPORT.md` | Ne pas faire avant dedup. |
| POLISH-01 | POLISH | H5 | App + API si necessaire | TODO | MODE-01, RICH-01, DEEP-01B | Unifier historique, wording, empty states, loaders et erreurs. | Tests widget history/errors + smoke manuel. | `POLISH_01_UNIFIED_HISTORY_UX_REPORT.md` | Avant mascotte. |
| IDENTITY-01 | IDENTITY | H6 | App | TODO | POLISH-01 | Integrer Rena et les micro-interactions. | Tests widget/animation + smoke visuel. | `IDENTITY_01_RENA_INTEGRATION_REPORT.md` | Reporte apres polish UX. |
