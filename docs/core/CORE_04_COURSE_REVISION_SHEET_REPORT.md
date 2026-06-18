# CORE-04 — Course-level revision sheet V0 depuis une source READY

## 1. Résumé du lot

CORE-04 côté backend est réalisé. Le backend expose maintenant deux endpoints course-level pour la fiche de révision :

- `GET /courses/:courseId/revision-sheet`
- `POST /courses/:courseId/revision-sheet`

Ces endpoints prennent uniquement `courseId`, vérifient l’ownership via `studentId`, sélectionnent côté serveur la première source PDF attachée au cours en statut `READY`, puis réutilisent les use cases document-level existants `GetRevisionSheetUseCase` et `GenerateRevisionSheetUseCase`. Aucun moteur de fiche parallèle, aucun prompt Genkit nouveau, aucune migration Prisma et aucune table `CourseSource` n’ont été ajoutés.

## 2. Audit initial

Sources inspectées côté API :

- `docs/core/CORE_01_COURSE_MINIMAL_DOCUMENT_COURSE_ID_REPORT.md`
- `docs/core/CORE_02_COURSE_API_AND_FRONT_INTEGRATION_REPORT.md`
- `docs/core/CORE_03_COURSE_SOURCE_UPLOAD_PROCESSING_REPORT.md`
- `src/modules/study-artifacts/**`
- `src/modules/courses/**`
- `src/modules/documents/**`
- `test/critical-paths.e2e-spec.ts`

Constats :

- Les fiches document-level existaient déjà dans `study-artifacts` via `GET/POST /documents/:documentId/revision-sheet`.
- `GetRevisionSheetUseCase` récupère une fiche existante par `studentId + documentId`.
- `GenerateRevisionSheetUseCase` est déjà idempotent : il renvoie une fiche `READY` existante si disponible avant de générer.
- `GenerateRevisionSheetUseCase` vérifie déjà que le document appartient à l’étudiant et que le document est `READY`.
- `StudyArtifactsModule` exportait déjà les use cases nécessaires, ce qui a permis une dépendance propre `CoursesModule -> StudyArtifactsModule`.
- Le mapper public de fiche vivait dans `StudyArtifactsController`; il a été extrait pour éviter deux mappers divergents.
- `CoursesRepository` savait déjà lire les détails de cours et les sources, mais ne proposait pas encore une sélection dédiée “première source PDF READY”.

## 3. Choix d’architecture

- Logique métier course-level placée dans `src/modules/courses/application/course-revision-sheet.use-case.ts`.
- Endpoints ajoutés dans `CoursesController`, sans logique lourde dans le controller.
- Repository Prisma enrichi avec `findFirstReadyCoursePdfDocumentForCourse`.
- Sélection V0 déterministe : `studentId`, `courseId`, `kind = COURSE_PDF`, `status = READY`, tri `createdAt ASC`, puis `id ASC`.
- Mapper public extrait dans `study-artifact-response.mapper.ts`, réutilisé par les endpoints document-level et course-level.
- Erreur métier dédiée `CourseRevisionSheetSourceNotReadyError`, mappée en `409 Conflict` avec message stable `Course has no ready source`.

## 4. Détail backend

### Endpoints ajoutés

`GET /courses/:courseId/revision-sheet` :

- vérifie le cours via le use case course-level ;
- sélectionne la première source prête côté serveur ;
- délègue à `GetRevisionSheetUseCase` ;
- retourne `404 Revision sheet not found` si aucune fiche n’existe encore ;
- retourne `409 Course has no ready source` si aucune source PDF prête n’existe.

`POST /courses/:courseId/revision-sheet` :

- vérifie le cours ;
- sélectionne la première source prête côté serveur ;
- délègue à `GenerateRevisionSheetUseCase` ;
- retourne la même forme publique que la fiche document-level.

## 5. Détail frontend

Voir le rapport app pour le détail UI. Côté API, aucune dépendance Flutter n’a été touchée.

## 6. Endpoints ajoutés ou réutilisés

Ajoutés :

- `GET /courses/:courseId/revision-sheet`
- `POST /courses/:courseId/revision-sheet`

Réutilisés :

- use cases document-level `GetRevisionSheetUseCase` et `GenerateRevisionSheetUseCase`.
- DTO public de fiche existant via `toPublicRevisionSheet`.

## 7. Fichiers créés/modifiés/supprimés

Créés :

- `src/modules/courses/application/course-revision-sheet.use-case.spec.ts`
- `src/modules/courses/application/course-revision-sheet.use-case.ts`
- `src/modules/study-artifacts/interfaces/study-artifact-response.mapper.ts`

Modifiés :

- `src/modules/courses/application/course-read-use-cases.spec.ts`
- `src/modules/courses/application/course-use-cases.spec.ts`
- `src/modules/courses/application/courses.repository.ts`
- `src/modules/courses/courses.module.ts`
- `src/modules/courses/infrastructure/prisma-courses.repository.spec.ts`
- `src/modules/courses/infrastructure/prisma-courses.repository.ts`
- `src/modules/courses/interfaces/courses.controller.spec.ts`
- `src/modules/courses/interfaces/courses.controller.ts`
- `src/modules/study-artifacts/interfaces/study-artifacts.controller.ts`
- `test/critical-paths.e2e-spec.ts`

Supprimés : aucun.

## 8. Tests exécutés

- `npm test -- modules/courses --runInBand` : OK, 6 suites, 48 tests.
- `npm test -- study-artifacts --runInBand` : OK, 5 suites, 34 tests.
- `npm run test:e2e -- --runInBand` : OK, 2 suites, 31 tests.
- `npx prisma validate` : OK.
- `npx prisma generate` : OK, Prisma Client 7.8.0 généré.
- `npm run build` : OK.
- `npm run lint:check` : premier passage KO sur `unbound-method` dans le nouveau test, corrigé ; second passage OK.
- `npm test -- --runInBand` : OK, 75 suites passées, 1 suite skipped, 651 tests passés, 1 test skipped.

