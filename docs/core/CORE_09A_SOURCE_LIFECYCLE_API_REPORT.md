# CORE-09A Source Lifecycle API Report

## 1. Resume

CORE-09A met en place un lifecycle explicite des sources cote API : une source active peut etre supprimee uniquement si elle n'a aucune dependance pedagogique observee ; une source utilisee est archivee ; une source en traitement ou deja archivee est bloquee. Les endpoints existants de suppression sont gardes mais proteges par cette politique, et de nouveaux endpoints permettent de demander la decision lifecycle ou d'archiver une source.

## 2. Audit initial

Voir `docs/core/CORE_09A_SOURCE_LIFECYCLE_AUDIT.md`. L'audit a identifie que `Document` alimente chunks, notions, fiches, question bank, sessions et resultats. La suppression naive etait donc trop risquee.

## 3. Sub-agents / passes utilisees

- API Domain Audit Agent : dependances Prisma et chemins delete.
- Backend Policy Agent : decision `DELETE` / `ARCHIVE` / `BLOCK`.
- Repository Guard Agent : implementation dans `PrismaDocumentsRepository` sans Prisma dans les use cases.
- Controller Contract Agent : endpoints lifecycle/archive et mapping 409.
- QA Agent : tests repository, use cases, controllers, e2e, full Jest.
- Reviewer Agent : verification scope, pas de GenKit/prompts/infra.

## 4. Politique source lifecycle

- `DELETE` : document actif, pas `UPLOADED`/`PROCESSING`, sans dependance pedagogique compteable.
- `ARCHIVE` : document actif avec chunks, notions, fiches, question bank, sessions, actions, questions ou payloads lies.
- `BLOCK` : document en upload/analyse ou deja archive.

## 5. Schema et migration

`Document` recoit `archivedAt` et `archivedReason`, avec index sur `archivedAt`. CORE-09A ne supprime aucun blob physique.

## 6. Endpoints ajoutes / durcis

- `GET /documents/:documentId/lifecycle`
- `POST /documents/:documentId/archive`
- `GET /courses/:courseId/sources/:documentId/lifecycle`
- `POST /courses/:courseId/sources/:documentId/archive`
- `DELETE /documents/:documentId` garde son chemin mais renvoie 409 si unsafe.
- `DELETE /courses/:courseId/sources/:documentId` garde son chemin mais renvoie 409 si unsafe.

Les conflits lifecycle exposent un body stable avec `code`, `message` et `decision`.

## 7. Filtres actifs

Les queries course/document/progress pertinentes filtrent `archivedAt: null` pour retirer les sources archivees du parcours actif sans casser les donnees historiques.

## 8. Tests ajoutes / modifies

- Domaine lifecycle : decision delete/archive/block.
- Repository documents : safe delete, archive, decision, filtres actifs.
- Repository courses : filtres `archivedAt: null`.
- Use cases course source lifecycle : ownership et 404.
- Controllers documents/courses : endpoints lifecycle/archive, 409 conflict.
- E2E et full Jest relances.

## 9. Commandes executees et resultats

- `npx prisma validate` : PASS.
- `npx prisma generate` : PASS, Prisma Client 7.8.0 genere.
- `npm run build` : PASS.
- `npm run lint:check` : PASS apres correction des types unsafe.
- `npm test -- documents --runInBand` : PASS, 10 suites / 77 tests.
- `npm test -- courses --runInBand` : PASS, 10 suites / 85 tests.
- `npm test -- source --runInBand` : PASS, 2 suites / 8 tests.
- `npm test -- lifecycle --runInBand` : PASS, 2 suites / 8 tests.
- `npm test -- activities --runInBand` : PASS, 20 suites passed, 1 skipped, 354 passed, 1 skipped.
- `npm test -- revision-sessions --runInBand` : PASS, 9 suites / 70 tests.
- `npm run test:e2e -- --runInBand` : PASS, 2 suites / 34 tests.
- `npm test -- --runInBand` : PASS, 87 suites passed, 1 skipped, 761 tests passed, 1 skipped.

## 10. Recherches statiques

- `rg -n "delete\(|deleteMany|document\.delete|courseDocument\.delete|cascade|onDelete" src prisma test --glob '!src/generated/prisma/**' || true` : sorties attendues dans schema, tests, repositories historiques et deletes document desormais gardes. Les suppressions source actives passent par la decision lifecycle.
- `rg -n "archivedAt|deletedAt|SOURCE_DELETE_BLOCKED|SOURCE_ARCHIVED|lifecycle|archive" src prisma test --glob '!src/generated/prisma/**' || true` : sorties sur migration, schema, controllers, repository, domain et tests.

## 11. Roadmap

- `CORE-09A` passe a `DONE` dans l'execution tracker API.
- `CORE-09` passe a `IN_PROGRESS` dans le macro tracker API.
- `API_ROADMAP_V2.md` note que CORE-09A est en place et que CORE-09B/CORE-09C restent a faire.

## 12. Limitations

- Pas de suppression physique de fichiers/blobs.
- Pas de lifecycle complet matiere/cours.
- Les sources archivees sont retirees des vues actives mais pas encore exposees dans un historique dedie.
- Certains messages domaine sont en ASCII francais pour rester coherents avec les conventions d'edition actuelles ; l'app affiche les formulations utilisateur premium.

## 13. Dette restante

- CORE-09B : cleanup blob/storage, abstraction cloud, purge autorisee.
- CORE-09C : lifecycle matiere/cours, rename/archive/delete propres.
- Potentiel test d'integration DB reel dedie aux contraintes d'archive si necessaire.

## 14. Auto-review

- Safe delete protege par decision domaine : oui.
- Archive logique testee : oui.
- Use cases sans Prisma : oui.
- Controllers avec 409 : oui.
- GenKit/prompts/provider intacts : oui.
- Blob cleanup non implemente : conforme au scope.
- Aucun commit effectue : oui.

## 15. Fichiers crees/modifies/supprimes

### Crees

- `docs/core/CORE_09A_SOURCE_LIFECYCLE_AUDIT.md`
- `docs/core/CORE_09A_SOURCE_LIFECYCLE_API_REPORT.md`
- `prisma/migrations/20260621190000_source_lifecycle_archive/migration.sql`
- `src/modules/courses/application/course-source-lifecycle.use-case.spec.ts`
- `src/modules/courses/application/course-source-lifecycle.use-case.ts`
- `src/modules/documents/application/source-lifecycle.use-case.ts`
- `src/modules/documents/domain/source-lifecycle.entity.spec.ts`
- `src/modules/documents/domain/source-lifecycle.entity.ts`

### Modifies

Voir l'annexe complete ci-dessous.

### Supprimes

Aucun.

## 16. Contenu complet des fichiers crees/modifies/supprimes

Le rapport courant ne s'inclut pas lui-meme pour eviter une recursion infinie. L'audit CORE-09A est inclus ci-dessous.

### `docs/core/CORE_09A_SOURCE_LIFECYCLE_AUDIT.md`

~~~text
# CORE-09A Source Lifecycle Audit

## Resume

Audit pre-implementation du lifecycle des sources. Le modele existant permettait de supprimer une source depuis les endpoints Documents et Courses alors que le document pouvait deja alimenter des chunks, notions, fiches, questions, sessions et resultats. La politique retenue est donc : supprimer seulement les sources sans usage observe, archiver les sources utilisees ou ambigues, bloquer les sources en traitement ou deja archivees.

## Passes / sub-agents utilises

- API Domain Audit Agent : audit Prisma, endpoints delete et dependances pedagogiques.
- App Integration Audit Agent : audit des appels Flutter et des surfaces de suppression.
- Repository Guard Pass : verification que la regle de decision vit dans le domaine et que Prisma reste en infrastructure.
- QA Pass : identification des suites backend/frontend a etendre.

## Fichiers et zones inspectes

### API

- `prisma/schema.prisma`
- `src/modules/documents/**`
- `src/modules/courses/**`
- `src/modules/subjects/**`
- `src/modules/ai/**`
- `src/modules/revision/**`
- `src/modules/activities/**`
- `src/modules/revision-sessions/**`
- `src/modules/today/**` quand present
- `src/common/**` quand present
- `test/**`

### App

- `lib/features/courses/**`
- `lib/features/documents/**`
- `lib/presentation/pages/subjects/subject_detail_page.dart`
- `test/features/courses/**`
- `test/features/documents/**`
- `test/features/subjects/**`
- `test/fakes/**`

## Dependances trouvees autour d'une source

Une source `Document` peut etre referencee directement ou indirectement par :

- `DocumentChunk`
- `KnowledgeUnit`
- `Summary`
- `RevisionSheet`
- `QuestionBankItem`
- `RevisionSession`
- `RevisionSessionAction`
- `OpenQuestion`
- `ActivitySession`
- `Question`
- `RichClosedExercisePayload`

Ces dependances justifient l'archive plutot qu'une suppression destructive, parce qu'elles peuvent servir a l'historique pedagogique, aux resultats ou aux futures analyses.

## Risque initial

Les suppressions document/course source pouvaient retomber sur des cascades Prisma ou sur des deletes de dependances, ce qui rendait difficile de garantir qu'une fiche, une session terminee ou une progression historique restent interpretables apres suppression.

## Politique recommandee

- `DELETE` : document actif, pas en traitement, sans dependance pedagogique observee.
- `ARCHIVE` : document actif avec au moins une dependance pedagogique ou usage historique.
- `BLOCK` : document en upload/processing ou document deja archive.

## Points hors scope

- Nettoyage physique de blobs : CORE-09B.
- Lifecycle complet des matieres/cours : CORE-09C.
- Historique/reprise de session : CORE-11.
- Bibliotheque globale des sources : lot futur si necessaire.

## Notes sur les recherches statiques

La recherche brute `delete/deleteMany/onDelete` est volontairement bruyante : elle detecte aussi les cascades schema, les tests, le code Prisma genere et les repositories non concernes par les sources. L'audit utile porte donc sur les suppressions document/course source et sur les chemins qui manipulent `Document`.

~~~

### `docs/roadmap/v2/API_ROADMAP_V2.md`

~~~text
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
- Suppression de source désormais gardée par CORE-09A, mais cleanup blob/storage encore à faire.
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
- État : CORE-09A a ajouté `archivedAt`, la décision delete/archive/block et les guards 409 sur source utilisée.
- Tests : suppression source utilisée, source inutilisée, ownership, archive, blobs/cascades pour CORE-09B.
- Risque : cleanup storage physique et lifecycle matière/cours restent à traiter en CORE-09B/CORE-09C.

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
- `CORE-09A` terminé ;
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

~~~

### `docs/roadmap/v2/EXECUTION_LOT_TRACKER_V2.md`

~~~text
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
| CORE-09B | CORE-09 | MVP_STABLE | Oui | TODO | CORE-09A | Cleanup blob et abstraction storage. | Tests storage et cleanup. | À créer |
| CORE-09C | CORE-09 | MVP_STABLE | Oui | TODO | CORE-09A | Lifecycle subject/course : rename/edit/archive si validé. | Tests auth/404/409/happy path. | À créer |
| CORE-10A | CORE-10 | MVP_STABLE | Oui | TODO | CORE-09A | Async question bank readiness. | Jobs, retries, status readiness. | À créer |
| CORE-10B | CORE-10 | MVP_STABLE | Oui | TODO | CORE-10A | Multi-KU selection et concurrence. | Tests sélection, distribution, locking. | À créer |
| CORE-10C | CORE-10 | MVP_STABLE | Oui | TODO | CORE-10B | Découplage QuestionBankService et métriques. | Unit tests + repository tests. | À créer |
| CORE-11A | CORE-11 | MVP_STABLE | Oui | TODO | CORE-10A | Draft persistence et resume. | Tests lifecycle/draft/ownership. | À créer |
| CORE-11B | CORE-11 | MVP_STABLE | Oui | TODO | CORE-11A | Historique et détails de sessions terminées. | Tests list/detail/completed. | À créer |
| PLUS-01A | PLUS-01 | MVP_PLUS | Oui | TODO | STAB-02A, CORE-10A, quick lifecycle stable | Route deep course-level open-question V1. | Tests correction/mastery. | À créer |
| PLUS-01B | PLUS-01 | MVP_PLUS | Oui | TODO | PLUS-01A, CORE-11A | Lifecycle/result Deep. | Tests completion/result deep. | À créer |
| PLUS-02 | PLUS-02 | MVP_PLUS | Oui | TODO | STAB-02B, CORE-09A | Fiches complète et pré-examen. | Tests study artifacts. | À créer |
| ADAPT-01 | ADAPT-01 | MVP_PLUS | Oui | TODO | CORE-10B | Recommandation Today. | Tests no data/practiced/stale mastery. | À créer |
| PLUS-03 | PLUS-03 | POST_MVP | Oui | TODO | PLUS-01B, PLUS-02, CORE-11B | Mode examen V1. | Tests lifecycle exam. | À créer |
| GENUI-01 | GENUI-01 | POST_MVP | Oui | TODO | STAB-02B, ADAPT-01, PLUS-01A | Payloads GenUI contrôlés. | Tests schema/fallback. | À créer |
| RELEASE-01 | RELEASE-01 | RELEASE | Oui | TODO | QUALITY-00, lots MVP_STABLE requis | Production readiness API. | Checklist release backend. | À créer |

~~~

### `docs/roadmap/v2/LOT_TRACKER_V2.md`

~~~text
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
| CORE-09 | Source lifecycle & storage policy | MVP_STABLE | Oui | IN_PROGRESS | STAB-01A | CORE-09A, CORE-09B, CORE-09C | Sécuriser archive/suppression, stockage et lifecycle sujet/cours. | Tests Prisma/API. | `docs/core/CORE_09A_SOURCE_LIFECYCLE_API_REPORT.md` |
| CORE-10 | Question bank production hardening | MVP_STABLE | Oui | TODO | CORE-09A | CORE-10A, CORE-10B, CORE-10C | Durcir génération, sélection et disponibilité de la banque. | Tests service/repository/e2e. | À créer |
| CORE-11 | Session resume & history | MVP_STABLE | Oui | TODO | CORE-10A | CORE-11A, CORE-11B | Reprise et historique de sessions. | Tests lifecycle. | À créer |
| PLUS-01 | Deep Revision course-level | MVP_PLUS | Oui | TODO | STAB-02A, CORE-10A | PLUS-01A, PLUS-01B | Route deep + correction ouverte course-level. | Tests IA/correction/mastery. | À créer |
| PLUS-02 | Revision sheet complete / exam modes | MVP_PLUS | Oui | TODO | STAB-02B, CORE-09A | PLUS-02 | Contrats de fiche complète/examen. | Tests study artifacts. | À créer |
| ADAPT-01 | Today / adaptive coach | MVP_PLUS | Oui | TODO | CORE-10B | ADAPT-01 | Recommandation quotidienne. | Tests recommandation. | À créer |
| PLUS-03 | Exam preparation V1 | POST_MVP | Oui | TODO | PLUS-01B, PLUS-02, CORE-11B | PLUS-03 | Mode examen réel. | Tests session exam. | À créer |
| GENUI-01 | Controlled GenUI surface | POST_MVP | Oui | TODO | STAB-02B, ADAPT-01, PLUS-01A | GENUI-01 | Payloads GenUI strictement contrôlés. | Tests schema/fallback. | À créer |
| RELEASE-01 | Production readiness | RELEASE | Oui | TODO | QUALITY-00, lots MVP_STABLE requis | RELEASE-01 | CI complète, stockage, monitoring, quotas, secrets. | Checklist release. | À créer |

~~~

### `prisma/schema.prisma`

~~~text
generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
}

model StudentProfile {
  id          String   @id @default(cuid())
  firebaseUid String   @unique
  email       String?
  displayName String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  goals                  RevisionGoal[]
  subjects               Subject[]
  courses                Course[]
  mastery                MasteryState[]
  sessions               ActivitySession[]
  revisionSessions       RevisionSession[]
  revisionSessionActions RevisionSessionAction[]
  summaries              Summary[]
  revisionSheets         RevisionSheet[]
  openQuestions          OpenQuestion[]
  openAnswerEvaluations  OpenAnswerEvaluation[]
  questionBankItems      QuestionBankItem[]
}

model RevisionGoal {
  id            String   @id @default(cuid())
  studentId     String
  targetDate    DateTime
  weeklyMinutes Int
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  student StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@index([studentId, createdAt])
}

model Subject {
  id        String   @id @default(cuid())
  studentId String
  name      String
  priority  Int      @default(3)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  student                StudentProfile          @relation(fields: [studentId], references: [id], onDelete: Cascade)
  courses                Course[]
  documents              Document[]
  knowledgeUnits         KnowledgeUnit[]
  mastery                MasteryState[]
  sessions               ActivitySession[]
  revisionSessions       RevisionSession[]
  revisionSessionActions RevisionSessionAction[]
  summaries              Summary[]
  revisionSheets         RevisionSheet[]
  openQuestions          OpenQuestion[]
  openAnswerEvaluations  OpenAnswerEvaluation[]
  questionBankItems      QuestionBankItem[]

  @@unique([id, studentId])
  @@index([studentId])
}

model Course {
  id               String   @id @default(cuid())
  studentId        String
  subjectId        String
  title            String
  description      String?
  chapterLabel     String?
  estimatedMinutes Int?
  displayOrder     Int      @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  student           StudentProfile     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject           Subject            @relation(fields: [subjectId, studentId], references: [id, studentId], onDelete: Cascade)
  documents         Document[]
  revisionSessions  RevisionSession[]
  questionBankItems QuestionBankItem[]

  @@unique([id, studentId])
  @@index([studentId])
  @@index([subjectId, studentId])
  @@index([subjectId, displayOrder])
}

model Document {
  id             String         @id @default(cuid())
  studentId      String
  subjectId      String
  courseId       String?
  kind           DocumentKind
  fileName       String
  storagePath    String
  mimeType       String
  status         DocumentStatus @default(UPLOADED)
  errorCode      String?
  archivedAt     DateTime?
  archivedReason String?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  subject                Subject                 @relation(fields: [subjectId, studentId], references: [id, studentId], onDelete: Cascade)
  course                 Course?                 @relation(fields: [courseId], references: [id], onDelete: Restrict)
  chunks                 DocumentChunk[]
  knowledgeUnits         KnowledgeUnit[]
  jobs                   DocumentProcessingJob[]
  summaries              Summary[]
  revisionSheets         RevisionSheet[]
  openQuestions          OpenQuestion[]
  revisionSessions       RevisionSession[]
  revisionSessionActions RevisionSessionAction[]
  questionBankItems      QuestionBankItem[]

  @@unique([id, subjectId])
  @@index([studentId])
  @@index([subjectId])
  @@index([courseId])
  @@index([archivedAt])
}

model DocumentProcessingJob {
  id         String    @id @default(cuid())
  documentId String
  status     JobStatus @default(PENDING)
  attempts   Int       @default(0)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
}

model KnowledgeUnit {
  id                      String                   @id @default(cuid())
  subjectId               String
  documentId              String?
  title                   String
  summary                 String
  difficulty              KnowledgeUnitDifficulty?
  displayOrder            Int?
  confidence              Float?
  extractionPromptVersion String?
  extractionSchemaVersion String?
  createdAt               DateTime                 @default(now())
  updatedAt               DateTime                 @updatedAt

  subject                Subject                 @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  document               Document?               @relation(fields: [documentId, subjectId], references: [id, subjectId], onDelete: NoAction)
  mastery                MasteryState[]
  questions              Question[]
  questionBankItems      QuestionBankItem[]
  sessions               ActivitySession[]
  revisionSessions       RevisionSession[]
  revisionSessionActions RevisionSessionAction[]
  sources                KnowledgeUnitSource[]
  openQuestions          OpenQuestion[]

  @@unique([id, subjectId])
  @@index([subjectId])
  @@index([documentId])
}

model DocumentChunk {
  id         String   @id @default(cuid())
  documentId String
  subjectId  String
  index      Int
  text       String
  charStart  Int?
  charEnd    Int?
  pageNumber Int?
  createdAt  DateTime @default(now())

  document                    Document                     @relation(fields: [documentId, subjectId], references: [id, subjectId], onDelete: Cascade)
  sources                     KnowledgeUnitSource[]
  summarySources              SummarySource[]
  revisionSheetSectionSources RevisionSheetSectionSource[]
  questionSources             QuestionSource[]
  questionBankItemSources     QuestionBankItemSource[]
  questionVisualSources       QuestionVisualSource[]
  openQuestionSources         OpenQuestionSource[]

  @@unique([documentId, index])
  @@unique([id, subjectId])
  @@index([documentId])
  @@index([subjectId])
}

model QuestionBankItem {
  id               String                   @id @default(cuid())
  studentId        String
  subjectId        String
  courseId         String
  documentId       String?
  knowledgeUnitId  String
  status           QuestionBankItemStatus   @default(ACTIVE)
  prompt           String
  difficulty       KnowledgeUnitDifficulty?
  choices          Json
  selectionMode    QuestionSelectionMode    @default(SINGLE)
  minSelections    Int?
  maxSelections    Int?
  correctChoiceId  String?
  correctChoiceIds Json?
  explanation      String
  fingerprint      String
  askedCount       Int                      @default(0)
  lastAskedAt      DateTime?
  flaggedAt        DateTime?
  flagReason       String?
  createdAt        DateTime                 @default(now())
  updatedAt        DateTime                 @updatedAt

  student          StudentProfile           @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject          Subject                  @relation(fields: [subjectId, studentId], references: [id, studentId], onDelete: Cascade)
  course           Course                   @relation(fields: [courseId, studentId], references: [id, studentId], onDelete: Cascade)
  document         Document?                @relation(fields: [documentId, subjectId], references: [id, subjectId], onDelete: NoAction)
  knowledgeUnit    KnowledgeUnit            @relation(fields: [knowledgeUnitId, subjectId], references: [id, subjectId], onDelete: Cascade)
  sessionQuestions Question[]
  sources          QuestionBankItemSource[]
  visuals          QuestionBankItemVisual[]

  @@unique([courseId, fingerprint])
  @@unique([id, subjectId])
  @@index([studentId])
  @@index([subjectId])
  @@index([courseId, status])
  @@index([knowledgeUnitId])
  @@index([askedCount])
}

model QuestionBankItemSource {
  questionBankItemId String
  subjectId          String
  chunkId            String
  relevanceScore     Float?
  createdAt          DateTime @default(now())

  questionBankItem QuestionBankItem @relation(fields: [questionBankItemId, subjectId], references: [id, subjectId], onDelete: Cascade)
  chunk            DocumentChunk    @relation(fields: [chunkId, subjectId], references: [id, subjectId], onDelete: Cascade)

  @@id([questionBankItemId, chunkId])
  @@index([chunkId])
  @@index([subjectId])
}

model QuestionBankItemVisual {
  id                 String             @id @default(cuid())
  questionBankItemId String
  type               QuestionVisualType
  displayOrder       Int                @default(0)
  payload            Json
  createdAt          DateTime           @default(now())

  questionBankItem QuestionBankItem @relation(fields: [questionBankItemId], references: [id], onDelete: Cascade)

  @@unique([questionBankItemId, displayOrder])
  @@index([questionBankItemId])
}

model KnowledgeUnitSource {
  knowledgeUnitId String
  subjectId       String
  chunkId         String
  relevanceScore  Float?
  createdAt       DateTime @default(now())

  knowledgeUnit KnowledgeUnit @relation(fields: [knowledgeUnitId, subjectId], references: [id, subjectId], onDelete: Cascade)
  chunk         DocumentChunk @relation(fields: [chunkId, subjectId], references: [id, subjectId], onDelete: Cascade)

  @@id([knowledgeUnitId, chunkId])
  @@index([chunkId])
  @@index([subjectId])
}

model Summary {
  id             String                      @id @default(cuid())
  documentId     String
  subjectId      String
  studentId      String
  status         StudyArtifactStatus
  title          String?
  content        String?
  keyPoints      Json?
  limits         String?
  createdAt      DateTime                    @default(now())
  updatedAt      DateTime                    @updatedAt
  generatedAt    DateTime
  flowName       String
  provider       String
  model          String
  promptVersion  String
  schemaVersion  String
  inputSize      Int?
  sourceStrategy StudyArtifactSourceStrategy
  errorCode      String?

  student  StudentProfile  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject  Subject         @relation(fields: [subjectId, studentId], references: [id, studentId], onDelete: Cascade)
  document Document        @relation(fields: [documentId, subjectId], references: [id, subjectId], onDelete: Cascade)
  sources  SummarySource[]

  @@unique([documentId])
  @@unique([id, subjectId])
  @@index([studentId])
  @@index([subjectId])
}

model SummarySource {
  summaryId      String
  subjectId      String
  chunkId        String
  relevanceScore Float?
  createdAt      DateTime @default(now())

  summary Summary       @relation(fields: [summaryId, subjectId], references: [id, subjectId], onDelete: Cascade)
  chunk   DocumentChunk @relation(fields: [chunkId, subjectId], references: [id, subjectId], onDelete: Cascade)

  @@id([summaryId, chunkId])
  @@index([chunkId])
  @@index([subjectId])
}

model RevisionSheet {
  id                  String                      @id @default(cuid())
  documentId          String
  subjectId           String
  studentId           String
  status              StudyArtifactStatus
  title               String?
  introduction        String?
  keyPoints           Json?
  commonMistakes      Json?
  mustKnow            Json?
  practiceSuggestions Json?
  createdAt           DateTime                    @default(now())
  updatedAt           DateTime                    @updatedAt
  generatedAt         DateTime
  flowName            String
  provider            String
  model               String
  promptVersion       String
  schemaVersion       String
  inputSize           Int?
  sourceStrategy      StudyArtifactSourceStrategy
  errorCode           String?

  student  StudentProfile         @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject  Subject                @relation(fields: [subjectId, studentId], references: [id, studentId], onDelete: Cascade)
  document Document               @relation(fields: [documentId, subjectId], references: [id, subjectId], onDelete: Cascade)
  sections RevisionSheetSection[]

  @@unique([documentId])
  @@unique([id, subjectId])
  @@index([studentId])
  @@index([subjectId])
}

model RevisionSheetSection {
  id              String   @id @default(cuid())
  revisionSheetId String
  subjectId       String
  displayOrder    Int
  title           String
  content         String
  createdAt       DateTime @default(now())

  revisionSheet RevisionSheet                @relation(fields: [revisionSheetId, subjectId], references: [id, subjectId], onDelete: Cascade)
  sources       RevisionSheetSectionSource[]

  @@unique([revisionSheetId, displayOrder])
  @@unique([id, subjectId])
  @@index([subjectId])
}

model RevisionSheetSectionSource {
  sectionId      String
  subjectId      String
  chunkId        String
  relevanceScore Float?
  createdAt      DateTime @default(now())

  section RevisionSheetSection @relation(fields: [sectionId, subjectId], references: [id, subjectId], onDelete: Cascade)
  chunk   DocumentChunk        @relation(fields: [chunkId, subjectId], references: [id, subjectId], onDelete: Cascade)

  @@id([sectionId, chunkId])
  @@index([chunkId])
  @@index([subjectId])
}

