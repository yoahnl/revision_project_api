# CORE-09B Storage Cleanup API Report

## 1. Résumé

CORE-09B ajoute le cleanup physique des fichiers documentaires après suppression DB safe, sans toucher à la politique CORE-09A `DELETE / ARCHIVE / BLOCK`.

Le backend crée maintenant une intention `DocumentFileCleanupJob` dans la même transaction que la suppression DB autorisée, puis un processor interne supprime le fichier via `DocumentFileStorage.delete`.

## 2. Audit initial

Fichiers audités :

- `prisma/schema.prisma`
- `prisma/migrations/`
- `src/modules/documents/application/document-file-storage.ts`
- `src/modules/documents/application/delete-document.use-case.ts`
- `src/modules/documents/application/documents.repository.ts`
- `src/modules/documents/application/source-lifecycle.use-case.ts`
- `src/modules/documents/infrastructure/local-document-file-storage.ts`
- `src/modules/documents/infrastructure/prisma-documents.repository.ts`
- `src/modules/documents/documents.module.ts`
- `src/modules/courses/application/delete-course-document.use-case.ts`
- `src/modules/courses/application/course-source-lifecycle.use-case.ts`
- `src/modules/courses/infrastructure/prisma-courses.repository.ts`
- `src/modules/courses/interfaces/courses.controller.ts`
- `src/modules/jobs/`
- `src/shared/infrastructure/prisma/`
- `test/`

Audit détaillé : `docs/core/CORE_09B_STORAGE_CLEANUP_AUDIT.md`.

## 3. Sub-agents / passes utilisées

- Storage Audit Agent : cartographie storage local, `storagePath`, `LocalDocumentFileStorage`, suppressions physiques existantes.
- Database / Outbox Agent : recommandation outbox sans FK vers `Document`, migration additive, risques FK.
- Infrastructure Storage Agent : durcissement tests storage local et idempotence `ENOENT`.
- Cleanup Processor Agent : intégration BullMQ minimale, queue dédiée, worker interne, source DB retryable.
- API Compatibility Agent : endpoints publics inchangés.
- QA Agent : suites ciblées, e2e, full Jest, static searches.
- Reviewer Agent : vérification scope, archive sans purge, pas de cloud prématuré, pas de Flutter runtime.

## 4. Architecture retenue

Architecture retenue :

```text
DELETE safe
-> transaction Prisma
-> document.deleteMany
-> DocumentFileCleanupJob(PENDING)
-> queue document-file-cleanup
-> ProcessDocumentFileCleanupJobUseCase
-> DocumentFileStorage.delete
-> job COMPLETED / PENDING retry / FAILED
```

Le filesystem n'est jamais appelé dans la transaction DB.

## 5. Port storage avant/après

Le port `DocumentFileStorage` conserve :

- `saveCoursePdf(...)`;
- `delete({ storagePath })`.

CORE-09B ne change pas son contrat public, mais ajoute des tests directs de suppression locale.

## 6. Politique cleanup

- Archive : aucun cleanup job.
- Delete safe : cleanup job transactionnel.
- Delete bloqué : aucun cleanup job.
- Document inconnu/cross-student/cross-course : aucun cleanup job.
- Fichier absent : cleanup réussi.
- Chemin dangereux : erreur stable avant suppression.

## 7. Schéma Prisma / migration

Migration créée :

`prisma/migrations/20260622100000_document_file_cleanup_jobs/migration.sql`

Modèle ajouté :

`DocumentFileCleanupJob`

Champs principaux :

- `documentId String?`
- `studentId String`
- `storagePath String`
- `reason String`
- `status JobStatus`
- `attempts Int`
- `lastError String?`
- `lockedAt DateTime?`
- `completedAt DateTime?`

Aucune FK vers `Document`.

## 8. Outbox / cleanup jobs

`PrismaDocumentsRepository` crée un cleanup job uniquement si :

- la policy CORE-09A autorise la suppression ;
- le `document.deleteMany` a effectivement supprimé une ligne.

Reasons utilisées :

- `DOCUMENT_SAFE_DELETE`
- `COURSE_SOURCE_SAFE_DELETE`

## 9. Processor / worker

Ajouts :

- `DOCUMENT_FILE_CLEANUP_QUEUE`
- `BullMqDocumentFileCleanupQueue`
- `DocumentFileCleanupConsumer`
- `ProcessDocumentFileCleanupJobUseCase`
- `ProcessPendingDocumentFileCleanupJobsUseCase`
- `PrismaDocumentFileCleanupRepository`

Queue :

- nom : `document-file-cleanup`
- job : `cleanup-document-file`
- `jobId` stable : `cleanupJobId`
- attempts BullMQ : `3`
- backoff exponentiel : `5000ms`

