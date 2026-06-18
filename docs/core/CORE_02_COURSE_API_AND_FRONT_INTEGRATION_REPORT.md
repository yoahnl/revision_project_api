# CORE-02 — Course API + accueil/détail réels — API

## 1. Résultat

CORE-02 côté backend est réalisé : l’API NestJS expose les endpoints Course minimaux préparés par CORE-01, avec authentification Firebase, ownership strict par `studentId`, validation des payloads, DTO publics bornés, mapping d’erreurs HTTP et tests unitaires/e2e. Aucun endpoint d’upload sous cours n’a été ajouté, aucune table ni modèle `CourseSource` n’a été créé et aucun flow IA/rich closed n’a été modifié.

Endpoints ajoutés :

- `GET /subjects/:subjectId/courses`
- `POST /subjects/:subjectId/courses`
- `GET /courses/:courseId`
- `DELETE /courses/:courseId`

## 2. Audit initial

Sources inspectées côté API :

- `docs/MVP_REAL_INTEGRATION_ROADMAP.md`
- `docs/MVP_REAL_INTEGRATION_DECISIONS.md`
- `docs/core/CORE_01_COURSE_MINIMAL_DOCUMENT_COURSE_ID_REPORT.md`
- `prisma/schema.prisma`
- `src/app.module.ts`
- `src/modules/courses/**`
- `src/modules/subjects/**`
- `src/modules/documents/**`
- `src/modules/revision-sessions/**`
- `test/critical-paths.e2e-spec.ts`

Constats :

- CORE-01 avait créé `Course`, `Document.courseId`, les use cases internes et `CoursesModule`, mais sans controller public.
- `Subject` et `Course` sont filtrés par `studentId`; le repository Course vérifie la matière possédée avant création/listing.
- La suppression d’un cours avec documents passe déjà par `CourseContainsDocumentsError`; CORE-02 mappe cette erreur en `409 Conflict`.
- `Document.courseId` reste nullable et l’upload `/documents/course-pdf` existant continue de fonctionner sans rattachement Course.
- Les e2e critiques remplacent les use cases par des mocks : l’ajout du controller Course impose donc d’override les nouveaux use cases dans le test app.

## 3. Préflight Git

- Repo : `revision_project_api` (`/Users/karim/Project/app-révision/api`)
- Branche initiale observée : `main`
- Status initial CORE-02 observé : clean avant modifications du lot
- Derniers commits observés :
  - `e7328c7 024: Intégration des cours et documents associés`
  - `79d665c 025: Audit readiness V1`
  - `232a1b3 023: Ajout du runbook de démonstration V1`
  - `493888e 022: Intégration des QCM avec choix d'images`
  - `5441805 021: Intégration des QCM de calcul`
- Aucun commit, amend, merge, rebase, push ou tag n’a été fait.

## 4. Périmètre réalisé

### API

- Ajout du `CoursesController` protégé par `FirebaseAuthGuard`.
- Ajout des DTO/mappers publics Course.
- Ajout des use cases lecture : listing avec compteurs de documents/sources et détail avec documents attachés.
- Extension du repository Course pour lire les compteurs et détails sans exposer de payload arbitraire.
- Extension du module Course avec `AuthModule`, controller et providers.

### Tests

- Tests unitaires controller : validation, création, détail, 404, 409.
- Tests use cases lecture : validation d’IDs, listing, détail, not found.
- Tests e2e critiques : auth requise, happy path Course API, validation/not found/conflict.
- Non-régression : rich closed, subjects, documents, revision-sessions, e2e complet, build, lint.

## 5. Contrat API Course

### `GET /subjects/:subjectId/courses`

Retourne une liste de cours de la matière possédée par l’étudiant courant, triée côté repository par `displayOrder` puis `createdAt`, avec compteurs de documents attachés :

- `sourceCount`
- `readySourceCount`
- `processingSourceCount`
- `failedSourceCount`

Le nom JSON `sourceCount` reste volontairement orienté produit, mais l’implémentation s’appuie uniquement sur `Document.courseId`, sans table `CourseSource`.

### `POST /subjects/:subjectId/courses`

Crée un cours vide. Payload accepté :

- `title` requis, trim, minimum 2 caractères, maximum 140.
- `description` optionnelle, trim, maximum 1000.
- `chapterLabel` optionnelle, trim, maximum 120.
- `estimatedMinutes` optionnel, entier 1 à 1440.

Le `studentId` vient uniquement du guard/auth, jamais du body.

### `GET /courses/:courseId`

Retourne le détail réel du cours possédé, avec résumé matière et documents déjà rattachés via `courseId`.

### `DELETE /courses/:courseId`

Supprime uniquement un cours vide. Si des documents sont attachés, retourne `409 Conflict`. Aucun document ou fichier utilisateur n’est supprimé implicitement.

## 6. Ownership et sécurité

- Tous les endpoints utilisent `@CurrentStudent()`.
- Le `studentId` n’est jamais accepté depuis le body ou les query params.
- La création/listing vérifie que la matière appartient à l’étudiant.
- Le détail/suppression vérifient que le cours appartient à l’étudiant.
- Le repository conserve la protection cross-subject/cross-student pour l’attachement futur de documents.
- Aucun secret, token réel, UID réel ou URL privée n’a été ajouté.

## 7. Non-objectifs respectés

- Pas de CORE-03.
- Pas d’upload PDF sous cours.
- Pas de table/modèle `CourseSource`.
- Pas d’endpoint fiche/progression/session quick Course.
- Pas de modification Prisma/migration dans CORE-02.
- Pas de modification Genkit/IA.
- Pas de modification frontend dans le repo API.
- Pas de suppression destructive.

## 8. Fichiers créés/modifiés/supprimés

### Créés

- `src/modules/courses/application/course-read-use-cases.spec.ts`
- `src/modules/courses/application/get-course-detail.use-case.ts`
- `src/modules/courses/application/list-subject-courses-with-stats.use-case.ts`
- `src/modules/courses/interfaces/course-response.dto.ts`
- `src/modules/courses/interfaces/create-course.request.ts`
- `src/modules/courses/interfaces/courses.controller.ts`
- `src/modules/courses/interfaces/courses.controller.spec.ts`
- `docs/core/CORE_02_COURSE_API_AND_FRONT_INTEGRATION_REPORT.md`

### Modifiés

- `src/modules/courses/application/course-use-cases.spec.ts`
- `src/modules/courses/application/courses.repository.ts`
- `src/modules/courses/courses.module.ts`
- `src/modules/courses/infrastructure/prisma-courses.repository.ts`
- `test/critical-paths.e2e-spec.ts`

### Supprimés

- Aucun.

## 9. Tests ajoutés ou renforcés

- `course-read-use-cases.spec.ts` : lecture Course réelle, validation IDs, not found.
- `courses.controller.spec.ts` : contrat HTTP controller, validation, mapping 404/409.
- `critical-paths.e2e-spec.ts` : routes Course protégées, happy path create/list/get/delete, erreurs 400/404/409.
- `course-use-cases.spec.ts` : mock repository aligné sur les nouvelles méthodes.

## 10. Validations lancées avec résultats

- `npm test -- modules/courses --runInBand` : OK, 4 suites passées, 28 tests passés.
- `npm run test:e2e -- --runInBand` : un premier passage a échoué transitoirement sur un submit rich closed V1-C (405), le test isolé `routes rich closed V1-C institution matrix` est passé, puis le rerun e2e complet est passé : 2 suites, 27 tests. Après renommage anti-`CourseSource`, le rerun e2e est encore OK.
- `npm test -- subjects --runInBand` : OK, 5 suites, 16 tests.
- `npm test -- documents --runInBand` : OK, 9 suites, 63 tests.
- `npm test -- revision-sessions --runInBand` : OK, 6 suites, 41 tests.
- `npx prisma validate` : OK.
- `npx prisma generate` : OK, client Prisma généré.
- `npm run lint:check` : premier passage KO sur cinq erreurs dans mes ajouts, corrigé, puis OK. Après renommage anti-`CourseSource`, encore OK.
- `npm run build` : premier passage KO sur un narrowing TypeScript `unknown`, corrigé, puis OK. Après renommage anti-`CourseSource`, encore OK.
- `npm test -- --runInBand` : OK, 73 suites passées, 1 suite skipped existante, 630 tests passés, 1 test skipped existant.

## 11. Validations non lancées avec justification

- Aucune migration Prisma appliquée : CORE-02 ne modifie pas Prisma.
- Aucun seed/backfill lancé : hors périmètre.
- Aucun provider IA réel lancé : hors périmètre et interdit.
- Aucun déploiement lancé.

## 12. Risques restants

- L’API Course expose les cours, mais l’upload sous cours reste volontairement absent jusqu’à CORE-03.
- Les compteurs de documents attachés dépendent de `Document.status`; `UPLOADED` compte comme source totale mais pas comme processing/ready/failed.
- Le controller fait de la validation manuelle pour rester cohérent avec les controllers existants ; une future passe pourrait centraliser en pipes/classes DTO, mais ce n’était pas l’objectif du lot.

## 13. Ce qui reste pour CORE-03

- Ajouter l’upload PDF sous cours.
- Dériver `studentId` et `subjectId` depuis le cours, pas depuis le body client.
- Utiliser/réviser `attachDocumentToCourse` avec tests HTTP cross-student/cross-subject.
- Déclencher le pipeline document existant sans régression.

## 14. Auto-review

- Pas de table/modèle `CourseSource`.
- Pas de CORE-03.
- Pas de modification Prisma.
- Pas de suppression implicite de documents.
- DELETE cours avec documents => `409`.
- Endpoints protégés par auth.
- Ownership étudiant/matière conservé.
- Rich closed/e2e non cassés après rerun complet.
- Aucun commit réalisé.

## 15. Points discutables du prompt

- Exposer DELETE dès CORE-02 est utile pour le contrat, mais l’UI front ne s’en sert pas encore ; c’est acceptable car le comportement `409` est important à verrouiller tôt.
- Garder la validation controller manuelle évite une refonte, mais il faudra probablement standardiser les DTO plus tard.
- Les compteurs de sources/documents sont simples ; une progression Course plus riche devra attendre CORE-04/CORE-05.

## 16. Contenu complet des fichiers créés/modifiés/supprimés

Le présent rapport est un fichier créé, mais il n’est pas auto-inclus dans cette section afin d’éviter une récursion infinie. Aucun fichier supprimé. Tous les autres fichiers créés/modifiés sont inclus intégralement ci-dessous.

### Modifié `src/modules/courses/application/course-use-cases.spec.ts`

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
    listBySubjectForStudentWithStats: jest.fn(),
    findDetailByIdForStudent: jest.fn(),
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

### Modifié `src/modules/courses/application/courses.repository.ts`

```ts
import type {
  CourseDocumentAttachment,
  CourseEntity,
} from '../domain/course.entity';

export const COURSES_REPOSITORY = Symbol('COURSES_REPOSITORY');

export type CourseDto = CourseEntity;

export type CourseDocumentStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED';

export type CourseDocumentKind = 'COURSE_PDF' | 'EXAM_PDF' | 'EXAM_IMAGE';

export interface CourseWithSourceStatsDto extends CourseDto {
  sourceCount: number;
  readySourceCount: number;
  processingSourceCount: number;
  failedSourceCount: number;
}

export interface CourseDocumentDto {
  id: string;
  courseId: string;
  documentId: string;
  fileName: string;
  kind: CourseDocumentKind;
  status: CourseDocumentStatus;
  errorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseDetailDto {
  course: CourseWithSourceStatsDto;
  subject: {
    id: string;
    name: string;
  };
  sources: CourseDocumentDto[];
}

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

  listBySubjectForStudentWithStats(input: {
    studentId: string;
    subjectId: string;
  }): Promise<CourseWithSourceStatsDto[]>;

  findDetailByIdForStudent(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseDetailDto | null>;

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

### Créé `src/modules/courses/application/course-read-use-cases.spec.ts`

```ts
import { GetCourseDetailUseCase } from './get-course-detail.use-case';
import { ListSubjectCoursesWithStatsUseCase } from './list-subject-courses-with-stats.use-case';
import type { CoursesRepository } from './courses.repository';