## 9. Résultats exacts des commandes

```text
npx prisma validate
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma/schema.prisma.
The schema at prisma/schema.prisma is valid 🚀
```

```text
npx prisma generate
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma/schema.prisma.
✔ Generated Prisma Client (7.8.0) to ./src/generated/prisma in 146ms
```

```text
npm run build
> api@0.0.1 build
> nest build
```

```text
npm run lint:check
> api@0.0.1 lint:check
> eslint "{src,apps,libs,test}/**/*.ts"
OK après correction du nouveau test.
```

```text
npm test -- modules/courses --runInBand
Test Suites: 6 passed, 6 total
Tests:       48 passed, 48 total
```

```text
npm test -- study-artifacts --runInBand
Test Suites: 5 passed, 5 total
Tests:       34 passed, 34 total
```

```text
npm test -- --runInBand
Test Suites: 1 skipped, 75 passed, 75 of 76 total
Tests:       1 skipped, 651 passed, 652 total
```

```text
npm run test:e2e -- --runInBand
Test Suites: 2 passed, 2 total
Tests:       31 passed, 31 total
```

Greps :

- `rg "CourseSource" src test docs/core || true` : aucune occurrence dans `src`/`test`; occurrences uniquement dans anciens rapports CORE-01/CORE-02/CORE-03.
- `rg "storagePath|promptVersion|provider|completion" src/modules/courses src/modules/study-artifacts test || true` : occurrences internes attendues dans repository/use cases/tests study-artifacts et assertions anti-fuite ; les réponses publiques course-level testées ne contiennent pas `storagePath`, `provider`, `promptVersion`.

## 10. Limites connues

- CORE-04 ne fusionne pas plusieurs documents.
- Il n’y a pas encore de source principale configurable.
- `GET` ne génère pas automatiquement une fiche si elle n’existe pas encore ; il suit la sémantique document-level existante et renvoie `404`.
- La génération réelle dépend toujours de la disponibilité du pipeline document-level existant.

## 11. Risques restants

- Si un cours a plusieurs PDF `READY`, la première source historique est choisie. C’est déterministe mais pas forcément le meilleur choix pédagogique.
- L’erreur `409` est volontairement simple ; une future API pourrait exposer un code d’erreur structuré si le projet standardise les erreurs.
- Les greps anti-fuite trouvent encore les champs internes dans le code study-artifacts, car ils existent en persistance et en tests. Le garde-fou est le mapper public.

## 12. Auto-review séparée

- Périmètre : pas de CORE-05, pas de quick revision, pas de multi-source.
- Fixtures : aucune fixture métier ajoutée dans le flow Course.
- Contrat API : endpoints course-level ajoutés, sans `documentId` client.
- Sécurité ownership : le cours est vérifié via `findCourseOwnershipContext` avant toute sélection de document.
- READY-only : le repository filtre `status = READY` et `kind = COURSE_PDF`.
- Erreurs : `404` pour cours absent/fiche absente, `409` pour aucune source prête.
- Anti-fuite : mapper public partagé, tests e2e anti-`storagePath`/`provider`/`promptVersion`.
- Fichiers inutiles : aucun déplacement massif, aucun module study-artifacts déplacé.

## 13. Auto-critique

Solide : réutilisation du moteur document-level, sélection serveur déterministe, contrat public unique, tests unitaires et e2e.

Fragile : le choix de la première source prête est volontairement minimal. Dès qu’il y aura plusieurs PDFs importants, il faudra une notion de source principale ou une stratégie de composition.

Fait au plus simple : deux use cases course-level très minces au lieu d’un service plus générique. C’est assumé pour CORE-04.

À reprendre plus tard : stratégie multi-source, UX de génération asynchrone, éventuel code d’erreur structuré.

Pourquoi pas multi-source : le prompt demande une V0 depuis une seule source `READY`, et le moteur document-level existant travaille naturellement document par document.

Pourquoi pas quick revision : activer la révision rapide nécessite un autre contrat de session/course et relève de CORE-05.

## 14. Points discutables du prompt

- Demander `GET` et `POST` course-level tout en disant de suivre strictement la sémantique document-level peut créer une question : faut-il générer automatiquement sur GET ? J’ai gardé la sémantique existante : GET lit, POST génère.
- Le grep `storagePath|promptVersion|provider|completion` sur `src/modules/study-artifacts` retourne forcément des occurrences internes légitimes. J’ai traité ce grep comme un audit anti-fuite publique, pas comme une interdiction des champs internes.
- Une erreur `409` simple sans code JSON structuré est cohérente avec l’existant, mais un contrat d’erreurs plus standard serait utile.

## 15. Contenu complet des fichiers créés/modifiés/supprimés

Le présent rapport n’est pas inclus dans sa propre section de contenu pour éviter une récursion infinie.

### `src/modules/courses/application/course-revision-sheet.use-case.spec.ts`

