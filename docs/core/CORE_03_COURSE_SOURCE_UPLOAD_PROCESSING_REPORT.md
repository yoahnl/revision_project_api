# CORE-03 — Course source upload + processing — Rapport API

## Résumé
CORE-03 côté backend est réalisé : l'API expose maintenant POST /courses/:courseId/source/course-pdf, protégé par Firebase, avec validation PDF partagée, ownership strict du cours, dérivation du subjectId depuis le cours, création d'un Document avec courseId, enqueue du processing documentaire existant et cleanup storage en cas d'échec DB/queue.

L'ancien endpoint POST /documents/course-pdf est préservé : il continue à recevoir subjectId côté client et à créer des documents legacy avec courseId null.

## Audit initial
- L'ancien endpoint /documents/course-pdf validait déjà le fichier dans DocumentsController : fichier requis, nom canonique, extension .pdf, MIME application/pdf, buffer non vide et taille maximale 20 MiB.
- UploadCoursePdfUseCase sauvegardait le PDF via DocumentFileStorage.saveCoursePdf, créait le document via DocumentsRepository.create, puis appelait DocumentProcessingQueue.enqueue. En cas d'échec après stockage, il supprimait le fichier.
- DocumentsRepository.create ne prenait pas courseId ; RevisionDocumentDto ne remontait pas courseId, createdAt ou updatedAt.
- PrismaCoursesRepository.toCourseDocumentDto contenait encore un fallback courseId ?? '', corrigé en garde explicite.
- CourseDocumentResponse existait déjà côté courses avec courseId, documentId, dates et statut.

## Endpoint ajouté
POST /courses/:courseId/source/course-pdf

- Champ multipart accepté : file uniquement.
- Champs explicitement rejetés dans le body : studentId, subjectId, courseId.
- Auth : FirebaseAuthGuard + CurrentStudent.
- Réponse : CourseDocumentResponse.
- Erreurs couvertes : 400 fichier manquant/invalide/champ body interdit, 404 cours introuvable/non possédé, 401 via guard.

## Use case ajouté
UploadCoursePdfForCourseUseCase vit dans courses/application, car le sujet est dérivé du cours.

Ordre volontaire :
1. Validation des identifiants.
2. CoursesRepository.findCourseOwnershipContext({ studentId, courseId }).
3. Stockage avec subjectId dérivé du cours.
4. Création du document COURSE_PDF avec courseId.
5. Enqueue du processing existant.
6. Mapping vers CourseDocumentDto.

## Repository / documents
- DocumentsRepository.create accepte maintenant courseId optionnel/null.
- PrismaDocumentsRepository.create écrit explicitement courseId: input.courseId ?? null.
- RevisionDocumentDto expose courseId, createdAt, updatedAt pour permettre le mapping course document sans fabrication de données.
- L'ancien endpoint conserve son mapping public existant via toPublicDocument, donc pas de fuite de storagePath.

## Storage + cleanup
Le contexte course est chargé avant tout stockage. Si la sauvegarde réussit mais que la création DB ou l'enqueue échoue, le fichier est supprimé via storage.delete. Le cleanup est best-effort et l'erreur originale DB/queue reste celle renvoyée.

## Processing
Le nouveau flow réutilise DocumentProcessingQueue.enqueue({ documentId }), comme l'ancien upload. Aucun prompt Genkit, aucun worker IA et aucune logique de processing n'ont été modifiés.

## Tests
Tests ajoutés/renforcés : use case upload sous cours, controller courses, repository documents, repository courses, E2E critical paths multipart.

## Commandes exécutées
- npx prisma validate : OK.
- npx prisma generate : OK, Prisma Client généré.
- npm run build : OK.
- npm run lint:check : OK après corrections Prettier/typage E2E.
- npm test -- modules/courses --runInBand : OK, 5 suites, 39 tests.
- npm test -- documents --runInBand : OK, 9 suites, 64 tests.
- npm test -- jobs --runInBand : OK, 3 suites, 12 tests.
- npm test -- --runInBand : OK, 74 suites passées, 1 suite skipped, 642 tests passés, 1 skipped.
- npm run test:e2e -- --runInBand : OK, 2 suites, 29 tests.
- rg CourseSource côté backend : aucune occurrence code ; occurrences uniquement dans anciens rapports CORE-01/CORE-02.
- git diff --check : lancé après génération des rapports, voir réponse finale.

## Limites
- Pas d'endpoint de fiche réelle CORE-04.
- Pas de session quick réelle.
- Pas de backfill apply.
- Pas de CourseSource.
- Pas de progression course-level complète.

## Risques restants
- Le cleanup storage reste best-effort : si la suppression échoue, l'erreur originale est conservée et un fichier orphelin peut théoriquement rester.
- Le processing réel dépend toujours du worker/queue existant et de sa configuration d'environnement.
- Le mapping public de l'ancien endpoint ne retourne pas courseId, volontairement pour compatibilité.

## Ce qui reste pour CORE-04
- Construire la fiche course-level depuis les documents READY.
- Définir le comportement quand aucune source READY n'est disponible.
- Ajouter les endpoints/front correspondants sans réintroduire de fixtures.

## Auto-critique
- Le use case Course-centric dépend de ports documents/jobs, ce qui crée une composition transversale mais évite de laisser le client choisir subjectId.
- Extraire la validation PDF était légèrement plus large que le strict minimum, mais cela évite deux contrats upload divergents.
- Le retour CourseDocumentResponse est simple ; retourner un CourseDetail complet aurait évité un refresh front, mais aurait mélangé upload et lecture détaillée.

## Points discutables du prompt
- Extraire la validation PDF dans CORE-03 est défendable, mais aurait pu être fait dans un mini-lot technique si l'ancien endpoint était instable.
- Le use case pourrait aussi vivre dans documents/application ; je l'ai gardé dans courses/application parce que l'ownership et le subjectId dérivé sont Course-first.
- Le polling frontend pourrait attendre CORE-04 si le processing est très rapide en local, mais il est utile dès CORE-03 pour rendre le statut réel visible.


## Contenu complet des fichiers créés/modifiés/supprimés

Note : le rapport courant n'est pas inclus dans cette section pour éviter une récursion infinie. Aucun fichier supprimé.

### src/modules/courses/application/upload-course-pdf-for-course.use-case.spec.ts

