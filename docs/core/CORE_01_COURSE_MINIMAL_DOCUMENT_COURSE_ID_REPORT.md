# CORE-01 — Course minimal + Document.courseId

## 1. Résumé

Le lot CORE-01 ajoute la colonne vertébrale backend minimale du MVP Core côté API NestJS : modèle Prisma `Course`, rattachement nullable `Document.courseId`, préparation compatible de `RevisionSession.courseId` et `RevisionSession.mode`, module interne `courses`, use cases applicatifs, repository Prisma, tests d’ownership et backfill dry-run. Aucun endpoint public Course n’a été exposé et aucun frontend n’a été modifié.

## 2. Audit initial

- `Subject` est un modèle possédé par `studentId`, avec contrainte `@@unique([id, studentId])`, ce qui permet des relations Prisma composites sûres depuis les modèles possédés.
- `Document` était relié directement à `Subject` via `(subjectId, studentId)` et à plusieurs artefacts de révision. Avant CORE-01, il n’avait aucun `courseId`.
- `RevisionSession` référençait `subjectId`, `documentId?`, `knowledgeUnitId?`, mais pas encore `courseId` ni `mode`.
- Les repositories existants vérifient majoritairement l’ownership avec `studentId` dans les requêtes Prisma : `SubjectsRepository.findByIdForStudent`, `PrismaDocumentsRepository.create/find...`, `PrismaRevisionSessionsRepository.ensureStartContext/findByIdForStudent`.
- L’upload PDF existant `/documents/course-pdf` crée toujours un `Document` via `UploadCoursePdfUseCase` puis `DocumentsRepository.create`; ce lot ne modifie pas ce flow, donc les nouveaux documents restent `courseId = null`.
- Les tests existants couvrent déjà beaucoup de cross-student côté documents/sessions. CORE-01 ajoute des tests explicites Course pour cross-student, cross-subject et suppression sans suppression implicite de documents.
- La cohérence `Document.subjectId == Course.subjectId` n’est pas imposée par la relation simple `Document.courseId -> Course.id`; elle est imposée dans `PrismaCoursesRepository.attachDocumentToCourse` et testée.

## 3. Préflight Git

- Repo : `revision_project_api` (`/Users/karim/Project/app-révision/api`)
- Branche : `main`
- Status initial observé avant implémentation CORE-01 : clean (`## main...origin/main`)
- Derniers commits au moment du rapport :
  - `79d665c 025: Audit readiness V1`
  - `232a1b3 023: Ajout du runbook de démonstration V1`
  - `493888e 022: Intégration des QCM avec choix d'images`
  - `5441805 021: Intégration des QCM de calcul`
  - `07f6e00 020: Intégration de l'étiquetage de diagrammes`
- Aucun commit, amend, merge, rebase, push ou tag n’a été fait.
- Repo frontend `revision_project_app` : inspecté en contexte documentaire CORE, non modifié.

## 4. Fichiers créés/modifiés/supprimés

### Créés
- `prisma/migrations/20260618120000_add_course_and_document_course_id/migration.sql`
- `src/modules/courses/application/backfill-courses-from-documents.use-case.ts`
- `src/modules/courses/application/course-use-cases.spec.ts`
- `src/modules/courses/application/courses.repository.ts`
- `src/modules/courses/application/create-course.use-case.ts`
- `src/modules/courses/application/delete-course.use-case.ts`
- `src/modules/courses/application/get-course.use-case.ts`
- `src/modules/courses/application/list-subject-courses.use-case.ts`
- `src/modules/courses/courses.module.ts`
- `src/modules/courses/domain/course.entity.ts`
- `src/modules/courses/infrastructure/prisma-courses.repository.spec.ts`
- `src/modules/courses/infrastructure/prisma-courses.repository.ts`
- `docs/core/CORE_01_COURSE_MINIMAL_DOCUMENT_COURSE_ID_REPORT.md`

### Modifiés
- `prisma/schema.prisma`
- `src/app.module.ts`
- `src/modules/revision-sessions/application/revision-sessions.repository.ts`
- `src/modules/revision-sessions/domain/revision-session.entity.ts`
- `src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.spec.ts`
- `src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.ts`