```ts
import { GenerateRevisionSheetUseCase } from '../../study-artifacts/application/generate-revision-sheet.use-case';
import { GetRevisionSheetUseCase } from '../../study-artifacts/application/get-revision-sheet.use-case';
import type { RevisionSheetDto } from '../../study-artifacts/application/study-artifacts.repository';
import {
  CourseRevisionSheetSourceNotReadyError,
  GenerateCourseRevisionSheetUseCase,
  GetCourseRevisionSheetUseCase,
} from './course-revision-sheet.use-case';
import type {
  CourseDocumentDto,
  CoursesRepository,
} from './courses.repository';

describe('Course revision sheet use cases', () => {
  it('refuses an unknown or cross-student course before selecting a document', async () => {
    const { repository, getRevisionSheet } = createUseCases();
    repository.findCourseOwnershipContext.mockResolvedValue(null);

    await expect(
      new GetCourseRevisionSheetUseCase(repository, getRevisionSheet).execute({
        studentId: 'student-2',
        courseId: 'course-1',
      }),
    ).rejects.toThrow('Course not found');

    expect(
      repository.findFirstReadyCoursePdfDocumentForCourse.mock.calls,
    ).toHaveLength(0);
    expect(getRevisionSheet.execute.mock.calls).toHaveLength(0);
  });

  it('refuses a course without a READY course PDF source', async () => {
    const { repository, getRevisionSheet } = createUseCases();
    repository.findCourseOwnershipContext.mockResolvedValue({
      courseId: 'course-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
    });
    repository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(null);

    await expect(
      new GetCourseRevisionSheetUseCase(repository, getRevisionSheet).execute({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).rejects.toThrow(CourseRevisionSheetSourceNotReadyError);

    expect(getRevisionSheet.execute.mock.calls).toHaveLength(0);
  });

  it('gets the document-level sheet for the backend-selected READY source', async () => {
    const { repository, getRevisionSheet } = createUseCases();
    repository.findCourseOwnershipContext.mockResolvedValue({
      courseId: 'course-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
    });
    repository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      courseDocument({ documentId: 'document-ready-1' }),
    );
    getRevisionSheet.execute.mockResolvedValue(revisionSheet());

    const result = await new GetCourseRevisionSheetUseCase(
      repository,
      getRevisionSheet,
    ).execute({ studentId: 'student-1', courseId: 'course-1' });

    expect(
      repository.findFirstReadyCoursePdfDocumentForCourse.mock.calls,
    ).toEqual([[{ studentId: 'student-1', courseId: 'course-1' }]]);
    expect(getRevisionSheet.execute.mock.calls).toEqual([
      [{ studentId: 'student-1', documentId: 'document-ready-1' }],
    ]);
    expect(result?.id).toBe('sheet-1');
  });

  it('generates the document-level sheet for the backend-selected READY source', async () => {
    const { repository, generateRevisionSheet } = createUseCases();
    repository.findCourseOwnershipContext.mockResolvedValue({
      courseId: 'course-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
    });
    repository.findFirstReadyCoursePdfDocumentForCourse.mockResolvedValue(
      courseDocument({ documentId: 'document-ready-1' }),
    );
    generateRevisionSheet.execute.mockResolvedValue(revisionSheet());

    const result = await new GenerateCourseRevisionSheetUseCase(
      repository,
      generateRevisionSheet,
    ).execute({ studentId: 'student-1', courseId: 'course-1' });

    expect(generateRevisionSheet.execute.mock.calls).toEqual([
      [{ studentId: 'student-1', documentId: 'document-ready-1' }],
    ]);
    expect(result.id).toBe('sheet-1');
  });
});

function createUseCases() {
  const repository = {
    create: jest.fn(),
    findByIdForStudent: jest.fn(),
    listBySubjectForStudent: jest.fn(),
    listBySubjectForStudentWithStats: jest.fn(),
    findDetailByIdForStudent: jest.fn(),
    deleteIfEmpty: jest.fn(),
    findCourseOwnershipContext: jest.fn(),
    findFirstReadyCoursePdfDocumentForCourse: jest.fn(),
    attachDocumentToCourse: jest.fn(),
    backfillFromExistingDocumentsDryRun: jest.fn(),
    backfillFromExistingDocuments: jest.fn(),
  } as unknown as jest.Mocked<CoursesRepository>;
  const getRevisionSheet = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<GetRevisionSheetUseCase>;
  const generateRevisionSheet = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<GenerateRevisionSheetUseCase>;

  return { repository, getRevisionSheet, generateRevisionSheet };
}

function courseDocument(
  overrides: Partial<CourseDocumentDto> = {},
): CourseDocumentDto {
  return {
    id: 'document-ready-1',
    courseId: 'course-1',
    documentId: 'document-ready-1',
    fileName: 'cours.pdf',
    kind: 'COURSE_PDF',
    status: 'READY',
    errorCode: null,
    createdAt: new Date('2026-06-18T10:00:00.000Z'),
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
    ...overrides,
  };
}

function revisionSheet(
  overrides: Partial<RevisionSheetDto> = {},
): RevisionSheetDto {
  return {
    id: 'sheet-1',
    documentId: 'document-ready-1',
    subjectId: 'subject-1',
    status: 'READY',
    title: 'Fiche de cours',
    introduction: 'Introduction',
    keyPoints: ['Point clé'],
    commonMistakes: ['Erreur fréquente'],
    mustKnow: ['À savoir'],
    practiceSuggestions: ['S’entraîner'],
    errorCode: null,
    metadata: {
      flowName: 'documentRevisionSheetGeneration',
      provider: 'mock',
      model: 'mock-model',
      promptVersion: 'generate-revision-sheet-v1',
      schemaVersion: 'revision-sheet-v1',
      generatedAt: new Date('2026-06-18T10:00:00.000Z'),
      sourceStrategy: 'DOCUMENT_CHUNKS_AND_KNOWLEDGE_UNITS',
    },
    sections: [],
    ...overrides,
  };
}

```

### `src/modules/courses/application/course-revision-sheet.use-case.ts`

