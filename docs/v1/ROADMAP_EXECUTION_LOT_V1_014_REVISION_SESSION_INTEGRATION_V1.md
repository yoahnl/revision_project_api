# LOT V1-014 — Revision session integration V1

## Statut

Réalisé côté API. Les sessions de révision peuvent maintenant proposer une action bornée `RICH_CLOSED_EXERCISE` / `rich_closed_exercise` qui sert uniquement de lanceur vers le flow rich closed existant.

La session ne génère pas de questions rich closed, ne rend pas de widget arbitraire, ne renvoie pas de correction pré-submit et les tests Genkit restent mockés.

## Décision Prisma

Une migration additive a été créée parce que `RevisionSessionAction.kind` est typé par l’enum PostgreSQL `RevisionSessionActionKind`. Sans la valeur `RICH_CLOSED_EXERCISE`, l’action ne peut pas être persistée. La migration se limite à `ALTER TYPE ... ADD VALUE`.

Le client Prisma ignoré par Git (`src/generated/prisma`) a été régénéré localement via `npm run prisma:generate` pour permettre au build TypeScript d’utiliser le nouvel enum.

## Comportement livré

- `preferredAction: rich_closed_exercise` est accepté par `POST /revision-sessions` avec `knowledgeUnitId` obligatoire.
- `next-action` peut choisir `RICH_CLOSED_EXERCISE` via le coach ou le fallback déterministe.
- Le payload courant contient uniquement `subjectId`, `documentId`, `knowledgeUnitId`, `knowledgeUnitTitle` si disponible, `reason`, `estimatedMinutes` et `preferredAction`.
- Les branches rich closed n’appellent ni `StartNextActivityUseCase`, ni `StartOpenQuestionActivityUseCase`, ni le générateur rich closed.
- Le schéma Genkit coach reste strict : uniquement `actionKind`, `knowledgeUnitId`, `reasonCode`; les champs libres de type questions/correction/widget sont rejetés.

## Validations

- `npm run prisma:generate` : réussi.
- `npm test -- revision-session --runInBand` : réussi, 6 suites / 41 tests.
- `npm test -- revision-sessions --runInBand` : réussi, 6 suites / 41 tests.
- `npm test -- activities --runInBand` : réussi, 17 suites passées / 1 skipped, 190 tests passés / 1 skipped.
- `npm test -- revision --runInBand` : réussi, 15 suites / 87 tests.
- `npm run lint:check` : réussi après formatage ciblé Prettier des fichiers touchés.
- `npm run build` : réussi.
- `git diff --check` : réussi.

## Fichiers touchés

- `docs/v1/ROADMAP_EXECUTION_PLAN_V1.md`
- `prisma/schema.prisma`
- `prisma/migrations/20260617120000_revision_session_rich_closed_action/migration.sql`
- `src/modules/revision-sessions/domain/revision-session.entity.ts`
- `src/modules/revision-sessions/domain/revision-coach-next-action.entity.ts`
- `src/modules/revision-sessions/domain/deterministic-revision-session-action-selector.ts`
- `src/modules/revision-sessions/domain/deterministic-revision-session-action-selector.spec.ts`
- `src/modules/revision-sessions/application/revision-sessions.repository.ts`
- `src/modules/revision-sessions/application/start-revision-session.use-case.ts`
- `src/modules/revision-sessions/application/start-revision-session.use-case.spec.ts`
- `src/modules/revision-sessions/application/request-next-revision-session-action.use-case.ts`
- `src/modules/revision-sessions/application/request-next-revision-session-action.use-case.spec.ts`
- `src/modules/revision-sessions/infrastructure/genkit-revision-coach-next-action.generator.ts`
- `src/modules/revision-sessions/infrastructure/genkit-revision-coach-next-action.generator.spec.ts`
- `src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.ts`
- `src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.spec.ts`
- `src/modules/revision-sessions/interfaces/revision-sessions.controller.ts`
- `src/modules/revision-sessions/interfaces/revision-sessions.controller.spec.ts`

Le présent rapport est créé dans `docs/v1/ROADMAP_EXECUTION_LOT_V1_014_REVISION_SESSION_INTEGRATION_V1.md`. Son contenu n’est pas recopié récursivement dans lui-même afin d’éviter une expansion infinie.

## Contenu complet des fichiers touchés

### docs/v1/ROADMAP_EXECUTION_PLAN_V1.md

```md
# Roadmap execution plan V1 — API

Ce fichier existe côté API pour les lots backend V1 dont le prompt interdit toute modification de `revision_app/`.

| Lot | Intitulé | Statut | Rapport |
| --- | --- | --- | --- |
| V1-012C | Backend diagnostics génération rich closed | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_012C_BACKEND_RICH_CLOSED_GENERATION_DIAGNOSTICS.md |
| V1-012D | Dokploy runtime fix génération rich closed | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_012D_DOKPLOY_RICH_CLOSED_RUNTIME_FIX.md |
| V1-013 | Today integration V1 | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_013_TODAY_INTEGRATION_V1.md |
| V1-014 | Revision session integration V1 | Réalisé | docs/v1/ROADMAP_EXECUTION_LOT_V1_014_REVISION_SESSION_INTEGRATION_V1.md |

## Lots détaillés

### V1-012C — Backend diagnostics génération rich closed

- Objectif : diagnostiquer et fiabiliser les échecs Genkit rich closed.
- Pourquoi maintenant : la page front existe mais la génération backend échoue en runtime avec `RICH_CLOSED_GENERATION_CONTRACT_INVALID`.
- Périmètre inclus : diagnostics metadata-only, catégorisation des rejets, prompt de réparation sur modèle fallback configuré, tests mockés.
- Non-objectifs : frontend, Today, revision sessions, Prisma, endpoints publics.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_012C_BACKEND_RICH_CLOSED_GENERATION_DIAGNOSTICS.md`.

### V1-012D — Dokploy runtime fix génération rich closed

- Objectif : vérifier le runtime Dokploy réel et rendre `RICH_CLOSED_GENERATION_SCHEMA_INVALID` exploitable.
- Pourquoi maintenant : V1-012C est déployé, mais le fallback Mistral échoue encore avec un diagnostic schema trop pauvre.
- Périmètre inclus : inspection Dokploy, prompt strict, diagnostics schema imbriqués, tests mockés.
- Non-objectifs : frontend, Today, revision sessions, Prisma, endpoints publics, redeploy sans commit déployable.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_012D_DOKPLOY_RICH_CLOSED_RUNTIME_FIX.md`.

### V1-013 — Today integration V1

- Objectif : permettre à Today de recommander une action déterministe `rich_closed_exercise`.
- Pourquoi maintenant : la page rich closed complète existe et peut prendre le relais au clic utilisateur.
- Périmètre inclus : contrat Today, sélection déterministe, propagation optionnelle de `documentId`, tests Today/revision/activities.
- Non-objectifs : Genkit depuis Today, revision sessions, endpoints rich closed, Prisma schema ou migration.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_013_TODAY_INTEGRATION_V1.md`.

### V1-014 — Revision session integration V1

- Objectif : permettre aux sessions de révision de proposer l'action bornée `RICH_CLOSED_EXERCISE`.
- Pourquoi maintenant : le flow rich closed V1-A existe et Today sait déjà le recommander.
- Périmètre inclus : contrat session, coach next-action, persistance enum, contrôleur, tests anti-fuite.
- Non-objectifs : génération de questions rich closed depuis la session, rendu de widget arbitraire, correction pré-submit, provider IA réel dans les tests.
- Rapport attendu : `docs/v1/ROADMAP_EXECUTION_LOT_V1_014_REVISION_SESSION_INTEGRATION_V1.md`.
```

### prisma/schema.prisma

```prisma
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

  goals    RevisionGoal[]
  subjects Subject[]
  mastery  MasteryState[]
  sessions ActivitySession[]
  revisionSessions RevisionSession[]
  revisionSessionActions RevisionSessionAction[]
  summaries Summary[]
  revisionSheets RevisionSheet[]
  openQuestions OpenQuestion[]
  openAnswerEvaluations OpenAnswerEvaluation[]
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

  student        StudentProfile  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  documents      Document[]
  knowledgeUnits KnowledgeUnit[]
  mastery        MasteryState[]
  sessions       ActivitySession[]
  revisionSessions RevisionSession[]
  revisionSessionActions RevisionSessionAction[]
  summaries      Summary[]
  revisionSheets RevisionSheet[]
  openQuestions  OpenQuestion[]
  openAnswerEvaluations OpenAnswerEvaluation[]

  @@index([studentId])
  @@unique([id, studentId])
}

model Document {
  id          String         @id @default(cuid())
  studentId   String
  subjectId   String
  kind        DocumentKind
  fileName    String
  storagePath String
  mimeType    String
  status      DocumentStatus @default(UPLOADED)
  errorCode   String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  subject        Subject                 @relation(fields: [subjectId, studentId], references: [id, studentId], onDelete: Cascade)
  chunks         DocumentChunk[]
  knowledgeUnits KnowledgeUnit[]
  jobs           DocumentProcessingJob[]
  summaries      Summary[]
  revisionSheets RevisionSheet[]
  openQuestions  OpenQuestion[]
  revisionSessions RevisionSession[]
  revisionSessionActions RevisionSessionAction[]

  @@index([studentId])
  @@index([subjectId])
  @@unique([id, subjectId])
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
  id                       String                   @id @default(cuid())
  subjectId                String
  documentId               String?
  title                    String
  summary                  String
  difficulty               KnowledgeUnitDifficulty?
  displayOrder             Int?
  confidence               Float?
  extractionPromptVersion  String?
  extractionSchemaVersion  String?
  createdAt                DateTime                 @default(now())
  updatedAt                DateTime                 @updatedAt

  subject  Subject        @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  document Document?      @relation(fields: [documentId, subjectId], references: [id, subjectId], onDelete: NoAction)
  mastery  MasteryState[]
  questions Question[]
  sessions ActivitySession[]
  revisionSessions RevisionSession[]
  revisionSessionActions RevisionSessionAction[]
  sources  KnowledgeUnitSource[]
  openQuestions OpenQuestion[]

  @@index([subjectId])
  @@index([documentId])
  @@unique([id, subjectId])
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

  document Document              @relation(fields: [documentId, subjectId], references: [id, subjectId], onDelete: Cascade)
  sources  KnowledgeUnitSource[]
  summarySources SummarySource[]
  revisionSheetSectionSources RevisionSheetSectionSource[]
  questionSources QuestionSource[]
  questionVisualSources QuestionVisualSource[]
  openQuestionSources OpenQuestionSource[]

  @@index([documentId])
  @@index([subjectId])
  @@unique([documentId, index])
  @@unique([id, subjectId])
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
  id              String                      @id @default(cuid())
  documentId      String
  subjectId       String
  studentId       String
  status          StudyArtifactStatus
  title           String?
  content         String?
  keyPoints       Json?
  limits          String?
  createdAt       DateTime                    @default(now())
  updatedAt       DateTime                    @updatedAt
  generatedAt     DateTime
  flowName        String
  provider        String
  model           String
  promptVersion   String
  schemaVersion   String
  inputSize       Int?
  sourceStrategy  StudyArtifactSourceStrategy
  errorCode       String?

  student StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject Subject        @relation(fields: [subjectId, studentId], references: [id, studentId], onDelete: Cascade)
  document Document      @relation(fields: [documentId, subjectId], references: [id, subjectId], onDelete: Cascade)
  sources SummarySource[]

  @@index([studentId])
  @@index([subjectId])
  @@unique([documentId])
  @@unique([id, subjectId])
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

  student StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject Subject        @relation(fields: [subjectId, studentId], references: [id, studentId], onDelete: Cascade)
  document Document      @relation(fields: [documentId, subjectId], references: [id, subjectId], onDelete: Cascade)
  sections RevisionSheetSection[]

  @@index([studentId])
  @@index([subjectId])
  @@unique([documentId])
  @@unique([id, subjectId])
}

model RevisionSheetSection {
  id              String   @id @default(cuid())
  revisionSheetId String
  subjectId       String
  displayOrder    Int
  title           String
  content         String
  createdAt       DateTime @default(now())

  revisionSheet RevisionSheet @relation(fields: [revisionSheetId, subjectId], references: [id, subjectId], onDelete: Cascade)
  sources RevisionSheetSectionSource[]

  @@index([subjectId])
  @@unique([revisionSheetId, displayOrder])
  @@unique([id, subjectId])
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
  knowledgeUnit KnowledgeUnit   @relation(fields: [knowledgeUnitId, subjectId], references: [id, subjectId], onDelete: Cascade)

  @@id([studentId, knowledgeUnitId])
  @@index([subjectId, studentId])
  @@index([knowledgeUnitId, subjectId])
}

model ActivitySession {
  id              String         @id @default(cuid())
  studentId       String
  subjectId       String
  knowledgeUnitId String
  version         Int            @default(1)
  documentId      String?
  generationFlowName      String?
  generationProvider      String?
  generationModel         String?
  generationPromptVersion String?
  generationSchemaVersion String?
  generationInputSize     Int?
  type            ActivityType
  status          ActivityStatus @default(STARTED)
  createdAt       DateTime       @default(now())
  completedAt     DateTime?

  student       StudentProfile @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject       Subject        @relation(fields: [subjectId, studentId], references: [id, studentId], onDelete: Cascade)
  knowledgeUnit KnowledgeUnit  @relation(fields: [knowledgeUnitId, subjectId], references: [id, subjectId], onDelete: Cascade)
  questions     Question[]
  result        ActivityResult?
  answers       QuestionAnswer[]
  openQuestion  OpenQuestion?
  openAnswerEvaluation OpenAnswerEvaluation?
  richClosedExercisePayload RichClosedExercisePayload?
  richClosedExerciseResult RichClosedExerciseResult?
  revisionSessionActions RevisionSessionAction[]

  @@index([studentId])
  @@index([subjectId])
  @@index([documentId])
  @@index([knowledgeUnitId])
  @@unique([id, knowledgeUnitId])
}

model Question {
  id              String @id @default(cuid())
  sessionId       String
  subjectId       String?
  documentId      String?
  knowledgeUnitId String
  prompt          String
  difficulty      KnowledgeUnitDifficulty?
  displayOrder    Int    @default(0)
  choices         Json
  selectionMode   QuestionSelectionMode @default(SINGLE)
  minSelections   Int?
  maxSelections   Int?
  correctChoiceId String?
  correctChoiceIds Json?
  explanation     String

  session       ActivitySession @relation(fields: [sessionId, knowledgeUnitId], references: [id, knowledgeUnitId], onDelete: Cascade)
  knowledgeUnit KnowledgeUnit   @relation(fields: [knowledgeUnitId], references: [id], onDelete: Cascade)
  sources       QuestionSource[]
  answers       QuestionAnswer[]
  visuals       QuestionVisual[]

  @@index([sessionId])
  @@index([subjectId])
  @@index([documentId])
  @@unique([id, subjectId])
}