```ts
import { DocumentProcessingQueue } from '../../jobs/application/document-processing.queue';
import {
  type DocumentFileStorage,
  type StoredDocumentFile,
} from '../../documents/application/document-file-storage';
import type { DocumentsRepository } from '../../documents/application/documents.repository';
import type {
  CourseDocumentDto,
  CoursesRepository,
} from './courses.repository';
import { UploadCoursePdfForCourseUseCase } from './upload-course-pdf-for-course.use-case';

describe('UploadCoursePdfForCourseUseCase', () => {
  it('loads the owned course context before storing the PDF', async () => {
    const harness = createHarness();

    harness.storage.saveCoursePdf.mockImplementation(() => {
      expect(
        harness.coursesRepository.findCourseOwnershipContext,
      ).toHaveBeenCalledWith({
        studentId: 'student-1',
        courseId: 'course-1',
      });
      return storedFile();
    });

    await harness.useCase.execute(validInput());

    expect(harness.storage.saveCoursePdf).toHaveBeenCalledTimes(1);
  });

  it('refuses unknown or cross-student courses without storing the file', async () => {
    const harness = createHarness();
    harness.coursesRepository.findCourseOwnershipContext.mockResolvedValue(
      null,
    );

    await expect(harness.useCase.execute(validInput())).rejects.toThrow(
      'Course not found',
    );

    expect(harness.storage.saveCoursePdf).not.toHaveBeenCalled();
    expect(harness.documentsRepository.create).not.toHaveBeenCalled();
    expect(harness.queue.enqueue).not.toHaveBeenCalled();
  });

  it('stores the PDF with the subject derived from the course and creates an attached document', async () => {
    const harness = createHarness();

    const result = await harness.useCase.execute(validInput());

    expect(result).toEqual(courseDocument());
    expect(harness.storage.saveCoursePdf).toHaveBeenCalledWith({
      firebaseUid: 'firebase-1',
      subjectId: 'subject-from-course',
      originalFileName: 'cours.pdf',
      content: Buffer.from('%PDF-1.7'),
      mimeType: 'application/pdf',
    });
    expect(harness.documentsRepository.create).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-from-course',
      courseId: 'course-1',
      kind: 'COURSE_PDF',
      fileName: 'stored-cours.pdf',
      storagePath:
        'students/firebase-1/subjects/subject-from-course/stored-cours.pdf',
      mimeType: 'application/pdf',
    });
    expect(harness.queue.enqueue).toHaveBeenCalledWith({
      documentId: 'document-1',
    });
  });

  it('cleans up storage if document creation fails', async () => {
    const harness = createHarness();
    harness.documentsRepository.create.mockRejectedValue(
      new Error('DB unavailable'),
    );

    await expect(harness.useCase.execute(validInput())).rejects.toThrow(
      'DB unavailable',
    );

    expect(harness.storage.deleteFile).toHaveBeenCalledWith({
      storagePath: storedFile().storagePath,
    });
    expect(harness.queue.enqueue).not.toHaveBeenCalled();
  });

  it('cleans up storage if processing enqueue fails', async () => {
    const harness = createHarness();
    harness.queue.enqueue.mockRejectedValue(new Error('Queue unavailable'));

    await expect(harness.useCase.execute(validInput())).rejects.toThrow(
      'Queue unavailable',
    );

    expect(harness.storage.deleteFile).toHaveBeenCalledWith({
      storagePath: storedFile().storagePath,
    });
  });

  it('rejects blank identifiers before reaching repositories', async () => {
    const harness = createHarness();

    await expect(
      harness.useCase.execute({ ...validInput(), courseId: ' ' }),
    ).rejects.toThrow('courseId is required');

    expect(
      harness.coursesRepository.findCourseOwnershipContext,
    ).not.toHaveBeenCalled();
  });
});

function createHarness() {
  const coursesRepository = createCoursesRepository();
  const documentsRepository = createDocumentsRepository();
  const storage = createStorage();
  const queue = createQueue();

  return {
    coursesRepository,
    documentsRepository,
    storage,
    queue,
    useCase: new UploadCoursePdfForCourseUseCase(
      coursesRepository as unknown as CoursesRepository,
      storage.service,
      documentsRepository.service,
      queue.service,
    ),
  };
}

function createCoursesRepository() {
  return {
    findCourseOwnershipContext: jest.fn().mockResolvedValue({
      courseId: 'course-1',
      studentId: 'student-1',
      subjectId: 'subject-from-course',
    }),
  };
}

function createDocumentsRepository(): {
  service: DocumentsRepository;
  create: jest.Mock;
} {
  const create = jest.fn().mockResolvedValue({
    id: 'document-1',
    studentId: 'student-1',
    subjectId: 'subject-from-course',
    courseId: 'course-1',
    kind: 'COURSE_PDF',
    fileName: 'stored-cours.pdf',
    storagePath: storedFile().storagePath,
    mimeType: 'application/pdf',
    status: 'UPLOADED',
    errorCode: null,
    createdAt: new Date('2026-06-18T12:00:00.000Z'),
    updatedAt: new Date('2026-06-18T12:00:00.000Z'),
  });

  return {
    service: {
      create,
      findBySubjectForStudent: jest.fn(),
      findByIdForStudent: jest.fn(),
      deleteForStudent: jest.fn(),
      findById: jest.fn(),
      markProcessing: jest.fn(),
      markReadyWithKnowledgeUnits: jest.fn(),
      replaceChunks: jest.fn(),
      findChunksByDocumentId: jest.fn(),
      findKnowledgeUnitsByDocumentForStudent: jest.fn(),
      replaceKnowledgeUnitSources: jest.fn(),
      markFailed: jest.fn(),
    },
    create,
  };
}

function createStorage(): {
  service: DocumentFileStorage;
  saveCoursePdf: jest.Mock;
  deleteFile: jest.Mock;
} {
  const saveCoursePdf = jest.fn().mockResolvedValue(storedFile());
  const deleteFile = jest.fn().mockResolvedValue(undefined);

  return {
    service: {
      saveCoursePdf,
      delete: deleteFile,
    },
    saveCoursePdf,
    deleteFile,
  };
}

function createQueue(): {
  service: DocumentProcessingQueue;
  enqueue: jest.Mock;
} {
  const enqueue = jest.fn().mockResolvedValue(undefined);

  return {
    service: { enqueue },
    enqueue,
  };
}

function validInput() {
  return {
    studentId: 'student-1',
    firebaseUid: 'firebase-1',
    courseId: 'course-1',
    originalFileName: 'cours.pdf',
    content: Buffer.from('%PDF-1.7'),
    mimeType: 'application/pdf',
  };
}

function storedFile(): StoredDocumentFile {
  return {
    fileName: 'stored-cours.pdf',
    storagePath:
      'students/firebase-1/subjects/subject-from-course/stored-cours.pdf',
    mimeType: 'application/pdf',
  };
}

function courseDocument(): CourseDocumentDto {
  return {
    id: 'document-1',
    courseId: 'course-1',
    documentId: 'document-1',
    fileName: 'stored-cours.pdf',
    kind: 'COURSE_PDF',
    status: 'UPLOADED',
    errorCode: null,
    createdAt: new Date('2026-06-18T12:00:00.000Z'),
    updatedAt: new Date('2026-06-18T12:00:00.000Z'),
  };
}

```

### src/modules/courses/application/upload-course-pdf-for-course.use-case.ts

```ts
import { Inject, Injectable } from '@nestjs/common';
import {
  DOCUMENT_FILE_STORAGE,
  type DocumentFileStorage,
} from '../../documents/application/document-file-storage';
import {
  DOCUMENTS_REPOSITORY,
  type DocumentsRepository,
  type RevisionDocumentDto,
} from '../../documents/application/documents.repository';
import {
  DOCUMENT_PROCESSING_QUEUE,
  type DocumentProcessingQueue,
} from '../../jobs/application/document-processing.queue';
import {
  COURSES_REPOSITORY,
  type CourseDocumentDto,
  type CoursesRepository,
} from './courses.repository';

@Injectable()
export class UploadCoursePdfForCourseUseCase {
  constructor(
    @Inject(COURSES_REPOSITORY)
    private readonly coursesRepository: CoursesRepository,
    @Inject(DOCUMENT_FILE_STORAGE)
    private readonly storage: DocumentFileStorage,
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(DOCUMENT_PROCESSING_QUEUE)
    private readonly documentProcessingQueue: DocumentProcessingQueue,
  ) {}

  async execute(input: {
    studentId: string;
    firebaseUid: string;
    courseId: string;
    originalFileName: string;
    content: Buffer;
    mimeType: string;
  }): Promise<CourseDocumentDto> {
    const studentId = requireNonEmpty(input.studentId, 'studentId is required');
    const firebaseUid = requireNonEmpty(
      input.firebaseUid,
      'firebaseUid is required',
    );
    const courseId = requireNonEmpty(input.courseId, 'courseId is required');

    if (!Buffer.isBuffer(input.content) || input.content.length === 0) {
      throw new Error('Document content is required');
    }

    const course = await this.coursesRepository.findCourseOwnershipContext({
      studentId,
      courseId,
    });

    if (!course) {
      throw new Error('Course not found');
    }

    const stored = await this.storage.saveCoursePdf({
      firebaseUid,
      subjectId: course.subjectId,
      originalFileName: input.originalFileName,
      content: input.content,
      mimeType: input.mimeType,
    });

    try {
      const document = await this.documentsRepository.create({
        studentId,
        subjectId: course.subjectId,
        courseId: course.courseId,
        kind: 'COURSE_PDF',
        fileName: stored.fileName,
        storagePath: stored.storagePath,
        mimeType: stored.mimeType,
      });

      await this.documentProcessingQueue.enqueue({ documentId: document.id });

      return toCourseDocumentDto(document);
    } catch (error) {
      // Storage is outside the DB transaction: delete the saved blob if DB or
      // queue registration fails, then surface the original failure.
      await this.storage
        .delete({ storagePath: stored.storagePath })
        .catch(() => {
          // Best-effort cleanup: preserving the DB/queue error is more useful to
          // callers than replacing it with a secondary storage delete failure.
        });
      throw error;
    }
  }
}

function requireNonEmpty(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message);
  }

  return value.trim();
}

function toCourseDocumentDto(document: RevisionDocumentDto): CourseDocumentDto {
  if (!document.courseId) {
    throw new Error('Course upload document is missing courseId');
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

```

### src/modules/courses/courses.module.ts

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { JobsModule } from '../jobs/jobs.module';
import { BackfillCoursesFromDocumentsDryRunUseCase } from './application/backfill-courses-from-documents.use-case';
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
  imports: [AuthModule, DocumentsModule, JobsModule, PrismaModule],
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
    COURSES_REPOSITORY,
  ],
})
export class CoursesModule {}

```

### src/modules/courses/infrastructure/prisma-courses.repository.spec.ts

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

### src/modules/courses/infrastructure/prisma-courses.repository.ts

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

### src/modules/courses/interfaces/courses.controller.spec.ts

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

  return {
    controller: new CoursesController(
      createCourse as unknown as CreateCourseUseCase,
      listCourses as unknown as ListSubjectCoursesWithStatsUseCase,
      getCourseDetail as unknown as GetCourseDetailUseCase,
      deleteCourse as unknown as DeleteCourseUseCase,
      uploadCoursePdfForCourse as unknown as UploadCoursePdfForCourseUseCase,
    ),
    createCourse,
    listCourses,
    getCourseDetail,
    deleteCourse,
    uploadCoursePdfForCourse,
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

```

### src/modules/courses/interfaces/courses.controller.ts

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

### src/modules/documents/application/documents.repository.ts