model MasteryState {
  studentId       String
  subjectId       String
  knowledgeUnitId String
  score           Float
  lastPracticedAt DateTime?
  updatedAt       DateTime  @updatedAt

  student       StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject       Subject        @relation(fields: [subjectId, studentId], references: [id, studentId], onDelete: Cascade)
  knowledgeUnit KnowledgeUnit  @relation(fields: [knowledgeUnitId, subjectId], references: [id, subjectId], onDelete: Cascade)

  @@id([studentId, knowledgeUnitId])
  @@index([subjectId, studentId])
  @@index([knowledgeUnitId, subjectId])
}

model ActivitySession {
  id                      String         @id @default(cuid())
  studentId               String
  subjectId               String
  knowledgeUnitId         String
  version                 Int            @default(1)
  documentId              String?
  generationFlowName      String?
  generationProvider      String?
  generationModel         String?
  generationPromptVersion String?
  generationSchemaVersion String?
  generationInputSize     Int?
  type                    ActivityType
  status                  ActivityStatus @default(STARTED)
  createdAt               DateTime       @default(now())
  completedAt             DateTime?

  student                   StudentProfile             @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject                   Subject                    @relation(fields: [subjectId, studentId], references: [id, studentId], onDelete: Cascade)
  knowledgeUnit             KnowledgeUnit              @relation(fields: [knowledgeUnitId, subjectId], references: [id, subjectId], onDelete: Cascade)
  questions                 Question[]
  result                    ActivityResult?
  answers                   QuestionAnswer[]
  openQuestion              OpenQuestion?
  openAnswerEvaluation      OpenAnswerEvaluation?
  richClosedExercisePayload RichClosedExercisePayload?
  richClosedExerciseResult  RichClosedExerciseResult?
  revisionSessionActions    RevisionSessionAction[]

  @@unique([id, knowledgeUnitId])
  @@index([studentId])
  @@index([subjectId])
  @@index([documentId])
  @@index([knowledgeUnitId])
}

model Question {
  id               String                   @id @default(cuid())
  sessionId        String
  bankQuestionId   String?
  subjectId        String?
  documentId       String?
  knowledgeUnitId  String
  prompt           String
  difficulty       KnowledgeUnitDifficulty?
  displayOrder     Int                      @default(0)
  choices          Json
  selectionMode    QuestionSelectionMode    @default(SINGLE)
  minSelections    Int?
  maxSelections    Int?
  correctChoiceId  String?
  correctChoiceIds Json?
  explanation      String

  session       ActivitySession   @relation(fields: [sessionId, knowledgeUnitId], references: [id, knowledgeUnitId], onDelete: Cascade)
  bankQuestion  QuestionBankItem? @relation(fields: [bankQuestionId], references: [id], onDelete: NoAction)
  knowledgeUnit KnowledgeUnit     @relation(fields: [knowledgeUnitId], references: [id], onDelete: Cascade)
  sources       QuestionSource[]
  answers       QuestionAnswer[]
  visuals       QuestionVisual[]

  @@unique([id, subjectId])
  @@index([sessionId])
  @@index([bankQuestionId])
  @@index([subjectId])
  @@index([documentId])
}

model QuestionSource {
  questionId     String
  subjectId      String
  chunkId        String
  relevanceScore Float?
  createdAt      DateTime @default(now())

  question Question      @relation(fields: [questionId], references: [id], onDelete: Cascade)
  chunk    DocumentChunk @relation(fields: [chunkId, subjectId], references: [id, subjectId], onDelete: Cascade)

  @@id([questionId, chunkId])
  @@index([chunkId])
  @@index([subjectId])
}

model QuestionVisual {
  id           String             @id @default(cuid())
  questionId   String
  type         QuestionVisualType
  displayOrder Int                @default(0)
  payload      Json
  createdAt    DateTime           @default(now())

  question Question               @relation(fields: [questionId], references: [id], onDelete: Cascade)
  sources  QuestionVisualSource[]

  @@unique([questionId, displayOrder])
  @@index([questionId])
}

model QuestionVisualSource {
  visualId       String
  subjectId      String
  chunkId        String
  relevanceScore Float?
  createdAt      DateTime @default(now())

  visual QuestionVisual @relation(fields: [visualId], references: [id], onDelete: Cascade)
  chunk  DocumentChunk  @relation(fields: [chunkId, subjectId], references: [id, subjectId], onDelete: Cascade)

  @@id([visualId, chunkId])
  @@index([chunkId])
  @@index([subjectId])
}

model QuestionAnswer {
  id               String   @id @default(cuid())
  sessionId        String
  questionId       String
  selectedChoiceId String?
  isCorrect        Boolean
  createdAt        DateTime @default(now())

  session         ActivitySession        @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  question        Question               @relation(fields: [questionId], references: [id], onDelete: Cascade)
  selectedChoices QuestionAnswerChoice[]

  @@unique([sessionId, questionId])
  @@index([questionId])
}

model QuestionAnswerChoice {
  answerId String
  choiceId String

  answer QuestionAnswer @relation(fields: [answerId], references: [id], onDelete: Cascade)

  @@id([answerId, choiceId])
}

model ActivityResult {
  id             String   @id @default(cuid())
  sessionId      String   @unique
  correctAnswers Int
  totalQuestions Int
  score          Float?
  createdAt      DateTime @default(now())

  session ActivitySession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}

model OpenQuestion {
  id              String   @id @default(cuid())
  sessionId       String   @unique
  studentId       String
  subjectId       String
  documentId      String?
  knowledgeUnitId String
  prompt          String
  instructions    String?
  maxAnswerLength Int      @default(4000)
  version         Int      @default(1)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  session       ActivitySession        @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  student       StudentProfile         @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject       Subject                @relation(fields: [subjectId, studentId], references: [id, studentId], onDelete: Cascade)
  document      Document?              @relation(fields: [documentId, subjectId], references: [id, subjectId], onDelete: NoAction)
  knowledgeUnit KnowledgeUnit          @relation(fields: [knowledgeUnitId, subjectId], references: [id, subjectId], onDelete: Cascade)
  sources       OpenQuestionSource[]
  evaluations   OpenAnswerEvaluation[]

  @@unique([id, subjectId])
  @@index([studentId])
  @@index([subjectId])
  @@index([documentId])
  @@index([knowledgeUnitId])
}

model OpenQuestionSource {
  questionId     String
  subjectId      String
  chunkId        String
  relevanceScore Float?
  createdAt      DateTime @default(now())

  question OpenQuestion  @relation(fields: [questionId, subjectId], references: [id, subjectId], onDelete: Cascade)
  chunk    DocumentChunk @relation(fields: [chunkId, subjectId], references: [id, subjectId], onDelete: Cascade)

  @@id([questionId, chunkId])
  @@index([chunkId])
  @@index([subjectId])
}

model OpenAnswerEvaluation {
  id                      String                     @id @default(cuid())
  sessionId               String                     @unique
  openQuestionId          String
  studentId               String
  subjectId               String
  answerText              String
  status                  OpenAnswerEvaluationStatus @default(PENDING)
  score                   Float?
  maxScore                Float?
  feedback                String?
  presentPoints           Json?
  missingPoints           Json?
  errors                  Json?
  modelAnswer             String?
  advice                  String?
  generationFlowName      String?
  generationProvider      String?
  generationModel         String?
  generationPromptVersion String?
  generationSchemaVersion String?
  generationInputSize     Int?
  errorCode               String?
  createdAt               DateTime                   @default(now())
  updatedAt               DateTime                   @updatedAt

  session      ActivitySession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  openQuestion OpenQuestion    @relation(fields: [openQuestionId, subjectId], references: [id, subjectId], onDelete: Cascade)
  student      StudentProfile  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject      Subject         @relation(fields: [subjectId, studentId], references: [id, studentId], onDelete: Cascade)

  @@index([studentId])
  @@index([subjectId])
  @@index([openQuestionId])
}

model RichClosedExercisePayload {
  id                 String   @id @default(cuid())
  activitySessionId  String   @unique
  version            String
  title              String
  subjectId          String
  documentId         String?
  knowledgeUnitId    String
  exercisePayload    Json
  generationMetadata Json?
  qualityMetrics     Json?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  session ActivitySession @relation(fields: [activitySessionId], references: [id], onDelete: Cascade)

  @@index([subjectId])
  @@index([documentId])
  @@index([knowledgeUnitId])
}

model RichClosedExerciseResult {
  id                String   @id @default(cuid())
  activitySessionId String   @unique
  answersPayload    Json
  correctionPayload Json
  correctAnswers    Int
  totalQuestions    Int
  score             Float
  createdAt         DateTime @default(now())

  session ActivitySession @relation(fields: [activitySessionId], references: [id], onDelete: Cascade)
}

model RevisionSession {
  id              String                @id @default(cuid())
  studentId       String
  subjectId       String
  courseId        String?
  documentId      String?
  knowledgeUnitId String?
  mode            RevisionSessionMode   @default(QUICK)
  status          RevisionSessionStatus @default(STARTED)
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt
  completedAt     DateTime?

  student       StudentProfile          @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject       Subject                 @relation(fields: [subjectId, studentId], references: [id, studentId], onDelete: Cascade)
  course        Course?                 @relation(fields: [courseId, studentId], references: [id, studentId], onDelete: NoAction)
  document      Document?               @relation(fields: [documentId, subjectId], references: [id, subjectId], onDelete: NoAction)
  knowledgeUnit KnowledgeUnit?          @relation(fields: [knowledgeUnitId, subjectId], references: [id, subjectId], onDelete: NoAction)
  actions       RevisionSessionAction[]

  @@unique([id, studentId])
  @@index([studentId])
  @@index([subjectId])
  @@index([courseId])
  @@index([documentId])
  @@index([knowledgeUnitId])
}

model RevisionSessionAction {
  id                String                      @id @default(cuid())
  sessionId         String
  studentId         String
  subjectId         String
  kind              RevisionSessionActionKind
  status            RevisionSessionActionStatus @default(READY)
  displayOrder      Int                         @default(0)
  activitySessionId String?
  documentId        String?
  knowledgeUnitId   String?
  createdAt         DateTime                    @default(now())
  completedAt       DateTime?

  session         RevisionSession  @relation(fields: [sessionId, studentId], references: [id, studentId], onDelete: Cascade)
  student         StudentProfile   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject         Subject          @relation(fields: [subjectId, studentId], references: [id, studentId], onDelete: Cascade)
  activitySession ActivitySession? @relation(fields: [activitySessionId], references: [id], onDelete: NoAction)
  document        Document?        @relation(fields: [documentId, subjectId], references: [id, subjectId], onDelete: NoAction)
  knowledgeUnit   KnowledgeUnit?   @relation(fields: [knowledgeUnitId, subjectId], references: [id, subjectId], onDelete: NoAction)

  @@unique([sessionId, displayOrder])
  @@index([studentId])
  @@index([subjectId])
  @@index([activitySessionId])
  @@index([documentId])
  @@index([knowledgeUnitId])
}

enum DocumentKind {
  COURSE_PDF
  EXAM_PDF
  EXAM_IMAGE
}

enum DocumentStatus {
  UPLOADED
  PROCESSING
  READY
  FAILED
}

enum KnowledgeUnitDifficulty {
  LOW
  MEDIUM
  HIGH
}

enum StudyArtifactStatus {
  READY
  FAILED
}

enum StudyArtifactSourceStrategy {
  DOCUMENT_CHUNKS
  DOCUMENT_CHUNKS_AND_KNOWLEDGE_UNITS
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

enum ActivityType {
  DIAGNOSTIC_QUIZ
  OPEN_QUESTION
  RICH_CLOSED_EXERCISE
}

enum ActivityStatus {
  STARTED
  SUBMITTED
  COMPLETED
}

enum RevisionSessionStatus {
  STARTED
  COMPLETED
  ABANDONED
}

enum RevisionSessionMode {
  QUICK
  DEEP
  EXAM
}

enum RevisionSessionActionKind {
  DIAGNOSTIC_QUIZ
  OPEN_QUESTION
  RICH_CLOSED_EXERCISE
}

enum RevisionSessionActionStatus {
  READY
  COMPLETED
  FAILED
}

enum OpenAnswerEvaluationStatus {
  PENDING
  READY
  FAILED
}

enum QuestionSelectionMode {
  SINGLE
  MULTIPLE
}

enum QuestionVisualType {
  IMAGE
  CHART
  DIAGRAM
}

enum QuestionBankItemStatus {
  ACTIVE
  FLAGGED
  ARCHIVED
}

~~~

### `prisma/migrations/20260621190000_source_lifecycle_archive/migration.sql`

~~~text
ALTER TABLE "Document" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN "archivedReason" TEXT;

CREATE INDEX "Document_archivedAt_idx" ON "Document"("archivedAt");

~~~

### `src/modules/courses/application/course-source-lifecycle.use-case.spec.ts`

~~~text
import { NotFoundException } from '@nestjs/common';
import type { DocumentsRepository } from '../../documents/application/documents.repository';
import type { SourceLifecycleDecision } from '../../documents/domain/source-lifecycle.entity';
import type { CoursesRepository } from './courses.repository';
import {
  ArchiveCourseSourceUseCase,
  GetCourseSourceLifecycleUseCase,
} from './course-source-lifecycle.use-case';

describe('Course source lifecycle use cases', () => {
  it('loads lifecycle only after checking course ownership', async () => {
    const { coursesRepository, documentsRepository, getUseCase } =
      createUseCases();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      courseOwnership(),
    );
    documentsRepository.getLifecycleDecisionForStudent.mockResolvedValue(
      lifecycleDecision(),
    );

    await expect(
      getUseCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-1',
      }),
    ).resolves.toEqual(lifecycleDecision());

    expect(coursesRepository.findCourseOwnershipContext).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
    });
    expect(
      documentsRepository.getLifecycleDecisionForStudent,
    ).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      documentId: 'document-1',
    });
  });

  it('archives only after checking course ownership', async () => {
    const { coursesRepository, documentsRepository, archiveUseCase } =
      createUseCases();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      courseOwnership(),
    );
    documentsRepository.archiveForStudent.mockResolvedValue(
      lifecycleDecision({
        status: 'ARCHIVED',
        recommendedAction: 'BLOCK',
        canArchive: false,
      }),
    );

    await expect(
      archiveUseCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-1',
      }),
    ).resolves.toMatchObject({
      documentId: 'document-1',
      status: 'ARCHIVED',
    });

    expect(documentsRepository.archiveForStudent).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      documentId: 'document-1',
      reason: 'USER_ARCHIVED_COURSE_SOURCE',
    });
  });

  it('rejects lifecycle reads for courses outside the student ownership', async () => {
    const { coursesRepository, documentsRepository, getUseCase } =
      createUseCases();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(null);

    await expect(
      getUseCase.execute({
        studentId: 'student-1',
        courseId: 'course-2',
        documentId: 'document-1',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(
      documentsRepository.getLifecycleDecisionForStudent,
    ).not.toHaveBeenCalled();
  });

  it('maps a missing course document lifecycle to 404', async () => {
    const { coursesRepository, documentsRepository, getUseCase } =
      createUseCases();
    coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      courseOwnership(),
    );
    documentsRepository.getLifecycleDecisionForStudent.mockResolvedValue(null);

    await expect(
      getUseCase.execute({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-other',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});

function createUseCases() {
  const coursesRepository = {
    findCourseOwnershipContext: jest.fn(),
  };
  const documentsRepository = {
    getLifecycleDecisionForStudent: jest.fn(),
    archiveForStudent: jest.fn(),
  };

  return {
    coursesRepository,
    documentsRepository,
    getUseCase: new GetCourseSourceLifecycleUseCase(
      coursesRepository as unknown as CoursesRepository,
      documentsRepository as unknown as DocumentsRepository,
    ),
    archiveUseCase: new ArchiveCourseSourceUseCase(
      coursesRepository as unknown as CoursesRepository,
      documentsRepository as unknown as DocumentsRepository,
    ),
  };
}

function courseOwnership() {
  return {
    courseId: 'course-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
  };
}

function lifecycleDecision(
  overrides: Partial<SourceLifecycleDecision> = {},
): SourceLifecycleDecision {
  return {
    documentId: 'document-1',
    courseId: 'course-1',
    status: 'ACTIVE',
    recommendedAction: 'ARCHIVE',
    canDelete: false,
    canArchive: true,
    blockingReasons: ['HAS_KNOWLEDGE_UNITS'],
    userMessage: 'Cette source peut etre archivee.',
    ...overrides,
  };
}

~~~

### `src/modules/courses/application/course-source-lifecycle.use-case.ts`

~~~text
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  COURSES_REPOSITORY,
  type CoursesRepository,
} from './courses.repository';
import {
  DOCUMENTS_REPOSITORY,
  type DocumentsRepository,
} from '../../documents/application/documents.repository';
import type { SourceLifecycleDecision } from '../../documents/domain/source-lifecycle.entity';

@Injectable()
export class GetCourseSourceLifecycleUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
    documentId: string;
  }): Promise<SourceLifecycleDecision> {
    await this.ensureCourseOwned(input);

    const decision =
      await this.documentsRepository.getLifecycleDecisionForStudent(input);

    if (!decision) {
      throw new NotFoundException('Course source not found');
    }

    return decision;
  }

  private async ensureCourseOwned(input: {
    studentId: string;
    courseId: string;
  }): Promise<void> {
    const course = await this.coursesRepository.findCourseOwnershipContext({
      studentId: input.studentId,
      courseId: input.courseId,
    });

    if (!course) {
      throw new NotFoundException('Course source not found');
    }
  }
}

@Injectable()
export class ArchiveCourseSourceUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
    documentId: string;
  }): Promise<SourceLifecycleDecision> {
    const course = await this.coursesRepository.findCourseOwnershipContext({
      studentId: input.studentId,
      courseId: input.courseId,
    });

    if (!course) {
      throw new NotFoundException('Course source not found');
    }

    const decision = await this.documentsRepository.archiveForStudent({
      ...input,
      reason: 'USER_ARCHIVED_COURSE_SOURCE',
    });

    if (!decision) {
      throw new NotFoundException('Course source not found');
    }

    return decision;
  }
}

~~~

### `src/modules/courses/courses.module.ts`

~~~text
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { ActivitiesModule } from '../activities/activities.module';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { JobsModule } from '../jobs/jobs.module';
import { RevisionSessionsModule } from '../revision-sessions/revision-sessions.module';
import { StudyArtifactsModule } from '../study-artifacts/study-artifacts.module';
import { BackfillCoursesFromDocumentsDryRunUseCase } from './application/backfill-courses-from-documents.use-case';
import {
  GenerateCourseRevisionSheetUseCase,
  GetCourseRevisionSheetUseCase,
} from './application/course-revision-sheet.use-case';
import {
  GetCourseProgressUseCase,
  GetSubjectProgressUseCase,
} from './application/course-progress.use-case';
import {
  ArchiveCourseSourceUseCase,
  GetCourseSourceLifecycleUseCase,
} from './application/course-source-lifecycle.use-case';
import { COURSES_REPOSITORY } from './application/courses.repository';
import { CreateCourseUseCase } from './application/create-course.use-case';
import { DeleteCourseDocumentUseCase } from './application/delete-course-document.use-case';
import { DeleteCourseUseCase } from './application/delete-course.use-case';
import { GetCourseDetailUseCase } from './application/get-course-detail.use-case';
import { GetCourseUseCase } from './application/get-course.use-case';
import { ListSubjectCoursesWithStatsUseCase } from './application/list-subject-courses-with-stats.use-case';
import { ListSubjectCoursesUseCase } from './application/list-subject-courses.use-case';
import { StartCourseQuickRevisionSessionUseCase } from './application/start-course-quick-revision-session.use-case';
import { UploadCoursePdfForCourseUseCase } from './application/upload-course-pdf-for-course.use-case';
import { PrismaCoursesRepository } from './infrastructure/prisma-courses.repository';
import { CoursesController } from './interfaces/courses.controller';

@Module({
  imports: [
    ActivitiesModule,
    AuthModule,
    DocumentsModule,
    JobsModule,
    PrismaModule,
    RevisionSessionsModule,
    StudyArtifactsModule,
  ],
  controllers: [CoursesController],
  providers: [
    CreateCourseUseCase,
    ListSubjectCoursesUseCase,
    ListSubjectCoursesWithStatsUseCase,
    GetCourseUseCase,
    GetCourseDetailUseCase,
    DeleteCourseUseCase,
    DeleteCourseDocumentUseCase,
    GetCourseSourceLifecycleUseCase,
    ArchiveCourseSourceUseCase,
    BackfillCoursesFromDocumentsDryRunUseCase,
    UploadCoursePdfForCourseUseCase,
    GetCourseRevisionSheetUseCase,
    GenerateCourseRevisionSheetUseCase,
    StartCourseQuickRevisionSessionUseCase,
    GetCourseProgressUseCase,
    GetSubjectProgressUseCase,
    {
      provide: COURSES_REPOSITORY,
      useClass: PrismaCoursesRepository,
    },
  ],
  exports: [
    CreateCourseUseCase,
    ListSubjectCoursesUseCase,
    ListSubjectCoursesWithStatsUseCase,
    GetCourseUseCase,
    GetCourseDetailUseCase,
    DeleteCourseUseCase,
    DeleteCourseDocumentUseCase,
    GetCourseSourceLifecycleUseCase,
    ArchiveCourseSourceUseCase,
    BackfillCoursesFromDocumentsDryRunUseCase,
    UploadCoursePdfForCourseUseCase,
    GetCourseRevisionSheetUseCase,
    GenerateCourseRevisionSheetUseCase,
    StartCourseQuickRevisionSessionUseCase,
    GetCourseProgressUseCase,
    GetSubjectProgressUseCase,
    COURSES_REPOSITORY,
  ],
})
export class CoursesModule {}

~~~

### `src/modules/courses/infrastructure/prisma-courses.repository.spec.ts`

~~~text
import { PrismaCoursesRepository } from './prisma-courses.repository';

