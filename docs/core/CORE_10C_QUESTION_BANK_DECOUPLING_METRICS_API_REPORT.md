# CORE-10C — Question bank decoupling & metrics API report

## Résumé

CORE-10C ferme le durcissement production de la question bank côté API.

Le lot découple `QuestionBankService` de Prisma, extrait la persistence/sélection/réservation vers un port applicatif, corrige la propagation `fallbackUsed`, rend la readiness target-aware pour les jobs per-KU et conserve la garantie CORE-10A/B : `POST /courses/:courseId/revision-sessions/quick` ne relance pas de génération IA longue quand la banque n'est pas prête.

## Diagnostic initial

L'audit a confirmé que `QuestionBankService` contenait encore trop d'infrastructure :

- injection directe de `PrismaService` ;
- types applicatifs basés sur `Prisma.QuestionBankItemGetPayload` ;
- queries de count, persistence, duplicate lookup et réservation dans le service ;
- transaction de réservation Prisma dans le service ;
- transformation Prisma JSON/visuals vers quiz dans le service.

Les réserves CORE-10B restantes étaient réelles :

- `fallbackUsed` était calculé par le générateur mais perdu dans les métadonnées normalisées ;
- la readiness considérait des jobs actifs trop larges pour une cible demandée ;
- les tests du service restaient dépendants d'un mock Prisma au lieu d'un port.

## Passes utilisées

- Audit Agent : cartographie du service, des générateurs, des use cases readiness/worker/quick et des repositories de préparation.
- Architecture Agent : extraction d'un port unique `QuestionBankRepository` pour éviter une fragmentation inutile.
- Implementation Agent : port applicatif, repository Prisma, refactor service, correction fallback/readiness.
- API Contract Agent : vérification de compatibilité des endpoints readiness/prepare/quick.
- App Guardrail Agent : correction bornée du cas `NO_KNOWLEDGE_UNITS` côté Flutter.
- QA Agent : tests unitaires, infra, e2e, full Jest et full Flutter.
- Runtime Agent : smoke Dokploy/Marionette disponible, sans modification de configuration.
- Reviewer Agent : revue scope/no-sync-AI/trackers.

## Architecture avant/après

Avant :

```text
QuestionBankService
-> PrismaService
-> QuestionBankItem / sources / visuals / transactions
```

Après :

```text
QuestionBankService
-> QuestionBankRepository port
-> PrismaQuestionBankRepository infrastructure
-> PrismaService
```

Le service garde l'orchestration métier :

- préparation par batch ;
- appel au `DiagnosticQuizGenerator` uniquement pendant la préparation ;
- agrégation des métriques ;
- création d'un quiz quick depuis des questions déjà réservées.

L'infrastructure Prisma prend en charge :

- counts course-level / KU-level ;
- persistence des questions générées ;
- lookup fingerprint ;
- filtrage structure PDF ;
- création des sources/visuals associées ;
- réservation transactionnelle équilibrée multi-KU ;
- conversion des payloads Prisma vers DTO applicatifs.

## Ports créés/modifiés

Créé :

```text
src/modules/activities/application/question-bank.repository.ts
```

Le port expose :

- `countActiveCourseQuickQuestions`;
- `persistGeneratedQuestions`;
- `reserveCourseQuickQuestions`.

Implémentation :

```text
src/modules/activities/infrastructure/prisma-question-bank.repository.ts
```

Injection :

```text
QUESTION_BANK_REPOSITORY -> PrismaQuestionBankRepository
```

## Extraction de `QuestionBankService`

Supprimé du service :

- import `PrismaService` ;
- import `Prisma` ;
- import enums Prisma ;
- queries directes ;
- transaction Prisma ;
- transformation JSON Prisma ;
- duplicate lookup ;
- persistence source/visuals.

Vérification statique :

```bash
rg -n "PrismaService|this\\.prisma|Prisma\\." src/modules/activities/application/question-bank.service.ts src/modules/activities/application/question-bank.repository.ts
```

Résultat : aucune occurrence.

## Règle target-aware des jobs pertinents

La readiness filtre désormais les jobs par cible pertinente.