Worker activable par :

- `DOCUMENT_FILE_CLEANUP_WORKER_ENABLED=true`
- ou fallback sur `DOCUMENT_PROCESSING_WORKER_ENABLED=true`

En test, la queue cleanup est no-op.

## 10. Garanties transactionnelles

Garanti :

- pas de cleanup physique sans suppression DB safe ;
- pas de job cleanup si la suppression DB échoue ;
- pas de cleanup job sur archive ;
- job DB créé dans la même transaction que la suppression DB ;
- chemin de fichier stocké dans le job avant disparition de la ligne `Document`.

Non garanti en V0 :

- récupération automatique des jobs `RUNNING` abandonnés ;
- requeue automatique si BullMQ est indisponible après commit ;
- nettoyage des blobs historiques orphelins.

## 11. Gestion des erreurs storage

`LocalDocumentFileStorage.delete` :

- supprime un fichier sous racine contrôlée ;
- traite `ENOENT` comme succès ;
- refuse chemins absolus, `..`, backslash et sortie de racine ;
- ne supprime pas un répertoire.

`ProcessDocumentFileCleanupJobUseCase` :

- marque `COMPLETED` si suppression OK ;
- marque `PENDING` avec `attempts + 1` si retry disponible ;
- marque `FAILED` quand `maxAttempts` est atteint ;
- conserve `lastError`.

## 12. Comportement archive vs delete

Archive :

- conserve `Document`;
- conserve `storagePath`;
- conserve fichier physique ;
- ne crée aucun `DocumentFileCleanupJob`.

Delete safe :

- supprime `Document`;
- crée `DocumentFileCleanupJob`;
- supprime le fichier ensuite via worker/use case.

## 13. Tests ajoutés/modifiés

Ajoutés :

- `process-document-file-cleanup.use-case.spec.ts`
- `prisma-document-file-cleanup.repository.spec.ts`
- `bullmq-document-file-cleanup.queue.spec.ts`
- `document-file-cleanup.consumer.spec.ts`

Modifiés :

- tests delete document/course pour `cleanupJobId` + enqueue ;
- tests Prisma documents pour cleanup job transactionnel ;
- tests storage local pour delete idempotent et chemins dangereux ;
- test JobsModule pour queue cleanup no-op.

## 14. Commandes exécutées

```bash
npm test -- documents --runInBand
npm test -- courses --runInBand
npm test -- cleanup --runInBand
npm test -- storage --runInBand
npm test -- lifecycle --runInBand
npm test -- jobs --runInBand
npx prisma validate
npx prisma generate
npm run build
npm run lint:check
npm run test:e2e -- --runInBand
npm test -- --runInBand
```

Les commandes finales complémentaires ont aussi été exécutées :

```bash
git diff --check
git status --short --untracked-files=all
```

## 15. Résultats exacts

- `npm test -- documents --runInBand` : 12 suites passées, 92 tests passés.
- `npm test -- courses --runInBand` : 10 suites passées, 85 tests passés.
- `npm test -- cleanup --runInBand` : 4 suites passées, 12 tests passés.
- `npm test -- storage --runInBand` : 1 suite passée, 6 tests passés.
- `npm test -- lifecycle --runInBand` : 2 suites passées, 8 tests passés.
- `npm test -- jobs --runInBand` : 5 suites passées, 15 tests passés.
- `npx prisma validate` : schema valid.
- `npx prisma generate` : Prisma Client 7.8.0 généré.
- `npm run build` : succès.
- `npm run lint:check` : succès après formatage ciblé des fichiers modifiés.
- `npm run test:e2e -- --runInBand` : 2 suites passées, 34 tests passés.
- `npm test -- --runInBand` : 91 suites passées, 1 skipped, 779 tests passés, 1 skipped.
- `git diff --check` : succès, aucune erreur whitespace.
- `git status --short --untracked-files=all` : changements attendus listés pour CORE-09B, aucun commit.

## 16. Recherches statiques

Recherches exécutées :

```bash
rg -n "DocumentFileStorage|LocalDocumentFileStorage|storagePath|deleteForStudent|deleteCourseDocumentForStudent|deleteDocument|deleteMany|archiveForStudent|archivedAt" src prisma test --glob '!src/generated/prisma/**'
rg -n "unlink|rm\\(|deleteFile|removeFile|fs\\.|promises\\.unlink|storagePath" src test --glob '!src/generated/prisma/**'
rg -n "document\\.delete|document\\.deleteMany|deleteMany|onDelete|Cascade|Restrict|NoAction" prisma src test --glob '!src/generated/prisma/**'
rg -n "DocumentFileCleanup|CleanupJob|cleanup|archivedAt|archivedReason|DocumentFileStorage|LocalDocumentFileStorage" src prisma test --glob '!src/generated/prisma/**'
```

