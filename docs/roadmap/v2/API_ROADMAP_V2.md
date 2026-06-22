# API Roadmap V2

## 1. Rôle de ce document

Ce document aligne le backend NestJS avec la roadmap produit V2. Il ne duplique pas toute la vision UX : la source canonique produit vit dans le repo Flutter.

Vision à servir :

```text
Import de sources personnelles
-> structuration du savoir
-> sessions courtes
-> feedback immédiat
-> maîtrise par notion
-> recommandation quotidienne
```

## 2. Audit initial

Fichiers et dossiers inspectés :

- `docs/core/`
- `prisma/schema.prisma`
- `src/modules/auth/`
- `src/modules/subjects/`
- `src/modules/courses/`
- `src/modules/documents/`
- `src/modules/jobs/`
- `src/modules/ai/`
- `src/modules/activities/`
- `src/modules/revision/`
- `src/modules/revision-sessions/`
- `src/modules/study-artifacts/`
- `test/critical-paths.e2e-spec.ts`
- `package.json`
- `.env.example`

## 3. État réel actuel

Le backend possède déjà :

- auth Firebase ;
- matières ;
- cours ;
- upload PDF sous cours ;
- documents et jobs de processing ;
- extraction de `KnowledgeUnit` ;
- fiches rapides document/course-level ;
- progression course/subject ;
- sessions de révision ;
- quick revision course-level ;
- completion et result quick ;
- corrections détaillées ;
- question bank persistée ;
- flag de questions ;
- providers IA multiples ;
- open question legacy ;
- rich closed legacy.

Routes structurantes déjà présentes :

- `GET /subjects`
- `POST /subjects`
- `GET /subjects/:subjectId/courses`
- `POST /subjects/:subjectId/courses`
- `GET /courses/:courseId`
- `DELETE /courses/:courseId`
- `POST /courses/:courseId/source/course-pdf`
- `DELETE /courses/:courseId/sources/:documentId`
- `GET /courses/:courseId/revision-sheet`
- `POST /courses/:courseId/revision-sheet`
- `GET /courses/:courseId/progress`
- `GET /subjects/:subjectId/progress`
- `POST /courses/:courseId/revision-sessions/quick`
- `GET /revision-sessions/:sessionId`
- `POST /revision-sessions/:sessionId/complete`
- `GET /revision-sessions/:sessionId/result`
- `POST /revision-sessions/:sessionId/questions/:questionId/flag`

## 4. Risques backend actuels

- Génération question bank encore trop synchrone.
- Quick course-level centré sur une notion sélectionnée.
- Suppression de source désormais gardée par CORE-09A ; CORE-09B ajoute une intention transactionnelle de cleanup et un processor interne pour supprimer les fichiers physiques uniquement après suppression DB safe.
- Stockage local à remplacer ou abstraire pour production.
- `QuestionBankService` trop large et trop couplé à Prisma.
- Pas encore de deep course-level.
- Pas encore de mode exam.
- Politique source delete/archive posée pour les documents ; lifecycle matière/cours complet encore à faire.
- CI/preuves de validation à systématiser.
- Providers IA et quotas encore sensibles.
- Roadmap exécutable à maintenir synchronisée avec le repo app.

## 5. Principes backend non négociables

- Auth/ownership serveur obligatoire.
- Le client n'envoie jamais `studentId`.
- Le client ne choisit pas directement `documentId` ou `knowledgeUnitId` dans les flows course-level.
- La sélection source/KU reste backend.
- Les générations IA sont structurées, validées et versionnées.
- Les corrections IA distinguent score, feedback, points présents, points manquants et conseil.
- Les sources utilisées par l'IA restent traçables.
- Les suppressions respectent l'historique pédagogique.
- Les services application ne doivent pas devenir des blobs Prisma géants.
- Toute nouvelle route doit avoir tests auth, 404/409 et happy path.

## 6. Lots backend alignés

### STAB-00 — Roadmap V2 canonicalisation

- API scope : créer ce dossier V2.
- Validation : format docs et `git diff --check`.
- Risque : documentation divergente avec le repo app.

### STAB-00B — Roadmap V2 hardening, execution slicing & governance

- API scope : ajouter le plan d'exécution API, le tracker exécutable, les horizons, `QUALITY-00` et les règles de synchronisation.
- Validation : validations documentaires et `git diff --check`.
- Risque : dupliquer la vision produit au lieu de pointer vers la source canonique app.

### QUALITY-00 — CI baseline

- API scope : ajouter une baseline CI avec Prisma validate, build, lint, tests Jest et e2e critiques.
- Validation : pipeline reproductible sur pull request ou branche de validation.
- Risque : attendre `RELEASE-01` pour systématiser la preuve qualité.

### STAB-01 — Product navigation & UX coherence

