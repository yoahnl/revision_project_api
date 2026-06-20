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
- Suppression de source à durcir après usage pédagogique.
- Stockage local à remplacer ou abstraire pour production.
- `QuestionBankService` trop large et trop couplé à Prisma.
- Pas encore de deep course-level.
- Pas encore de mode exam.
- Pas de politique complète de lifecycle/archive.
- CI/preuves de validation à systématiser.
- Providers IA et quotas encore sensibles.

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

### STAB-01 — Product navigation & UX coherence

- API scope : aucun changement attendu.
- Rôle backend : confirmer que les endpoints existants suffisent aux corrections UX.
- Risque : découvrir une donnée manquante côté UX ; créer un lot backend séparé si nécessaire.

### STAB-02 — Frontend design system unification

- API scope : aucun.
- Rôle backend : aucun.

### CORE-09 — Source lifecycle & storage policy

- API scope : archive/suppression source, stockage, relations Prisma, règles de conservation.
- Tests : suppression source utilisée, source inutilisée, ownership, blobs, cascades.
- Risque : migration de statut ou politique de purge.

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
STAB-00
-> STAB-01
-> STAB-02

STAB-01 -> CORE-09 -> CORE-10 -> CORE-11
STAB-02 + CORE-11 -> PLUS-01 -> PLUS-02 -> PLUS-03
CORE-11 -> ADAPT-01
STAB-02 + ADAPT-01 -> GENUI-01
Lots MVP validés -> RELEASE-01
```

## 8. Critères backend de sortie MVP

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