model QuestionSource {
  questionId     String
  subjectId      String
  chunkId        String
  relevanceScore Float?
  createdAt      DateTime @default(now())

  question Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
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

  question Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  sources  QuestionVisualSource[]

  @@index([questionId])
  @@unique([questionId, displayOrder])
}

model QuestionVisualSource {
  visualId       String
  subjectId      String
  chunkId        String
  relevanceScore Float?
  createdAt      DateTime @default(now())

  visual QuestionVisual @relation(fields: [visualId], references: [id], onDelete: Cascade)
  chunk  DocumentChunk   @relation(fields: [chunkId, subjectId], references: [id, subjectId], onDelete: Cascade)

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

  session  ActivitySession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  question Question        @relation(fields: [questionId], references: [id], onDelete: Cascade)
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

  session       ActivitySession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  student       StudentProfile  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject       Subject         @relation(fields: [subjectId, studentId], references: [id, studentId], onDelete: Cascade)
  document      Document?       @relation(fields: [documentId, subjectId], references: [id, subjectId], onDelete: NoAction)
  knowledgeUnit KnowledgeUnit   @relation(fields: [knowledgeUnitId, subjectId], references: [id, subjectId], onDelete: Cascade)
  sources       OpenQuestionSource[]
  evaluations   OpenAnswerEvaluation[]

  @@index([studentId])
  @@index([subjectId])
  @@index([documentId])
  @@index([knowledgeUnitId])
  @@unique([id, subjectId])
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
  documentId      String?
  knowledgeUnitId String?
  status          RevisionSessionStatus @default(STARTED)
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt
  completedAt     DateTime?

  student       StudentProfile          @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject       Subject                 @relation(fields: [subjectId, studentId], references: [id, studentId], onDelete: Cascade)
  document      Document?               @relation(fields: [documentId, subjectId], references: [id, subjectId], onDelete: NoAction)
  knowledgeUnit KnowledgeUnit?          @relation(fields: [knowledgeUnitId, subjectId], references: [id, subjectId], onDelete: NoAction)
  actions       RevisionSessionAction[]

  @@index([studentId])
  @@index([subjectId])
  @@index([documentId])
  @@index([knowledgeUnitId])
  @@unique([id, studentId])
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
```

### prisma/migrations/20260617120000_revision_session_rich_closed_action/migration.sql

```sql
-- AlterEnum
ALTER TYPE "RevisionSessionActionKind" ADD VALUE 'RICH_CLOSED_EXERCISE';
```

### src/modules/revision-sessions/domain/revision-session.entity.ts

```ts
import type {
  DiagnosticQuizActivity,
  OpenQuestionActivity,
} from '../../activities/application/activities.repository';

export type RevisionSessionStatusValue = 'STARTED' | 'COMPLETED' | 'ABANDONED';

export type RevisionSessionActionKindValue =
  | 'DIAGNOSTIC_QUIZ'
  | 'OPEN_QUESTION'
  | 'RICH_CLOSED_EXERCISE';

export type RevisionSessionActionStatusValue = 'READY' | 'COMPLETED' | 'FAILED';

export type RevisionSessionPreferredAction =
  | 'diagnostic_quiz'
  | 'open_question'
  | 'rich_closed_exercise';

export interface RevisionSessionRichClosedExercisePayload {
  type: 'rich_closed_exercise';
  subjectId: string;
  documentId: string | null;
  knowledgeUnitId: string;
  knowledgeUnitTitle?: string | null;
  reason: string;
  estimatedMinutes: number;
  preferredAction: 'rich_closed_exercise';
}

export type RevisionSessionActionPayload =
  | DiagnosticQuizActivity
  | OpenQuestionActivity
  | RevisionSessionRichClosedExercisePayload
  | {
      type: 'diagnostic_quiz' | 'open_question';
      sessionId: string | null;
    }
  | null;

export interface RevisionSessionDto {
  id: string;
  status: RevisionSessionStatusValue;
  subjectId: string;
  documentId: string | null;
  knowledgeUnitId: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface RevisionSessionActionDto {
  id: string;
  kind: RevisionSessionActionKindValue;
  status: RevisionSessionActionStatusValue;
  displayOrder: number;
  activitySessionId: string | null;
  documentId: string | null;
  knowledgeUnitId: string | null;
}

export interface RevisionSessionCurrentActionDto extends RevisionSessionActionDto {
  payload: RevisionSessionActionPayload;
}

export interface RevisionSessionResponseDto {
  session: RevisionSessionDto;
  currentAction: RevisionSessionCurrentActionDto | null;
  history: RevisionSessionActionDto[];
}
```

### src/modules/revision-sessions/domain/revision-coach-next-action.entity.ts

```ts
import type {
  RevisionSessionActionKindValue,
  RevisionSessionActionStatusValue,
} from './revision-session.entity';

export type RevisionCoachNextActionKind = RevisionSessionActionKindValue;

export type RevisionCoachNextActionReasonCode =
  | 'ALTERNATE_ACTIVITY_TYPE'
  | 'REINFORCE_CURRENT_KNOWLEDGE_UNIT'
  | 'CHECK_UNDERSTANDING'
  | 'CONTINUE_SESSION_DEFAULT';

export interface RevisionCoachNextActionHistoryItem {
  kind: RevisionSessionActionKindValue;
  status: RevisionSessionActionStatusValue;
  displayOrder: number;
  activitySessionId: string | null;
  knowledgeUnitId: string | null;
}

export interface RevisionCoachNextActionInput {
  studentId: string;
  sessionId: string;
  subjectId: string;
  documentId: string | null;
  sessionKnowledgeUnitId: string | null;
  history: RevisionCoachNextActionHistoryItem[];
  availableActions: RevisionCoachNextActionKind[];
  allowedKnowledgeUnitIds: string[];
}

export interface RevisionCoachNextActionDecision {
  actionKind: RevisionCoachNextActionKind;
  knowledgeUnitId: string | null;
  reasonCode: RevisionCoachNextActionReasonCode;
}
```

### src/modules/revision-sessions/domain/deterministic-revision-session-action-selector.ts

```ts
import type {
  RevisionCoachNextActionDecision,
  RevisionCoachNextActionInput,
} from './revision-coach-next-action.entity';

export function selectDeterministicRevisionSessionAction(
  input: RevisionCoachNextActionInput,
): RevisionCoachNextActionDecision {
  const allowedKnowledgeUnitIds = [...input.allowedKnowledgeUnitIds];
  const availableActions = new Set(input.availableActions);
  const history = [...input.history].sort(
    (left, right) => left.displayOrder - right.displayOrder,
  );
  const lastAction = history.at(-1);
  const reliableKnowledgeUnitId = findReliableKnowledgeUnitId({
    sessionKnowledgeUnitId: input.sessionKnowledgeUnitId,
    lastActionKnowledgeUnitId: lastAction?.knowledgeUnitId ?? null,
    allowedKnowledgeUnitIds,
  });
  const canOpenQuestion =
    availableActions.has('OPEN_QUESTION') && reliableKnowledgeUnitId !== null;
  const canRichClosedExercise =
    availableActions.has('RICH_CLOSED_EXERCISE') &&
    reliableKnowledgeUnitId !== null;
  const canDiagnosticQuiz = availableActions.has('DIAGNOSTIC_QUIZ');

  if (lastAction?.kind === 'DIAGNOSTIC_QUIZ' && canOpenQuestion) {
    return {
      actionKind: 'OPEN_QUESTION',
      knowledgeUnitId: reliableKnowledgeUnitId,
      reasonCode: 'ALTERNATE_ACTIVITY_TYPE',
    };
  }

  if (lastAction?.kind === 'OPEN_QUESTION' && canRichClosedExercise) {
    return {
      actionKind: 'RICH_CLOSED_EXERCISE',
      knowledgeUnitId: reliableKnowledgeUnitId,
      reasonCode: 'ALTERNATE_ACTIVITY_TYPE',
    };
  }

  if (lastAction?.kind === 'OPEN_QUESTION' && canDiagnosticQuiz) {
    return {
      actionKind: 'DIAGNOSTIC_QUIZ',
      knowledgeUnitId: null,
      reasonCode: 'ALTERNATE_ACTIVITY_TYPE',
    };
  }

  if (lastAction?.kind === 'RICH_CLOSED_EXERCISE' && canDiagnosticQuiz) {
    return {
      actionKind: 'DIAGNOSTIC_QUIZ',
      knowledgeUnitId: null,
      reasonCode: 'ALTERNATE_ACTIVITY_TYPE',
    };
  }

  if (canOpenQuestion) {
    return {
      actionKind: 'OPEN_QUESTION',
      knowledgeUnitId: reliableKnowledgeUnitId,
      reasonCode: 'REINFORCE_CURRENT_KNOWLEDGE_UNIT',
    };
  }

  if (canRichClosedExercise) {
    return {
      actionKind: 'RICH_CLOSED_EXERCISE',
      knowledgeUnitId: reliableKnowledgeUnitId,
      reasonCode: 'REINFORCE_CURRENT_KNOWLEDGE_UNIT',
    };
  }

  if (canDiagnosticQuiz) {
    return {
      actionKind: 'DIAGNOSTIC_QUIZ',
      knowledgeUnitId: null,
      reasonCode: 'CONTINUE_SESSION_DEFAULT',
    };
  }

  throw new Error('Revision coach no action available');
}

function findReliableKnowledgeUnitId(input: {
  sessionKnowledgeUnitId: string | null;
  lastActionKnowledgeUnitId: string | null;
  allowedKnowledgeUnitIds: string[];
}): string | null {
  const allowed = new Set(input.allowedKnowledgeUnitIds);
  const candidates = [
    input.sessionKnowledgeUnitId,
    input.lastActionKnowledgeUnitId,
    input.allowedKnowledgeUnitIds[0] ?? null,
  ];

  return (
    candidates.find(
      (candidate): candidate is string =>
        typeof candidate === 'string' && allowed.has(candidate),
    ) ?? null
  );
}
```

### src/modules/revision-sessions/domain/deterministic-revision-session-action-selector.spec.ts

```ts
import { selectDeterministicRevisionSessionAction } from './deterministic-revision-session-action-selector';
import type { RevisionCoachNextActionInput } from './revision-coach-next-action.entity';

describe('selectDeterministicRevisionSessionAction', () => {
  it('selects an open question after a diagnostic quiz when a reliable knowledge unit exists', () => {
    expect(
      selectDeterministicRevisionSessionAction({
        ...baseInput(),
        sessionKnowledgeUnitId: 'unit-1',
        history: [
          {
            kind: 'DIAGNOSTIC_QUIZ',
            status: 'READY',
            displayOrder: 0,
            activitySessionId: 'quiz-session-1',
            knowledgeUnitId: null,
          },
        ],
      }),
    ).toEqual({
      actionKind: 'OPEN_QUESTION',
      knowledgeUnitId: 'unit-1',
      reasonCode: 'ALTERNATE_ACTIVITY_TYPE',
    });
  });

  it('selects a rich closed exercise after an open question when available', () => {
    expect(
      selectDeterministicRevisionSessionAction({
        ...baseInput(),
        sessionKnowledgeUnitId: 'unit-1',
        history: [
          {
            kind: 'OPEN_QUESTION',
            status: 'READY',
            displayOrder: 0,
            activitySessionId: 'open-session-1',
            knowledgeUnitId: 'unit-1',
          },
        ],
      }),
    ).toEqual({
      actionKind: 'RICH_CLOSED_EXERCISE',
      knowledgeUnitId: 'unit-1',
      reasonCode: 'ALTERNATE_ACTIVITY_TYPE',
    });
  });

  it('selects a diagnostic quiz after an open question when rich closed is unavailable', () => {
    expect(
      selectDeterministicRevisionSessionAction({
        ...baseInput(),
        availableActions: ['DIAGNOSTIC_QUIZ', 'OPEN_QUESTION'],
        sessionKnowledgeUnitId: 'unit-1',
        history: [
          {
            kind: 'OPEN_QUESTION',
            status: 'READY',
            displayOrder: 0,
            activitySessionId: 'open-session-1',
            knowledgeUnitId: 'unit-1',
          },
        ],
      }),
    ).toEqual({
      actionKind: 'DIAGNOSTIC_QUIZ',
      knowledgeUnitId: null,
      reasonCode: 'ALTERNATE_ACTIVITY_TYPE',
    });
  });

  it('selects a diagnostic quiz after a rich closed exercise', () => {
    expect(
      selectDeterministicRevisionSessionAction({
        ...baseInput(),
        sessionKnowledgeUnitId: 'unit-1',
        history: [
          {
            kind: 'RICH_CLOSED_EXERCISE',
            status: 'READY',
            displayOrder: 0,
            activitySessionId: null,
            knowledgeUnitId: 'unit-1',
          },
        ],
      }),
    ).toEqual({
      actionKind: 'DIAGNOSTIC_QUIZ',
      knowledgeUnitId: null,
      reasonCode: 'ALTERNATE_ACTIVITY_TYPE',
    });
  });

  it('falls back to a diagnostic quiz when no reliable knowledge unit exists', () => {
    expect(
      selectDeterministicRevisionSessionAction({
        ...baseInput(),
        sessionKnowledgeUnitId: null,
        allowedKnowledgeUnitIds: [],
        availableActions: ['DIAGNOSTIC_QUIZ'],
      }),
    ).toEqual({
      actionKind: 'DIAGNOSTIC_QUIZ',
      knowledgeUnitId: null,
      reasonCode: 'CONTINUE_SESSION_DEFAULT',
    });
  });

  it('keeps a stable choice with empty history and does not mutate input', () => {
    const input = {
      ...baseInput(),
      sessionKnowledgeUnitId: null,
      allowedKnowledgeUnitIds: ['unit-2'],
      history: [],
    };
    const snapshot = JSON.stringify(input);

    expect(selectDeterministicRevisionSessionAction(input)).toEqual({
      actionKind: 'OPEN_QUESTION',
      knowledgeUnitId: 'unit-2',
      reasonCode: 'REINFORCE_CURRENT_KNOWLEDGE_UNIT',
    });
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

function baseInput(): RevisionCoachNextActionInput {
  return {
    studentId: 'student-1',
    sessionId: 'revision-session-1',
    subjectId: 'subject-1',
    documentId: 'document-1',
    sessionKnowledgeUnitId: 'unit-1',
    history: [],
    availableActions: [
      'DIAGNOSTIC_QUIZ',
      'OPEN_QUESTION',
      'RICH_CLOSED_EXERCISE',
    ],
    allowedKnowledgeUnitIds: ['unit-1', 'unit-2'],
  };
}
```

### src/modules/revision-sessions/application/revision-sessions.repository.ts

```ts
import type {
  RevisionSessionActionKindValue,
  RevisionSessionActionStatusValue,
  RevisionSessionResponseDto,
  RevisionSessionStatusValue,
} from '../domain/revision-session.entity';

export const REVISION_SESSIONS_REPOSITORY = Symbol(
  'REVISION_SESSIONS_REPOSITORY',
);

export interface RevisionSessionStartContext {
  subjectId: string;
  documentId: string | null;
  knowledgeUnitId: string | null;
  knowledgeUnitTitle: string | null;
}

export interface RevisionSessionAllowedKnowledgeUnit {
  id: string;
  documentId: string | null;
  title: string | null;
}

export interface RevisionSessionPlanningContext {
  session: {
    id: string;
    status: RevisionSessionStatusValue;
    subjectId: string;
    documentId: string | null;
    knowledgeUnitId: string | null;
  };
  actions: Array<{
    kind: RevisionSessionActionKindValue;
    status: RevisionSessionActionStatusValue;
    displayOrder: number;
    activitySessionId: string | null;
    knowledgeUnitId: string | null;
  }>;
  allowedKnowledgeUnitIds: string[];
  allowedKnowledgeUnits: RevisionSessionAllowedKnowledgeUnit[];
}

export interface RevisionSessionsRepository {
  ensureStartContext(input: {
    studentId: string;
    subjectId: string;
    documentId?: string;
    knowledgeUnitId?: string;
  }): Promise<RevisionSessionStartContext>;

  createWithInitialAction(input: {
    studentId: string;
    subjectId: string;
    documentId: string | null;
    knowledgeUnitId: string | null;
    action: {
      kind: RevisionSessionActionKindValue;
      status: RevisionSessionActionStatusValue;
      displayOrder: number;
      activitySessionId: string | null;
      documentId: string | null;
      knowledgeUnitId: string | null;
    };
  }): Promise<RevisionSessionResponseDto>;

  findByIdForStudent(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RevisionSessionResponseDto>;

  findPlanningContextByIdForStudent(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RevisionSessionPlanningContext>;

  appendAction(input: {
    studentId: string;
    sessionId: string;
    action: {
      kind: RevisionSessionActionKindValue;
      status: RevisionSessionActionStatusValue;
      activitySessionId: string | null;
      documentId: string | null;
      knowledgeUnitId: string | null;
    };
  }): Promise<RevisionSessionResponseDto>;
}
```

### src/modules/revision-sessions/application/start-revision-session.use-case.ts

```ts
import { Inject, Injectable } from '@nestjs/common';
import { StartNextActivityUseCase } from '../../activities/application/start-next-activity.use-case';
import { StartOpenQuestionActivityUseCase } from '../../activities/application/start-open-question-activity.use-case';
import type {
  RevisionSessionActionKindValue,
  RevisionSessionActionPayload,
  RevisionSessionPreferredAction,
  RevisionSessionRichClosedExercisePayload,
  RevisionSessionResponseDto,
} from '../domain/revision-session.entity';
import {
  REVISION_SESSIONS_REPOSITORY,
  type RevisionSessionsRepository,
} from './revision-sessions.repository';

@Injectable()
export class StartRevisionSessionUseCase {
  constructor(
    @Inject(REVISION_SESSIONS_REPOSITORY)
    private readonly revisionSessionsRepository: RevisionSessionsRepository,
    private readonly startNextActivity: StartNextActivityUseCase,
    private readonly startOpenQuestionActivity: StartOpenQuestionActivityUseCase,
  ) {}

  async execute(input: {
    studentId: string;
    subjectId: string;
    documentId?: string;
    knowledgeUnitId?: string;
    preferredAction?: RevisionSessionPreferredAction;
  }): Promise<RevisionSessionResponseDto> {
    const actionKind = resolveInitialActionKind(input);

    if (actionKindRequiresKnowledgeUnit(actionKind) && !input.knowledgeUnitId) {
      throw new Error(requiresKnowledgeUnitError(actionKind));
    }

    const context = await this.revisionSessionsRepository.ensureStartContext({
      studentId: input.studentId,
      subjectId: input.subjectId,
      documentId: input.documentId,
      knowledgeUnitId: input.knowledgeUnitId,
    });

    if (actionKind === 'OPEN_QUESTION') {
      const activity = await this.startOpenQuestionActivity.execute({
        studentId: input.studentId,
        subjectId: context.subjectId,
        knowledgeUnitId: input.knowledgeUnitId ?? context.knowledgeUnitId ?? '',
      });

      return this.createSessionWithPayload({
        input,
        context,
        actionKind,
        payload: activity,
        activitySessionId: activity.sessionId,
        documentId: activity.documentId ?? context.documentId,
        knowledgeUnitId: activity.knowledgeUnitId,
      });
    }

    if (actionKind === 'RICH_CLOSED_EXERCISE') {
      if (!context.knowledgeUnitId) {
        throw new Error(requiresKnowledgeUnitError(actionKind));
      }

      return this.createSessionWithPayload({
        input,
        context,
        actionKind,
        payload: createRichClosedExercisePayload({
          subjectId: context.subjectId,
          documentId: context.documentId,
          knowledgeUnitId: context.knowledgeUnitId,
          knowledgeUnitTitle: context.knowledgeUnitTitle,
        }),
        activitySessionId: null,
        documentId: context.documentId,
        knowledgeUnitId: context.knowledgeUnitId,
      });
    }

    const activity = await this.startNextActivity.execute({
      studentId: input.studentId,
      subjectId: context.subjectId,
      knowledgeUnitId: context.knowledgeUnitId ?? undefined,
    });

    return this.createSessionWithPayload({
      input,
      context,
      actionKind,
      payload: activity,
      activitySessionId: activity.sessionId,
      documentId: activity.documentId ?? context.documentId,
      knowledgeUnitId: context.knowledgeUnitId,
    });
  }

  private async createSessionWithPayload(input: {
    input: {
      studentId: string;
      subjectId: string;
    };
    context: {
      subjectId: string;
      documentId: string | null;
      knowledgeUnitId: string | null;
      knowledgeUnitTitle?: string | null;
    };
    actionKind: RevisionSessionActionKindValue;
    payload: RevisionSessionActionPayload;
    activitySessionId: string | null;
    documentId: string | null;
    knowledgeUnitId: string | null;
  }): Promise<RevisionSessionResponseDto> {
    const response =
      await this.revisionSessionsRepository.createWithInitialAction({
        studentId: input.input.studentId,
        subjectId: input.context.subjectId,
        documentId: input.documentId,
        knowledgeUnitId: input.knowledgeUnitId,
        action: {
          kind: input.actionKind,
          status: 'READY',
          displayOrder: 0,
          activitySessionId: input.activitySessionId,
          documentId: input.documentId,
          knowledgeUnitId: input.knowledgeUnitId,
        },
      });

    return {
      ...response,
      currentAction: response.currentAction
        ? {
            ...response.currentAction,
            payload: input.payload,
          }
        : null,
    };
  }
}

function resolveInitialActionKind(input: {
  knowledgeUnitId?: string;
  preferredAction?: RevisionSessionPreferredAction;
}): RevisionSessionActionKindValue {
  if (input.preferredAction === 'diagnostic_quiz') {
    return 'DIAGNOSTIC_QUIZ';
  }

  if (input.preferredAction === 'open_question') {
    return 'OPEN_QUESTION';
  }

  if (input.preferredAction === 'rich_closed_exercise') {
    return 'RICH_CLOSED_EXERCISE';
  }

  return input.knowledgeUnitId ? 'OPEN_QUESTION' : 'DIAGNOSTIC_QUIZ';
}

function actionKindRequiresKnowledgeUnit(
  actionKind: RevisionSessionActionKindValue,
): boolean {
  return (
    actionKind === 'OPEN_QUESTION' || actionKind === 'RICH_CLOSED_EXERCISE'
  );
}

function requiresKnowledgeUnitError(
  actionKind: RevisionSessionActionKindValue,
): string {
  return actionKind === 'RICH_CLOSED_EXERCISE'
    ? 'Rich closed revision session requires a knowledge unit'
    : 'Open question revision session requires a knowledge unit';
}

function createRichClosedExercisePayload(input: {
  subjectId: string;
  documentId: string | null;
  knowledgeUnitId: string;
  knowledgeUnitTitle: string | null;
}): RevisionSessionRichClosedExercisePayload {
  return {
    type: 'rich_closed_exercise',
    subjectId: input.subjectId,
    documentId: input.documentId,
    knowledgeUnitId: input.knowledgeUnitId,
    knowledgeUnitTitle: input.knowledgeUnitTitle,
    reason: revisionRichClosedReason(),
    estimatedMinutes: 8,
    preferredAction: 'rich_closed_exercise',
  };
}

function revisionRichClosedReason(): string {
  return 'Questions riches recommandées pour consolider cette notion.';
}
```

### src/modules/revision-sessions/application/start-revision-session.use-case.spec.ts

```ts
import { StartRevisionSessionUseCase } from './start-revision-session.use-case';
import { GetRevisionSessionUseCase } from './get-revision-session.use-case';
import type { RevisionSessionsRepository } from './revision-sessions.repository';
import type { StartNextActivityUseCase } from '../../activities/application/start-next-activity.use-case';
import type { StartOpenQuestionActivityUseCase } from '../../activities/application/start-open-question-activity.use-case';

type EnsureStartContextInput = Parameters<
  RevisionSessionsRepository['ensureStartContext']
>[0];
type CreateWithInitialActionInput = Parameters<
  RevisionSessionsRepository['createWithInitialAction']
>[0];

describe('StartRevisionSessionUseCase', () => {
  it('creates a diagnostic quiz session by default with a subject only', async () => {
    const repository = createRevisionSessionsRepository();
    const startNextActivity = createStartNextActivityUseCase();
    const startOpenQuestionActivity = createStartOpenQuestionActivityUseCase();
    const useCase = new StartRevisionSessionUseCase(
      repository,
      startNextActivity,
      startOpenQuestionActivity,
    );

    const result = await useCase.execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });

    expect(repository.ensureStartContext.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          documentId: undefined,
          knowledgeUnitId: undefined,
        },
      ],
    ]);
    expect(startNextActivity.execute.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          knowledgeUnitId: undefined,
        },
      ],
    ]);
    expect(startOpenQuestionActivity.execute.mock.calls).toHaveLength(0);
    expect(repository.createWithInitialAction.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          documentId: null,
          knowledgeUnitId: null,
          action: {
            kind: 'DIAGNOSTIC_QUIZ',
            status: 'READY',
            displayOrder: 0,
            activitySessionId: 'quiz-session-1',
            documentId: null,
            knowledgeUnitId: null,
          },
        },
      ],
    ]);
    expect(result.currentAction.kind).toBe('DIAGNOSTIC_QUIZ');
    expect(result.currentAction.payload).toEqual(diagnosticQuizActivity());
    expect(JSON.stringify(result)).not.toContain('correctChoiceId');
    expect(JSON.stringify(result)).not.toContain('feedback');
  });

  it('creates an open question session by default when a knowledge unit is provided', async () => {
    const repository = createRevisionSessionsRepository();
    const startNextActivity = createStartNextActivityUseCase();
    const startOpenQuestionActivity = createStartOpenQuestionActivityUseCase();
    const useCase = new StartRevisionSessionUseCase(
      repository,
      startNextActivity,
      startOpenQuestionActivity,
    );

    const result = await useCase.execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
    });

    expect(startOpenQuestionActivity.execute.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
        },
      ],
    ]);
    expect(startNextActivity.execute.mock.calls).toHaveLength(0);
    expect(repository.createWithInitialAction.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
          action: {
            kind: 'OPEN_QUESTION',
            status: 'READY',
            displayOrder: 0,
            activitySessionId: 'open-session-1',
            documentId: 'document-1',
            knowledgeUnitId: 'unit-1',
          },
        },
      ],
    ]);
    expect(result.currentAction.kind).toBe('OPEN_QUESTION');
    expect(result.currentAction.payload).toEqual(openQuestionActivity());
    expect(JSON.stringify(result)).not.toContain('modelAnswer');
    expect(JSON.stringify(result)).not.toContain('score');
  });

  it('honors diagnostic quiz as an explicit preferred action', async () => {
    const repository = createRevisionSessionsRepository();
    const startNextActivity = createStartNextActivityUseCase();
    const useCase = new StartRevisionSessionUseCase(
      repository,
      startNextActivity,
      createStartOpenQuestionActivityUseCase(),
    );

    const result = await useCase.execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      preferredAction: 'diagnostic_quiz',
    });

    expect(startNextActivity.execute.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
        },
      ],
    ]);
    expect(result.currentAction.kind).toBe('DIAGNOSTIC_QUIZ');
  });

  it('creates a bounded rich closed exercise launcher without starting an activity', async () => {
    const repository = createRevisionSessionsRepository();
    const startNextActivity = createStartNextActivityUseCase();
    const startOpenQuestionActivity = createStartOpenQuestionActivityUseCase();
    const useCase = new StartRevisionSessionUseCase(
      repository,
      startNextActivity,
      startOpenQuestionActivity,
    );

    const result = await useCase.execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      preferredAction: 'rich_closed_exercise',
    });

    expect(startNextActivity.execute.mock.calls).toHaveLength(0);
    expect(startOpenQuestionActivity.execute.mock.calls).toHaveLength(0);
    expect(repository.createWithInitialAction.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
          action: {
            kind: 'RICH_CLOSED_EXERCISE',
            status: 'READY',
            displayOrder: 0,
            activitySessionId: null,
            documentId: 'document-1',
            knowledgeUnitId: 'unit-1',
          },
        },
      ],
    ]);
    expect(result.currentAction.kind).toBe('RICH_CLOSED_EXERCISE');
    expect(result.currentAction.activitySessionId).toBeNull();
    expect(result.currentAction.payload).toEqual({
      type: 'rich_closed_exercise',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      knowledgeUnitTitle: 'Notion 1',
      reason: 'Questions riches recommandées pour consolider cette notion.',
      estimatedMinutes: 8,
      preferredAction: 'rich_closed_exercise',
    });
    expect(JSON.stringify(result)).not.toContain('questions');
    expect(JSON.stringify(result)).not.toContain('correction');
    expect(JSON.stringify(result)).not.toContain('correctChoiceId');
  });

  it('rejects open question preferred action without a knowledge unit', async () => {
    const useCase = new StartRevisionSessionUseCase(
      createRevisionSessionsRepository(),
      createStartNextActivityUseCase(),
      createStartOpenQuestionActivityUseCase(),
    );

    await expect(
      useCase.execute({
        studentId: 'student-1',
        subjectId: 'subject-1',
        preferredAction: 'open_question',
      }),
    ).rejects.toThrow(
      'Open question revision session requires a knowledge unit',
    );
  });

  it('rejects rich closed preferred action without a knowledge unit', async () => {
    const useCase = new StartRevisionSessionUseCase(
      createRevisionSessionsRepository(),
      createStartNextActivityUseCase(),
      createStartOpenQuestionActivityUseCase(),
    );

    await expect(
      useCase.execute({
        studentId: 'student-1',
        subjectId: 'subject-1',
        preferredAction: 'rich_closed_exercise',
      }),
    ).rejects.toThrow('Rich closed revision session requires a knowledge unit');
  });
});