Règle V0 conservée et documentée :

```text
expected per-KU target = max(5, ceil(targetQuestionCount / knowledgeUnitCount))
```

Un job per-KU est pertinent si :

```text
job.targetQuestionCount >= expected per-KU target
```

Exemples testés :

- cible 10, 3 KUs, jobs per-KU target 5, ready 9/10 -> `PREPARING` ;
- cible 30, 3 KUs, jobs per-KU target 5, ready 9/30 -> `NOT_PREPARED` ;
- target déjà atteint -> `READY` même si d'anciens jobs failed existent.

## Correction `fallbackUsed`

`normalizeGeneratedQuiz` propage maintenant :

```text
metadata.fallbackUsed = input.metadata.fallbackUsed === true
```

Cette métadonnée est conservée avec et sans chunks source. Le worker récupère la valeur via `QuestionBankService.aiGenerations[]`.

Test ajouté :

```text
MiMo échoue -> Mistral réussit -> GeneratedDiagnosticQuiz.metadata.fallbackUsed === true
```

Test worker renforcé :

```text
course_question_bank_worker_completed.aiGenerations[0].fallbackUsed === true
```

## Métriques disponibles

Le résultat interne de préparation conserve :

- `activeBefore`;
- `activeAfter`;
- `generatedCount`;
- `persistedCount`;
- `duplicateSkippedCount`;
- `structureSkippedCount`;
- `aiGenerations[]`.

Chaque entrée `aiGenerations[]` contient :

- `provider`;
- `model`;
- `fallbackUsed`;
- `generatedCount`;
- `persistedCount`.

Les logs existants `course_question_bank_prepare_batch`, `course_question_bank_prepare_service_done` et `course_question_bank_worker_completed` restent exploitables sans logguer prompts, chunks complets, réponses IA complètes, tokens ou données sensibles.

## Preuve no-sync-AI quick

`StartCourseQuickRevisionSessionUseCase` conserve le comportement CORE-10A/B :

- si readiness insuffisante : préparation async + erreur contrôlée ;
- si readiness prête : `QuestionBankService.createCourseQuickDiagnosticQuiz`;
- cette méthode réserve des questions existantes via `QuestionBankRepository.reserveCourseQuickQuestions`;
- elle n'appelle pas `diagnosticQuizGenerator.generate`.

Tests couvrants :

- banque prête -> session créée sans `diagnosticQuizGenerator.generate`;
- banque insuffisante -> préparation async / 409 ;
- service question bank testé avec repository mocké.

## Tests exécutés

```bash
npx prisma validate
```

Résultat : PASS, schéma valide.

```bash
npx prisma generate
```

Résultat : PASS, Prisma Client généré.

```bash
npm run build
```

Résultat : PASS.

```bash
npm run lint:check
```

Résultat : PASS.

```bash
npm test -- question-bank --runInBand
```

Résultat : PASS, 7 suites, 38 tests.

```bash
npm test -- course-question-bank-readiness --runInBand
```

Résultat : PASS, 1 suite, 12 tests.

```bash
npm test -- process-course-question-bank-preparation-job --runInBand
```

Résultat : PASS, 1 suite, 6 tests.

```bash
npm test -- prisma-course-question-bank-preparation --runInBand
```

Résultat : PASS, 1 suite, 4 tests.

```bash
npm test -- jobs --runInBand
```

Résultat : PASS, 7 suites, 20 tests.

```bash
npm test -- activities --runInBand
```

Résultat : PASS, 21 suites passées, 1 suite skipped, 365 tests passés, 1 test skipped.

```bash
npm test -- courses --runInBand
```

Résultat : PASS, 14 suites, 119 tests.

```bash
npm test -- revision-sessions --runInBand
```

Résultat : PASS, 9 suites, 70 tests.

```bash
npm run test:e2e -- --runInBand
```

Résultat : PASS, 2 suites, 34 tests.

```bash
npm test -- --runInBand
```

Résultat : PASS, 99 suites passées, 1 suite skipped, 841 tests passés, 1 test skipped.

```bash
git diff --check
```

Résultat : PASS.

