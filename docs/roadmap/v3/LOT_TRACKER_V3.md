# Lot Tracker V3 - Neralune post-MVP

Version commune API/App. Miroir attendu côté App : `revision_project_app/docs/roadmap/v3/LOT_TRACKER_V3.md`.

Statuts autorisés : `TODO`, `IN_PROGRESS`, `BLOCKED`, `READY_FOR_REVIEW`, `DONE`, `POSTPONED`.

| Lot | Titre | Horizon | Repo(s) | Statut | Dépend de | Lots exécutables | Objectif | Validation | Rapport |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PLUS-02 | QCM complet / rich questions recovery | H1 | API + App | DONE | MVP core fermé, CORE-10, CORE-11 | PLUS-02A, PLUS-02B | Restaurer un QCM riche, sourcé, corrigé et historisé. | PLUS-02A a récupéré le contrat et le rendu rich closed ; PLUS-02B a intégré result metadata, correction post-submit, historique cours léger et réouverture result sans score client. | `docs/roadmap/v3/PLUS_02A_QCM_RICH_QUESTIONS_RECOVERY_REPORT.md`, `docs/roadmap/v3/PLUS_02B_QCM_RESULT_CORRECTION_HISTORY_REPORT.md` |
| PLUS-03 | Préparation examen V1 | H1 | API + App | IN_PROGRESS | PLUS-02A, PLUS-02B | PLUS-03A, PLUS-03B | Créer un mode préparation examen distinct. | PLUS-03A a livré le contrat options/readiness, les scopes cours/source et la page de configuration honnête ; session exam, résultat exam et historique exam restent à livrer dans PLUS-03B. | Rapports `PLUS_03A`, `PLUS_03B` |
| PLUS-01 | Révision approfondie réelle | H2 | API + App | TODO | CORE-10A, CORE-11A, CORE-11B | PLUS-01A, PLUS-01B | Activer une deep revision course-level avec question ouverte, lifecycle et résultat. | Open question, correction, completion, result et history deep validés. | Rapports `PLUS_01A`, `PLUS_01B` |
| PLUS-04 | Fiches complètes | H2 | API + App | TODO | CORE-09A, study artifacts existants | PLUS-04A, PLUS-04B | Passer de la fiche V0 à des fiches course-level complètes et bien sourcées. | Fiche complète, sources/citations, navigation et états vides validés. | Rapports `PLUS_04A`, `PLUS_04B` |
| QUALITY-01 | Question pool quality / flags / doublons | H3 | API + App | TODO | PLUS-02B, PLUS-03B | QUALITY-01A, QUALITY-01B | Traiter questions trop similaires, quotas rigides, flags et remplacement progressif. | Design qualité puis flags testés sans casser session/result/history. | Rapports `QUALITY_01A`, `QUALITY_01B` |
| POLISH-01 | UX release polish | H3 | App + API si erreurs | TODO | PLUS-02B, PLUS-03B | POLISH-01A, POLISH-01B | Nettoyer l'expérience MVP publiable. | UI ciblée, empty states, erreurs, loaders et wording validés. | Rapports `POLISH_01A`, `POLISH_01B` |
| IDENTITY-01 | Rena mascotte et animations | H4 | App + Design docs | TODO | POLISH-01A | IDENTITY-01A, IDENTITY-01B | Introduire Rena sans mélanger identité et logique critique. | Design validé puis animations testées sur états précis. | Rapports `IDENTITY_01A`, `IDENTITY_01B` |
| ADAPT-01 | Today / coach adaptatif | H4 | API + App | TODO | QUALITY-01A, PLUS-01B | ADAPT-01A, ADAPT-01B | Transformer Today en recommandation utile basée sur données réelles. | Recommandation API, UI Today et coach validés. | Rapports `ADAPT_01A`, `ADAPT_01B` |
| RELEASE-02 | Release publique | RELEASE | App + API + Ops | TODO | POLISH-01B, décision scope public | RELEASE-02A | Préparer TestFlight/App Store sans déployer depuis Codex. | Checklist, privacy, versioning, screenshots et runbook prêts. | Rapport `RELEASE_02A` |
