# Parent Lot Tracker V3.1

Statuts autorises : `TODO`, `IN_PROGRESS`, `BLOCKED`, `READY_FOR_REVIEW`, `DONE`, `POSTPONED`.

| Parent | Nom | Horizon | Repo(s) | Statut | Depend de | Lots executables | Objectif produit | Definition of done | Rapports |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RESET | Product modes reset | H0 | API + App | DONE | Aucun | RESET-01 | Clarifier les modes et l'ordre de reprise. | Docs V3.1 crees dans les deux repos, prochain lot recommande clair. | `ROADMAP_V3_1_CREATION_REPORT.md` |
| QB | Question bank budget | H1 | API + App | DONE | RESET | QB-01 | Arreter la sur-generation et rendre la readiness honnete. | 35/65 corriges, jobs limites au deficit reel, tests verts. | `QB_01_QUESTION_BANK_BUDGET_REPORT.md` |
| MODE | Canonical revision modes | H1 | App + API si necessaire | DONE | QB | MODE-01 | Afficher des cartes de cours coherentes et honnetes. | Quick, QCM complet, deep, exam QCM nommes clairement. | `MODE_01_CANONICAL_REVISION_MODES_REPORT.md` |
| RICH | Course-level QCM complet | H1 | API + App | TODO | MODE | RICH-01 | Rendre les questions riches accessibles depuis le cours. | Page/entry course-level, presets, result et history branches. | `RICH_01_COURSE_LEVEL_QCM_COMPLET_REPORT.md` |
| DEEP | Revision approfondie | H2 | API + App | TODO | MODE | DEEP-01A, DEEP-01B | Transformer la question ouverte en mode course-level complet. | Start, correction, result, history et reopen result disponibles. | `DEEP_01A...`, `DEEP_01B...` |
| EXAM | Preparation examen mixte | H3 | API + App | TODO | RICH, DEEP | EXAM-02A, EXAM-02B, EXAM-02C | Passer de exam QCM-only a un entrainement mixte. | Blueprint, orchestrateur API, flow App et resultat agrege. | `EXAM_02A...`, `EXAM_02B...`, `EXAM_02C...` |
| QUALITY | Pool quality and flags | H4 | API + App | TODO | QB, RICH | QUALITY-01A, QUALITY-01B | Ameliorer qualite, doublons et remplacement. | Dedup/adaptativite puis lifecycle flag livres et testes. | `QUALITY_01A...`, `QUALITY_01B...` |
| POLISH | Unified UX cleanup | H5 | App + API si necessaire | TODO | MODE, RICH, DEEP | POLISH-01 | Rendre l'experience lisible et coherente. | Historique unifie, wording, loaders, empty states, erreurs. | `POLISH_01_UNIFIED_HISTORY_UX_REPORT.md` |
| IDENTITY | Rena mascot | H6 | App | TODO | POLISH | IDENTITY-01 | Ajouter l'identite vivante apres stabilisation. | Mascotte et animations integrees sans masquer les modes. | `IDENTITY_01_RENA_INTEGRATION_REPORT.md` |