```ts
import { StudentId } from '../../../shared/domain/student-id';
import type { DocumentKind, DocumentStatus } from '../domain/document.entity';

export type { DocumentKind, DocumentStatus };

export interface RevisionDocumentDto {
  id: string;
  studentId: StudentId;
  subjectId: string;
  courseId: string | null;
  kind: DocumentKind;
  fileName: string;
  storagePath: string;
  mimeType: string;
  status: DocumentStatus;
  errorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicRevisionDocumentDto {
  id: string;
  subjectId: string;
  kind: DocumentKind;
  fileName: string;
  mimeType: string;
  status: DocumentStatus;
  errorCode: string | null;
}

export type KnowledgeUnitDifficulty = 'LOW' | 'MEDIUM' | 'HIGH';

export interface KnowledgeUnitPersistenceInput {
  title: string;
  summary: string;
  difficulty?: KnowledgeUnitDifficulty | null;
  displayOrder?: number | null;
  confidence?: number | null;
  extractionPromptVersion?: string | null;
  extractionSchemaVersion?: string | null;
  sourceChunkIds?: string[] | null;
}

export interface DocumentChunkPersistenceInput {
  index: number;
  text: string;
  charStart?: number | null;
  charEnd?: number | null;
  pageNumber?: number | null;
}

export interface RevisionDocumentChunkDto {
  id: string;
  documentId: string;
  subjectId: string;
  index: number;
  text: string;
  charStart: number | null;
  charEnd: number | null;
  pageNumber: number | null;
  createdAt: Date;
}

export interface KnowledgeUnitSourcePersistenceInput {
  chunkId: string;
  relevanceScore?: number | null;
}

export interface DocumentKnowledgeUnitSourceDto {
  chunkId: string;
  text: string;
  pageNumber: number | null;
  index: number;
}

export interface DocumentKnowledgeUnitDto {
  id: string;
  title: string;
  summary: string;
  difficulty: KnowledgeUnitDifficulty | null;
  displayOrder: number | null;
  confidence: number | null;
  sources: DocumentKnowledgeUnitSourceDto[];
}

export interface DocumentKnowledgeUnitsDto {
  documentId: string;
  documentStatus: DocumentStatus;
  items: DocumentKnowledgeUnitDto[];
}

export const DOCUMENTS_REPOSITORY = Symbol('DOCUMENTS_REPOSITORY');

export interface DocumentsRepository {
  create(input: {
    studentId: StudentId;
    subjectId: string;
    courseId?: string | null;
    kind: DocumentKind;
    fileName: string;
    storagePath: string;
    mimeType: string;
  }): Promise<RevisionDocumentDto>;

  findBySubjectForStudent(input: {
    studentId: StudentId;
    subjectId: string;
  }): Promise<RevisionDocumentDto[]>;

  findByIdForStudent(input: {
    studentId: StudentId;
    documentId: string;
  }): Promise<RevisionDocumentDto | null>;

  deleteForStudent(input: {
    studentId: StudentId;
    documentId: string;
  }): Promise<boolean>;

  findById(documentId: string): Promise<RevisionDocumentDto | null>;

  markProcessing(documentId: string): Promise<void>;

  markReadyWithKnowledgeUnits(input: {
    documentId: string;
    units: KnowledgeUnitPersistenceInput[];
  }): Promise<void>;

  replaceChunks(input: {
    documentId: string;
    chunks: DocumentChunkPersistenceInput[];
  }): Promise<void>;

  findChunksByDocumentId(
    documentId: string,
  ): Promise<RevisionDocumentChunkDto[]>;

  findKnowledgeUnitsByDocumentForStudent(input: {
    studentId: StudentId;
    documentId: string;
  }): Promise<DocumentKnowledgeUnitsDto | null>;

  replaceKnowledgeUnitSources(input: {
    knowledgeUnitId: string;
    subjectId: string;
    sources: KnowledgeUnitSourcePersistenceInput[];
  }): Promise<void>;

  markFailed(input: { documentId: string; errorCode: string }): Promise<void>;
}

```

### src/modules/documents/documents.module.ts

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../jobs/jobs.module';
import { PrismaModule } from '../../shared/infrastructure/prisma/prisma.module';
import { DOCUMENT_FILE_STORAGE } from './application/document-file-storage';
import { DOCUMENTS_REPOSITORY } from './application/documents.repository';
import { DeleteDocumentUseCase } from './application/delete-document.use-case';
import { GetDocumentUseCase } from './application/get-document.use-case';
import { ListDocumentKnowledgeUnitsUseCase } from './application/list-document-knowledge-units.use-case';
import { ListSubjectDocumentsUseCase } from './application/list-subject-documents.use-case';
import { RegisterDocumentUseCase } from './application/register-document.use-case';
import { UploadCoursePdfUseCase } from './application/upload-course-pdf.use-case';
import { LocalDocumentFileStorage } from './infrastructure/local-document-file-storage';
import { PrismaDocumentsRepository } from './infrastructure/prisma-documents.repository';
import { DocumentsController } from './interfaces/documents.controller';

@Module({
  imports: [AuthModule, JobsModule, PrismaModule],
  controllers: [DocumentsController],
  providers: [
    DeleteDocumentUseCase,
    GetDocumentUseCase,
    ListDocumentKnowledgeUnitsUseCase,
    ListSubjectDocumentsUseCase,
    RegisterDocumentUseCase,
    UploadCoursePdfUseCase,
    {
      provide: DOCUMENTS_REPOSITORY,
      useClass: PrismaDocumentsRepository,
    },
    {
      provide: DOCUMENT_FILE_STORAGE,
      useClass: LocalDocumentFileStorage,
    },
  ],
  exports: [DOCUMENTS_REPOSITORY, DOCUMENT_FILE_STORAGE],
})
export class DocumentsModule {}

```

### src/modules/documents/infrastructure/prisma-documents.repository.spec.ts

```ts
import { PrismaDocumentsRepository } from './prisma-documents.repository';

type DocumentRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  courseId: string | null;
  kind: 'COURSE_PDF' | 'EXAM_PDF' | 'EXAM_IMAGE';
  fileName: string;
  storagePath: string;
  mimeType: string;
  status: 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';
  errorCode?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaDocumentsMock = {
  subject: {
    findFirst: jest.Mock;
  };
  document: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  documentProcessingJob: {
    create: jest.Mock;
    updateMany: jest.Mock;
  };
  knowledgeUnit: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    createMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  documentChunk: {
    deleteMany: jest.Mock;
    createMany: jest.Mock;
    findMany: jest.Mock;
  };
  knowledgeUnitSource: {
    deleteMany: jest.Mock;
    createMany: jest.Mock;
  };
  $transaction: jest.Mock<Promise<unknown>, [TransactionCallback]>;
};

type TransactionCallback = (tx: PrismaDocumentsMock) => unknown;

