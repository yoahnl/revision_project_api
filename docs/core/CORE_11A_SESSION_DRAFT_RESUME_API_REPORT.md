# CORE-11A — Session draft persistence & resume API report

## Résumé

CORE-11A ajoute la reprise de session côté API.

Le backend sait maintenant :

- retrouver la dernière session quick en cours pour un cours ;
- persister une réponse brouillon par question ;
- supprimer une réponse brouillon ;
- renvoyer les brouillons dans `GET /revision-sessions/:sessionId` ;
- exclure les sessions terminées de la reprise ;
- refuser les brouillons sur une session terminée, une question hors session ou un choix invalide.

Le parcours quick CORE-10 reste inchangé : le démarrage de session ne relance pas de génération IA synchrone.

## Audit initial avant implémentation

Zones relues :

- `src/modules/revision-sessions/application`
- `src/modules/revision-sessions/domain`
- `src/modules/revision-sessions/infrastructure`
- `src/modules/revision-sessions/interfaces`
- `src/modules/activities/application`
- `src/modules/activities/infrastructure`
- `src/modules/courses/application/start-course-quick-revision-session.use-case.ts`
- `src/modules/activities/application/question-bank.service.ts`
- `src/modules/activities/application/question-bank.repository.ts`
- `prisma/schema.prisma`

Constats :

- `RevisionSession` portait déjà `STARTED` / `COMPLETED`.
- Les sessions quick ont une action courante `DIAGNOSTIC_QUIZ` avec `activitySessionId`.
- Les questions quick sont portées par `ActivitySession` / `Question`.
- `GET /revision-sessions/:sessionId` existait mais ne renvoyait aucun brouillon.
- Aucun modèle ne permettait de sauvegarder une réponse non soumise.
- Le détail cours ne pouvait pas demander une session reprenable.
- La completion quick existante calcule toujours le résultat depuis les réponses soumises, pas depuis les drafts.

## Passes utilisées

- Product Flow Agent : définition de la reprise comme session quick `STARTED` restaurable.
- API Domain Agent : audit `RevisionSession`, `RevisionSessionAction`, `ActivitySession`, `Question`.
- Prisma/Data Model Agent : choix d'une table unique `RevisionQuestionDraftAnswer`.
- API Contract Agent : endpoints `resumable`, `PUT draft-answer`, `DELETE draft-answer`.
- Security / Ownership Agent : validation student/session/action/question/choice.
- Clean Architecture Agent : use cases dédiés et port repository étendu.
- QA Agent : tests repository, controller, courses, e2e, full Jest.
- Runtime Agent : Dokploy consulté en lecture ; pas de déploiement CORE-11A sans commit humain.
- Reviewer Agent : revue scope et non-régression CORE-10.

## Décisions produit

Une session est reprenable si :

- elle appartient à l'étudiant ;
- elle est `STARTED` ;
- elle n'a pas `completedAt` ;
- elle appartient au cours actif demandé ;
- son cours et sa matière ne sont pas archivés ;
- elle possède une action courante exploitable.

Une session terminée n'est pas renvoyée par la recherche de reprise.

## Architecture API

Contrats publics ajoutés :

```text
GET /courses/:courseId/revision-sessions/resumable
PUT /revision-sessions/:sessionId/questions/:questionId/draft-answer
DELETE /revision-sessions/:sessionId/questions/:questionId/draft-answer
```

Contrat enrichi :

```text
GET /revision-sessions/:sessionId
```

Le payload de session contient maintenant :

```text
draftAnswers[]
```

Chaque draft contient :

- `questionId`
- `selectedChoiceIds`
- `updatedAt`

## Modèle de données

Migration ajoutée :

```text
prisma/migrations/20260623010000_core_11a_session_drafts/migration.sql
```

Modèle ajouté :

```text
RevisionQuestionDraftAnswer
```

Champs :

- `studentId`
- `sessionId`
- `activitySessionId`
- `questionId`
- `selectedChoiceIds`
- `createdAt`
- `updatedAt`

Contraintes :