```ts
import { Inject, Injectable } from '@nestjs/common';
import { GenerateRevisionSheetUseCase } from '../../study-artifacts/application/generate-revision-sheet.use-case';
import { GetRevisionSheetUseCase } from '../../study-artifacts/application/get-revision-sheet.use-case';
import type { RevisionSheetDto } from '../../study-artifacts/application/study-artifacts.repository';
import {
  COURSES_REPOSITORY,
  type CourseDocumentDto,
  type CoursesRepository,
} from './courses.repository';

export class CourseRevisionSheetSourceNotReadyError extends Error {
  readonly code = 'COURSE_REVISION_SHEET_SOURCE_NOT_READY';

  constructor() {
    super('Course has no ready source');
  }
}

type CourseRevisionSheetInput = {
  studentId: string;
  courseId: string;
};

@Injectable()
export class GetCourseRevisionSheetUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
    private readonly getRevisionSheet: GetRevisionSheetUseCase,
  ) {}

  async execute(
    input: CourseRevisionSheetInput,
  ): Promise<RevisionSheetDto | null> {
    const readySource = await this.findBackendSelectedReadySource(input);

    return this.getRevisionSheet.execute({
      studentId: input.studentId,
      documentId: readySource.documentId,
    });
  }

  private async findBackendSelectedReadySource(
    input: CourseRevisionSheetInput,
  ): Promise<CourseDocumentDto> {
    return findBackendSelectedReadySource(this.coursesRepository, input);
  }
}

@Injectable()
export class GenerateCourseRevisionSheetUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
    private readonly generateRevisionSheet: GenerateRevisionSheetUseCase,
  ) {}

  async execute(input: CourseRevisionSheetInput): Promise<RevisionSheetDto> {
    const readySource = await findBackendSelectedReadySource(
      this.coursesRepository,
      input,
    );

    return this.generateRevisionSheet.execute({
      studentId: input.studentId,
      documentId: readySource.documentId,
    });
  }
}

async function findBackendSelectedReadySource(
  coursesRepository: CoursesRepository,
  input: CourseRevisionSheetInput,
) {
  const course = await coursesRepository.findCourseOwnershipContext(input);

  if (!course) {
    throw new Error('Course not found');
  }

  // CORE-04 deliberately keeps course-level sheets single-source: the backend
  // chooses the first READY PDF, so the client never gets to submit documentId.
  const readySource =
    await coursesRepository.findFirstReadyCoursePdfDocumentForCourse(input);

  if (!readySource) {
    throw new CourseRevisionSheetSourceNotReadyError();
  }

  return readySource;
}

```

### `src/modules/study-artifacts/interfaces/study-artifact-response.mapper.ts`

```ts
import type {
  RevisionSheetDto,
  RevisionSheetSectionDto,
  StudyArtifactSourceDto,
  SummaryDto,
} from '../application/study-artifacts.repository';

export function toPublicSummary(summary: SummaryDto) {
  return {
    id: summary.id,
    documentId: summary.documentId,
    subjectId: summary.subjectId,
    status: summary.status,
    title: summary.title,
    content: summary.content,
    keyPoints: summary.keyPoints,
    limits: summary.limits,
    errorCode: summary.errorCode,
    sources: summary.sources.map(toPublicSource),
  };
}

export function toPublicRevisionSheet(revisionSheet: RevisionSheetDto) {
  return {
    id: revisionSheet.id,
    documentId: revisionSheet.documentId,
    subjectId: revisionSheet.subjectId,
    status: revisionSheet.status,
    title: revisionSheet.title,
    introduction: revisionSheet.introduction,
    keyPoints: revisionSheet.keyPoints,
    commonMistakes: revisionSheet.commonMistakes,
    mustKnow: revisionSheet.mustKnow,
    practiceSuggestions: revisionSheet.practiceSuggestions,
    errorCode: revisionSheet.errorCode,
    sections: revisionSheet.sections.map(toPublicRevisionSheetSection),
  };
}

function toPublicRevisionSheetSection(section: RevisionSheetSectionDto) {
  return {
    id: section.id,
    displayOrder: section.displayOrder,
    title: section.title,
    content: section.content,
    sources: section.sources.map(toPublicSource),
  };
}

function toPublicSource(source: StudyArtifactSourceDto) {
  return {
    chunkId: source.chunkId,
    text: source.text,
    pageNumber: source.pageNumber,
    index: source.index,
  };
}

```

### `src/modules/courses/application/course-read-use-cases.spec.ts`

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
    findFirstReadyCoursePdfDocumentForCourse: jest.fn(),
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
    findFirstReadyCoursePdfDocumentForCourse: jest.fn(),
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

### `src/modules/courses/application/courses.repository.ts`

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

  findFirstReadyCoursePdfDocumentForCourse(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseDocumentDto | null>;

  attachDocumentToCourse(input: {
    studentId: string;
    courseId: string;
    documentId: string;
  }): Promise<CourseDocumentAttachment>;

  backfillFromExistingDocumentsDryRun(): Promise<CourseBackfillDryRunResult>;

  backfillFromExistingDocuments(): Promise<CourseBackfillDryRunResult>;
}