describe('PrismaDocumentsRepository', () => {
  const createRepository = () => {
    const prisma: PrismaDocumentsMock = {
      subject: {
        findFirst: jest.fn(),
      },
      document: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      documentProcessingJob: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      knowledgeUnit: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      documentChunk: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
      },
      knowledgeUnitSource: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn<Promise<unknown>, [TransactionCallback]>(),
    };
    prisma.$transaction.mockImplementation((callback) =>
      Promise.resolve(callback(prisma)),
    );

    return {
      prisma,
      repository: new PrismaDocumentsRepository(prisma as never),
    };
  };

  const record = (input: Partial<DocumentRecord> = {}): DocumentRecord => ({
    id: 'document-1',
    studentId: 'student-1',
    subjectId: 'subject-1',
    courseId: null,
    kind: 'COURSE_PDF',
    fileName: 'cours.pdf',
    storagePath: 'students/student-1/subjects/subject-1/cours.pdf',
    mimeType: 'application/pdf',
    status: 'UPLOADED',
    errorCode: null,
    createdAt: new Date('2026-06-18T12:00:00.000Z'),
    updatedAt: new Date('2026-06-18T12:00:00.000Z'),
    ...input,
  });

  it('creates a document and pending processing job in one transaction', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.document.create.mockResolvedValue(record());

    const document = await repository.create({
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: ' cours.pdf ',
      storagePath: ' students/student-1/subjects/subject-1/cours.pdf ',
      mimeType: ' application/pdf ',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.subject.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'subject-1',
        studentId: 'student-1',
      },
    });
    expect(prisma.document.create).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: null,
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/student-1/subjects/subject-1/cours.pdf',
        mimeType: 'application/pdf',
      },
    });
    expect(prisma.documentProcessingJob.create).toHaveBeenCalledWith({
      data: {
        documentId: 'document-1',
        status: 'PENDING',
      },
    });
    expect(document).toMatchObject({
      id: 'document-1',
      status: 'UPLOADED',
    });
  });

  it('creates a course-attached document when courseId is provided', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.document.create.mockResolvedValue(record({ courseId: 'course-1' }));

    const document = await repository.create({
      studentId: 'student-1',
      subjectId: 'subject-1',
      courseId: 'course-1',
      kind: 'COURSE_PDF',
      fileName: 'cours.pdf',
      storagePath: 'students/student-1/subjects/subject-1/cours.pdf',
      mimeType: 'application/pdf',
    });

    expect(prisma.document.create).toHaveBeenCalledWith({
      data: {
        studentId: 'student-1',
        subjectId: 'subject-1',
        courseId: 'course-1',
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/student-1/subjects/subject-1/cours.pdf',
        mimeType: 'application/pdf',
      },
    });
    expect(document.courseId).toBe('course-1');
  });

  it('does not create a document when the subject is not owned by the student', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue(null);

    await expect(
      repository.create({
        studentId: 'student-1',
        subjectId: 'subject-2',
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/student-1/subjects/subject-2/cours.pdf',
        mimeType: 'application/pdf',
      }),
    ).rejects.toThrow('Subject does not belong to student');

    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(prisma.documentProcessingJob.create).not.toHaveBeenCalled();
  });

  it('lists documents for a subject owned by the student', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue({ id: 'subject-1' });
    prisma.document.findMany.mockResolvedValue([
      record({ id: 'document-1' }),
      record({ id: 'document-2', status: 'READY' }),
    ]);

    const documents = await repository.findBySubjectForStudent({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });

    expect(prisma.subject.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'subject-1',
        studentId: 'student-1',
      },
    });
    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        subjectId: 'subject-1',
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(documents.map((document) => document.id)).toEqual([
      'document-1',
      'document-2',
    ]);
  });

  it('rejects document listing for subjects not owned by the student', async () => {
    const { prisma, repository } = createRepository();
    prisma.subject.findFirst.mockResolvedValue(null);

    await expect(
      repository.findBySubjectForStudent({
        studentId: 'student-1',
        subjectId: 'subject-2',
      }),
    ).rejects.toThrow('Subject does not belong to student');

    expect(prisma.document.findMany).not.toHaveBeenCalled();
  });

  it('finds a document by id for its student owner', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(record());

    const document = await repository.findByIdForStudent({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        studentId: 'student-1',
      },
    });
    expect(document?.id).toBe('document-1');
  });

  it('finds a document by id for internal worker processing', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(record());

    const document = await repository.findById('document-1');

    expect(prisma.document.findUnique).toHaveBeenCalledWith({
      where: { id: 'document-1' },
    });
    expect(document?.storagePath).toBe(
      'students/student-1/subjects/subject-1/cours.pdf',
    );
  });

  it('returns the stored processing error code for failed documents', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(
      record({
        status: 'FAILED',
        errorCode: 'KNOWLEDGE_EXTRACTION_FAILED',
      }),
    );

    const document = await repository.findByIdForStudent({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(document).toMatchObject({
      id: 'document-1',
      status: 'FAILED',
      errorCode: 'KNOWLEDGE_EXTRACTION_FAILED',
    });
  });

  it('deletes a document owned by a student after deleting document knowledge units', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(record());
    prisma.knowledgeUnit.deleteMany.mockResolvedValue({ count: 2 });
    prisma.document.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      repository.deleteForStudent({
        studentId: 'student-1',
        documentId: 'document-1',
      }),
    ).resolves.toBe(true);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        studentId: 'student-1',
      },
      select: {
        id: true,
        subjectId: true,
      },
    });
    expect(prisma.knowledgeUnit.deleteMany).toHaveBeenCalledWith({
      where: {
        documentId: 'document-1',
        subjectId: 'subject-1',
      },
    });
    expect(prisma.document.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        studentId: 'student-1',
      },
    });
  });

  it('returns false without deleting dependents for unknown or cross-student documents', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(
      repository.deleteForStudent({
        studentId: 'student-1',
        documentId: 'document-2',
      }),
    ).resolves.toBe(false);

    expect(prisma.knowledgeUnit.deleteMany).not.toHaveBeenCalled();
    expect(prisma.document.deleteMany).not.toHaveBeenCalled();
  });

  it('marks uploaded documents as processing and records the running job', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 1 });

    await repository.markProcessing('document-1');

    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: 'document-1', status: 'UPLOADED' },
      data: { status: 'PROCESSING', errorCode: null },
    });
    expect(prisma.documentProcessingJob.updateMany).toHaveBeenCalledWith({
      where: { documentId: 'document-1', status: 'PENDING' },
      data: { status: 'RUNNING' },
    });
  });

  it('rejects processing transitions from non-uploaded documents', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.updateMany.mockResolvedValue({ count: 0 });

    await expect(repository.markProcessing('document-1')).rejects.toThrow(
      'Document is not uploaded',
    );

    expect(prisma.documentProcessingJob.updateMany).not.toHaveBeenCalled();
  });

  it('rejects processing transitions when no pending job exists', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 0 });

    await expect(repository.markProcessing('document-1')).rejects.toThrow(
      'Document processing job is not pending',
    );
  });

  it('marks processing documents ready with extracted knowledge units', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 1 });

    await repository.markReadyWithKnowledgeUnits({
      documentId: 'document-1',
      units: [{ title: ' Cellules ', summary: ' Bases ' }],
    });

    expect(prisma.document.findUnique).toHaveBeenCalledWith({
      where: { id: 'document-1' },
    });
    expect(prisma.knowledgeUnit.createMany).toHaveBeenCalledWith({
      data: [
        {
          documentId: 'document-1',
          subjectId: 'subject-1',
          title: 'Cellules',
          summary: 'Bases',
        },
      ],
    });
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: 'document-1', status: 'PROCESSING' },
      data: { status: 'READY', errorCode: null },
    });
    expect(prisma.documentProcessingJob.updateMany).toHaveBeenCalledWith({
      where: { documentId: 'document-1', status: 'RUNNING' },
      data: { status: 'COMPLETED' },
    });
  });

  it('persists optional enrichment fields when marking knowledge units ready', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 1 });

    await repository.markReadyWithKnowledgeUnits({
      documentId: 'document-1',
      units: [
        {
          title: 'Séparation des pouvoirs',
          summary: 'Principe structurant les institutions.',
          difficulty: 'MEDIUM',
          displayOrder: 2,
          confidence: 0.84,
          extractionPromptVersion: 'document-knowledge-v1',
          extractionSchemaVersion: 'extracted-knowledge-v1',
        },
      ],
    });

    expect(prisma.knowledgeUnit.createMany).toHaveBeenCalledWith({
      data: [
        {
          documentId: 'document-1',
          subjectId: 'subject-1',
          title: 'Séparation des pouvoirs',
          summary: 'Principe structurant les institutions.',
          difficulty: 'MEDIUM',
          displayOrder: 2,
          confidence: 0.84,
          extractionPromptVersion: 'document-knowledge-v1',
          extractionSchemaVersion: 'extracted-knowledge-v1',
        },
      ],
    });
  });

  it('creates knowledge unit sources when marking sourced units ready', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.documentChunk.findMany.mockResolvedValue([
      { id: 'chunk-1' },
      { id: 'chunk-2' },
    ]);
    prisma.knowledgeUnit.create.mockResolvedValue({
      id: 'knowledge-unit-1',
      subjectId: 'subject-1',
    });
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 1 });

    await repository.markReadyWithKnowledgeUnits({
      documentId: 'document-1',
      units: [
        {
          title: 'Séparation des pouvoirs',
          summary: 'Principe structurant les institutions.',
          sourceChunkIds: ['chunk-2', 'chunk-1', 'chunk-2'],
          difficulty: 'MEDIUM',
          displayOrder: 2,
          confidence: 0.84,
          extractionPromptVersion: 'document-knowledge-v2',
          extractionSchemaVersion: 'extracted-knowledge-v2',
        },
      ],
    });

    expect(prisma.documentChunk.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['chunk-2', 'chunk-1'] },
        subjectId: 'subject-1',
        documentId: 'document-1',
      },
      select: { id: true },
    });
    expect(prisma.knowledgeUnit.create).toHaveBeenCalledWith({
      data: {
        documentId: 'document-1',
        subjectId: 'subject-1',
        title: 'Séparation des pouvoirs',
        summary: 'Principe structurant les institutions.',
        difficulty: 'MEDIUM',
        displayOrder: 2,
        confidence: 0.84,
        extractionPromptVersion: 'document-knowledge-v2',
        extractionSchemaVersion: 'extracted-knowledge-v2',
      },
    });
    expect(prisma.knowledgeUnitSource.createMany).toHaveBeenCalledWith({
      data: [
        {
          knowledgeUnitId: 'knowledge-unit-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-2',
          relevanceScore: null,
        },
        {
          knowledgeUnitId: 'knowledge-unit-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-1',
          relevanceScore: null,
        },
      ],
    });
    expect(prisma.knowledgeUnit.createMany).not.toHaveBeenCalled();
  });

  it('rejects sourced ready transitions when a source chunk belongs to another document', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.documentChunk.findMany.mockResolvedValue([{ id: 'chunk-1' }]);

    await expect(
      repository.markReadyWithKnowledgeUnits({
        documentId: 'document-1',
        units: [
          {
            title: 'Constitution',
            summary: 'Norme fondamentale.',
            sourceChunkIds: ['chunk-1', 'chunk-other-document'],
          },
        ],
      }),
    ).rejects.toThrow('Knowledge unit source chunk not found');

    expect(prisma.knowledgeUnit.create).not.toHaveBeenCalled();
    expect(prisma.knowledgeUnitSource.createMany).not.toHaveBeenCalled();
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });

  it('does not duplicate knowledge units when a document is already ready', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(record({ status: 'READY' }));

    await repository.markReadyWithKnowledgeUnits({
      documentId: 'document-1',
      units: [{ title: 'Cellules', summary: 'Bases' }],
    });

    expect(prisma.knowledgeUnit.createMany).not.toHaveBeenCalled();
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
    expect(prisma.documentProcessingJob.updateMany).not.toHaveBeenCalled();
  });

  it('rejects ready transitions from documents that are not processing', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'UPLOADED' }),
    );

    await expect(
      repository.markReadyWithKnowledgeUnits({
        documentId: 'document-1',
        units: [{ title: 'Cellules', summary: 'Bases' }],
      }),
    ).rejects.toThrow('Document is not processing');

    expect(prisma.knowledgeUnit.createMany).not.toHaveBeenCalled();
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });

  it('rejects ready transitions when no running job exists', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.markReadyWithKnowledgeUnits({
        documentId: 'document-1',
        units: [],
      }),
    ).rejects.toThrow('Document processing job is not running');
  });

  it('marks uploaded or processing documents failed', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 1 });

    await repository.markFailed({
      documentId: 'document-1',
      errorCode: 'EXTRACTION_FAILED',
    });

    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: 'document-1', status: { in: ['UPLOADED', 'PROCESSING'] } },
      data: { status: 'FAILED', errorCode: 'EXTRACTION_FAILED' },
    });
    expect(prisma.documentProcessingJob.updateMany).toHaveBeenCalledWith({
      where: {
        documentId: 'document-1',
        status: { in: ['PENDING', 'RUNNING'] },
      },
      data: { status: 'FAILED' },
    });
  });

  it('does not fail completed documents', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(record({ status: 'READY' }));

    await expect(
      repository.markFailed({
        documentId: 'document-1',
        errorCode: 'EXTRACTION_FAILED',
      }),
    ).rejects.toThrow('Document is already ready');

    expect(prisma.document.updateMany).not.toHaveBeenCalled();
    expect(prisma.documentProcessingJob.updateMany).not.toHaveBeenCalled();
  });

  it('rejects failure transitions when no active job exists', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.markFailed({
        documentId: 'document-1',
        errorCode: 'EXTRACTION_FAILED',
      }),
    ).rejects.toThrow('Document processing job is not active');
  });

  it('replaces chunks for a processing document in index order', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );

    await repository.replaceChunks({
      documentId: 'document-1',
      chunks: [
        {
          index: 1,
          text: 'Deuxieme bloc',
          charStart: 15,
          charEnd: 28,
          pageNumber: null,
        },
        {
          index: 0,
          text: 'Premier bloc',
          charStart: 0,
          charEnd: 13,
        },
      ],
    });

    expect(prisma.documentChunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'document-1' },
    });
    expect(prisma.documentChunk.createMany).toHaveBeenCalledWith({
      data: [
        {
          documentId: 'document-1',
          subjectId: 'subject-1',
          index: 0,
          text: 'Premier bloc',
          charStart: 0,
          charEnd: 13,
          pageNumber: null,
        },
        {
          documentId: 'document-1',
          subjectId: 'subject-1',
          index: 1,
          text: 'Deuxieme bloc',
          charStart: 15,
          charEnd: 28,
          pageNumber: null,
        },
      ],
    });
  });

  it('replaces existing chunks with an empty list without creating rows', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );

    await repository.replaceChunks({
      documentId: 'document-1',
      chunks: [],
    });

    expect(prisma.documentChunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'document-1' },
    });
    expect(prisma.documentChunk.createMany).not.toHaveBeenCalled();
  });

  it('rejects chunk replacement when the document is not processing', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(record({ status: 'READY' }));

    await expect(
      repository.replaceChunks({
        documentId: 'document-1',
        chunks: [{ index: 0, text: 'Bloc', charStart: 0, charEnd: 4 }],
      }),
    ).rejects.toThrow('Document is not processing');

    expect(prisma.documentChunk.deleteMany).not.toHaveBeenCalled();
    expect(prisma.documentChunk.createMany).not.toHaveBeenCalled();
  });

  it('lists document chunks by ascending index', async () => {
    const { prisma, repository } = createRepository();
    const createdAt = new Date('2026-06-14T12:00:00.000Z');
    prisma.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        documentId: 'document-1',
        subjectId: 'subject-1',
        index: 0,
        text: 'Premier bloc',
        charStart: 0,
        charEnd: 13,
        pageNumber: null,
        createdAt,
      },
    ]);

    const chunks = await repository.findChunksByDocumentId('document-1');

    expect(prisma.documentChunk.findMany).toHaveBeenCalledWith({
      where: { documentId: 'document-1' },
      orderBy: { index: 'asc' },
    });
    expect(chunks).toEqual([
      {
        id: 'chunk-1',
        documentId: 'document-1',
        subjectId: 'subject-1',
        index: 0,
        text: 'Premier bloc',
        charStart: 0,
        charEnd: 13,
        pageNumber: null,
        createdAt,
      },
    ]);
  });

  it('lists sourced knowledge units for a student document in stable order', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(record({ status: 'READY' }));
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      {
        id: 'unit-1',
        title: 'Séparation des pouvoirs',
        summary: 'Principe structurant les institutions.',
        difficulty: 'MEDIUM',
        displayOrder: 1,
        confidence: 0.84,
        sources: [
          {
            chunkId: 'chunk-2',
            chunk: {
              text: 'Second extrait.',
              pageNumber: null,
              index: 1,
            },
          },
          {
            chunkId: 'chunk-1',
            chunk: {
              text: 'Premier extrait.',
              pageNumber: null,
              index: 0,
            },
          },
        ],
      },
    ]);

    const response = await repository.findKnowledgeUnitsByDocumentForStudent({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        studentId: 'student-1',
      },
    });
    expect(prisma.knowledgeUnit.findMany).toHaveBeenCalledWith({
      where: {
        documentId: 'document-1',
        subject: {
          studentId: 'student-1',
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        sources: {
          include: {
            chunk: true,
          },
        },
      },
    });
    expect(response).toEqual({
      documentId: 'document-1',
      documentStatus: 'READY',
      items: [
        {
          id: 'unit-1',
          title: 'Séparation des pouvoirs',
          summary: 'Principe structurant les institutions.',
          difficulty: 'MEDIUM',
          displayOrder: 1,
          confidence: 0.84,
          sources: [
            {
              chunkId: 'chunk-1',
              text: 'Premier extrait.',
              pageNumber: null,
              index: 0,
            },
            {
              chunkId: 'chunk-2',
              text: 'Second extrait.',
              pageNumber: null,
              index: 1,
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(response)).not.toContain('storagePath');
  });

  it('returns null when listing knowledge units for another student document', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(null);

    const response = await repository.findKnowledgeUnitsByDocumentForStudent({
      studentId: 'student-2',
      documentId: 'document-1',
    });

    expect(response).toBeNull();
    expect(prisma.knowledgeUnit.findMany).not.toHaveBeenCalled();
  });

  it('does not return chunks that are not linked as sources', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(record({ status: 'READY' }));
    prisma.knowledgeUnit.findMany.mockResolvedValue([
      {
        id: 'unit-1',
        title: 'Constitution',
        summary: 'Norme fondamentale.',
        difficulty: null,
        displayOrder: null,
        confidence: null,
        sources: [],
      },
    ]);

    const response = await repository.findKnowledgeUnitsByDocumentForStudent({
      studentId: 'student-1',
      documentId: 'document-1',
    });

    expect(response?.items[0]?.sources).toEqual([]);
  });

  it('persists knowledge unit sources only for chunks in the same subject', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findUnique.mockResolvedValue({
      id: 'knowledge-unit-1',
      subjectId: 'subject-1',
    });
    prisma.documentChunk.findMany.mockResolvedValue([
      { id: 'chunk-1' },
      { id: 'chunk-2' },
    ]);

    await repository.replaceKnowledgeUnitSources({
      knowledgeUnitId: 'knowledge-unit-1',
      subjectId: 'subject-1',
      sources: [
        { chunkId: 'chunk-2', relevanceScore: 0.7 },
        { chunkId: 'chunk-1', relevanceScore: null },
      ],
    });

    expect(prisma.documentChunk.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['chunk-2', 'chunk-1'] },
        subjectId: 'subject-1',
      },
      select: { id: true },
    });
    expect(prisma.knowledgeUnitSource.deleteMany).toHaveBeenCalledWith({
      where: {
        knowledgeUnitId: 'knowledge-unit-1',
        subjectId: 'subject-1',
      },
    });
    expect(prisma.knowledgeUnitSource.createMany).toHaveBeenCalledWith({
      data: [
        {
          knowledgeUnitId: 'knowledge-unit-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-2',
          relevanceScore: 0.7,
        },
        {
          knowledgeUnitId: 'knowledge-unit-1',
          subjectId: 'subject-1',
          chunkId: 'chunk-1',
          relevanceScore: null,
        },
      ],
    });
  });

  it('rejects knowledge unit sources pointing to unknown chunks', async () => {
    const { prisma, repository } = createRepository();
    prisma.knowledgeUnit.findUnique.mockResolvedValue({
      id: 'knowledge-unit-1',
      subjectId: 'subject-1',
    });
    prisma.documentChunk.findMany.mockResolvedValue([{ id: 'chunk-1' }]);

    await expect(
      repository.replaceKnowledgeUnitSources({
        knowledgeUnitId: 'knowledge-unit-1',
        subjectId: 'subject-1',
        sources: [
          { chunkId: 'chunk-1', relevanceScore: 0.9 },
          { chunkId: 'chunk-unknown', relevanceScore: 0.5 },
        ],
      }),
    ).rejects.toThrow('Knowledge unit source chunk not found');

    expect(prisma.knowledgeUnitSource.deleteMany).not.toHaveBeenCalled();
    expect(prisma.knowledgeUnitSource.createMany).not.toHaveBeenCalled();
  });

  it('does not create knowledge unit sources while marking ready without source ids', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findUnique.mockResolvedValue(
      record({ status: 'PROCESSING' }),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.documentProcessingJob.updateMany.mockResolvedValue({ count: 1 });

    await repository.markReadyWithKnowledgeUnits({
      documentId: 'document-1',
      units: [{ title: 'Constitution', summary: 'Norme fondamentale.' }],
    });

    expect(prisma.knowledgeUnitSource.createMany).not.toHaveBeenCalled();
  });
});