## Vérification Dokploy

Dokploy MCP était disponible.

Vérifié :

- service backend identifié : `backEnd`;
- application Dokploy : `revision-app-backend-xlsv4d`;
- repository : `revision_project_api`;
- branche : `main`;
- statut application : `done`;
- logs filtrés : événements `course_question_bank_worker_started` et `course_question_bank_worker_runtime_configuration` présents.

Aucune configuration Dokploy n'a été modifiée.

Limite : CORE-10C n'a pas été commit/push/déployé, donc Dokploy prouve la vivacité worker de l'environnement courant, pas l'exécution déployée du nouveau code CORE-10C.

## Vérification Marionette

Marionette macOS était disponible.

Réalisé :

- lancement local de l'app macOS via `flutter run -d macos -t dev/marionette_main.dart`;
- connexion Marionette réussie au VM service local ;
- arrêt propre de l'instance lancée par Codex.

Limite : aucun scénario utilisateur complet `prepare -> polling -> session` n'a été rejoué avec un cours contrôlé après le refactor CORE-10C. La preuve principale du lot reste locale automatisée : full Jest + full Flutter + tests ciblés du contrat quick/readiness.

## Fichiers créés/modifiés/supprimés

Créés :

- `src/modules/activities/application/question-bank.repository.ts`
- `src/modules/activities/infrastructure/prisma-question-bank.repository.ts`
- `src/modules/activities/infrastructure/prisma-question-bank.repository.spec.ts`
- `docs/core/CORE_10C_QUESTION_BANK_DECOUPLING_METRICS_API_REPORT.md`

Modifiés :

- `src/modules/activities/activities.module.ts`
- `src/modules/activities/application/question-bank.service.ts`
- `src/modules/activities/application/question-bank.service.spec.ts`
- `src/modules/activities/infrastructure/genkit-diagnostic-quiz.generator.ts`
- `src/modules/activities/infrastructure/genkit-diagnostic-quiz.generator.spec.ts`
- `src/modules/courses/application/course-question-bank-readiness.use-case.ts`
- `src/modules/courses/application/course-question-bank-readiness.use-case.spec.ts`
- `src/modules/courses/application/process-course-question-bank-preparation-job.use-case.spec.ts`
- `docs/roadmap/v2/EXECUTION_LOT_TRACKER_V2.md`
- `docs/roadmap/v2/LOT_TRACKER_V2.md`

Supprimés : aucun.

## Risques restants

- Le découplage reste volontairement minimal : un seul port question bank au lieu d'un découpage plus fin persistence/selection/metrics.
- Les métriques sont internes/loggées ; aucun pipeline d'observabilité ou endpoint public n'est ajouté.
- La règle target-aware dépend encore de la distribution V0 per-KU.
- La preuve runtime post-CORE-10C nécessitera un déploiement après commit/push.

## Dette restante

- CORE-11A : draft/resume de session.
- ADAPT-01 : Today adaptatif basé sur question bank et progression.
- Observabilité future : agrégation durable des métriques provider/model/fallback/qualité si nécessaire.

## Auto-review

- `QuestionBankService` ne dépend plus directement de Prisma.
- Les tests du service mockent le port `QuestionBankRepository`.
- L'infrastructure Prisma est testée séparément.
- `fallbackUsed` est propagé jusqu'aux métriques worker.
- Les jobs actifs sont filtrés par cible pertinente.
- Quick start ne relance pas de génération IA synchrone.
- Full Jest et e2e passent.
- Aucune modification GenKit provider/prompt volontaire.
- Aucun secret Dokploy recopié.
- Aucun commit effectué.

## Critique du prompt

Le prompt demande une vérification Dokploy/Marionette runtime. C'est pertinent pour CORE-10B-fix, mais pour CORE-10C il y a une limite structurelle : sans commit/push/deploy, Dokploy ne peut pas prouver le nouveau code. La bonne preuve locale est donc le full Jest/full Flutter, plus une vérification runtime post-déploiement après intervention Git humaine.

## Confirmation Git

Aucun commit, amend, merge, rebase, tag ou push n'a été effectué.
