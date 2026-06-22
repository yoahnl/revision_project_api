# CORE-10B — Multi-KU selection & concurrency audit

Date: 2026-06-22

## Résumé

Avant CORE-10B, CORE-10A avait sorti la génération IA longue de la requête utilisateur, mais le quick course-level restait encore centré sur une seule notion exploitable.

Le démarrage quick utilisait encore le chemin suivant :

```text
READY course PDF
-> première KnowledgeUnit exploitable
-> count de questions sur cette seule KU
-> snapshot du quiz depuis cette seule KU
```

## État actuel de la sélection quick

- `StartCourseQuickRevisionSessionUseCase` vérifiait une source READY, puis appelait `findFirstQuickRevisionKnowledgeUnitForCourseDocument`.
- `GetCourseQuestionBankReadinessUseCase` comptait les questions via une seule `knowledgeUnitId`.
- `QuestionBankService.createCourseQuickDiagnosticQuiz` acceptait une seule paire `documentId` / `knowledgeUnitId`.
- `QuestionBankService.reserveQuestions` sélectionnait les questions avec `take: questionCount` sur une seule KU.

## Point single-KU identifié

Les points single-KU étaient :

- `CoursesRepository.findFirstQuickRevisionKnowledgeUnitForCourseDocument`;
- `PrismaCoursesRepository.findFirstQuickRevisionKnowledgeUnitForCourseDocument`;
- `QuestionBankService.countActiveCourseQuickQuestions`;
- `QuestionBankService.createCourseQuickDiagnosticQuiz`;
- `StartCourseQuickRevisionSessionUseCase`;
- `GetCourseQuestionBankReadinessUseCase`;
- `PrepareCourseQuestionBankUseCase`.

## Comptage des questions

Avant le lot, le comptage était strictement filtré par `knowledgeUnitId`.

CORE-10B doit compter le pool exploitable course-level :

```text
studentId + subjectId + courseId + knowledgeUnitIds[]
```

## Réservation / marquage utilisé

Avant CORE-10B :

- la sélection était faite par `findMany`;
- puis les questions étaient marquées par un `updateMany` de groupe ;
- deux sessions concurrentes pouvaient sélectionner le même ensemble si elles lisaient avant l'update.

## Risques de doublons

Les risques principaux étaient :

- session trop étroite si la première KU était pauvre en questions ;
- doublons évidents entre sessions concurrentes ;
- readiness `READY` faussement négative si les questions étaient réparties sur plusieurs KUs ;
- progression pédagogique attribuée à la KU primaire au lieu des KUs réellement questionnées.

## Capacité actuelle de la question bank

Le modèle existant `QuestionBankItem` contient déjà :

- `courseId`;
- `documentId`;
- `knowledgeUnitId`;
- `status`;
- `askedCount`;
- `lastAskedAt`;
- `bankQuestionId` côté `Question`.

Il permet donc une sélection multi-KU sans créer de nouveau modèle de réservation pour ce lot.

## Décision V1

CORE-10B retient une V1 simple :

- charger toutes les KUs issues de PDFs course-level READY actifs ;
- compter les questions actives sur toutes ces KUs ;
- préparer async par KU si le pool global est insuffisant ;
- sélectionner en round-robin depuis les KUs disponibles ;
- réserver par update optimiste question par question ;
- retry court si une autre session a réservé une question entre la lecture et l'update ;
- conserver un contexte primaire de session pour compatibilité legacy.

## Hors scope CORE-10C

Restent explicitement hors scope :

- découplage complet de `QuestionBankService`;
- métriques qualité/coût ;
- stratégie adaptative basée sur maîtrise ;
- scoring fin des KUs à sélectionner ;
- modèle durable de réservation historisée ;
- refonte des prompts ou providers IA.
