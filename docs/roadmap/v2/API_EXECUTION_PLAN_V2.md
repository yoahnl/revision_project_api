# API Execution Plan V2

Ce document aligne le backend sur les lots exécutables définis côté app dans :

```text
revision_project_app/docs/roadmap/v2/EXECUTION_PLAN_V2.md
```

Il ne duplique pas toute la vision produit. Il précise l'impact API, les dépendances backend et les preuves attendues.

## Horizons

- `FOUNDATION` : gouvernance, roadmap, CI.
- `MVP_STABLE` : stabilisation du MVP Core réel.
- `MVP_PLUS` : modes et surfaces au-dessus du MVP stable.
- `POST_MVP` : extensions avancées.
- `RELEASE` : préparation production.

## Graphe backend aligné

```text
STAB-00 -> STAB-00B
STAB-00B -> QUALITY-00
STAB-00B -> STAB-01A
STAB-01A -> STAB-01B
STAB-01A -> CORE-09A
STAB-01B -> STAB-01C
STAB-01C -> STAB-02A
STAB-02A -> STAB-02B
CORE-09A -> CORE-09B
CORE-09A -> CORE-09C
CORE-09A -> CORE-10A
CORE-10A -> CORE-10B
CORE-10A -> CORE-11A
CORE-10A -> PLUS-01A
CORE-10B -> CORE-10C
CORE-10B -> ADAPT-01
CORE-11A -> CORE-11B
CORE-11A -> PLUS-01B
PLUS-01A -> PLUS-01B
STAB-02B + CORE-09A -> PLUS-02
PLUS-01B + PLUS-02 + CORE-11B -> PLUS-03
STAB-02B + ADAPT-01 + PLUS-01A -> GENUI-01
QUALITY-00 + lots MVP_STABLE requis -> RELEASE-01
```

## Lots API ou API-impactants

## STAB-00B — Roadmap V2 hardening

### Parent macro-lot
STAB-00.

### Horizon
FOUNDATION.

### Objectif
Synchroniser la roadmap API avec le découpage exécutable.

### Pourquoi maintenant
Le backend doit utiliser les mêmes IDs que le repo app sans dupliquer toute la vision produit.

### Repos concernés
App + API.

### Dépendances strictes
STAB-00.

### Travaux parallélisables
Aucun.

### Backend scope
Documentation seulement.

### Frontend scope
Canon produit côté app.

### UX scope
Aucun runtime.

### Tests attendus
Validations documentaires.

### Critères d'acceptation
Trackers synchronisés et décisions canoniques pointées côté app.

### Non-objectifs
Aucune route, aucun code, aucune migration.

### Risques
Duplication divergente.

### Rapport attendu
`docs/roadmap/v2/STAB_00B_ROADMAP_V2_HARDENING_REPORT.md`.

## QUALITY-00 — CI baseline

### Parent macro-lot
QUALITY-00.

### Horizon
FOUNDATION.

### Objectif
Ajouter une baseline CI backend.

### Pourquoi maintenant
Les prochains lots touchent lifecycle, stockage, question bank et sessions.

### Repos concernés
App + API.

### Dépendances strictes
STAB-00B.

### Travaux parallélisables
STAB-01A.

### Backend scope
`npx prisma validate`, build NestJS, lint, tests Jest ciblés, e2e critiques, `git diff --check`.

### Frontend scope
Alignement avec la CI app, hors scope API.

### UX scope
Aucun.

### Tests attendus
Pipeline reproductible.

### Critères d'acceptation
Les lots backend futurs disposent d'une preuve CI minimale.

### Non-objectifs
Déploiement production complet.

### Risques
Rendre obligatoire une suite trop lente.

### Rapport attendu
Rapports QUALITY-00 app/API.

## STAB-01A — Shell, navigation & scaffold coherence

### Parent macro-lot
STAB-01.

### Horizon
MVP_STABLE.

### Objectif
Lot app-first ; vérifier qu'aucun endpoint n'est requis.

### Pourquoi maintenant
La navigation doit être corrigée avant de nouvelles features.

### Repos concernés
App.

### Dépendances strictes
STAB-00B.

### Travaux parallélisables
QUALITY-00.

### Backend scope
Aucun attendu.

### Frontend scope
Voir plan app.

### UX scope
Voir plan app.

### Tests attendus
API inchangée, ou besoin backend documenté.

### Critères d'acceptation
Pas de route ajoutée par accident.

### Non-objectifs
Nouveau contrat API.

### Risques
Découvrir que le shell veut une donnée inexistante.

### Rapport attendu
Repo app uniquement sauf impact API découvert.

## STAB-01B — Home, Revision Hub & Course action hierarchy

### Parent macro-lot
STAB-01.