- API scope : aucun changement attendu.
- Rôle backend : confirmer que les endpoints existants suffisent aux corrections UX.
- Risque : découvrir une donnée manquante côté UX ; créer un lot backend séparé si nécessaire.

### STAB-02 — Frontend design system unification

- API scope : aucun.
- Rôle backend : aucun.

### CORE-09 — Source lifecycle & storage policy

- API scope : archive/suppression source, stockage, relations Prisma, règles de conservation.
- État : CORE-09A a ajouté `archivedAt`, la décision delete/archive/block et les guards 409 sur source utilisée. CORE-09B ajoute le cleanup storage post-delete via outbox DB, port storage et worker interne.
- Tests : suppression source utilisée, source inutilisée, ownership, archive, cleanup storage, jobs, e2e.
- Risque : le lifecycle matière/cours reste à traiter en CORE-09C ; le storage cloud reste une dette future.

### CORE-10 — Question bank production hardening

- API scope : génération asynchrone/pré-génération, disponibilité banque, sélection multi-notions, équilibre difficulté/maîtrise, concurrence, signalement, métriques coût.
- Tests : cap actif, flagged exclusion, asked count, concurrence, fallback provider, erreurs préparations.
- Risque : complexité worker/locking.

### CORE-11 — Session resume & history

- API scope : réponses partielles, session en cours, historique, détail completed.
- Tests : resume, abandon, completed, ownership.
- Risque : lifecycle plus complexe et migrations possibles.

### PLUS-01 — Deep Revision course-level

- API scope : route deep, action open question, correction IA, update mastery.
- Tests : correction ouverte, score, feedback, mastery, legacy non cassé.
- Risque : coût IA et qualité pédagogique.

### PLUS-02 — Revision sheet complete / exam modes

- API scope : contrats de fiche complète et fiche examen, versioning, sources consultables.
- Tests : generation, parser, no sensitive leakage.
- Risque : payloads trop gros ou non stables.

### PLUS-03 — Exam preparation V1

- API scope : session exam, timer, question mix, résultat exam.
- Tests : lifecycle exam, scoring, timeout, result.
- Risque : scope pédagogique large.

### ADAPT-01 — Today / adaptive coach

- API scope : recommandation quotidienne, notion due, répétition espacée simple, raison pédagogique.
- Tests : no data, practiced, stale mastery, next action.
- Risque : recommandation pauvre si peu de données.

### GENUI-01 — Controlled GenUI surface

- API scope : catalogue de payloads autorisés, validation, fallback.
- Tests : schema strict, invalid payload, no arbitrary UI.
- Risque : sécurité et dette de contrat.

### RELEASE-01 — Production readiness

- API scope : CI, tests DB, worker/Redis, secrets, monitoring, quotas, logs IA, stockage cloud, suppression compte/données.
- Tests : pipeline complet.
- Risque : sujets infra sous-estimés.

## 7. Dépendances

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

`PLUS-01A` dépend de `STAB-02A`, `CORE-10A` et du quick lifecycle stable. Il ne dépend plus de tout `CORE-11`.

## 8. Critères backend de sortie MVP

`MVP_STABLE` côté backend suppose :

- `QUALITY-00` terminé ;
- `CORE-09A` et `CORE-09B` terminés ;
- `CORE-10A` terminé ;
- `CORE-11A` terminé ;
- quick flow vert ;
- source lifecycle sûr ;
- sessions reprenables ;
- validations CI reproductibles.

Deep, fiche complète, Exam, Today adaptatif et GenUI ne sont pas requis pour `MVP_STABLE`.

- Upload source sûr et observable.
- Processing fiable ou erreur lisible.
- Fiche rapide réelle.
- Quick revision avec question bank stable.
- Completion/result backend.
- Corrections détaillées.
- Progression réelle.
- Source lifecycle sécurisé.
- Tests critiques reproductibles.
- CI et monitoring prêts avant release.

## 9. Politique de mise à jour

Après chaque lot backend, appliquer `ROADMAP_UPDATE_PROTOCOL.md`, mettre à jour le tracker, ajouter le rapport, documenter les routes, migrations, tests et risques.

## 10. Points discutables

- Garder une roadmap backend séparée est utile pour les contrats et risques, mais la vision produit ne doit pas être dupliquée en entier.
- CORE-10 pourrait techniquement précéder CORE-09, mais durcir la source lifecycle d'abord évite de bâtir une banque robuste sur des sources supprimables dangereusement.
- Deep peut sembler attractif maintenant, mais il dépend d'un quick stable, d'une question bank plus robuste et d'une UX clarifiée.
- Today pourrait devenir le centre produit, mais le backend doit d'abord produire des recommandations explicables.
- GenUI doit attendre : les payloads contrôlés sont indispensables avant toute surface dynamique.