describe('PrismaCoursesRepository', () => {
  it('creates a course only when the subject belongs to the student', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      Promise.resolve(callback(prisma)),
    );
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.course.aggregate.mockResolvedValue({ _max: { displayOrder: 1 } });
    prisma.course.create.mockResolvedValue(courseRecord({ displayOrder: 2 }));

    const result = await repository.create({
      studentId: 'student-1',
      subjectId: 'subject-1',
      title: 'Loi normale',
      description: null,
      chapterLabel: 'Chapitre 3',
      estimatedMinutes: 20,
    });

    expect(prisma.subject.findFirst).toHaveBeenCalledWith({
      where: { id: 'subject-1', studentId: 'student-1' },
      select: { id: true },
    });
    expect(prisma.course.create).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        title: 'Loi normale',
        description: null,
        chapterLabel: 'Chapitre 3',
        estimatedMinutes: 20,
        displayOrder: 2,
      },
    });
    expect(result.displayOrder).toBe(2);
  });

  it('refuses course creation for a subject owned by another student', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      Promise.resolve(callback(prisma)),
    );
    prisma.subject.findFirst.mockResolvedValue(null);

    await expect(
      repository.create({
        studentId: 'student-2',
        subjectId: 'subject-1',
        title: 'Loi normale',
      }),
    ).rejects.toThrow('Course subject not found');

    expect(prisma.course.create).not.toHaveBeenCalled();
  });

  it('lists courses for one owned subject sorted by display order and creation date', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.course.findMany.mockResolvedValue([
      courseRecord({ id: 'course-1' }),
      courseRecord({ id: 'course-2', title: 'Loi binomiale' }),
    ]);

    const result = await repository.listBySubjectForStudent({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });

    expect(prisma.course.findMany).toHaveBeenCalledWith({
      where: { studentId: 'student-1', subjectId: 'subject-1' },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
    expect(result.map((course) => course.id)).toEqual(['course-1', 'course-2']);
  });

  it('does not return a course owned by another student', async () => {
    const { prisma, repository } = createRepository();
    prisma.course.findFirst.mockResolvedValue(null);

    await expect(
      repository.findByIdForStudent({
        studentId: 'student-2',
        courseId: 'course-1',
      }),
    ).resolves.toBeNull();

    expect(prisma.course.findFirst).toHaveBeenCalledWith({
      where: { id: 'course-1', studentId: 'student-2' },
    });
  });

  it('allows duplicate titles in the same subject', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      Promise.resolve(callback(prisma)),
    );
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.course.aggregate.mockResolvedValue({ _max: { displayOrder: 0 } });
    prisma.course.create
      .mockResolvedValueOnce(courseRecord({ id: 'course-1', displayOrder: 1 }))
      .mockResolvedValueOnce(courseRecord({ id: 'course-2', displayOrder: 2 }));

    await repository.create({
      studentId: 'student-1',
      subjectId: 'subject-1',
      title: 'Loi normale',
    });
    await repository.create({
      studentId: 'student-1',
      subjectId: 'subject-1',
      title: 'Loi normale',
    });

    expect(prisma.course.create).toHaveBeenCalledTimes(2);
  });

  it('deletes an empty course without deleting documents', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      Promise.resolve(callback(prisma)),
    );
    prisma.course.findFirst.mockResolvedValue(courseRecord());
    prisma.document.count.mockResolvedValue(0);
    prisma.course.delete.mockResolvedValue(courseRecord());

    await expect(
      repository.deleteIfEmpty({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).resolves.toBe(true);

    expect(prisma.document.count).toHaveBeenCalledWith({
      where: { courseId: 'course-1', studentId: 'student-1' },
    });
    expect(prisma.course.delete).toHaveBeenCalledWith({
      where: { id: 'course-1' },
    });
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
    expect(prisma.document.deleteMany).not.toHaveBeenCalled();
  });

  it('refuses to delete a course containing documents', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      Promise.resolve(callback(prisma)),
    );
    prisma.course.findFirst.mockResolvedValue(courseRecord());
    prisma.document.count.mockResolvedValue(1);

    await expect(
      repository.deleteIfEmpty({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).rejects.toThrow('Course contains documents');

    expect(prisma.course.delete).not.toHaveBeenCalled();
  });

  it('keeps document/course ownership coherent when attaching a document', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      Promise.resolve(callback(prisma)),
    );
    prisma.course.findFirst.mockResolvedValue(courseRecord());
    prisma.document.findFirst.mockResolvedValue(
      documentRecord({ subjectId: 'subject-1' }),
    );
    prisma.document.update.mockResolvedValue(
      documentRecord({ courseId: 'course-1' }),
    );

    await expect(
      repository.attachDocumentToCourse({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-1',
      }),
    ).resolves.toMatchObject({
      id: 'document-1',
      courseId: 'course-1',
      subjectId: 'subject-1',
    });

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'document-1' },
      data: { courseId: 'course-1' },
    });
  });

  it('refuses to attach a document to a course from another subject', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      Promise.resolve(callback(prisma)),
    );
    prisma.course.findFirst.mockResolvedValue(courseRecord());
    prisma.document.findFirst.mockResolvedValue(
      documentRecord({ subjectId: 'subject-2' }),
    );

    await expect(
      repository.attachDocumentToCourse({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-1',
      }),
    ).rejects.toThrow('Document subject does not match course');

    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it('refuses to attach a document owned by another student', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      Promise.resolve(callback(prisma)),
    );
    prisma.course.findFirst.mockResolvedValue(courseRecord());
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(
      repository.attachDocumentToCourse({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-2',
      }),
    ).rejects.toThrow('Document not found');

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: { id: 'document-2', studentId: 'student-1' },
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        courseId: true,
        fileName: true,
      },
    });
  });

  it('rejects course detail documents missing courseId instead of returning an empty courseId', async () => {
    const { prisma, repository } = createRepository();
    prisma.course.findFirst.mockResolvedValue(
      courseRecord({
        subject: { id: 'subject-1', name: 'Droit constitutionnel' },
        documents: [
          {
            id: 'document-1',
            courseId: null,
            fileName: 'cours.pdf',
            kind: 'COURSE_PDF',
            status: 'READY',
            errorCode: null,
            createdAt: new Date('2026-06-18T12:00:00.000Z'),
            updatedAt: new Date('2026-06-18T12:00:00.000Z'),
          },
        ],
      }),
    );

    await expect(
      repository.findDetailByIdForStudent({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).rejects.toThrow('Attached course document is missing courseId');
  });

  it('selects the first READY course PDF source deterministically', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(
      documentRecord({
        id: 'document-ready-1',
        courseId: 'course-1',
        kind: 'COURSE_PDF',
        status: 'READY',
        errorCode: null,
        createdAt: new Date('2026-06-18T10:00:00.000Z'),
        updatedAt: new Date('2026-06-18T10:00:00.000Z'),
      }),
    );

    await expect(
      repository.findFirstReadyCoursePdfDocumentForCourse({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).resolves.toMatchObject({
      id: 'document-ready-1',
      documentId: 'document-ready-1',
      courseId: 'course-1',
      kind: 'COURSE_PDF',
      status: 'READY',
    });

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        courseId: 'course-1',
        kind: 'COURSE_PDF',
        status: 'READY',
        archivedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        courseId: true,
        fileName: true,
        kind: true,
        status: true,
        errorCode: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('returns null when a course has no READY course PDF source', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(
      repository.findFirstReadyCoursePdfDocumentForCourse({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).resolves.toBeNull();
  });

  it('selects a quick revision knowledge unit from the READY course document', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      knowledgeUnitRecord({
        id: 'unit-strong',
        displayOrder: 0,
        mastery: [{ score: 0.8, lastPracticedAt: null }],
      }),
      knowledgeUnitRecord({
        id: 'unit-weak',
        displayOrder: 1,
        mastery: [
          {
            score: 0.2,
            lastPracticedAt: new Date('2026-06-10T10:00:00.000Z'),
          },
        ],
      }),
    ]);

    await expect(
      repository.findFirstQuickRevisionKnowledgeUnitForCourseDocument({
        studentId: 'student-1',
        courseId: 'course-1',
        subjectId: 'subject-1',
        documentId: 'document-ready-1',
      }),
    ).resolves.toMatchObject({
      id: 'unit-weak',
      subjectId: 'subject-1',
      documentId: 'document-ready-1',
    });

    expect(prisma.knowledgeUnit.findMany).toHaveBeenCalledWith({
      where: {
        subjectId: 'subject-1',
        documentId: 'document-ready-1',
        subject: { studentId: 'student-1' },
        document: {
          id: 'document-ready-1',
          studentId: 'student-1',
          subjectId: 'subject-1',
          courseId: 'course-1',
          kind: 'COURSE_PDF',
          status: 'READY',
          archivedAt: null,
        },
      },
      select: {
        id: true,
        subjectId: true,
        documentId: true,
        title: true,
        displayOrder: true,
        createdAt: true,
        mastery: {
          where: { studentId: 'student-1' },
          select: { score: true, lastPracticedAt: true },
          take: 1,
        },
      },
    });
  });

  it('returns null when a READY course document has no knowledge unit', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findMany.mockResolvedValue([]);

    await expect(
      repository.findFirstQuickRevisionKnowledgeUnitForCourseDocument({
        studentId: 'student-1',
        courseId: 'course-1',
        subjectId: 'subject-1',
        documentId: 'document-ready-1',
      }),
    ).resolves.toBeNull();
  });

  it('computes course progress from READY course PDF knowledge units only', async () => {
    const { prisma, repository } = createRepository();
    prisma.course.findFirst.mockResolvedValue(courseRecord());
    prisma.document.findMany.mockResolvedValue([
      progressDocument({ id: 'ready-doc', status: 'READY' }),
      progressDocument({ id: 'uploaded-doc', status: 'UPLOADED' }),
      progressDocument({ id: 'failed-doc', status: 'FAILED' }),
    ]);
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      progressKnowledgeUnit({
        id: 'unit-1',
        documentId: 'ready-doc',
        mastery: [
          {
            score: 0.8,
            lastPracticedAt: new Date('2026-06-18T10:00:00.000Z'),
          },
        ],
      }),
      progressKnowledgeUnit({
        id: 'unit-2',
        documentId: 'ready-doc',
        mastery: [
          {
            score: 0.6,
            lastPracticedAt: new Date('2026-06-18T12:00:00.000Z'),
          },
        ],
      }),
      progressKnowledgeUnit({
        id: 'unit-3',
        documentId: 'ready-doc',
        mastery: [],
      }),
      progressKnowledgeUnit({
        id: 'unit-4',
        documentId: 'ready-doc',
        mastery: [],
      }),
    ]);

    await expect(
      repository.findCourseProgressByIdForStudent({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).resolves.toEqual({
      courseId: 'course-1',
      subjectId: 'subject-1',
      knowledgeUnitCount: 4,
      practicedKnowledgeUnitCount: 2,
      coverage: 0.5,
      mastery: 0.7,
      estimatedGlobalMastery: 0.35,
      readySourceCount: 1,
      processingSourceCount: 1,
      failedSourceCount: 1,
      lastPracticedAt: new Date('2026-06-18T12:00:00.000Z'),
      state: 'PRACTICED',
    });

    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        courseId: 'course-1',
        kind: 'COURSE_PDF',
        archivedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        courseId: true,
        status: true,
      },
    });
    expect(prisma.knowledgeUnit.findMany).toHaveBeenCalledWith({
      where: {
        subjectId: 'subject-1',
        documentId: { in: ['ready-doc'] },
        subject: { studentId: 'student-1' },
        document: {
          studentId: 'student-1',
          subjectId: 'subject-1',
          courseId: 'course-1',
          kind: 'COURSE_PDF',
          status: 'READY',
          archivedAt: null,
        },
      },
      select: {
        id: true,
        documentId: true,
        mastery: {
          where: { studentId: 'student-1' },
          select: { score: true, lastPracticedAt: true },
          take: 1,
        },
      },
    });
  });

  it.each([
    {
      label: 'NO_SOURCE',
      documents: [],
      knowledgeUnits: [],
      expected: {
        state: 'NO_SOURCE',
        knowledgeUnitCount: 0,
        practicedKnowledgeUnitCount: 0,
        coverage: 0,
        mastery: null,
        estimatedGlobalMastery: 0,
        readySourceCount: 0,
        processingSourceCount: 0,
        failedSourceCount: 0,
        lastPracticedAt: null,
      },
    },
    {
      label: 'PROCESSING',
      documents: [
        progressDocument({ id: 'uploaded-doc', status: 'UPLOADED' }),
        progressDocument({ id: 'processing-doc', status: 'PROCESSING' }),
      ],
      knowledgeUnits: [],
      expected: {
        state: 'PROCESSING',
        knowledgeUnitCount: 0,
        practicedKnowledgeUnitCount: 0,
        coverage: 0,
        mastery: null,
        estimatedGlobalMastery: 0,
        readySourceCount: 0,
        processingSourceCount: 2,
        failedSourceCount: 0,
        lastPracticedAt: null,
      },
    },
    {
      label: 'FAILED_ONLY',
      documents: [progressDocument({ id: 'failed-doc', status: 'FAILED' })],
      knowledgeUnits: [],
      expected: {
        state: 'FAILED_ONLY',
        knowledgeUnitCount: 0,
        practicedKnowledgeUnitCount: 0,
        coverage: 0,
        mastery: null,
        estimatedGlobalMastery: 0,
        readySourceCount: 0,
        processingSourceCount: 0,
        failedSourceCount: 1,
        lastPracticedAt: null,
      },
    },
    {
      label: 'NO_KNOWLEDGE_UNITS',
      documents: [progressDocument({ id: 'ready-doc', status: 'READY' })],
      knowledgeUnits: [],
      expected: {
        state: 'NO_KNOWLEDGE_UNITS',
        knowledgeUnitCount: 0,
        practicedKnowledgeUnitCount: 0,
        coverage: 0,
        mastery: null,
        estimatedGlobalMastery: 0,
        readySourceCount: 1,
        processingSourceCount: 0,
        failedSourceCount: 0,
        lastPracticedAt: null,
      },
    },
    {
      label: 'READY_NOT_PRACTICED',
      documents: [progressDocument({ id: 'ready-doc', status: 'READY' })],
      knowledgeUnits: [
        progressKnowledgeUnit({ id: 'unit-1', documentId: 'ready-doc' }),
      ],
      expected: {
        state: 'READY_NOT_PRACTICED',
        knowledgeUnitCount: 1,
        practicedKnowledgeUnitCount: 0,
        coverage: 0,
        mastery: null,
        estimatedGlobalMastery: 0,
        readySourceCount: 1,
        processingSourceCount: 0,
        failedSourceCount: 0,
        lastPracticedAt: null,
      },
    },
  ])('computes $label course progress state', async (scenario) => {
    const { prisma, repository } = createRepository();
    prisma.course.findFirst.mockResolvedValue(courseRecord());
    prisma.document.findMany.mockResolvedValue(scenario.documents);
    prisma.knowledgeUnit.findMany.mockResolvedValue(scenario.knowledgeUnits);

    await expect(
      repository.findCourseProgressByIdForStudent({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).resolves.toEqual({
      courseId: 'course-1',
      subjectId: 'subject-1',
      ...scenario.expected,
    });

    if (scenario.documents.some((document) => document.status === 'READY')) {
      expect(prisma.knowledgeUnit.findMany).toHaveBeenCalledTimes(1);
    } else {
      expect(prisma.knowledgeUnit.findMany).not.toHaveBeenCalled();
    }
  });

  it('aggregates subject progress across real courses without legacy documents', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.course.findMany.mockResolvedValue([
      courseRecord({ id: 'course-1', title: 'Institutions' }),
      courseRecord({ id: 'course-2', title: 'Procédure' }),
    ]);
    prisma.document.findMany.mockResolvedValue([
      progressDocument({ id: 'doc-1', courseId: 'course-1', status: 'READY' }),
      progressDocument({
        id: 'doc-2',
        courseId: 'course-2',
        status: 'PROCESSING',
      }),
    ]);
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      progressKnowledgeUnit({
        id: 'unit-1',
        documentId: 'doc-1',
        mastery: [
          {
            score: 0.75,
            lastPracticedAt: new Date('2026-06-18T12:00:00.000Z'),
          },
        ],
      }),
      progressKnowledgeUnit({
        id: 'unit-2',
        documentId: 'doc-1',
        mastery: [],
      }),
    ]);

    await expect(
      repository.findSubjectProgressForStudent({
        studentId: 'student-1',
        subjectId: 'subject-1',
      }),
    ).resolves.toMatchObject({
      subjectId: 'subject-1',
      knowledgeUnitCount: 2,
      practicedKnowledgeUnitCount: 1,
      coverage: 0.5,
      mastery: 0.75,
      estimatedGlobalMastery: 0.375,
      courseCount: 2,
      readyCourseCount: 1,
      courses: [
        {
          courseId: 'course-1',
          title: 'Institutions',
          state: 'PRACTICED',
        },
        {
          courseId: 'course-2',
          title: 'Procédure',
          state: 'PROCESSING',
        },
      ],
    });

    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: { in: ['course-1', 'course-2'] },
        kind: 'COURSE_PDF',
        archivedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        courseId: true,
        status: true,
      },
    });
  });

  it('produces an idempotent dry-run backfill without writes', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findMany.mockResolvedValue([
      documentRecord({ id: 'document-1', fileName: 'Cours_stats_S1.pdf' }),
      documentRecord({ id: 'document-2', fileName: 'TD loi normale.PDF' }),
    ]);

    const result = await repository.backfillFromExistingDocumentsDryRun();

    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: { kind: 'COURSE_PDF', courseId: null, archivedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        fileName: true,
      },
    });
    expect(result).toEqual({
      documentsWithoutCourseCount: 2,
      coursesToCreateCount: 2,
      documentsToAttachCount: 2,
      items: [
        {
          documentId: 'document-1',
          studentId: 'student-1',
          subjectId: 'subject-1',
          proposedTitle: 'Cours stats S1',
        },
        {
          documentId: 'document-2',
          studentId: 'student-1',
          subjectId: 'subject-1',
          proposedTitle: 'TD loi normale',
        },
      ],
    });
    expect(prisma.course.create).not.toHaveBeenCalled();
    expect(prisma.document.update).not.toHaveBeenCalled();
  });
});

type PrismaCoursesMock = ReturnType<typeof createPrismaMock>;
type TransactionCallback = (tx: PrismaCoursesMock) => Promise<unknown>;

function createRepository() {
  const prisma = createPrismaMock();

  return {
    prisma,
    repository: new PrismaCoursesRepository(prisma as never),
  };
}

function createPrismaMock() {
  return {
    subject: {
      findFirst: jest.fn(),
    },
    course: {
      aggregate: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    document: {
      count: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    knowledgeUnit: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

function courseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    title: 'Loi normale',
    description: null,
    chapterLabel: null,
    estimatedMinutes: 20,
    displayOrder: 0,
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
    ...overrides,
  };
}

function documentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    courseId: null,
    fileName: 'Cours stats S1.pdf',
    ...overrides,
  };
}

function progressDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document-1',
    courseId: 'course-1',
    status: 'READY',
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    ...overrides,
  };
}

function progressKnowledgeUnit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'unit-1',
    documentId: 'document-1',
    mastery: [],
    ...overrides,
  };
}

function knowledgeUnitRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'unit-1',
    subjectId: 'subject-1',
    documentId: 'document-ready-1',
    title: 'Contrôle parlementaire',
    displayOrder: 0,
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    mastery: [],
    ...overrides,
  };
}

~~~

### `src/modules/courses/infrastructure/prisma-courses.repository.ts`

~~~text
import { Injectable } from '@nestjs/common';
import { DocumentKind } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type {
  CourseBackfillDryRunResult,
  CourseDetailDto,
  CourseDocumentStatus,
  CourseDto,
  CourseProgressDto,
  CourseProgressState,
  CourseQuickRevisionKnowledgeUnitDto,
  CourseOwnershipContext,
  CourseDocumentDto,
  CourseWithSourceStatsDto,
  CoursesRepository,
  CreateCourseRepositoryInput,
  SubjectProgressDto,
} from '../application/courses.repository';
import {
  CourseContainsDocumentsError,
  type CourseDocumentAttachment,
} from '../domain/course.entity';

type CourseRecord = CourseDto;