### Horizon
MVP_STABLE.

### Objectif
Lot app-first ; vérifier que les contrats course/progress/session suffisent.

### Pourquoi maintenant
Les actions principales doivent devenir claires.

### Repos concernés
App.

### Dépendances strictes
STAB-01A.

### Travaux parallélisables
CORE-09A.

### Backend scope
Aucun attendu.

### Frontend scope
Voir plan app.

### UX scope
Voir plan app.

### Tests attendus
Pas de modification API.

### Critères d'acceptation
Aucune action front ne suppose une API non livrée.

### Non-objectifs
Deep/exam.

### Risques
Affordance front trop ambitieuse.

### Rapport attendu
Repo app sauf impact API.

## STAB-01C — Sheet, Progress, wording & subject discoverability

### Parent macro-lot
STAB-01.

### Horizon
MVP_STABLE.

### Objectif
Identifier précisément les capacités UX qui nécessitent API.

### Pourquoi maintenant
Renommer/archive ne doivent pas être simulés côté front.

### Repos concernés
App + API si besoin.

### Dépendances strictes
STAB-01B.

### Travaux parallélisables
Aucun.

### Backend scope
Aucun sauf si une capacité `AVAILABLE_NOW` manque réellement.

### Frontend scope
Voir plan app.

### UX scope
Matrice `AVAILABLE_NOW`, `NEEDS_API`, `FUTURE`.

### Tests attendus
Contrat documenté.

### Critères d'acceptation
Les besoins backend sont transformés en lots dédiés.

### Non-objectifs
Implémenter CORE-09C dans ce lot.

### Risques
Scope creep.

### Rapport attendu
Repo app, API si touchée.

## CORE-09A — Source archive/delete semantics

### Parent macro-lot
CORE-09.

### Horizon
MVP_STABLE.

### Objectif
Sécuriser archive/delete des sources utilisées.

### Pourquoi maintenant
Sources, fiches, sessions, question bank et résultats créent de l'historique pédagogique.

### Repos concernés
App + API.

### Dépendances strictes
STAB-01A.

### Travaux parallélisables
STAB-01B.

### Backend scope
Statut ou règle d'archive, refus de suppression dangereuse, ownership, migrations si nécessaires.

### Frontend scope
Wording et confirmation.

### UX scope
Ne pas promettre suppression définitive quand l'historique doit rester.

### Tests attendus
Prisma/repository/use case/controller/e2e.

### Critères d'acceptation
Une source utilisée ne casse pas les anciens résultats.

### Non-objectifs
Stockage cloud complet.

### Risques
Migration de données.

### Rapport attendu
Rapports CORE-09A app/API.

## CORE-09B — Blob cleanup & storage abstraction

### Parent macro-lot
CORE-09.

### Horizon
MVP_STABLE.

### Objectif
Préparer stockage production et cleanup sûr.

### Pourquoi maintenant
Le stockage local est une limite de production.

### Repos concernés
API.

### Dépendances strictes
CORE-09A.

### Travaux parallélisables
CORE-09C.

### Backend scope
Storage port, cleanup idempotent, env docs.

### Frontend scope
Aucun.

### UX scope
Aucun.

### Tests attendus
Unit/integration storage.

### Critères d'acceptation
Changer de backend storage ne touche pas les use cases produit.

### Non-objectifs
Déploiement cloud complet si secrets absents.

### Risques
Blobs historiques orphelins.

### Rapport attendu
Rapport CORE-09B API.

## CORE-09C — Subject and course lifecycle APIs

### Parent macro-lot
CORE-09.

### Horizon
MVP_STABLE.

### Objectif
Créer les contrats pour renommer/éditer/archiver matière et cours.

### Pourquoi maintenant
Ces actions sont UX-naturelles mais doivent être serveur-owned.

### Repos concernés
App + API.

### Dépendances strictes
CORE-09A.

### Travaux parallélisables
CORE-09B.

### Backend scope
Routes lifecycle, validation, ownership, conflits.

### Frontend scope
Actions seulement quand API livrée.

### UX scope
Gestion claire des matières/cours.

### Tests attendus
Auth/404/409/happy path.

### Critères d'acceptation
Plus aucune action de gestion visible sans contrat.

### Non-objectifs
Partage multi-utilisateur.

### Risques
Élargissement admin.

### Rapport attendu
Rapports CORE-09C app/API.

## CORE-10A — Async question bank readiness

### Parent macro-lot
CORE-10.

### Horizon
MVP_STABLE.

### Objectif
Rendre la préparation de questions asynchrone ou pré-générée.

### Pourquoi maintenant
Le démarrage quick ne doit pas dépendre d'une génération IA longue.

### Repos concernés
App + API.

### Dépendances strictes
CORE-09A.

