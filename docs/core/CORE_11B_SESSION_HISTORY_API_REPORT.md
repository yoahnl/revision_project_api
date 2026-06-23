# CORE-11B — Session history API report

## Résumé

CORE-11B ajoute l'historique des sessions terminées côté API sans migration Prisma. Les sessions terminées peuvent être listées par cours et globalement pour l'étudiant connecté, avec un DTO léger qui contient la session, le résumé et le cours. Le détail existant `GET /revision-sessions/:sessionId/result` reste la source de vérité pour les corrections complètes.

## Audit initial avant implémentation

- `RevisionSession` contient déjà `status`, `courseId`, `studentId`, `createdAt` et `completedAt`.
- `ActivitySession` contient déjà `ActivityResult`, `QuestionAnswer` et les corrections nécessaires au détail résultat.
- CORE-11A a déjà ajouté les brouillons serveur et le lookup de session reprenable par cours.
- Aucune table supplémentaire n'est nécessaire : l'historique terminé peut être construit depuis les tables existantes.
- Les listes ne doivent pas charger les réponses/corrections complètes, uniquement le résumé `ActivityResult`.

## Décisions produit

- L'historique MVP liste uniquement les sessions `COMPLETED` avec `completedAt`.
- Les sessions `STARTED` restent gérées par CORE-11A via la reprise et ne remontent pas dans l'historique terminé.
- Les corrections détaillées restent disponibles uniquement via le résultat de session.
- L'historique global API est exposé, même si l'app ne l'affiche pas encore.

## Endpoints ajoutés/modifiés

- Ajout : `GET /courses/:courseId/revision-sessions/history`
- Ajout : `GET /revision-sessions/history`
- Conservé : `GET /revision-sessions/:sessionId/result`

## DTO publics

Ajout de `RevisionSessionHistoryResponseDto` et `RevisionSessionHistoryItemDto` :

- `session` : id, subjectId, courseId, mode, status, createdAt, completedAt ;
- `summary` : correctAnswers, totalQuestions, score, durationSeconds ;
- `course` : id, title.

## Règles d'ownership

Les repositories filtrent toujours par `studentId`. L'historique par cours filtre aussi par `courseId`. Le résultat détaillé existant conserve ses vérifications d'ownership et refuse les sessions non terminées.

## Règles de filtrage historique

- `status = COMPLETED`
- `completedAt != null`
- `studentId` obligatoire
- `courseId` obligatoire sur l'historique de cours
- cours et matière parents actifs
- tri `completedAt desc`, puis `createdAt desc`
- limite bornée par le use case : défaut 10, maximum 50

## Architecture API

- Les controllers restent minces et délèguent aux use cases.
- `ListCourseRevisionSessionHistoryUseCase` et `ListRevisionSessionHistoryUseCase` portent la validation applicative.
- `RevisionSessionsRepository` expose `findCompletedCourseSessionsForStudent` et `findCompletedSessionsForStudent`.
- `PrismaRevisionSessionsRepository` fait les sélections optimisées sans include des réponses/corrections.

## Tests ajoutés/modifiés

- Use case : limite par défaut, limite explicite, limites invalides.
- Repository Prisma : sessions terminées par cours, exclusion `STARTED`, exclusion `COMPLETED` sans `completedAt`, tri, limite, filtrage student/course, liste globale, absence de corrections dans le select.
- Controllers : endpoints history, limite invalide, mapping 404/400.
- Non-régression : mocks des use cases existants mis à jour avec les nouvelles méthodes du port.

## Validations exécutées

- `npx prisma validate` : OK
- `npx prisma generate` : OK
- `npm run build` : OK
- `npm run lint:check` : OK
- `npm test -- revision-sessions --runInBand` : 10 suites, 86 tests OK
- `npm test -- courses --runInBand` : 14 suites, 122 tests OK
- `npm test -- activities --runInBand` : 21 suites OK, 1 suite skipped existante, 365 tests OK
- `npm test -- question-bank --runInBand` : 7 suites, 38 tests OK
- `npm test -- --runInBand` : 100 suites OK, 1 suite skipped existante, 861 tests OK
- `npm run test:e2e -- --runInBand` : 2 suites, 34 tests OK

## Vérification Dokploy

Dokploy MCP est disponible. Le projet `revision app` expose `frontEnd`, `backEnd`, PostgreSQL et Redis. Le dernier déploiement backEnd lu est `CORE-11A session draft resume API`, commit `d75b0a3b9b6cf5a1076c86ea3751c06cafb4a9d0`, statut `done`.

CORE-11B n'est pas déployé pendant ce lot car aucun commit/push n'est effectué par Codex. Un smoke runtime post-déploiement reste requis après commit humain.

## Vérification Marionette

Marionette MCP est disponible côté app, mais la validation bout-en-bout CORE-11B n'a pas été exécutée contre Dokploy car le backend déployé ne contient pas CORE-11B. La preuve runtime post-déploiement reste à faire.

## Fichiers créés/modifiés/supprimés

Créés :

- `src/modules/revision-sessions/application/list-revision-session-history.use-case.ts`
- `src/modules/revision-sessions/application/list-revision-session-history.use-case.spec.ts`
- `docs/core/CORE_11B_SESSION_HISTORY_API_REPORT.md`
- `docs/core/CORE_11B_SESSION_HISTORY_EVIDENCE_PACK.md`

Modifiés :

- `docs/roadmap/v2/EXECUTION_LOT_TRACKER_V2.md`
- `docs/roadmap/v2/LOT_TRACKER_V2.md`
- `src/modules/courses/interfaces/courses.controller.spec.ts`
- `src/modules/courses/interfaces/courses.controller.ts`
- `src/modules/revision-sessions/application/complete-quick-revision-session.use-case.spec.ts`
- `src/modules/revision-sessions/application/get-revision-session-result.use-case.spec.ts`
- `src/modules/revision-sessions/application/request-next-revision-session-action.use-case.spec.ts`
- `src/modules/revision-sessions/application/revision-sessions.repository.ts`
- `src/modules/revision-sessions/application/start-revision-session.use-case.spec.ts`
- `src/modules/revision-sessions/domain/revision-session-result.entity.ts`
- `src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.spec.ts`
- `src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.ts`
- `src/modules/revision-sessions/interfaces/revision-sessions.controller.spec.ts`
- `src/modules/revision-sessions/interfaces/revision-sessions.controller.ts`
- `src/modules/revision-sessions/revision-sessions.module.ts`

Supprimés : aucun.

## Limites restantes

- Pas de pagination complète, seulement une limite bornée.
- Pas d'historique analytique avancé.
- Runtime Dokploy/Marionette CORE-11B à réaliser après déploiement.

## Auto-review finale

- Aucune migration ajoutée.
- Aucun prompt/provider IA modifié.
- Aucun changement CORE-10 question bank.
- Les sessions en cours ne sont pas listées dans l'historique terminé.
- Le résultat détaillé reste séparé de la liste légère.
- Aucun commit effectué.

## Critique du prompt

Le prompt demande une preuve runtime alors que les règles interdisent commit/push. La preuve déployée ne peut donc être complète qu'après intervention humaine. Le lot reste néanmoins validé localement par build, lint, full Jest et e2e.
