# Lot Tracker V2 — API

Statuts autorisés : `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`, `DEFERRED`, `REPLACED`.

| Lot        | Titre                                | Repo(s)           | Statut | Dépend de         | Objectif                                                   | Validation                   | Rapport            |
| ---------- | ------------------------------------ | ----------------- | ------ | ----------------- | ---------------------------------------------------------- | ---------------------------- | ------------------ |
| STAB-00    | Roadmap V2 canonicalisation          | App + API         | DONE   | Aucun             | Créer la source de vérité V2 et l'alignement API           | Documents V2 créés           | `docs/roadmap/v2/` |
| STAB-01    | Product navigation & UX coherence    | App               | TODO   | STAB-00           | Corriger l'UX sans nouveau backend                         | API inchangée                | Repo app           |
| STAB-02    | Frontend design system unification   | App               | TODO   | STAB-01           | Unifier les écrans Flutter                                 | API inchangée                | Repo app           |
| CORE-09    | Source lifecycle & storage policy    | API + App         | TODO   | STAB-01           | Sécuriser archive/suppression des sources                  | Tests Prisma/API             | À créer            |
| CORE-10    | Question bank production hardening   | API + App         | TODO   | CORE-09           | Durcir génération, sélection et disponibilité de la banque | Tests service/repository/e2e | À créer            |
| CORE-11    | Session resume & history             | API + App         | TODO   | CORE-10           | Reprise et historique de sessions                          | Tests lifecycle              | À créer            |
| PLUS-01    | Deep Revision course-level           | API + App         | TODO   | STAB-02, CORE-11  | Route deep + correction ouverte course-level               | Tests IA/correction/mastery  | À créer            |
| PLUS-02    | Revision sheet complete / exam modes | API + App         | TODO   | PLUS-01           | Contrats de fiche complète/examen                          | Tests study artifacts        | À créer            |
| PLUS-03    | Exam preparation V1                  | API + App         | TODO   | PLUS-02           | Mode examen réel                                           | Tests session exam           | À créer            |
| ADAPT-01   | Today / adaptive coach               | API + App         | TODO   | CORE-11           | Recommandation quotidienne                                 | Tests recommandation         | À créer            |
| GENUI-01   | Controlled GenUI surface             | API + App         | TODO   | STAB-02, ADAPT-01 | Payloads GenUI strictement contrôlés                       | Tests schema/fallback        | À créer            |
| RELEASE-01 | Production readiness                 | API + App + Infra | TODO   | Lots MVP validés  | CI, stockage, monitoring, quotas, secrets                  | Checklist release            | À créer            |