```

### src/modules/documents/infrastructure/prisma-documents.repository.ts

```ts
import { Injectable } from '@nestjs/common';
import { KnowledgeUnit } from '../../revision/domain/knowledge-unit.entity';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  type DocumentChunkPersistenceInput,
  type DocumentKnowledgeUnitsDto,
  type DocumentsRepository,
  type KnowledgeUnitPersistenceInput,
  type KnowledgeUnitSourcePersistenceInput,
  type RevisionDocumentChunkDto,
  type RevisionDocumentDto,
} from '../application/documents.repository';
import { RevisionDocument } from '../domain/document.entity';
import type { DocumentKind, DocumentStatus } from '../domain/document.entity';

type DocumentRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  courseId: string | null;
  kind: DocumentKind;
  fileName: string;
  storagePath: string;
  mimeType: string;
  status: DocumentStatus;
  errorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type DocumentChunkRecord = {
  id: string;
  documentId: string;
  subjectId: string;
  index: number;
  text: string;
  charStart: number | null;
  charEnd: number | null;
  pageNumber: number | null;
  createdAt: Date;
};

@Injectable()
export class PrismaDocumentsRepository implements DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    studentId: string;
    subjectId: string;
    courseId?: string | null;
    kind: DocumentKind;
    fileName: string;
    storagePath: string;
    mimeType: string;
  }): Promise<RevisionDocumentDto> {
    const document = new RevisionDocument({
      id: 'validation-document',
      studentId: input.studentId,
      subjectId: input.subjectId,
      kind: input.kind,
      fileName: input.fileName,
      storagePath: input.storagePath,
      mimeType: input.mimeType,
      status: 'UPLOADED',
    });

    const record = await this.prisma.$transaction(async (tx) => {
      const subject = await tx.subject.findFirst({
        where: {
          id: document.subjectId,
          studentId: document.studentId,
        },
      });

      if (!subject) {
        throw new Error('Subject does not belong to student');
      }

      const createdDocument = await tx.document.create({
        data: {
          studentId: document.studentId,
          subjectId: document.subjectId,
          courseId: input.courseId ?? null,
          kind: document.kind,
          fileName: document.fileName,
          storagePath: document.storagePath,
          mimeType: document.mimeType,
        },
      });

      await tx.documentProcessingJob.create({
        data: {
          documentId: createdDocument.id,
          status: 'PENDING',
        },
      });

      return createdDocument;
    });

    return this.toDto(record);
  }

  async findBySubjectForStudent(input: {
    studentId: string;
    subjectId: string;
  }): Promise<RevisionDocumentDto[]> {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: input.subjectId,
        studentId: input.studentId,
      },
    });

    if (!subject) {
      throw new Error('Subject does not belong to student');
    }

    const records = await this.prisma.document.findMany({
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
      },
      orderBy: { createdAt: 'asc' },
    });

    return records.map((record) => this.toDto(record));
  }

  async findByIdForStudent(input: {
    studentId: string;
    documentId: string;
  }): Promise<RevisionDocumentDto | null> {
    const record = await this.prisma.document.findFirst({
      where: {
        id: input.documentId,
        studentId: input.studentId,
      },
    });

    return record ? this.toDto(record) : null;
  }

  async deleteForStudent(input: {
    studentId: string;
    documentId: string;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.document.findFirst({
        where: {
          id: input.documentId,
          studentId: input.studentId,
        },
        select: {
          id: true,
          subjectId: true,
        },
      });

      if (!document) {
        return false;
      }

      await tx.knowledgeUnit.deleteMany({
        where: {
          documentId: input.documentId,
          subjectId: document.subjectId,
        },
      });

      const result = await tx.document.deleteMany({
        where: {
          id: input.documentId,
          studentId: input.studentId,
        },
      });

      return result.count === 1;
    });
  }

  async findById(documentId: string): Promise<RevisionDocumentDto | null> {
    const record = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    return record ? this.toDto(record) : null;
  }

  async markProcessing(documentId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.document.updateMany({
        where: { id: documentId, status: 'UPLOADED' },
        data: { status: 'PROCESSING', errorCode: null },
      });

      if (result.count !== 1) {
        throw new Error('Document is not uploaded');
      }

      const jobResult = await tx.documentProcessingJob.updateMany({
        where: { documentId, status: 'PENDING' },
        data: { status: 'RUNNING' },
      });

      if (jobResult.count !== 1) {
        throw new Error('Document processing job is not pending');
      }
    });
  }

  async markReadyWithKnowledgeUnits(input: {
    documentId: string;
    units: KnowledgeUnitPersistenceInput[];
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.findUnique({
        where: { id: input.documentId },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      if (document.status === 'READY') {
        return;
      }

      if (document.status !== 'PROCESSING') {
        throw new Error('Document is not processing');
      }

      if (input.units.length > 0) {
        const allSourceChunkIds = [
          ...new Set(input.units.flatMap((unit) => unit.sourceChunkIds ?? [])),
        ];

        if (allSourceChunkIds.length === 0) {
          await tx.knowledgeUnit.createMany({
            data: input.units.map((unit) =>
              this.toKnowledgeUnitCreateData({
                documentId: input.documentId,
                subjectId: document.subjectId,
                unit,
              }),
            ),
          });
        } else {
          const chunks = await tx.documentChunk.findMany({
            where: {
              id: { in: allSourceChunkIds },
              subjectId: document.subjectId,
              documentId: input.documentId,
            },
            select: { id: true },
          });
          const existingChunkIds = new Set(chunks.map((chunk) => chunk.id));

          if (
            allSourceChunkIds.some((chunkId) => !existingChunkIds.has(chunkId))
          ) {
            throw new Error('Knowledge unit source chunk not found');
          }

          for (const unit of input.units) {
            const sourceChunkIds = [...new Set(unit.sourceChunkIds ?? [])];
            const createdKnowledgeUnit = await tx.knowledgeUnit.create({
              data: this.toKnowledgeUnitCreateData({
                documentId: input.documentId,
                subjectId: document.subjectId,
                unit,
              }),
            });

            if (sourceChunkIds.length > 0) {
              await tx.knowledgeUnitSource.createMany({
                data: sourceChunkIds.map((chunkId) => ({
                  knowledgeUnitId: createdKnowledgeUnit.id,
                  subjectId: document.subjectId,
                  chunkId,
                  relevanceScore: null,
                })),
              });
            }
          }
        }
      }

      const result = await tx.document.updateMany({
        where: { id: input.documentId, status: 'PROCESSING' },
        data: { status: 'READY', errorCode: null },
      });

      if (result.count !== 1) {
        throw new Error('Document is not processing');
      }

      const jobResult = await tx.documentProcessingJob.updateMany({
        where: { documentId: input.documentId, status: 'RUNNING' },
        data: { status: 'COMPLETED' },
      });

      if (jobResult.count !== 1) {
        throw new Error('Document processing job is not running');
      }
    });
  }

  async replaceChunks(input: {
    documentId: string;
    chunks: DocumentChunkPersistenceInput[];
  }): Promise<void> {
    const chunks = [...input.chunks]
      .map((chunk) => ({
        index: chunk.index,
        text: chunk.text.trim(),
        charStart: chunk.charStart ?? null,
        charEnd: chunk.charEnd ?? null,
        pageNumber: chunk.pageNumber ?? null,
      }))
      .filter((chunk) => chunk.text.length > 0)
      .sort((left, right) => left.index - right.index);

    await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.findUnique({
        where: { id: input.documentId },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      if (document.status !== 'PROCESSING') {
        throw new Error('Document is not processing');
      }

      await tx.documentChunk.deleteMany({
        where: { documentId: input.documentId },
      });

      if (chunks.length === 0) {
        return;
      }

      await tx.documentChunk.createMany({
        data: chunks.map((chunk) => ({
          documentId: input.documentId,
          subjectId: document.subjectId,
          index: chunk.index,
          text: chunk.text,
          charStart: chunk.charStart,
          charEnd: chunk.charEnd,
          pageNumber: chunk.pageNumber,
        })),
      });
    });
  }

  async findChunksByDocumentId(
    documentId: string,
  ): Promise<RevisionDocumentChunkDto[]> {
    const records = await this.prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { index: 'asc' },
    });

    return records.map((record) => this.toChunkDto(record));
  }

  async findKnowledgeUnitsByDocumentForStudent(input: {
    studentId: string;
    documentId: string;
  }): Promise<DocumentKnowledgeUnitsDto | null> {
    const document = await this.prisma.document.findFirst({
      where: {
        id: input.documentId,
        studentId: input.studentId,
      },
    });

    if (!document) {
      return null;
    }

    const knowledgeUnits = await this.prisma.knowledgeUnit.findMany({
      where: {
        documentId: input.documentId,
        subject: {
          studentId: input.studentId,
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        sources: {
          include: {
            chunk: true,
          },
        },
      },
    });

    return {
      documentId: document.id,
      documentStatus: document.status,
      items: knowledgeUnits.map((unit) => ({
        id: unit.id,
        title: unit.title,
        summary: unit.summary,
        difficulty: unit.difficulty,
        displayOrder: unit.displayOrder,
        confidence: unit.confidence,
        sources: unit.sources
          .map((source) => ({
            chunkId: source.chunkId,
            text: source.chunk.text,
            pageNumber: source.chunk.pageNumber,
            index: source.chunk.index,
          }))
          .sort((left, right) => left.index - right.index),
      })),
    };
  }

  async replaceKnowledgeUnitSources(input: {
    knowledgeUnitId: string;
    subjectId: string;
    sources: KnowledgeUnitSourcePersistenceInput[];
  }): Promise<void> {
    const sources = input.sources.map((source) => ({
      chunkId: source.chunkId,
      relevanceScore: source.relevanceScore ?? null,
    }));
    const chunkIds = [...new Set(sources.map((source) => source.chunkId))];

    await this.prisma.$transaction(async (tx) => {
      const knowledgeUnit = await tx.knowledgeUnit.findUnique({
        where: {
          id_subjectId: {
            id: input.knowledgeUnitId,
            subjectId: input.subjectId,
          },
        },
      });

      if (!knowledgeUnit) {
        throw new Error('Knowledge unit not found');
      }

      if (chunkIds.length > 0) {
        const chunks = await tx.documentChunk.findMany({
          where: {
            id: { in: chunkIds },
            subjectId: input.subjectId,
          },
          select: { id: true },
        });
        const existingChunkIds = new Set(chunks.map((chunk) => chunk.id));

        if (chunkIds.some((chunkId) => !existingChunkIds.has(chunkId))) {
          throw new Error('Knowledge unit source chunk not found');
        }
      }

      await tx.knowledgeUnitSource.deleteMany({
        where: {
          knowledgeUnitId: input.knowledgeUnitId,
          subjectId: input.subjectId,
        },
      });

      if (sources.length === 0) {
        return;
      }

      await tx.knowledgeUnitSource.createMany({
        data: sources.map((source) => ({
          knowledgeUnitId: input.knowledgeUnitId,
          subjectId: input.subjectId,
          chunkId: source.chunkId,
          relevanceScore: source.relevanceScore,
        })),
      });
    });
  }

  async markFailed(input: {
    documentId: string;
    errorCode: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.findUnique({
        where: { id: input.documentId },
      });

      if (!document) {
        throw new Error('Document not found');
      }

      if (document.status === 'FAILED') {
        return;
      }

      if (document.status === 'READY') {
        throw new Error('Document is already ready');
      }

      const result = await tx.document.updateMany({
        where: {
          id: input.documentId,
          status: { in: ['UPLOADED', 'PROCESSING'] },
        },
        data: { status: 'FAILED', errorCode: input.errorCode },
      });

      if (result.count !== 1) {
        throw new Error('Document is not active');
      }

      const jobResult = await tx.documentProcessingJob.updateMany({
        where: {
          documentId: input.documentId,
          status: { in: ['PENDING', 'RUNNING'] },
        },
        data: { status: 'FAILED' },
      });

      if (jobResult.count !== 1) {
        throw new Error('Document processing job is not active');
      }
    });
  }

  private toDto(record: DocumentRecord): RevisionDocumentDto {
    const document = new RevisionDocument(record);

    return {
      id: document.id,
      studentId: document.studentId,
      subjectId: document.subjectId,
      courseId: record.courseId,
      kind: document.kind,
      fileName: document.fileName,
      storagePath: document.storagePath,
      mimeType: document.mimeType,
      status: document.status,
      errorCode: document.errorCode,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toChunkDto(record: DocumentChunkRecord): RevisionDocumentChunkDto {
    return {
      id: record.id,
      documentId: record.documentId,
      subjectId: record.subjectId,
      index: record.index,
      text: record.text,
      charStart: record.charStart,
      charEnd: record.charEnd,
      pageNumber: record.pageNumber,
      createdAt: record.createdAt,
    };
  }

  private toKnowledgeUnitCreateData(input: {
    documentId: string;
    subjectId: string;
    unit: KnowledgeUnitPersistenceInput;
  }) {
    const knowledgeUnit = new KnowledgeUnit({
      id: 'validation-knowledge-unit',
      subjectId: input.subjectId,
      title: input.unit.title,
      summary: input.unit.summary,
    });

    return {
      documentId: input.documentId,
      subjectId: knowledgeUnit.subjectId,
      title: knowledgeUnit.title,
      summary: knowledgeUnit.summary,
      difficulty: input.unit.difficulty ?? undefined,
      displayOrder: input.unit.displayOrder ?? undefined,
      confidence: input.unit.confidence ?? undefined,
      extractionPromptVersion: input.unit.extractionPromptVersion ?? undefined,
      extractionSchemaVersion: input.unit.extractionSchemaVersion ?? undefined,
    };
  }
}

```

### src/modules/documents/interfaces/course-pdf-upload.validator.ts

```ts
import { BadRequestException } from '@nestjs/common';

const MAX_FILE_NAME_LENGTH = 255;
const MAX_MIME_TYPE_LENGTH = 100;

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export type UploadedCoursePdfFile = {
  originalname: string;
  mimetype: string;
  buffer?: Buffer;
  size: number;
};

export type ValidatedCoursePdfFile = {
  originalFileName: string;
  content: Buffer;
  mimeType: string;
};

export function validateCoursePdfFile(
  file: UploadedCoursePdfFile | undefined,
): ValidatedCoursePdfFile {
  if (!file) {
    throw new BadRequestException('Document file is required');
  }

  const originalFileName = trimRequiredString(
    file.originalname,
    'Document file name is required',
    MAX_FILE_NAME_LENGTH,
  );
  validateFileName(originalFileName);

  if (!originalFileName.toLowerCase().endsWith('.pdf')) {
    throw new BadRequestException('Course documents must be PDF files');
  }

  const mimeType = trimRequiredString(
    file.mimetype,
    'Document mime type is required',
    MAX_MIME_TYPE_LENGTH,
  );

  if (mimeType !== 'application/pdf') {
    throw new BadRequestException('PDF documents must use application/pdf');
  }

  if (!file.buffer || file.buffer.length === 0 || file.size === 0) {
    throw new BadRequestException('Document content is required');
  }

  if (
    file.size > MAX_DOCUMENT_BYTES ||
    file.buffer.length > MAX_DOCUMENT_BYTES
  ) {
    throw new BadRequestException('Document file is too large');
  }

  return {
    originalFileName,
    content: file.buffer,
    mimeType,
  };
}

function trimRequiredString(
  value: unknown,
  message: string,
  maxLength?: number,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(message);
  }

  const trimmed = value.trim();

  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw new BadRequestException(message);
  }

  return trimmed;
}

