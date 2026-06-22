# CORE-09B Storage Cleanup Audit

## 1. État actuel du storage

Avant CORE-09B, le backend stockait les PDF de cours via `LocalDocumentFileStorage`. Les fichiers étaient écrits sous une racine configurable par `DOCUMENT_STORAGE_ROOT`, avec un défaut local `storage/revision-documents`.

CORE-09A avait sécurisé le lifecycle logique des sources : une source utilisée est archivée, une source supprimable est supprimée côté DB, une source dangereuse est bloquée. CORE-09A ne supprimait aucun blob physique.

## 2. Port storage existant

Le port `DocumentFileStorage` existait déjà côté application avec :

- `saveCoursePdf(...)`;
- `delete({ storagePath })`.

Le port est conservé. CORE-09B s'appuie sur lui pour éviter toute dépendance des use cases à `fs`.

## 3. Implémentation locale existante

`LocalDocumentFileStorage` :

- écrit les PDF sous `students/{firebaseUid}/subjects/{subjectId}/{timestamp}-{fileName}`;
- résout les chemins sous `DOCUMENT_STORAGE_ROOT`;
- refuse les chemins absolus, les backslashes, les segments `..`, les chemins vides et les chemins qui sortent de la racine ;
- lit les fichiers par `read({ storagePath })`.

CORE-09B durcit les tests de `delete({ storagePath })` :

- suppression d'un fichier existant ;
- succès idempotent si fichier déjà absent ;
- refus des chemins dangereux ;
- refus de suppression de répertoire.

## 4. Où les fichiers sont créés

Les fichiers physiques sont créés par :

- `UploadCoursePdfUseCase` via `DocumentFileStorage.saveCoursePdf`;
- `UploadCoursePdfForCourseUseCase` via `DocumentFileStorage.saveCoursePdf`.

Les chemins relatifs sont persistés dans `Document.storagePath`.

## 5. Où les fichiers sont supprimés ou non supprimés

Avant CORE-09B, les suppressions physiques existaient uniquement comme cleanup best-effort après échec d'enregistrement upload :

- `UploadCoursePdfUseCase`;
- `UploadCoursePdfForCourseUseCase`.

Les suppressions utilisateur (`DELETE /documents/:documentId`, `DELETE /courses/:courseId/sources/:documentId`) supprimaient la ligne DB si CORE-09A l'autorisait, mais ne nettoyaient pas le fichier physique.

## 6. Chemins de suppression DB

Les chemins de suppression DB audités :

- `DeleteDocumentUseCase` -> `DocumentsRepository.deleteForStudent`;
- `DeleteCourseDocumentUseCase` -> `DocumentsRepository.deleteCourseDocumentForStudent`;
- `PrismaDocumentsRepository.deleteForStudent`;
- `PrismaDocumentsRepository.deleteCourseDocumentForStudent`;
- suppressions cascade de matière/cours hors périmètre CORE-09B.

CORE-09B ne change pas la décision `DELETE / ARCHIVE / BLOCK`; il ajoute l'intention de cleanup uniquement dans les branches de suppression safe.

## 7. Risques actuels d'orphelins

Risque corrigé par CORE-09B :

- suppression DB safe sans suppression physique -> fichier orphelin.

Risques restants :

- suppressions cascade hors documents, notamment lifecycle matière/cours, restent à traiter en CORE-09C ;
- jobs `RUNNING` abandonnés par crash worker ne sont pas encore automatiquement réclamés ;
- anciens blobs orphelins créés avant CORE-09B ne sont pas backfillés.

## 8. Risques de suppression trop tôt

Risque évité :

- suppression physique avant commit DB.

CORE-09B écrit un `DocumentFileCleanupJob` dans la même transaction que la suppression DB safe. Le filesystem est appelé ensuite par un processor interne. Si la transaction DB échoue, aucun job de cleanup n'est créé.

## 9. Choix d'architecture retenu

Architecture retenue :

- table outbox `DocumentFileCleanupJob` sans FK vers `Document`;
- création du cleanup job transactionnelle dans `PrismaDocumentsRepository`;
- use cases delete dépendants d'un port `DocumentFileCleanupQueue`;
- queue BullMQ `document-file-cleanup`;
- processor `DocumentFileCleanupConsumer`;
- use case `ProcessDocumentFileCleanupJobUseCase`;
- repository `PrismaDocumentFileCleanupRepository`;
- suppression physique uniquement via `DocumentFileStorage.delete`.

Pourquoi pas de FK vers `Document` :

- la ligne `Document` est supprimée dans la même transaction ;
- une relation forte bloquerait la suppression ou ferait disparaître l'intention ;
- `documentId` reste stocké comme trace d'audit.

## 10. Points explicitement reportés à plus tard

- Storage cloud S3/GCS.
- URLs signées.
- quotas storage.
- console admin de retry/purge.
- requeue automatique des jobs `PENDING` si BullMQ a été indisponible après commit.
- récupération de jobs `RUNNING` trop anciens.
- cleanup des suppressions cascade matière/cours.
- backfill des fichiers orphelins historiques.