### Supprimés
- Aucun fichier supprimé.

## 5. Modèle Prisma ajouté

- `Course` possède `studentId`, `subjectId`, `title`, `description?`, `chapterLabel?`, `estimatedMinutes?`, `displayOrder`, timestamps et relations vers `StudentProfile`, `Subject`, `Document[]`, `RevisionSession[]`.
- `Document.courseId` est nullable : les documents existants et l’upload actuel restent valides avec `courseId = null`.
- `Subject.courses` et `StudentProfile.courses` sont ajoutés.
- `RevisionSession.courseId` est nullable et `RevisionSession.mode` vaut `QUICK` par défaut via enum `RevisionSessionMode`.
- Pas de `CourseSource`, pas d’`iconKey`, pas de `colorKey`, pas de contrainte unique `[subjectId, title]`, pas de contrainte unique `[courseId, displayOrder]`.

## 6. Migration créée

Migration : `prisma/migrations/20260618120000_add_course_and_document_course_id/migration.sql`.

- Migration additive : création du type enum, table `Course`, colonnes nullable `Document.courseId` et `RevisionSession.courseId`, colonne `RevisionSession.mode` avec défaut `QUICK`, index et clés étrangères.
- Aucun backfill n’est appliqué par la migration.
- Aucune donnée n’est supprimée.
- La migration a été écrite sans exécuter de migration contre une base de production.

## 7. Use cases et repository

- `CreateCourseUseCase` valide les entrées, trim le titre et les champs optionnels, puis crée un cours pour une matière possédée.
- `ListSubjectCoursesUseCase` liste les cours d’une matière possédée, triés par `displayOrder` puis `createdAt`.
- `GetCourseUseCase` retourne un cours uniquement pour son étudiant propriétaire.
- `DeleteCourseUseCase` supprime uniquement un cours vide. Le repository refuse les cours avec documents via `CourseContainsDocumentsError` avec `statusCode = 409` pour préparer CORE-02.
- `BackfillCoursesFromDocumentsDryRunUseCase` délègue au dry-run repository et n’écrit pas en base.
- `PrismaCoursesRepository.attachDocumentToCourse` est préparé pour les futurs lots, mais non exposé publiquement. Il vérifie étudiant + matière avant d’écrire `Document.courseId`.
- `backfillFromExistingDocuments()` existe comme capacité explicite mais rejette toujours avec une erreur CORE-01 : seul le dry-run est actif.

## 8. Backfill dry-run

- Le dry-run recherche uniquement les documents `COURSE_PDF` avec `courseId = null`.
- Il calcule un titre de cours depuis le `fileName`, sans extension, avec `_`/`-` remplacés par des espaces.
- Il retourne les compteurs `documentsWithoutCourseCount`, `coursesToCreateCount`, `documentsToAttachCount` et une liste d’items proposés.
- Il ne crée aucun cours, ne modifie aucun document, ne supprime rien.
- L’idempotence du dry-run est assurée par une lecture bornée sur `courseId = null`.

## 9. Compatibilité documents et sessions

- `UploadCoursePdfUseCase` et `DocumentsRepository.create` n’ont pas été modifiés : les uploads existants continuent à créer des documents sans cours.
- Les anciennes sessions restent compatibles avec `courseId = null`.
- `PrismaRevisionSessionsRepository.createWithInitialAction` conserve le flow existant et fixe explicitement `mode = QUICK`, aligné avec le défaut Prisma.
- Les DTO de session exposent maintenant `courseId` et `mode`, sans retirer les champs existants.

## 10. Tests ajoutés ou renforcés

- Tests use cases Course : création trimée, validation titre, listing, get ownership, delete empty, delete avec documents refusé, dry-run sans apply.
- Tests repository Course : création avec subject owner, refus cross-student, listing trié, course cross-student non retourné, titres dupliqués autorisés, suppression sans supprimer documents, suppression refusée avec documents, attach document cohérent, refus cross-subject, refus cross-student, dry-run idempotent sans writes.
- Tests revision sessions renforcés : mode `QUICK` et `courseId = null` sur session legacy.
- Tests existants documents/subjects/revision-sessions conservés verts.