```

### `src/modules/courses/courses.module.ts`

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { JobsModule } from '../jobs/jobs.module';
import { StudyArtifactsModule } from '../study-artifacts/study-artifacts.module';
import { BackfillCoursesFromDocumentsDryRunUseCase } from './application/backfill-courses-from-documents.use-case';
import {
  GenerateCourseRevisionSheetUseCase,
  GetCourseRevisionSheetUseCase,
} from './application/course-revision-sheet.use-case';
import { COURSES_REPOSITORY } from './application/courses.repository';
import { CreateCourseUseCase } from './application/create-course.use-case';
import { DeleteCourseUseCase } from './application/delete-course.use-case';
import { GetCourseDetailUseCase } from './application/get-course-detail.use-case';
import { GetCourseUseCase } from './application/get-course.use-case';
import { ListSubjectCoursesWithStatsUseCase } from './application/list-subject-courses-with-stats.use-case';
import { ListSubjectCoursesUseCase } from './application/list-subject-courses.use-case';
import { UploadCoursePdfForCourseUseCase } from './application/upload-course-pdf-for-course.use-case';
import { PrismaCoursesRepository } from './infrastructure/prisma-courses.repository';
import { CoursesController } from './interfaces/courses.controller';

@Module({
  imports: [
    AuthModule,
    DocumentsModule,
    JobsModule,
    PrismaModule,
    StudyArtifactsModule,
  ],
  controllers: [CoursesController],
  providers: [
    CreateCourseUseCase,
    ListSubjectCoursesUseCase,
    ListSubjectCoursesWithStatsUseCase,
    GetCourseUseCase,
    GetCourseDetailUseCase,
    DeleteCourseUseCase,
    BackfillCoursesFromDocumentsDryRunUseCase,
    UploadCoursePdfForCourseUseCase,
    GetCourseRevisionSheetUseCase,
    GenerateCourseRevisionSheetUseCase,
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
    UploadCoursePdfForCourseUseCase,
    GetCourseRevisionSheetUseCase,
    GenerateCourseRevisionSheetUseCase,
    COURSES_REPOSITORY,
  ],
})
export class CoursesModule {}

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

  it('rejects course detail documents missing courseId instead of returning an empty courseId', async () => {
    const { prisma, repository } = createRepository();
    prisma.course.findFirst.mockResolvedValue(
      courseRecord({
        subject: { id: 'subject-1', name: 'Droit constitutionnel' },
        documents: [
          {
            id: 'document-1',
            courseId: null,
            fileName: 'cours.pdf',
            kind: 'COURSE_PDF',
            status: 'READY',
            errorCode: null,
            createdAt: new Date('2026-06-18T12:00:00.000Z'),
            updatedAt: new Date('2026-06-18T12:00:00.000Z'),
          },
        ],
      }),
    );

    await expect(
      repository.findDetailByIdForStudent({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).rejects.toThrow('Attached course document is missing courseId');
  });

  it('selects the first READY course PDF source deterministically', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(
      documentRecord({
        id: 'document-ready-1',
        courseId: 'course-1',
        kind: 'COURSE_PDF',
        status: 'READY',
        errorCode: null,
        createdAt: new Date('2026-06-18T10:00:00.000Z'),
        updatedAt: new Date('2026-06-18T10:00:00.000Z'),
      }),
    );

    await expect(
      repository.findFirstReadyCoursePdfDocumentForCourse({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).resolves.toMatchObject({
      id: 'document-ready-1',
      documentId: 'document-ready-1',
      courseId: 'course-1',
      kind: 'COURSE_PDF',
      status: 'READY',
    });

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        courseId: 'course-1',
        kind: 'COURSE_PDF',
        status: 'READY',
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
    });
  });

  it('returns null when a course has no READY course PDF source', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(
      repository.findFirstReadyCoursePdfDocumentForCourse({
        studentId: 'student-1',
        courseId: 'course-1',
      }),
    ).resolves.toBeNull();
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

  async findFirstReadyCoursePdfDocumentForCourse(input: {
    studentId: string;
    courseId: string;
  }): Promise<CourseDocumentDto | null> {
    const document = await this.prisma.document.findFirst({
      where: {
        studentId: input.studentId,
        courseId: input.courseId,
        kind: DocumentKind.COURSE_PDF,
        status: 'READY',
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
    });

    return document ? toCourseDocumentDto(document) : null;
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
  if (!document.courseId) {
    throw new Error('Attached course document is missing courseId');
  }

  return {
    id: document.id,
    courseId: document.courseId,
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

### `src/modules/courses/interfaces/courses.controller.spec.ts`

```ts
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CourseContainsDocumentsError } from '../domain/course.entity';
import {
  CourseRevisionSheetSourceNotReadyError,
  GenerateCourseRevisionSheetUseCase,
  GetCourseRevisionSheetUseCase,
} from '../application/course-revision-sheet.use-case';
import { CreateCourseUseCase } from '../application/create-course.use-case';
import { DeleteCourseUseCase } from '../application/delete-course.use-case';
import { GetCourseDetailUseCase } from '../application/get-course-detail.use-case';
import { ListSubjectCoursesWithStatsUseCase } from '../application/list-subject-courses-with-stats.use-case';
import { UploadCoursePdfForCourseUseCase } from '../application/upload-course-pdf-for-course.use-case';
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

  it('uploads a course PDF with course-derived context only', async () => {
    const { controller, uploadCoursePdfForCourse } = createController();
    uploadCoursePdfForCourse.execute.mockResolvedValue(courseDocument());

    await expect(
      controller.uploadCoursePdfForCourse(
        currentStudent,
        ' course-1 ',
        uploadedPdf(),
      ),
    ).resolves.toEqual(publicCourseDocument());

    expect(uploadCoursePdfForCourse.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      firebaseUid: 'firebase-1',
      courseId: 'course-1',
      originalFileName: 'cours.pdf',
      content: Buffer.from('%PDF-1.7'),
      mimeType: 'application/pdf',
    });
  });

  it('rejects missing and invalid course PDF uploads before the use case', () => {
    const { controller, uploadCoursePdfForCourse } = createController();

    expect(() =>
      controller.uploadCoursePdfForCourse(
        currentStudent,
        'course-1',
        undefined,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      controller.uploadCoursePdfForCourse(currentStudent, 'course-1', {
        ...uploadedPdf(),
        originalname: 'notes.txt',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      controller.uploadCoursePdfForCourse(currentStudent, 'course-1', {
        ...uploadedPdf(),
        mimetype: 'text/plain',
      }),
    ).toThrow(BadRequestException);
    expect(uploadCoursePdfForCourse.execute).not.toHaveBeenCalled();
  });

  it('rejects client-provided course upload ownership fields', () => {
    const { controller, uploadCoursePdfForCourse } = createController();

    expect(() =>
      controller.uploadCoursePdfForCourse(
        currentStudent,
        'course-1',
        uploadedPdf(),
        { subjectId: 'subject-1' },
      ),
    ).toThrow(BadRequestException);

    expect(uploadCoursePdfForCourse.execute).not.toHaveBeenCalled();
  });

  it('maps unknown course uploads to 404', async () => {
    const { controller, uploadCoursePdfForCourse } = createController();
    uploadCoursePdfForCourse.execute.mockRejectedValue(
      new Error('Course not found'),
    );

    await expect(
      controller.uploadCoursePdfForCourse(
        currentStudent,
        'other-student-course',
        uploadedPdf(),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('gets a course-level revision sheet without exposing internal metadata', async () => {
    const { controller, getCourseRevisionSheet } = createController();
    getCourseRevisionSheet.execute.mockResolvedValue(revisionSheet());

    await expect(
      controller.getCourseRevisionSheet(currentStudent, ' course-1 '),
    ).resolves.toEqual(publicRevisionSheet());

    expect(getCourseRevisionSheet.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
    });
    expect(
      JSON.stringify(
        await controller.getCourseRevisionSheet(currentStudent, 'course-1'),
      ),
    ).not.toContain('promptVersion');
  });

  it('generates a course-level revision sheet via the backend-selected source', async () => {
    const { controller, generateCourseRevisionSheet } = createController();
    generateCourseRevisionSheet.execute.mockResolvedValue(revisionSheet());

    await expect(
      controller.generateCourseRevisionSheet(currentStudent, 'course-1'),
    ).resolves.toEqual(publicRevisionSheet());

    expect(generateCourseRevisionSheet.execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      courseId: 'course-1',
    });
  });

  it('maps course-level revision sheet errors to 404 and 409', async () => {
    const { controller, getCourseRevisionSheet, generateCourseRevisionSheet } =
      createController();
    getCourseRevisionSheet.execute.mockResolvedValueOnce(null);

    await expect(
      controller.getCourseRevisionSheet(currentStudent, 'course-1'),
    ).rejects.toThrow(NotFoundException);

    generateCourseRevisionSheet.execute.mockRejectedValueOnce(
      new CourseRevisionSheetSourceNotReadyError(),
    );

    await expect(
      controller.generateCourseRevisionSheet(currentStudent, 'course-1'),
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
  const uploadCoursePdfForCourse = { execute: jest.fn() };
  const getCourseRevisionSheet = { execute: jest.fn() };
  const generateCourseRevisionSheet = { execute: jest.fn() };

  return {
    controller: new CoursesController(
      createCourse as unknown as CreateCourseUseCase,
      listCourses as unknown as ListSubjectCoursesWithStatsUseCase,
      getCourseDetail as unknown as GetCourseDetailUseCase,
      deleteCourse as unknown as DeleteCourseUseCase,
      uploadCoursePdfForCourse as unknown as UploadCoursePdfForCourseUseCase,
      getCourseRevisionSheet as unknown as GetCourseRevisionSheetUseCase,
      generateCourseRevisionSheet as unknown as GenerateCourseRevisionSheetUseCase,
    ),
    createCourse,
    listCourses,
    getCourseDetail,
    deleteCourse,
    uploadCoursePdfForCourse,
    getCourseRevisionSheet,
    generateCourseRevisionSheet,
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

function uploadedPdf() {
  return {
    originalname: 'cours.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7'),
    size: 8,
  };
}

function courseDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document-1',
    courseId: 'course-1',
    documentId: 'document-1',
    fileName: 'cours.pdf',
    kind: 'COURSE_PDF',
    status: 'UPLOADED',
    errorCode: null,
    createdAt: new Date('2026-06-18T12:00:00.000Z'),
    updatedAt: new Date('2026-06-18T12:00:00.000Z'),
    ...overrides,
  };
}

function publicCourseDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document-1',
    courseId: 'course-1',
    documentId: 'document-1',
    fileName: 'cours.pdf',
    kind: 'COURSE_PDF',
    status: 'UPLOADED',
    errorCode: null,
    createdAt: '2026-06-18T12:00:00.000Z',
    updatedAt: '2026-06-18T12:00:00.000Z',
    ...overrides,
  };
}

function revisionSheet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sheet-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY',
    title: 'Fiche de cours',
    introduction: 'Introduction',
    keyPoints: ['Point clé'],
    commonMistakes: ['Erreur fréquente'],
    mustKnow: ['À savoir'],
    practiceSuggestions: ['S’entraîner'],
    errorCode: null,
    metadata: {
      flowName: 'documentRevisionSheetGeneration',
      provider: 'mock',
      model: 'mock-model',
      promptVersion: 'generate-revision-sheet-v1',
      schemaVersion: 'revision-sheet-v1',
      generatedAt: new Date('2026-06-18T10:00:00.000Z'),
      sourceStrategy: 'DOCUMENT_CHUNKS_AND_KNOWLEDGE_UNITS',
    },
    sections: [
      {
        id: 'section-1',
        displayOrder: 0,
        title: 'Institutions',
        content: 'Le Parlement contrôle le Gouvernement.',
        sources: [
          {
            chunkId: 'chunk-1',
            text: 'Extrait source',
            pageNumber: 1,
            index: 0,
            relevanceScore: 0.9,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function publicRevisionSheet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sheet-1',
    documentId: 'document-1',
    subjectId: 'subject-1',
    status: 'READY',
    title: 'Fiche de cours',
    introduction: 'Introduction',
    keyPoints: ['Point clé'],
    commonMistakes: ['Erreur fréquente'],
    mustKnow: ['À savoir'],
    practiceSuggestions: ['S’entraîner'],
    errorCode: null,
    sections: [
      {
        id: 'section-1',
        displayOrder: 0,
        title: 'Institutions',
        content: 'Le Parlement contrôle le Gouvernement.',
        sources: [
          {
            chunkId: 'chunk-1',
            text: 'Extrait source',
            pageNumber: 1,
            index: 0,
          },
        ],
      },
    ],
    ...overrides,
  };
}

```

### `src/modules/courses/interfaces/courses.controller.ts`

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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import type { AuthenticatedStudent } from '../../auth/interfaces/authenticated-student';
import {
  CourseRevisionSheetSourceNotReadyError,
  GenerateCourseRevisionSheetUseCase,
  GetCourseRevisionSheetUseCase,
} from '../application/course-revision-sheet.use-case';
import { toPublicRevisionSheet } from '../../study-artifacts/interfaces/study-artifact-response.mapper';
import {
  MAX_DOCUMENT_BYTES,
  type UploadedCoursePdfFile,
  validateCoursePdfFile,
} from '../../documents/interfaces/course-pdf-upload.validator';
import { CreateCourseUseCase } from '../application/create-course.use-case';
import { DeleteCourseUseCase } from '../application/delete-course.use-case';
import { GetCourseDetailUseCase } from '../application/get-course-detail.use-case';
import { ListSubjectCoursesWithStatsUseCase } from '../application/list-subject-courses-with-stats.use-case';
import { UploadCoursePdfForCourseUseCase } from '../application/upload-course-pdf-for-course.use-case';
import { CourseContainsDocumentsError } from '../domain/course.entity';
import type { CreateCourseRequest } from './create-course.request';
import {
  toCourseDocumentResponse,
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
    private readonly uploadCoursePdfForCourseUseCase: UploadCoursePdfForCourseUseCase,
    private readonly getCourseRevisionSheetUseCase: GetCourseRevisionSheetUseCase,
    private readonly generateCourseRevisionSheetUseCase: GenerateCourseRevisionSheetUseCase,
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

  @Post('courses/:courseId/source/course-pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_DOCUMENT_BYTES },
    }),
  )
  uploadCoursePdfForCourse(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
    @UploadedFile() file: UploadedCoursePdfFile | undefined,
    @Body() body: Record<string, unknown> = {},
  ) {
    rejectClientOwnedUploadFields(body);

    const validatedFile = validateCoursePdfFile(file);

    return this.uploadCoursePdfForCourseUseCase
      .execute({
        studentId: student.id,
        firebaseUid: student.firebaseUid,
        courseId: trimRequiredString(courseId, 'Course id is required'),
        originalFileName: validatedFile.originalFileName,
        content: validatedFile.content,
        mimeType: validatedFile.mimeType,
      })
      .then(toCourseDocumentResponse)
      .catch(normalizeCourseError);
  }

  @Get('courses/:courseId/revision-sheet')
  getCourseRevisionSheet(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ) {
    return this.getCourseRevisionSheetUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .then((revisionSheet) => {
        if (!revisionSheet) {
          throw new NotFoundException('Revision sheet not found');
        }

        return toPublicRevisionSheet(revisionSheet);
      })
      .catch(normalizeCourseError);
  }

  @Post('courses/:courseId/revision-sheet')
  generateCourseRevisionSheet(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('courseId') courseId: string,
  ) {
    return this.generateCourseRevisionSheetUseCase
      .execute({
        studentId: student.id,
        courseId: trimRequiredString(courseId, 'Course id is required'),
      })
      .then(toPublicRevisionSheet)
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

function rejectClientOwnedUploadFields(body: Record<string, unknown> = {}) {
  if ('studentId' in body || 'subjectId' in body || 'courseId' in body) {
    throw new BadRequestException(
      'Course upload only accepts the multipart file field',
    );
  }
}

function normalizeCourseError(error: unknown): never {
  if (error instanceof BadRequestException) {
    throw error;
  }

  if (error instanceof CourseContainsDocumentsError) {
    throw new ConflictException('Course contains documents');
  }

  if (error instanceof CourseRevisionSheetSourceNotReadyError) {
    throw new ConflictException(error.message);
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

### `src/modules/study-artifacts/interfaces/study-artifacts.controller.ts`

```ts
import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedStudent } from '../../auth/interfaces/authenticated-student';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import { GenerateDocumentSummaryUseCase } from '../application/generate-document-summary.use-case';
import { GenerateRevisionSheetUseCase } from '../application/generate-revision-sheet.use-case';
import { GetDocumentSummaryUseCase } from '../application/get-document-summary.use-case';
import { GetRevisionSheetUseCase } from '../application/get-revision-sheet.use-case';
import {
  toPublicRevisionSheet,
  toPublicSummary,
} from './study-artifact-response.mapper';

@Controller('documents')
@UseGuards(FirebaseAuthGuard)
export class StudyArtifactsController {
  constructor(
    private readonly getDocumentSummary: GetDocumentSummaryUseCase,
    private readonly generateDocumentSummary: GenerateDocumentSummaryUseCase,
    private readonly getDocumentRevisionSheet: GetRevisionSheetUseCase,
    private readonly generateDocumentRevisionSheet: GenerateRevisionSheetUseCase,
  ) {}

  @Get(':documentId/summary')
  async getSummary(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('documentId') documentId: string,
  ) {
    const summary = await this.getDocumentSummary.execute({
      studentId: student.id,
      documentId: trimRequiredString(documentId, 'Document id is required'),
    });

    if (!summary) {
      throw new NotFoundException('Document summary not found');
    }

    return toPublicSummary(summary);
  }

  @Post(':documentId/summary')
  async generateSummary(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('documentId') documentId: string,
  ) {
    const summary = await this.generateDocumentSummary.execute({
      studentId: student.id,
      documentId: trimRequiredString(documentId, 'Document id is required'),
    });

    return toPublicSummary(summary);
  }

  @Get(':documentId/revision-sheet')
  async getRevisionSheet(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('documentId') documentId: string,
  ) {
    const revisionSheet = await this.getDocumentRevisionSheet.execute({
      studentId: student.id,
      documentId: trimRequiredString(documentId, 'Document id is required'),
    });

    if (!revisionSheet) {
      throw new NotFoundException('Revision sheet not found');
    }

    return toPublicRevisionSheet(revisionSheet);
  }

  @Post(':documentId/revision-sheet')
  async generateRevisionSheet(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('documentId') documentId: string,
  ) {
    const revisionSheet = await this.generateDocumentRevisionSheet.execute({
      studentId: student.id,
      documentId: trimRequiredString(documentId, 'Document id is required'),
    });

    return toPublicRevisionSheet(revisionSheet);
  }
}

function trimRequiredString(value: string | undefined, message: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new BadRequestException(message);
  }

  return trimmed;
}

```

### `test/critical-paths.e2e-spec.ts`

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
import {
  CourseRevisionSheetSourceNotReadyError,
  GenerateCourseRevisionSheetUseCase,
  GetCourseRevisionSheetUseCase,
} from '../src/modules/courses/application/course-revision-sheet.use-case';
import { GetCourseDetailUseCase } from '../src/modules/courses/application/get-course-detail.use-case';
import { ListSubjectCoursesWithStatsUseCase } from '../src/modules/courses/application/list-subject-courses-with-stats.use-case';
import { UploadCoursePdfForCourseUseCase } from '../src/modules/courses/application/upload-course-pdf-for-course.use-case';
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
      await request(server).get('/courses/course-1/revision-sheet').expect(401);
      await request(server)
        .post('/courses/course-1/revision-sheet')
        .expect(401);
      await request(server)
        .post('/courses/course-1/source/course-pdf')
        .attach('file', Buffer.from('%PDF-1.7'), {
          filename: 'cours.pdf',
          contentType: 'application/pdf',
        })
        .expect(401);
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

    it('uploads a real course PDF source without client-provided subject context', async () => {
      const server = app.getHttpServer();

      const response = await request(server)
        .post('/courses/course-1/source/course-pdf')
        .attach('file', Buffer.from('%PDF-1.7'), {
          filename: 'cours.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      type CoursePdfUploadInput = {
        studentId: string;
        firebaseUid: string;
        courseId: string;
        originalFileName: string;
        content: Buffer;
        mimeType: string;
      };
      const uploadExecute = mocks.uploadCoursePdfForCourse
        .execute as jest.MockedFunction<
        (input: CoursePdfUploadInput) => Promise<unknown>
      >;
      const uploadInput = uploadExecute.mock.calls[0][0];

      expect(uploadInput.content).toBeInstanceOf(Buffer);
      expect(uploadInput).toMatchObject({
        studentId: currentStudent.id,
        firebaseUid: currentStudent.firebaseUid,
        courseId: 'course-1',
        originalFileName: 'cours.pdf',
        mimeType: 'application/pdf',
      });
      expect(response.body).toMatchObject({
        id: 'document-1',
        courseId: 'course-1',
        documentId: 'document-1',
        fileName: 'cours.pdf',
        kind: 'COURSE_PDF',
        status: 'UPLOADED',
      });
      expect(
        JSON.stringify(mocks.uploadCoursePdfForCourse.execute.mock.calls),
      ).not.toContain('subjectId');
    });

    it('maps Course PDF upload validation and ownership errors', async () => {
      const server = app.getHttpServer();

      await request(server)
        .post('/courses/course-1/source/course-pdf')
        .attach('file', Buffer.from('not a pdf'), {
          filename: 'notes.txt',
          contentType: 'text/plain',
        })
        .expect(400);

      await request(server)
        .post('/courses/course-1/source/course-pdf')
        .field('subjectId', 'client-subject')
        .attach('file', Buffer.from('%PDF-1.7'), {
          filename: 'cours.pdf',
          contentType: 'application/pdf',
        })
        .expect(400);

      mocks.uploadCoursePdfForCourse.execute.mockRejectedValueOnce(
        new Error('Course not found'),
      );

      await request(server)
        .post('/courses/other-student-course/source/course-pdf')
        .attach('file', Buffer.from('%PDF-1.7'), {
          filename: 'cours.pdf',
          contentType: 'application/pdf',
        })
        .expect(404);
    });

    it('serves course-level revision sheets through the backend-selected READY source', async () => {
      const server = app.getHttpServer();

      const getResponse = await request(server)
        .get('/courses/course-1/revision-sheet')
        .expect(200);
      const getBody = getResponse.body as RevisionSheetResponse;

      expect(mocks.getCourseRevisionSheet.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        courseId: 'course-1',
      });
      expect(getBody.documentId).toBe('document-1');
      assertNoSensitivePreSubmitFields(getBody);
      expect(JSON.stringify(getBody)).not.toContain('storagePath');
      expect(JSON.stringify(getBody)).not.toContain('provider');
      expect(JSON.stringify(getBody)).not.toContain('promptVersion');

      const postResponse = await request(server)
        .post('/courses/course-1/revision-sheet')
        .send({ documentId: 'client-picked-document', subjectId: 'subject-1' })
        .expect(201);

      expect(mocks.generateCourseRevisionSheet.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        courseId: 'course-1',
      });
      expect(
        JSON.stringify(mocks.generateCourseRevisionSheet.execute.mock.calls),
      ).not.toContain('client-picked-document');
      expect(postResponse.body).toMatchObject({
        id: 'sheet-1',
        documentId: 'document-1',
        subjectId: 'subject-1',
      });
    });

    it('maps course-level revision sheet readiness errors to 409', async () => {
      mocks.generateCourseRevisionSheet.execute.mockRejectedValueOnce(
        new CourseRevisionSheetSourceNotReadyError(),
      );

      await request(app.getHttpServer())
        .post('/courses/course-without-ready-source/revision-sheet')
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
    .overrideProvider(UploadCoursePdfForCourseUseCase)
    .useValue(mocks.uploadCoursePdfForCourse)
    .overrideProvider(GetCourseRevisionSheetUseCase)
    .useValue(mocks.getCourseRevisionSheet)
    .overrideProvider(GenerateCourseRevisionSheetUseCase)
    .useValue(mocks.generateCourseRevisionSheet)
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
    uploadCoursePdfForCourse: {
      execute: jest.fn().mockResolvedValue(courseDocument()),
    },
    getCourseRevisionSheet: {
      execute: jest.fn().mockResolvedValue(revisionSheet()),
    },
    generateCourseRevisionSheet: {
      execute: jest.fn().mockResolvedValue(revisionSheet()),
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

function courseDocument() {
  return {
    id: 'document-1',
    courseId: 'course-1',
    documentId: 'document-1',
    fileName: 'cours.pdf',
    kind: 'COURSE_PDF',
    status: 'UPLOADED',
    errorCode: null,
    createdAt: new Date('2026-06-18T12:00:00.000Z'),
    updatedAt: new Date('2026-06-18T12:00:00.000Z'),
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

