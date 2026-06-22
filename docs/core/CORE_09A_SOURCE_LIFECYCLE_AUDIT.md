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