## 11. Commandes exécutées et résultats

- `npm test -- courses --runInBand` : échec attendu de pattern Jest, aucun test trouvé. Documenté comme écart de pattern.
- `npm test -- course --runInBand` : 1 suite passée, 2 tests passés, pattern trop large/non ciblé.
- `npm test -- modules/courses --runInBand` avant implémentation : échec attendu, imports Course manquants.
- `npx prisma validate` : OK, schema valide.
- `npx prisma generate` : OK, client généré localement dans `./src/generated/prisma`.
- `npm test -- modules/courses --runInBand` : OK, 2 suites passées, 19 tests passés.
- `npm test -- revision-sessions --runInBand` : OK, 6 suites passées, 41 tests passés.
- `npm test -- documents --runInBand` : OK, 9 suites passées, 63 tests passés.
- `npm test -- subjects --runInBand` : OK, 5 suites passées, 16 tests passés.
- `npm run build` : OK.
- `npm run lint:check` : premier passage KO sur lint/prettier des nouveaux tests, corrigé manuellement puis OK.
- `npm test -- --runInBand` : OK, 71 suites passées, 1 suite skip existante, 621 tests passés, 1 test skip existant.
- `npm run test:e2e -- --runInBand` : OK, 2 suites passées, 25 tests passés.
- `git diff --check` : OK avant rédaction du rapport. À relancer après le rapport final.

## 12. Validations non lancées

- Aucune migration n’a été appliquée contre une base réelle ou production.
- Aucun seed ou backfill apply n’a été lancé.
- Aucun test frontend lancé, car le frontend est hors périmètre CORE-01 et n’a pas été modifié.

## 13. Limites et risques

- Les use cases Course ne sont pas encore exposés par API publique : CORE-02 devra ajouter les controllers/DTO/auth HTTP.
- `Document.courseId` ne porte pas une contrainte composite avec `subjectId`; la cohérence est applicative, donc les futurs use cases doivent réutiliser les garde-fous repository.
- Le backfill apply est volontairement désactivé ; un futur lot devra décider s’il est vraiment nécessaire, puis le rendre transactionnel et opérable.
- `RevisionSession.courseId/mode` sont préparés mais non utilisés pour démarrer des sessions quick réelles.
- La suppression Course côté HTTP devra mapper `CourseContainsDocumentsError` en `409` dans CORE-02.

## 14. Ce qui reste pour CORE-02

- Exposer les endpoints publics Course : `GET /subjects/:subjectId/courses`, `POST /subjects/:subjectId/courses`, `GET /courses/:courseId`, suppression si vide, etc.
- Ajouter les DTO HTTP et mapping d’erreurs (`404`, `409`).
- Brancher le frontend sur les vrais cours sans fixtures.
- Définir comment l’upload sous cours appellera plus tard `attachDocumentToCourse` ou un use case dédié.
- Garder les tests cross-student/cross-subject en e2e HTTP.

## 15. Auto-review

- Pas de `CourseSource` ajouté.
- Pas d’API publique Course ajoutée.
- Pas de modification frontend.
- `Document.courseId` est nullable.
- Les anciens documents peuvent rester sans cours.
- L’upload existant n’est pas modifié.
- Les anciennes revision sessions restent compatibles.
- `RevisionSession.mode` a un défaut compatible `QUICK`.
- Suppression d’un cours avec documents refusée.
- Pas de suppression implicite de documents.
- Tests cross-student présents.
- Tests cross-subject présents.
- Backfill dry-run sans write.
- Aucun commit réalisé.

## 16. Points discutables du prompt