describe('GetRevisionSessionUseCase', () => {
  it('returns an owned revision session without creating a new action', async () => {
    const repository = createRevisionSessionsRepository();

    const result = await new GetRevisionSessionUseCase(repository).execute({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(repository.findByIdForStudent.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'revision-session-1',
        },
      ],
    ]);
    expect(repository.createWithInitialAction.mock.calls).toHaveLength(0);
    expect(result.currentAction?.payload).toEqual({
      type: 'open_question',
      sessionId: 'open-session-1',
    });
  });
});

function createRevisionSessionsRepository(): jest.Mocked<RevisionSessionsRepository> {
  return {
    ensureStartContext: jest
      .fn()
      .mockImplementation((input: EnsureStartContextInput) =>
        Promise.resolve({
          subjectId: input.subjectId,
          documentId: input.knowledgeUnitId ? 'document-1' : null,
          knowledgeUnitId: input.knowledgeUnitId ?? null,
          knowledgeUnitTitle: input.knowledgeUnitId ? 'Notion 1' : null,
        }),
      ),
    createWithInitialAction: jest
      .fn()
      .mockImplementation((input: CreateWithInitialActionInput) =>
        Promise.resolve(
          revisionSessionResponse(
            input.action.kind,
            input.action.activitySessionId ?? 'activity-session-1',
          ),
        ),
      ),
    findByIdForStudent: jest
      .fn()
      .mockResolvedValue(
        revisionSessionResponse('OPEN_QUESTION', 'open-session-1'),
      ),
    findPlanningContextByIdForStudent: jest.fn(),
    appendAction: jest.fn(),
  };
}