describe('Course read use cases', () => {
  it('lists subject courses with source stats', async () => {
    const repository = createRepository();
    repository.listBySubjectForStudentWithStats.mockResolvedValue([
      courseWithStats({ id: 'course-1', sourceCount: 2, readySourceCount: 1 }),
    ]);

    const result = await new ListSubjectCoursesWithStatsUseCase(
      repository,
    ).execute({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });

    expect(repository.listBySubjectForStudentWithStats.mock.calls[0]).toEqual([
      { studentId: 'student-1', subjectId: 'subject-1' },
    ]);
    expect(result[0]?.sourceCount).toBe(2);
    expect(result[0]?.readySourceCount).toBe(1);
  });

  it('returns course detail with subject and sources', async () => {
    const repository = createRepository();
    repository.findDetailByIdForStudent.mockResolvedValue({
      course: courseWithStats(),
      subject: { id: 'subject-1', name: 'Droit constitutionnel' },
      sources: [
        {
          id: 'document-1',
          courseId: 'course-1',
          documentId: 'document-1',
          fileName: 'cours.pdf',
          kind: 'COURSE_PDF',
          status: 'READY',
          errorCode: null,
          createdAt: new Date('2026-06-18T10:00:00.000Z'),
          updatedAt: new Date('2026-06-18T10:00:00.000Z'),
        },
      ],
    });

    const result = await new GetCourseDetailUseCase(repository).execute({
      studentId: 'student-1',
      courseId: 'course-1',
    });

    expect(repository.findDetailByIdForStudent.mock.calls[0]).toEqual([
      { studentId: 'student-1', courseId: 'course-1' },
    ]);
    expect(result.subject.name).toBe('Droit constitutionnel');
    expect(result.sources[0]?.status).toBe('READY');
  });

  it('throws not found when a course is not owned by the student', async () => {
    const repository = createRepository();
    repository.findDetailByIdForStudent.mockResolvedValue(null);

    await expect(
      new GetCourseDetailUseCase(repository).execute({
        studentId: 'student-2',
        courseId: 'course-1',
      }),
    ).rejects.toThrow('Course not found');
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
    listBySubjectForStudentWithStats: jest.fn(),
    findDetailByIdForStudent: jest.fn(),
  };
}

function courseWithStats(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    title: 'Droit constitutionnel',
    description: 'Institutions et normes',
    chapterLabel: 'Chapitre 1',
    estimatedMinutes: 30,
    displayOrder: 0,
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
    sourceCount: 0,
    readySourceCount: 0,
    processingSourceCount: 0,
    failedSourceCount: 0,
    ...overrides,
  };
}

```

### Créé `src/modules/courses/application/get-course-detail.use-case.ts`

```ts
import { Inject, Injectable } from '@nestjs/common';
import {
  COURSES_REPOSITORY,
  type CourseDetailDto,
  type CoursesRepository,
} from './courses.repository';

@Injectable()
export class GetCourseDetailUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseDetailDto> {
    const detail = await this.coursesRepository.findDetailByIdForStudent({
      studentId: requiredId(input.studentId, 'studentId'),
      courseId: requiredId(input.courseId, 'courseId'),
    });

    if (!detail) {
      throw new Error('Course not found');
    }

    return detail;
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

### Créé `src/modules/courses/application/list-subject-courses-with-stats.use-case.ts`

```ts
import { Inject, Injectable } from '@nestjs/common';
import {
  COURSES_REPOSITORY,
  type CoursesRepository,
  type CourseWithSourceStatsDto,
} from './courses.repository';

@Injectable()
export class ListSubjectCoursesWithStatsUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async execute(input: {
    studentId: string;
    subjectId: string;
  }): Promise<CourseWithSourceStatsDto[]> {
    return this.coursesRepository.listBySubjectForStudentWithStats({
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

### Modifié `src/modules/courses/courses.module.ts`

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { BackfillCoursesFromDocumentsDryRunUseCase } from './application/backfill-courses-from-documents.use-case';
import { COURSES_REPOSITORY } from './application/courses.repository';
import { CreateCourseUseCase } from './application/create-course.use-case';
import { DeleteCourseUseCase } from './application/delete-course.use-case';
import { GetCourseDetailUseCase } from './application/get-course-detail.use-case';
import { GetCourseUseCase } from './application/get-course.use-case';
import { ListSubjectCoursesWithStatsUseCase } from './application/list-subject-courses-with-stats.use-case';
import { ListSubjectCoursesUseCase } from './application/list-subject-courses.use-case';
import { PrismaCoursesRepository } from './infrastructure/prisma-courses.repository';
import { CoursesController } from './interfaces/courses.controller';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [CoursesController],
  providers: [
    CreateCourseUseCase,
    ListSubjectCoursesUseCase,
    ListSubjectCoursesWithStatsUseCase,
    GetCourseUseCase,
    GetCourseDetailUseCase,
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
    ListSubjectCoursesWithStatsUseCase,
    GetCourseUseCase,
    GetCourseDetailUseCase,
    DeleteCourseUseCase,
    BackfillCoursesFromDocumentsDryRunUseCase,
    COURSES_REPOSITORY,
  ],
})
export class CoursesModule {}

```

### Modifié `src/modules/courses/infrastructure/prisma-courses.repository.ts`

```ts
import { Injectable } from '@nestjs/common';
import { DocumentKind } from '../../../generated/prisma/enums';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import type {
  CourseBackfillDryRunResult,
  CourseDetailDto,
  CourseDocumentStatus,
  CourseDto,
  CourseOwnershipContext,
  CourseDocumentDto,
  CourseWithSourceStatsDto,
  CoursesRepository,
  CreateCourseRepositoryInput,
} from '../application/courses.repository';
import {
  CourseContainsDocumentsError,
  type CourseDocumentAttachment,
} from '../domain/course.entity';

type CourseRecord = CourseDto;

type CourseDetailRecord = CourseRecord & {
  subject: {
    id: string;
    name: string;
  };
  documents: Array<{
    id: string;
    courseId: string | null;
    fileName: string;
    kind: 'COURSE_PDF' | 'EXAM_PDF' | 'EXAM_IMAGE';
    status: CourseDocumentStatus;
    errorCode: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

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

  async listBySubjectForStudentWithStats(input: {
    studentId: string;
    subjectId: string;
  }): Promise<CourseWithSourceStatsDto[]> {
    await ensureSubjectForStudent(this.prisma, input);

    const courses = (await this.prisma.course.findMany({
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    })) as CourseRecord[];

    if (courses.length === 0) {
      return [];
    }

    const documents = await this.prisma.document.findMany({
      where: {
        studentId: input.studentId,
        courseId: { in: courses.map((course) => course.id) },
      },
      select: {
        courseId: true,
        status: true,
      },
    });

    const statsByCourseId = new Map<string, CourseDocumentStats>();

    for (const course of courses) {
      statsByCourseId.set(course.id, emptySourceStats());
    }

    for (const document of documents) {
      if (!document.courseId) {
        continue;
      }

      const stats = statsByCourseId.get(document.courseId);
      if (!stats) {
        continue;
      }

      applyDocumentStatus(stats, document.status);
    }

    return courses.map((course) =>
      toCourseWithStatsDto(course, statsByCourseId.get(course.id)),
    );
  }

  async findDetailByIdForStudent(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseDetailDto | null> {
    const course = await this.prisma.course.findFirst({
      where: {
        id: input.courseId,
        studentId: input.studentId,
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
          },
        },
        documents: {
          where: {
            studentId: input.studentId,
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            courseId: true,
            fileName: true,
            kind: true,
            status: true,
            errorCode: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!course) {
      return null;
    }

    const stats = emptySourceStats();
    const sources = course.documents.map((document) => {
      applyDocumentStatus(stats, document.status);
      return toCourseDocumentDto(document);
    });

    return {
      course: toCourseWithStatsDto(course, stats),
      subject: {
        id: course.subject.id,
        name: course.subject.name,
      },
      sources,
    };
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

type CourseDocumentStats = {
  sourceCount: number;
  readySourceCount: number;
  processingSourceCount: number;
  failedSourceCount: number;
};

function emptySourceStats(): CourseDocumentStats {
  return {
    sourceCount: 0,
    readySourceCount: 0,
    processingSourceCount: 0,
    failedSourceCount: 0,
  };
}

function applyDocumentStatus(
  stats: CourseDocumentStats,
  status: CourseDocumentStatus,
) {
  stats.sourceCount += 1;

  if (status === 'READY') {
    stats.readySourceCount += 1;
  } else if (status === 'PROCESSING') {
    stats.processingSourceCount += 1;
  } else if (status === 'FAILED') {
    stats.failedSourceCount += 1;
  }
}

function toCourseWithStatsDto(
  course: CourseRecord,
  stats: CourseDocumentStats = emptySourceStats(),
): CourseWithSourceStatsDto {
  return {
    ...toCourseDto(course),
    sourceCount: stats.sourceCount,
    readySourceCount: stats.readySourceCount,
    processingSourceCount: stats.processingSourceCount,
    failedSourceCount: stats.failedSourceCount,
  };
}

function toCourseDocumentDto(
  document: CourseDetailRecord['documents'][number],
): CourseDocumentDto {
  return {
    id: document.id,
    courseId: document.courseId ?? '',
    documentId: document.id,
    fileName: document.fileName,
    kind: document.kind,
    status: document.status,
    errorCode: document.errorCode,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
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

### Créé `src/modules/courses/interfaces/course-response.dto.ts`

```ts
import type {
  CourseDetailDto,
  CourseDocumentDto,
  CourseWithSourceStatsDto,
} from '../application/courses.repository';

export type CourseListItemResponse = {
  id: string;
  subjectId: string;
  title: string;
  description: string | null;
  chapterLabel: string | null;
  estimatedMinutes: number | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  sourceCount: number;
  readySourceCount: number;
  processingSourceCount: number;
  failedSourceCount: number;
};

export type CourseDocumentResponse = {
  id: string;
  courseId: string;
  documentId: string;
  fileName: string;
  kind: string;
  status: string;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CourseDetailResponse = {
  course: CourseListItemResponse;
  subject: {
    id: string;
    name: string;
  };
  sources: CourseDocumentResponse[];
};

export function toCourseListItemResponse(
  course: CourseWithSourceStatsDto,
): CourseListItemResponse {
  return {
    id: course.id,
    subjectId: course.subjectId,
    title: course.title,
    description: course.description,
    chapterLabel: course.chapterLabel,
    estimatedMinutes: course.estimatedMinutes,
    displayOrder: course.displayOrder,
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
    sourceCount: course.sourceCount,
    readySourceCount: course.readySourceCount,
    processingSourceCount: course.processingSourceCount,
    failedSourceCount: course.failedSourceCount,
  };
}

export function toCourseDocumentResponse(
  source: CourseDocumentDto,
): CourseDocumentResponse {
  return {
    id: source.id,
    courseId: source.courseId,
    documentId: source.documentId,
    fileName: source.fileName,
    kind: source.kind,
    status: source.status,
    errorCode: source.errorCode,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

export function toCourseDetailResponse(
  detail: CourseDetailDto,
): CourseDetailResponse {
  return {
    course: toCourseListItemResponse(detail.course),
    subject: detail.subject,
    sources: detail.sources.map(toCourseDocumentResponse),
  };
}

```

### Créé `src/modules/courses/interfaces/create-course.request.ts`

```ts
export class CreateCourseRequest {
  title!: string;
  description?: string | null;
  chapterLabel?: string | null;
  estimatedMinutes?: number | null;
}

```

### Créé `src/modules/courses/interfaces/courses.controller.ts`

```ts
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import type { AuthenticatedStudent } from '../../auth/interfaces/authenticated-student';
import { CreateCourseUseCase } from '../application/create-course.use-case';
import { DeleteCourseUseCase } from '../application/delete-course.use-case';
import { GetCourseDetailUseCase } from '../application/get-course-detail.use-case';
import { ListSubjectCoursesWithStatsUseCase } from '../application/list-subject-courses-with-stats.use-case';
import { CourseContainsDocumentsError } from '../domain/course.entity';
import type { CreateCourseRequest } from './create-course.request';
import {
  toCourseDetailResponse,
  toCourseListItemResponse,
} from './course-response.dto';

const MAX_COURSE_TITLE_LENGTH = 140;
const MAX_COURSE_DESCRIPTION_LENGTH = 1000;
const MAX_COURSE_CHAPTER_LABEL_LENGTH = 120;
const MAX_COURSE_ESTIMATED_MINUTES = 1440;

@Controller()
@UseGuards(FirebaseAuthGuard)
export class CoursesController {
  constructor(
    private readonly createCourse: CreateCourseUseCase,
    private readonly listCourses: ListSubjectCoursesWithStatsUseCase,
    private readonly getCourseDetail: GetCourseDetailUseCase,
    private readonly deleteCourseUseCase: DeleteCourseUseCase,
  ) {}

  @Get('subjects/:subjectId/courses')
  listForSubject(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('subjectId') subjectId: string,
  ) {
    return this.listCourses
      .execute({
        studentId: student.id,
        subjectId: trimRequiredString(
          subjectId,
          'Course subjectId is required',
        ),
      })
      .then((courses) => courses.map(toCourseListItemResponse))
      .catch(normalizeCourseError);
  }

  @Post('subjects/:subjectId/courses')
  createForSubject(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('subjectId') subjectId: string,
    @Body() body: CreateCourseRequest,
  ) {
    const validatedBody = validateCreateCourseBody(body);

    return this.createCourse
      .execute({
        studentId: student.id,
        subjectId: trimRequiredString(
          subjectId,
          'Course subjectId is required',
        ),
        title: validatedBody.title,
        description: validatedBody.description,
        chapterLabel: validatedBody.chapterLabel,
        estimatedMinutes: validatedBody.estimatedMinutes,
      })
      .then((course) =>
        toCourseListItemResponse({
          ...course,
          sourceCount: 0,
          readySourceCount: 0,
          processingSourceCount: 0,
          failedSourceCount: 0,
        }),
      )
      .catch(normalizeCourseError);
  }

  @Get('courses/:courseId')
  getCourse(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ) {
    return this.getCourseDetail
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .then(toCourseDetailResponse)
      .catch(normalizeCourseError);
  }

  @Delete('courses/:courseId')
  @HttpCode(204)
  async deleteCourse(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ): Promise<void> {
    await this.deleteCourseUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .catch(normalizeCourseError);
  }
}

function validateCreateCourseBody(body: CreateCourseRequest) {
  const title = trimRequiredString(
    body?.title,
    'Course title must contain at least 2 characters',
    MAX_COURSE_TITLE_LENGTH,
  );

  if (title.length < 2) {
    throw new BadRequestException(
      'Course title must contain at least 2 characters',
    );
  }

  return {
    title,
    description: trimOptionalString(
      body.description,
      'Course description is too long',
      MAX_COURSE_DESCRIPTION_LENGTH,
    ),
    chapterLabel: trimOptionalString(
      body.chapterLabel,
      'Course chapterLabel is too long',
      MAX_COURSE_CHAPTER_LABEL_LENGTH,
    ),
    estimatedMinutes: normalizeEstimatedMinutes(body.estimatedMinutes),
  };
}

function trimRequiredString(value: unknown, message: string, maxLength = 255) {
  if (typeof value !== 'string') {
    throw new BadRequestException(message);
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed.length > maxLength) {
    throw new BadRequestException(message);
  }

  return trimmed;
}

function trimOptionalString(
  value: unknown,
  message: string,
  maxLength: number,
) {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(message);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length > maxLength) {
    throw new BadRequestException(message);
  }

  return trimmed;
}

function normalizeEstimatedMinutes(value: unknown) {
  if (value == null) {
    return null;
  }

  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_COURSE_ESTIMATED_MINUTES
  ) {
    throw new BadRequestException(
      'Course estimatedMinutes must be an integer between 1 and 1440',
    );
  }

  return value;
}

function normalizeCourseError(error: unknown): never {
  if (error instanceof BadRequestException) {
    throw error;
  }

  if (error instanceof CourseContainsDocumentsError) {
    throw new ConflictException('Course contains documents');
  }

  if (
    error instanceof Error &&
    (error.message === 'Course not found' ||
      error.message === 'Course subject not found')
  ) {
    throw new NotFoundException(error.message);
  }

  if (
    error instanceof Error &&
    (error.message === 'Course title must contain at least 2 characters' ||
      error.message ===
        'Course estimatedMinutes must be an integer between 1 and 1440' ||
      error.message === 'subjectId is required' ||
      error.message === 'courseId is required')
  ) {
    throw new BadRequestException(error.message);
  }

  throw error;
}

```

### Créé `src/modules/courses/interfaces/courses.controller.spec.ts`

```ts
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CourseContainsDocumentsError } from '../domain/course.entity';
import { CreateCourseUseCase } from '../application/create-course.use-case';
import { DeleteCourseUseCase } from '../application/delete-course.use-case';
import { GetCourseDetailUseCase } from '../application/get-course-detail.use-case';
import { ListSubjectCoursesWithStatsUseCase } from '../application/list-subject-courses-with-stats.use-case';
import { CoursesController } from './courses.controller';

describe('CoursesController', () => {
  it('lists courses for the current student and subject', async () => {
    const { controller, listCourses } = createController();
    listCourses.execute.mockResolvedValue([courseWithStats()]);

    await expect(
      controller.listForSubject(currentStudent, 'subject-1'),
    ).resolves.toEqual([publicCourse()]);

    expect(listCourses.execute.mock.calls[0]).toEqual([
      { studentId: 'student-1', subjectId: 'subject-1' },
    ]);
  });

  it('creates a course with validated trimmed input', async () => {
    const { controller, createCourse } = createController();
    createCourse.execute.mockResolvedValue(courseWithStats());

    await expect(
      controller.createForSubject(currentStudent, ' subject-1 ', {
        title: ' Droit constitutionnel ',
        description: ' Institutions ',
        chapterLabel: ' Chapitre 1 ',
        estimatedMinutes: 30,
      }),
    ).resolves.toEqual(publicCourse());

    expect(createCourse.execute.mock.calls[0]).toEqual([
      {
        studentId: 'student-1',
        subjectId: 'subject-1',
        title: 'Droit constitutionnel',
        description: 'Institutions',
        chapterLabel: 'Chapitre 1',
        estimatedMinutes: 30,
      },
    ]);
  });

  it('rejects invalid course creation body as 400', () => {
    const { controller, createCourse } = createController();

    expect(() =>
      controller.createForSubject(currentStudent, 'subject-1', {
        title: 'x',
      }),
    ).toThrow(BadRequestException);
    expect(createCourse.execute.mock.calls).toHaveLength(0);
  });

  it('returns detail with subject and sources', async () => {
    const { controller, getCourseDetail } = createController();
    getCourseDetail.execute.mockResolvedValue({
      course: courseWithStats({ sourceCount: 1, readySourceCount: 1 }),
      subject: { id: 'subject-1', name: 'Droit constitutionnel' },
      sources: [
        {
          id: 'document-1',
          courseId: 'course-1',
          documentId: 'document-1',
          fileName: 'cours.pdf',
          kind: 'COURSE_PDF',
          status: 'READY',
          errorCode: null,
          createdAt: new Date('2026-06-18T10:00:00.000Z'),
          updatedAt: new Date('2026-06-18T10:00:00.000Z'),
        },
      ],
    });

    await expect(
      controller.getCourse(currentStudent, 'course-1'),
    ).resolves.toEqual({
      course: publicCourse({ sourceCount: 1, readySourceCount: 1 }),
      subject: { id: 'subject-1', name: 'Droit constitutionnel' },
      sources: [
        {
          id: 'document-1',
          courseId: 'course-1',
          documentId: 'document-1',
          fileName: 'cours.pdf',
          kind: 'COURSE_PDF',
          status: 'READY',
          errorCode: null,
          createdAt: '2026-06-18T10:00:00.000Z',
          updatedAt: '2026-06-18T10:00:00.000Z',
        },
      ],
    });
  });

  it('maps course not found to 404', async () => {
    const { controller, getCourseDetail } = createController();
    getCourseDetail.execute.mockRejectedValue(new Error('Course not found'));

    await expect(
      controller.getCourse(currentStudent, 'other-student-course'),
    ).rejects.toThrow(NotFoundException);
  });

  it('deletes empty courses and maps document conflicts to 409', async () => {
    const { controller, deleteCourse } = createController();
    deleteCourse.execute.mockResolvedValueOnce({ deleted: true });

    await expect(
      controller.deleteCourse(currentStudent, 'course-1'),
    ).resolves.toEqual(undefined);

    deleteCourse.execute.mockRejectedValueOnce(
      new CourseContainsDocumentsError(),
    );

    await expect(
      controller.deleteCourse(currentStudent, 'course-1'),
    ).rejects.toThrow(ConflictException);
  });
});

const currentStudent = {
  id: 'student-1',
  firebaseUid: 'firebase-1',
  email: 'student@example.test',
  displayName: 'Student',
};

function createController() {
  const createCourse = { execute: jest.fn() };
  const listCourses = { execute: jest.fn() };
  const getCourseDetail = { execute: jest.fn() };
  const deleteCourse = { execute: jest.fn() };

  return {
    controller: new CoursesController(
      createCourse as unknown as CreateCourseUseCase,
      listCourses as unknown as ListSubjectCoursesWithStatsUseCase,
      getCourseDetail as unknown as GetCourseDetailUseCase,
      deleteCourse as unknown as DeleteCourseUseCase,
    ),
    createCourse,
    listCourses,
    getCourseDetail,
    deleteCourse,
  };
}

function courseWithStats(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    title: 'Droit constitutionnel',
    description: 'Institutions',
    chapterLabel: 'Chapitre 1',
    estimatedMinutes: 30,
    displayOrder: 0,
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
    sourceCount: 0,
    readySourceCount: 0,
    processingSourceCount: 0,
    failedSourceCount: 0,
    ...overrides,
  };
}

function publicCourse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    subjectId: 'subject-1',
    title: 'Droit constitutionnel',
    description: 'Institutions',
    chapterLabel: 'Chapitre 1',
    estimatedMinutes: 30,
    displayOrder: 0,
    createdAt: '2026-06-18T10:00:00.000Z',
    updatedAt: '2026-06-18T10:00:00.000Z',
    sourceCount: 0,
    readySourceCount: 0,
    processingSourceCount: 0,
    failedSourceCount: 0,
    ...overrides,
  };
}