### Travaux parallélisables
STAB-02A.

### Backend scope
Jobs, statuts readiness, retries, fallback provider.

### Frontend scope
États préparation et retry.

### UX scope
Attente lisible, pas de navigation cassée.

### Tests attendus
Jobs, e2e quick readiness.

### Critères d'acceptation
Quick peut dire "questions en préparation" sans échouer brutalement.

### Non-objectifs
Adaptation complète.

### Risques
Worker/concurrence.

### Rapport attendu
Rapports CORE-10A app/API.

## CORE-10B — Multi-KU selection & concurrency hardening

### Parent macro-lot
CORE-10.

### Horizon
MVP_STABLE.

### Objectif
Sélection équilibrée entre notions et concurrence maîtrisée.

### Pourquoi maintenant
La banque ne doit pas rester centrée sur une seule notion.

### Repos concernés
API.

### Dépendances strictes
CORE-10A.

### Travaux parallélisables
CORE-11A.

### Backend scope
Multi-KU, askedCount, lastAskedAt, verrouillage ou réservation.

### Frontend scope
Aucun.

### UX scope
Variété perçue.

### Tests attendus
Repository/concurrency/distribution.

### Critères d'acceptation
Sélection plus robuste et moins répétitive.

### Non-objectifs
Coach adaptatif complet.

### Risques
Locking trop complexe.

### Rapport attendu
Rapport CORE-10B API.

## CORE-10C — Question bank clean architecture & quality metrics

### Parent macro-lot
CORE-10.

### Horizon
MVP_STABLE.

### Objectif
Découpler la banque de questions et mesurer coût/qualité.

### Pourquoi maintenant
Le service devient central.

### Repos concernés
API.

### Dépendances strictes
CORE-10B.

### Travaux parallélisables
ADAPT-01.

### Backend scope
Ports, mappers, métriques, catégories de flag.

### Frontend scope
Éventuel wording flag si API prête.

### UX scope
Signalement plus utile.

### Tests attendus
Unit tests purs + repository.

### Critères d'acceptation
QuestionBankService n'est plus un blob Prisma.

### Non-objectifs
Dashboard admin complet.

### Risques
Refactor large.

### Rapport attendu
Rapports CORE-10C selon repos touchés.

## CORE-11A — Session draft persistence & resume

### Parent macro-lot
CORE-11.

### Horizon
MVP_STABLE.

### Objectif
Persist answers draft et reprise.

### Pourquoi maintenant
Un parcours mobile doit survivre aux interruptions.

### Repos concernés
App + API.

### Dépendances strictes
CORE-10A.

### Travaux parallélisables
CORE-10B, PLUS-01A.

### Backend scope
Draft answers, status, idempotence.

### Frontend scope
Sauvegarde/reprise.

### UX scope
Ne pas perdre la session.

### Tests attendus
Lifecycle, abandon, reprise.

### Critères d'acceptation
Une session commencée peut être reprise.

### Non-objectifs
Historique complet.

### Risques
Conflit draft/final submit.

### Rapport attendu
Rapports CORE-11A app/API.

## CORE-11B — Session history & completed session details

### Parent macro-lot
CORE-11.

### Horizon
MVP_STABLE.

### Objectif
Historique et détail completed.

### Pourquoi maintenant
Les résultats doivent être retrouvables.

### Repos concernés
App + API.

### Dépendances strictes
CORE-11A.

### Travaux parallélisables
Aucun.

### Backend scope
List/detail sessions.

### Frontend scope
Historique.

### UX scope
Comprendre le passé.

### Tests attendus
Auth/list/detail.

### Critères d'acceptation
Un quiz terminé ne se rouvre pas.

### Non-objectifs
Analytics avancés.

### Risques
Confusion avec progression.

### Rapport attendu
Rapports CORE-11B app/API.

## PLUS-01A — Course Deep Revision open-question V1

### Parent macro-lot
PLUS-01.

### Horizon
MVP_PLUS.

### Objectif
Première route deep course-level.

### Pourquoi maintenant
Deep peut commencer avant tout l'historique complet si quick et question bank sont stables.

### Repos concernés
App + API.

### Dépendances strictes
STAB-02A, CORE-10A, quick lifecycle stable.

### Travaux parallélisables
CORE-11A.

### Backend scope
Start deep, source/KU backend, open question.

### Frontend scope
UI deep V1.

### UX scope
Mode distinct de quick.

### Tests attendus
Auth/ownership/correction/mastery.

### Critères d'acceptation
Deep V1 réel sans exam.

### Non-objectifs
Result deep complet si repoussé.

### Risques
Qualité correction IA.

### Rapport attendu
Rapports PLUS-01A app/API.