function createStartNextActivityUseCase(): jest.Mocked<StartNextActivityUseCase> {
  return {
    execute: jest.fn().mockResolvedValue(diagnosticQuizActivity()),
  } as unknown as jest.Mocked<StartNextActivityUseCase>;
}

function createStartOpenQuestionActivityUseCase(): jest.Mocked<StartOpenQuestionActivityUseCase> {
  return {
    execute: jest.fn().mockResolvedValue(openQuestionActivity()),
  } as unknown as jest.Mocked<StartOpenQuestionActivityUseCase>;
}

function revisionSessionResponse(
  kind: 'DIAGNOSTIC_QUIZ' | 'OPEN_QUESTION' | 'RICH_CLOSED_EXERCISE',
  activitySessionId: string,
) {
  const isKnowledgeUnitAction =
    kind === 'OPEN_QUESTION' || kind === 'RICH_CLOSED_EXERCISE';

  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED' as const,
      subjectId: 'subject-1',
      documentId: isKnowledgeUnitAction ? 'document-1' : null,
      knowledgeUnitId: isKnowledgeUnitAction ? 'unit-1' : null,
      createdAt: new Date('2026-06-15T10:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-1',
      kind,
      status: 'READY' as const,
      displayOrder: 0,
      activitySessionId:
        kind === 'RICH_CLOSED_EXERCISE' ? null : activitySessionId,
      documentId: isKnowledgeUnitAction ? 'document-1' : null,
      knowledgeUnitId: isKnowledgeUnitAction ? 'unit-1' : null,
      payload:
        kind === 'RICH_CLOSED_EXERCISE'
          ? {
              type: 'rich_closed_exercise',
              subjectId: 'subject-1',
              documentId: 'document-1',
              knowledgeUnitId: 'unit-1',
              reason:
                'Questions riches recommandées pour consolider cette notion.',
              estimatedMinutes: 8,
              preferredAction: 'rich_closed_exercise',
            }
          : kind === 'OPEN_QUESTION'
            ? { type: 'open_question', sessionId: activitySessionId }
            : { type: 'diagnostic_quiz', sessionId: activitySessionId },
    },
    history: [
      {
        id: 'action-1',
        kind,
        status: 'READY' as const,
        displayOrder: 0,
        activitySessionId:
          kind === 'RICH_CLOSED_EXERCISE' ? null : activitySessionId,
        documentId: isKnowledgeUnitAction ? 'document-1' : null,
        knowledgeUnitId: isKnowledgeUnitAction ? 'unit-1' : null,
      },
    ],
  };
}

function diagnosticQuizActivity() {
  return {
    sessionId: 'quiz-session-1',
    type: 'diagnostic_quiz' as const,
    title: 'Diagnostic constitutionnel',
    subjectId: 'subject-1',
    documentId: null,
    questions: [
      {
        id: 'question-1',
        prompt: 'Quel principe protège contre la concentration du pouvoir ?',
        choices: [
          { id: 'a', label: 'La séparation des pouvoirs' },
          { id: 'b', label: 'La confusion des pouvoirs' },
        ],
      },
    ],
  };
}

function openQuestionActivity() {
  return {
    sessionId: 'open-session-1',
    type: 'open_question' as const,
    version: 1,
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    question: {
      id: 'open-question-1',
      prompt: 'Explique la séparation des pouvoirs.',
      instructions: 'Réponds avec le cours.',
      maxAnswerLength: 4000,
      sources: [{ chunkId: 'chunk-1', pageNumber: null, index: 0 }],
    },
  };
}
```

### src/modules/revision-sessions/application/request-next-revision-session-action.use-case.ts

```ts
import { Inject, Injectable } from '@nestjs/common';
import { StartNextActivityUseCase } from '../../activities/application/start-next-activity.use-case';
import { StartOpenQuestionActivityUseCase } from '../../activities/application/start-open-question-activity.use-case';
import { selectDeterministicRevisionSessionAction } from '../domain/deterministic-revision-session-action-selector';
import type {
  RevisionCoachNextActionDecision,
  RevisionCoachNextActionInput,
} from '../domain/revision-coach-next-action.entity';
import type {
  RevisionSessionActionPayload,
  RevisionSessionResponseDto,
  RevisionSessionRichClosedExercisePayload,
} from '../domain/revision-session.entity';
import {
  REVISION_COACH_NEXT_ACTION_GENERATOR,
  type RevisionCoachNextActionGenerator,
} from './revision-coach-next-action.generator';
import {
  REVISION_SESSIONS_REPOSITORY,
  type RevisionSessionPlanningContext,
  type RevisionSessionsRepository,
} from './revision-sessions.repository';

@Injectable()
export class RequestNextRevisionSessionActionUseCase {
  constructor(
    @Inject(REVISION_SESSIONS_REPOSITORY)
    private readonly revisionSessionsRepository: RevisionSessionsRepository,
    @Inject(REVISION_COACH_NEXT_ACTION_GENERATOR)
    private readonly revisionCoachNextActionGenerator: RevisionCoachNextActionGenerator,
    private readonly startNextActivity: StartNextActivityUseCase,
    private readonly startOpenQuestionActivity: StartOpenQuestionActivityUseCase,
  ) {}

  async execute(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RevisionSessionResponseDto> {
    const context =
      await this.revisionSessionsRepository.findPlanningContextByIdForStudent(
        input,
      );

    if (context.session.status !== 'STARTED') {
      throw new Error('Revision session is not started');
    }

    const coachInput = toCoachInput(input.studentId, context);
    const decision = await this.resolveDecision(coachInput);
    const actionPayload = await this.createActionPayload({
      studentId: input.studentId,
      subjectId: context.session.subjectId,
      sessionDocumentId: context.session.documentId,
      context,
      decision,
    });
    const response = await this.revisionSessionsRepository.appendAction({
      studentId: input.studentId,
      sessionId: input.sessionId,
      action: {
        kind: decision.actionKind,
        status: 'READY',
        activitySessionId: actionPayload.activitySessionId,
        documentId: actionPayload.documentId,
        knowledgeUnitId: actionPayload.knowledgeUnitId,
      },
    });

    return {
      ...response,
      currentAction: response.currentAction
        ? {
            ...response.currentAction,
            payload: actionPayload.payload,
          }
        : null,
    };
  }

  private async resolveDecision(
    input: RevisionCoachNextActionInput,
  ): Promise<RevisionCoachNextActionDecision> {
    try {
      return normalizeDecision(
        await this.revisionCoachNextActionGenerator.generate(input),
        input,
      );
    } catch {
      return selectDeterministicRevisionSessionAction(input);
    }
  }

  private async createActionPayload(input: {
    studentId: string;
    subjectId: string;
    sessionDocumentId: string | null;
    context: RevisionSessionPlanningContext;
    decision: RevisionCoachNextActionDecision;
  }): Promise<{
    payload: RevisionSessionActionPayload;
    activitySessionId: string | null;
    documentId: string | null;
    knowledgeUnitId: string | null;
  }> {
    if (input.decision.actionKind === 'OPEN_QUESTION') {
      if (!input.decision.knowledgeUnitId) {
        throw new Error('Revision coach no action available');
      }

      const activity = await this.startOpenQuestionActivity.execute({
        studentId: input.studentId,
        subjectId: input.subjectId,
        knowledgeUnitId: input.decision.knowledgeUnitId,
      });

      return {
        payload: activity,
        activitySessionId: activity.sessionId,
        documentId: activity.documentId ?? input.sessionDocumentId,
        knowledgeUnitId: activity.knowledgeUnitId,
      };
    }

    if (input.decision.actionKind === 'RICH_CLOSED_EXERCISE') {
      if (!input.decision.knowledgeUnitId) {
        throw new Error('Revision coach no action available');
      }

      const knowledgeUnit = input.context.allowedKnowledgeUnits.find(
        (unit) => unit.id === input.decision.knowledgeUnitId,
      );
      const documentId = knowledgeUnit?.documentId ?? input.sessionDocumentId;

      return {
        payload: createRichClosedExercisePayload({
          subjectId: input.subjectId,
          documentId,
          knowledgeUnitId: input.decision.knowledgeUnitId,
          knowledgeUnitTitle: knowledgeUnit?.title ?? null,
          reasonCode: input.decision.reasonCode,
        }),
        activitySessionId: null,
        documentId,
        knowledgeUnitId: input.decision.knowledgeUnitId,
      };
    }

    const activity = await this.startNextActivity.execute({
      studentId: input.studentId,
      subjectId: input.subjectId,
      knowledgeUnitId: input.decision.knowledgeUnitId ?? undefined,
    });

    return {
      payload: activity,
      activitySessionId: activity.sessionId,
      documentId: activity.documentId ?? input.sessionDocumentId,
      knowledgeUnitId: input.decision.knowledgeUnitId,
    };
  }
}

function toCoachInput(
  studentId: string,
  context: RevisionSessionPlanningContext,
): RevisionCoachNextActionInput {
  const sessionKnowledgeUnitId =
    context.session.knowledgeUnitId &&
    context.allowedKnowledgeUnitIds.includes(context.session.knowledgeUnitId)
      ? context.session.knowledgeUnitId
      : null;
  const availableActions =
    context.allowedKnowledgeUnitIds.length > 0
      ? (['DIAGNOSTIC_QUIZ', 'OPEN_QUESTION', 'RICH_CLOSED_EXERCISE'] as const)
      : (['DIAGNOSTIC_QUIZ'] as const);

  return {
    studentId,
    sessionId: context.session.id,
    subjectId: context.session.subjectId,
    documentId: context.session.documentId,
    sessionKnowledgeUnitId,
    history: context.actions.map((action) => ({
      kind: action.kind,
      status: action.status,
      displayOrder: action.displayOrder,
      activitySessionId: action.activitySessionId,
      knowledgeUnitId:
        action.knowledgeUnitId &&
        context.allowedKnowledgeUnitIds.includes(action.knowledgeUnitId)
          ? action.knowledgeUnitId
          : null,
    })),
    availableActions: [...availableActions],
    allowedKnowledgeUnitIds: [...context.allowedKnowledgeUnitIds],
  };
}

function normalizeDecision(
  decision: RevisionCoachNextActionDecision,
  input: RevisionCoachNextActionInput,
): RevisionCoachNextActionDecision {
  if (!input.availableActions.includes(decision.actionKind)) {
    throw new Error('REVISION_COACH_ACTION_NOT_ALLOWED');
  }

  if (
    decision.knowledgeUnitId !== null &&
    !input.allowedKnowledgeUnitIds.includes(decision.knowledgeUnitId)
  ) {
    throw new Error('REVISION_COACH_KNOWLEDGE_UNIT_NOT_ALLOWED');
  }

  if (
    (decision.actionKind === 'OPEN_QUESTION' ||
      decision.actionKind === 'RICH_CLOSED_EXERCISE') &&
    (decision.knowledgeUnitId === null ||
      !input.allowedKnowledgeUnitIds.includes(decision.knowledgeUnitId))
  ) {
    throw new Error('REVISION_COACH_KNOWLEDGE_UNIT_NOT_ALLOWED');
  }

  return decision;
}

function createRichClosedExercisePayload(input: {
  subjectId: string;
  documentId: string | null;
  knowledgeUnitId: string;
  knowledgeUnitTitle: string | null;
  reasonCode: RevisionCoachNextActionDecision['reasonCode'];
}): RevisionSessionRichClosedExercisePayload {
  return {
    type: 'rich_closed_exercise',
    subjectId: input.subjectId,
    documentId: input.documentId,
    knowledgeUnitId: input.knowledgeUnitId,
    knowledgeUnitTitle: input.knowledgeUnitTitle,
    reason: revisionRichClosedReason(input.reasonCode),
    estimatedMinutes: 8,
    preferredAction: 'rich_closed_exercise',
  };
}

function revisionRichClosedReason(
  reasonCode: RevisionCoachNextActionDecision['reasonCode'],
): string {
  return {
    ALTERNATE_ACTIVITY_TYPE:
      'Questions riches recommandées pour varier la révision.',
    REINFORCE_CURRENT_KNOWLEDGE_UNIT:
      'Questions riches recommandées pour consolider cette notion.',
    CHECK_UNDERSTANDING:
      'Questions riches recommandées pour vérifier la compréhension.',
    CONTINUE_SESSION_DEFAULT:
      'Questions riches recommandées pour poursuivre la session.',
  }[reasonCode];
}
```

### src/modules/revision-sessions/application/request-next-revision-session-action.use-case.spec.ts

```ts
import type { StartNextActivityUseCase } from '../../activities/application/start-next-activity.use-case';
import type { StartOpenQuestionActivityUseCase } from '../../activities/application/start-open-question-activity.use-case';
import type { RevisionCoachNextActionGenerator } from './revision-coach-next-action.generator';
import { RequestNextRevisionSessionActionUseCase } from './request-next-revision-session-action.use-case';
import type { RevisionSessionsRepository } from './revision-sessions.repository';

type AppendActionInput = Parameters<
  RevisionSessionsRepository['appendAction']
>[0];

describe('RequestNextRevisionSessionActionUseCase', () => {
  it('creates a diagnostic quiz from a coach decision', async () => {
    const repository = createRepository();
    const generator = createGenerator({
      actionKind: 'DIAGNOSTIC_QUIZ',
      knowledgeUnitId: null,
      reasonCode: 'CHECK_UNDERSTANDING',
    });
    const startNextActivity = createStartNextActivityUseCase();
    const startOpenQuestionActivity = createStartOpenQuestionActivityUseCase();
    const useCase = new RequestNextRevisionSessionActionUseCase(
      repository,
      generator,
      startNextActivity,
      startOpenQuestionActivity,
    );

    const result = await useCase.execute({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(generator.generate.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'revision-session-1',
          subjectId: 'subject-1',
          documentId: 'document-1',
          sessionKnowledgeUnitId: 'unit-1',
          history: [
            {
              kind: 'OPEN_QUESTION',
              status: 'READY',
              displayOrder: 0,
              activitySessionId: 'open-session-1',
              knowledgeUnitId: 'unit-1',
            },
          ],
          availableActions: [
            'DIAGNOSTIC_QUIZ',
            'OPEN_QUESTION',
            'RICH_CLOSED_EXERCISE',
          ],
          allowedKnowledgeUnitIds: ['unit-1', 'unit-2'],
        },
      ],
    ]);
    expect(startNextActivity.execute.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          knowledgeUnitId: undefined,
        },
      ],
    ]);
    expect(startOpenQuestionActivity.execute.mock.calls).toHaveLength(0);
    expect(repository.appendAction.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'revision-session-1',
          action: {
            kind: 'DIAGNOSTIC_QUIZ',
            status: 'READY',
            activitySessionId: 'quiz-session-2',
            documentId: 'document-1',
            knowledgeUnitId: null,
          },
        },
      ],
    ]);
    expect(result.currentAction?.payload).toEqual(diagnosticQuizActivity());
    expect(JSON.stringify(result)).not.toContain('correctChoiceId');
  });

  it('creates an open question from a coach decision', async () => {
    const repository = createRepository();
    const generator = createGenerator({
      actionKind: 'OPEN_QUESTION',
      knowledgeUnitId: 'unit-2',
      reasonCode: 'REINFORCE_CURRENT_KNOWLEDGE_UNIT',
    });
    const startNextActivity = createStartNextActivityUseCase();
    const startOpenQuestionActivity = createStartOpenQuestionActivityUseCase();

    const result = await new RequestNextRevisionSessionActionUseCase(
      repository,
      generator,
      startNextActivity,
      startOpenQuestionActivity,
    ).execute({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(startOpenQuestionActivity.execute.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-2',
        },
      ],
    ]);
    expect(startNextActivity.execute.mock.calls).toHaveLength(0);
    expect(repository.appendAction.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'revision-session-1',
          action: {
            kind: 'OPEN_QUESTION',
            status: 'READY',
            activitySessionId: 'open-session-2',
            documentId: 'document-1',
            knowledgeUnitId: 'unit-2',
          },
        },
      ],
    ]);
    expect(result.currentAction?.payload).toEqual(openQuestionActivity());
    expect(JSON.stringify(result)).not.toContain('modelAnswer');
    expect(JSON.stringify(result)).not.toContain('score');
  });

  it('uses deterministic rich closed fallback when the coach generator fails', async () => {
    const repository = createRepository();
    const generator = createGenerator(new Error('provider exploded'));
    const startNextActivity = createStartNextActivityUseCase();
    const startOpenQuestionActivity = createStartOpenQuestionActivityUseCase();

    await new RequestNextRevisionSessionActionUseCase(
      repository,
      generator,
      startNextActivity,
      startOpenQuestionActivity,
    ).execute({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(startNextActivity.execute.mock.calls).toHaveLength(0);
    expect(startOpenQuestionActivity.execute.mock.calls).toHaveLength(0);
    expect(repository.appendAction.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'revision-session-1',
          action: {
            kind: 'RICH_CLOSED_EXERCISE',
            status: 'READY',
            activitySessionId: null,
            documentId: 'document-1',
            knowledgeUnitId: 'unit-1',
          },
        },
      ],
    ]);
  });

  it('creates a rich closed launcher from a coach decision without starting activities', async () => {
    const repository = createRepository();
    const generator = createGenerator({
      actionKind: 'RICH_CLOSED_EXERCISE',
      knowledgeUnitId: 'unit-2',
      reasonCode: 'CHECK_UNDERSTANDING',
    });
    const startNextActivity = createStartNextActivityUseCase();
    const startOpenQuestionActivity = createStartOpenQuestionActivityUseCase();

    const result = await new RequestNextRevisionSessionActionUseCase(
      repository,
      generator,
      startNextActivity,
      startOpenQuestionActivity,
    ).execute({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(startNextActivity.execute.mock.calls).toHaveLength(0);
    expect(startOpenQuestionActivity.execute.mock.calls).toHaveLength(0);
    expect(repository.appendAction.mock.calls).toEqual([
      [
        {
          studentId: 'student-1',
          sessionId: 'revision-session-1',
          action: {
            kind: 'RICH_CLOSED_EXERCISE',
            status: 'READY',
            activitySessionId: null,
            documentId: 'document-2',
            knowledgeUnitId: 'unit-2',
          },
        },
      ],
    ]);
    expect(result.currentAction?.payload).toEqual({
      type: 'rich_closed_exercise',
      subjectId: 'subject-1',
      documentId: 'document-2',
      knowledgeUnitId: 'unit-2',
      knowledgeUnitTitle: 'Notion 2',
      reason: 'Questions riches recommandées pour vérifier la compréhension.',
      estimatedMinutes: 8,
      preferredAction: 'rich_closed_exercise',
    });
    expect(JSON.stringify(result)).not.toContain('questions');
    expect(JSON.stringify(result)).not.toContain('correction');
    expect(JSON.stringify(result)).not.toContain('correctChoiceId');
  });

  it('does not persist an action when activity creation fails', async () => {
    const repository = createRepository();
    const generator = createGenerator({
      actionKind: 'DIAGNOSTIC_QUIZ',
      knowledgeUnitId: null,
      reasonCode: 'CHECK_UNDERSTANDING',
    });
    const startNextActivity = createStartNextActivityUseCase();
    startNextActivity.execute.mockRejectedValue(new Error('activity failed'));

    await expect(
      new RequestNextRevisionSessionActionUseCase(
        repository,
        generator,
        startNextActivity,
        createStartOpenQuestionActivityUseCase(),
      ).execute({
        studentId: 'student-1',
        sessionId: 'revision-session-1',
      }),
    ).rejects.toThrow('activity failed');

    expect(repository.appendAction.mock.calls).toHaveLength(0);
  });
});