function validateFileName(fileName: string): void {
  if (
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName.includes('%') ||
    fileName === '.' ||
    fileName === '..'
  ) {
    throw new BadRequestException('Document file name must be canonical');
  }
}

```

### src/modules/documents/interfaces/documents.controller.ts

```ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  UploadedFile,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedStudent } from '../../auth/interfaces/authenticated-student';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import { DeleteDocumentUseCase } from '../application/delete-document.use-case';
import {
  GetDocumentUseCase,
  toPublicDocument,
} from '../application/get-document.use-case';
import { ListDocumentKnowledgeUnitsUseCase } from '../application/list-document-knowledge-units.use-case';
import { ListSubjectDocumentsUseCase } from '../application/list-subject-documents.use-case';
import { RegisterDocumentUseCase } from '../application/register-document.use-case';
import { UploadCoursePdfUseCase } from '../application/upload-course-pdf.use-case';
import { DOCUMENT_KINDS, type DocumentKind } from '../domain/document.entity';
import {
  MAX_DOCUMENT_BYTES,
  type UploadedCoursePdfFile,
  validateCoursePdfFile,
} from './course-pdf-upload.validator';

const MAX_FILE_NAME_LENGTH = 255;
const MAX_STORAGE_PATH_LENGTH = 512;
const MAX_MIME_TYPE_LENGTH = 100;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