```

### Modifié `test/critical-paths.e2e-spec.ts`

```ts
import { INestApplication, NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { TOKEN_VERIFIER } from '../src/modules/auth/application/token-verifier';
import { FirebaseAuthGuard } from '../src/modules/auth/interfaces/firebase-auth.guard';
import { StartNextActivityUseCase } from '../src/modules/activities/application/start-next-activity.use-case';
import { StartOpenQuestionActivityUseCase } from '../src/modules/activities/application/start-open-question-activity.use-case';
import { SubmitActivityResultUseCase } from '../src/modules/activities/application/submit-activity-result.use-case';
import { SubmitOpenAnswerUseCase } from '../src/modules/activities/application/submit-open-answer.use-case';
import { CreateCourseUseCase } from '../src/modules/courses/application/create-course.use-case';
import { DeleteCourseUseCase } from '../src/modules/courses/application/delete-course.use-case';
import { GetCourseDetailUseCase } from '../src/modules/courses/application/get-course-detail.use-case';
import { ListSubjectCoursesWithStatsUseCase } from '../src/modules/courses/application/list-subject-courses-with-stats.use-case';
import { CourseContainsDocumentsError } from '../src/modules/courses/domain/course.entity';
import {
  richClosedExerciseFixture,
  richClosedV1BExerciseFixture,
  richClosedV1BFullExerciseFixture,
  richClosedV1CCalculationExerciseFixture,
  richClosedV1CExerciseFixture,
  richClosedV1CFullExerciseFixture,
  richClosedV1DImageChoiceExerciseFixture,
} from '../src/modules/activities/application/rich-closed-questions/rich-closed-question.fixtures';
import { GetRichClosedExerciseResultUseCase } from '../src/modules/activities/application/rich-closed-questions/get-rich-closed-exercise-result.use-case';
import { GetRichClosedExerciseUseCase } from '../src/modules/activities/application/rich-closed-questions/get-rich-closed-exercise.use-case';
import { toRichClosedPublicExerciseEnvelope } from '../src/modules/activities/application/rich-closed-questions/rich-closed-question-public.mapper';
import { scoreRichClosedExerciseSubmission } from '../src/modules/activities/application/rich-closed-questions/rich-closed-question-scorer';
import type {
  RichClosedAnswer,
  RichClosedQuestionKind,
} from '../src/modules/activities/application/rich-closed-questions/rich-closed-question.types';
import { StartRichClosedExerciseUseCase } from '../src/modules/activities/application/rich-closed-questions/start-rich-closed-exercise.use-case';
import { SubmitRichClosedExerciseUseCase } from '../src/modules/activities/application/rich-closed-questions/submit-rich-closed-exercise.use-case';
import { GetDocumentUseCase } from '../src/modules/documents/application/get-document.use-case';
import { ListDocumentKnowledgeUnitsUseCase } from '../src/modules/documents/application/list-document-knowledge-units.use-case';
import { GetTodayPlanUseCase } from '../src/modules/revision/application/get-today-plan.use-case';
import { GetRevisionSessionUseCase } from '../src/modules/revision-sessions/application/get-revision-session.use-case';
import { RequestNextRevisionSessionActionUseCase } from '../src/modules/revision-sessions/application/request-next-revision-session-action.use-case';
import { StartRevisionSessionUseCase } from '../src/modules/revision-sessions/application/start-revision-session.use-case';
import { GenerateDocumentSummaryUseCase } from '../src/modules/study-artifacts/application/generate-document-summary.use-case';
import { GenerateRevisionSheetUseCase } from '../src/modules/study-artifacts/application/generate-revision-sheet.use-case';
import { GetDocumentSummaryUseCase } from '../src/modules/study-artifacts/application/get-document-summary.use-case';
import { GetRevisionSheetUseCase } from '../src/modules/study-artifacts/application/get-revision-sheet.use-case';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';

jest.mock('firebase-admin/app', () => ({
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(),
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

type CriticalPathMocks = ReturnType<typeof createCriticalPathMocks>;
type KnowledgeUnitsResponse = ReturnType<typeof documentKnowledgeUnits>;
type SummaryResponse = ReturnType<typeof documentSummary>;
type RevisionSheetResponse = ReturnType<typeof revisionSheet>;
type TodayPlanResponse = ReturnType<typeof todayPlan>;
type ActivityResponse = ReturnType<typeof diagnosticQuizActivity>;
type OpenQuestionResponse = ReturnType<typeof openQuestionActivity>;

const currentStudent = {
  id: 'student-demo-test',
  firebaseUid: 'firebase-demo-test-uid',
  email: 'demo-revision@example.test',
  displayName: 'Demo Revision',
};

describe('Critical demo paths (e2e)', () => {
  describe('protected routes', () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
      app = await createAppWithRealAuthGuard();
    });

    afterEach(async () => {
      await app?.close();
    });

    it('rejects critical demo routes without a bearer token', async () => {
      // This suite keeps the real FirebaseAuthGuard behavior for missing-token
      // checks, but the verifier itself is mocked so no Firebase network call
      // can happen even if a future test adds a token.
      const server = app.getHttpServer();

      await request(server).get('/today').expect(401);
      await request(server).get('/documents/document-1').expect(401);
      await request(server)
        .get('/documents/document-1/knowledge-units')
        .expect(401);
      await request(server)
        .post('/activities/next')
        .send({ subjectId: 'subject-1' })
        .expect(401);
      await request(server)
        .post('/activities/open-question')
        .send({ subjectId: 'subject-1', knowledgeUnitId: 'unit-1' })
        .expect(401);
      await request(server)
        .post('/activities/rich-closed/start')
        .send({ subjectId: 'subject-1', knowledgeUnitId: 'unit-1' })
        .expect(401);
      await request(server)
        .post('/revision-sessions')
        .send({ subjectId: 'subject-1' })
        .expect(401);
      await request(server).get('/subjects/subject-1/courses').expect(401);
      await request(server)
        .post('/subjects/subject-1/courses')
        .send({ title: 'Droit constitutionnel' })
        .expect(401);
      await request(server).get('/courses/course-1').expect(401);
      await request(server).delete('/courses/course-1').expect(401);
    });
  });

  describe('authenticated contracts', () => {
    let app: INestApplication<App>;
    let mocks: CriticalPathMocks;

    beforeEach(async () => {
      mocks = createCriticalPathMocks();
      app = await createAuthenticatedApp(mocks);
    });

    afterEach(async () => {
      await app?.close();
    });

    it('routes document and knowledge-unit reads with ownership context and no storage path leak', async () => {
      const server = app.getHttpServer();

      const documentResponse = await request(server)
        .get('/documents/document-1')
        .expect(200);

      expect(mocks.getDocument.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        documentId: 'document-1',
      });
      expect(documentResponse.body).toMatchObject({
        id: 'document-1',
        subjectId: 'subject-1',
        status: 'READY',
      });
      assertNoSensitivePreSubmitFields(documentResponse.body);

      const knowledgeUnitsResponse = await request(server)
        .get('/documents/document-1/knowledge-units')
        .expect(200);
      const knowledgeUnitsBody =
        knowledgeUnitsResponse.body as KnowledgeUnitsResponse;

      expect(mocks.listDocumentKnowledgeUnits.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        documentId: 'document-1',
      });
      expect(knowledgeUnitsBody.items[0].sources[0]).toMatchObject({
        chunkId: 'chunk-1',
        pageNumber: 1,
        index: 0,
      });
      assertNoSensitivePreSubmitFields(knowledgeUnitsResponse.body);
    });

    it('serves the Course API happy path with owned subject/course context', async () => {
      const server = app.getHttpServer();

      const createResponse = await request(server)
        .post('/subjects/subject-1/courses')
        .send({
          title: ' Droit constitutionnel ',
          description: ' Institutions ',
          chapterLabel: ' Chapitre 1 ',
          estimatedMinutes: 30,
        })
        .expect(201);

      expect(mocks.createCourse.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        title: 'Droit constitutionnel',
        description: 'Institutions',
        chapterLabel: 'Chapitre 1',
        estimatedMinutes: 30,
      });
      expect(createResponse.body).toMatchObject({
        id: 'course-1',
        subjectId: 'subject-1',
        title: 'Droit constitutionnel',
        sourceCount: 0,
      });

      const listResponse = await request(server)
        .get('/subjects/subject-1/courses')
        .expect(200);
      const listBody = listResponse.body as Array<{
        id: string;
        readySourceCount: number;
      }>;

      expect(mocks.listCoursesWithStats.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
      });
      expect(listBody).toHaveLength(1);
      expect(listBody[0]).toMatchObject({
        id: 'course-1',
        readySourceCount: 1,
      });

      const detailResponse = await request(server)
        .get('/courses/course-1')
        .expect(200);
      const detailBody = detailResponse.body as {
        course: { id: string; sourceCount: number };
        subject: { id: string; name: string };
        sources: Array<{
          id: string;
          courseId: string;
          documentId: string;
          status: string;
        }>;
      };

      expect(mocks.getCourseDetail.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        courseId: 'course-1',
      });
      expect(detailBody).toMatchObject({
        course: {
          id: 'course-1',
          sourceCount: 1,
        },
        subject: {
          id: 'subject-1',
          name: 'Droit constitutionnel',
        },
      });
      expect(detailBody.sources[0]).toMatchObject({
        id: 'document-1',
        courseId: 'course-1',
        documentId: 'document-1',
        status: 'READY',
      });

      await request(server).delete('/courses/course-1').expect(204);

      expect(mocks.deleteCourse.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        courseId: 'course-1',
      });
    });

    it('maps Course API validation, not found and conflict errors', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/subjects/subject-1/courses')
        .send({ title: 'x' })
        .expect(400);

      mocks.getCourseDetail.execute.mockRejectedValueOnce(
        new Error('Course not found'),
      );
      await request(server).get('/courses/other-student-course').expect(404);

      mocks.deleteCourse.execute.mockRejectedValueOnce(
        new CourseContainsDocumentsError(),
      );
      await request(server)
        .delete('/courses/course-with-documents')
        .expect(409);
    });

    it('maps missing documents to a clean 404 response', async () => {
      mocks.getDocument.execute.mockRejectedValueOnce(
        new NotFoundException('Document not found'),
      );

      await request(app.getHttpServer())
        .get('/documents/missing-document')
        .expect(404);
    });

    it('serves ready summary and revision sheet without internal metadata', async () => {
      const server = app.getHttpServer();

      const summaryResponse = await request(server)
        .get('/documents/document-1/summary')
        .expect(200);
      const summaryBody = summaryResponse.body as SummaryResponse;

      expect(mocks.getDocumentSummary.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        documentId: 'document-1',
      });
      expect(summaryBody.title).toBe('Synthèse de démonstration');
      assertNoSensitivePreSubmitFields(summaryResponse.body);
      expect(JSON.stringify(summaryResponse.body)).not.toContain('provider');
      expect(JSON.stringify(summaryResponse.body)).not.toContain(
        'promptVersion',
      );

      const sheetResponse = await request(server)
        .get('/documents/document-1/revision-sheet')
        .expect(200);
      const sheetBody = sheetResponse.body as RevisionSheetResponse;

      expect(mocks.getRevisionSheet.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        documentId: 'document-1',
      });
      expect(sheetBody.sections).toHaveLength(1);
      assertNoSensitivePreSubmitFields(sheetResponse.body);
      expect(JSON.stringify(sheetResponse.body)).not.toContain('provider');
      expect(JSON.stringify(sheetResponse.body)).not.toContain('promptVersion');
    });

    it('returns a deterministic multi-action TodayPlan for the current student', async () => {
      const response = await request(app.getHttpServer())
        .get('/today')
        .expect(200);
      const todayBody = response.body as TodayPlanResponse;

      expect(mocks.getTodayPlan.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
      });
      expect(todayBody.items.map((item) => item.action)).toEqual([
        'diagnostic_quiz',
        'open_question',
        'rich_closed_exercise',
        'revision_session',
      ]);
      const richClosedItem = todayBody.items.find(
        (item) => item.action === 'rich_closed_exercise',
      );
      expect(richClosedItem).toMatchObject({
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        startPayload: {
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
        },
      });
      expect(richClosedItem).not.toHaveProperty('questions');
      expect(richClosedItem).not.toHaveProperty('correction');
      assertNoSensitivePreSubmitFields(response.body);
      expect(JSON.stringify(response.body)).not.toContain('other-student');
    });

    it('starts a QCM with bounded v3 options and no correction leak', async () => {
      const response = await request(app.getHttpServer())
        .post('/activities/next')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 12,
          visualsEnabled: true,
          visualTypes: ['CHART', 'DIAGRAM'],
          selectionModes: ['single', 'multiple'],
        })
        .expect(201);
      const responseBody = response.body as ActivityResponse;

      expect(mocks.startNextActivity.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
        questionCount: 12,
        visualsEnabled: true,
        visualTypes: ['CHART', 'DIAGRAM'],
        selectionModes: ['single', 'multiple'],
      });
      expect(responseBody.type).toBe('diagnostic_quiz');
      assertNoSensitivePreSubmitFields(response.body);
    });

    it('rejects invalid QCM payloads before calling the use case', async () => {
      await request(app.getHttpServer())
        .post('/activities/next')
        .send({
          subjectId: 'subject-1',
          questionCount: 25,
          visualTypes: ['IMAGE'],
        })
        .expect(400);

      expect(mocks.startNextActivity.execute).not.toHaveBeenCalled();
    });

    it('submits QCM answers and maps critical submit errors', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/activities/quiz-session-1/result')
        .send({
          answers: [
            { questionId: 'question-1', choiceId: 'choice-1' },
            { questionId: 'question-2', choiceIds: ['choice-2', 'choice-3'] },
          ],
        })
        .expect(201);

      expect(mocks.submitActivityResult.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'quiz-session-1',
        answers: [
          { questionId: 'question-1', choiceId: 'choice-1' },
          { questionId: 'question-2', choiceIds: ['choice-2', 'choice-3'] },
        ],
      });

      await request(server)
        .post('/activities/quiz-session-1/result')
        .send({ answers: [{ questionId: 'question-1' }] })
        .expect(400);

      mocks.submitActivityResult.execute.mockRejectedValueOnce(
        new Error('Activity session not found'),
      );
      await request(server)
        .post('/activities/missing-session/result')
        .send({ answers: [{ questionId: 'question-1', choiceId: 'choice-1' }] })
        .expect(404);

      mocks.submitActivityResult.execute.mockRejectedValueOnce(
        new Error('Activity session already submitted'),
      );
      await request(server)
        .post('/activities/submitted-session/result')
        .send({ answers: [{ questionId: 'question-1', choiceId: 'choice-1' }] })
        .expect(409);

      mocks.submitActivityResult.execute.mockRejectedValueOnce(
        new Error('Generated diagnostic quiz is invalid'),
      );
      await request(server)
        .post('/activities/invalid-generation/result')
        .send({ answers: [{ questionId: 'question-1', choiceId: 'choice-1' }] })
        .expect(422);
    });

    it('starts an open question without exposing correction fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/activities/open-question')
        .send({ subjectId: 'subject-1', knowledgeUnitId: 'unit-1' })
        .expect(201);
      const responseBody = response.body as OpenQuestionResponse;

      expect(mocks.startOpenQuestionActivity.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        knowledgeUnitId: 'unit-1',
      });
      expect(responseBody.type).toBe('open_question');
      assertNoSensitivePreSubmitFields(response.body);
    });

    it('validates open question start and submit payloads', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/activities/open-question')
        .send({ subjectId: 'subject-1' })
        .expect(400);
      expect(mocks.startOpenQuestionActivity.execute).not.toHaveBeenCalled();

      await request(server)
        .post('/activities/open-session-1/open-answer')
        .send({ answerText: '   ' })
        .expect(400);
      expect(mocks.submitOpenAnswer.execute).not.toHaveBeenCalled();
    });

    it('submits an open answer and maps critical evaluation errors', async () => {
      const server = app.getHttpServer();
      const answerText =
        'La distinction entre les régimes parlementaire et présidentiel repose sur la responsabilité politique du gouvernement et sur la séparation institutionnelle des pouvoirs.';

      await request(server)
        .post('/activities/open-session-1/open-answer')
        .send({ answerText })
        .expect(201);

      expect(mocks.submitOpenAnswer.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'open-session-1',
        answerText,
      });

      mocks.submitOpenAnswer.execute.mockRejectedValueOnce(
        new Error('Activity session not found'),
      );
      await request(server)
        .post('/activities/missing-session/open-answer')
        .send({ answerText })
        .expect(404);

      mocks.submitOpenAnswer.execute.mockRejectedValueOnce(
        new Error('Activity session is not an open question'),
      );
      await request(server)
        .post('/activities/quiz-session/open-answer')
        .send({ answerText })
        .expect(400);

      mocks.submitOpenAnswer.execute.mockRejectedValueOnce(
        new Error('OPEN_ANSWER_EVALUATION_INVALID'),
      );
      await request(server)
        .post('/activities/open-session-invalid/open-answer')
        .send({ answerText })
        .expect(422);
    });

    it('routes rich closed start, get, submit and result without pre-submit leaks', async () => {
      const server = app.getHttpServer();

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 6,
        })
        .expect(201);

      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 6,
        complexityProfile: 'exam',
        questionTypeMix: undefined,
      });
      const startBody = startResponse.body as ReturnType<
        typeof richClosedPublicExercise
      >;
      expect(startBody.type).toBe('rich_closed_exercise');
      expect(
        startBody.questions.map(
          (question: { questionKind: RichClosedQuestionKind }) =>
            question.questionKind,
        ),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
      ]);
      expect(
        startBody.questions.every(
          (question: { sourceChunkIds?: unknown[] }) =>
            Array.isArray(question.sourceChunkIds) &&
            question.sourceChunkIds.length > 0,
        ),
      ).toBe(true);
      assertNoSensitivePreSubmitFields(startBody);

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-1')
        .expect(200);
      expect(mocks.getRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-1',
      });
      assertNoSensitivePreSubmitFields(getResponse.body);

      mocks.getRichClosedExerciseResult.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_SESSION_NOT_COMPLETED'),
      );
      await request(server)
        .get('/activities/rich-closed/rich-session-1/result')
        .expect(409);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-1/submit')
        .send({ answers: richClosedAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-1',
        answers: richClosedAnswers(),
      });
      const submitBody = submitResponse.body as {
        items: Array<Record<string, unknown>>;
      };
      expect(submitBody).toMatchObject({
        correctAnswers: 6,
        totalQuestions: 6,
        score: 1,
      });
      expect(submitBody.items).toHaveLength(6);
      expect(submitBody.items[0]).toHaveProperty('correction');
      expect(JSON.stringify(submitBody)).toContain('explanation');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-1/result')
        .expect(200);
      expect(mocks.getRichClosedExerciseResult.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-1',
      });
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 6,
        totalQuestions: 6,
      });
    });

    it('routes rich closed V1-B timeline and date slider without pre-submit leaks', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BPublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BPublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1BResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 8,
          questionTypeMix,
        })
        .expect(201);

      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };
      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 8,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map(
          (question: { questionKind: RichClosedQuestionKind }) =>
            question.questionKind,
        ),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
      ]);
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).not.toContain('correctYear');
      expect(JSON.stringify(startBody)).not.toContain('correctOrder');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1b')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1b/submit')
        .send({ answers: richClosedV1BAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1b',
        answers: richClosedV1BAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 8,
        totalQuestions: 8,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctYear');
      expect(JSON.stringify(submitResponse.body)).toContain('correctOrder');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1b/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 8,
        totalQuestions: 8,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1b/submit')
        .send({
          answers: replaceRichClosedV1BAnswer({
            questionId: 'date-slider-1',
            questionKind: 'date_slider',
            year: 1958.5,
          } as unknown as RichClosedAnswer),
        })
        .expect(400);

      const semanticInvalidSubmissions = [
        replaceRichClosedV1BAnswer({
          questionId: 'timeline-1',
          questionKind: 'timeline',
          orderedEventIds: ['event-1', 'event-1', 'event-3'],
        }),
        replaceRichClosedV1BAnswer({
          questionId: 'timeline-1',
          questionKind: 'timeline',
          orderedEventIds: ['event-1', 'event-2', 'unknown-event'],
        }),
        replaceRichClosedV1BAnswer({
          questionId: 'timeline-1',
          questionKind: 'timeline',
          orderedEventIds: ['event-1', 'event-2'],
        }),
        replaceRichClosedV1BAnswer({
          questionId: 'date-slider-1',
          questionKind: 'date_slider',
          year: 1971,
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-v1b/submit')
          .send({ answers })
          .expect(400);
      }
    });

    it('routes rich closed V1-B true/false grid and cause/consequence without pre-submit leaks', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
        true_false_grid: 1,
        cause_consequence: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BFullPublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BFullPublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1BFullResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1BFullResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 10,
          questionTypeMix,
        })
        .expect(201);

      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };
      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 10,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map((question) => question.questionKind),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
      ]);
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).not.toContain('correctValues');
      expect(JSON.stringify(startBody)).not.toContain('correctPairs');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1b-full')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1b-full/submit')
        .send({ answers: richClosedV1BFullAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1b-full',
        answers: richClosedV1BFullAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 10,
        totalQuestions: 10,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctValues');
      expect(JSON.stringify(submitResponse.body)).toContain('correctPairs');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1b-full/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 10,
        totalQuestions: 10,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1b-full/submit')
        .send({
          answers: replaceRichClosedV1BFullAnswer({
            questionId: 'true-false-grid-1',
            questionKind: 'true_false_grid',
            values: [
              { rowId: 'row-1', value: true },
              { rowId: 'row-2', value: false },
              { rowId: 'row-3', value: 'true' },
            ],
          }),
        })
        .expect(400);

      const semanticInvalidSubmissions = [
        replaceRichClosedV1BFullAnswer({
          questionId: 'true-false-grid-1',
          questionKind: 'true_false_grid',
          values: [
            { rowId: 'row-1', value: true },
            { rowId: 'row-1', value: false },
            { rowId: 'row-3', value: true },
          ],
        }),
        replaceRichClosedV1BFullAnswer({
          questionId: 'true-false-grid-1',
          questionKind: 'true_false_grid',
          values: [
            { rowId: 'row-1', value: true },
            { rowId: 'row-2', value: false },
          ],
        }),
        replaceRichClosedV1BFullAnswer({
          questionId: 'cause-consequence-1',
          questionKind: 'cause_consequence',
          pairs: [
            { causeId: 'cause-1', consequenceId: 'consequence-1' },
            { causeId: 'cause-1', consequenceId: 'consequence-2' },
            { causeId: 'cause-3', consequenceId: 'consequence-3' },
          ],
        }),
        replaceRichClosedV1BFullAnswer({
          questionId: 'cause-consequence-1',
          questionKind: 'cause_consequence',
          pairs: [
            { causeId: 'cause-1', consequenceId: 'consequence-1' },
            { causeId: 'cause-2', consequenceId: 'unknown-consequence' },
            { causeId: 'cause-3', consequenceId: 'consequence-3' },
          ],
        }),
        replaceRichClosedV1BFullAnswer({
          questionId: 'cause-consequence-1',
          questionKind: 'cause_consequence',
          pairs: [
            { causeId: 'cause-1', consequenceId: 'consequence-1' },
            { causeId: 'cause-2', consequenceId: 'consequence-2' },
          ],
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-v1b-full/submit')
          .send({ answers })
          .expect(400);
      }
    });

    it('routes rich closed V1-C institution matrix without pre-submit leaks', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
        true_false_grid: 1,
        cause_consequence: 1,
        institution_matrix: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CPublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CPublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1CResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 11,
          questionTypeMix,
        })
        .expect(201);

      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };
      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 11,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map((question) => question.questionKind),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
        'institution_matrix',
      ]);
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).not.toContain('correctValues');
      expect(JSON.stringify(startBody)).not.toContain('explanation');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1c/submit')
        .send({ answers: richClosedV1CAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1c',
        answers: richClosedV1CAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 11,
        totalQuestions: 11,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctValues');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 11,
        totalQuestions: 11,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1c/submit')
        .send({
          answers: replaceRichClosedV1CAnswer({
            questionId: 'institution-matrix-1',
            questionKind: 'institution_matrix',
            values: [
              {
                cellId: 'cell-president-legitimacy',
                optionId: 'option-legitimacy-election',
              },
              {
                cellId: 'cell-government-responsibility',
                optionId: 42,
              },
              {
                cellId: 'cell-assembly-action',
                optionId: 'option-action-censure',
              },
            ],
          }),
        })
        .expect(400);

      const semanticInvalidSubmissions = [
        replaceRichClosedV1CAnswer({
          questionId: 'institution-matrix-1',
          questionKind: 'institution_matrix',
          values: [
            {
              cellId: 'cell-president-legitimacy',
              optionId: 'option-legitimacy-election',
            },
            {
              cellId: 'cell-president-legitimacy',
              optionId: 'option-legitimacy-confidence',
            },
            {
              cellId: 'cell-assembly-action',
              optionId: 'option-action-censure',
            },
          ],
        }),
        replaceRichClosedV1CAnswer({
          questionId: 'institution-matrix-1',
          questionKind: 'institution_matrix',
          values: [
            {
              cellId: 'unknown-cell',
              optionId: 'option-legitimacy-election',
            },
            {
              cellId: 'cell-government-responsibility',
              optionId: 'option-responsibility-assembly',
            },
            {
              cellId: 'cell-assembly-action',
              optionId: 'option-action-censure',
            },
          ],
        }),
        replaceRichClosedV1CAnswer({
          questionId: 'institution-matrix-1',
          questionKind: 'institution_matrix',
          values: [
            {
              cellId: 'cell-president-legitimacy',
              optionId: 'option-action-censure',
            },
            {
              cellId: 'cell-government-responsibility',
              optionId: 'option-responsibility-assembly',
            },
            {
              cellId: 'cell-assembly-action',
              optionId: 'option-action-censure',
            },
          ],
        }),
        replaceRichClosedV1CAnswer({
          questionId: 'institution-matrix-1',
          questionKind: 'institution_matrix',
          values: [
            {
              cellId: 'cell-president-legitimacy',
              optionId: 'option-legitimacy-election',
            },
            {
              cellId: 'cell-government-responsibility',
              optionId: 'option-responsibility-assembly',
            },
          ],
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-v1c/submit')
          .send({ answers })
          .expect(400);
      }
    });

    it('routes rich closed V1-C diagram labeling without arbitrary render payloads', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
        true_false_grid: 1,
        cause_consequence: 1,
        institution_matrix: 1,
        diagram_labeling: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CFullPublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CFullPublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CFullResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1CFullResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 12,
          questionTypeMix,
        })
        .expect(201);

      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };
      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 12,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map((question) => question.questionKind),
      ).toEqual([
        'single_choice',
        'multiple_choice',
        'matching',
        'ordering',
        'case_qualification',
        'error_detection',
        'timeline',
        'date_slider',
        'true_false_grid',
        'cause_consequence',
        'institution_matrix',
        'diagram_labeling',
      ]);
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).not.toContain('correctValues');
      expect(JSON.stringify(startBody)).not.toContain('explanation');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c-full')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1c-full/submit')
        .send({ answers: richClosedV1CFullAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1c-full',
        answers: richClosedV1CFullAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 12,
        totalQuestions: 12,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctValues');
      expect(JSON.stringify(submitResponse.body)).not.toContain(
        'renderPayload',
      );
      expect(JSON.stringify(submitResponse.body)).not.toContain('mermaid');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c-full/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 12,
        totalQuestions: 12,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1c-full/submit')
        .send({
          answers: replaceRichClosedV1CFullAnswer({
            questionId: 'diagram-labeling-1',
            questionKind: 'diagram_labeling',
            values: [
              { slotId: 'slot-government-role', optionId: 'option-government' },
              { slotId: 'slot-censure', optionId: 42 },
              { slotId: 'slot-nomination', optionId: 'option-nomination' },
            ],
          }),
        })
        .expect(400);

      await request(server)
        .post('/activities/rich-closed/rich-session-v1c-full/submit')
        .send({
          answers: replaceRichClosedV1CFullAnswer({
            questionId: 'diagram-labeling-1',
            questionKind: 'diagram_labeling',
            values: [
              { slotId: 'slot-government-role', optionId: 'option-government' },
              {
                slotId: 'slot-censure',
                optionId: 'option-motion-censure',
              },
              { slotId: 'slot-nomination', optionId: 'option-nomination' },
            ],
            renderPayload: { widget: 'free-form' },
          }),
        })
        .expect(400);

      const semanticInvalidSubmissions = [
        replaceRichClosedV1CFullAnswer({
          questionId: 'diagram-labeling-1',
          questionKind: 'diagram_labeling',
          values: [
            { slotId: 'slot-government-role', optionId: 'option-government' },
            { slotId: 'slot-government-role', optionId: 'option-president' },
            { slotId: 'slot-nomination', optionId: 'option-nomination' },
          ],
        }),
        replaceRichClosedV1CFullAnswer({
          questionId: 'diagram-labeling-1',
          questionKind: 'diagram_labeling',
          values: [
            { slotId: 'unknown-slot', optionId: 'option-government' },
            { slotId: 'slot-censure', optionId: 'option-motion-censure' },
            { slotId: 'slot-nomination', optionId: 'option-nomination' },
          ],
        }),
        replaceRichClosedV1CFullAnswer({
          questionId: 'diagram-labeling-1',
          questionKind: 'diagram_labeling',
          values: [
            {
              slotId: 'slot-government-role',
              optionId: 'option-motion-censure',
            },
            { slotId: 'slot-censure', optionId: 'option-motion-censure' },
            { slotId: 'slot-nomination', optionId: 'option-nomination' },
          ],
        }),
        replaceRichClosedV1CFullAnswer({
          questionId: 'diagram-labeling-1',
          questionKind: 'diagram_labeling',
          values: [
            { slotId: 'slot-government-role', optionId: 'option-government' },
            { slotId: 'slot-censure', optionId: 'option-motion-censure' },
          ],
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-v1c-full/submit')
          .send({ answers })
          .expect(400);
      }
    });

    it('routes rich closed V1-C calculation MCQ without formula leaks', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
        true_false_grid: 1,
        cause_consequence: 1,
        institution_matrix: 1,
        diagram_labeling: 1,
        calculation_mcq: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CCalculationPublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CCalculationPublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1CCalculationResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1CCalculationResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 13,
          questionTypeMix,
        })
        .expect(201);
      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };

      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 13,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map((question) => question.questionKind),
      ).toContain('calculation_mcq');
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).toContain('scenario');
      expect(JSON.stringify(startBody)).toContain('calculation');
      expect(JSON.stringify(startBody)).toContain('value');
      expect(JSON.stringify(startBody)).not.toContain('correctChoiceId');
      expect(JSON.stringify(startBody)).not.toContain('expectedValue');
      expect(JSON.stringify(startBody)).not.toContain('workedSteps');
      expect(JSON.stringify(startBody)).not.toContain('formula');
      expect(JSON.stringify(startBody)).not.toContain('renderPayload');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c-calculation')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1c-calculation/submit')
        .send({ answers: richClosedV1CCalculationAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1c-calculation',
        answers: richClosedV1CCalculationAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 13,
        totalQuestions: 13,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctChoiceId');
      expect(JSON.stringify(submitResponse.body)).toContain('expectedValue');
      expect(JSON.stringify(submitResponse.body)).toContain('workedSteps');
      expect(JSON.stringify(submitResponse.body)).not.toContain('formula');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1c-calculation/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 13,
        totalQuestions: 13,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1c-calculation/submit')
        .send({
          answers: replaceRichClosedV1CCalculationAnswer({
            questionId: 'calculation-mcq-majority-1',
            questionKind: 'calculation_mcq',
            choiceId: 289,
          }),
        })
        .expect(400);

      await request(server)
        .post('/activities/rich-closed/rich-session-v1c-calculation/submit')
        .send({
          answers: replaceRichClosedV1CCalculationAnswer({
            questionId: 'calculation-mcq-majority-1',
            questionKind: 'calculation_mcq',
            choiceId: 'choice-289',
            formula: 'floor(validVotes / 2) + 1',
          }),
        })
        .expect(400);

      mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
      );
      await request(server)
        .post('/activities/rich-closed/rich-session-v1c-calculation/submit')
        .send({
          answers: replaceRichClosedV1CCalculationAnswer({
            questionId: 'calculation-mcq-majority-1',
            questionKind: 'calculation_mcq',
            choiceId: 'unknown-choice',
          }),
        })
        .expect(400);
    });

    it('routes rich closed V1-D image choice without image asset leaks', async () => {
      const server = app.getHttpServer();
      const questionTypeMix = {
        single_choice: 1,
        multiple_choice: 1,
        matching: 1,
        ordering: 1,
        case_qualification: 1,
        error_detection: 1,
        timeline: 1,
        date_slider: 1,
        true_false_grid: 1,
        cause_consequence: 1,
        institution_matrix: 1,
        diagram_labeling: 1,
        calculation_mcq: 1,
        image_choice: 1,
      };
      mocks.startRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1DImageChoicePublicExercise(),
      );
      mocks.getRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1DImageChoicePublicExercise(),
      );
      mocks.submitRichClosedExercise.execute.mockResolvedValueOnce(
        richClosedV1DImageChoiceResult(),
      );
      mocks.getRichClosedExerciseResult.execute.mockResolvedValueOnce(
        richClosedV1DImageChoiceResult(),
      );

      const startResponse = await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 14,
          questionTypeMix,
        })
        .expect(201);
      const startBody = startResponse.body as {
        questions: Array<{ questionKind: RichClosedQuestionKind }>;
        [key: string]: unknown;
      };

      expect(mocks.startRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        questionCount: 14,
        complexityProfile: 'exam',
        questionTypeMix,
      });
      expect(
        startBody.questions.map((question) => question.questionKind),
      ).toContain('image_choice');
      assertNoSensitivePreSubmitFields(startBody);
      expect(JSON.stringify(startBody)).toContain(
        'image-choice-historical-figure-001-v1',
      );
      expect(JSON.stringify(startBody)).toContain('altText');
      expect(JSON.stringify(startBody)).toContain('internal_placeholder');
      expect(JSON.stringify(startBody)).not.toContain('correctChoiceId');
      expect(JSON.stringify(startBody)).not.toContain('semanticLabel');
      expect(JSON.stringify(startBody)).not.toContain('answerHint');
      expect(JSON.stringify(startBody)).not.toContain('imageUrl');
      expect(JSON.stringify(startBody)).not.toContain('base64');
      expect(JSON.stringify(startBody)).not.toContain('blob');
      expect(JSON.stringify(startBody)).not.toContain('storagePath');
      expect(JSON.stringify(startBody)).not.toContain('de-gaulle');
      expect(JSON.stringify(startBody)).not.toContain('napoleon');
      expect(JSON.stringify(startBody)).not.toContain('simone');

      const getResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1d-image-choice')
        .expect(200);
      assertNoSensitivePreSubmitFields(getResponse.body);
      expect(JSON.stringify(getResponse.body)).not.toContain('de-gaulle');
      expect(JSON.stringify(getResponse.body)).not.toContain('napoleon');
      expect(JSON.stringify(getResponse.body)).not.toContain('simone');

      const submitResponse = await request(server)
        .post('/activities/rich-closed/rich-session-v1d-image-choice/submit')
        .send({ answers: richClosedV1DImageChoiceAnswers() })
        .expect(201);

      expect(mocks.submitRichClosedExercise.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'rich-session-v1d-image-choice',
        answers: richClosedV1DImageChoiceAnswers(),
      });
      expect(submitResponse.body).toMatchObject({
        correctAnswers: 14,
        totalQuestions: 14,
        score: 1,
      });
      expect(JSON.stringify(submitResponse.body)).toContain('correctChoiceId');
      expect(JSON.stringify(submitResponse.body)).not.toContain('imageUrl');
      expect(JSON.stringify(submitResponse.body)).not.toContain('base64');

      const resultResponse = await request(server)
        .get('/activities/rich-closed/rich-session-v1d-image-choice/result')
        .expect(200);
      expect(resultResponse.body).toMatchObject({
        status: 'completed',
        correctAnswers: 14,
        totalQuestions: 14,
      });

      await request(server)
        .post('/activities/rich-closed/rich-session-v1d-image-choice/submit')
        .send({
          answers: replaceRichClosedV1DImageChoiceAnswer({
            questionId: 'image-choice-1',
            questionKind: 'image_choice',
            choiceId: 42,
          }),
        })
        .expect(400);

      await request(server)
        .post('/activities/rich-closed/rich-session-v1d-image-choice/submit')
        .send({
          answers: replaceRichClosedV1DImageChoiceAnswer({
            questionId: 'image-choice-1',
            questionKind: 'image_choice',
            choiceId: 'choice-image-a',
            imageUrl: 'https://example.invalid/image.png',
            blob: 'blob://unsafe',
          }),
        })
        .expect(400);

      mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
      );
      await request(server)
        .post('/activities/rich-closed/rich-session-v1d-image-choice/submit')
        .send({
          answers: replaceRichClosedV1DImageChoiceAnswer({
            questionId: 'image-choice-1',
            questionKind: 'image_choice',
            choiceId: 'unknown-choice',
          }),
        })
        .expect(400);
    });

    it('validates and maps rich closed errors', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 5,
        })
        .expect(400);
      expect(mocks.startRichClosedExercise.execute).not.toHaveBeenCalled();

      await request(server)
        .post('/activities/rich-closed/rich-session-1/submit')
        .send({
          answers: [
            {
              questionId: 'single-1',
              questionKind: 'single_choice',
              choiceId: 'choice-a',
              modelAnswer: 'interdit',
            },
          ],
        })
        .expect(400);
      expect(mocks.submitRichClosedExercise.execute).not.toHaveBeenCalled();

      await request(server)
        .post('/activities/rich-closed/rich-session-1/submit')
        .send({
          answers: [
            ...richClosedAnswers(),
            {
              questionId: 'single-1',
              questionKind: 'single_choice',
              choiceId: 'choice-a',
            },
          ],
        })
        .expect(400);
      expect(mocks.submitRichClosedExercise.execute).not.toHaveBeenCalled();

      const semanticInvalidSubmissions = [
        replaceRichClosedAnswer({
          questionId: 'single-1',
          questionKind: 'single_choice',
          choiceId: 'unknown-choice',
        }),
        richClosedAnswers().filter(
          (answer) => answer.questionId !== 'single-1',
        ),
        replaceRichClosedAnswer({
          questionId: 'matching-1',
          questionKind: 'matching',
          pairs: [
            { leftId: 'left-1', rightId: 'right-1' },
            { leftId: 'left-2', rightId: 'unknown-right' },
            { leftId: 'left-3', rightId: 'right-3' },
          ],
        }),
        replaceRichClosedAnswer({
          questionId: 'ordering-1',
          questionKind: 'ordering',
          orderedIds: ['item-1', 'item-2'],
        }),
      ];

      for (const answers of semanticInvalidSubmissions) {
        mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
          new Error('RICH_CLOSED_SUBMIT_INVALID_INPUT'),
        );
        await request(server)
          .post('/activities/rich-closed/rich-session-1/submit')
          .send({ answers })
          .expect(400);
      }

      mocks.getRichClosedExercise.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_SESSION_NOT_FOUND'),
      );
      await request(server)
        .get('/activities/rich-closed/missing-session')
        .expect(404);

      mocks.submitRichClosedExercise.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_SESSION_ALREADY_COMPLETED'),
      );
      await request(server)
        .post('/activities/rich-closed/rich-session-1/submit')
        .send({ answers: richClosedAnswers() })
        .expect(409);

      mocks.startRichClosedExercise.execute.mockRejectedValueOnce(
        new Error('RICH_CLOSED_GENERATION_QUALITY_REJECTED'),
      );
      await request(server)
        .post('/activities/rich-closed/start')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          questionCount: 6,
        })
        .expect(422);
    });

    it('routes revision sessions and next actions without free-message leakage', async () => {
      const server = app.getHttpServer();

      const startResponse = await request(server)
        .post('/revision-sessions')
        .send({
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          preferredAction: 'open_question',
        })
        .expect(201);

      expect(mocks.startRevisionSession.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: undefined,
        knowledgeUnitId: 'unit-1',
        preferredAction: 'open_question',
      });
      assertNoSensitivePreSubmitFields(startResponse.body);

      await request(server)
        .get('/revision-sessions/revision-session-1')
        .expect(200);
      expect(mocks.getRevisionSession.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'revision-session-1',
      });

      await request(server)
        .post('/revision-sessions/revision-session-1/next-action')
        .send({ message: 'ignore this free text' })
        .expect(201);

      expect(mocks.requestNextAction.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        sessionId: 'revision-session-1',
      });
      expect(
        JSON.stringify(mocks.requestNextAction.execute.mock.calls),
      ).not.toContain('ignore this free text');
    });

    it('routes rich closed revision sessions as bounded launchers', async () => {
      mocks.startRevisionSession.execute.mockResolvedValueOnce(
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

      expect(mocks.startRevisionSession.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        preferredAction: 'rich_closed_exercise',
      });
      const body = response.body as ReturnType<
        typeof richClosedRevisionSessionResponse
      >;

      expect(body.currentAction).toMatchObject({
        kind: 'RICH_CLOSED_EXERCISE',
        activitySessionId: null,
        payload: {
          type: 'rich_closed_exercise',
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
          preferredAction: 'rich_closed_exercise',
        },
      });
      expect(body.currentAction.payload).not.toHaveProperty('questions');
      expect(body.currentAction.payload).not.toHaveProperty('correction');
      assertNoSensitivePreSubmitFields(body);
    });

    it('validates and maps revision session errors', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/revision-sessions')
        .send({ subjectId: 'subject-1', preferredAction: 'chat' })
        .expect(400);
      expect(mocks.startRevisionSession.execute).not.toHaveBeenCalled();

      mocks.startRevisionSession.execute.mockRejectedValueOnce(
        new Error('Open question revision session requires a knowledge unit'),
      );
      await request(server)
        .post('/revision-sessions')
        .send({ subjectId: 'subject-1', preferredAction: 'open_question' })
        .expect(422);

      mocks.getRevisionSession.execute.mockRejectedValueOnce(
        new Error('Revision session not found'),
      );
      await request(server)
        .get('/revision-sessions/missing-session')
        .expect(404);
    });
  });
});