function createRepository(): jest.Mocked<RevisionSessionsRepository> {
  return {
    ensureStartContext: jest.fn(),
    createWithInitialAction: jest.fn(),
    findByIdForStudent: jest.fn(),
    findPlanningContextByIdForStudent: jest.fn().mockResolvedValue({
      session: {
        id: 'revision-session-1',
        status: 'STARTED',
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
      actions: [
        {
          kind: 'OPEN_QUESTION',
          status: 'READY',
          displayOrder: 0,
          activitySessionId: 'open-session-1',
          knowledgeUnitId: 'unit-1',
        },
      ],
      allowedKnowledgeUnitIds: ['unit-1', 'unit-2'],
      allowedKnowledgeUnits: [
        { id: 'unit-1', documentId: 'document-1', title: 'Notion 1' },
        { id: 'unit-2', documentId: 'document-2', title: 'Notion 2' },
      ],
    }),
    appendAction: jest
      .fn()
      .mockImplementation((input: AppendActionInput) =>
        Promise.resolve(revisionSessionResponse(input)),
      ),
  };
}

function createGenerator(
  decisionOrError:
    | Awaited<ReturnType<RevisionCoachNextActionGenerator['generate']>>
    | Error,
): jest.Mocked<RevisionCoachNextActionGenerator> {
  return {
    generate:
      decisionOrError instanceof Error
        ? jest.fn().mockRejectedValue(decisionOrError)
        : jest.fn().mockResolvedValue(decisionOrError),
  };
}

function createStartNextActivityUseCase(): jest.Mocked<StartNextActivityUseCase> {
  return {
    execute: jest.fn().mockResolvedValue(diagnosticQuizActivity()),
  } as unknown as jest.Mocked<StartNextActivityUseCase>;
}

function createStartOpenQuestionActivityUseCase(): jest.Mocked<StartOpenQuestionActivityUseCase> {
  return {
    execute: jest.fn().mockResolvedValue(openQuestionActivity()),
  } as unknown as jest.Mocked<StartOpenQuestionActivityUseCase>;
}

function diagnosticQuizActivity() {
  return {
    sessionId: 'quiz-session-2',
    type: 'diagnostic_quiz' as const,
    title: 'QCM suivant',
    subjectId: 'subject-1',
    documentId: null,
    questions: [
      {
        id: 'question-1',
        prompt: 'Quel mécanisme permet de vérifier la compréhension ?',
        choices: [
          { id: 'a', label: 'Un contrôle' },
          { id: 'b', label: 'Une intuition' },
        ],
      },
    ],
  };
}

function openQuestionActivity() {
  return {
    sessionId: 'open-session-2',
    type: 'open_question' as const,
    version: 1,
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-2',
    question: {
      id: 'open-question-2',
      prompt: 'Explique la notion avec le cours.',
      instructions: 'Structure ta réponse.',
      maxAnswerLength: 4000,
      sources: [{ chunkId: 'chunk-1', pageNumber: null, index: 0 }],
    },
  };
}

function revisionSessionResponse(input: AppendActionInput) {
  const payload =
    input.action.kind === 'RICH_CLOSED_EXERCISE'
      ? {
          type: 'rich_closed_exercise' as const,
          subjectId: 'subject-1',
          documentId: input.action.documentId,
          knowledgeUnitId: input.action.knowledgeUnitId ?? 'unit-2',
          reason: 'Questions riches recommandées pour consolider cette notion.',
          estimatedMinutes: 8,
          preferredAction: 'rich_closed_exercise' as const,
        }
      : {
          type:
            input.action.kind === 'OPEN_QUESTION'
              ? ('open_question' as const)
              : ('diagnostic_quiz' as const),
          sessionId: input.action.activitySessionId,
        };

  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED' as const,
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      createdAt: new Date('2026-06-15T10:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-2',
      kind: input.action.kind,
      status: 'READY' as const,
      displayOrder: 1,
      activitySessionId: input.action.activitySessionId,
      documentId: input.action.documentId,
      knowledgeUnitId: input.action.knowledgeUnitId,
      payload,
    },
    history: [
      {
        id: 'action-1',
        kind: 'OPEN_QUESTION' as const,
        status: 'READY' as const,
        displayOrder: 0,
        activitySessionId: 'open-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
      {
        id: 'action-2',
        kind: input.action.kind,
        status: 'READY' as const,
        displayOrder: 1,
        activitySessionId: input.action.activitySessionId,
        documentId: input.action.documentId,
        knowledgeUnitId: input.action.knowledgeUnitId,
      },
    ],
  };
}
```

### src/modules/revision-sessions/infrastructure/genkit-revision-coach-next-action.generator.ts

```ts
import { Inject, Injectable } from '@nestjs/common';
import { genkit, z } from 'genkit';
import {
  AI_GENERATION_OBSERVER,
  type AiGenerationObserver,
  noopAiGenerationObserver,
} from '../../ai/application/ai-generation-observer';
import {
  resolveArtifactGenkitConfig,
  resolveArtifactGenkitMetadata,
  type ResolvedArtifactGenkitMetadata,
} from '../../ai/infrastructure/document-artifact-genkit-config';
import type {
  RevisionCoachNextActionDecision,
  RevisionCoachNextActionInput,
} from '../domain/revision-coach-next-action.entity';
import type { RevisionCoachNextActionGenerator } from '../application/revision-coach-next-action.generator';

const FLOW_NAME = 'revisionCoachNextAction';
const PROMPT_VERSION = 'revision-coach-next-action-v1';
const SCHEMA_VERSION = 'revision-coach-next-action-v1';
const EMPTY_OUTPUT_ERROR_CODE = 'REVISION_COACH_EMPTY_OUTPUT';
const INVALID_OUTPUT_ERROR_CODE = 'REVISION_COACH_INVALID_OUTPUT';
const ACTION_NOT_ALLOWED_ERROR_CODE = 'REVISION_COACH_ACTION_NOT_ALLOWED';
const KNOWLEDGE_UNIT_NOT_ALLOWED_ERROR_CODE =
  'REVISION_COACH_KNOWLEDGE_UNIT_NOT_ALLOWED';
const FAILED_ERROR_CODE = 'REVISION_COACH_FAILED';

const RevisionCoachNextActionSchema = z
  .object({
    actionKind: z.enum([
      'DIAGNOSTIC_QUIZ',
      'OPEN_QUESTION',
      'RICH_CLOSED_EXERCISE',
    ]),
    knowledgeUnitId: z.string().trim().min(1).nullable(),
    reasonCode: z.enum([
      'ALTERNATE_ACTIVITY_TYPE',
      'REINFORCE_CURRENT_KNOWLEDGE_UNIT',
      'CHECK_UNDERSTANDING',
      'CONTINUE_SESSION_DEFAULT',
    ]),
  })
  .strict();

@Injectable()
export class GenkitRevisionCoachNextActionGenerator implements RevisionCoachNextActionGenerator {
  private readonly aiByModel = new Map<string, ReturnType<typeof genkit>>();
  private resolvedMetadata?: ResolvedArtifactGenkitMetadata;

  constructor(
    @Inject(AI_GENERATION_OBSERVER)
    private readonly observer: AiGenerationObserver = noopAiGenerationObserver,
  ) {}

  async generate(
    input: RevisionCoachNextActionInput,
  ): Promise<RevisionCoachNextActionDecision> {
    const metadata = this.resolveMetadata();
    const prompt = buildRevisionCoachPrompt(input);
    const inputSize = prompt.length;
    const startedAt = Date.now();

    try {
      const { output } = await this.getAi(metadata).generate({
        prompt,
        output: {
          schema: RevisionCoachNextActionSchema,
        },
      });

      if (!output) {
        throw new Error(EMPTY_OUTPUT_ERROR_CODE);
      }

      const parsed = RevisionCoachNextActionSchema.parse(output);
      const decision = normalizeDecision(parsed, input);

      this.observer.observe({
        flowName: FLOW_NAME,
        provider: metadata.provider,
        model: metadata.model,
        promptVersion: PROMPT_VERSION,
        schemaVersion: SCHEMA_VERSION,
        inputSize,
        durationMs: Date.now() - startedAt,
        status: 'success',
        documentId: input.documentId ?? undefined,
        subjectId: input.subjectId,
        knowledgeUnitId: decision.knowledgeUnitId ?? undefined,
        studentId: input.studentId,
      });

      return decision;
    } catch (error) {
      this.observer.observe({
        flowName: FLOW_NAME,
        provider: metadata.provider,
        model: metadata.model,
        promptVersion: PROMPT_VERSION,
        schemaVersion: SCHEMA_VERSION,
        inputSize,
        durationMs: Date.now() - startedAt,
        status: 'error',
        errorCode: resolveRevisionCoachErrorCode(error),
        documentId: input.documentId ?? undefined,
        subjectId: input.subjectId,
        knowledgeUnitId: input.sessionKnowledgeUnitId ?? undefined,
        studentId: input.studentId,
      });

      throw error;
    }
  }

  private getAi(
    metadata: ResolvedArtifactGenkitMetadata,
  ): ReturnType<typeof genkit> {
    const cacheKey = `${metadata.provider}:${metadata.model}`;
    const existingAi = this.aiByModel.get(cacheKey);

    if (existingAi) {
      return existingAi;
    }

    const ai = genkit(resolveArtifactGenkitConfig(metadata).config);
    this.aiByModel.set(cacheKey, ai);

    return ai;
  }

  private resolveMetadata(): ResolvedArtifactGenkitMetadata {
    this.resolvedMetadata ??= resolveArtifactGenkitMetadata();
    return this.resolvedMetadata;
  }
}

function buildRevisionCoachPrompt(input: RevisionCoachNextActionInput): string {
  const payload = {
    sessionId: input.sessionId,
    subjectId: input.subjectId,
    documentId: input.documentId,
    sessionKnowledgeUnitId: input.sessionKnowledgeUnitId,
    history: input.history.map((action) => ({
      kind: action.kind,
      status: action.status,
      displayOrder: action.displayOrder,
      activitySessionId: action.activitySessionId,
      knowledgeUnitId: action.knowledgeUnitId,
    })),
    availableActions: input.availableActions,
    allowedKnowledgeUnitIds: input.allowedKnowledgeUnitIds,
  };

  return [
    'Tu es un coach de révision qui choisit uniquement la prochaine intention d’activité.',
    'Tu dois choisir une action strictement parmi availableActions.',
    'RICH_CLOSED_EXERCISE signifie uniquement démarrer le flow rich closed existant côté activities.',
    'Tu ne proposes jamais d’UI, de widget, de composant, de route ou de texte conversationnel.',
    'Tu ne produis jamais de question rich closed, de réponse, de correction, de contenu pédagogique ou de message libre.',
    'Réponds uniquement en JSON strict avec actionKind, knowledgeUnitId et reasonCode.',
    'Si la dernière action était un QCM et qu’une notion autorisée existe, privilégie OPEN_QUESTION.',
    'Si la dernière action était une question ouverte et que RICH_CLOSED_EXERCISE est disponible, tu peux la choisir pour varier la pratique.',
    'Si aucune notion fiable n’est disponible, privilégie DIAGNOSTIC_QUIZ.',
    'N’utilise que les IDs fournis dans allowedKnowledgeUnitIds.',
    JSON.stringify(payload),
  ].join('\n\n');
}

function normalizeDecision(
  decision: z.infer<typeof RevisionCoachNextActionSchema>,
  input: RevisionCoachNextActionInput,
): RevisionCoachNextActionDecision {
  if (!input.availableActions.includes(decision.actionKind)) {
    throw new Error(ACTION_NOT_ALLOWED_ERROR_CODE);
  }

  if (
    decision.knowledgeUnitId !== null &&
    !input.allowedKnowledgeUnitIds.includes(decision.knowledgeUnitId)
  ) {
    throw new Error(KNOWLEDGE_UNIT_NOT_ALLOWED_ERROR_CODE);
  }

  if (
    (decision.actionKind === 'OPEN_QUESTION' ||
      decision.actionKind === 'RICH_CLOSED_EXERCISE') &&
    (decision.knowledgeUnitId === null ||
      !input.allowedKnowledgeUnitIds.includes(decision.knowledgeUnitId))
  ) {
    throw new Error(KNOWLEDGE_UNIT_NOT_ALLOWED_ERROR_CODE);
  }

  return decision;
}

function resolveRevisionCoachErrorCode(error: unknown): string {
  if (error instanceof Error) {
    if (
      error.message === EMPTY_OUTPUT_ERROR_CODE ||
      error.message === ACTION_NOT_ALLOWED_ERROR_CODE ||
      error.message === KNOWLEDGE_UNIT_NOT_ALLOWED_ERROR_CODE
    ) {
      return error.message;
    }

    if (error.name === 'ZodError') {
      return INVALID_OUTPUT_ERROR_CODE;
    }
  }

  return FAILED_ERROR_CODE;
}
```

### src/modules/revision-sessions/infrastructure/genkit-revision-coach-next-action.generator.spec.ts

```ts
type GenerateInput = {
  prompt: string;
  output: {
    schema: unknown;
  };
};

type GenerateResult = {
  output?: {
    actionKind?: string;
    knowledgeUnitId?: string | null;
    reasonCode?: string;
    message?: string;
    questions?: unknown;
    correction?: unknown;
    widget?: unknown;
  };
};

type GenkitInput = {
  plugins: unknown[];
  model: string;
};

const mockGooglePlugin = { name: 'google-plugin' };
const mockGenerate = jest.fn<Promise<GenerateResult>, [GenerateInput]>();
const mockGenkit = jest.fn<{ generate: typeof mockGenerate }, [GenkitInput]>(
  () => ({ generate: mockGenerate }),
);
const mockGoogleAI = jest.fn<unknown, []>(() => mockGooglePlugin);

jest.mock('genkit', () => ({
  ...jest.requireActual<typeof import('genkit')>('genkit'),
  genkit: mockGenkit,
}));

jest.mock('@genkit-ai/google-genai', () => ({
  googleAI: mockGoogleAI,
}));

import type {
  AiGenerationObservation,
  AiGenerationObserver,
} from '../../ai/application/ai-generation-observer';
import { GenkitRevisionCoachNextActionGenerator } from './genkit-revision-coach-next-action.generator';

describe('GenkitRevisionCoachNextActionGenerator', () => {
  const originalAiProvider = process.env.AI_PROVIDER;
  const originalGenkitModel = process.env.GENKIT_MODEL;

  afterEach(() => {
    restoreEnv('AI_PROVIDER', originalAiProvider);
    restoreEnv('GENKIT_MODEL', originalGenkitModel);
    mockGoogleAI.mockClear();
    mockGenkit.mockClear();
    mockGenerate.mockReset();
  });

  it('returns a valid bounded decision and observes metadata only', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        actionKind: 'OPEN_QUESTION',
        knowledgeUnitId: 'unit-1',
        reasonCode: 'ALTERNATE_ACTIVITY_TYPE',
      },
    });
    const observer = createObserver();

    const decision = await new GenkitRevisionCoachNextActionGenerator(
      observer,
    ).generate(baseInput());

    expect(decision).toEqual({
      actionKind: 'OPEN_QUESTION',
      knowledgeUnitId: 'unit-1',
      reasonCode: 'ALTERNATE_ACTIVITY_TYPE',
    });
    const [generateInput] = mockGenerate.mock.calls[0] ?? [];
    expect(generateInput?.prompt).toContain('revision-session-1');
    expect(generateInput?.prompt).not.toContain('SENTINEL_FULL_COURSE_TEXT');
    expect(generateInput?.output.schema).toBeDefined();
    const observation = getObservedObservation(observer);
    expect(observation).toMatchObject({
      flowName: 'revisionCoachNextAction',
      provider: 'google-genai',
      model: 'googleai/gemini-2.5-flash',
      promptVersion: 'revision-coach-next-action-v1',
      schemaVersion: 'revision-coach-next-action-v1',
      status: 'success',
      documentId: 'document-1',
      subjectId: 'subject-1',
      knowledgeUnitId: 'unit-1',
      studentId: 'student-1',
    });
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'SENTINEL_FULL_COURSE_TEXT',
    );
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'ALTERNATE_ACTIVITY_TYPE',
    );
  });

  it('rejects empty output with a controlled error', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({});
    const observer = createObserver();

    await expect(
      new GenkitRevisionCoachNextActionGenerator(observer).generate(
        baseInput(),
      ),
    ).rejects.toThrow('REVISION_COACH_EMPTY_OUTPUT');

    expect(getObservedObservation(observer)).toMatchObject({
      status: 'error',
      errorCode: 'REVISION_COACH_EMPTY_OUTPUT',
    });
  });

  it('returns a bounded rich closed decision without exercise content', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        actionKind: 'RICH_CLOSED_EXERCISE',
        knowledgeUnitId: 'unit-2',
        reasonCode: 'CHECK_UNDERSTANDING',
      },
    });
    const observer = createObserver();

    const decision = await new GenkitRevisionCoachNextActionGenerator(
      observer,
    ).generate({
      ...baseInput(),
      availableActions: [
        'DIAGNOSTIC_QUIZ',
        'OPEN_QUESTION',
        'RICH_CLOSED_EXERCISE',
      ],
    });

    expect(decision).toEqual({
      actionKind: 'RICH_CLOSED_EXERCISE',
      knowledgeUnitId: 'unit-2',
      reasonCode: 'CHECK_UNDERSTANDING',
    });
    const [generateInput] = mockGenerate.mock.calls[0] ?? [];
    expect(generateInput?.prompt).toContain('RICH_CLOSED_EXERCISE');
    expect(generateInput?.prompt).toContain('ne produis jamais de question');
    expect(JSON.stringify(decision)).not.toContain('questions');
    expect(JSON.stringify(decision)).not.toContain('correction');
    expect(getObservedObservation(observer)).toMatchObject({
      status: 'success',
      knowledgeUnitId: 'unit-2',
    });
  });

  it('rejects actions that are not allowed', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        actionKind: 'OPEN_QUESTION',
        knowledgeUnitId: 'unit-1',
        reasonCode: 'CHECK_UNDERSTANDING',
      },
    });

    await expect(
      new GenkitRevisionCoachNextActionGenerator().generate({
        ...baseInput(),
        availableActions: ['DIAGNOSTIC_QUIZ'],
      }),
    ).rejects.toThrow('REVISION_COACH_ACTION_NOT_ALLOWED');
  });

  it('rejects knowledge-unit actions without an allowed knowledge unit', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        actionKind: 'OPEN_QUESTION',
        knowledgeUnitId: null,
        reasonCode: 'CHECK_UNDERSTANDING',
      },
    });

    await expect(
      new GenkitRevisionCoachNextActionGenerator().generate(baseInput()),
    ).rejects.toThrow('REVISION_COACH_KNOWLEDGE_UNIT_NOT_ALLOWED');

    mockGenerate.mockResolvedValue({
      output: {
        actionKind: 'RICH_CLOSED_EXERCISE',
        knowledgeUnitId: 'unit-unknown',
        reasonCode: 'CHECK_UNDERSTANDING',
      },
    });

    await expect(
      new GenkitRevisionCoachNextActionGenerator().generate({
        ...baseInput(),
        availableActions: [
          'DIAGNOSTIC_QUIZ',
          'OPEN_QUESTION',
          'RICH_CLOSED_EXERCISE',
        ],
      }),
    ).rejects.toThrow('REVISION_COACH_KNOWLEDGE_UNIT_NOT_ALLOWED');
  });

  it('rejects arbitrary rich closed exercise fields from the coach output', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockResolvedValue({
      output: {
        actionKind: 'RICH_CLOSED_EXERCISE',
        knowledgeUnitId: 'unit-1',
        reasonCode: 'CHECK_UNDERSTANDING',
        questions: [{ id: 'question-1' }],
        correction: { correctChoiceId: 'choice-1' },
        widget: { type: 'free_widget' },
      },
    });
    const observer = createObserver();

    await expect(
      new GenkitRevisionCoachNextActionGenerator(observer).generate({
        ...baseInput(),
        availableActions: [
          'DIAGNOSTIC_QUIZ',
          'OPEN_QUESTION',
          'RICH_CLOSED_EXERCISE',
        ],
      }),
    ).rejects.toThrow();

    expect(getObservedObservation(observer)).toMatchObject({
      status: 'error',
      errorCode: 'REVISION_COACH_INVALID_OUTPUT',
    });
  });

  it('observes provider errors with a controlled failure code', async () => {
    process.env.AI_PROVIDER = 'google';
    mockGenerate.mockRejectedValue(new Error('raw provider stack'));
    const observer = createObserver();

    await expect(
      new GenkitRevisionCoachNextActionGenerator(observer).generate(
        baseInput(),
      ),
    ).rejects.toThrow('raw provider stack');

    expect(getObservedObservation(observer)).toMatchObject({
      status: 'error',
      errorCode: 'REVISION_COACH_FAILED',
    });
    expect(JSON.stringify(observer.observe.mock.calls)).not.toContain(
      'raw provider stack',
    );
  });
});