- unique `studentId + sessionId + questionId` ;
- index `studentId + sessionId` ;
- liens vers student, session, activity session et question.

## Endpoints créés/modifiés

### Resumable course session

`GET /courses/:courseId/revision-sessions/resumable`

Retourne une session en cours ou `null`.

Progression renvoyée :

- `answeredQuestionCount`
- `totalQuestionCount`

Le compteur de réponses sauvegardées se base sur les brouillons non vides.

### Save draft answer

`PUT /revision-sessions/:sessionId/questions/:questionId/draft-answer`

Payload :

```json
{
  "selectedChoiceIds": ["choice-id"]
}
```

Un tableau vide supprime le draft existant.

### Delete draft answer

`DELETE /revision-sessions/:sessionId/questions/:questionId/draft-answer`

Supprime explicitement le draft de la question.

## Règles d'ownership

Les opérations vérifient :

- session appartenant à `studentId` ;
- session non terminée ;
- action courante `DIAGNOSTIC_QUIZ` prête ;
- `questionId` appartenant à l'`activitySessionId` courant ;
- `choiceId` appartenant à la question ;
- pas d'accès cross-user par construction des queries `studentId`.

## Validation draft

Règles :

- draft vide accepté ;
- choix dupliqués refusés ;
- choix inconnu refusé ;
- single choice : maximum 1 choix ;
- multiple choice : maximum `maxSelections` si présent, sinon nombre de choix ;
- les drafts ne forcent pas une réponse complète.

La soumission finale existante garde ses propres règles.

## Clean architecture

Use cases ajoutés :

- `GetResumableCourseRevisionSessionUseCase`
- `SaveRevisionSessionDraftAnswerUseCase`
- `DeleteRevisionSessionDraftAnswerUseCase`

Port repository étendu :

- `findResumableCourseSessionForStudent`
- `saveDraftAnswer`
- `deleteDraftAnswer`

Prisma reste dans `PrismaRevisionSessionsRepository`.

## Tests ajoutés/modifiés

Modifiés :

- `src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.spec.ts`
- `src/modules/revision-sessions/interfaces/revision-sessions.controller.spec.ts`
- `src/modules/courses/interfaces/courses.controller.spec.ts`

Couverture ajoutée :

- chargement des drafts dans une session ;
- recherche de la dernière session reprenable d'un cours ;
- sauvegarde d'un draft valide ;
- refus de choix hors question ;
- endpoint resumable côté courses ;
- endpoints save/delete draft côté revision sessions ;
- rejet de payload draft malformé ;
- mapping 409 pour session terminée.

## Validations exécutées

```bash
npx prisma validate
```

Résultat : PASS.

```bash
npx prisma generate
```

Résultat : PASS.

```bash
npm run build
```

Résultat : PASS.

```bash
npm run lint:check
```

Résultat final : PASS.

```bash
npm test -- revision-sessions --runInBand
```

Résultat final : PASS, 9 suites, 78 tests.

```bash
npm test -- courses --runInBand
```

Résultat : PASS, 14 suites, 120 tests.

```bash
npm test -- activities --runInBand
```

Résultat : PASS, 21 suites passées, 1 suite skipped, 365 tests passés, 1 test skipped.

```bash
npm test -- question-bank --runInBand
```

Résultat : PASS, 7 suites, 38 tests.

```bash
npm test -- --runInBand
```

Résultat : PASS, 99 suites passées, 1 suite skipped, 851 tests passés, 1 test skipped.

```bash
npm run test:e2e -- --runInBand
```

Résultat : PASS, 2 suites, 34 tests.

```bash
npx prisma migrate dev --name core_11a_session_drafts
```

Résultat : FAIL local, datasource PostgreSQL locale indisponible. `nc -zv localhost 5432` retourne `Connection refused`, puis `npx prisma migrate status` retourne `P1001: Can't reach database server at localhost:5432`. La migration est donc fournie sous forme SQL et validée par `prisma validate/generate`, mais l'application locale de migration n'a pas pu être prouvée dans cet environnement sans PostgreSQL local.

## Vérification Dokploy