async function createAppWithRealAuthGuard(): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(TOKEN_VERIFIER)
    .useValue({ verify: jest.fn() })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}

async function createAuthenticatedApp(
  mocks: CriticalPathMocks,
): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(FirebaseAuthGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        // The e2e suite verifies controller contracts, not Firebase itself.
        // Injecting an explicit fake student keeps every request scoped while
        // avoiding Firebase Admin and BootstrapStudentUseCase side effects.
        const httpRequest = context
          .switchToHttp()
          .getRequest<{ student?: typeof currentStudent }>();
        httpRequest.student = currentStudent;
        return true;
      },
    })
    .overrideProvider(TOKEN_VERIFIER)
    .useValue({ verify: jest.fn() })
    .overrideProvider(PrismaService)
    .useValue({})
    .overrideProvider(GetDocumentUseCase)
    .useValue(mocks.getDocument)
    .overrideProvider(ListDocumentKnowledgeUnitsUseCase)
    .useValue(mocks.listDocumentKnowledgeUnits)
    .overrideProvider(GetDocumentSummaryUseCase)
    .useValue(mocks.getDocumentSummary)
    .overrideProvider(GenerateDocumentSummaryUseCase)
    .useValue(mocks.generateDocumentSummary)
    .overrideProvider(GetRevisionSheetUseCase)
    .useValue(mocks.getRevisionSheet)
    .overrideProvider(GenerateRevisionSheetUseCase)
    .useValue(mocks.generateRevisionSheet)
    .overrideProvider(GetTodayPlanUseCase)
    .useValue(mocks.getTodayPlan)
    .overrideProvider(CreateCourseUseCase)
    .useValue(mocks.createCourse)
    .overrideProvider(ListSubjectCoursesWithStatsUseCase)
    .useValue(mocks.listCoursesWithStats)
    .overrideProvider(GetCourseDetailUseCase)
    .useValue(mocks.getCourseDetail)
    .overrideProvider(DeleteCourseUseCase)
    .useValue(mocks.deleteCourse)
    .overrideProvider(StartNextActivityUseCase)
    .useValue(mocks.startNextActivity)
    .overrideProvider(StartOpenQuestionActivityUseCase)
    .useValue(mocks.startOpenQuestionActivity)
    .overrideProvider(SubmitActivityResultUseCase)
    .useValue(mocks.submitActivityResult)
    .overrideProvider(SubmitOpenAnswerUseCase)
    .useValue(mocks.submitOpenAnswer)
    .overrideProvider(StartRichClosedExerciseUseCase)
    .useValue(mocks.startRichClosedExercise)
    .overrideProvider(GetRichClosedExerciseUseCase)
    .useValue(mocks.getRichClosedExercise)
    .overrideProvider(SubmitRichClosedExerciseUseCase)
    .useValue(mocks.submitRichClosedExercise)
    .overrideProvider(GetRichClosedExerciseResultUseCase)
    .useValue(mocks.getRichClosedExerciseResult)
    .overrideProvider(StartRevisionSessionUseCase)
    .useValue(mocks.startRevisionSession)
    .overrideProvider(GetRevisionSessionUseCase)
    .useValue(mocks.getRevisionSession)
    .overrideProvider(RequestNextRevisionSessionActionUseCase)
    .useValue(mocks.requestNextAction)
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}