## PLUS-01B — Deep lifecycle, completion & result

### Parent macro-lot
PLUS-01.

### Horizon
MVP_PLUS.

### Objectif
Completion/result Deep.

### Pourquoi maintenant
Deep V1 doit devenir complet.

### Repos concernés
App + API.

### Dépendances strictes
PLUS-01A, CORE-11A.

### Travaux parallélisables
Aucun.

### Backend scope
Lifecycle/result deep.

### Frontend scope
Result deep.

### UX scope
Feedback clair.

### Tests attendus
Repository/controller/e2e.

### Critères d'acceptation
Deep a début, correction et fin.

### Non-objectifs
Exam.

### Risques
Scoring IA.

### Rapport attendu
Rapports PLUS-01B app/API.

## PLUS-02 — Complete and pre-exam revision sheets

### Parent macro-lot
PLUS-02.

### Horizon
MVP_PLUS.

### Objectif
Contrats fiches complète et pré-examen.

### Pourquoi maintenant
Les faux onglets doivent disparaître ou devenir réels.

### Repos concernés
App + API.

### Dépendances strictes
STAB-02B, CORE-09A.

### Travaux parallélisables
PLUS-01A.

### Backend scope
Study artifacts versionnés.

### Frontend scope
Tabs réels.

### UX scope
Pas de contenu inventé.

### Tests attendus
Generation/parser/no leakage.

### Critères d'acceptation
Chaque onglet visible a un contrat.

### Non-objectifs
Exam session.

### Risques
Coût IA.

### Rapport attendu
Rapports PLUS-02 app/API.

## ADAPT-01 — Today and adaptive coach

### Parent macro-lot
ADAPT-01.

### Horizon
MVP_PLUS.

### Objectif
Recommandation quotidienne explicable.

### Pourquoi maintenant
Le produit doit guider.

### Repos concernés
App + API.

### Dépendances strictes
CORE-10B.

### Travaux parallélisables
CORE-10C.

### Backend scope
Read model recommendation.

### Frontend scope
Page Today.

### UX scope
Raison pédagogique lisible.

### Tests attendus
No data/practiced/due.

### Critères d'acceptation
Today n'est pas une façade.

### Non-objectifs
Gamification complète.

### Risques
Moteur pauvre.

### Rapport attendu
Rapports ADAPT-01 app/API.

## PLUS-03 — Exam preparation V1

### Parent macro-lot
PLUS-03.

### Horizon
POST_MVP.

### Objectif
Mode examen réel.

### Pourquoi maintenant
Après Deep, fiches et historique.

### Repos concernés
App + API.

### Dépendances strictes
PLUS-01B, PLUS-02, CORE-11B.

### Travaux parallélisables
Aucun.

### Backend scope
Session exam, timer, result exam.

### Frontend scope
Flow exam.

### UX scope
Simulation distincte.

### Tests attendus
Lifecycle/scoring/timeout.

### Critères d'acceptation
Exam n'est pas quick renommé.

### Non-objectifs
Correction humaine.

### Risques
Complexité pédagogique.

### Rapport attendu
Rapports PLUS-03 app/API.

## GENUI-01 — Controlled GenUI surface

### Parent macro-lot
GENUI-01.

### Horizon
POST_MVP.

### Objectif
Payloads GenUI contrôlés.

### Pourquoi maintenant
Seulement après stabilisation.

### Repos concernés
App + API.

### Dépendances strictes
STAB-02B, ADAPT-01, PLUS-01A.

### Travaux parallélisables
Aucun.

### Backend scope
Schema strict, validation, fallback.

### Frontend scope
Catalogue widgets.

### UX scope
Pas d'UI arbitraire.

### Tests attendus
Payload invalid/valid.

### Critères d'acceptation
Un payload invalide ne casse rien.

### Non-objectifs
UI libre générée.

### Risques
Versioning.

### Rapport attendu
Rapports GENUI-01 app/API.

## RELEASE-01 — Production readiness

### Parent macro-lot
RELEASE-01.

### Horizon
RELEASE.

### Objectif
Préparer la production API.

### Pourquoi maintenant
Après MVP stable.

### Repos concernés
App + API + infra.

### Dépendances strictes
QUALITY-00 et lots MVP_STABLE requis.

### Travaux parallélisables
Aucun.

### Backend scope
Secrets, monitoring, logs, quotas, stockage, worker, DB tests.

### Frontend scope
Build release et crash reporting.

### UX scope
Accessibilité.

### Tests attendus
Suites complètes prod-like.

### Critères d'acceptation
Déploiement surveillé et reproductible.

### Non-objectifs
Nouvelle feature produit.

### Risques
Infra sous-estimée.

### Rapport attendu
Rapports RELEASE-01 app/API.