class RegisterDocumentDto {
  subjectId!: string;
  kind!: string;
  fileName!: string;
  storagePath!: string;
  mimeType!: string;
}

class UploadCoursePdfDto {
  subjectId!: string;
}

@Controller()
@UseGuards(FirebaseAuthGuard)
export class DocumentsController {
  constructor(
    private readonly registerDocument: RegisterDocumentUseCase,
    private readonly listSubjectDocuments: ListSubjectDocumentsUseCase,
    private readonly getDocument: GetDocumentUseCase,
    private readonly listDocumentKnowledgeUnits: ListDocumentKnowledgeUnitsUseCase,
    private readonly uploadCoursePdfUseCase: UploadCoursePdfUseCase,
    private readonly deleteDocumentUseCase: DeleteDocumentUseCase,
  ) {}

  @Post('documents')
  register(
    @CurrentStudent() student: AuthenticatedStudent,
    @Body() body: RegisterDocumentDto,
  ) {
    const validatedBody = validateRegisterDocumentBody(
      student.firebaseUid,
      body,
    );

    return this.registerDocument
      .execute({
        studentId: student.id,
        subjectId: validatedBody.subjectId,
        kind: validatedBody.kind,
        fileName: validatedBody.fileName,
        storagePath: validatedBody.storagePath,
        mimeType: validatedBody.mimeType,
      })
      .then(toPublicDocument)
      .catch((error: unknown) => {
        normalizeDocumentRegistrationError(error);
      });
  }