function createCriticalPathMocks() {
  return {
    getDocument: {
      execute: jest.fn().mockResolvedValue(publicDocument()),
    },
    listDocumentKnowledgeUnits: {
      execute: jest.fn().mockResolvedValue(documentKnowledgeUnits()),
    },
    getDocumentSummary: {
      execute: jest.fn().mockResolvedValue(documentSummary()),
    },
    generateDocumentSummary: {
      execute: jest.fn().mockResolvedValue(documentSummary()),
    },
    getRevisionSheet: {
      execute: jest.fn().mockResolvedValue(revisionSheet()),
    },
    generateRevisionSheet: {
      execute: jest.fn().mockResolvedValue(revisionSheet()),
    },
    getTodayPlan: {
      execute: jest.fn().mockResolvedValue(todayPlan()),
    },
    createCourse: {
      execute: jest.fn().mockResolvedValue(courseWithStats({ sourceCount: 0 })),
    },
    listCoursesWithStats: {
      execute: jest.fn().mockResolvedValue([
        courseWithStats({
          sourceCount: 1,
          readySourceCount: 1,
        }),
      ]),
    },
    getCourseDetail: {
      execute: jest.fn().mockResolvedValue(courseDetail()),
    },
    deleteCourse: {
      execute: jest.fn().mockResolvedValue({ deleted: true }),
    },
    startNextActivity: {
      execute: jest.fn().mockResolvedValue(diagnosticQuizActivity()),
    },
    startOpenQuestionActivity: {
      execute: jest.fn().mockResolvedValue(openQuestionActivity()),
    },
    submitActivityResult: {
      execute: jest.fn().mockResolvedValue(qcmSubmissionResult()),
    },
    submitOpenAnswer: {
      execute: jest.fn().mockResolvedValue(openAnswerSubmissionResult()),
    },
    startRichClosedExercise: {
      execute: jest.fn().mockResolvedValue(richClosedPublicExercise()),
    },
    getRichClosedExercise: {
      execute: jest.fn().mockResolvedValue(richClosedPublicExercise()),
    },
    submitRichClosedExercise: {
      execute: jest.fn().mockResolvedValue(richClosedResult()),
    },
    getRichClosedExerciseResult: {
      execute: jest.fn().mockResolvedValue(richClosedResult()),
    },
    startRevisionSession: {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    },
    getRevisionSession: {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    },
    requestNextAction: {
      execute: jest.fn().mockResolvedValue(revisionSessionResponse()),
    },
  };
}