function baseInput() {
  return {
    studentId: 'student-1',
    sessionId: 'revision-session-1',
    subjectId: 'subject-1',
    documentId: 'document-1',
    sessionKnowledgeUnitId: 'unit-1',
    history: [
      {
        kind: 'DIAGNOSTIC_QUIZ' as const,
        status: 'READY' as const,
        displayOrder: 0,
        activitySessionId: 'quiz-session-1',
        knowledgeUnitId: 'unit-1',
      },
    ],
    availableActions: ['DIAGNOSTIC_QUIZ', 'OPEN_QUESTION'] as const,
    allowedKnowledgeUnitIds: ['unit-1', 'unit-2'],
  };
}

function createObserver(): jest.Mocked<AiGenerationObserver> {
  return {
    observe: jest.fn(),
  };
}

function getObservedObservation(
  observer: jest.Mocked<AiGenerationObserver>,
): AiGenerationObservation {
  const [[observation]] = observer.observe.mock.calls;

  if (!observation) {
    throw new Error('Expected observation');
  }

  return observation;
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
```

### src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.ts

```ts
import { Injectable } from '@nestjs/common';
import {
  RevisionSessionActionKind,
  RevisionSessionActionStatus,
  RevisionSessionStatus,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type {
  RevisionSessionActionKindValue,
  RevisionSessionActionStatusValue,
  RevisionSessionResponseDto,
  RevisionSessionStatusValue,
} from '../domain/revision-session.entity';
import type {
  RevisionSessionsRepository,
  RevisionSessionPlanningContext,
  RevisionSessionStartContext,
} from '../application/revision-sessions.repository';

type RevisionSessionRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  documentId: string | null;
  knowledgeUnitId: string | null;
  status: RevisionSessionStatusValue;
  createdAt: Date;
  completedAt: Date | null;
  actions?: RevisionSessionActionRecord[];
};

type RevisionSessionActionRecord = {
  id: string;
  sessionId: string;
  studentId: string;
  subjectId: string;
  kind: RevisionSessionActionKindValue;
  status: RevisionSessionActionStatusValue;
  displayOrder: number;
  activitySessionId: string | null;
  documentId: string | null;
  knowledgeUnitId: string | null;
  createdAt: Date;
  completedAt: Date | null;
  activitySession?: {
    knowledgeUnitId: string;
  } | null;
};

@Injectable()
export class PrismaRevisionSessionsRepository implements RevisionSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ensureStartContext(input: {
    studentId: string;
    subjectId: string;
    documentId?: string;
    knowledgeUnitId?: string;
  }): Promise<RevisionSessionStartContext> {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: input.subjectId,
        studentId: input.studentId,
      },
      select: {
        id: true,
      },
    });

    if (!subject) {
      throw new Error('Revision subject not found');
    }

    let documentId: string | null = null;

    if (input.documentId) {
      const document = await this.prisma.document.findFirst({
        where: {
          id: input.documentId,
          subjectId: input.subjectId,
          studentId: input.studentId,
        },
        select: {
          id: true,
        },
      });

      if (!document) {
        throw new Error('Revision document not found');
      }

      documentId = document.id;
    }

    let knowledgeUnitId: string | null = null;
    let knowledgeUnitTitle: string | null = null;

    if (input.knowledgeUnitId) {
      const knowledgeUnit = await this.prisma.knowledgeUnit.findFirst({
        where: {
          id: input.knowledgeUnitId,
          subjectId: input.subjectId,
          ...(documentId ? { documentId } : {}),
          subject: {
            studentId: input.studentId,
          },
        },
        select: {
          id: true,
          documentId: true,
          title: true,
        },
      });

      if (!knowledgeUnit) {
        throw new Error('Revision knowledge unit not found');
      }

      knowledgeUnitId = knowledgeUnit.id;
      knowledgeUnitTitle = knowledgeUnit.title;
      documentId = documentId ?? knowledgeUnit.documentId;
    }

    return {
      subjectId: input.subjectId,
      documentId,
      knowledgeUnitId,
      knowledgeUnitTitle,
    };
  }

  async createWithInitialAction(input: {
    studentId: string;
    subjectId: string;
    documentId: string | null;
    knowledgeUnitId: string | null;
    action: {
      kind: RevisionSessionActionKindValue;
      status: RevisionSessionActionStatusValue;
      displayOrder: number;
      activitySessionId: string | null;
      documentId: string | null;
      knowledgeUnitId: string | null;
    };
  }): Promise<RevisionSessionResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.revisionSession.create({
        data: {
          studentId: input.studentId,
          subjectId: input.subjectId,
          documentId: input.documentId,
          knowledgeUnitId: input.knowledgeUnitId,
          status: RevisionSessionStatus.STARTED,
        },
      });
      const action = await tx.revisionSessionAction.create({
        data: {
          sessionId: session.id,
          studentId: input.studentId,
          subjectId: input.subjectId,
          kind: toPrismaActionKind(input.action.kind),
          status: toPrismaActionStatus(input.action.status),
          displayOrder: input.action.displayOrder,
          activitySessionId: input.action.activitySessionId,
          documentId: input.action.documentId,
          knowledgeUnitId: input.action.knowledgeUnitId,
        },
      });

      return toRevisionSessionResponse(session, [action]);
    });
  }

  async findByIdForStudent(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RevisionSessionResponseDto> {
    const session = (await this.prisma.revisionSession.findFirst({
      where: {
        id: input.sessionId,
        studentId: input.studentId,
      },
      include: {
        actions: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    })) as RevisionSessionRecord | null;

    if (!session) {
      throw new Error('Revision session not found');
    }

    return toRevisionSessionResponse(session, session.actions ?? []);
  }

  async findPlanningContextByIdForStudent(input: {
    studentId: string;
    sessionId: string;
  }): Promise<RevisionSessionPlanningContext> {
    const session = (await this.prisma.revisionSession.findFirst({
      where: {
        id: input.sessionId,
        studentId: input.studentId,
      },
      include: {
        actions: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            activitySession: {
              select: { knowledgeUnitId: true },
            },
          },
        },
      },
    })) as RevisionSessionRecord | null;

    if (!session) {
      throw new Error('Revision session not found');
    }

    const knowledgeUnits = await this.prisma.knowledgeUnit.findMany({
      where: {
        subjectId: session.subjectId,
        subject: { studentId: input.studentId },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      take: 20,
      select: { id: true, documentId: true, title: true },
    });

    return {
      session: {
        id: session.id,
        status: session.status,
        subjectId: session.subjectId,
        documentId: session.documentId,
        knowledgeUnitId: session.knowledgeUnitId,
      },
      actions: (session.actions ?? []).map((action) => ({
        kind: action.kind,
        status: action.status,
        displayOrder: action.displayOrder,
        activitySessionId: action.activitySessionId,
        knowledgeUnitId:
          action.knowledgeUnitId ??
          action.activitySession?.knowledgeUnitId ??
          null,
      })),
      allowedKnowledgeUnitIds: knowledgeUnits.map((unit) => unit.id),
      allowedKnowledgeUnits: knowledgeUnits.map((unit) => ({
        id: unit.id,
        documentId: unit.documentId,
        title: unit.title,
      })),
    };
  }

  async appendAction(input: {
    studentId: string;
    sessionId: string;
    action: {
      kind: RevisionSessionActionKindValue;
      status: RevisionSessionActionStatusValue;
      activitySessionId: string | null;
      documentId: string | null;
      knowledgeUnitId: string | null;
    };
  }): Promise<RevisionSessionResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.revisionSession.findFirst({
        where: {
          id: input.sessionId,
          studentId: input.studentId,
        },
      });

      if (!session) {
        throw new Error('Revision session not found');
      }

      const maxOrder = await tx.revisionSessionAction.aggregate({
        where: { sessionId: input.sessionId },
        _max: { displayOrder: true },
      });
      const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;

      await tx.revisionSessionAction.create({
        data: {
          sessionId: session.id,
          studentId: input.studentId,
          subjectId: session.subjectId,
          kind: toPrismaActionKind(input.action.kind),
          status: toPrismaActionStatus(input.action.status),
          displayOrder,
          activitySessionId: input.action.activitySessionId,
          documentId: input.action.documentId,
          knowledgeUnitId: input.action.knowledgeUnitId,
        },
      });

      const updatedSession = (await tx.revisionSession.findFirst({
        where: {
          id: input.sessionId,
          studentId: input.studentId,
        },
        include: {
          actions: {
            orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      })) as RevisionSessionRecord | null;

      if (!updatedSession) {
        throw new Error('Revision session not found');
      }

      return toRevisionSessionResponse(
        updatedSession,
        updatedSession.actions ?? [],
      );
    });
  }
}