- Créer les use cases sans endpoints publics rend le lot moins visible immédiatement, mais c’est cohérent pour isoler Prisma/ownership avant CORE-02.
- Ajouter `RevisionSession.courseId/mode` dès CORE-01 est légèrement prématuré fonctionnellement, mais réduit le risque de migration couplée au futur start quick réel.
- Le backfill dry-run pourrait attendre CORE-02, mais l’avoir maintenant aide à auditer les données existantes avant d’exposer les cours.
- `Document.courseId` est simple et suffisant pour le MVP Core, mais il impose de ne jamais contourner les use cases pour rattacher un document.
- Certains tests d’intégration HTTP seront plus pertinents dans CORE-02 quand les routes publiques existeront.

## 17. Contenu complet des fichiers créés/modifiés/supprimés

Le présent rapport est un fichier créé, mais il n’est pas auto-inclus dans cette section afin d’éviter une récursion infinie. Tous les autres fichiers créés ou modifiés sont inclus intégralement ci-dessous. Aucun fichier supprimé.

### `prisma/migrations/20260618120000_add_course_and_document_course_id/migration.sql`

```sql
-- CORE-01: additive Course backbone for the MVP Core.
-- No data is deleted and no backfill is applied by this migration.

CREATE TYPE "RevisionSessionMode" AS ENUM ('QUICK', 'DEEP', 'EXAM');

CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "chapterLabel" TEXT,
    "estimatedMinutes" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Document" ADD COLUMN "courseId" TEXT;

ALTER TABLE "RevisionSession"
ADD COLUMN "courseId" TEXT,
ADD COLUMN "mode" "RevisionSessionMode" NOT NULL DEFAULT 'QUICK';

CREATE INDEX "Course_studentId_idx" ON "Course"("studentId");
CREATE INDEX "Course_subjectId_studentId_idx" ON "Course"("subjectId", "studentId");
CREATE INDEX "Course_subjectId_displayOrder_idx" ON "Course"("subjectId", "displayOrder");
CREATE UNIQUE INDEX "Course_id_studentId_key" ON "Course"("id", "studentId");

CREATE INDEX "Document_courseId_idx" ON "Document"("courseId");
CREATE INDEX "RevisionSession_courseId_idx" ON "RevisionSession"("courseId");

ALTER TABLE "Course"
ADD CONSTRAINT "Course_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Course"
ADD CONSTRAINT "Course_subjectId_studentId_fkey"
FOREIGN KEY ("subjectId", "studentId") REFERENCES "Subject"("id", "studentId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Document"
ADD CONSTRAINT "Document_courseId_fkey"
FOREIGN KEY ("courseId") REFERENCES "Course"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RevisionSession"
ADD CONSTRAINT "RevisionSession_courseId_studentId_fkey"
FOREIGN KEY ("courseId", "studentId") REFERENCES "Course"("id", "studentId")
ON DELETE NO ACTION ON UPDATE CASCADE;

```

### `src/modules/courses/application/backfill-courses-from-documents.use-case.ts`

```ts
import { Inject, Injectable } from '@nestjs/common';
import {
  COURSES_REPOSITORY,
  type CourseBackfillDryRunResult,
  type CoursesRepository,
} from './courses.repository';

@Injectable()
export class BackfillCoursesFromDocumentsDryRunUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(): Promise<CourseBackfillDryRunResult> {
    return this.coursesRepository.backfillFromExistingDocumentsDryRun();
  }
}

```

### `src/modules/courses/application/course-use-cases.spec.ts`