function courseWithStats(overrides: Record<string, unknown> = {}) {
  return {
    id: 'course-1',
    studentId: currentStudent.id,
    subjectId: 'subject-1',
    title: 'Droit constitutionnel',
    description: 'Institutions',
    chapterLabel: 'Chapitre 1',
    estimatedMinutes: 30,
    displayOrder: 0,
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
    sourceCount: 0,
    readySourceCount: 0,
    processingSourceCount: 0,
    failedSourceCount: 0,
    ...overrides,
  };
}

function courseDetail() {
  return {
    course: courseWithStats({
      sourceCount: 1,
      readySourceCount: 1,
    }),
    subject: {
      id: 'subject-1',
      name: 'Droit constitutionnel',
    },
    sources: [
      {
        id: 'document-1',
        courseId: 'course-1',
        documentId: 'document-1',
        fileName: 'cours.pdf',
        kind: 'COURSE_PDF',
        status: 'READY',
        errorCode: null,
        createdAt: new Date('2026-06-18T10:00:00.000Z'),
        updatedAt: new Date('2026-06-18T10:00:00.000Z'),
      },
    ],
  };
}

function publicDocument() {
  return {
    id: 'document-1',
    subjectId: 'subject-1',
    kind: 'COURSE_PDF',
    fileName: 'demo-droit-constitutionnel.pdf',
    mimeType: 'application/pdf',
    status: 'READY',
    errorCode: null,
  };
}

