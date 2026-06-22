# CORE-09C Subject & Course Lifecycle Audit

## 1. État actuel des endpoints matière/cours

Avant CORE-09C, les matières exposaient surtout `GET /subjects`, `GET /subjects/:id`, `POST /subjects` et `DELETE /subjects/:id`. Les cours exposaient les listes, la création, le détail, la suppression et les routes de sources/fiches/sessions.

Il manquait des contrats publics pour :

- connaître la décision lifecycle d'une matière ou d'un cours ;
- renommer ou modifier les champs simples ;
- archiver un élément utilisé ;
- distinguer suppression safe et archive logique.

## 2. État actuel des suppressions

Les suppressions sujet/cours étaient trop directes par rapport à l'historique pédagogique. Une suppression pouvait dépendre des contraintes Prisma plutôt que d'une décision métier explicite. CORE-09A et CORE-09B avaient déjà sécurisé les sources, mais pas encore les conteneurs `Subject` et `Course`.

## 3. Relations Prisma dangereuses

Relations observées :

- `Subject` possède des `Course`, `Document`, `KnowledgeUnit`, états de maîtrise, sessions, artefacts IA et questions.
- `Course` possède des `Document`, `RevisionSession`, `QuestionBankItem`, résumés/fiches via les documents et l'historique des activités.
- Certaines relations utilisent des suppressions en cascade ou des dépendances implicites côté Prisma.

Ces relations rendent une suppression brutale dangereuse dès qu'un élément a porté des sources, sessions, questions ou artefacts.

## 4. Ce qui peut être supprimé

Une matière active peut être supprimée uniquement si elle ne contient aucune dépendance pédagogique observable :

- aucun cours ;
- aucun document ;
- aucune notion ;
- aucune session ;
- aucune progression ;
- aucun artefact IA ;
- aucune question banque.

Un cours actif peut être supprimé uniquement s'il est vide :

- aucun document actif ou archivé ;
- aucune session ;
- aucun item de banque de questions ;
- aucun historique pédagogique observé.

## 5. Ce qui doit être archivé

Une matière ou un cours utilisé doit être archivé dès qu'il possède un historique pédagogique ou une dépendance ambiguë. L'archive conserve les données et retire l'élément des listes actives.

Cas typiques :

- cours avec source ;
- cours déjà révisé ;
- cours avec question bank item ;
- matière avec cours ;
- matière avec sources, notions, sessions, maîtrise ou artefact IA.

## 6. Ce qui doit être bloqué

CORE-09C bloque :

- les éléments déjà archivés ;
- les éléments avec documents en cours de traitement ;
- les décisions concurrentes ou ambiguës où la suppression/archivage ne peut pas être prise proprement.

Un blocage retourne un code machine côté API, mais l'app doit afficher un message utilisateur lisible.

## 7. Surfaces UI concernées

Surfaces consommant le nouveau contrat :

- détail cours : gestion, renommer, archiver, supprimer selon lifecycle ;
- gestion/liste des matières : gestion lifecycle ;
- détail matière : gestion lifecycle ;
- providers Flutter : invalidation des listes, détails, progrès et matière active.

## 8. Dette laissée volontairement hors scope

Hors CORE-09C :

- historique utilisateur des archives ;
- restauration d'un cours ou d'une matière archivée ;
- page admin ;
- suppression compte/export RGPD ;
- refonte de navigation ;
- storage cloud ;
- CORE-10 question bank async ;
- CORE-11 session resume/history.

## 9. Recherches statiques d'audit

Recherches exécutées :

```bash
rg -n "deleteSubject|deleteCourse|archiveSubject|archiveCourse|renameSubject|renameCourse|updateSubject|updateCourse|deleteIfEmpty|CourseContainsDocuments|subject\\.delete|course\\.delete|onDelete|Cascade|NoAction|Restrict" src prisma test --glob '!src/generated/prisma/**'
rg -n "Subject|Course|Document|KnowledgeUnit|RevisionSession|RevisionSessionAction|ActivitySession|QuestionBankItem|Summary|RevisionSheet|MasteryState" src/modules prisma/schema.prisma --glob '!src/generated/prisma/**'
```

Les résultats ont confirmé que la logique devait vivre dans les repositories Prisma et use cases dédiés, pas dans les contrôleurs.