type CourseDetailRecord = CourseRecord & {
  subject: {
    id: string;
    name: string;
  };
  documents: Array<{
    id: string;
    courseId: string | null;
    fileName: string;
    kind: 'COURSE_PDF' | 'EXAM_PDF' | 'EXAM_IMAGE';
    status: CourseDocumentStatus;
    errorCode: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

type DocumentAttachmentRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  courseId: string | null;
  fileName: string;
};

type QuickRevisionKnowledgeUnitRecord = {
  id: string;
  subjectId: string;
  documentId: string | null;
  title: string;
  displayOrder: number | null;
  createdAt: Date;
  mastery: Array<{
    score: number;
    lastPracticedAt: Date | null;
  }>;
};

type ProgressCourseRecord = CourseRecord & {
  title: string;
};

type ProgressDocumentRecord = {
  id: string;
  courseId: string | null;
  status: CourseDocumentStatus;
};

type ProgressKnowledgeUnitRecord = {
  id: string;
  documentId: string | null;
  mastery: Array<{
    score: number;
    lastPracticedAt: Date | null;
  }>;
};

@Injectable()
export class PrismaCoursesRepository implements CoursesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateCourseRepositoryInput): Promise<CourseDto> {
    return this.prisma.$transaction(async (tx) => {
      await ensureSubjectForStudent(tx, {
        studentId: input.studentId,
        subjectId: input.subjectId,
      });

      const maxOrder = await tx.course.aggregate({
        where: {
          studentId: input.studentId,
          subjectId: input.subjectId,
        },
        _max: { displayOrder: true },
      });
      const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;

      const course = await tx.course.create({
        data: {
          studentId: input.studentId,
          subjectId: input.subjectId,
          title: input.title,
          description: input.description ?? null,
          chapterLabel: input.chapterLabel ?? null,
          estimatedMinutes: input.estimatedMinutes ?? null,
          displayOrder,
        },
      });

      return toCourseDto(course);
    });
  }

  async findByIdForStudent(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseDto | null> {
    const course = await this.prisma.course.findFirst({
      where: {
        id: input.courseId,
        studentId: input.studentId,
      },
    });

    return course ? toCourseDto(course) : null;
  }

  async listBySubjectForStudent(input: {
    studentId: string;
    subjectId: string;
  }): Promise<CourseDto[]> {
    await ensureSubjectForStudent(this.prisma, input);

    const courses = await this.prisma.course.findMany({
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return courses.map(toCourseDto);
  }

  async listBySubjectForStudentWithStats(input: {
    studentId: string;
    subjectId: string;
  }): Promise<CourseWithSourceStatsDto[]> {
    await ensureSubjectForStudent(this.prisma, input);

    const courses = (await this.prisma.course.findMany({
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    })) as CourseRecord[];

    if (courses.length === 0) {
      return [];
    }

    const documents = await this.prisma.document.findMany({
      where: {
        studentId: input.studentId,
        courseId: { in: courses.map((course) => course.id) },
        archivedAt: null,
      },
      select: {
        courseId: true,
        status: true,
      },
    });

    const statsByCourseId = new Map<string, CourseDocumentStats>();

    for (const course of courses) {
      statsByCourseId.set(course.id, emptySourceStats());
    }

    for (const document of documents) {
      if (!document.courseId) {
        continue;
      }

      const stats = statsByCourseId.get(document.courseId);
      if (!stats) {
        continue;
      }

      applyDocumentStatus(stats, document.status);
    }

    return courses.map((course) =>
      toCourseWithStatsDto(course, statsByCourseId.get(course.id)),
    );
  }

  async findDetailByIdForStudent(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseDetailDto | null> {
    const course = await this.prisma.course.findFirst({
      where: {
        id: input.courseId,
        studentId: input.studentId,
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
        documents: {
          where: {
            studentId: input.studentId,
            archivedAt: null,
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            courseId: true,
            fileName: true,
            kind: true,
            status: true,
            errorCode: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!course) {
      return null;
    }

    const stats = emptySourceStats();
    const sources = course.documents.map((document) => {
      applyDocumentStatus(stats, document.status);
      return toCourseDocumentDto(document);
    });

    return {
      course: toCourseWithStatsDto(course, stats),
      subject: {
        id: course.subject.id,
        name: course.subject.name,
      },
      sources,
    };
  }

  async findCourseProgressByIdForStudent(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseProgressDto | null> {
    const course = await this.prisma.course.findFirst({
      where: {
        id: input.courseId,
        studentId: input.studentId,
      },
    });

    if (!course) {
      return null;
    }

    const documents = (await this.prisma.document.findMany({
      where: {
        studentId: input.studentId,
        courseId: input.courseId,
        kind: DocumentKind.COURSE_PDF,
        archivedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        courseId: true,
        status: true,
      },
    })) as ProgressDocumentRecord[];

    const readyDocumentIds = documents
      .filter((document) => document.status === 'READY')
      .map((document) => document.id);

    const knowledgeUnits =
      readyDocumentIds.length === 0
        ? []
        : ((await this.prisma.knowledgeUnit.findMany({
            where: {
              subjectId: course.subjectId,
              documentId: { in: readyDocumentIds },
              subject: { studentId: input.studentId },
              // Progress is intentionally course-level: legacy documents
              // without courseId and non-READY/non-COURSE_PDF docs cannot
              // contribute to the available KnowledgeUnit count.
              document: {
                studentId: input.studentId,
                subjectId: course.subjectId,
                courseId: course.id,
                kind: DocumentKind.COURSE_PDF,
                status: 'READY',
                archivedAt: null,
              },
            },
            select: {
              id: true,
              documentId: true,
              mastery: {
                where: { studentId: input.studentId },
                select: { score: true, lastPracticedAt: true },
                take: 1,
              },
            },
          })) as ProgressKnowledgeUnitRecord[]);

    return buildCourseProgressDto(course, documents, knowledgeUnits);
  }

  async findSubjectProgressForStudent(input: {
    studentId: string;
    subjectId: string;
  }): Promise<SubjectProgressDto | null> {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: input.subjectId,
        studentId: input.studentId,
      },
      select: { id: true },
    });

    if (!subject) {
      return null;
    }

    const courses = (await this.prisma.course.findMany({
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    })) as ProgressCourseRecord[];

    if (courses.length === 0) {
      return emptySubjectProgress(input.subjectId);
    }

    const courseIds = courses.map((course) => course.id);
    const documents = (await this.prisma.document.findMany({
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
        courseId: { in: courseIds },
        kind: DocumentKind.COURSE_PDF,
        archivedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        courseId: true,
        status: true,
      },
    })) as ProgressDocumentRecord[];
    const readyDocumentIds = documents
      .filter((document) => document.status === 'READY')
      .map((document) => document.id);
    const documentCourseIdByDocumentId = new Map(
      documents
        .filter((document) => document.courseId)
        .map((document) => [document.id, document.courseId as string]),
    );

    const knowledgeUnits =
      readyDocumentIds.length === 0
        ? []
        : ((await this.prisma.knowledgeUnit.findMany({
            where: {
              subjectId: input.subjectId,
              documentId: { in: readyDocumentIds },
              subject: { studentId: input.studentId },
              document: {
                studentId: input.studentId,
                subjectId: input.subjectId,
                courseId: { in: courseIds },
                kind: DocumentKind.COURSE_PDF,
                status: 'READY',
                archivedAt: null,
              },
            },
            select: {
              id: true,
              documentId: true,
              mastery: {
                where: { studentId: input.studentId },
                select: { score: true, lastPracticedAt: true },
                take: 1,
              },
            },
          })) as ProgressKnowledgeUnitRecord[]);

    const documentsByCourseId = groupByCourseId(documents);
    const knowledgeUnitsByCourseId = groupKnowledgeUnitsByCourseId(
      knowledgeUnits,
      documentCourseIdByDocumentId,
    );
    const courseProgresses = courses.map((course) =>
      buildCourseProgressDto(
        course,
        documentsByCourseId.get(course.id) ?? [],
        knowledgeUnitsByCourseId.get(course.id) ?? [],
      ),
    );

    return buildSubjectProgressDto(input.subjectId, courses, courseProgresses);
  }

  async deleteIfEmpty(input: {
    studentId: string;
    courseId: string;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const course = await tx.course.findFirst({
        where: {
          id: input.courseId,
          studentId: input.studentId,
        },
      });

      if (!course) {
        return false;
      }

      const documentCount = await tx.document.count({
        where: {
          courseId: course.id,
          studentId: input.studentId,
        },
      });

      if (documentCount > 0) {
        throw new CourseContainsDocumentsError();
      }

      await tx.course.delete({
        where: { id: course.id },
      });

      return true;
    });
  }

  async findCourseOwnershipContext(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseOwnershipContext | null> {
    const course = await this.prisma.course.findFirst({
      where: {
        id: input.courseId,
        studentId: input.studentId,
      },
      select: {
        id: true,
        studentId: true,
        subjectId: true,
      },
    });

    return course
      ? {
          courseId: course.id,
          studentId: course.studentId,
          subjectId: course.subjectId,
        }
      : null;
  }

  async findFirstReadyCoursePdfDocumentForCourse(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseDocumentDto | null> {
    const document = await this.prisma.document.findFirst({
      where: {
        studentId: input.studentId,
        courseId: input.courseId,
        kind: DocumentKind.COURSE_PDF,
        status: 'READY',
        archivedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        courseId: true,
        fileName: true,
        kind: true,
        status: true,
        errorCode: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return document ? toCourseDocumentDto(document) : null;
  }

  async findFirstQuickRevisionKnowledgeUnitForCourseDocument(input: {
    studentId: string;
    courseId: string;
    subjectId: string;
    documentId: string;
  }): Promise<CourseQuickRevisionKnowledgeUnitDto | null> {
    const knowledgeUnits = (await this.prisma.knowledgeUnit.findMany({
      where: {
        subjectId: input.subjectId,
        documentId: input.documentId,
        subject: { studentId: input.studentId },
        document: {
          id: input.documentId,
          studentId: input.studentId,
          subjectId: input.subjectId,
          courseId: input.courseId,
          kind: DocumentKind.COURSE_PDF,
          status: 'READY',
          archivedAt: null,
        },
      },
      select: {
        id: true,
        subjectId: true,
        documentId: true,
        title: true,
        displayOrder: true,
        createdAt: true,
        mastery: {
          where: { studentId: input.studentId },
          select: { score: true, lastPracticedAt: true },
          take: 1,
        },
      },
    })) as QuickRevisionKnowledgeUnitRecord[];

    const [selected] = knowledgeUnits.sort(compareQuickRevisionKnowledgeUnits);

    return selected ? toCourseQuickRevisionKnowledgeUnitDto(selected) : null;
  }

  async attachDocumentToCourse(input: {
    studentId: string;
    courseId: string;
    documentId: string;
  }): Promise<CourseDocumentAttachment> {
    return this.prisma.$transaction(async (tx) => {
      const course = await tx.course.findFirst({
        where: {
          id: input.courseId,
          studentId: input.studentId,
        },
      });

      if (!course) {
        throw new Error('Course not found');
      }

      const document = await tx.document.findFirst({
        where: {
          id: input.documentId,
          studentId: input.studentId,
        },
        select: {
          id: true,
          studentId: true,
          subjectId: true,
          courseId: true,
          fileName: true,
        },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      // The database relation is intentionally simple (`courseId -> Course.id`).
      // Course/document subject coherence is therefore enforced here before any
      // attachment write can happen.
      if (document.subjectId !== course.subjectId) {
        throw new Error('Document subject does not match course');
      }

      const updated = (await tx.document.update({
        where: { id: document.id },
        data: { courseId: course.id },
      })) as DocumentAttachmentRecord;

      return toDocumentAttachment(updated);
    });
  }

  async backfillFromExistingDocumentsDryRun(): Promise<CourseBackfillDryRunResult> {
    const documents = (await this.prisma.document.findMany({
      where: {
        kind: DocumentKind.COURSE_PDF,
        courseId: null,
        archivedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        fileName: true,
      },
    })) as Array<{
      id: string;
      studentId: string;
      subjectId: string;
      fileName: string;
    }>;

    const items = documents.map((document) => ({
      documentId: document.id,
      studentId: document.studentId,
      subjectId: document.subjectId,
      proposedTitle: titleFromFileName(document.fileName),
    }));

    return {
      documentsWithoutCourseCount: items.length,
      coursesToCreateCount: items.length,
      documentsToAttachCount: items.length,
      items,
    };
  }

  backfillFromExistingDocuments(): Promise<CourseBackfillDryRunResult> {
    return Promise.reject(
      new Error('Backfill apply is disabled in CORE-01; use dry-run only'),
    );
  }
}

type SubjectOwnershipClient = {
  subject: {
    findFirst(input: {
      where: { id: string; studentId: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
};

async function ensureSubjectForStudent(
  client: SubjectOwnershipClient,
  input: { studentId: string; subjectId: string },
) {
  const subject = await client.subject.findFirst({
    where: {
      id: input.subjectId,
      studentId: input.studentId,
    },
    select: { id: true },
  });

  if (!subject) {
    throw new Error('Course subject not found');
  }
}

function toCourseDto(course: CourseRecord): CourseDto {
  return {
    id: course.id,
    studentId: course.studentId,
    subjectId: course.subjectId,
    title: course.title,
    description: course.description,
    chapterLabel: course.chapterLabel,
    estimatedMinutes: course.estimatedMinutes,
    displayOrder: course.displayOrder,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

type CourseDocumentStats = {
  sourceCount: number;
  readySourceCount: number;
  processingSourceCount: number;
  failedSourceCount: number;
};

function emptySourceStats(): CourseDocumentStats {
  return {
    sourceCount: 0,
    readySourceCount: 0,
    processingSourceCount: 0,
    failedSourceCount: 0,
  };
}

function applyDocumentStatus(
  stats: CourseDocumentStats,
  status: CourseDocumentStatus,
) {
  stats.sourceCount += 1;

  if (status === 'READY') {
    stats.readySourceCount += 1;
  } else if (status === 'PROCESSING') {
    stats.processingSourceCount += 1;
  } else if (status === 'FAILED') {
    stats.failedSourceCount += 1;
  }
}

function groupByCourseId(documents: ProgressDocumentRecord[]) {
  const byCourseId = new Map<string, ProgressDocumentRecord[]>();

  for (const document of documents) {
    if (!document.courseId) {
      continue;
    }

    const documentsForCourse = byCourseId.get(document.courseId) ?? [];
    documentsForCourse.push(document);
    byCourseId.set(document.courseId, documentsForCourse);
  }

  return byCourseId;
}

function groupKnowledgeUnitsByCourseId(
  knowledgeUnits: ProgressKnowledgeUnitRecord[],
  documentCourseIdByDocumentId: Map<string, string>,
) {
  const byCourseId = new Map<string, ProgressKnowledgeUnitRecord[]>();

  for (const unit of knowledgeUnits) {
    if (!unit.documentId) {
      continue;
    }

    const courseId = documentCourseIdByDocumentId.get(unit.documentId);
    if (!courseId) {
      continue;
    }

    const unitsForCourse = byCourseId.get(courseId) ?? [];
    unitsForCourse.push(unit);
    byCourseId.set(courseId, unitsForCourse);
  }

  return byCourseId;
}

function buildCourseProgressDto(
  course: ProgressCourseRecord,
  documents: ProgressDocumentRecord[],
  knowledgeUnits: ProgressKnowledgeUnitRecord[],
): CourseProgressDto {
  const sourceStats = progressSourceStats(documents);
  const practicedMastery = knowledgeUnits
    .map((unit) => unit.mastery[0])
    .filter((mastery): mastery is NonNullable<typeof mastery> =>
      Boolean(mastery),
    );
  const knowledgeUnitCount = knowledgeUnits.length;
  const practicedKnowledgeUnitCount = practicedMastery.length;
  const coverage =
    knowledgeUnitCount === 0
      ? 0
      : safeRatio(practicedKnowledgeUnitCount, knowledgeUnitCount);
  const mastery =
    practicedMastery.length === 0
      ? null
      : roundRatio(
          practicedMastery.reduce((sum, item) => sum + item.score, 0) /
            practicedMastery.length,
        );
  const estimatedGlobalMastery =
    mastery == null ? 0 : roundRatio(coverage * mastery);

  return {
    courseId: course.id,
    subjectId: course.subjectId,
    knowledgeUnitCount,
    practicedKnowledgeUnitCount,
    coverage,
    mastery,
    estimatedGlobalMastery,
    readySourceCount: sourceStats.readySourceCount,
    processingSourceCount: sourceStats.processingSourceCount,
    failedSourceCount: sourceStats.failedSourceCount,
    lastPracticedAt: latestPracticedAt(practicedMastery),
    state: progressState(sourceStats, knowledgeUnitCount, practicedMastery),
  };
}

function buildSubjectProgressDto(
  subjectId: string,
  courses: ProgressCourseRecord[],
  courseProgresses: CourseProgressDto[],
): SubjectProgressDto {
  const knowledgeUnitCount = courseProgresses.reduce(
    (sum, progress) => sum + progress.knowledgeUnitCount,
    0,
  );
  const practicedKnowledgeUnitCount = courseProgresses.reduce(
    (sum, progress) => sum + progress.practicedKnowledgeUnitCount,
    0,
  );
  const practicedMasteryValues = courseProgresses.flatMap(
    (progress): number[] => {
      if (
        progress.mastery == null ||
        progress.practicedKnowledgeUnitCount === 0
      ) {
        return [];
      }

      return Array<number>(progress.practicedKnowledgeUnitCount).fill(
        progress.mastery,
      );
    },
  );
  const coverage =
    knowledgeUnitCount === 0
      ? 0
      : safeRatio(practicedKnowledgeUnitCount, knowledgeUnitCount);
  const mastery =
    practicedMasteryValues.length === 0
      ? null
      : roundRatio(
          practicedMasteryValues.reduce((sum, score) => sum + score, 0) /
            practicedMasteryValues.length,
        );
  const estimatedGlobalMastery =
    mastery == null ? 0 : roundRatio(coverage * mastery);
  const latest = latestDate(
    courseProgresses.map((item) => item.lastPracticedAt),
  );
  const titleByCourseId = new Map(
    courses.map((course) => [course.id, course.title]),
  );

  return {
    subjectId,
    knowledgeUnitCount,
    practicedKnowledgeUnitCount,
    coverage,
    mastery,
    estimatedGlobalMastery,
    courseCount: courses.length,
    readyCourseCount: courseProgresses.filter(
      (progress) => progress.readySourceCount > 0,
    ).length,
    lastPracticedAt: latest,
    courses: courseProgresses.map((progress) => ({
      courseId: progress.courseId,
      title: titleByCourseId.get(progress.courseId) ?? 'Cours',
      knowledgeUnitCount: progress.knowledgeUnitCount,
      practicedKnowledgeUnitCount: progress.practicedKnowledgeUnitCount,
      coverage: progress.coverage,
      mastery: progress.mastery,
      estimatedGlobalMastery: progress.estimatedGlobalMastery,
      state: progress.state,
    })),
  };
}

function emptySubjectProgress(subjectId: string): SubjectProgressDto {
  return {
    subjectId,
    knowledgeUnitCount: 0,
    practicedKnowledgeUnitCount: 0,
    coverage: 0,
    mastery: null,
    estimatedGlobalMastery: 0,
    courseCount: 0,
    readyCourseCount: 0,
    lastPracticedAt: null,
    courses: [],
  };
}

function progressSourceStats(documents: ProgressDocumentRecord[]) {
  let readySourceCount = 0;
  let processingSourceCount = 0;
  let failedSourceCount = 0;

  for (const document of documents) {
    if (document.status === 'READY') {
      readySourceCount += 1;
    } else if (
      document.status === 'UPLOADED' ||
      document.status === 'PROCESSING'
    ) {
      processingSourceCount += 1;
    } else if (document.status === 'FAILED') {
      failedSourceCount += 1;
    }
  }

  return {
    sourceCount: documents.length,
    readySourceCount,
    processingSourceCount,
    failedSourceCount,
  };
}

function progressState(
  sourceStats: ReturnType<typeof progressSourceStats>,
  knowledgeUnitCount: number,
  practicedMastery: Array<{ score: number; lastPracticedAt: Date | null }>,
): CourseProgressState {
  if (sourceStats.sourceCount === 0) {
    return 'NO_SOURCE';
  }

  if (
    sourceStats.readySourceCount === 0 &&
    sourceStats.processingSourceCount > 0
  ) {
    return 'PROCESSING';
  }

  if (sourceStats.readySourceCount === 0 && sourceStats.failedSourceCount > 0) {
    return 'FAILED_ONLY';
  }

  if (knowledgeUnitCount === 0) {
    return 'NO_KNOWLEDGE_UNITS';
  }

  if (practicedMastery.length === 0) {
    return 'READY_NOT_PRACTICED';
  }

  return 'PRACTICED';
}

function safeRatio(numerator: number, denominator: number) {
  if (denominator === 0) {
    return 0;
  }

  return roundRatio(numerator / denominator);
}

function roundRatio(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(value.toFixed(3));
}

function latestPracticedAt(
  mastery: Array<{ score: number; lastPracticedAt: Date | null }>,
) {
  return latestDate(mastery.map((item) => item.lastPracticedAt));
}

function latestDate(dates: Array<Date | null>) {
  const timestamps = dates
    .filter((date): date is Date => date instanceof Date)
    .map((date) => date.getTime());

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps));
}

function toCourseWithStatsDto(
  course: CourseRecord,
  stats: CourseDocumentStats = emptySourceStats(),
): CourseWithSourceStatsDto {
  return {
    ...toCourseDto(course),
    sourceCount: stats.sourceCount,
    readySourceCount: stats.readySourceCount,
    processingSourceCount: stats.processingSourceCount,
    failedSourceCount: stats.failedSourceCount,
  };
}

function toCourseDocumentDto(
  document: CourseDetailRecord['documents'][number],
): CourseDocumentDto {
  if (!document.courseId) {
    throw new Error('Attached course document is missing courseId');
  }

  return {
    id: document.id,
    courseId: document.courseId,
    documentId: document.id,
    fileName: document.fileName,
    kind: document.kind,
    status: document.status,
    errorCode: document.errorCode,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function toDocumentAttachment(
  document: DocumentAttachmentRecord,
): CourseDocumentAttachment {
  return {
    id: document.id,
    studentId: document.studentId,
    subjectId: document.subjectId,
    courseId: document.courseId,
    fileName: document.fileName,
  };
}

function compareQuickRevisionKnowledgeUnits(
  left: QuickRevisionKnowledgeUnitRecord,
  right: QuickRevisionKnowledgeUnitRecord,
) {
  const leftMastery = left.mastery[0];
  const rightMastery = right.mastery[0];
  const scoreDelta = (leftMastery?.score ?? 0) - (rightMastery?.score ?? 0);

  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  const leftPracticedAt = leftMastery?.lastPracticedAt?.getTime() ?? 0;
  const rightPracticedAt = rightMastery?.lastPracticedAt?.getTime() ?? 0;
  const practiceDelta = leftPracticedAt - rightPracticedAt;

  if (practiceDelta !== 0) {
    return practiceDelta;
  }

  const orderDelta =
    (left.displayOrder ?? Number.MAX_SAFE_INTEGER) -
    (right.displayOrder ?? Number.MAX_SAFE_INTEGER);

  if (orderDelta !== 0) {
    return orderDelta;
  }

  const createdAtDelta = left.createdAt.getTime() - right.createdAt.getTime();

  if (createdAtDelta !== 0) {
    return createdAtDelta;
  }

  return left.id.localeCompare(right.id);
}

function toCourseQuickRevisionKnowledgeUnitDto(
  unit: QuickRevisionKnowledgeUnitRecord,
): CourseQuickRevisionKnowledgeUnitDto {
  if (!unit.documentId) {
    throw new Error(
      'Course quick revision knowledge unit is missing documentId',
    );
  }

  return {
    id: unit.id,
    subjectId: unit.subjectId,
    documentId: unit.documentId,
    title: unit.title,
  };
}

function titleFromFileName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  const normalized = withoutExtension
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || 'Cours sans titre';
}

~~~

### `src/modules/courses/interfaces/courses.controller.spec.ts`

~~~text
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CourseContainsDocumentsError } from '../domain/course.entity';
import {
  CourseRevisionSheetSourceNotReadyError,
  GenerateCourseRevisionSheetUseCase,
  GetCourseRevisionSheetUseCase,
} from '../application/course-revision-sheet.use-case';
import {
  CourseQuickRevisionGenerationFailedError,
  CourseQuickRevisionKnowledgeUnitNotReadyError,
  CourseQuickRevisionQuestionCountInvalidError,
  CourseQuickRevisionQuestionsPreparingError,
  CourseQuickRevisionSourceNotReadyError,
  StartCourseQuickRevisionSessionUseCase,
} from '../application/start-course-quick-revision-session.use-case';
import { CreateCourseUseCase } from '../application/create-course.use-case';
import { DeleteCourseDocumentUseCase } from '../application/delete-course-document.use-case';
import { DeleteCourseUseCase } from '../application/delete-course.use-case';
import {
  GetCourseProgressUseCase,
  GetSubjectProgressUseCase,
} from '../application/course-progress.use-case';
import {
  ArchiveCourseSourceUseCase,
  GetCourseSourceLifecycleUseCase,
} from '../application/course-source-lifecycle.use-case';
import { GetCourseDetailUseCase } from '../application/get-course-detail.use-case';
import { ListSubjectCoursesWithStatsUseCase } from '../application/list-subject-courses-with-stats.use-case';
import { UploadCoursePdfForCourseUseCase } from '../application/upload-course-pdf-for-course.use-case';
import { CoursesController } from './courses.controller';
import { SourceDeleteBlockedError } from '../../documents/domain/source-lifecycle.entity';

describe('CoursesController', () => {
  it('lists courses for the current student and subject', async () => {
    const { controller, listCourses } = createController();
    listCourses.execute.mockResolvedValue([courseWithStats()]);

    await expect(
      controller.listForSubject(currentStudent, 'subject-1'),
    ).resolves.toEqual([publicCourse()]);

    expect(listCourses.execute.mock.calls[0]).toEqual([
      { studentId: 'student-1', subjectId: 'subject-1' },
    ]);
  });

  it('creates a course with validated trimmed input', async () => {
    const { controller, createCourse } = createController();
    createCourse.execute.mockResolvedValue(courseWithStats());

    await expect(
      controller.createForSubject(currentStudent, ' subject-1 ', {
        title: ' Droit constitutionnel ',
        description: ' Institutions ',
        chapterLabel: ' Chapitre 1 ',
        estimatedMinutes: 30,
      }),
    ).resolves.toEqual(publicCourse());

    expect(createCourse.execute.mock.calls[0]).toEqual([
      {
        studentId: 'student-1',
        subjectId: 'subject-1',
        title: 'Droit constitutionnel',
        description: 'Institutions',
        chapterLabel: 'Chapitre 1',
        estimatedMinutes: 30,
      },
    ]);
  });

  it('rejects invalid course creation body as 400', () => {
    const { controller, createCourse } = createController();

    expect(() =>
      controller.createForSubject(currentStudent, 'subject-1', {
        title: 'x',
      }),
    ).toThrow(BadRequestException);
    expect(createCourse.execute.mock.calls).toHaveLength(0);
  });

  it('returns detail with subject and sources', async () => {
    const { controller, getCourseDetail } = createController();
    getCourseDetail.execute.mockResolvedValue({
      course: courseWithStats({ sourceCount: 1, readySourceCount: 1 }),
      subject: { id: 'subject-1', name: 'Droit constitutionnel' },
      sources: [
        {
          id: 'document-1',
          courseId: 'course-1',
          documentId: 'document-1',
          fileName: 'cours.pdf',
          kind: 'COURSE_PDF',
          status: 'READY',
          errorCode: null,
          createdAt: new Date('2026-06-18T10:00:00.000Z'),
          updatedAt: new Date('2026-06-18T10:00:00.000Z'),
        },
      ],
    });

    await expect(
      controller.getCourse(currentStudent, 'course-1'),
    ).resolves.toEqual({
      course: publicCourse({ sourceCount: 1, readySourceCount: 1 }),
      subject: { id: 'subject-1', name: 'Droit constitutionnel' },
      sources: [
        {
          id: 'document-1',
          courseId: 'course-1',
          documentId: 'document-1',
          fileName: 'cours.pdf',
          kind: 'COURSE_PDF',
          status: 'READY',
          errorCode: null,
          createdAt: '2026-06-18T10:00:00.000Z',
          updatedAt: '2026-06-18T10:00:00.000Z',
        },
      ],
    });
  });

  it('returns course progress without exposing mastery internals', async () => {
    const { controller, getCourseProgress } = createController();
    getCourseProgress.execute.mockResolvedValue(courseProgress());

    await expect(
      controller.getCourseProgress(currentStudent, ' course-1 '),
    ).resolves.toEqual(publicCourseProgress());

    expect(getCourseProgress.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
    });
    expect(
      JSON.stringify(
        await controller.getCourseProgress(currentStudent, 'course-1'),
      ),
    ).not.toContain('storagePath');
  });

  it('returns subject progress with per-course summaries', async () => {
    const { controller, getSubjectProgress } = createController();
    getSubjectProgress.execute.mockResolvedValue(subjectProgress());

    await expect(
      controller.getSubjectProgress(currentStudent, ' subject-1 '),
    ).resolves.toEqual(publicSubjectProgress());

    expect(getSubjectProgress.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });
  });

  it('maps course and subject progress not found to 404', async () => {
    const { controller, getCourseProgress, getSubjectProgress } =
      createController();
    getCourseProgress.execute.mockRejectedValueOnce(
      new Error('Course not found'),
    );
    getSubjectProgress.execute.mockRejectedValueOnce(
      new Error('Course subject not found'),
    );

    await expect(
      controller.getCourseProgress(currentStudent, 'missing-course'),
    ).rejects.toThrow(NotFoundException);
    await expect(
      controller.getSubjectProgress(currentStudent, 'missing-subject'),
    ).rejects.toThrow(NotFoundException);
  });

  it('maps course not found to 404', async () => {
    const { controller, getCourseDetail } = createController();
    getCourseDetail.execute.mockRejectedValue(new Error('Course not found'));

    await expect(
      controller.getCourse(currentStudent, 'other-student-course'),
    ).rejects.toThrow(NotFoundException);
  });

  it('deletes empty courses and maps document conflicts to 409', async () => {
    const { controller, deleteCourse } = createController();
    deleteCourse.execute.mockResolvedValueOnce({ deleted: true });

    await expect(
      controller.deleteCourse(currentStudent, 'course-1'),
    ).resolves.toEqual(undefined);

    deleteCourse.execute.mockRejectedValueOnce(
      new CourseContainsDocumentsError(),
    );

    await expect(
      controller.deleteCourse(currentStudent, 'course-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('deletes a course source for the current student', async () => {
    const { controller, deleteCourseDocument } = createController();
    deleteCourseDocument.execute.mockResolvedValue(undefined);

    await expect(
      controller.deleteCourseDocument(
        currentStudent,
        ' course-1 ',
        ' document-1 ',
      ),
    ).resolves.toBeUndefined();

    expect(deleteCourseDocument.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      documentId: 'document-1',
    });
  });

  it('maps missing course sources to 404', async () => {
    const { controller, deleteCourseDocument } = createController();
    deleteCourseDocument.execute.mockRejectedValue(
      new NotFoundException('Course source not found'),
    );

    await expect(
      controller.deleteCourseDocument(
        currentStudent,
        'course-1',
        'document-other',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('loads source lifecycle for a course source', async () => {
    const { controller, getCourseSourceLifecycle } = createController();
    getCourseSourceLifecycle.execute.mockResolvedValue(
      sourceLifecycleDecision(),
    );

    await expect(
      controller.getCourseSourceLifecycle(
        currentStudent,
        ' course-1 ',
        ' document-1 ',
      ),
    ).resolves.toMatchObject({
      documentId: 'document-1',
      recommendedAction: 'ARCHIVE',
    });

    expect(getCourseSourceLifecycle.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      documentId: 'document-1',
    });
  });

  it('archives a course source', async () => {
    const { controller, archiveCourseSource } = createController();
    archiveCourseSource.execute.mockResolvedValue(
      sourceLifecycleDecision({
        status: 'ARCHIVED',
        recommendedAction: 'BLOCK',
        canArchive: false,
      }),
    );

    await expect(
      controller.archiveCourseSource(
        currentStudent,
        ' course-1 ',
        ' document-1 ',
      ),
    ).resolves.toMatchObject({
      documentId: 'document-1',
      status: 'ARCHIVED',
      recommendedAction: 'BLOCK',
    });

    expect(archiveCourseSource.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      documentId: 'document-1',
    });
  });

  it('maps lifecycle delete conflicts to 409', async () => {
    const { controller, deleteCourseDocument } = createController();
    deleteCourseDocument.execute.mockRejectedValue(
      new SourceDeleteBlockedError(sourceLifecycleDecision()),
    );

    await expect(
      controller.deleteCourseDocument(currentStudent, 'course-1', 'document-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('uploads a course PDF with course-derived context only', async () => {
    const { controller, uploadCoursePdfForCourse } = createController();
    uploadCoursePdfForCourse.execute.mockResolvedValue(courseDocument());

    await expect(
      controller.uploadCoursePdfForCourse(
        currentStudent,
        ' course-1 ',
        uploadedPdf(),
      ),
    ).resolves.toEqual(publicCourseDocument());

    expect(uploadCoursePdfForCourse.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      firebaseUid: 'firebase-1',
      courseId: 'course-1',
      originalFileName: 'cours.pdf',
      content: Buffer.from('%PDF-1.7'),
      mimeType: 'application/pdf',
    });
  });

  it('rejects missing and invalid course PDF uploads before the use case', () => {
    const { controller, uploadCoursePdfForCourse } = createController();

    expect(() =>
      controller.uploadCoursePdfForCourse(
        currentStudent,
        'course-1',
        undefined,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      controller.uploadCoursePdfForCourse(currentStudent, 'course-1', {
        ...uploadedPdf(),
        originalname: 'notes.txt',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      controller.uploadCoursePdfForCourse(currentStudent, 'course-1', {
        ...uploadedPdf(),
        mimetype: 'text/plain',
      }),
    ).toThrow(BadRequestException);
    expect(uploadCoursePdfForCourse.execute).not.toHaveBeenCalled();
  });

  it('rejects client-provided course upload ownership fields', () => {
    const { controller, uploadCoursePdfForCourse } = createController();

    expect(() =>
      controller.uploadCoursePdfForCourse(
        currentStudent,
        'course-1',
        uploadedPdf(),
        { subjectId: 'subject-1' },
      ),
    ).toThrow(BadRequestException);

    expect(uploadCoursePdfForCourse.execute).not.toHaveBeenCalled();
  });

  it('maps unknown course uploads to 404', async () => {
    const { controller, uploadCoursePdfForCourse } = createController();
    uploadCoursePdfForCourse.execute.mockRejectedValue(
      new Error('Course not found'),
    );

    await expect(
      controller.uploadCoursePdfForCourse(
        currentStudent,
        'other-student-course',
        uploadedPdf(),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('gets a course-level revision sheet without exposing internal metadata', async () => {
    const { controller, getCourseRevisionSheet } = createController();
    getCourseRevisionSheet.execute.mockResolvedValue(revisionSheet());

    await expect(
      controller.getCourseRevisionSheet(currentStudent, ' course-1 '),
    ).resolves.toEqual(publicRevisionSheet());

    expect(getCourseRevisionSheet.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
    });
    expect(
      JSON.stringify(
        await controller.getCourseRevisionSheet(currentStudent, 'course-1'),
      ),
    ).not.toContain('promptVersion');
  });

  it('generates a course-level revision sheet via the backend-selected source', async () => {
    const { controller, generateCourseRevisionSheet } = createController();
    generateCourseRevisionSheet.execute.mockResolvedValue(revisionSheet());

    await expect(
      controller.generateCourseRevisionSheet(currentStudent, 'course-1'),
    ).resolves.toEqual(publicRevisionSheet());

    expect(generateCourseRevisionSheet.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
    });
  });

  it('maps course-level revision sheet errors to 404 and 409', async () => {
    const { controller, getCourseRevisionSheet, generateCourseRevisionSheet } =
      createController();
    getCourseRevisionSheet.execute.mockResolvedValueOnce(null);

    await expect(
      controller.getCourseRevisionSheet(currentStudent, 'course-1'),
    ).rejects.toThrow(NotFoundException);

    generateCourseRevisionSheet.execute.mockRejectedValueOnce(
      new CourseRevisionSheetSourceNotReadyError(),
    );

    await expect(
      controller.generateCourseRevisionSheet(currentStudent, 'course-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('starts a course quick revision session with an optional questionCount', async () => {
    const { controller, startCourseQuickRevisionSession } = createController();
    startCourseQuickRevisionSession.execute.mockResolvedValue(
      revisionSessionResponse(),
    );

    await expect(
      controller.startQuickRevisionSession(currentStudent, ' course-1 ', {
        questionCount: 20,
      }),
    ).resolves.toMatchObject({
      session: {
        id: 'session-1',
        courseId: 'course-1',
        mode: 'QUICK',
      },
      currentAction: {
        kind: 'DIAGNOSTIC_QUIZ',
      },
    });

    expect(startCourseQuickRevisionSession.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      questionCount: 20,
    });
  });

  it('defaults course quick revision questionCount when omitted', async () => {
    const { controller, startCourseQuickRevisionSession } = createController();
    startCourseQuickRevisionSession.execute.mockResolvedValue(
      revisionSessionResponse(),
    );

    await controller.startQuickRevisionSession(currentStudent, 'course-1');

    expect(startCourseQuickRevisionSession.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
      questionCount: undefined,
    });
  });

  it('rejects client-owned or unsupported course quick revision fields', () => {
    const { controller, startCourseQuickRevisionSession } = createController();

    expect(() =>
      controller.startQuickRevisionSession(currentStudent, 'course-1', {
        subjectId: 'subject-1',
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      controller.startQuickRevisionSession(currentStudent, 'course-1', {
        questionCount: 10,
        documentId: 'document-1',
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      controller.startQuickRevisionSession(currentStudent, 'course-1', {
        unexpected: true,
      }),
    ).toThrow(BadRequestException);

    for (const questionCount of [4, 31, 10.5, '10']) {
      expect(() =>
        controller.startQuickRevisionSession(currentStudent, 'course-1', {
          questionCount,
        }),
      ).toThrow(BadRequestException);
    }

    expect(startCourseQuickRevisionSession.execute).not.toHaveBeenCalled();
  });

  it('maps course quick revision unavailability to 409', async () => {
    const { controller, startCourseQuickRevisionSession } = createController();

    startCourseQuickRevisionSession.execute.mockRejectedValueOnce(
      new CourseQuickRevisionSourceNotReadyError(),
    );

    await expect(
      controller.startQuickRevisionSession(currentStudent, 'course-1'),
    ).rejects.toThrow(ConflictException);

    startCourseQuickRevisionSession.execute.mockRejectedValueOnce(
      new CourseQuickRevisionKnowledgeUnitNotReadyError(),
    );

    await expect(
      controller.startQuickRevisionSession(currentStudent, 'course-1'),
    ).rejects.toThrow(ConflictException);

    startCourseQuickRevisionSession.execute.mockRejectedValueOnce(
      new CourseQuickRevisionQuestionsPreparingError(),
    );

    await expect(
      controller.startQuickRevisionSession(currentStudent, 'course-1'),
    ).rejects.toThrow(ConflictException);

    startCourseQuickRevisionSession.execute.mockRejectedValueOnce(
      new CourseQuickRevisionQuestionCountInvalidError(),
    );

    await expect(
      controller.startQuickRevisionSession(currentStudent, 'course-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('maps course quick revision generation failures to 409', async () => {
    const { controller, startCourseQuickRevisionSession } = createController();

    startCourseQuickRevisionSession.execute.mockRejectedValueOnce(
      new CourseQuickRevisionGenerationFailedError(
        new Error('provider failed'),
      ),
    );

    await expect(
      controller.startQuickRevisionSession(currentStudent, 'course-1'),
    ).rejects.toThrow(ConflictException);
  });
});

const currentStudent = {
  id: 'student-1',
  firebaseUid: 'firebase-1',
  email: 'student@example.test',
  displayName: 'Student',
};

function createController() {
  const createCourse = { execute: jest.fn() };
  const listCourses = { execute: jest.fn() };
  const getCourseDetail = { execute: jest.fn() };
  const deleteCourse = { execute: jest.fn() };
  const deleteCourseDocument = { execute: jest.fn() };
  const uploadCoursePdfForCourse = { execute: jest.fn() };
  const getCourseRevisionSheet = { execute: jest.fn() };
  const generateCourseRevisionSheet = { execute: jest.fn() };
  const startCourseQuickRevisionSession = { execute: jest.fn() };
  const getCourseProgress = { execute: jest.fn() };
  const getSubjectProgress = { execute: jest.fn() };
  const getCourseSourceLifecycle = { execute: jest.fn() };
  const archiveCourseSource = { execute: jest.fn() };

  return {
    controller: new CoursesController(
      createCourse as unknown as CreateCourseUseCase,
      listCourses as unknown as ListSubjectCoursesWithStatsUseCase,
      getCourseDetail as unknown as GetCourseDetailUseCase,
      deleteCourse as unknown as DeleteCourseUseCase,
      deleteCourseDocument as unknown as DeleteCourseDocumentUseCase,
      uploadCoursePdfForCourse as unknown as UploadCoursePdfForCourseUseCase,
      getCourseRevisionSheet as unknown as GetCourseRevisionSheetUseCase,
      generateCourseRevisionSheet as unknown as GenerateCourseRevisionSheetUseCase,
      startCourseQuickRevisionSession as unknown as StartCourseQuickRevisionSessionUseCase,
      getCourseProgress as unknown as GetCourseProgressUseCase,
      getSubjectProgress as unknown as GetSubjectProgressUseCase,
      getCourseSourceLifecycle as unknown as GetCourseSourceLifecycleUseCase,
      archiveCourseSource as unknown as ArchiveCourseSourceUseCase,
    ),
    createCourse,
    listCourses,
    getCourseDetail,
    deleteCourse,
    deleteCourseDocument,
    uploadCoursePdfForCourse,
    getCourseRevisionSheet,
    generateCourseRevisionSheet,
    startCourseQuickRevisionSession,
    getCourseProgress,
    getSubjectProgress,
    getCourseSourceLifecycle,
    archiveCourseSource,
  };
}

function courseWithStats(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    title: 'Droit constitutionnel',
    description: 'Institutions',
    chapterLabel: 'Chapitre 1',
    estimatedMinutes: 30,
    displayOrder: 0,
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
    sourceCount: 0,
    readySourceCount: 0,
    processingSourceCount: 0,
    failedSourceCount: 0,
    ...overrides,
  };
}

function publicCourse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    subjectId: 'subject-1',
    title: 'Droit constitutionnel',
    description: 'Institutions',
    chapterLabel: 'Chapitre 1',
    estimatedMinutes: 30,
    displayOrder: 0,
    createdAt: '2026-06-18T10:00:00.000Z',
    updatedAt: '2026-06-18T10:00:00.000Z',
    sourceCount: 0,
    readySourceCount: 0,
    processingSourceCount: 0,
    failedSourceCount: 0,
    ...overrides,
  };
}

function courseProgress(overrides: Record<string, unknown> = {}) {
  return {
    courseId: 'course-1',
    subjectId: 'subject-1',
    knowledgeUnitCount: 12,
    practicedKnowledgeUnitCount: 3,
    coverage: 0.25,
    mastery: 0.72,
    estimatedGlobalMastery: 0.18,
    readySourceCount: 1,
    processingSourceCount: 0,
    failedSourceCount: 0,
    lastPracticedAt: new Date('2026-06-18T12:00:00.000Z'),
    state: 'PRACTICED',
    ...overrides,
  };
}

function publicCourseProgress(overrides: Record<string, unknown> = {}) {
  return {
    courseId: 'course-1',
    subjectId: 'subject-1',
    knowledgeUnitCount: 12,
    practicedKnowledgeUnitCount: 3,
    coverage: 0.25,
    mastery: 0.72,
    estimatedGlobalMastery: 0.18,
    readySourceCount: 1,
    processingSourceCount: 0,
    failedSourceCount: 0,
    lastPracticedAt: '2026-06-18T12:00:00.000Z',
    state: 'PRACTICED',
    ...overrides,
  };
}

function sourceLifecycleDecision(overrides: Record<string, unknown> = {}) {
  return {
    documentId: 'document-1',
    courseId: 'course-1',
    status: 'ACTIVE',
    recommendedAction: 'ARCHIVE',
    canDelete: false,
    canArchive: true,
    blockingReasons: ['HAS_KNOWLEDGE_UNITS'],
    userMessage: 'Cette source peut etre archivee.',
    ...overrides,
  };
}

function subjectProgress(overrides: Record<string, unknown> = {}) {
  return {
    subjectId: 'subject-1',
    knowledgeUnitCount: 12,
    practicedKnowledgeUnitCount: 3,
    coverage: 0.25,
    mastery: 0.72,
    estimatedGlobalMastery: 0.18,
    courseCount: 1,
    readyCourseCount: 1,
    lastPracticedAt: new Date('2026-06-18T12:00:00.000Z'),
    courses: [
      {
        courseId: 'course-1',
        title: 'Institutions',
        knowledgeUnitCount: 12,
        practicedKnowledgeUnitCount: 3,
        coverage: 0.25,
        mastery: 0.72,
        estimatedGlobalMastery: 0.18,
        state: 'PRACTICED',
      },
    ],
    ...overrides,
  };
}

function publicSubjectProgress(overrides: Record<string, unknown> = {}) {
  return {
    subjectId: 'subject-1',
    knowledgeUnitCount: 12,
    practicedKnowledgeUnitCount: 3,
    coverage: 0.25,
    mastery: 0.72,
    estimatedGlobalMastery: 0.18,
    courseCount: 1,
    readyCourseCount: 1,
    lastPracticedAt: '2026-06-18T12:00:00.000Z',
    courses: [
      {
        courseId: 'course-1',
        title: 'Institutions',
        knowledgeUnitCount: 12,
        practicedKnowledgeUnitCount: 3,
        coverage: 0.25,
        mastery: 0.72,
        estimatedGlobalMastery: 0.18,
        state: 'PRACTICED',
      },
    ],
    ...overrides,
  };
}

function uploadedPdf() {
  return {
    originalname: 'cours.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7'),
    size: 8,
  };
}

function courseDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document-1',
    courseId: 'course-1',
    documentId: 'document-1',
    fileName: 'cours.pdf',
    kind: 'COURSE_PDF',
    status: 'UPLOADED',
    errorCode: null,
    createdAt: new Date('2026-06-18T12:00:00.000Z'),
    updatedAt: new Date('2026-06-18T12:00:00.000Z'),
    ...overrides,
  };
}

function publicCourseDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document-1',
    courseId: 'course-1',
    documentId: 'document-1',
    fileName: 'cours.pdf',
    kind: 'COURSE_PDF',
    status: 'UPLOADED',
    errorCode: null,
    createdAt: '2026-06-18T12:00:00.000Z',
    updatedAt: '2026-06-18T12:00:00.000Z',
    ...overrides,
  };
}

function revisionSheet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sheet-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY',
    title: 'Fiche de cours',
    introduction: 'Introduction',
    keyPoints: ['Point clé'],
    commonMistakes: ['Erreur fréquente'],
    mustKnow: ['À savoir'],
    practiceSuggestions: ['S’entraîner'],
    errorCode: null,
    metadata: {
      flowName: 'documentRevisionSheetGeneration',
      provider: 'mock',
      model: 'mock-model',
      promptVersion: 'generate-revision-sheet-v1',
      schemaVersion: 'revision-sheet-v1',
      generatedAt: new Date('2026-06-18T10:00:00.000Z'),
      sourceStrategy: 'DOCUMENT_CHUNKS_AND_KNOWLEDGE_UNITS',
    },
    sections: [
      {
        id: 'section-1',
        displayOrder: 0,
        title: 'Institutions',
        content: 'Le Parlement contrôle le Gouvernement.',
        sources: [
          {
            chunkId: 'chunk-1',
            text: 'Extrait source',
            pageNumber: 1,
            index: 0,
            relevanceScore: 0.9,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function publicRevisionSheet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sheet-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY',
    title: 'Fiche de cours',
    introduction: 'Introduction',
    keyPoints: ['Point clé'],
    commonMistakes: ['Erreur fréquente'],
    mustKnow: ['À savoir'],
    practiceSuggestions: ['S’entraîner'],
    errorCode: null,
    sections: [
      {
        id: 'section-1',
        displayOrder: 0,
        title: 'Institutions',
        content: 'Le Parlement contrôle le Gouvernement.',
        sources: [
          {
            chunkId: 'chunk-1',
            text: 'Extrait source',
            pageNumber: 1,
            index: 0,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function revisionSessionResponse() {
  return {
    session: {
      id: 'session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      mode: 'QUICK',
      createdAt: new Date('2026-06-18T10:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-1',
      kind: 'DIAGNOSTIC_QUIZ',
      status: 'READY',
      displayOrder: 0,
      activitySessionId: 'activity-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      payload: {
        type: 'diagnostic_quiz',
        sessionId: 'activity-1',
      },
    },
    history: [],
  };
}

~~~

### `src/modules/courses/interfaces/courses.controller.ts`

~~~text
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import type { AuthenticatedStudent } from '../../auth/interfaces/authenticated-student';
import {
  CourseRevisionSheetSourceNotReadyError,
  GenerateCourseRevisionSheetUseCase,
  GetCourseRevisionSheetUseCase,
} from '../application/course-revision-sheet.use-case';
import {
  GetCourseProgressUseCase,
  GetSubjectProgressUseCase,
} from '../application/course-progress.use-case';
import {
  ArchiveCourseSourceUseCase,
  GetCourseSourceLifecycleUseCase,
} from '../application/course-source-lifecycle.use-case';
import {
  QUICK_QUESTION_BANK_MAX_QUESTION_COUNT,
  QUICK_QUESTION_BANK_MIN_QUESTION_COUNT,
} from '../../activities/application/question-bank.service';
import {
  CourseQuickRevisionGenerationFailedError,
  CourseQuickRevisionKnowledgeUnitNotReadyError,
  CourseQuickRevisionQuestionCountInvalidError,
  CourseQuickRevisionQuestionsPreparingError,
  CourseQuickRevisionSourceNotReadyError,
  StartCourseQuickRevisionSessionUseCase,
} from '../application/start-course-quick-revision-session.use-case';
import { toPublicRevisionSheet } from '../../study-artifacts/interfaces/study-artifact-response.mapper';
import {
  MAX_DOCUMENT_BYTES,
  type UploadedCoursePdfFile,
  validateCoursePdfFile,
} from '../../documents/interfaces/course-pdf-upload.validator';
import { CreateCourseUseCase } from '../application/create-course.use-case';
import { DeleteCourseDocumentUseCase } from '../application/delete-course-document.use-case';
import { DeleteCourseUseCase } from '../application/delete-course.use-case';
import { GetCourseDetailUseCase } from '../application/get-course-detail.use-case';
import { ListSubjectCoursesWithStatsUseCase } from '../application/list-subject-courses-with-stats.use-case';
import { UploadCoursePdfForCourseUseCase } from '../application/upload-course-pdf-for-course.use-case';
import { CourseContainsDocumentsError } from '../domain/course.entity';
import {
  SourceArchiveBlockedError,
  SourceDeleteBlockedError,
} from '../../documents/domain/source-lifecycle.entity';
import type { CreateCourseRequest } from './create-course.request';
import {
  toCourseDocumentResponse,
  toCourseDetailResponse,
  toCourseListItemResponse,
  toCourseProgressResponse,
  toSubjectProgressResponse,
} from './course-response.dto';

const MAX_COURSE_TITLE_LENGTH = 140;
const MAX_COURSE_DESCRIPTION_LENGTH = 1000;
const MAX_COURSE_CHAPTER_LABEL_LENGTH = 120;
const MAX_COURSE_ESTIMATED_MINUTES = 1440;

@Controller()
@UseGuards(FirebaseAuthGuard)
export class CoursesController {
  constructor(
    private readonly createCourse: CreateCourseUseCase,
    private readonly listCourses: ListSubjectCoursesWithStatsUseCase,
    private readonly getCourseDetail: GetCourseDetailUseCase,
    private readonly deleteCourseUseCase: DeleteCourseUseCase,
    private readonly deleteCourseDocumentUseCase: DeleteCourseDocumentUseCase,
    private readonly uploadCoursePdfForCourseUseCase: UploadCoursePdfForCourseUseCase,
    private readonly getCourseRevisionSheetUseCase: GetCourseRevisionSheetUseCase,
    private readonly generateCourseRevisionSheetUseCase: GenerateCourseRevisionSheetUseCase,
    private readonly startCourseQuickRevisionSessionUseCase: StartCourseQuickRevisionSessionUseCase,
    private readonly getCourseProgressUseCase: GetCourseProgressUseCase,
    private readonly getSubjectProgressUseCase: GetSubjectProgressUseCase,
    private readonly getCourseSourceLifecycleUseCase: GetCourseSourceLifecycleUseCase,
    private readonly archiveCourseSourceUseCase: ArchiveCourseSourceUseCase,
  ) {}

  @Get('subjects/:subjectId/courses')
  listForSubject(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('subjectId') subjectId: string,
  ) {
    return this.listCourses
      .execute({
        studentId: student.id,
        subjectId: trimRequiredString(
          subjectId,
          'Course subjectId is required',
        ),
      })
      .then((courses) => courses.map(toCourseListItemResponse))
      .catch(normalizeCourseError);
  }

  @Post('subjects/:subjectId/courses')
  createForSubject(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('subjectId') subjectId: string,
    @Body() body: CreateCourseRequest,
  ) {
    const validatedBody = validateCreateCourseBody(body);

    return this.createCourse
      .execute({
        studentId: student.id,
        subjectId: trimRequiredString(
          subjectId,
          'Course subjectId is required',
        ),
        title: validatedBody.title,
        description: validatedBody.description,
        chapterLabel: validatedBody.chapterLabel,
        estimatedMinutes: validatedBody.estimatedMinutes,
      })
      .then((course) =>
        toCourseListItemResponse({
          ...course,
          sourceCount: 0,
          readySourceCount: 0,
          processingSourceCount: 0,
          failedSourceCount: 0,
        }),
      )
      .catch(normalizeCourseError);
  }

  @Get('courses/:courseId')
  getCourse(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ) {
    return this.getCourseDetail
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .then(toCourseDetailResponse)
      .catch(normalizeCourseError);
  }

  @Get('courses/:courseId/progress')
  getCourseProgress(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ) {
    return this.getCourseProgressUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .then(toCourseProgressResponse)
      .catch(normalizeCourseError);
  }

  @Get('subjects/:subjectId/progress')
  getSubjectProgress(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('subjectId') subjectId: string,
  ) {
    return this.getSubjectProgressUseCase
      .execute({
        studentId: student.id,
        subjectId: trimRequiredString(
          subjectId,
          'Course subjectId is required',
        ),
      })
      .then(toSubjectProgressResponse)
      .catch(normalizeCourseError);
  }

  @Delete('courses/:courseId')
  @HttpCode(204)
  async deleteCourse(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ): Promise<void> {
    await this.deleteCourseUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .catch(normalizeCourseError);
  }

  @Delete('courses/:courseId/sources/:documentId')
  @HttpCode(204)
  async deleteCourseDocument(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Param('documentId') documentId: string,
  ): Promise<void> {
    await this.deleteCourseDocumentUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        documentId: trimRequiredString(documentId, 'Document id is required'),
      })
      .catch(normalizeCourseError);
  }

  @Get('courses/:courseId/sources/:documentId/lifecycle')
  getCourseSourceLifecycle(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.getCourseSourceLifecycleUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        documentId: trimRequiredString(documentId, 'Document id is required'),
      })
      .catch(normalizeCourseError);
  }

  @Post('courses/:courseId/sources/:documentId/archive')
  archiveCourseSource(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.archiveCourseSourceUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        documentId: trimRequiredString(documentId, 'Document id is required'),
      })
      .catch(normalizeCourseError);
  }

  @Post('courses/:courseId/source/course-pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_DOCUMENT_BYTES },
    }),
  )
  uploadCoursePdfForCourse(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @UploadedFile() file: UploadedCoursePdfFile | undefined,
    @Body() body: Record<string, unknown> = {},
  ) {
    rejectClientOwnedUploadFields(body);

    const validatedFile = validateCoursePdfFile(file);

    return this.uploadCoursePdfForCourseUseCase
      .execute({
        studentId: student.id,
        firebaseUid: student.firebaseUid,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        originalFileName: validatedFile.originalFileName,
        content: validatedFile.content,
        mimeType: validatedFile.mimeType,
      })
      .then(toCourseDocumentResponse)
      .catch(normalizeCourseError);
  }

  @Get('courses/:courseId/revision-sheet')
  getCourseRevisionSheet(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ) {
    return this.getCourseRevisionSheetUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .then((revisionSheet) => {
        if (!revisionSheet) {
          throw new NotFoundException('Revision sheet not found');
        }

        return toPublicRevisionSheet(revisionSheet);
      })
      .catch(normalizeCourseError);
  }

  @Post('courses/:courseId/revision-sheet')
  generateCourseRevisionSheet(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ) {
    return this.generateCourseRevisionSheetUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .then(toPublicRevisionSheet)
      .catch(normalizeCourseError);
  }

  @Post('courses/:courseId/revision-sessions/quick')
  startQuickRevisionSession(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @Body() body: Record<string, unknown> = {},
  ) {
    const validatedBody = validateQuickRevisionBody(body);

    return this.startCourseQuickRevisionSessionUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        questionCount: validatedBody.questionCount,
      })
      .catch(normalizeCourseError);
  }
}

function validateCreateCourseBody(body: CreateCourseRequest) {
  const title = trimRequiredString(
    body?.title,
    'Course title must contain at least 2 characters',
    MAX_COURSE_TITLE_LENGTH,
  );

  if (title.length < 2) {
    throw new BadRequestException(
      'Course title must contain at least 2 characters',
    );
  }

  return {
    title,
    description: trimOptionalString(
      body.description,
      'Course description is too long',
      MAX_COURSE_DESCRIPTION_LENGTH,
    ),
    chapterLabel: trimOptionalString(
      body.chapterLabel,
      'Course chapterLabel is too long',
      MAX_COURSE_CHAPTER_LABEL_LENGTH,
    ),
    estimatedMinutes: normalizeEstimatedMinutes(body.estimatedMinutes),
  };
}

function trimRequiredString(value: unknown, message: string, maxLength = 255) {
  if (typeof value !== 'string') {
    throw new BadRequestException(message);
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed.length > maxLength) {
    throw new BadRequestException(message);
  }

  return trimmed;
}

function trimOptionalString(
  value: unknown,
  message: string,
  maxLength: number,
) {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(message);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length > maxLength) {
    throw new BadRequestException(message);
  }

  return trimmed;
}

function normalizeEstimatedMinutes(value: unknown) {
  if (value == null) {
    return null;
  }

  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_COURSE_ESTIMATED_MINUTES
  ) {
    throw new BadRequestException(
      'Course estimatedMinutes must be an integer between 1 and 1440',
    );
  }

  return value;
}

function rejectClientOwnedUploadFields(body: Record<string, unknown> = {}) {
  if ('studentId' in body || 'subjectId' in body || 'courseId' in body) {
    throw new BadRequestException(
      'Course upload only accepts the multipart file field',
    );
  }
}

function validateQuickRevisionBody(body: Record<string, unknown> = {}): {
  questionCount?: number;
} {
  if (
    'studentId' in body ||
    'subjectId' in body ||
    'documentId' in body ||
    'knowledgeUnitId' in body ||
    'courseId' in body
  ) {
    throw new BadRequestException(
      'Course quick revision only accepts courseId from the URL',
    );
  }

  const allowedFields = new Set(['questionCount']);
  const unknownField = Object.keys(body).find(
    (field) => !allowedFields.has(field),
  );

  if (unknownField) {
    throw new BadRequestException(
      'Course quick revision only accepts questionCount in the body',
    );
  }

  if (!('questionCount' in body)) {
    return {};
  }

  const questionCount = body.questionCount;

  if (
    typeof questionCount !== 'number' ||
    !Number.isInteger(questionCount) ||
    questionCount < QUICK_QUESTION_BANK_MIN_QUESTION_COUNT ||
    questionCount > QUICK_QUESTION_BANK_MAX_QUESTION_COUNT
  ) {
    throw new BadRequestException(
      'Course quick revision questionCount must be an integer between 5 and 30',
    );
  }

  return { questionCount };
}

function normalizeCourseError(error: unknown): never {
  if (error instanceof BadRequestException) {
    throw error;
  }

  if (error instanceof CourseContainsDocumentsError) {
    throw new ConflictException('Course contains documents');
  }

  if (
    error instanceof SourceDeleteBlockedError ||
    error instanceof SourceArchiveBlockedError
  ) {
    throw new ConflictException({
      code: error.code,
      message: error.message,
      decision: error.decision,
    });
  }

  if (error instanceof CourseRevisionSheetSourceNotReadyError) {
    throw new ConflictException(error.message);
  }

  if (
    error instanceof CourseQuickRevisionSourceNotReadyError ||
    error instanceof CourseQuickRevisionKnowledgeUnitNotReadyError ||
    error instanceof CourseQuickRevisionGenerationFailedError ||
    error instanceof CourseQuickRevisionQuestionsPreparingError
  ) {
    throw new ConflictException(error.message);
  }

  if (error instanceof CourseQuickRevisionQuestionCountInvalidError) {
    throw new BadRequestException(error.message);
  }

  if (
    error instanceof Error &&
    (error.message === 'Course not found' ||
      error.message === 'Course subject not found')
  ) {
    throw new NotFoundException(error.message);
  }

  if (
    error instanceof Error &&
    (error.message === 'Course title must contain at least 2 characters' ||
      error.message ===
        'Course estimatedMinutes must be an integer between 1 and 1440' ||
      error.message === 'subjectId is required' ||
      error.message === 'courseId is required')
  ) {
    throw new BadRequestException(error.message);
  }

  throw error;
}

~~~

### `src/modules/documents/application/documents.repository.ts`

~~~text
import { StudentId } from '../../../shared/domain/student-id';
import type { DocumentKind, DocumentStatus } from '../domain/document.entity';
import type { SourceLifecycleDecision } from '../domain/source-lifecycle.entity';

export type { DocumentKind, DocumentStatus };

export interface RevisionDocumentDto {
  id: string;
  studentId: StudentId;
  subjectId: string;
  courseId: string | null;
  kind: DocumentKind;
  fileName: string;
  storagePath: string;
  mimeType: string;
  status: DocumentStatus;
  errorCode: string | null;
  archivedAt?: Date | null;
  archivedReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicRevisionDocumentDto {
  id: string;
  subjectId: string;
  kind: DocumentKind;
  fileName: string;
  mimeType: string;
  status: DocumentStatus;
  errorCode: string | null;
}

export type KnowledgeUnitDifficulty = 'LOW' | 'MEDIUM' | 'HIGH';

export interface KnowledgeUnitPersistenceInput {
  title: string;
  summary: string;
  difficulty?: KnowledgeUnitDifficulty | null;
  displayOrder?: number | null;
  confidence?: number | null;
  extractionPromptVersion?: string | null;
  extractionSchemaVersion?: string | null;
  sourceChunkIds?: string[] | null;
}

export interface DocumentChunkPersistenceInput {
  index: number;
  text: string;
  charStart?: number | null;
  charEnd?: number | null;
  pageNumber?: number | null;
}

export interface RevisionDocumentChunkDto {
  id: string;
  documentId: string;
  subjectId: string;
  index: number;
  text: string;
  charStart: number | null;
  charEnd: number | null;
  pageNumber: number | null;
  createdAt: Date;
}

export interface KnowledgeUnitSourcePersistenceInput {
  chunkId: string;
  relevanceScore?: number | null;
}

export interface DocumentKnowledgeUnitSourceDto {
  chunkId: string;
  text: string;
  pageNumber: number | null;
  index: number;
}

export interface DocumentKnowledgeUnitDto {
  id: string;
  title: string;
  summary: string;
  difficulty: KnowledgeUnitDifficulty | null;
  displayOrder: number | null;
  confidence: number | null;
  sources: DocumentKnowledgeUnitSourceDto[];
}

export interface DocumentKnowledgeUnitsDto {
  documentId: string;
  documentStatus: DocumentStatus;
  items: DocumentKnowledgeUnitDto[];
}

export const DOCUMENTS_REPOSITORY = Symbol('DOCUMENTS_REPOSITORY');

export interface DocumentsRepository {
  create(input: {
    studentId: StudentId;
    subjectId: string;
    courseId?: string | null;
    kind: DocumentKind;
    fileName: string;
    storagePath: string;
    mimeType: string;
  }): Promise<RevisionDocumentDto>;

  findBySubjectForStudent(input: {
    studentId: StudentId;
    subjectId: string;
  }): Promise<RevisionDocumentDto[]>;

  findByIdForStudent(input: {
    studentId: StudentId;
    documentId: string;
  }): Promise<RevisionDocumentDto | null>;

  getLifecycleDecisionForStudent(input: {
    studentId: StudentId;
    documentId: string;
    courseId?: string | null;
  }): Promise<SourceLifecycleDecision | null>;

  archiveForStudent(input: {
    studentId: StudentId;
    documentId: string;
    courseId?: string | null;
    reason?: string | null;
  }): Promise<SourceLifecycleDecision | null>;

  deleteForStudent(input: {
    studentId: StudentId;
    documentId: string;
  }): Promise<boolean>;

  deleteCourseDocumentForStudent(input: {
    studentId: StudentId;
    courseId: string;
    documentId: string;
  }): Promise<boolean>;

  findById(documentId: string): Promise<RevisionDocumentDto | null>;

  markProcessing(documentId: string): Promise<void>;

  markReadyWithKnowledgeUnits(input: {
    documentId: string;
    units: KnowledgeUnitPersistenceInput[];
  }): Promise<void>;

  replaceChunks(input: {
    documentId: string;
    chunks: DocumentChunkPersistenceInput[];
  }): Promise<void>;

  findChunksByDocumentId(
    documentId: string,
  ): Promise<RevisionDocumentChunkDto[]>;

  findKnowledgeUnitsByDocumentForStudent(input: {
    studentId: StudentId;
    documentId: string;
  }): Promise<DocumentKnowledgeUnitsDto | null>;

  replaceKnowledgeUnitSources(input: {
    knowledgeUnitId: string;
    subjectId: string;
    sources: KnowledgeUnitSourcePersistenceInput[];
  }): Promise<void>;

  markFailed(input: { documentId: string; errorCode: string }): Promise<void>;
}

~~~

### `src/modules/documents/application/source-lifecycle.use-case.ts`

~~~text
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DOCUMENTS_REPOSITORY,
  type DocumentsRepository,
} from './documents.repository';
import type { SourceLifecycleDecision } from '../domain/source-lifecycle.entity';

@Injectable()
export class GetDocumentSourceLifecycleUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async execute(input: {
    studentId: string;
    documentId: string;
  }): Promise<SourceLifecycleDecision> {
    const decision =
      await this.documentsRepository.getLifecycleDecisionForStudent(input);

    if (!decision) {
      throw new NotFoundException('Document not found');
    }

    return decision;
  }
}

@Injectable()
export class ArchiveDocumentUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async execute(input: {
    studentId: string;
    documentId: string;
  }): Promise<SourceLifecycleDecision> {
    const decision = await this.documentsRepository.archiveForStudent({
      ...input,
      reason: 'USER_ARCHIVED_DOCUMENT',
    });

    if (!decision) {
      throw new NotFoundException('Document not found');
    }

    return decision;
  }
}

~~~

### `src/modules/documents/documents.module.ts`

~~~text
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../jobs/jobs.module';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { DOCUMENT_FILE_STORAGE } from './application/document-file-storage';
import { DOCUMENTS_REPOSITORY } from './application/documents.repository';
import { DeleteDocumentUseCase } from './application/delete-document.use-case';
import { GetDocumentUseCase } from './application/get-document.use-case';
import { ListDocumentKnowledgeUnitsUseCase } from './application/list-document-knowledge-units.use-case';
import { ListSubjectDocumentsUseCase } from './application/list-subject-documents.use-case';
import { RegisterDocumentUseCase } from './application/register-document.use-case';
import {
  ArchiveDocumentUseCase,
  GetDocumentSourceLifecycleUseCase,
} from './application/source-lifecycle.use-case';
import { UploadCoursePdfUseCase } from './application/upload-course-pdf.use-case';
import { LocalDocumentFileStorage } from './infrastructure/local-document-file-storage';
import { PrismaDocumentsRepository } from './infrastructure/prisma-documents.repository';
import { DocumentsController } from './interfaces/documents.controller';

@Module({
  imports: [AuthModule, JobsModule, PrismaModule],
  controllers: [DocumentsController],
  providers: [
    DeleteDocumentUseCase,
    GetDocumentUseCase,
    ListDocumentKnowledgeUnitsUseCase,
    ListSubjectDocumentsUseCase,
    RegisterDocumentUseCase,
    GetDocumentSourceLifecycleUseCase,
    ArchiveDocumentUseCase,
    UploadCoursePdfUseCase,
    {
      provide: DOCUMENTS_REPOSITORY,
      useClass: PrismaDocumentsRepository,
    },
    {
      provide: DOCUMENT_FILE_STORAGE,
      useClass: LocalDocumentFileStorage,
    },
  ],
  exports: [DOCUMENTS_REPOSITORY, DOCUMENT_FILE_STORAGE],
})
export class DocumentsModule {}

~~~

### `src/modules/documents/domain/source-lifecycle.entity.spec.ts`

~~~text
import { buildSourceLifecycleDecision } from './source-lifecycle.entity';

describe('buildSourceLifecycleDecision', () => {
  it('blocks uploaded and processing sources', () => {
    expect(
      buildSourceLifecycleDecision({
        documentId: 'document-1',
        courseId: 'course-1',
        status: 'PROCESSING',
        archivedAt: null,
        dependencyCounts: {},
      }),
    ).toMatchObject({
      recommendedAction: 'BLOCK',
      canDelete: false,
      canArchive: false,
      blockingReasons: ['SOURCE_PROCESSING'],
    });
  });

  it('recommends archive when the source has learning dependencies', () => {
    expect(
      buildSourceLifecycleDecision({
        documentId: 'document-1',
        courseId: 'course-1',
        status: 'READY',
        archivedAt: null,
        dependencyCounts: {
          HAS_KNOWLEDGE_UNITS: 3,
          HAS_REVISION_SESSIONS: 1,
        },
      }),
    ).toMatchObject({
      recommendedAction: 'ARCHIVE',
      canDelete: false,
      canArchive: true,
      blockingReasons: ['HAS_KNOWLEDGE_UNITS', 'HAS_REVISION_SESSIONS'],
    });
  });

  it('allows deletion when no learning dependency exists', () => {
    expect(
      buildSourceLifecycleDecision({
        documentId: 'document-1',
        courseId: null,
        status: 'FAILED',
        archivedAt: null,
        dependencyCounts: {},
      }),
    ).toMatchObject({
      recommendedAction: 'DELETE',
      canDelete: true,
      canArchive: true,
      blockingReasons: [],
    });
  });

  it('blocks any further lifecycle action on already archived sources', () => {
    expect(
      buildSourceLifecycleDecision({
        documentId: 'document-1',
        courseId: 'course-1',
        status: 'READY',
        archivedAt: new Date('2026-06-21T10:00:00.000Z'),
        dependencyCounts: {},
      }),
    ).toMatchObject({
      status: 'ARCHIVED',
      recommendedAction: 'BLOCK',
      canDelete: false,
      canArchive: false,
      blockingReasons: ['ALREADY_ARCHIVED'],
    });
  });
});

~~~

### `src/modules/documents/domain/source-lifecycle.entity.ts`

~~~text
import type { DocumentStatus } from './document.entity';

export type SourceLifecycleStatus = 'ACTIVE' | 'ARCHIVED';

export type SourceLifecycleRecommendedAction = 'DELETE' | 'ARCHIVE' | 'BLOCK';

export type SourceLifecycleReason =
  | 'ALREADY_ARCHIVED'
  | 'SOURCE_PROCESSING'
  | 'HAS_DOCUMENT_CHUNKS'
  | 'HAS_KNOWLEDGE_UNITS'
  | 'HAS_SUMMARY'
  | 'HAS_REVISION_SHEET'
  | 'HAS_QUESTION_BANK_ITEMS'
  | 'HAS_REVISION_SESSIONS'
  | 'HAS_REVISION_SESSION_ACTIONS'
  | 'HAS_OPEN_QUESTIONS'
  | 'HAS_ACTIVITY_SESSIONS'
  | 'HAS_QUESTIONS'
  | 'HAS_RICH_CLOSED_PAYLOADS';

export interface SourceLifecycleDecision {
  documentId: string;
  courseId: string | null;
  status: SourceLifecycleStatus;
  recommendedAction: SourceLifecycleRecommendedAction;
  canDelete: boolean;
  canArchive: boolean;
  blockingReasons: SourceLifecycleReason[];
  userMessage: string;
}

export interface SourceLifecycleInput {
  documentId: string;
  courseId: string | null;
  status: DocumentStatus;
  archivedAt: Date | null;
  dependencyCounts: Partial<Record<SourceLifecycleReason, number>>;
}

export class SourceDeleteBlockedError extends Error {
  readonly code = 'SOURCE_DELETE_BLOCKED';

  constructor(readonly decision: SourceLifecycleDecision) {
    super(decision.userMessage);
  }
}

export class SourceArchiveBlockedError extends Error {
  readonly code = 'SOURCE_ARCHIVE_BLOCKED';

  constructor(readonly decision: SourceLifecycleDecision) {
    super(decision.userMessage);
  }
}

export function buildSourceLifecycleDecision(
  input: SourceLifecycleInput,
): SourceLifecycleDecision {
  if (input.archivedAt) {
    return {
      documentId: input.documentId,
      courseId: input.courseId,
      status: 'ARCHIVED',
      recommendedAction: 'BLOCK',
      canDelete: false,
      canArchive: false,
      blockingReasons: ['ALREADY_ARCHIVED'],
      userMessage: 'Cette source est deja archivee.',
    };
  }

  if (input.status === 'UPLOADED' || input.status === 'PROCESSING') {
    return {
      documentId: input.documentId,
      courseId: input.courseId,
      status: 'ACTIVE',
      recommendedAction: 'BLOCK',
      canDelete: false,
      canArchive: false,
      blockingReasons: ['SOURCE_PROCESSING'],
      userMessage:
        "Cette source est encore en cours d'analyse. Reessaie quand l'analyse sera terminee.",
    };
  }

  const reasons = usedSourceReasons(input.dependencyCounts);

  if (reasons.length > 0) {
    return {
      documentId: input.documentId,
      courseId: input.courseId,
      status: 'ACTIVE',
      recommendedAction: 'ARCHIVE',
      canDelete: false,
      canArchive: true,
      blockingReasons: reasons,
      userMessage:
        "Cette source a deja servi a construire ton cours. Elle peut etre archivee, mais pas supprimee sans perdre l'historique.",
    };
  }

  return {
    documentId: input.documentId,
    courseId: input.courseId,
    status: 'ACTIVE',
    recommendedAction: 'DELETE',
    canDelete: true,
    canArchive: true,
    blockingReasons: [],
    userMessage:
      "Cette source n'a pas encore servi a construire un historique. Elle peut etre supprimee.",
  };
}

function usedSourceReasons(
  dependencyCounts: Partial<Record<SourceLifecycleReason, number>>,
): SourceLifecycleReason[] {
  const reasons: SourceLifecycleReason[] = [
    'HAS_DOCUMENT_CHUNKS',
    'HAS_KNOWLEDGE_UNITS',
    'HAS_SUMMARY',
    'HAS_REVISION_SHEET',
    'HAS_QUESTION_BANK_ITEMS',
    'HAS_REVISION_SESSIONS',
    'HAS_REVISION_SESSION_ACTIONS',
    'HAS_OPEN_QUESTIONS',
    'HAS_ACTIVITY_SESSIONS',
    'HAS_QUESTIONS',
    'HAS_RICH_CLOSED_PAYLOADS',
  ];

  return reasons.filter((reason) => (dependencyCounts[reason] ?? 0) > 0);
}

~~~

### `src/modules/documents/infrastructure/prisma-documents.repository.spec.ts`

~~~text
import { PrismaDocumentsRepository } from './prisma-documents.repository';
import { SourceDeleteBlockedError } from '../domain/source-lifecycle.entity';

type DocumentRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  courseId: string | null;
  kind: 'COURSE_PDF' | 'EXAM_PDF' | 'EXAM_IMAGE';
  fileName: string;
  storagePath: string;
  mimeType: string;
  status: 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';
  errorCode?: string | null;
  archivedAt?: Date | null;
  archivedReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaDocumentsMock = {
  subject: {
    findFirst: jest.Mock;
  };
  document: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  documentProcessingJob: {
    create: jest.Mock;
    updateMany: jest.Mock;
  };
  knowledgeUnit: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    createMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  documentChunk: {
    count: jest.Mock;
    deleteMany: jest.Mock;
    createMany: jest.Mock;
    findMany: jest.Mock;
  };
  summary: {
    count: jest.Mock;
  };
  revisionSheet: {
    count: jest.Mock;
  };
  questionBankItem: {
    count: jest.Mock;
  };
  revisionSession: {
    count: jest.Mock;
  };
  revisionSessionAction: {
    count: jest.Mock;
  };
  openQuestion: {
    count: jest.Mock;
  };
  activitySession: {
    count: jest.Mock;
  };
  question: {
    count: jest.Mock;
  };
  richClosedExercisePayload: {
    count: jest.Mock;
  };
  knowledgeUnitSource: {
    deleteMany: jest.Mock;
    createMany: jest.Mock;
  };
  $transaction: jest.Mock<Promise<unknown>, [TransactionCallback]>;
};

type TransactionCallback = (tx: PrismaDocumentsMock) => unknown;

describe('PrismaDocumentsRepository', () => {
  const createRepository = () => {
    const prisma: PrismaDocumentsMock = {
      subject: {
        findFirst: jest.fn(),
      },
      document: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      documentProcessingJob: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      knowledgeUnit: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      documentChunk: {
        count: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
      },
      summary: { count: jest.fn() },
      revisionSheet: { count: jest.fn() },
      questionBankItem: { count: jest.fn() },
      revisionSession: { count: jest.fn() },
      revisionSessionAction: { count: jest.fn() },
      openQuestion: { count: jest.fn() },
      activitySession: { count: jest.fn() },
      question: { count: jest.fn() },
      richClosedExercisePayload: { count: jest.fn() },
      knowledgeUnitSource: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn<Promise<unknown>, [TransactionCallback]>(),
    };
    prisma.$transaction.mockImplementation((callback) =>
      Promise.resolve(callback(prisma)),
    );
    mockZeroDependencyCounts(prisma);

    return {
      prisma,
      repository: new PrismaDocumentsRepository(prisma as never),
    };
  };

  const record = (input: Partial<DocumentRecord> = {}): DocumentRecord => ({
    id: 'document-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    courseId: null,
    kind: 'COURSE_PDF',
    fileName: 'cours.pdf',
    storagePath: 'students/student-1/subjects/subject-1/cours.pdf',
    mimeType: 'application/pdf',
    status: 'UPLOADED',
    errorCode: null,
    archivedAt: null,
    archivedReason: null,
    createdAt: new Date('2026-06-18T12:00:00.000Z'),
    updatedAt: new Date('2026-06-18T12:00:00.000Z'),
    ...input,
  });

  const mockZeroDependencyCounts = (prisma: PrismaDocumentsMock) => {
    prisma.documentChunk.count.mockResolvedValue(0);
    prisma.knowledgeUnit.count.mockResolvedValue(0);
    prisma.summary.count.mockResolvedValue(0);
    prisma.revisionSheet.count.mockResolvedValue(0);
    prisma.questionBankItem.count.mockResolvedValue(0);
    prisma.revisionSession.count.mockResolvedValue(0);
    prisma.revisionSessionAction.count.mockResolvedValue(0);
    prisma.openQuestion.count.mockResolvedValue(0);
    prisma.activitySession.count.mockResolvedValue(0);
    prisma.question.count.mockResolvedValue(0);
    prisma.richClosedExercisePayload.count.mockResolvedValue(0);
  };

  it('creates a document and pending processing job in one transaction', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.document.create.mockResolvedValue(record());

    const document = await repository.create({
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: ' cours.pdf ',
      storagePath: ' students/student-1/subjects/subject-1/cours.pdf ',
      mimeType: ' application/pdf ',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.subject.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'subject-1',
        studentId: 'student-1',
      },
    });
    expect(prisma.document.create).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: null,
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/student-1/subjects/subject-1/cours.pdf',
        mimeType: 'application/pdf',
      },
    });
    expect(prisma.documentProcessingJob.create).toHaveBeenCalledWith({
      data: {
        documentId: 'document-1',
        status: 'PENDING',
      },
    });
    expect(document).toMatchObject({
      id: 'document-1',
      status: 'UPLOADED',
    });
  });

  it('creates a course-attached document when courseId is provided', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.document.create.mockResolvedValue(record({ courseId: 'course-1' }));

    const document = await repository.create({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      kind: 'COURSE_PDF',
      fileName: 'cours.pdf',
      storagePath: 'students/student-1/subjects/subject-1/cours.pdf',
      mimeType: 'application/pdf',
    });

    expect(prisma.document.create).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/student-1/subjects/subject-1/cours.pdf',
        mimeType: 'application/pdf',
      },
    });
    expect(document.courseId).toBe('course-1');
  });

  it('does not create a document when the subject is not owned by the student', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue(null);

    await expect(
      repository.create({
        studentId: 'student-1',
        subjectId: 'subject-2',
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/student-1/subjects/subject-2/cours.pdf',
        mimeType: 'application/pdf',
      }),
    ).rejects.toThrow('Subject does not belong to student');

    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(prisma.documentProcessingJob.create).not.toHaveBeenCalled();
  });

  it('lists documents for a subject owned by the student', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.document.findMany.mockResolvedValue([
      record({ id: 'document-1' }),
      record({ id: 'document-2', status: 'READY' }),
    ]);

    const documents = await repository.findBySubjectForStudent({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });

    expect(prisma.subject.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'subject-1',
        studentId: 'student-1',
      },
    });
    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        archivedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(documents.map((document) => document.id)).toEqual([
      'document-1',
      'document-2',
    ]);
  });

  it('rejects document listing for subjects not owned by the student', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue(null);

    await expect(
      repository.findBySubjectForStudent({
        studentId: 'student-1',
        subjectId: 'subject-2',
      }),
    ).rejects.toThrow('Subject does not belong to student');

    expect(prisma.document.findMany).not.toHaveBeenCalled();
  });

  it('finds a document by id for its student owner', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(record());

    const document = await repository.findByIdForStudent({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        studentId: 'student-1',
        archivedAt: null,
      },
    });
    expect(document?.id).toBe('document-1');
  });

  it('finds a document by id for internal worker processing', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(record());

    const document = await repository.findById('document-1');

    expect(prisma.document.findUnique).toHaveBeenCalledWith({
      where: { id: 'document-1' },
    });
    expect(document?.storagePath).toBe(
      'students/student-1/subjects/subject-1/cours.pdf',
    );
  });

  it('returns the stored processing error code for failed documents', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(
      record({
        status: 'FAILED',
        errorCode: 'KNOWLEDGE_EXTRACTION_FAILED',
      }),
    );

    const document = await repository.findByIdForStudent({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(document).toMatchObject({
      id: 'document-1',
      status: 'FAILED',
      errorCode: 'KNOWLEDGE_EXTRACTION_FAILED',
    });
  });

  it('deletes a safe document owned by a student without deleting learning history', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(record({ status: 'FAILED' }));
    prisma.document.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      repository.deleteForStudent({
        studentId: 'student-1',
        documentId: 'document-1',
      }),
    ).resolves.toBe(true);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        studentId: 'student-1',
      },
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        courseId: true,
        status: true,
        archivedAt: true,
      },
    });
    expect(prisma.knowledgeUnit.deleteMany).not.toHaveBeenCalled();
    expect(prisma.document.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        studentId: 'student-1',
      },
    });
  });

  it('returns false without deleting dependents for unknown or cross-student documents', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(
      repository.deleteForStudent({
        studentId: 'student-1',
        documentId: 'document-2',
      }),
    ).resolves.toBe(false);

    expect(prisma.knowledgeUnit.deleteMany).not.toHaveBeenCalled();
    expect(prisma.document.deleteMany).not.toHaveBeenCalled();
  });

  it('blocks deletion and recommends archive when a document has learning history', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(record({ status: 'READY' }));
    prisma.knowledgeUnit.count.mockResolvedValue(2);

    await expect(
      repository.deleteForStudent({
        studentId: 'student-1',
        documentId: 'document-1',
      }),
    ).rejects.toThrow(SourceDeleteBlockedError);

    expect(prisma.knowledgeUnit.deleteMany).not.toHaveBeenCalled();
    expect(prisma.document.deleteMany).not.toHaveBeenCalled();
  });

  it('returns a lifecycle decision for a source with learning dependencies', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(
      record({ status: 'READY', courseId: 'course-1' }),
    );
    prisma.documentChunk.count.mockResolvedValue(1);
    prisma.revisionSession.count.mockResolvedValue(1);

    await expect(
      repository.getLifecycleDecisionForStudent({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-1',
      }),
    ).resolves.toMatchObject({
      documentId: 'document-1',
      courseId: 'course-1',
      recommendedAction: 'ARCHIVE',
      canDelete: false,
      canArchive: true,
      blockingReasons: ['HAS_DOCUMENT_CHUNKS', 'HAS_REVISION_SESSIONS'],
    });
  });

  it('archives an active source without deleting dependents', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(
      record({ status: 'READY', courseId: 'course-1' }),
    );
    prisma.knowledgeUnit.count.mockResolvedValue(1);
    prisma.document.updateMany.mockResolvedValue({ count: 1 });

    const decision = await repository.archiveForStudent({
      studentId: 'student-1',
      courseId: 'course-1',
      documentId: 'document-1',
      reason: 'USER_ARCHIVED_COURSE_SOURCE',
    });

    expect(decision).toMatchObject({
      status: 'ARCHIVED',
      recommendedAction: 'BLOCK',
      canDelete: false,
      canArchive: false,
    });
    expect(prisma.document.updateMany).toHaveBeenCalledTimes(1);
    const updateManyCalls = prisma.document.updateMany.mock.calls as [
      [
        {
          where: { id: string; studentId: string; archivedAt: null };
          data: { archivedAt: unknown; archivedReason: string };
        },
      ],
    ];
    const updateInput = updateManyCalls[0][0];
    expect(updateInput?.where).toEqual({
      id: 'document-1',
      studentId: 'student-1',
      archivedAt: null,
    });
    expect(updateInput?.data.archivedAt).toBeInstanceOf(Date);
    expect(updateInput?.data.archivedReason).toBe(
      'USER_ARCHIVED_COURSE_SOURCE',
    );
    expect(prisma.knowledgeUnit.deleteMany).not.toHaveBeenCalled();
    expect(prisma.document.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes a safe course document only when it belongs to the requested course', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(
      record({ courseId: 'course-1', status: 'FAILED' }),
    );
    prisma.document.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      repository.deleteCourseDocumentForStudent({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-1',
      }),
    ).resolves.toBe(true);

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        studentId: 'student-1',
        courseId: 'course-1',
      },
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        courseId: true,
        status: true,
        archivedAt: true,
      },
    });
    expect(prisma.knowledgeUnit.deleteMany).not.toHaveBeenCalled();
    expect(prisma.document.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        studentId: 'student-1',
        courseId: 'course-1',
      },
    });
  });

  it('does not delete a course document when the document is outside the requested course', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(
      repository.deleteCourseDocumentForStudent({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-2',
      }),
    ).resolves.toBe(false);

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'document-2',
        studentId: 'student-1',
        courseId: 'course-1',
      },
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        courseId: true,
        status: true,
        archivedAt: true,
      },
    });
    expect(prisma.knowledgeUnit.deleteMany).not.toHaveBeenCalled();
    expect(prisma.document.deleteMany).not.toHaveBeenCalled();
  });

  it('marks uploaded documents as processing and records the running job', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 1 });

    await repository.markProcessing('document-1');

    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: 'document-1', status: 'UPLOADED' },
      data: { status: 'PROCESSING', errorCode: null },
    });
    expect(prisma.documentProcessingJob.updateMany).toHaveBeenCalledWith({
      where: { documentId: 'document-1', status: 'PENDING' },
      data: { status: 'RUNNING' },
    });
  });

  it('rejects processing transitions from non-uploaded documents', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.updateMany.mockResolvedValue({ count: 0 });

    await expect(repository.markProcessing('document-1')).rejects.toThrow(
      'Document is not uploaded',
    );

    expect(prisma.documentProcessingJob.updateMany).not.toHaveBeenCalled();
  });

  it('rejects processing transitions when no pending job exists', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 0 });

    await expect(repository.markProcessing('document-1')).rejects.toThrow(
      'Document processing job is not pending',
    );
  });

  it('marks processing documents ready with extracted knowledge units', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 1 });

    await repository.markReadyWithKnowledgeUnits({
      documentId: 'document-1',
      units: [{ title: ' Cellules ', summary: ' Bases ' }],
    });

    expect(prisma.document.findUnique).toHaveBeenCalledWith({
      where: { id: 'document-1' },
    });
    expect(prisma.knowledgeUnit.createMany).toHaveBeenCalledWith({
      data: [
        {
          documentId: 'document-1',
          subjectId: 'subject-1',
          title: 'Cellules',
          summary: 'Bases',
        },
      ],
    });
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: 'document-1', status: 'PROCESSING' },
      data: { status: 'READY', errorCode: null },
    });
    expect(prisma.documentProcessingJob.updateMany).toHaveBeenCalledWith({
      where: { documentId: 'document-1', status: 'RUNNING' },
      data: { status: 'COMPLETED' },
    });
  });

  it('persists optional enrichment fields when marking knowledge units ready', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 1 });

    await repository.markReadyWithKnowledgeUnits({
      documentId: 'document-1',
      units: [
        {
          title: 'Séparation des pouvoirs',
          summary: 'Principe structurant les institutions.',
          difficulty: 'MEDIUM',
          displayOrder: 2,
          confidence: 0.84,
          extractionPromptVersion: 'document-knowledge-v1',
          extractionSchemaVersion: 'extracted-knowledge-v1',
        },
      ],
    });

    expect(prisma.knowledgeUnit.createMany).toHaveBeenCalledWith({
      data: [
        {
          documentId: 'document-1',
          subjectId: 'subject-1',
          title: 'Séparation des pouvoirs',
          summary: 'Principe structurant les institutions.',
          difficulty: 'MEDIUM',
          displayOrder: 2,
          confidence: 0.84,
          extractionPromptVersion: 'document-knowledge-v1',
          extractionSchemaVersion: 'extracted-knowledge-v1',
        },
      ],
    });
  });

  it('creates knowledge unit sources when marking sourced units ready', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.documentChunk.findMany.mockResolvedValue([
      { id: 'chunk-1' },
      { id: 'chunk-2' },
    ]);
    prisma.knowledgeUnit.create.mockResolvedValue({
      id: 'knowledge-unit-1',
      subjectId: 'subject-1',
    });
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 1 });

    await repository.markReadyWithKnowledgeUnits({
      documentId: 'document-1',
      units: [
        {
          title: 'Séparation des pouvoirs',
          summary: 'Principe structurant les institutions.',
          sourceChunkIds: ['chunk-2', 'chunk-1', 'chunk-2'],
          difficulty: 'MEDIUM',
          displayOrder: 2,
          confidence: 0.84,
          extractionPromptVersion: 'document-knowledge-v2',
          extractionSchemaVersion: 'extracted-knowledge-v2',
        },
      ],
    });

    expect(prisma.documentChunk.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['chunk-2', 'chunk-1'] },
        subjectId: 'subject-1',
        documentId: 'document-1',
      },
      select: { id: true },
    });
    expect(prisma.knowledgeUnit.create).toHaveBeenCalledWith({
      data: {
        documentId: 'document-1',
        subjectId: 'subject-1',
        title: 'Séparation des pouvoirs',
        summary: 'Principe structurant les institutions.',
        difficulty: 'MEDIUM',
        displayOrder: 2,
        confidence: 0.84,
        extractionPromptVersion: 'document-knowledge-v2',
        extractionSchemaVersion: 'extracted-knowledge-v2',
      },
    });
    expect(prisma.knowledgeUnitSource.createMany).toHaveBeenCalledWith({
      data: [
        {
          knowledgeUnitId: 'knowledge-unit-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-2',
          relevanceScore: null,
        },
        {
          knowledgeUnitId: 'knowledge-unit-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-1',
          relevanceScore: null,
        },
      ],
    });
    expect(prisma.knowledgeUnit.createMany).not.toHaveBeenCalled();
  });

  it('rejects sourced ready transitions when a source chunk belongs to another document', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.documentChunk.findMany.mockResolvedValue([{ id: 'chunk-1' }]);

    await expect(
      repository.markReadyWithKnowledgeUnits({
        documentId: 'document-1',
        units: [
          {
            title: 'Constitution',
            summary: 'Norme fondamentale.',
            sourceChunkIds: ['chunk-1', 'chunk-other-document'],
          },
        ],
      }),
    ).rejects.toThrow('Knowledge unit source chunk not found');

    expect(prisma.knowledgeUnit.create).not.toHaveBeenCalled();
    expect(prisma.knowledgeUnitSource.createMany).not.toHaveBeenCalled();
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });

  it('does not duplicate knowledge units when a document is already ready', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(record({ status: 'READY' }));

    await repository.markReadyWithKnowledgeUnits({
      documentId: 'document-1',
      units: [{ title: 'Cellules', summary: 'Bases' }],
    });

    expect(prisma.knowledgeUnit.createMany).not.toHaveBeenCalled();
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
    expect(prisma.documentProcessingJob.updateMany).not.toHaveBeenCalled();
  });

  it('rejects ready transitions from documents that are not processing', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'UPLOADED' }),
    );

    await expect(
      repository.markReadyWithKnowledgeUnits({
        documentId: 'document-1',
        units: [{ title: 'Cellules', summary: 'Bases' }],
      }),
    ).rejects.toThrow('Document is not processing');

    expect(prisma.knowledgeUnit.createMany).not.toHaveBeenCalled();
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });

  it('rejects ready transitions when no running job exists', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.markReadyWithKnowledgeUnits({
        documentId: 'document-1',
        units: [],
      }),
    ).rejects.toThrow('Document processing job is not running');
  });

  it('marks uploaded or processing documents failed', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 1 });

    await repository.markFailed({
      documentId: 'document-1',
      errorCode: 'EXTRACTION_FAILED',
    });

    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: 'document-1', status: { in: ['UPLOADED', 'PROCESSING'] } },
      data: { status: 'FAILED', errorCode: 'EXTRACTION_FAILED' },
    });
    expect(prisma.documentProcessingJob.updateMany).toHaveBeenCalledWith({
      where: {
        documentId: 'document-1',
        status: { in: ['PENDING', 'RUNNING'] },
      },
      data: { status: 'FAILED' },
    });
  });

  it('does not fail completed documents', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(record({ status: 'READY' }));

    await expect(
      repository.markFailed({
        documentId: 'document-1',
        errorCode: 'EXTRACTION_FAILED',
      }),
    ).rejects.toThrow('Document is already ready');

    expect(prisma.document.updateMany).not.toHaveBeenCalled();
    expect(prisma.documentProcessingJob.updateMany).not.toHaveBeenCalled();
  });

  it('rejects failure transitions when no active job exists', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.markFailed({
        documentId: 'document-1',
        errorCode: 'EXTRACTION_FAILED',
      }),
    ).rejects.toThrow('Document processing job is not active');
  });

  it('replaces chunks for a processing document in index order', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );

    await repository.replaceChunks({
      documentId: 'document-1',
      chunks: [
        {
          index: 1,
          text: 'Deuxieme bloc',
          charStart: 15,
          charEnd: 28,
          pageNumber: null,
        },
        {
          index: 0,
          text: 'Premier bloc',
          charStart: 0,
          charEnd: 13,
        },
      ],
    });

    expect(prisma.documentChunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'document-1' },
    });
    expect(prisma.documentChunk.createMany).toHaveBeenCalledWith({
      data: [
        {
          documentId: 'document-1',
          subjectId: 'subject-1',
          index: 0,
          text: 'Premier bloc',
          charStart: 0,
          charEnd: 13,
          pageNumber: null,
        },
        {
          documentId: 'document-1',
          subjectId: 'subject-1',
          index: 1,
          text: 'Deuxieme bloc',
          charStart: 15,
          charEnd: 28,
          pageNumber: null,
        },
      ],
    });
  });

  it('replaces existing chunks with an empty list without creating rows', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );

    await repository.replaceChunks({
      documentId: 'document-1',
      chunks: [],
    });

    expect(prisma.documentChunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'document-1' },
    });
    expect(prisma.documentChunk.createMany).not.toHaveBeenCalled();
  });

  it('rejects chunk replacement when the document is not processing', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(record({ status: 'READY' }));

    await expect(
      repository.replaceChunks({
        documentId: 'document-1',
        chunks: [{ index: 0, text: 'Bloc', charStart: 0, charEnd: 4 }],
      }),
    ).rejects.toThrow('Document is not processing');

    expect(prisma.documentChunk.deleteMany).not.toHaveBeenCalled();
    expect(prisma.documentChunk.createMany).not.toHaveBeenCalled();
  });

  it('lists document chunks by ascending index', async () => {
    const { prisma, repository } = createRepository();
    const createdAt = new Date('2026-06-14T12:00:00.000Z');
    prisma.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        documentId: 'document-1',
        subjectId: 'subject-1',
        index: 0,
        text: 'Premier bloc',
        charStart: 0,
        charEnd: 13,
        pageNumber: null,
        createdAt,
      },
    ]);

    const chunks = await repository.findChunksByDocumentId('document-1');

    expect(prisma.documentChunk.findMany).toHaveBeenCalledWith({
      where: { documentId: 'document-1' },
      orderBy: { index: 'asc' },
    });
    expect(chunks).toEqual([
      {
        id: 'chunk-1',
        documentId: 'document-1',
        subjectId: 'subject-1',
        index: 0,
        text: 'Premier bloc',
        charStart: 0,
        charEnd: 13,
        pageNumber: null,
        createdAt,
      },
    ]);
  });

  it('lists sourced knowledge units for a student document in stable order', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(record({ status: 'READY' }));
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      {
        id: 'unit-1',
        title: 'Séparation des pouvoirs',
        summary: 'Principe structurant les institutions.',
        difficulty: 'MEDIUM',
        displayOrder: 1,
        confidence: 0.84,
        sources: [
          {
            chunkId: 'chunk-2',
            chunk: {
              text: 'Second extrait.',
              pageNumber: null,
              index: 1,
            },
          },
          {
            chunkId: 'chunk-1',
            chunk: {
              text: 'Premier extrait.',
              pageNumber: null,
              index: 0,
            },
          },
        ],
      },
    ]);

    const response = await repository.findKnowledgeUnitsByDocumentForStudent({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        studentId: 'student-1',
        archivedAt: null,
      },
    });
    expect(prisma.knowledgeUnit.findMany).toHaveBeenCalledWith({
      where: {
        documentId: 'document-1',
        subject: {
          studentId: 'student-1',
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        sources: {
          include: {
            chunk: true,
          },
        },
      },
    });
    expect(response).toEqual({
      documentId: 'document-1',
      documentStatus: 'READY',
      items: [
        {
          id: 'unit-1',
          title: 'Séparation des pouvoirs',
          summary: 'Principe structurant les institutions.',
          difficulty: 'MEDIUM',
          displayOrder: 1,
          confidence: 0.84,
          sources: [
            {
              chunkId: 'chunk-1',
              text: 'Premier extrait.',
              pageNumber: null,
              index: 0,
            },
            {
              chunkId: 'chunk-2',
              text: 'Second extrait.',
              pageNumber: null,
              index: 1,
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(response)).not.toContain('storagePath');
  });

  it('returns null when listing knowledge units for another student document', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(null);

    const response = await repository.findKnowledgeUnitsByDocumentForStudent({
      studentId: 'student-2',
      documentId: 'document-1',
    });

    expect(response).toBeNull();
    expect(prisma.knowledgeUnit.findMany).not.toHaveBeenCalled();
  });

  it('does not return chunks that are not linked as sources', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(record({ status: 'READY' }));
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      {
        id: 'unit-1',
        title: 'Constitution',
        summary: 'Norme fondamentale.',
        difficulty: null,
        displayOrder: null,
        confidence: null,
        sources: [],
      },
    ]);

    const response = await repository.findKnowledgeUnitsByDocumentForStudent({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(response?.items[0]?.sources).toEqual([]);
  });

  it('persists knowledge unit sources only for chunks in the same subject', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findUnique.mockResolvedValue({
      id: 'knowledge-unit-1',
      subjectId: 'subject-1',
    });
    prisma.documentChunk.findMany.mockResolvedValue([
      { id: 'chunk-1' },
      { id: 'chunk-2' },
    ]);

    await repository.replaceKnowledgeUnitSources({
      knowledgeUnitId: 'knowledge-unit-1',
      subjectId: 'subject-1',
      sources: [
        { chunkId: 'chunk-2', relevanceScore: 0.7 },
        { chunkId: 'chunk-1', relevanceScore: null },
      ],
    });

    expect(prisma.documentChunk.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['chunk-2', 'chunk-1'] },
        subjectId: 'subject-1',
      },
      select: { id: true },
    });
    expect(prisma.knowledgeUnitSource.deleteMany).toHaveBeenCalledWith({
      where: {
        knowledgeUnitId: 'knowledge-unit-1',
        subjectId: 'subject-1',
      },
    });
    expect(prisma.knowledgeUnitSource.createMany).toHaveBeenCalledWith({
      data: [
        {
          knowledgeUnitId: 'knowledge-unit-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-2',
          relevanceScore: 0.7,
        },
        {
          knowledgeUnitId: 'knowledge-unit-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-1',
          relevanceScore: null,
        },
      ],
    });
  });

  it('rejects knowledge unit sources pointing to unknown chunks', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findUnique.mockResolvedValue({
      id: 'knowledge-unit-1',
      subjectId: 'subject-1',
    });
    prisma.documentChunk.findMany.mockResolvedValue([{ id: 'chunk-1' }]);

    await expect(
      repository.replaceKnowledgeUnitSources({
        knowledgeUnitId: 'knowledge-unit-1',
        subjectId: 'subject-1',
        sources: [
          { chunkId: 'chunk-1', relevanceScore: 0.9 },
          { chunkId: 'chunk-unknown', relevanceScore: 0.5 },
        ],
      }),
    ).rejects.toThrow('Knowledge unit source chunk not found');

    expect(prisma.knowledgeUnitSource.deleteMany).not.toHaveBeenCalled();
    expect(prisma.knowledgeUnitSource.createMany).not.toHaveBeenCalled();
  });

  it('does not create knowledge unit sources while marking ready without source ids', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 1 });

    await repository.markReadyWithKnowledgeUnits({
      documentId: 'document-1',
      units: [{ title: 'Constitution', summary: 'Norme fondamentale.' }],
    });

    expect(prisma.knowledgeUnitSource.createMany).not.toHaveBeenCalled();
  });
});