function documentKnowledgeUnits() {
  return {
    documentId: 'document-1',
    items: [
      {
        id: 'unit-1',
        subjectId: 'subject-1',
        documentId: 'document-1',
        title: 'Séparation des pouvoirs',
        summary: 'La séparation des pouvoirs organise les institutions.',
        difficulty: 'MEDIUM',
        displayOrder: 0,
        sources: [
          {
            chunkId: 'chunk-1',
            pageNumber: 1,
            index: 0,
          },
        ],
      },
    ],
  };
}

function documentSummary() {
  return {
    id: 'summary-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY',
    title: 'Synthèse de démonstration',
    content: 'La Ve République articule stabilité exécutive et contrôle.',
    keyPoints: ['Séparation des pouvoirs', 'Contrôle constitutionnel'],
    limits: 'Synthèse courte issue des fixtures de démonstration.',
    errorCode: null,
    metadata: {
      provider: 'demo-seed',
      promptVersion: 'demo-seed-v1',
    },
    storagePath: 'internal/demo.pdf',
    sources: [
      {
        chunkId: 'chunk-1',
        text: 'Extrait borné.',
        pageNumber: 1,
        index: 0,
        relevanceScore: 0.9,
      },
    ],
  };
}

function revisionSheet() {
  return {
    id: 'sheet-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY',
    title: 'Fiche de démonstration',
    introduction: 'Fiche courte de droit constitutionnel.',
    keyPoints: ['Pouvoir exécutif', 'Parlement'],
    commonMistakes: ['Confondre régime parlementaire et présidentiel.'],
    mustKnow: ['Responsabilité politique du gouvernement.'],
    practiceSuggestions: ['Comparer deux institutions.'],
    errorCode: null,
    metadata: {
      provider: 'demo-seed',
      promptVersion: 'demo-seed-v1',
    },
    sections: [
      {
        id: 'section-1',
        displayOrder: 0,
        title: 'Institutions',
        content: 'Le régime organise les rapports entre les pouvoirs.',
        sources: [
          {
            chunkId: 'chunk-2',
            text: 'Extrait de fiche borné.',
            pageNumber: 2,
            index: 1,
            relevanceScore: 0.8,
          },
        ],
      },
    ],
  };
}