Résultat :

- suppressions physiques directes limitées au storage local et aux rollbacks upload existants ;
- suppressions utilisateur document passent par la policy CORE-09A puis le cleanup job ;
- archives sans cleanup job ;
- `storagePath` reste testé comme absent des réponses publiques critiques.

## 17. Limitations

- Les jobs `RUNNING` trop anciens ne sont pas encore récupérés automatiquement.
- Les jobs DB `PENDING` peuvent rester en attente si Redis est indisponible après commit et avant enqueue ; la table conserve toutefois l'intention.
- Pas de backfill des blobs orphelins historiques.
- Pas de provider cloud.
- Pas d'endpoint admin de retry.

## 18. Dette restante CORE-09C

- Lifecycle matière/cours.
- Suppression/archivage/rename cours et matières.
- Suppressions cascade avec cleanup storage.
- Contrats frontend pour capacités `NEEDS_API`.

## 19. Dette éventuelle storage cloud

- Abstraction S3/GCS.
- Config env cloud.
- Tests de provider cloud mocké.
- Politique de retry/monitoring production.

## 20. Fichiers créés/modifiés/supprimés

Créés :

- `prisma/migrations/20260622100000_document_file_cleanup_jobs/migration.sql`
- `src/modules/documents/application/document-file-cleanup.repository.ts`
- `src/modules/documents/application/process-document-file-cleanup.use-case.ts`
- `src/modules/documents/application/process-document-file-cleanup.use-case.spec.ts`
- `src/modules/documents/infrastructure/prisma-document-file-cleanup.repository.ts`
- `src/modules/documents/infrastructure/prisma-document-file-cleanup.repository.spec.ts`
- `src/modules/jobs/application/document-file-cleanup.queue.ts`
- `src/modules/jobs/infrastructure/bullmq-document-file-cleanup.queue.ts`
- `src/modules/jobs/infrastructure/bullmq-document-file-cleanup.queue.spec.ts`
- `src/modules/jobs/infrastructure/document-file-cleanup.consumer.ts`
- `src/modules/jobs/infrastructure/document-file-cleanup.consumer.spec.ts`
- `docs/core/CORE_09B_STORAGE_CLEANUP_AUDIT.md`
- `docs/core/CORE_09B_STORAGE_CLEANUP_API_REPORT.md`

Modifiés :

- `prisma/schema.prisma`
- `src/modules/courses/application/delete-course-document.use-case.ts`
- `src/modules/courses/application/delete-course-document.use-case.spec.ts`
- `src/modules/documents/application/delete-document.use-case.ts`
- `src/modules/documents/application/delete-document.use-case.spec.ts`
- `src/modules/documents/application/documents.repository.ts`
- `src/modules/documents/infrastructure/local-document-file-storage.ts`
- `src/modules/documents/infrastructure/local-document-file-storage.spec.ts`
- `src/modules/documents/infrastructure/prisma-documents.repository.ts`
- `src/modules/documents/infrastructure/prisma-documents.repository.spec.ts`
- `src/modules/jobs/jobs.module.ts`
- `src/modules/jobs/jobs.module.spec.ts`
- `docs/roadmap/v2/API_ROADMAP_V2.md`
- `docs/roadmap/v2/EXECUTION_LOT_TRACKER_V2.md`
- `docs/roadmap/v2/LOT_TRACKER_V2.md`

Supprimés : aucun.

## 21. Contenu complet des fichiers créés/modifiés/supprimés

Le contenu complet est disponible dans le diff Git local. Le rapport courant ne s'inclut pas lui-même pour éviter une récursion.

## 22. Auto-review

- CORE-09A reste intact.
- Archive ne crée aucun cleanup job.
- Delete safe crée un cleanup job transactionnel.
- Le filesystem n'est pas appelé dans les use cases delete.
- La suppression physique passe par `DocumentFileStorage.delete`.
- Chemins dangereux refusés.
- Fichier absent traité comme succès.
- Processor réellement exécutable via BullMQ et use case batch.
- Aucun cloud provider prématuré.
- Aucun changement Flutter runtime.
- Aucun commit effectué.

## 23. Critique du prompt

Le prompt demande à la fois une exécution réelle par worker et une garantie forte contre tout enqueue perdu après commit. Sans poller/reconciler périodique, BullMQ seul ne garantit pas qu'un job DB `PENDING` sera ré-enqueue si Redis est indisponible juste après commit. CORE-09B pose la source de vérité DB et un processor batch, mais une stratégie de reconciliation production reste à ajouter.

## 24. Confirmation Git

Aucun commit n'a été effectué.