```ts
import { BackfillCoursesFromDocumentsDryRunUseCase } from './backfill-courses-from-documents.use-case';
import { CreateCourseUseCase } from './create-course.use-case';
import { DeleteCourseUseCase } from './delete-course.use-case';
import { GetCourseUseCase } from './get-course.use-case';
import { ListSubjectCoursesUseCase } from './list-subject-courses.use-case';
import type { CourseDto, CoursesRepository } from './courses.repository';

describe('Course use cases', () => {
  it('creates a course with trimmed input for an owned subject', async () => {
    const repository = createRepository();
    const created = courseRecord({ title: 'Loi normale', displayOrder: 2 });
    repository.create.mockResolvedValue(created);

    const result = await new CreateCourseUseCase(repository).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
      title: ' Loi normale ',
      description: ' Chapitre de probabilites ',
      chapterLabel: ' Chapitre 3 ',
      estimatedMinutes: 20,
    });

    expect(repository.create.mock.calls[0]).toEqual([
      {
        studentId: 'student-1',
        subjectId: 'subject-1',
        title: 'Loi normale',
        description: 'Chapitre de probabilites',
        chapterLabel: 'Chapitre 3',
        estimatedMinutes: 20,
      },
    ]);
    expect(result).toBe(created);
  });

  it('rejects invalid course creation input before reaching the repository', async () => {
    const repository = createRepository();

    await expect(
      new CreateCourseUseCase(repository).execute({
        studentId: 'student-1',
        subjectId: 'subject-1',
        title: 'x',
        estimatedMinutes: 0,
      }),
    ).rejects.toThrow('Course title must contain at least 2 characters');

    expect(repository.create.mock.calls).toHaveLength(0);
  });

  it('lists only courses for a student subject', async () => {
    const repository = createRepository();
    const courses = [
      courseRecord({ id: 'course-1', displayOrder: 0 }),
      courseRecord({ id: 'course-2', displayOrder: 1 }),
    ];
    repository.listBySubjectForStudent.mockResolvedValue(courses);

    const result = await new ListSubjectCoursesUseCase(repository).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });

    expect(repository.listBySubjectForStudent.mock.calls[0]).toEqual([
      {
        studentId: 'student-1',
        subjectId: 'subject-1',
      },
    ]);
    expect(result).toEqual(courses);
  });

  it('returns a course only for its owner', async () => {
    const repository = createRepository();
    repository.findByIdForStudent.mockResolvedValue(courseRecord());

    const result = await new GetCourseUseCase(repository).execute({
      studentId: 'student-1',
      courseId: 'course-1',
    });

    expect(result.id).toBe('course-1');
    expect(repository.findByIdForStudent.mock.calls[0]).toEqual([
      {
        studentId: 'student-1',
        courseId: 'course-1',
      },
    ]);
  });

  it('throws not found when a course belongs to another student', async () => {
    const repository = createRepository();
    repository.findByIdForStudent.mockResolvedValue(null);

    await expect(
      new GetCourseUseCase(repository).execute({
        studentId: 'student-2',
        courseId: 'course-1',
      }),
    ).rejects.toThrow('Course not found');
  });

  it('deletes an empty course', async () => {
    const repository = createRepository();
    repository.deleteIfEmpty.mockResolvedValue(true);

    await expect(
      new DeleteCourseUseCase(repository).execute({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).resolves.toEqual({ deleted: true });

    expect(repository.deleteIfEmpty.mock.calls[0]).toEqual([
      {
        studentId: 'student-1',
        courseId: 'course-1',
      },
    ]);
  });

  it('refuses to delete a course containing documents', async () => {
    const repository = createRepository();
    repository.deleteIfEmpty.mockRejectedValue(
      new Error('Course contains documents'),
    );

    await expect(
      new DeleteCourseUseCase(repository).execute({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).rejects.toThrow('Course contains documents');
  });

  it('runs a backfill dry-run without applying writes', async () => {
    const repository = createRepository();
    repository.backfillFromExistingDocumentsDryRun.mockResolvedValue({
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
      ],
    });

    const result = await new BackfillCoursesFromDocumentsDryRunUseCase(
      repository,
    ).execute();

    expect(result.documentsWithoutCourseCount).toBe(2);
    expect(
      repository.backfillFromExistingDocumentsDryRun.mock.calls,
    ).toHaveLength(1);
    expect(repository.backfillFromExistingDocuments.mock.calls).toHaveLength(0);
  });
});

function createRepository(): jest.Mocked<CoursesRepository> {
  return {
    create: jest.fn(),
    findByIdForStudent: jest.fn(),
    listBySubjectForStudent: jest.fn(),
    deleteIfEmpty: jest.fn(),
    findCourseOwnershipContext: jest.fn(),
    attachDocumentToCourse: jest.fn(),
    backfillFromExistingDocumentsDryRun: jest.fn(),
    backfillFromExistingDocuments: jest.fn(),
  };
}

function courseRecord(input: Partial<CourseDto> = {}): CourseDto {
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
    ...input,
  };
}

```