Dokploy MCP disponible et consulté en lecture.

Constats non sensibles :

- projet : `revision app` ;
- application backend : `backEnd` / `revision_project_api` ;
- dernier déploiement lu : `CORE-10C-bis fix question bank worker DI`, commit `aae5dff81dc659d1c625e3f2d6792d1675254bd4` ;
- logs backend consultés : CORE-10 worker/readiness actifs en production ;
- CORE-11A non déployé, car aucun commit/push n'a été effectué.

Aucune configuration Dokploy n'a été modifiée.

Note sécurité : la sortie brute Dokploy contenait des champs sensibles non nécessaires. Ils ne sont pas recopiés dans ce rapport.

## Vérification Marionette

Marionette MCP est disponible côté environnement.

Le scénario runtime complet CORE-11A n'a pas été exécuté car :

- l'API CORE-11A locale dépend d'une migration non appliquée localement faute de PostgreSQL local accessible ;
- le backend déployé ne contient pas encore CORE-11A ;
- aucun commit/push/deploy n'est autorisé dans ce lot.

Preuve runtime post-déploiement requise après commit humain.

## Fichiers créés/modifiés/supprimés

Créés :

- `prisma/migrations/20260623010000_core_11a_session_drafts/migration.sql`
- `src/modules/revision-sessions/application/get-resumable-course-revision-session.use-case.ts`
- `src/modules/revision-sessions/application/save-revision-session-draft-answer.use-case.ts`
- `src/modules/revision-sessions/application/delete-revision-session-draft-answer.use-case.ts`
- `docs/core/CORE_11A_SESSION_DRAFT_RESUME_API_REPORT.md`
- `docs/core/CORE_11A_SESSION_DRAFT_RESUME_EVIDENCE_PACK.md`

Modifiés :

- `prisma/schema.prisma`
- `src/modules/courses/interfaces/courses.controller.ts`
- `src/modules/courses/interfaces/courses.controller.spec.ts`
- `src/modules/revision-sessions/application/revision-sessions.repository.ts`
- `src/modules/revision-sessions/domain/revision-session.entity.ts`
- `src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.ts`
- `src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.spec.ts`
- `src/modules/revision-sessions/interfaces/revision-sessions.controller.ts`
- `src/modules/revision-sessions/interfaces/revision-sessions.controller.spec.ts`
- `src/modules/revision-sessions/revision-sessions.module.ts`
- `docs/roadmap/v2/EXECUTION_LOT_TRACKER_V2.md`
- `docs/roadmap/v2/LOT_TRACKER_V2.md`

Supprimés : aucun.

## Contenu complet des fichiers

Le contenu complet des fichiers créés/modifiés est présent dans le workspace et dans le diff Git local. Le rapport courant ne s'inclut pas lui-même pour éviter l'auto-inclusion récursive.

## Limites restantes

- Pas de runtime post-déploiement CORE-11A sans commit/push humain.
- Pas d'historique de sessions terminées : volontairement reporté à CORE-11B.
- Pas de reprise deep/exam : hors scope.
- Migration non appliquée localement à cause de l'erreur Prisma schema engine.

## Auto-review

- Les drafts sont persistés serveur.
- Une session quick en cours est détectable par cours.
- Une session terminée n'est pas reprenable.
- Les drafts sont renvoyés avec la session.
- L'ownership est appliqué par `studentId`.
- Les choix invalides sont refusés.
- Le quick start CORE-10 n'est pas modifié pour générer de l'IA synchrone.
- Aucun backend storage/question bank/prompt/provider n'a été modifié.
- Aucun commit effectué.

## Critique du prompt

Le lot demandait une preuve runtime Marionette/Dokploy complète tout en interdisant commit/push. C'est cohérent pour une vérification locale, mais ici PostgreSQL local n'est pas accessible pour appliquer la migration et Dokploy ne peut pas exécuter CORE-11A non déployé. Le rapport documente donc la limite au lieu d'inventer une preuve.

## Confirmation Git

Aucun commit, amend, merge, rebase, tag ou push n'a été effectué.