function toRevisionSessionResponse(
  session: RevisionSessionRecord,
  actions: RevisionSessionActionRecord[],
): RevisionSessionResponseDto {
  const history = actions.map((action) => ({
    id: action.id,
    kind: action.kind,
    status: action.status,
    displayOrder: action.displayOrder,
    activitySessionId: action.activitySessionId,
    documentId: action.documentId,
    knowledgeUnitId: action.knowledgeUnitId,
  }));
  const currentActionRecord = actions.length
    ? actions[actions.length - 1]
    : undefined;
  const currentAction = currentActionRecord
    ? {
        id: currentActionRecord.id,
        kind: currentActionRecord.kind,
        status: currentActionRecord.status,
        displayOrder: currentActionRecord.displayOrder,
        activitySessionId: currentActionRecord.activitySessionId,
        documentId: currentActionRecord.documentId,
        knowledgeUnitId: currentActionRecord.knowledgeUnitId,
        payload: toMinimalActionPayload(currentActionRecord),
      }
    : null;

  return {
    session: {
      id: session.id,
      status: session.status,
      subjectId: session.subjectId,
      documentId: session.documentId,
      knowledgeUnitId: session.knowledgeUnitId,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
    },
    currentAction,
    history,
  };
}

function toMinimalActionPayload(action: RevisionSessionActionRecord) {
  if (action.kind === 'RICH_CLOSED_EXERCISE') {
    return {
      type: 'rich_closed_exercise' as const,
      subjectId: action.subjectId,
      documentId: action.documentId,
      knowledgeUnitId: action.knowledgeUnitId ?? '',
      reason: 'Questions riches recommandées pour consolider cette notion.',
      estimatedMinutes: 8,
      preferredAction: 'rich_closed_exercise' as const,
    };
  }

  return {
    type:
      action.kind === 'OPEN_QUESTION'
        ? ('open_question' as const)
        : ('diagnostic_quiz' as const),
    sessionId: action.activitySessionId,
  };
}

function toPrismaActionKind(kind: RevisionSessionActionKindValue) {
  if (kind === 'OPEN_QUESTION') {
    return RevisionSessionActionKind.OPEN_QUESTION;
  }

  if (kind === 'RICH_CLOSED_EXERCISE') {
    return RevisionSessionActionKind.RICH_CLOSED_EXERCISE;
  }

  return RevisionSessionActionKind.DIAGNOSTIC_QUIZ;
}

function toPrismaActionStatus(status: RevisionSessionActionStatusValue) {
  if (status === 'COMPLETED') {
    return RevisionSessionActionStatus.COMPLETED;
  }

  if (status === 'FAILED') {
    return RevisionSessionActionStatus.FAILED;
  }

  return RevisionSessionActionStatus.READY;
}
```

### src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.spec.ts

```ts
import { PrismaRevisionSessionsRepository } from './prisma-revision-sessions.repository';

describe('PrismaRevisionSessionsRepository', () => {
  it('validates subject, document and knowledge unit ownership', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.document.findFirst.mockResolvedValue({ id: 'document-1' });
    prisma.knowledgeUnit.findFirst.mockResolvedValue({
      id: 'unit-1',
      documentId: 'document-1',
      title: 'Notion 1',
    });

    await expect(
      repository.ensureStartContext({
        studentId: 'student-1',
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      }),
    ).resolves.toEqual({
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      knowledgeUnitTitle: 'Notion 1',
    });
    expect(prisma.subject.findFirst).toHaveBeenCalledWith({
      where: { id: 'subject-1', studentId: 'student-1' },
      select: { id: true },
    });
  });

  it('rejects cross-student context as not found', async () => {
    const { repository } = createRepository();

    await expect(
      repository.ensureStartContext({
        studentId: 'student-2',
        subjectId: 'subject-1',
      }),
    ).rejects.toThrow('Revision subject not found');
  });

  it('persists a session and initial action in one transaction', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.create.mockResolvedValue(revisionSessionRecord());
    prisma.revisionSessionAction.create.mockResolvedValue(actionRecord());

    const result = await repository.createWithInitialAction({
      studentId: 'student-1',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      action: {
        kind: 'OPEN_QUESTION',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: 'activity-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    });

    expect(prisma.revisionSession.create).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        status: 'STARTED',
      },
    });
    expect(prisma.revisionSessionAction.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'revision-session-1',
        studentId: 'student-1',
        subjectId: 'subject-1',
        kind: 'OPEN_QUESTION',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: 'activity-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    });
    expect(result.history).toHaveLength(1);
    expect(result.currentAction?.kind).toBe('OPEN_QUESTION');
  });

  it('persists a rich closed session action without activity session id', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.create.mockResolvedValue(revisionSessionRecord());
    prisma.revisionSessionAction.create.mockResolvedValue(
      actionRecord({
        kind: 'RICH_CLOSED_EXERCISE',
        activitySessionId: null,
      }),
    );

    const result = await repository.createWithInitialAction({
      studentId: 'student-1',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      action: {
        kind: 'RICH_CLOSED_EXERCISE',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: null,
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    });

    expect(prisma.revisionSessionAction.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'revision-session-1',
        studentId: 'student-1',
        subjectId: 'subject-1',
        kind: 'RICH_CLOSED_EXERCISE',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: null,
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    });
    expect(result.currentAction?.kind).toBe('RICH_CLOSED_EXERCISE');
    expect(result.currentAction?.payload).toEqual({
      type: 'rich_closed_exercise',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      reason: 'Questions riches recommandées pour consolider cette notion.',
      estimatedMinutes: 8,
      preferredAction: 'rich_closed_exercise',
    });
  });

  it('loads an owned session with sorted action history', async () => {
    const { prisma, repository } = createRepository();
    prisma.revisionSession.findFirst.mockResolvedValue({
      ...revisionSessionRecord(),
      actions: [actionRecord()],
    });

    const result = await repository.findByIdForStudent({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(prisma.revisionSession.findFirst).toHaveBeenCalledWith({
      where: { id: 'revision-session-1', studentId: 'student-1' },
      include: {
        actions: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    expect(result.currentAction?.payload).toEqual({
      type: 'open_question',
      sessionId: 'activity-session-1',
    });
  });

  it('loads a planning context with action activity knowledge units and candidates', async () => {
    const { prisma, repository } = createRepository();
    prisma.revisionSession.findFirst.mockResolvedValue({
      ...revisionSessionRecord(),
      actions: [
        {
          ...actionRecord(),
          knowledgeUnitId: null,
          activitySession: { knowledgeUnitId: 'unit-from-activity' },
        },
      ],
    });
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      { id: 'unit-1', documentId: 'document-1', title: 'Notion 1' },
      {
        id: 'unit-from-activity',
        documentId: 'document-2',
        title: 'Notion 2',
      },
    ]);

    const result = await repository.findPlanningContextByIdForStudent({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });

    expect(prisma.revisionSession.findFirst).toHaveBeenCalledWith({
      where: { id: 'revision-session-1', studentId: 'student-1' },
      include: {
        actions: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            activitySession: {
              select: { knowledgeUnitId: true },
            },
          },
        },
      },
    });
    expect(prisma.knowledgeUnit.findMany).toHaveBeenCalledWith({
      where: {
        subjectId: 'subject-1',
        subject: { studentId: 'student-1' },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      take: 20,
      select: { id: true, documentId: true, title: true },
    });
    expect(result.actions[0]?.knowledgeUnitId).toBe('unit-from-activity');
    expect(result.allowedKnowledgeUnitIds).toEqual([
      'unit-1',
      'unit-from-activity',
    ]);
    expect(result.allowedKnowledgeUnits).toEqual([
      { id: 'unit-1', documentId: 'document-1', title: 'Notion 1' },
      {
        id: 'unit-from-activity',
        documentId: 'document-2',
        title: 'Notion 2',
      },
    ]);
  });

  it('appends an action with the next display order inside a transaction', async () => {
    const { prisma, repository } = createRepository();
    prisma.$transaction.mockImplementation((callback: TransactionCallback) =>
      callback(prisma),
    );
    prisma.revisionSession.findFirst
      .mockResolvedValueOnce(revisionSessionRecord())
      .mockResolvedValueOnce({
        ...revisionSessionRecord(),
        actions: [
          actionRecord(),
          { ...actionRecord(), id: 'action-2', displayOrder: 1 },
        ],
      });
    prisma.revisionSessionAction.aggregate.mockResolvedValue({
      _max: { displayOrder: 0 },
    });
    prisma.revisionSessionAction.create.mockResolvedValue({
      ...actionRecord(),
      id: 'action-2',
      displayOrder: 1,
      activitySessionId: 'quiz-session-2',
      kind: 'DIAGNOSTIC_QUIZ',
      documentId: null,
      knowledgeUnitId: null,
    });

    const result = await repository.appendAction({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
      action: {
        kind: 'DIAGNOSTIC_QUIZ',
        status: 'READY',
        activitySessionId: 'quiz-session-2',
        documentId: null,
        knowledgeUnitId: null,
      },
    });

    expect(prisma.revisionSessionAction.aggregate).toHaveBeenCalledWith({
      where: { sessionId: 'revision-session-1' },
      _max: { displayOrder: true },
    });
    expect(prisma.revisionSessionAction.create).toHaveBeenCalledWith({
      data: {
        sessionId: 'revision-session-1',
        studentId: 'student-1',
        subjectId: 'subject-1',
        kind: 'DIAGNOSTIC_QUIZ',
        status: 'READY',
        displayOrder: 1,
        activitySessionId: 'quiz-session-2',
        documentId: null,
        knowledgeUnitId: null,
      },
    });
    expect(result.history).toHaveLength(2);
    expect(result.currentAction?.displayOrder).toBe(1);
  });
});