### `src/modules/courses/application/courses.repository.ts`

```ts
import type {
  CourseDocumentAttachment,
  CourseEntity,
} from '../domain/course.entity';

export const COURSES_REPOSITORY = Symbol('COURSES_REPOSITORY');

export type CourseDto = CourseEntity;

export interface CreateCourseRepositoryInput {
  studentId: string;
  subjectId: string;
  title: string;
  description?: string | null;
  chapterLabel?: string | null;
  estimatedMinutes?: number | null;
}

export interface CourseOwnershipContext {
  courseId: string;
  studentId: string;
  subjectId: string;
}

export interface CourseBackfillDryRunItem {
  documentId: string;
  studentId: string;
  subjectId: string;
  proposedTitle: string;
}

export interface CourseBackfillDryRunResult {
  documentsWithoutCourseCount: number;
  coursesToCreateCount: number;
  documentsToAttachCount: number;
  items: CourseBackfillDryRunItem[];
}

export interface CoursesRepository {
  create(input: CreateCourseRepositoryInput): Promise<CourseDto>;

  findByIdForStudent(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseDto | null>;

  listBySubjectForStudent(input: {
    studentId: string;
    subjectId: string;
  }): Promise<CourseDto[]>;

  deleteIfEmpty(input: {
    studentId: string;
    courseId: string;
  }): Promise<boolean>;

  findCourseOwnershipContext(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseOwnershipContext | null>;

  attachDocumentToCourse(input: {
    studentId: string;
    courseId: string;
    documentId: string;
  }): Promise<CourseDocumentAttachment>;

  backfillFromExistingDocumentsDryRun(): Promise<CourseBackfillDryRunResult>;

  backfillFromExistingDocuments(): Promise<CourseBackfillDryRunResult>;
}

```

### `src/modules/courses/application/create-course.use-case.ts`

```ts
import { Inject, Injectable } from '@nestjs/common';
import {
  COURSES_REPOSITORY,
  type CourseDto,
  type CoursesRepository,
} from './courses.repository';

@Injectable()
export class CreateCourseUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    subjectId: string;
    title: string;
    description?: string | null;
    chapterLabel?: string | null;
    estimatedMinutes?: number | null;
  }): Promise<CourseDto> {
    const studentId = requiredId(input.studentId, 'studentId');
    const subjectId = requiredId(input.subjectId, 'subjectId');
    const title = input.title.trim();

    if (title.length < 2) {
      throw new Error('Course title must contain at least 2 characters');
    }

    const estimatedMinutes = normalizeEstimatedMinutes(input.estimatedMinutes);

    return this.coursesRepository.create({
      studentId,
      subjectId,
      title,
      description: normalizeOptionalText(input.description),
      chapterLabel: normalizeOptionalText(input.chapterLabel),
      estimatedMinutes,
    });
  }
}

function requiredId(value: string, name: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${name} is required`);
  }

  return trimmed;
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';

  return trimmed.length ? trimmed : null;
}

function normalizeEstimatedMinutes(value: number | null | undefined) {
  if (value == null) {
    return null;
  }

  if (!Number.isInteger(value) || value < 1 || value > 1440) {
    throw new Error(
      'Course estimatedMinutes must be an integer between 1 and 1440',
    );
  }

  return value;
}

```

### `src/modules/courses/application/delete-course.use-case.ts`

```ts
import { Inject, Injectable } from '@nestjs/common';
import {
  COURSES_REPOSITORY,
  type CoursesRepository,
} from './courses.repository';

@Injectable()
export class DeleteCourseUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
  }): Promise<{ deleted: true }> {
    const deleted = await this.coursesRepository.deleteIfEmpty({
      studentId: requiredId(input.studentId, 'studentId'),
      courseId: requiredId(input.courseId, 'courseId'),
    });

    if (!deleted) {
      throw new Error('Course not found');
    }

    return { deleted: true };
  }
}