~~~

### `src/modules/documents/infrastructure/prisma-documents.repository.ts`

~~~text
import { Injectable } from '@nestjs/common';
import { KnowledgeUnit } from '../../revision/domain/knowledge-unit.entity';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  type DocumentChunkPersistenceInput,
  type DocumentKnowledgeUnitsDto,
  type DocumentsRepository,
  type KnowledgeUnitPersistenceInput,
  type KnowledgeUnitSourcePersistenceInput,
  type RevisionDocumentChunkDto,
  type RevisionDocumentDto,
} from '../application/documents.repository';
import { RevisionDocument } from '../domain/document.entity';
import type { DocumentKind, DocumentStatus } from '../domain/document.entity';
import {
  buildSourceLifecycleDecision,
  SourceArchiveBlockedError,
  SourceDeleteBlockedError,
  type SourceLifecycleDecision,
  type SourceLifecycleReason,
} from '../domain/source-lifecycle.entity';

type DocumentRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  courseId: string | null;
  kind: DocumentKind;
  fileName: string;
  storagePath: string;
  mimeType: string;
  status: DocumentStatus;
  errorCode: string | null;
  archivedAt: Date | null;
  archivedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SourceLifecycleDocumentRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  courseId: string | null;
  status: DocumentStatus;
  archivedAt: Date | null;
};