type PrismaRevisionSessionsMock = ReturnType<typeof createPrismaMock>;
type TransactionCallback = (tx: PrismaRevisionSessionsMock) => Promise<unknown>;

function createRepository() {
  const prisma = createPrismaMock();

  return {
    prisma,
    repository: new PrismaRevisionSessionsRepository(prisma as never),
  };
}

function createPrismaMock() {
  const prisma = {
    subject: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    document: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    knowledgeUnit: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(),
    },
    revisionSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    revisionSessionAction: {
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  return prisma;
}

function revisionSessionRecord() {
  return {
    id: 'revision-session-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    status: 'STARTED',
    createdAt: new Date('2026-06-15T10:00:00.000Z'),
    updatedAt: new Date('2026-06-15T10:00:00.000Z'),
    completedAt: null,
  };
}

function actionRecord(
  overrides: Partial<ReturnType<typeof actionRecordShape>> = {},
) {
  return { ...actionRecordShape(), ...overrides };
}

function actionRecordShape() {
  return {
    id: 'action-1',
    sessionId: 'revision-session-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    kind: 'OPEN_QUESTION',
    status: 'READY',
    displayOrder: 0,
    activitySessionId: 'activity-session-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    createdAt: new Date('2026-06-15T10:00:00.000Z'),
    completedAt: null,
  };
}
```

### src/modules/revision-sessions/interfaces/revision-sessions.controller.ts

```ts
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import type { RevisionSessionPreferredAction } from '../domain/revision-session.entity';
import { GetRevisionSessionUseCase } from '../application/get-revision-session.use-case';
import { RequestNextRevisionSessionActionUseCase } from '../application/request-next-revision-session-action.use-case';
import { StartRevisionSessionUseCase } from '../application/start-revision-session.use-case';

class StartRevisionSessionDto {
  subjectId!: string;
  documentId?: string;
  knowledgeUnitId?: string;
  preferredAction?: string;
}

interface ValidatedStartRevisionSessionBody {
  subjectId: string;
  documentId?: string;
  knowledgeUnitId?: string;
  preferredAction?: RevisionSessionPreferredAction;
}

@Controller('revision-sessions')
@UseGuards(FirebaseAuthGuard)
export class RevisionSessionsController {
  constructor(
    private readonly startRevisionSession: StartRevisionSessionUseCase,
    private readonly getRevisionSession: GetRevisionSessionUseCase,
    private readonly requestNextAction: RequestNextRevisionSessionActionUseCase,
  ) {}

  @Post()
  start(
    @CurrentStudent() student: { id: string },
    @Body() body: StartRevisionSessionDto,
  ) {
    const validatedBody = validateStartRevisionSessionBody(body);

    return this.startRevisionSession
      .execute({
        studentId: student.id,
        subjectId: validatedBody.subjectId,
        documentId: validatedBody.documentId,
        knowledgeUnitId: validatedBody.knowledgeUnitId,
        preferredAction: validatedBody.preferredAction,
      })
      .catch((error: unknown) => {
        normalizeRevisionSessionError(error);
      });
  }

  @Get(':sessionId')
  get(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Revision session id',
    );

    return this.getRevisionSession
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
      })
      .catch((error: unknown) => {
        normalizeRevisionSessionError(error);
      });
  }

  @Post(':sessionId/next-action')
  nextAction(
    @CurrentStudent() student: { id: string },
    @Param('sessionId') sessionId: string,
  ) {
    const validatedSessionId = validateRequiredId(
      sessionId,
      'Revision session id',
    );

    return this.requestNextAction
      .execute({
        studentId: student.id,
        sessionId: validatedSessionId,
      })
      .catch((error: unknown) => {
        normalizeRevisionSessionError(error);
      });
  }
}

function validateStartRevisionSessionBody(
  input: StartRevisionSessionDto,
): ValidatedStartRevisionSessionBody {
  return {
    subjectId: validateRequiredId(input?.subjectId, 'Subject id'),
    documentId: validateOptionalId(input?.documentId, 'Document id'),
    knowledgeUnitId: validateOptionalId(
      input?.knowledgeUnitId,
      'Knowledge unit id',
    ),
    preferredAction: validatePreferredAction(input?.preferredAction),
  };
}

function validateRequiredId(input: unknown, label: string): string {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new BadRequestException(`${label} is required`);
  }

  return input.trim();
}

function validateOptionalId(input: unknown, label: string): string | undefined {
  if (input === undefined) {
    return undefined;
  }

  return validateRequiredId(input, label);
}

function validatePreferredAction(
  input: unknown,
): RevisionSessionPreferredAction | undefined {
  if (input === undefined) {
    return undefined;
  }

  if (typeof input !== 'string') {
    throw new BadRequestException('Revision session preferred action invalid');
  }

  const normalized = input.trim();

  if (
    normalized !== 'diagnostic_quiz' &&
    normalized !== 'open_question' &&
    normalized !== 'rich_closed_exercise'
  ) {
    throw new BadRequestException('Revision session preferred action invalid');
  }

  return normalized;
}

function normalizeRevisionSessionError(error: unknown): never {
  if (error instanceof Error) {
    if (
      error.message === 'Revision subject not found' ||
      error.message === 'Revision document not found' ||
      error.message === 'Revision knowledge unit not found' ||
      error.message === 'Revision session not found'
    ) {
      throw new NotFoundException(error.message);
    }

    if (
      error.message ===
        'Open question revision session requires a knowledge unit' ||
      error.message === 'Rich closed revision session requires a knowledge unit'
    ) {
      throw new UnprocessableEntityException(error.message);
    }

    if (error.message === 'Revision coach no action available') {
      throw new UnprocessableEntityException(error.message);
    }

    if (error.message === 'Revision session is not started') {
      throw new ConflictException(error.message);
    }
  }

  throw error;
}
```

### src/modules/revision-sessions/interfaces/revision-sessions.controller.spec.ts

```ts
import { INestApplication } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../../app.module';
import { TOKEN_VERIFIER } from '../../auth/application/token-verifier';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import { GetRevisionSessionUseCase } from '../application/get-revision-session.use-case';
import { RequestNextRevisionSessionActionUseCase } from '../application/request-next-revision-session-action.use-case';
import { StartRevisionSessionUseCase } from '../application/start-revision-session.use-case';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type { RevisionSessionResponseDto } from '../domain/revision-session.entity';

jest.mock('firebase-admin/app', () => ({
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(),
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

describe('RevisionSessionsController', () => {
  let app: INestApplication<App>;
  let startRevisionSession: { execute: jest.Mock };
  let getRevisionSession: { execute: jest.Mock };
  let requestNextAction: { execute: jest.Mock };

  beforeEach(async () => {
    startRevisionSession = {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    };
    getRevisionSession = {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    };
    requestNextAction = {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context
            .switchToHttp()
            .getRequest<{ student?: { id: string } }>();
          request.student = { id: 'student-1' };
          return true;
        },
      })
      .overrideProvider(TOKEN_VERIFIER)
      .useValue({ verify: jest.fn() })
      .overrideProvider(StartRevisionSessionUseCase)
      .useValue(startRevisionSession)
      .overrideProvider(GetRevisionSessionUseCase)
      .useValue(getRevisionSession)
      .overrideProvider(RequestNextRevisionSessionActionUseCase)
      .useValue(requestNextAction)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('creates a deterministic revision session for the current student', async () => {
    const response = await request(app.getHttpServer())
      .post('/revision-sessions')
      .send({
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        preferredAction: 'open_question',
      })
      .expect(201);

    expect(startRevisionSession.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      preferredAction: 'open_question',
    });
    const body = response.body as RevisionSessionResponseDto;
    expect(body.currentAction?.kind).toBe('OPEN_QUESTION');
    expect(JSON.stringify(response.body)).not.toContain('correctChoiceId');
    expect(JSON.stringify(response.body)).not.toContain('modelAnswer');
  });

  it('accepts rich closed preferred action as a bounded session action', async () => {
    startRevisionSession.execute.mockResolvedValueOnce(
      richClosedRevisionSessionResponse(),
    );

    const response = await request(app.getHttpServer())
      .post('/revision-sessions')
      .send({
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        preferredAction: 'rich_closed_exercise',
      })
      .expect(201);

    expect(startRevisionSession.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      preferredAction: 'rich_closed_exercise',
    });
    const body = response.body as RevisionSessionResponseDto;
    expect(body.currentAction?.kind).toBe('RICH_CLOSED_EXERCISE');
    expect(body.currentAction?.activitySessionId).toBeNull();
    expect(body.currentAction?.payload).toEqual({
      type: 'rich_closed_exercise',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      reason: 'Questions riches recommandées.',
      estimatedMinutes: 8,
      preferredAction: 'rich_closed_exercise',
    });
    expect(JSON.stringify(response.body)).not.toContain('questions');
    expect(JSON.stringify(response.body)).not.toContain('correction');
  });

  it('rejects malformed create payloads before calling the use case', async () => {
    await request(app.getHttpServer())
      .post('/revision-sessions')
      .send({ subjectId: '', preferredAction: 'open_question' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/revision-sessions')
      .send({ subjectId: 'subject-1', preferredAction: 'chat' })
      .expect(400);

    expect(startRevisionSession.execute).not.toHaveBeenCalled();
  });

  it('maps impossible open question actions to 422', async () => {
    startRevisionSession.execute.mockRejectedValue(
      new Error('Open question revision session requires a knowledge unit'),
    );

    await request(app.getHttpServer())
      .post('/revision-sessions')
      .send({ subjectId: 'subject-1', preferredAction: 'open_question' })
      .expect(422);
  });

  it('maps impossible rich closed actions to 422', async () => {
    startRevisionSession.execute.mockRejectedValue(
      new Error('Rich closed revision session requires a knowledge unit'),
    );

    await request(app.getHttpServer())
      .post('/revision-sessions')
      .send({
        subjectId: 'subject-1',
        preferredAction: 'rich_closed_exercise',
      })
      .expect(422);
  });

  it('loads an owned revision session without creating a new action', async () => {
    await request(app.getHttpServer())
      .get('/revision-sessions/revision-session-1')
      .expect(200);

    expect(getRevisionSession.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });
    expect(startRevisionSession.execute).not.toHaveBeenCalled();
  });

  it('maps unknown sessions to 404', async () => {
    getRevisionSession.execute.mockRejectedValue(
      new Error('Revision session not found'),
    );

    await request(app.getHttpServer())
      .get('/revision-sessions/missing-session')
      .expect(404);
  });

  it('requests a bounded next action for the current student', async () => {
    await request(app.getHttpServer())
      .post('/revision-sessions/revision-session-1/next-action')
      .send({ message: 'ignore me' })
      .expect(201);

    expect(requestNextAction.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      sessionId: 'revision-session-1',
    });
    expect(JSON.stringify(requestNextAction.execute.mock.calls)).not.toContain(
      'ignore me',
    );
  });

  it('maps next action session and planning errors', async () => {
    requestNextAction.execute.mockRejectedValueOnce(
      new Error('Revision session not found'),
    );

    await request(app.getHttpServer())
      .post('/revision-sessions/missing-session/next-action')
      .expect(404);

    requestNextAction.execute.mockRejectedValueOnce(
      new Error('Revision coach no action available'),
    );

    await request(app.getHttpServer())
      .post('/revision-sessions/revision-session-1/next-action')
      .expect(422);
  });
});

function revisionSessionResponse() {
  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      createdAt: new Date('2026-06-15T10:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-1',
      kind: 'OPEN_QUESTION',
      status: 'READY',
      displayOrder: 0,
      activitySessionId: 'open-session-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      payload: {
        type: 'open_question',
        sessionId: 'open-session-1',
      },
    },
    history: [
      {
        id: 'action-1',
        kind: 'OPEN_QUESTION',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: 'open-session-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    ],
  };
}

function richClosedRevisionSessionResponse() {
  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      createdAt: new Date('2026-06-15T10:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-1',
      kind: 'RICH_CLOSED_EXERCISE',
      status: 'READY',
      displayOrder: 0,
      activitySessionId: null,
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      payload: {
        type: 'rich_closed_exercise',
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        reason: 'Questions riches recommandées.',
        estimatedMinutes: 8,
        preferredAction: 'rich_closed_exercise',
      },
    },
    history: [
      {
        id: 'action-1',
        kind: 'RICH_CLOSED_EXERCISE',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: null,
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
      },
    ],
  };
}
```