function requiredId(value: string, name: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${name} is required`);
  }

  return trimmed;
}

```

### `src/modules/courses/application/get-course.use-case.ts`

```ts
import { Inject, Injectable } from '@nestjs/common';
import {
  COURSES_REPOSITORY,
  type CourseDto,
  type CoursesRepository,
} from './courses.repository';

@Injectable()
export class GetCourseUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseDto> {
    const course = await this.coursesRepository.findByIdForStudent({
      studentId: requiredId(input.studentId, 'studentId'),
      courseId: requiredId(input.courseId, 'courseId'),
    });

    if (!course) {
      throw new Error('Course not found');
    }

    return course;
  }
}

function requiredId(value: string, name: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${name} is required`);
  }

  return trimmed;
}

```

### `src/modules/courses/application/list-subject-courses.use-case.ts`

```ts
import { Inject, Injectable } from '@nestjs/common';
import {
  COURSES_REPOSITORY,
  type CourseDto,
  type CoursesRepository,
} from './courses.repository';

@Injectable()
export class ListSubjectCoursesUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    subjectId: string;
  }): Promise<CourseDto[]> {
    return this.coursesRepository.listBySubjectForStudent({
      studentId: requiredId(input.studentId, 'studentId'),
      subjectId: requiredId(input.subjectId, 'subjectId'),
    });
  }
}

function requiredId(value: string, name: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${name} is required`);
  }

  return trimmed;
}

```

### `src/modules/courses/courses.module.ts`

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { BackfillCoursesFromDocumentsDryRunUseCase } from './application/backfill-courses-from-documents.use-case';
import { COURSES_REPOSITORY } from './application/courses.repository';
import { CreateCourseUseCase } from './application/create-course.use-case';
import { DeleteCourseUseCase } from './application/delete-course.use-case';
import { GetCourseUseCase } from './application/get-course.use-case';
import { ListSubjectCoursesUseCase } from './application/list-subject-courses.use-case';
import { PrismaCoursesRepository } from './infrastructure/prisma-courses.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    CreateCourseUseCase,
    ListSubjectCoursesUseCase,
    GetCourseUseCase,
    DeleteCourseUseCase,
    BackfillCoursesFromDocumentsDryRunUseCase,
    {
      provide: COURSES_REPOSITORY,
      useClass: PrismaCoursesRepository,
    },
  ],
  exports: [
    CreateCourseUseCase,
    ListSubjectCoursesUseCase,
    GetCourseUseCase,
    DeleteCourseUseCase,
    BackfillCoursesFromDocumentsDryRunUseCase,
    COURSES_REPOSITORY,
  ],
})
export class CoursesModule {}

```

### `src/modules/courses/domain/course.entity.ts`

```ts
export interface CourseEntity {
  id: string;
  studentId: string;
  subjectId: string;
  title: string;
  description: string | null;
  chapterLabel: string | null;
  estimatedMinutes: number | null;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseDocumentAttachment {
  id: string;
  studentId: string;
  subjectId: string;
  courseId: string | null;
  fileName: string;
}

export class CourseContainsDocumentsError extends Error {
  readonly statusCode = 409;

  constructor() {
    super('Course contains documents');
  }
}

```

### `src/modules/courses/infrastructure/prisma-courses.repository.spec.ts`

```ts
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