  @Post('documents/course-pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_DOCUMENT_BYTES },
    }),
  )
  uploadCoursePdf(
    @CurrentStudent() student: AuthenticatedStudent,
    @Body() body: UploadCoursePdfDto,
    @UploadedFile() file: UploadedCoursePdfFile | undefined,
  ) {
    const subjectId = trimRequiredString(
      body?.subjectId,
      'Document subjectId is required',
    );
    const validatedFile = validateCoursePdfFile(file);

    return this.uploadCoursePdfUseCase
      .execute({
        studentId: student.id,
        firebaseUid: student.firebaseUid,
        subjectId,
        originalFileName: validatedFile.originalFileName,
        content: validatedFile.content,
        mimeType: validatedFile.mimeType,
      })
      .then(toPublicDocument)
      .catch((error: unknown) => {
        normalizeDocumentRegistrationError(error);
      });
  }

  @Get('subjects/:subjectId/documents')
  listForSubject(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('subjectId') subjectId: string,
  ) {
    return this.listSubjectDocuments
      .execute({
        studentId: student.id,
        subjectId,
      })
      .then((documents) => documents.map(toPublicDocument))
      .catch((error: unknown) => {
        normalizeDocumentRegistrationError(error);
      });
  }

  @Get('documents/:documentId')
  get(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('documentId') documentId: string,
  ) {
    const validatedDocumentId = trimRequiredString(
      documentId,
      'Document id is required',
    );

    return this.getDocument.execute({
      studentId: student.id,
      documentId: validatedDocumentId,
    });
  }

  @Get('documents/:documentId/knowledge-units')
  listKnowledgeUnits(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('documentId') documentId: string,
  ) {
    const validatedDocumentId = trimRequiredString(
      documentId,
      'Document id is required',
    );

    return this.listDocumentKnowledgeUnits.execute({
      studentId: student.id,
      documentId: validatedDocumentId,
    });
  }

  @Delete('documents/:documentId')
  @HttpCode(204)
  delete(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('documentId') documentId: string,
  ) {
    const validatedDocumentId = trimRequiredString(
      documentId,
      'Document id is required',
    );

    return this.deleteDocumentUseCase.execute({
      studentId: student.id,
      documentId: validatedDocumentId,
    });
  }
}

function validateRegisterDocumentBody(
  storageOwnerId: string,
  body: RegisterDocumentDto,
): {
  subjectId: string;
  kind: DocumentKind;
  fileName: string;
  storagePath: string;
  mimeType: string;
} {
  const subjectId = trimRequiredString(
    body?.subjectId,
    'Document subjectId is required',
  );
  const kind = validateDocumentKind(body?.kind);
  const fileName = trimRequiredString(
    body?.fileName,
    'Document file name is required',
    MAX_FILE_NAME_LENGTH,
  );
  const storagePath = trimRequiredString(
    body?.storagePath,
    'Document storage path is required',
    MAX_STORAGE_PATH_LENGTH,
  );
  const mimeType = trimRequiredString(
    body?.mimeType,
    'Document mime type is required',
    MAX_MIME_TYPE_LENGTH,
  );

  validateFileName(fileName);
  validateStoragePath({
    storageOwnerId,
    subjectId,
    fileName,
    storagePath,
  });

  if (
    (kind === 'COURSE_PDF' || kind === 'EXAM_PDF') &&
    mimeType !== 'application/pdf'
  ) {
    throw new BadRequestException('PDF documents must use application/pdf');
  }

  if (kind === 'EXAM_IMAGE' && !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new BadRequestException(
      'Exam images must use image/jpeg, image/png, or image/webp',
    );
  }

  return {
    subjectId,
    kind,
    fileName,
    storagePath,
    mimeType,
  };
}

function trimRequiredString(
  value: unknown,
  message: string,
  maxLength?: number,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(message);
  }

  const trimmed = value.trim();

  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw new BadRequestException(message);
  }

  return trimmed;
}

function validateDocumentKind(value: unknown): DocumentKind {
  if (
    typeof value !== 'string' ||
    !DOCUMENT_KINDS.includes(value as DocumentKind)
  ) {
    throw new BadRequestException(
      'Document kind must be COURSE_PDF, EXAM_PDF, or EXAM_IMAGE',
    );
  }

  return value as DocumentKind;
}

function validateFileName(fileName: string): void {
  if (
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName.includes('%') ||
    fileName === '.' ||
    fileName === '..'
  ) {
    throw new BadRequestException('Document file name must be canonical');
  }
}

function validateStoragePath(input: {
  storageOwnerId: string;
  subjectId: string;
  fileName: string;
  storagePath: string;
}): void {
  if (
    input.storagePath.includes('\\') ||
    input.storagePath.includes('%') ||
    input.storagePath.startsWith('/') ||
    input.storagePath.endsWith('/')
  ) {
    throw new BadRequestException('Document storage path must be canonical');
  }

  const segments = input.storagePath.split('/');

  if (
    segments.length !== 5 ||
    segments.some(
      (segment) => segment === '' || segment === '.' || segment === '..',
    )
  ) {
    throw new BadRequestException('Document storage path must be canonical');
  }

  const [
    studentsSegment,
    studentSegment,
    subjectsSegment,
    subjectSegment,
    fileSegment,
  ] = segments;

  if (
    studentsSegment !== 'students' ||
    studentSegment !== input.storageOwnerId ||
    subjectsSegment !== 'subjects' ||
    subjectSegment !== input.subjectId ||
    fileSegment !== input.fileName
  ) {
    throw new BadRequestException(
      'Document storage path must match the current student, subject, and file name',
    );
  }
}

function normalizeDocumentRegistrationError(error: unknown): never {
  if (
    error instanceof Error &&
    (error.message === 'Subject does not belong to student' ||
      error.message ===
        'Document kind must be COURSE_PDF, EXAM_PDF, or EXAM_IMAGE' ||
      error.message === 'Document file name is required' ||
      error.message === 'Document storage path is required' ||
      error.message === 'Document mime type is required' ||
      error.message === 'Document content is required' ||
      error.message === 'Course documents must be PDF files' ||
      error.message === 'PDF documents must use application/pdf' ||
      error.message === 'Exam images must use an image mime type' ||
      error.message ===
        'Exam images must use image/jpeg, image/png, or image/webp')
  ) {
    throw new BadRequestException(error.message);
  }

  throw error;
}

```

### test/critical-paths.e2e-spec.ts

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