type SourceLifecyclePrismaClient = Pick<
  PrismaService,
  | 'activitySession'
  | 'document'
  | 'documentChunk'
  | 'knowledgeUnit'
  | 'openQuestion'
  | 'question'
  | 'questionBankItem'
  | 'revisionSession'
  | 'revisionSessionAction'
  | 'revisionSheet'
  | 'richClosedExercisePayload'
  | 'summary'
>;

type DocumentChunkRecord = {
  id: string;
  documentId: string;
  subjectId: string;
  index: number;
  text: string;
  charStart: number | null;
  charEnd: number | null;
  pageNumber: number | null;
  createdAt: Date;
};

@Injectable()
export class PrismaDocumentsRepository implements DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    studentId: string;
    subjectId: string;
    courseId?: string | null;
    kind: DocumentKind;
    fileName: string;
    storagePath: string;
    mimeType: string;
  }): Promise<RevisionDocumentDto> {
    const document = new RevisionDocument({
      id: 'validation-document',
      studentId: input.studentId,
      subjectId: input.subjectId,
      kind: input.kind,
      fileName: input.fileName,
      storagePath: input.storagePath,
      mimeType: input.mimeType,
      status: 'UPLOADED',
    });

    const record = await this.prisma.$transaction(async (tx) => {
      const subject = await tx.subject.findFirst({
        where: {
          id: document.subjectId,
          studentId: document.studentId,
        },
      });

      if (!subject) {
        throw new Error('Subject does not belong to student');
      }

      const createdDocument = await tx.document.create({
        data: {
          studentId: document.studentId,
          subjectId: document.subjectId,
          courseId: input.courseId ?? null,
          kind: document.kind,
          fileName: document.fileName,
          storagePath: document.storagePath,
          mimeType: document.mimeType,
        },
      });

      await tx.documentProcessingJob.create({
        data: {
          documentId: createdDocument.id,
          status: 'PENDING',
        },
      });

      return createdDocument;
    });

    return this.toDto(record);
  }

  async findBySubjectForStudent(input: {
    studentId: string;
    subjectId: string;
  }): Promise<RevisionDocumentDto[]> {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: input.subjectId,
        studentId: input.studentId,
      },
    });

    if (!subject) {
      throw new Error('Subject does not belong to student');
    }

    const records = await this.prisma.document.findMany({
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
        archivedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    return records.map((record) => this.toDto(record));
  }

  async findByIdForStudent(input: {
    studentId: string;
    documentId: string;
  }): Promise<RevisionDocumentDto | null> {
    const record = await this.prisma.document.findFirst({
      where: {
        id: input.documentId,
        studentId: input.studentId,
        archivedAt: null,
      },
    });

    return record ? this.toDto(record) : null;
  }

  async getLifecycleDecisionForStudent(input: {
    studentId: string;
    documentId: string;
    courseId?: string | null;
  }): Promise<SourceLifecycleDecision | null> {
    const document = await this.findLifecycleDocument(input);

    if (!document) {
      return null;
    }

    const dependencyCounts = await this.countSourceDependencies(
      this.prisma,
      document,
    );

    return buildSourceLifecycleDecision({
      documentId: document.id,
      courseId: document.courseId,
      status: document.status,
      archivedAt: document.archivedAt,
      dependencyCounts,
    });
  }

  async archiveForStudent(input: {
    studentId: string;
    documentId: string;
    courseId?: string | null;
    reason?: string | null;
  }): Promise<SourceLifecycleDecision | null> {
    return this.prisma.$transaction(async (tx) => {
      const document = await this.findLifecycleDocument(input, tx);

      if (!document) {
        return null;
      }

      const dependencyCounts = await this.countSourceDependencies(tx, document);
      const decision = buildSourceLifecycleDecision({
        documentId: document.id,
        courseId: document.courseId,
        status: document.status,
        archivedAt: document.archivedAt,
        dependencyCounts,
      });

      if (decision.status === 'ARCHIVED') {
        return decision;
      }

      if (!decision.canArchive) {
        throw new SourceArchiveBlockedError(decision);
      }

      const archivedAt = new Date();

      await tx.document.updateMany({
        where: {
          id: document.id,
          studentId: input.studentId,
          archivedAt: null,
        },
        data: {
          archivedAt,
          archivedReason: input.reason?.trim() || decision.recommendedAction,
        },
      });

      return buildSourceLifecycleDecision({
        documentId: document.id,
        courseId: document.courseId,
        status: document.status,
        archivedAt,
        dependencyCounts,
      });
    });
  }

  async deleteForStudent(input: {
    studentId: string;
    documentId: string;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const document = await this.findLifecycleDocument(input, tx);

      if (!document) {
        return false;
      }

      const dependencyCounts = await this.countSourceDependencies(tx, document);
      const decision = buildSourceLifecycleDecision({
        documentId: document.id,
        courseId: document.courseId,
        status: document.status,
        archivedAt: document.archivedAt,
        dependencyCounts,
      });

      if (!decision.canDelete) {
        throw new SourceDeleteBlockedError(decision);
      }

      const result = await tx.document.deleteMany({
        where: {
          id: input.documentId,
          studentId: input.studentId,
        },
      });

      return result.count === 1;
    });
  }

  async deleteCourseDocumentForStudent(input: {
    studentId: string;
    courseId: string;
    documentId: string;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const document = await this.findLifecycleDocument(input, tx);

      if (!document) {
        return false;
      }

      const dependencyCounts = await this.countSourceDependencies(tx, document);
      const decision = buildSourceLifecycleDecision({
        documentId: document.id,
        courseId: document.courseId,
        status: document.status,
        archivedAt: document.archivedAt,
        dependencyCounts,
      });

      if (!decision.canDelete) {
        throw new SourceDeleteBlockedError(decision);
      }

      const result = await tx.document.deleteMany({
        where: {
          id: input.documentId,
          studentId: input.studentId,
          courseId: input.courseId,
        },
      });

      return result.count === 1;
    });
  }

  async findById(documentId: string): Promise<RevisionDocumentDto | null> {
    const record = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    return record ? this.toDto(record) : null;
  }

  async markProcessing(documentId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.document.updateMany({
        where: { id: documentId, status: 'UPLOADED' },
        data: { status: 'PROCESSING', errorCode: null },
      });

      if (result.count !== 1) {
        throw new Error('Document is not uploaded');
      }

      const jobResult = await tx.documentProcessingJob.updateMany({
        where: { documentId, status: 'PENDING' },
        data: { status: 'RUNNING' },
      });

      if (jobResult.count !== 1) {
        throw new Error('Document processing job is not pending');
      }
    });
  }

  async markReadyWithKnowledgeUnits(input: {
    documentId: string;
    units: KnowledgeUnitPersistenceInput[];
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.findUnique({
        where: { id: input.documentId },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      if (document.status === 'READY') {
        return;
      }

      if (document.status !== 'PROCESSING') {
        throw new Error('Document is not processing');
      }

      if (input.units.length > 0) {
        const allSourceChunkIds = [
          ...new Set(input.units.flatMap((unit) => unit.sourceChunkIds ?? [])),
        ];

        if (allSourceChunkIds.length === 0) {
          await tx.knowledgeUnit.createMany({
            data: input.units.map((unit) =>
              this.toKnowledgeUnitCreateData({
                documentId: input.documentId,
                subjectId: document.subjectId,
                unit,
              }),
            ),
          });
        } else {
          const chunks = await tx.documentChunk.findMany({
            where: {
              id: { in: allSourceChunkIds },
              subjectId: document.subjectId,
              documentId: input.documentId,
            },
            select: { id: true },
          });
          const existingChunkIds = new Set(chunks.map((chunk) => chunk.id));

          if (
            allSourceChunkIds.some((chunkId) => !existingChunkIds.has(chunkId))
          ) {
            throw new Error('Knowledge unit source chunk not found');
          }

          for (const unit of input.units) {
            const sourceChunkIds = [...new Set(unit.sourceChunkIds ?? [])];
            const createdKnowledgeUnit = await tx.knowledgeUnit.create({
              data: this.toKnowledgeUnitCreateData({
                documentId: input.documentId,
                subjectId: document.subjectId,
                unit,
              }),
            });

            if (sourceChunkIds.length > 0) {
              await tx.knowledgeUnitSource.createMany({
                data: sourceChunkIds.map((chunkId) => ({
                  knowledgeUnitId: createdKnowledgeUnit.id,
                  subjectId: document.subjectId,
                  chunkId,
                  relevanceScore: null,
                })),
              });
            }
          }
        }
      }

      const result = await tx.document.updateMany({
        where: { id: input.documentId, status: 'PROCESSING' },
        data: { status: 'READY', errorCode: null },
      });

      if (result.count !== 1) {
        throw new Error('Document is not processing');
      }

      const jobResult = await tx.documentProcessingJob.updateMany({
        where: { documentId: input.documentId, status: 'RUNNING' },
        data: { status: 'COMPLETED' },
      });

      if (jobResult.count !== 1) {
        throw new Error('Document processing job is not running');
      }
    });
  }

  async replaceChunks(input: {
    documentId: string;
    chunks: DocumentChunkPersistenceInput[];
  }): Promise<void> {
    const chunks = [...input.chunks]
      .map((chunk) => ({
        index: chunk.index,
        text: chunk.text.trim(),
        charStart: chunk.charStart ?? null,
        charEnd: chunk.charEnd ?? null,
        pageNumber: chunk.pageNumber ?? null,
      }))
      .filter((chunk) => chunk.text.length > 0)
      .sort((left, right) => left.index - right.index);

    await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.findUnique({
        where: { id: input.documentId },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      if (document.status !== 'PROCESSING') {
        throw new Error('Document is not processing');
      }

      await tx.documentChunk.deleteMany({
        where: { documentId: input.documentId },
      });

      if (chunks.length === 0) {
        return;
      }

      await tx.documentChunk.createMany({
        data: chunks.map((chunk) => ({
          documentId: input.documentId,
          subjectId: document.subjectId,
          index: chunk.index,
          text: chunk.text,
          charStart: chunk.charStart,
          charEnd: chunk.charEnd,
          pageNumber: chunk.pageNumber,
        })),
      });
    });
  }

  async findChunksByDocumentId(
    documentId: string,
  ): Promise<RevisionDocumentChunkDto[]> {
    const records = await this.prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { index: 'asc' },
    });

    return records.map((record) => this.toChunkDto(record));
  }

  async findKnowledgeUnitsByDocumentForStudent(input: {
    studentId: string;
    documentId: string;
  }): Promise<DocumentKnowledgeUnitsDto | null> {
    const document = await this.prisma.document.findFirst({
      where: {
        id: input.documentId,
        studentId: input.studentId,
        archivedAt: null,
      },
    });

    if (!document) {
      return null;
    }

    const knowledgeUnits = await this.prisma.knowledgeUnit.findMany({
      where: {
        documentId: input.documentId,
        subject: {
          studentId: input.studentId,
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        sources: {
          include: {
            chunk: true,
          },
        },
      },
    });

    return {
      documentId: document.id,
      documentStatus: document.status,
      items: knowledgeUnits.map((unit) => ({
        id: unit.id,
        title: unit.title,
        summary: unit.summary,
        difficulty: unit.difficulty,
        displayOrder: unit.displayOrder,
        confidence: unit.confidence,
        sources: unit.sources
          .map((source) => ({
            chunkId: source.chunkId,
            text: source.chunk.text,
            pageNumber: source.chunk.pageNumber,
            index: source.chunk.index,
          }))
          .sort((left, right) => left.index - right.index),
      })),
    };
  }

  async replaceKnowledgeUnitSources(input: {
    knowledgeUnitId: string;
    subjectId: string;
    sources: KnowledgeUnitSourcePersistenceInput[];
  }): Promise<void> {
    const sources = input.sources.map((source) => ({
      chunkId: source.chunkId,
      relevanceScore: source.relevanceScore ?? null,
    }));
    const chunkIds = [...new Set(sources.map((source) => source.chunkId))];

    await this.prisma.$transaction(async (tx) => {
      const knowledgeUnit = await tx.knowledgeUnit.findUnique({
        where: {
          id_subjectId: {
            id: input.knowledgeUnitId,
            subjectId: input.subjectId,
          },
        },
      });

      if (!knowledgeUnit) {
        throw new Error('Knowledge unit not found');
      }

      if (chunkIds.length > 0) {
        const chunks = await tx.documentChunk.findMany({
          where: {
            id: { in: chunkIds },
            subjectId: input.subjectId,
          },
          select: { id: true },
        });
        const existingChunkIds = new Set(chunks.map((chunk) => chunk.id));

        if (chunkIds.some((chunkId) => !existingChunkIds.has(chunkId))) {
          throw new Error('Knowledge unit source chunk not found');
        }
      }

      await tx.knowledgeUnitSource.deleteMany({
        where: {
          knowledgeUnitId: input.knowledgeUnitId,
          subjectId: input.subjectId,
        },
      });

      if (sources.length === 0) {
        return;
      }

      await tx.knowledgeUnitSource.createMany({
        data: sources.map((source) => ({
          knowledgeUnitId: input.knowledgeUnitId,
          subjectId: input.subjectId,
          chunkId: source.chunkId,
          relevanceScore: source.relevanceScore,
        })),
      });
    });
  }

  async markFailed(input: {
    documentId: string;
    errorCode: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.findUnique({
        where: { id: input.documentId },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      if (document.status === 'FAILED') {
        return;
      }

      if (document.status === 'READY') {
        throw new Error('Document is already ready');
      }

      const result = await tx.document.updateMany({
        where: {
          id: input.documentId,
          status: { in: ['UPLOADED', 'PROCESSING'] },
        },
        data: { status: 'FAILED', errorCode: input.errorCode },
      });

      if (result.count !== 1) {
        throw new Error('Document is not active');
      }

      const jobResult = await tx.documentProcessingJob.updateMany({
        where: {
          documentId: input.documentId,
          status: { in: ['PENDING', 'RUNNING'] },
        },
        data: { status: 'FAILED' },
      });

      if (jobResult.count !== 1) {
        throw new Error('Document processing job is not active');
      }
    });
  }

  private findLifecycleDocument(
    input: { studentId: string; documentId: string; courseId?: string | null },
    client: SourceLifecyclePrismaClient = this.prisma,
  ): Promise<SourceLifecycleDocumentRecord | null> {
    return client.document.findFirst({
      where: {
        id: input.documentId,
        studentId: input.studentId,
        ...(input.courseId !== undefined ? { courseId: input.courseId } : {}),
      },
      select: {
        id: true,
        studentId: true,
        subjectId: true,
        courseId: true,
        status: true,
        archivedAt: true,
      },
    });
  }

  private async countSourceDependencies(
    client: SourceLifecyclePrismaClient,
    document: SourceLifecycleDocumentRecord,
  ): Promise<Partial<Record<SourceLifecycleReason, number>>> {
    const whereDocument = {
      documentId: document.id,
      subjectId: document.subjectId,
    };
    const whereStudentDocument = {
      documentId: document.id,
      studentId: document.studentId,
      subjectId: document.subjectId,
    };

    const [
      chunks,
      knowledgeUnits,
      summaries,
      revisionSheets,
      questionBankItems,
      revisionSessions,
      revisionSessionActions,
      openQuestions,
      activitySessions,
      questions,
      richClosedPayloads,
    ] = await Promise.all([
      client.documentChunk.count({ where: whereDocument }),
      client.knowledgeUnit.count({ where: whereDocument }),
      client.summary.count({ where: whereStudentDocument }),
      client.revisionSheet.count({ where: whereStudentDocument }),
      client.questionBankItem.count({ where: whereStudentDocument }),
      client.revisionSession.count({ where: whereStudentDocument }),
      client.revisionSessionAction.count({ where: whereStudentDocument }),
      client.openQuestion.count({ where: whereStudentDocument }),
      client.activitySession.count({ where: whereStudentDocument }),
      client.question.count({ where: whereDocument }),
      client.richClosedExercisePayload.count({ where: whereDocument }),
    ]);

    return {
      HAS_DOCUMENT_CHUNKS: chunks,
      HAS_KNOWLEDGE_UNITS: knowledgeUnits,
      HAS_SUMMARY: summaries,
      HAS_REVISION_SHEET: revisionSheets,
      HAS_QUESTION_BANK_ITEMS: questionBankItems,
      HAS_REVISION_SESSIONS: revisionSessions,
      HAS_REVISION_SESSION_ACTIONS: revisionSessionActions,
      HAS_OPEN_QUESTIONS: openQuestions,
      HAS_ACTIVITY_SESSIONS: activitySessions,
      HAS_QUESTIONS: questions,
      HAS_RICH_CLOSED_PAYLOADS: richClosedPayloads,
    };
  }

  private toDto(record: DocumentRecord): RevisionDocumentDto {
    const document = new RevisionDocument(record);

    return {
      id: document.id,
      studentId: document.studentId,
      subjectId: document.subjectId,
      courseId: record.courseId,
      kind: document.kind,
      fileName: document.fileName,
      storagePath: document.storagePath,
      mimeType: document.mimeType,
      status: document.status,
      errorCode: document.errorCode,
      archivedAt: record.archivedAt,
      archivedReason: record.archivedReason,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toChunkDto(record: DocumentChunkRecord): RevisionDocumentChunkDto {
    return {
      id: record.id,
      documentId: record.documentId,
      subjectId: record.subjectId,
      index: record.index,
      text: record.text,
      charStart: record.charStart,
      charEnd: record.charEnd,
      pageNumber: record.pageNumber,
      createdAt: record.createdAt,
    };
  }

  private toKnowledgeUnitCreateData(input: {
    documentId: string;
    subjectId: string;
    unit: KnowledgeUnitPersistenceInput;
  }) {
    const knowledgeUnit = new KnowledgeUnit({
      id: 'validation-knowledge-unit',
      subjectId: input.subjectId,
      title: input.unit.title,
      summary: input.unit.summary,
    });

    return {
      documentId: input.documentId,
      subjectId: knowledgeUnit.subjectId,
      title: knowledgeUnit.title,
      summary: knowledgeUnit.summary,
      difficulty: input.unit.difficulty ?? undefined,
      displayOrder: input.unit.displayOrder ?? undefined,
      confidence: input.unit.confidence ?? undefined,
      extractionPromptVersion: input.unit.extractionPromptVersion ?? undefined,
      extractionSchemaVersion: input.unit.extractionSchemaVersion ?? undefined,
    };
  }
}

~~~

### `src/modules/documents/interfaces/documents.controller.spec.ts`

~~~text
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DeleteDocumentUseCase } from '../application/delete-document.use-case';
import { GetDocumentUseCase } from '../application/get-document.use-case';
import { ListDocumentKnowledgeUnitsUseCase } from '../application/list-document-knowledge-units.use-case';
import { ListSubjectDocumentsUseCase } from '../application/list-subject-documents.use-case';
import { RegisterDocumentUseCase } from '../application/register-document.use-case';
import {
  ArchiveDocumentUseCase,
  GetDocumentSourceLifecycleUseCase,
} from '../application/source-lifecycle.use-case';
import { UploadCoursePdfUseCase } from '../application/upload-course-pdf.use-case';
import { SourceDeleteBlockedError } from '../domain/source-lifecycle.entity';
import { DocumentsController } from './documents.controller';

describe('DocumentsController', () => {
  const student = {
    id: 'student-1',
    firebaseUid: 'firebase-1',
    email: 'student@example.com',
    displayName: 'Student One',
  };

  function createController() {
    const execute = jest.fn().mockResolvedValue({
      id: 'document-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: 'cours.pdf',
      storagePath: 'students/firebase-1/subjects/subject-1/cours.pdf',
      mimeType: 'application/pdf',
      status: 'UPLOADED',
      errorCode: null,
    });

    const registerDocument = {
      execute,
    } as unknown as RegisterDocumentUseCase;

    const executeList = jest.fn().mockResolvedValue([
      {
        id: 'document-1',
        studentId: 'student-1',
        subjectId: 'subject-1',
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/firebase-1/subjects/subject-1/cours.pdf',
        mimeType: 'application/pdf',
        status: 'UPLOADED',
        errorCode: null,
      },
    ]);

    const listSubjectDocuments = {
      execute: executeList,
    } as unknown as ListSubjectDocumentsUseCase;

    const executeGet = jest.fn().mockResolvedValue({
      id: 'document-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: 'cours.pdf',
      mimeType: 'application/pdf',
      status: 'UPLOADED',
      errorCode: null,
    });

    const getDocument = {
      execute: executeGet,
    } as unknown as GetDocumentUseCase;

    const executeKnowledgeUnits = jest.fn().mockResolvedValue({
      documentId: 'document-1',
      items: [
        {
          id: 'unit-1',
          title: 'Séparation des pouvoirs',
          summary: 'Résumé court.',
          difficulty: 'MEDIUM',
          displayOrder: 1,
          confidence: 0.84,
          sources: [
            {
              chunkId: 'chunk-1',
              text: 'Extrait source issu du chunk.',
              pageNumber: null,
              index: 0,
            },
          ],
        },
      ],
    });

    const listDocumentKnowledgeUnits = {
      execute: executeKnowledgeUnits,
    } as unknown as ListDocumentKnowledgeUnitsUseCase;

    const executeUpload = jest.fn().mockResolvedValue({
      id: 'document-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: '1710000000000-cours.pdf',
      storagePath:
        'students/firebase-1/subjects/subject-1/1710000000000-cours.pdf',
      mimeType: 'application/pdf',
      status: 'UPLOADED',
      errorCode: null,
    });

    const uploadCoursePdf = {
      execute: executeUpload,
    } as unknown as UploadCoursePdfUseCase;

    const executeDelete = jest.fn().mockResolvedValue(undefined);

    const deleteDocument = {
      execute: executeDelete,
    } as unknown as DeleteDocumentUseCase;

    const executeLifecycle = jest
      .fn()
      .mockResolvedValue(sourceLifecycleDecision());

    const getDocumentSourceLifecycle = {
      execute: executeLifecycle,
    } as unknown as GetDocumentSourceLifecycleUseCase;

    const executeArchive = jest.fn().mockResolvedValue(
      sourceLifecycleDecision({
        status: 'ARCHIVED',
        recommendedAction: 'BLOCK',
        canArchive: false,
      }),
    );

    const archiveDocument = {
      execute: executeArchive,
    } as unknown as ArchiveDocumentUseCase;

    return {
      controller: new DocumentsController(
        registerDocument,
        listSubjectDocuments,
        getDocument,
        listDocumentKnowledgeUnits,
        uploadCoursePdf,
        deleteDocument,
        getDocumentSourceLifecycle,
        archiveDocument,
      ),
      execute,
      executeList,
      executeGet,
      executeKnowledgeUnits,
      executeUpload,
      executeDelete,
      executeLifecycle,
      executeArchive,
    };
  }

  it('registers documents for the current student and ignores body studentId', async () => {
    const { controller, execute } = createController();

    await controller.register(student, {
      studentId: 'attacker-student',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: ' cours.pdf ',
      storagePath: ' students/firebase-1/subjects/subject-1/cours.pdf ',
      mimeType: ' application/pdf ',
    } as never);

    expect(execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: 'cours.pdf',
      storagePath: 'students/firebase-1/subjects/subject-1/cours.pdf',
      mimeType: 'application/pdf',
    });
  });

  it('rejects invalid document payloads with 400', () => {
    const invalidBodies = [
      {
        subjectId: '',
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/firebase-1/subjects/subject-1/cours.pdf',
        mimeType: 'application/pdf',
      },
      {
        subjectId: 'subject-1',
        kind: 'VIDEO',
        fileName: 'cours.pdf',
        storagePath: 'students/firebase-1/subjects/subject-1/cours.pdf',
        mimeType: 'application/pdf',
      },
      {
        subjectId: 'subject-1',
        kind: 'COURSE_PDF',
        fileName: '',
        storagePath: 'students/firebase-1/subjects/subject-1/cours.pdf',
        mimeType: 'application/pdf',
      },
      {
        subjectId: 'subject-1',
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/other-firebase/subjects/subject-1/cours.pdf',
        mimeType: 'application/pdf',
      },
      {
        subjectId: 'subject-1',
        kind: 'EXAM_IMAGE',
        fileName: 'copie.png',
        storagePath: 'students/firebase-1/subjects/subject-1/copie.png',
        mimeType: 'application/pdf',
      },
    ];

    for (const body of invalidBodies) {
      const { controller } = createController();

      expect(() => controller.register(student, body as never)).toThrow(
        BadRequestException,
      );
    }
  });

  it('maps subject ownership failures to 400', async () => {
    const { controller, execute } = createController();
    execute.mockRejectedValue(new Error('Subject does not belong to student'));

    await expect(
      controller.register(student, {
        subjectId: 'subject-2',
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/firebase-1/subjects/subject-2/cours.pdf',
        mimeType: 'application/pdf',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts canonical image document metadata', async () => {
    const { controller, execute } = createController();

    await controller.register(student, {
      subjectId: 'subject-1',
      kind: 'EXAM_IMAGE',
      fileName: 'copie.png',
      storagePath: 'students/firebase-1/subjects/subject-1/copie.png',
      mimeType: 'image/png',
    });

    expect(execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'EXAM_IMAGE',
      fileName: 'copie.png',
      storagePath: 'students/firebase-1/subjects/subject-1/copie.png',
      mimeType: 'image/png',
    });
  });

  it('lists documents for a subject owned by the current student', async () => {
    const { controller, executeList } = createController();

    await controller.listForSubject(student, 'subject-1');

    expect(executeList).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });
  });

  it('maps subject ownership failures while listing documents to 400', async () => {
    const { controller, executeList } = createController();
    executeList.mockRejectedValue(
      new Error('Subject does not belong to student'),
    );

    await expect(
      controller.listForSubject(student, 'subject-2'),
    ).rejects.toThrow(BadRequestException);
  });

  it('gets a document owned by the current student', async () => {
    const { controller, executeGet } = createController();

    const document = await controller.get(student, 'document-1');

    expect(executeGet).toHaveBeenCalledWith({
      studentId: 'student-1',
      documentId: 'document-1',
    });
    expect(document).toEqual({
      id: 'document-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: 'cours.pdf',
      mimeType: 'application/pdf',
      status: 'UPLOADED',
      errorCode: null,
    });
    expect(JSON.stringify(document)).not.toContain('storagePath');
  });

  it('lists sourced knowledge units for a document owned by the current student', async () => {
    const { controller, executeKnowledgeUnits } = createController();

    const response = await controller.listKnowledgeUnits(student, 'document-1');

    expect(executeKnowledgeUnits).toHaveBeenCalledWith({
      studentId: 'student-1',
      documentId: 'document-1',
    });
    expect(response).toEqual({
      documentId: 'document-1',
      items: [
        {
          id: 'unit-1',
          title: 'Séparation des pouvoirs',
          summary: 'Résumé court.',
          difficulty: 'MEDIUM',
          displayOrder: 1,
          confidence: 0.84,
          sources: [
            {
              chunkId: 'chunk-1',
              text: 'Extrait source issu du chunk.',
              pageNumber: null,
              index: 0,
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(response)).not.toContain('storagePath');
  });

  it('rejects empty document ids while reading knowledge units', () => {
    const { controller } = createController();

    expect(() => controller.listKnowledgeUnits(student, '  ')).toThrow(
      BadRequestException,
    );
  });

  it('deletes a document owned by the current student', async () => {
    const { controller, executeDelete } = createController();

    await controller.delete(student, ' document-1 ');

    expect(executeDelete).toHaveBeenCalledWith({
      studentId: 'student-1',
      documentId: 'document-1',
    });
  });

  it('maps lifecycle delete conflicts to 409', async () => {
    const { controller, executeDelete } = createController();
    executeDelete.mockRejectedValue(
      new SourceDeleteBlockedError(sourceLifecycleDecision()),
    );

    await expect(controller.delete(student, 'document-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('loads lifecycle decisions for a document owned by the student', async () => {
    const { controller, executeLifecycle } = createController();

    await expect(
      controller.getLifecycle(student, ' document-1 '),
    ).resolves.toMatchObject({
      documentId: 'document-1',
      recommendedAction: 'ARCHIVE',
    });

    expect(executeLifecycle).toHaveBeenCalledWith({
      studentId: 'student-1',
      documentId: 'document-1',
    });
  });

  it('archives a document owned by the student', async () => {
    const { controller, executeArchive } = createController();

    await expect(
      controller.archive(student, ' document-1 '),
    ).resolves.toMatchObject({
      documentId: 'document-1',
      status: 'ARCHIVED',
      recommendedAction: 'BLOCK',
    });

    expect(executeArchive).toHaveBeenCalledWith({
      studentId: 'student-1',
      documentId: 'document-1',
    });
  });

  it('maps missing lifecycle documents to 404', async () => {
    const { controller, executeLifecycle } = createController();
    executeLifecycle.mockRejectedValue(
      new NotFoundException('Document not found'),
    );

    await expect(
      controller.getLifecycle(student, 'missing-document'),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects empty document ids while deleting', () => {
    const { controller } = createController();

    expect(() => controller.delete(student, '  ')).toThrow(BadRequestException);
  });

  it('uploads course PDFs for the current student', async () => {
    const { controller, executeUpload } = createController();

    await controller.uploadCoursePdf(
      student,
      { subjectId: ' subject-1 ' },
      {
        originalname: ' Cours 2024-2025.pdf ',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.7'),
        size: 8,
      },
    );

    expect(executeUpload).toHaveBeenCalledWith({
      studentId: 'student-1',
      firebaseUid: 'firebase-1',
      subjectId: 'subject-1',
      originalFileName: 'Cours 2024-2025.pdf',
      content: Buffer.from('%PDF-1.7'),
      mimeType: 'application/pdf',
    });
  });

  it('rejects missing or non-PDF course uploads with 400', () => {
    const { controller } = createController();

    expect(() =>
      controller.uploadCoursePdf(
        student,
        { subjectId: 'subject-1' },
        undefined,
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      controller.uploadCoursePdf(
        student,
        { subjectId: 'subject-1' },
        {
          originalname: 'cours.png',
          mimetype: 'image/png',
          buffer: Buffer.from('png'),
          size: 3,
        },
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      controller.uploadCoursePdf(
        student,
        { subjectId: 'subject-1' },
        {
          originalname: 'cours.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.alloc(0),
          size: 0,
        },
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects malformed storage paths with 400', () => {
    const invalidStoragePaths = [
      'students/firebase-1/subjects/subject-1/../cours.pdf',
      'students/firebase-1//subjects/subject-1/cours.pdf',
      'students/firebase-1/subjects/subject-2/cours.pdf',
      'students/firebase-1/subjects/subject-1/nested/cours.pdf',
      'students/firebase-1/subjects/subject-1/cours%2epdf',
      'students/firebase-1/subjects/subject-1/cours%2fpdf',
      'students/firebase-1/subjects/subject-1/not-cours.pdf',
      '/students/firebase-1/subjects/subject-1/cours.pdf',
      'students/student-1/subjects/subject-1/cours.pdf',
    ];

    for (const storagePath of invalidStoragePaths) {
      const { controller } = createController();

      expect(() =>
        controller.register(student, {
          subjectId: 'subject-1',
          kind: 'COURSE_PDF',
          fileName: 'cours.pdf',
          storagePath,
          mimeType: 'application/pdf',
        }),
      ).toThrow(BadRequestException);
    }
  });

  it('rejects overlong document metadata with 400', () => {
    const { controller } = createController();

    expect(() =>
      controller.register(student, {
        subjectId: 'subject-1',
        kind: 'COURSE_PDF',
        fileName: `${'a'.repeat(252)}.pdf`,
        storagePath: `students/firebase-1/subjects/subject-1/${'a'.repeat(
          252,
        )}.pdf`,
        mimeType: 'application/pdf',
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      controller.register(student, {
        subjectId: 'subject-1',
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: `students/firebase-1/subjects/subject-1/${'a'.repeat(
          981,
        )}.pdf`,
        mimeType: 'application/pdf',
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      controller.register(student, {
        subjectId: 'subject-1',
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/firebase-1/subjects/subject-1/cours.pdf',
        mimeType: 'application/'.padEnd(101, 'x'),
      }),
    ).toThrow(BadRequestException);
  });
});

function sourceLifecycleDecision(overrides: Record<string, unknown> = {}) {
  return {
    documentId: 'document-1',
    courseId: null,
    status: 'ACTIVE',
    recommendedAction: 'ARCHIVE',
    canDelete: false,
    canArchive: true,
    blockingReasons: ['HAS_KNOWLEDGE_UNITS'],
    userMessage: 'Cette source peut etre archivee.',
    ...overrides,
  };
}

~~~

### `src/modules/documents/interfaces/documents.controller.ts`

~~~text
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  UploadedFile,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedStudent } from '../../auth/interfaces/authenticated-student';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import { DeleteDocumentUseCase } from '../application/delete-document.use-case';
import {
  GetDocumentUseCase,
  toPublicDocument,
} from '../application/get-document.use-case';
import { ListDocumentKnowledgeUnitsUseCase } from '../application/list-document-knowledge-units.use-case';
import { ListSubjectDocumentsUseCase } from '../application/list-subject-documents.use-case';
import { RegisterDocumentUseCase } from '../application/register-document.use-case';
import {
  ArchiveDocumentUseCase,
  GetDocumentSourceLifecycleUseCase,
} from '../application/source-lifecycle.use-case';
import { UploadCoursePdfUseCase } from '../application/upload-course-pdf.use-case';
import { DOCUMENT_KINDS, type DocumentKind } from '../domain/document.entity';
import {
  SourceArchiveBlockedError,
  SourceDeleteBlockedError,
} from '../domain/source-lifecycle.entity';
import {
  MAX_DOCUMENT_BYTES,
  type UploadedCoursePdfFile,
  validateCoursePdfFile,
} from './course-pdf-upload.validator';

const MAX_FILE_NAME_LENGTH = 255;
const MAX_STORAGE_PATH_LENGTH = 512;
const MAX_MIME_TYPE_LENGTH = 100;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

class RegisterDocumentDto {
  subjectId!: string;
  kind!: string;
  fileName!: string;
  storagePath!: string;
  mimeType!: string;
}

class UploadCoursePdfDto {
  subjectId!: string;
}

@Controller()
@UseGuards(FirebaseAuthGuard)
export class DocumentsController {
  constructor(
    private readonly registerDocument: RegisterDocumentUseCase,
    private readonly listSubjectDocuments: ListSubjectDocumentsUseCase,
    private readonly getDocument: GetDocumentUseCase,
    private readonly listDocumentKnowledgeUnits: ListDocumentKnowledgeUnitsUseCase,
    private readonly uploadCoursePdfUseCase: UploadCoursePdfUseCase,
    private readonly deleteDocumentUseCase: DeleteDocumentUseCase,
    private readonly getDocumentSourceLifecycleUseCase: GetDocumentSourceLifecycleUseCase,
    private readonly archiveDocumentUseCase: ArchiveDocumentUseCase,
  ) {}

  @Post('documents')
  register(
    @CurrentStudent() student: AuthenticatedStudent,
    @Body() body: RegisterDocumentDto,
  ) {
    const validatedBody = validateRegisterDocumentBody(
      student.firebaseUid,
      body,
    );

    return this.registerDocument
      .execute({
        studentId: student.id,
        subjectId: validatedBody.subjectId,
        kind: validatedBody.kind,
        fileName: validatedBody.fileName,
        storagePath: validatedBody.storagePath,
        mimeType: validatedBody.mimeType,
      })
      .then(toPublicDocument)
      .catch((error: unknown) => {
        normalizeDocumentRegistrationError(error);
      });
  }

  @Post('documents/course-pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_DOCUMENT_BYTES },
    }),
  )
  uploadCoursePdf(
    @CurrentStudent() student: AuthenticatedStudent,
    @Body() body: UploadCoursePdfDto,
    @UploadedFile() file: UploadedCoursePdfFile | undefined,
  ) {
    const subjectId = trimRequiredString(
      body?.subjectId,
      'Document subjectId is required',
    );
    const validatedFile = validateCoursePdfFile(file);

    return this.uploadCoursePdfUseCase
      .execute({
        studentId: student.id,
        firebaseUid: student.firebaseUid,
        subjectId,
        originalFileName: validatedFile.originalFileName,
        content: validatedFile.content,
        mimeType: validatedFile.mimeType,
      })
      .then(toPublicDocument)
      .catch((error: unknown) => {
        normalizeDocumentRegistrationError(error);
      });
  }

  @Get('subjects/:subjectId/documents')
  listForSubject(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('subjectId') subjectId: string,
  ) {
    return this.listSubjectDocuments
      .execute({
        studentId: student.id,
        subjectId,
      })
      .then((documents) => documents.map(toPublicDocument))
      .catch((error: unknown) => {
        normalizeDocumentRegistrationError(error);
      });
  }

  @Get('documents/:documentId')
  get(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('documentId') documentId: string,
  ) {
    const validatedDocumentId = trimRequiredString(
      documentId,
      'Document id is required',
    );

    return this.getDocument.execute({
      studentId: student.id,
      documentId: validatedDocumentId,
    });
  }

  @Get('documents/:documentId/knowledge-units')
  listKnowledgeUnits(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('documentId') documentId: string,
  ) {
    const validatedDocumentId = trimRequiredString(
      documentId,
      'Document id is required',
    );

    return this.listDocumentKnowledgeUnits.execute({
      studentId: student.id,
      documentId: validatedDocumentId,
    });
  }

  @Delete('documents/:documentId')
  @HttpCode(204)
  delete(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('documentId') documentId: string,
  ) {
    const validatedDocumentId = trimRequiredString(
      documentId,
      'Document id is required',
    );

    return this.deleteDocumentUseCase
      .execute({
        studentId: student.id,
        documentId: validatedDocumentId,
      })
      .catch(normalizeDocumentLifecycleError);
  }

  @Get('documents/:documentId/lifecycle')
  getLifecycle(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('documentId') documentId: string,
  ) {
    const validatedDocumentId = trimRequiredString(
      documentId,
      'Document id is required',
    );

    return this.getDocumentSourceLifecycleUseCase
      .execute({
        studentId: student.id,
        documentId: validatedDocumentId,
      })
      .catch(normalizeDocumentLifecycleError);
  }

  @Post('documents/:documentId/archive')
  archive(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('documentId') documentId: string,
  ) {
    const validatedDocumentId = trimRequiredString(
      documentId,
      'Document id is required',
    );

    return this.archiveDocumentUseCase
      .execute({
        studentId: student.id,
        documentId: validatedDocumentId,
      })
      .catch(normalizeDocumentLifecycleError);
  }
}

function validateRegisterDocumentBody(
  storageOwnerId: string,
  body: RegisterDocumentDto,
): {
  subjectId: string;
  kind: DocumentKind;
  fileName: string;
  storagePath: string;
  mimeType: string;
} {
  const subjectId = trimRequiredString(
    body?.subjectId,
    'Document subjectId is required',
  );
  const kind = validateDocumentKind(body?.kind);
  const fileName = trimRequiredString(
    body?.fileName,
    'Document file name is required',
    MAX_FILE_NAME_LENGTH,
  );
  const storagePath = trimRequiredString(
    body?.storagePath,
    'Document storage path is required',
    MAX_STORAGE_PATH_LENGTH,
  );
  const mimeType = trimRequiredString(
    body?.mimeType,
    'Document mime type is required',
    MAX_MIME_TYPE_LENGTH,
  );

  validateFileName(fileName);
  validateStoragePath({
    storageOwnerId,
    subjectId,
    fileName,
    storagePath,
  });

  if (
    (kind === 'COURSE_PDF' || kind === 'EXAM_PDF') &&
    mimeType !== 'application/pdf'
  ) {
    throw new BadRequestException('PDF documents must use application/pdf');
  }

  if (kind === 'EXAM_IMAGE' && !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new BadRequestException(
      'Exam images must use image/jpeg, image/png, or image/webp',
    );
  }

  return {
    subjectId,
    kind,
    fileName,
    storagePath,
    mimeType,
  };
}

function trimRequiredString(
  value: unknown,
  message: string,
  maxLength?: number,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(message);
  }

  const trimmed = value.trim();

  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw new BadRequestException(message);
  }

  return trimmed;
}

function validateDocumentKind(value: unknown): DocumentKind {
  if (
    typeof value !== 'string' ||
    !DOCUMENT_KINDS.includes(value as DocumentKind)
  ) {
    throw new BadRequestException(
      'Document kind must be COURSE_PDF, EXAM_PDF, or EXAM_IMAGE',
    );
  }

  return value as DocumentKind;
}

function validateFileName(fileName: string): void {
  if (
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName.includes('%') ||
    fileName === '.' ||
    fileName === '..'
  ) {
    throw new BadRequestException('Document file name must be canonical');
  }
}

function validateStoragePath(input: {
  storageOwnerId: string;
  subjectId: string;
  fileName: string;
  storagePath: string;
}): void {
  if (
    input.storagePath.includes('\\') ||
    input.storagePath.includes('%') ||
    input.storagePath.startsWith('/') ||
    input.storagePath.endsWith('/')
  ) {
    throw new BadRequestException('Document storage path must be canonical');
  }

  const segments = input.storagePath.split('/');

  if (
    segments.length !== 5 ||
    segments.some(
      (segment) => segment === '' || segment === '.' || segment === '..',
    )
  ) {
    throw new BadRequestException('Document storage path must be canonical');
  }

  const [
    studentsSegment,
    studentSegment,
    subjectsSegment,
    subjectSegment,
    fileSegment,
  ] = segments;

  if (
    studentsSegment !== 'students' ||
    studentSegment !== input.storageOwnerId ||
    subjectsSegment !== 'subjects' ||
    subjectSegment !== input.subjectId ||
    fileSegment !== input.fileName
  ) {
    throw new BadRequestException(
      'Document storage path must match the current student, subject, and file name',
    );
  }
}

function normalizeDocumentRegistrationError(error: unknown): never {
  if (
    error instanceof Error &&
    (error.message === 'Subject does not belong to student' ||
      error.message ===
        'Document kind must be COURSE_PDF, EXAM_PDF, or EXAM_IMAGE' ||
      error.message === 'Document file name is required' ||
      error.message === 'Document storage path is required' ||
      error.message === 'Document mime type is required' ||
      error.message === 'Document content is required' ||
      error.message === 'Course documents must be PDF files' ||
      error.message === 'PDF documents must use application/pdf' ||
      error.message === 'Exam images must use an image mime type' ||
      error.message ===
        'Exam images must use image/jpeg, image/png, or image/webp')
  ) {
    throw new BadRequestException(error.message);
  }

  throw error;
}

function normalizeDocumentLifecycleError(error: unknown): never {
  if (
    error instanceof SourceDeleteBlockedError ||
    error instanceof SourceArchiveBlockedError
  ) {
    throw new ConflictException({
      code: error.code,
      message: error.message,
      decision: error.decision,
    });
  }

  throw error;
}

~~~