  it('produces an idempotent dry-run backfill without writes', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findMany.mockResolvedValue([
      documentRecord({ id: 'document-1', fileName: 'Cours_stats_S1.pdf' }),
      documentRecord({ id: 'document-2', fileName: 'TD loi normale.PDF' }),
    ]);

    const result = await repository.backfillFromExistingDocumentsDryRun();

    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: { kind: 'COURSE_PDF', courseId: null },
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

```

### `src/modules/courses/infrastructure/prisma-courses.repository.ts`

```ts
import { Injectable } from '@nestjs/common';
import { DocumentKind } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type {
  CourseBackfillDryRunResult,
  CourseDto,
  CourseOwnershipContext,
  CoursesRepository,
  CreateCourseRepositoryInput,
} from '../application/courses.repository';
import {
  CourseContainsDocumentsError,
  type CourseDocumentAttachment,
} from '../domain/course.entity';

type CourseRecord = CourseDto;

type DocumentAttachmentRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  courseId: string | null;
  fileName: string;
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

function titleFromFileName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  const normalized = withoutExtension
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || 'Cours sans titre';
}

```

### `prisma/schema.prisma`

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
  courses  Course[]
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
  courses        Course[]
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

  student          StudentProfile   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject          Subject          @relation(fields: [subjectId, studentId], references: [id, studentId], onDelete: Cascade)
  documents        Document[]
  revisionSessions RevisionSession[]

  @@index([studentId])
  @@index([subjectId, studentId])
  @@index([subjectId, displayOrder])
  @@unique([id, studentId])
}

model Document {
  id          String         @id @default(cuid())
  studentId   String
  subjectId   String
  courseId    String?
  kind        DocumentKind
  fileName    String
  storagePath String
  mimeType    String
  status      DocumentStatus @default(UPLOADED)
  errorCode   String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  subject        Subject                 @relation(fields: [subjectId, studentId], references: [id, studentId], onDelete: Cascade)
  course         Course?                 @relation(fields: [courseId], references: [id], onDelete: Restrict)
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
  @@index([courseId])
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

  @@index([studentId])
  @@index([subjectId])
  @@index([courseId])
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

```

### `src/app.module.ts`

```ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { ActivitiesModule } from './modules/activities/activities.module';
import { AuthModule } from './modules/auth/auth.module';
import { CoursesModule } from './modules/courses/courses.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { RevisionModule } from './modules/revision/revision.module';
import { RevisionSessionsModule } from './modules/revision-sessions/revision-sessions.module';
import { StudyArtifactsModule } from './modules/study-artifacts/study-artifacts.module';
import { SubjectsModule } from './modules/subjects/subjects.module';

@Module({
  imports: [
    AuthModule,
    SubjectsModule,
    RevisionModule,
    CoursesModule,
    DocumentsModule,
    ActivitiesModule,
    RevisionSessionsModule,
    StudyArtifactsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}

```

### `src/modules/revision-sessions/application/revision-sessions.repository.ts`

```ts
import type {
  RevisionSessionActionKindValue,
  RevisionSessionActionStatusValue,
  RevisionSessionModeValue,
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
    courseId: string | null;
    documentId: string | null;
    knowledgeUnitId: string | null;
    mode: RevisionSessionModeValue;
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

### `src/modules/revision-sessions/domain/revision-session.entity.ts`

```ts
import type {
  DiagnosticQuizActivity,
  OpenQuestionActivity,
} from '../../activities/application/activities.repository';

export type RevisionSessionStatusValue = 'STARTED' | 'COMPLETED' | 'ABANDONED';

export type RevisionSessionModeValue = 'QUICK' | 'DEEP' | 'EXAM';

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
  courseId: string | null;
  documentId: string | null;
  knowledgeUnitId: string | null;
  mode: RevisionSessionModeValue;
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

### `src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.spec.ts`

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
        mode: 'QUICK',
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
    expect(result.session.courseId).toBeNull();
    expect(result.session.mode).toBe('QUICK');
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
    courseId: null,
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    mode: 'QUICK',
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

### `src/modules/revision-sessions/infrastructure/prisma-revision-sessions.repository.ts`

```ts
import { Injectable } from '@nestjs/common';
import {
  RevisionSessionActionKind,
  RevisionSessionActionStatus,
  RevisionSessionMode,
  RevisionSessionStatus,
} from '../../../generated/prisma/enums';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type {
  RevisionSessionActionKindValue,
  RevisionSessionActionStatusValue,
  RevisionSessionModeValue,
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
  courseId: string | null;
  documentId: string | null;
  knowledgeUnitId: string | null;
  mode: RevisionSessionModeValue;
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
          mode: RevisionSessionMode.QUICK,
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
        courseId: session.courseId,
        documentId: session.documentId,
        knowledgeUnitId: session.knowledgeUnitId,
        mode: session.mode,
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
      courseId: session.courseId,
      documentId: session.documentId,
      knowledgeUnitId: session.knowledgeUnitId,
      mode: session.mode,
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