function todayPlan() {
  return {
    generatedAt: new Date('2026-06-15T12:00:00.000Z'),
    items: [
      {
        id: 'today-1',
        subjectId: 'subject-1',
        subjectName: 'Droit constitutionnel',
        knowledgeUnitId: 'unit-1',
        knowledgeUnitTitle: 'Séparation des pouvoirs',
        masteryScore: 0.2,
        action: 'diagnostic_quiz',
        estimatedMinutes: 12,
        priority: 170,
        reasonCode: 'LOW_MASTERY',
        reason: 'À revoir en priorité.',
        startPayload: {
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
          preferredAction: 'diagnostic_quiz',
        },
      },
      {
        id: 'today-2',
        subjectId: 'subject-1',
        subjectName: 'Droit constitutionnel',
        knowledgeUnitId: 'unit-2',
        knowledgeUnitTitle: 'Contrôle de constitutionnalité',
        masteryScore: null,
        action: 'open_question',
        estimatedMinutes: 18,
        priority: 140,
        reasonCode: 'MIX_ACTIVITY_TYPE',
        reason: 'Change de format pour renforcer la mémorisation.',
        startPayload: {
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-2',
          preferredAction: 'open_question',
        },
      },
      {
        id: 'today-3',
        subjectId: 'subject-1',
        subjectName: 'Droit constitutionnel',
        documentId: 'document-1',
        knowledgeUnitId: 'unit-1',
        knowledgeUnitTitle: 'Séparation des pouvoirs',
        masteryScore: 0.2,
        action: 'rich_closed_exercise',
        estimatedMinutes: 8,
        priority: 130,
        reasonCode: 'RICH_CLOSED_PRACTICE',
        reason: 'Questions riches recommandées pour consolider la notion.',
        startPayload: {
          subjectId: 'subject-1',
          documentId: 'document-1',
          knowledgeUnitId: 'unit-1',
        },
      },
      {
        id: 'today-4',
        subjectId: 'subject-1',
        subjectName: 'Droit constitutionnel',
        knowledgeUnitId: 'unit-1',
        knowledgeUnitTitle: 'Séparation des pouvoirs',
        masteryScore: 0.2,
        action: 'revision_session',
        estimatedMinutes: 25,
        priority: 120,
        reasonCode: 'START_REVISION_SESSION',
        reason: 'Lance une session guidée.',
        startPayload: {
          subjectId: 'subject-1',
          knowledgeUnitId: 'unit-1',
        },
      },
    ],
  };
}

function diagnosticQuizActivity() {
  return {
    sessionId: 'quiz-session-1',
    type: 'diagnostic_quiz',
    title: 'QCM de démonstration',
    questions: [
      {
        id: 'question-1',
        prompt: 'Quel principe organise les pouvoirs ?',
        difficulty: 'MEDIUM',
        selectionMode: 'single',
        choices: [
          { id: 'choice-1', label: 'La séparation des pouvoirs' },
          { id: 'choice-2', label: 'La confusion des pouvoirs' },
        ],
        sources: [{ chunkId: 'chunk-1', pageNumber: 1, index: 0 }],
      },
    ],
  };
}

function qcmSubmissionResult() {
  return {
    correctAnswers: 2,
    totalQuestions: 2,
    score: 1,
    knowledgeUnitId: 'unit-1',
    items: [
      {
        questionId: 'question-1',
        selectedChoiceId: 'choice-1',
        correctChoiceId: 'choice-1',
        isCorrect: true,
      },
    ],
  };
}

function openQuestionActivity() {
  return {
    sessionId: 'open-session-1',
    type: 'open_question',
    version: 1,
    subjectId: 'subject-1',
    documentId: 'document-1',
    knowledgeUnitId: 'unit-1',
    question: {
      id: 'open-question-1',
      prompt: 'Explique la séparation des pouvoirs.',
      instructions: 'Structure ta réponse en deux paragraphes.',
      maxAnswerLength: 2500,
      sources: [{ chunkId: 'chunk-1', pageNumber: 1, index: 0 }],
    },
  };
}

function openAnswerSubmissionResult() {
  return {
    sessionId: 'open-session-1',
    type: 'open_question',
    status: 'submitted',
    evaluation: {
      id: 'evaluation-1',
      status: 'READY',
      score: 16,
      maxScore: 20,
      feedback: 'Réponse structurée.',
      presentPoints: ['Séparation institutionnelle'],
      missingPoints: ['Responsabilité politique'],
      errors: [],
      modelAnswer: 'La séparation des pouvoirs distingue les fonctions.',
      advice: 'Revois le régime parlementaire.',
      sources: [
        {
          chunkId: 'chunk-1',
          text: 'Extrait post-submit borné.',
          pageNumber: 1,
          index: 0,
        },
      ],
    },
  };
}

function richClosedPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-1',
    exercise: richClosedExerciseFixture(),
  });
}

function richClosedV1BPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1b',
    exercise: richClosedV1BExerciseFixture(),
  });
}

function richClosedV1BFullPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1b-full',
    exercise: richClosedV1BFullExerciseFixture(),
  });
}

function richClosedV1CPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1c',
    exercise: richClosedV1CExerciseFixture(),
  });
}

function richClosedV1CFullPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1c-full',
    exercise: richClosedV1CFullExerciseFixture(),
  });
}

function richClosedV1CCalculationPublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1c-calculation',
    exercise: richClosedV1CCalculationExerciseFixture(),
  });
}

function richClosedV1DImageChoicePublicExercise() {
  return toRichClosedPublicExerciseEnvelope({
    sessionId: 'rich-session-v1d-image-choice',
    exercise: richClosedV1DImageChoiceExerciseFixture(),
  });
}

function richClosedResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-1',
    exercise: richClosedExerciseFixture(),
    answers: richClosedAnswers(),
  });
}

function richClosedV1BResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1b',
    exercise: richClosedV1BExerciseFixture(),
    answers: richClosedV1BAnswers(),
  });
}

function richClosedV1BFullResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1b-full',
    exercise: richClosedV1BFullExerciseFixture(),
    answers: richClosedV1BFullAnswers(),
  });
}

function richClosedV1CResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1c',
    exercise: richClosedV1CExerciseFixture(),
    answers: richClosedV1CAnswers(),
  });
}

function richClosedV1CFullResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1c-full',
    exercise: richClosedV1CFullExerciseFixture(),
    answers: richClosedV1CFullAnswers(),
  });
}

function richClosedV1CCalculationResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1c-calculation',
    exercise: richClosedV1CCalculationExerciseFixture(),
    answers: richClosedV1CCalculationAnswers(),
  });
}

function richClosedV1DImageChoiceResult() {
  return scoreRichClosedExerciseSubmission({
    sessionId: 'rich-session-v1d-image-choice',
    exercise: richClosedV1DImageChoiceExerciseFixture(),
    answers: richClosedV1DImageChoiceAnswers(),
  });
}

function richClosedAnswers(): RichClosedAnswer[] {
  return [
    {
      questionId: 'single-1',
      questionKind: 'single_choice',
      choiceId: 'choice-a',
    },
    {
      questionId: 'multiple-1',
      questionKind: 'multiple_choice',
      choiceIds: ['choice-a', 'choice-b'],
    },
    {
      questionId: 'matching-1',
      questionKind: 'matching',
      pairs: [
        { leftId: 'left-1', rightId: 'right-1' },
        { leftId: 'left-2', rightId: 'right-2' },
        { leftId: 'left-3', rightId: 'right-3' },
      ],
    },
    {
      questionId: 'ordering-1',
      questionKind: 'ordering',
      orderedIds: ['item-1', 'item-2', 'item-3'],
    },
    {
      questionId: 'case-1',
      questionKind: 'case_qualification',
      choiceId: 'choice-a',
    },
    {
      questionId: 'error-1',
      questionKind: 'error_detection',
      errorId: 'error-a',
    },
  ];
}

function richClosedV1BAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedAnswers(),
    {
      questionId: 'timeline-1',
      questionKind: 'timeline',
      orderedEventIds: ['event-1', 'event-2', 'event-3'],
    },
    {
      questionId: 'date-slider-1',
      questionKind: 'date_slider',
      year: 1958,
    },
  ];
}

function richClosedV1BFullAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedV1BAnswers(),
    {
      questionId: 'true-false-grid-1',
      questionKind: 'true_false_grid',
      values: [
        { rowId: 'row-1', value: true },
        { rowId: 'row-2', value: false },
        { rowId: 'row-3', value: true },
      ],
    },
    {
      questionId: 'cause-consequence-1',
      questionKind: 'cause_consequence',
      pairs: [
        { causeId: 'cause-1', consequenceId: 'consequence-1' },
        { causeId: 'cause-2', consequenceId: 'consequence-2' },
        { causeId: 'cause-3', consequenceId: 'consequence-3' },
      ],
    },
  ];
}

function richClosedV1CAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedV1BFullAnswers(),
    {
      questionId: 'institution-matrix-1',
      questionKind: 'institution_matrix',
      values: [
        {
          cellId: 'cell-president-legitimacy',
          optionId: 'option-legitimacy-election',
        },
        {
          cellId: 'cell-government-responsibility',
          optionId: 'option-responsibility-assembly',
        },
        {
          cellId: 'cell-assembly-action',
          optionId: 'option-action-censure',
        },
      ],
    },
  ];
}

function richClosedV1CFullAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedV1CAnswers(),
    {
      questionId: 'diagram-labeling-1',
      questionKind: 'diagram_labeling',
      values: [
        {
          slotId: 'slot-government-role',
          optionId: 'option-government',
        },
        {
          slotId: 'slot-censure',
          optionId: 'option-motion-censure',
        },
        {
          slotId: 'slot-nomination',
          optionId: 'option-nomination',
        },
      ],
    },
  ];
}

function richClosedV1CCalculationAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedV1CFullAnswers(),
    {
      questionId: 'calculation-mcq-majority-1',
      questionKind: 'calculation_mcq',
      choiceId: 'choice-289',
    },
  ];
}

function richClosedV1DImageChoiceAnswers(): RichClosedAnswer[] {
  return [
    ...richClosedV1CCalculationAnswers(),
    {
      questionId: 'image-choice-1',
      questionKind: 'image_choice',
      choiceId: 'choice-image-a',
    },
  ];
}

function replaceRichClosedAnswer(answer: RichClosedAnswer): RichClosedAnswer[] {
  return richClosedAnswers().map((currentAnswer) =>
    currentAnswer.questionId === answer.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1BAnswer(
  answer: RichClosedAnswer,
): RichClosedAnswer[] {
  return richClosedV1BAnswers().map((currentAnswer) =>
    currentAnswer.questionId === answer.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1BFullAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return richClosedV1BFullAnswers().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1CAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return richClosedV1CAnswers().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1CFullAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return richClosedV1CFullAnswers().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1CCalculationAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return richClosedV1CCalculationAnswers().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function replaceRichClosedV1DImageChoiceAnswer(answer: unknown): unknown[] {
  const record =
    typeof answer === 'object' && answer !== null
      ? (answer as { questionId?: unknown })
      : {};

  return richClosedV1DImageChoiceAnswers().map((currentAnswer) =>
    currentAnswer.questionId === record.questionId ? answer : currentAnswer,
  );
}

function revisionSessionResponse() {
  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      createdAt: new Date('2026-06-15T12:00:00.000Z'),
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
      payload: openQuestionActivity(),
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
      createdAt: new Date('2026-06-15T12:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-rich-1',
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
        id: 'action-rich-1',
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

function assertNoSensitivePreSubmitFields(payload: unknown): void {
  expect(collectSensitivePreSubmitFields(payload)).toEqual([]);
}

const forbiddenPreSubmitFields = new Set([
  'correction',
  'correctionPayload',
  'explanation',
  'feedback',
  'choiceFeedback',
  'modelAnswer',
  'answerText',
  'freeTextAnswer',
  'textAnswer',
  'score',
  'partialScore',
  'expectedValue',
  'workedSteps',
  'answersPayload',
  'semanticLabel',
  'answerHint',
  'storagePath',
  'promptVersion',
  'completion',
  'html',
  'svg',
  'rawSvg',
  'mermaid',
  'markdown',
  'widget',
  'component',
  'renderPayload',
  'style',
  'css',
  'script',
  'formula',
  'expression',
  'rawFormula',
  'calculationCode',
  'javascript',
  'python',
  'imageUrl',
  'assetUrl',
  'url',
  'remoteUrl',
  'src',
  'href',
  'bucketPath',
  'cdnUrl',
  'base64',
  'dataUri',
  'blob',
  'rawImage',
  'assetPath',
  'canvas',
  'code',
  'markup',
]);

function collectSensitivePreSubmitFields(
  value: unknown,
  path: string[] = [],
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectSensitivePreSubmitFields(item, [...path, String(index)]),
    );
  }

  if (typeof value !== 'object' || value === null) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const nextPath = [...path, key];
    const currentViolation =
      key.startsWith('correct') || forbiddenPreSubmitFields.has(key)
        ? [nextPath.join('.')]
        : [];

    return [
      ...currentViolation,
      ...collectSensitivePreSubmitFields(nestedValue, nextPath),
    ];
  });
}

```
