# CORE-06C — Backend 06B alignment + source deletion contract hardening

## 1. Résumé

CORE-06C côté backend aligne le code, les tests et la documentation avec l'état réel du MVP Core. Aucun endpoint nouveau n'a été ajouté : `POST /courses/:courseId/revision-sessions/quick` avait déjà son test `401` dans les critical paths via CORE-06B, et `DELETE /courses/:courseId/sources/:documentId` existait déjà. Le lot ajoute un test repository ciblé pour verrouiller que la suppression d'une source de cours ne supprime rien si le document n'appartient pas au cours demandé, puis documente officiellement cette capacité dans le runbook.

## 2. Audit initial

- `docs/core/CORE_06B_PROGRESS_REFRESH_AND_ACCEPTANCE_HARDENING_REPORT.md` existait, mais contenait encore un statut obsolète sur `git diff --check` après génération du rapport final.
- `docs/core/MVP_CORE_ACCEPTANCE_RUNBOOK.md` existait et listait déjà `DELETE /courses/:courseId/sources/:documentId`, mais le smoke manuel ne demandait pas explicitement de tester la suppression.
- `test/critical-paths.e2e-spec.ts` contient déjà `POST /courses/course-1/revision-sessions/quick` en `401` dans le bloc protected routes.
- `test/critical-paths.e2e-spec.ts` contient déjà `DELETE /courses/course-1/sources/document-1` en `401`, un happy path `204`, et un mapping `404` source introuvable.
- `CoursesController` prend `studentId` depuis `CurrentStudent`, et `courseId`/`documentId` depuis le path pour le delete source.
- La suppression réelle est portée par `DeleteCourseDocumentUseCase`, puis `DocumentsRepository.deleteCourseDocumentForStudent`.
- Les tests controller/use case existaient déjà ; le gap résiduel était le cas repository direct `findFirst(null)` pour `deleteCourseDocumentForStudent`.
- Aucun `CourseSource` n'existe dans `src` ou `test`; les occurrences sont documentaires.

## 3. Sub-agents/passes utilisées

- Backend Contract Agent : audit read-only des endpoints course/source/progress/quick, des tests `401`, et du contrat delete source.
- Frontend Contract Agent : audit read-only côté app ; ses conclusions sont intégrées dans le rapport frontend.
- Docs Agent : passe manuelle de correction runbook/rapports, suppression des formulations obsolètes sur les validations.
- QA Agent : validations locales listées en section 7.
- Reviewer Agent : auto-review finale en section 13.

## 4. Modifications backend

- Ajout d'un test repository dans `PrismaDocumentsRepository` : `deleteCourseDocumentForStudent` retourne `false` et ne supprime ni `KnowledgeUnit` ni `Document` si le document n'est pas trouvé pour le triplet `studentId` + `courseId` + `documentId`.
- Runbook backend mis à jour pour inclure une étape smoke optionnelle de suppression de source de cours.
- Rapport CORE-06B corrigé pour remplacer l'ancien statut `git diff --check` et clarifier que le commit CORE-06B a été réalisé après autorisation explicite, pas pendant l'exécution initiale du lot.
- Aucun controller, endpoint, use case, modèle Prisma, migration, prompt IA ou Genkit modifié.

## 5. Modifications frontend

Non applicable dans ce repo. Les changements frontend sont documentés dans le rapport app `docs/core/CORE_06C_BACKEND_ALIGNMENT_AND_SOURCE_DELETE_HARDENING_REPORT.md`.

## 6. Tests ajoutés

- `src/modules/documents/infrastructure/prisma-documents.repository.spec.ts` : ajoute le cas `does not delete a course document when the document is outside the requested course`.
- Tests déjà existants confirmés sans duplication : quick `401`, delete source `401`, delete source `204`, delete source `404`, controller delete, use case delete.

## 7. Commandes exécutées et résultats exacts

- `npm test -- prisma-documents.repository --runInBand` : OK, 1 suite, 35 tests.
- `npx prisma validate` : OK, schema valide.
- `npx prisma generate` : OK, Prisma Client 7.8.0 généré.
- `npm run build` : OK.
- `npm run lint:check` : OK.
- `npm test -- modules/courses --runInBand` : OK, 9 suites, 76 tests.
- `npm test -- revision-sessions --runInBand` : OK, 6 suites, 44 tests.
- `npm test -- --runInBand` : OK, 78 suites passées, 1 skipped, 685 tests passés, 1 skipped.
- `npm run test:e2e -- --runInBand` : OK, 2 suites, 33 tests.
- `rg -n "CourseSource" src test docs/core || true` : aucune occurrence dans `src` ou `test`; occurrences documentaires uniquement dans `docs/core`.
- `git diff --check` : OK, relancé après génération du rapport CORE-06C.

## 8. Preuve anti-fixtures

Côté backend, aucune fixture MVP front (`Loi normale`, `78%`, `870`, `7 jours`) n'est concernée par les modules modifiés. Aucun changement backend n'ajoute de fixture de production.

## 9. Preuve anti-CourseSource

Commande exécutée : `rg -n "CourseSource" src test docs/core || true`.

Résultat : pas d'occurrence dans `src` ni `test`; uniquement des mentions documentaires dans les rapports/runbooks.

## 10. Runbook créé ou mis à jour

- `docs/core/MVP_CORE_ACCEPTANCE_RUNBOOK.md` mis à jour pour documenter officiellement `DELETE /courses/:courseId/sources/:documentId` comme vérification optionnelle locale/dev, avec rappel que `courseId` et `documentId` viennent du path.

## 11. Limites

- La suppression de source reste une capacité course-level simple : pas de corbeille, pas de restauration, pas de gestion multi-source avancée.
- Le test repository verrouille le non-delete hors cours, mais ne transforme pas la suppression en transaction applicative plus large que l'existant.
- Aucun endpoint nouveau n'a été ajouté dans ce lot.

## 12. Risques restants

- La suppression supprime les notions liées au document côté repository documents ; c'est cohérent avec le comportement actuel, mais une stratégie de récupération serait MVP+.
- Les rapports CORE précédents contiennent des mentions documentaires de `CourseSource`, ce qui est normal tant qu'elles restent hors `src`/`test`.

## 13. Auto-review

- `POST /courses/:courseId/revision-sessions/quick` a un test `401` : oui, déjà présent.
- `DELETE /courses/:courseId/sources/:documentId` est documenté : oui.
- Delete source a un contrat backend testé : oui, controller/use case/e2e existants + repository renforcé.
- Aucun nouvel endpoint inutile : oui.
- Aucun deep/exam : oui.
- Aucun résultat session final : oui.
- Aucun `CourseSource` : oui côté code.
- Aucune fixture production : oui.
- `git diff --check` relancé après rapport : oui.
- Pas de commit pendant CORE-06C : oui.

## 14. Points discutables du prompt

- CORE-06C est très petit, mais utile pour faire coïncider code, tests et documentation après les commits CORE-06B/source-delete.
- Le prompt demande de vérifier beaucoup de choses déjà couvertes ; j'ai évité de dupliquer les tests existants et ajouté seulement le garde-fou repository manquant.
- La suppression source est une capacité produit pratique, mais elle méritera plus tard une UX de récupération si des utilisateurs suppriment par erreur.

## 15. Fichiers créés/modifiés/supprimés

Créés :
- `docs/core/CORE_06C_BACKEND_ALIGNMENT_AND_SOURCE_DELETE_HARDENING_REPORT.md`

Modifiés :
- `src/modules/documents/infrastructure/prisma-documents.repository.spec.ts`
- `docs/core/MVP_CORE_ACCEPTANCE_RUNBOOK.md`
- `docs/core/CORE_06B_PROGRESS_REFRESH_AND_ACCEPTANCE_HARDENING_REPORT.md`

Supprimés : aucun.

## 16. Contenu complet des fichiers créés/modifiés/supprimés

Le rapport courant ne s'inclut pas lui-même pour éviter une récursion infinie.

### src/modules/documents/infrastructure/prisma-documents.repository.spec.ts

````````ts
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

  it('deletes a course document only when it belongs to the requested course', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(
      record({ courseId: 'course-1' }),
    );
    prisma.knowledgeUnit.deleteMany.mockResolvedValue({ count: 2 });
    prisma.document.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      repository.deleteCourseDocumentForStudent({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-1',
      }),
    ).resolves.toBe(true);

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'document-1',
        studentId: 'student-1',
        courseId: 'course-1',
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
        courseId: 'course-1',
      },
    });
  });

  it('does not delete a course document when the document is outside the requested course', async () => {
    const { prisma, repository } = createRepository();
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(
      repository.deleteCourseDocumentForStudent({
        studentId: 'student-1',
        courseId: 'course-1',
        documentId: 'document-2',
      }),
    ).resolves.toBe(false);

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'document-2',
        studentId: 'student-1',
        courseId: 'course-1',
      },
      select: {
        id: true,
        subjectId: true,
      },
    });
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

````````

### docs/core/MVP_CORE_ACCEPTANCE_RUNBOOK.md

````````md
# MVP Core acceptance runbook

Ce runbook vérifie le parcours MVP Core réel côté backend, sans mode démo durable et sans `CourseSource`.

## Périmètre

Le parcours attendu est :

1. Utilisateur authentifié.
2. Matières réelles accessibles.
3. Création d'un cours réel.
4. Ouverture du détail du cours.
5. Upload d'une source PDF via le cours.
6. Traitement documentaire jusqu'au statut `READY`.
7. Fiche de cours course-level.
8. Révision rapide course-level.
9. Réponse au QCM.
10. Progression réelle course/subject.
11. Suppression optionnelle d'une source attachée au cours, en local/dev uniquement.

## Endpoints critiques

- `GET /subjects`
- `GET /subjects/:subjectId/courses`
- `POST /subjects/:subjectId/courses`
- `GET /courses/:courseId`
- `POST /courses/:courseId/source/course-pdf`
- `DELETE /courses/:courseId/sources/:documentId`
- `GET /courses/:courseId/revision-sheet`
- `POST /courses/:courseId/revision-sheet`
- `POST /courses/:courseId/revision-sessions/quick`
- `GET /courses/:courseId/progress`
- `GET /subjects/:subjectId/progress`

## Vérifications API

```bash
npx prisma validate
npx prisma generate
npm run build
npm run lint:check
npm test -- modules/courses --runInBand
npm test -- revision-sessions --runInBand
npm test -- --runInBand
npm run test:e2e -- --runInBand
git diff --check
```

## Smoke manuel local

1. Démarrer l'API en environnement local/dev.
2. S'authentifier avec un utilisateur de test.
3. Créer une matière réelle si nécessaire.
4. Créer un cours sous cette matière.
5. Uploader un PDF avec `POST /courses/:courseId/source/course-pdf`.
6. Vérifier que le document passe de `UPLOADED`/`PROCESSING` à `READY`.
7. Appeler `GET /courses/:courseId/progress` et vérifier un état cohérent.
8. Vérifier optionnellement la suppression de source avec `DELETE /courses/:courseId/sources/:documentId` sur un document de test, puis confirmer que le cours et la progression se recalculent sans fuite cross-student.
9. Appeler `POST /courses/:courseId/revision-sessions/quick` quand une source `READY` existe.
10. Soumettre l'activité générée par la session.
11. Recharger `GET /courses/:courseId/progress` et `GET /subjects/:subjectId/progress`.

## Hors MVP Core

- Révision approfondie.
- Préparation examen.
- Résultat final dédié de session.
- Gamification durable.
- Multi-source avancé.
- Table ou modèle `CourseSource`.
- SSE/WebSocket de processing.

## Garde-fous

- Le client ne fournit pas `studentId`.
- L'upload sous cours dérive `subjectId` depuis le cours.
- La révision rapide choisit la source et la notion côté backend.
- La suppression de source prend `courseId` et `documentId` depuis le path, jamais depuis un body client.
- Les endpoints protégés doivent répondre `401` sans bearer token.
- Les documents sans `courseId` ne polluent pas la progression course-level.

````````

### docs/core/CORE_06B_PROGRESS_REFRESH_AND_ACCEPTANCE_HARDENING_REPORT.md

````````md
# CORE-06B — Progress refresh coherence + MVP Core acceptance hardening

## 1. Résumé

CORE-06B côté backend consolide le MVP Core sans ajouter d'endpoint : le contrat d'authentification de `POST /courses/:courseId/revision-sessions/quick` est maintenant verrouillé dans les critical paths e2e. Un runbook MVP Core backend a aussi été ajouté pour vérifier le parcours réel de bout en bout.

## 2. Audit initial

- Les endpoints course/progress/quick existaient déjà.
- `POST /courses/:courseId/revision-sessions/quick` avait des tests happy path, rejet des ids client et readiness `409`, mais pas d'assertion `401` explicite dans le bloc protected routes.
- Les endpoints progression `GET /courses/:courseId/progress` et `GET /subjects/:subjectId/progress` étaient déjà couverts dans le happy path e2e.
- Aucun besoin de modifier controller/use case/repository backend.
- `CourseSource` n'existe pas dans `src` ni `test`; les occurrences restantes sont documentaires.

## 3. Sub-agents/passes utilisées

- Audit Agent : inspection read-only backend/frontend, confirmation des écarts d'invalidation et du manque `401`.
- Backend Contract Agent : inspection read-only du backend, confirmation qu'aucun endpoint nouveau n'a été ajouté et que le 401 quick est bien dans `critical-paths.e2e-spec.ts`.
- QA Agent : validations locales exécutées par Codex dans ce thread.
- Reviewer Agent : review manuelle finale incluse en section 13.

## 4. Modifications backend

- Ajout d'une assertion e2e `401` pour `POST /courses/:courseId/revision-sessions/quick` dans le bloc des routes protégées.
- Ajout du runbook `docs/core/MVP_CORE_ACCEPTANCE_RUNBOOK.md`.
- Aucun controller, use case, repository, Prisma, migration, prompt IA ou Genkit modifié.

## 5. Modifications frontend

Non applicable dans ce repo. Les modifications frontend sont documentées dans le rapport app.

## 6. Tests ajoutés

- `test/critical-paths.e2e-spec.ts` : route quick course-level protégée sans bearer token.

## 7. Commandes exécutées

- `npx prisma validate` : OK, schema valide.
- `npx prisma generate` : OK, Prisma Client généré.
- `npm run build` : OK.
- `npm run lint:check` : OK.
- `npm test -- modules/courses --runInBand` : OK, 9 suites, 76 tests.
- `npm test -- revision-sessions --runInBand` : OK, 6 suites, 44 tests.
- `npm test -- --runInBand` : OK, 78 suites passées, 1 skipped, 684 tests passés, 1 skipped.
- Première commande chaînée incluant `npm run test:e2e -- --runInBand` : échec transitoire e2e sur deux assertions historiques non liées au lot après la suite Jest complète.
- `npm run test:e2e -- --runInBand` relancé isolément : OK, 2 suites, 33 tests.
- `git diff --check` : OK, relancé après génération du rapport final.

## 8. Preuve anti-fixtures

Non applicable côté backend pour les valeurs Flutter. Aucun changement backend ne réintroduit de fixture MVP.

## 9. Preuve anti-CourseSource

Commande : `rg -n "CourseSource" src test docs/core || true`.

Résultat : aucune occurrence dans `src` ou `test`; occurrences documentaires uniquement dans `docs/core`, incluant ce runbook et anciens rapports.

## 10. Runbook créé

- `docs/core/MVP_CORE_ACCEPTANCE_RUNBOOK.md` : endpoints critiques, smoke local, hors MVP Core, garde-fous.

## 11. Limites

- Pas de nouveau smoke applicatif réel avec auth externe : les tests gardent les mocks existants.
- Le runbook reste local/dev et ne décrit pas un déploiement production.

## 12. Risques restants

- L'échec transitoire observé lorsque `npm run test:e2e` est chaîné juste après la suite Jest complète mérite une surveillance, même si le rerun e2e isolé est vert.
- Le résultat final de session reste hors périmètre.

## 13. Auto-review

- Upload PDF invalide bien la progression : traité côté app.
- Polling source pending invalide aussi la progression : traité côté app.
- Backend quick route a un test `401` : oui.
- Aucun nouvel endpoint : oui.
- Aucun deep/exam : oui.
- Aucun résultat session final : oui.
- Aucun `CourseSource` : oui côté code.
- Aucune fixture production : oui.
- Aucun commit n'a été réalisé pendant l'exécution initiale du lot 06B. Le rapport est désormais présent dans le commit `3376c5b`, réalisé après autorisation explicite de commit.

## 14. Points discutables du prompt

- CORE-06B est petit, mais il corrige une incohérence visible de produit : le lot dédié est raisonnable.
- Le runbook pourrait vivre dans un seul repo, mais le double emplacement rend les vérifications backend/app plus proches de leur contexte.
- Le polling devrait probablement évoluer vers SSE/WebSocket plus tard, mais le MVP Core reste cohérent avec un polling borné.

## 15. Fichiers créés/modifiés/supprimés

Créés :
- `docs/core/MVP_CORE_ACCEPTANCE_RUNBOOK.md`
- `docs/core/CORE_06B_PROGRESS_REFRESH_AND_ACCEPTANCE_HARDENING_REPORT.md`

Modifiés :
- `test/critical-paths.e2e-spec.ts`

Supprimés : aucun.

## 16. Contenu complet des fichiers créés/modifiés/supprimés

Le rapport courant n'inclut pas son propre contenu pour éviter une récursion infinie.

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
import { DeleteCourseDocumentUseCase } from '../src/modules/courses/application/delete-course-document.use-case';
import { DeleteCourseUseCase } from '../src/modules/courses/application/delete-course.use-case';
import {
  CourseRevisionSheetSourceNotReadyError,
  GenerateCourseRevisionSheetUseCase,
  GetCourseRevisionSheetUseCase,
} from '../src/modules/courses/application/course-revision-sheet.use-case';
import {
  GetCourseProgressUseCase,
  GetSubjectProgressUseCase,
} from '../src/modules/courses/application/course-progress.use-case';
import { GetCourseDetailUseCase } from '../src/modules/courses/application/get-course-detail.use-case';
import { ListSubjectCoursesWithStatsUseCase } from '../src/modules/courses/application/list-subject-courses-with-stats.use-case';
import { UploadCoursePdfForCourseUseCase } from '../src/modules/courses/application/upload-course-pdf-for-course.use-case';
import {
  CourseQuickRevisionKnowledgeUnitNotReadyError,
  CourseQuickRevisionSourceNotReadyError,
  StartCourseQuickRevisionSessionUseCase,
} from '../src/modules/courses/application/start-course-quick-revision-session.use-case';
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
      await request(server).get('/courses/course-1/progress').expect(401);
      await request(server).get('/subjects/subject-1/progress').expect(401);
      await request(server).delete('/courses/course-1').expect(401);
      await request(server)
        .delete('/courses/course-1/sources/document-1')
        .expect(401);
      await request(server).get('/courses/course-1/revision-sheet').expect(401);
      await request(server)
        .post('/courses/course-1/revision-sheet')
        .expect(401);
      await request(server)
        .post('/courses/course-1/revision-sessions/quick')
        .send({})
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

      const courseProgressResponse = await request(server)
        .get('/courses/course-1/progress')
        .expect(200);

      expect(mocks.getCourseProgress.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        courseId: 'course-1',
      });
      expect(courseProgressResponse.body).toMatchObject({
        courseId: 'course-1',
        subjectId: 'subject-1',
        knowledgeUnitCount: 12,
        practicedKnowledgeUnitCount: 3,
        coverage: 0.25,
        mastery: 0.72,
        estimatedGlobalMastery: 0.18,
        readySourceCount: 1,
        processingSourceCount: 0,
        failedSourceCount: 0,
        state: 'PRACTICED',
      });
      assertNoSensitivePreSubmitFields(courseProgressResponse.body);
      expect(JSON.stringify(courseProgressResponse.body)).not.toContain(
        'storagePath',
      );
      expect(JSON.stringify(courseProgressResponse.body)).not.toContain(
        'correctChoiceId',
      );

      const subjectProgressResponse = await request(server)
        .get('/subjects/subject-1/progress')
        .expect(200);

      expect(mocks.getSubjectProgress.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        subjectId: 'subject-1',
      });
      expect(subjectProgressResponse.body).toMatchObject({
        subjectId: 'subject-1',
        knowledgeUnitCount: 12,
        practicedKnowledgeUnitCount: 3,
        coverage: 0.25,
        mastery: 0.72,
        estimatedGlobalMastery: 0.18,
        courseCount: 1,
        readyCourseCount: 1,
        courses: [
          {
            courseId: 'course-1',
            title: 'Droit constitutionnel',
            state: 'PRACTICED',
          },
        ],
      });
      assertNoSensitivePreSubmitFields(subjectProgressResponse.body);
      expect(JSON.stringify(subjectProgressResponse.body)).not.toContain(
        'storagePath',
      );

      await request(server).delete('/courses/course-1').expect(204);

      expect(mocks.deleteCourse.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        courseId: 'course-1',
      });

      await request(server)
        .delete('/courses/course-1/sources/document-1')
        .expect(204);

      expect(mocks.deleteCourseDocument.execute).toHaveBeenCalledWith({
        studentId: currentStudent.id,
        courseId: 'course-1',
        documentId: 'document-1',
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

      mocks.getCourseProgress.execute.mockRejectedValueOnce(
        new Error('Course not found'),
      );
      await request(server)
        .get('/courses/other-student-course/progress')
        .expect(404);

      mocks.getSubjectProgress.execute.mockRejectedValueOnce(
        new Error('Course subject not found'),
      );
      await request(server)
        .get('/subjects/other-student-subject/progress')
        .expect(404);

      mocks.deleteCourse.execute.mockRejectedValueOnce(
        new CourseContainsDocumentsError(),
      );
      await request(server)
        .delete('/courses/course-with-documents')
        .expect(409);

      mocks.deleteCourseDocument.execute.mockRejectedValueOnce(
        new NotFoundException('Course source not found'),
      );
      await request(server)
        .delete('/courses/course-1/sources/other-document')
        .expect(404);
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

    it('starts a course-level quick revision session without client-owned ids', async () => {
      const response = await request(app.getHttpServer())
        .post('/courses/course-1/revision-sessions/quick')
        .send({})
        .expect(201);

      expect(
        mocks.startCourseQuickRevisionSession.execute.mock.calls,
      ).toMatchObject([
        [
          {
            studentId: currentStudent.id,
            courseId: 'course-1',
          },
        ],
      ]);
      const responseBody = response.body as {
        session?: Record<string, unknown>;
        currentAction?: Record<string, unknown>;
      };
      expect(responseBody.session).toMatchObject({
        id: 'revision-session-1',
        courseId: 'course-1',
        mode: 'QUICK',
      });
      expect(responseBody.currentAction).toMatchObject({
        kind: 'DIAGNOSTIC_QUIZ',
      });
      expect(JSON.stringify(responseBody)).not.toContain('correctChoiceId');
      expect(JSON.stringify(responseBody)).not.toContain('correctAnswers');
      expect(JSON.stringify(responseBody)).not.toContain('score');
      expect(
        JSON.stringify(
          mocks.startCourseQuickRevisionSession.execute.mock.calls,
        ),
      ).not.toContain('client-picked-document');
    });

    it('rejects client-owned quick revision ids and maps readiness errors', async () => {
      await request(app.getHttpServer())
        .post('/courses/course-1/revision-sessions/quick')
        .send({
          subjectId: 'client-subject',
          documentId: 'client-picked-document',
          knowledgeUnitId: 'client-unit',
        })
        .expect(400);

      mocks.startCourseQuickRevisionSession.execute.mockRejectedValueOnce(
        new CourseQuickRevisionSourceNotReadyError(),
      );

      await request(app.getHttpServer())
        .post('/courses/course-without-ready-source/revision-sessions/quick')
        .send({})
        .expect(409);

      mocks.startCourseQuickRevisionSession.execute.mockRejectedValueOnce(
        new CourseQuickRevisionKnowledgeUnitNotReadyError(),
      );

      await request(app.getHttpServer())
        .post('/courses/course-without-ready-unit/revision-sessions/quick')
        .send({})
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
    .overrideProvider(GetCourseProgressUseCase)
    .useValue(mocks.getCourseProgress)
    .overrideProvider(GetSubjectProgressUseCase)
    .useValue(mocks.getSubjectProgress)
    .overrideProvider(DeleteCourseUseCase)
    .useValue(mocks.deleteCourse)
    .overrideProvider(DeleteCourseDocumentUseCase)
    .useValue(mocks.deleteCourseDocument)
    .overrideProvider(UploadCoursePdfForCourseUseCase)
    .useValue(mocks.uploadCoursePdfForCourse)
    .overrideProvider(GetCourseRevisionSheetUseCase)
    .useValue(mocks.getCourseRevisionSheet)
    .overrideProvider(GenerateCourseRevisionSheetUseCase)
    .useValue(mocks.generateCourseRevisionSheet)
    .overrideProvider(StartCourseQuickRevisionSessionUseCase)
    .useValue(mocks.startCourseQuickRevisionSession)
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
    getCourseProgress: {
      execute: jest.fn().mockResolvedValue(courseProgress()),
    },
    getSubjectProgress: {
      execute: jest.fn().mockResolvedValue(subjectProgress()),
    },
    deleteCourse: {
      execute: jest.fn().mockResolvedValue({ deleted: true }),
    },
    deleteCourseDocument: {
      execute: jest.fn().mockResolvedValue(undefined),
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
    startCourseQuickRevisionSession: {
      execute: jest
        .fn()
        .mockResolvedValue(courseQuickRevisionSessionResponse()),
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

function courseProgress(overrides: Record<string, unknown> = {}) {
  return {
    courseId: 'course-1',
    subjectId: 'subject-1',
    knowledgeUnitCount: 12,
    practicedKnowledgeUnitCount: 3,
    coverage: 0.25,
    mastery: 0.72,
    estimatedGlobalMastery: 0.18,
    readySourceCount: 1,
    processingSourceCount: 0,
    failedSourceCount: 0,
    lastPracticedAt: new Date('2026-06-18T12:00:00.000Z'),
    state: 'PRACTICED',
    ...overrides,
  };
}

function subjectProgress() {
  return {
    subjectId: 'subject-1',
    knowledgeUnitCount: 12,
    practicedKnowledgeUnitCount: 3,
    coverage: 0.25,
    mastery: 0.72,
    estimatedGlobalMastery: 0.18,
    courseCount: 1,
    readyCourseCount: 1,
    lastPracticedAt: new Date('2026-06-18T12:00:00.000Z'),
    courses: [
      {
        courseId: 'course-1',
        title: 'Droit constitutionnel',
        knowledgeUnitCount: 12,
        practicedKnowledgeUnitCount: 3,
        coverage: 0.25,
        mastery: 0.72,
        estimatedGlobalMastery: 0.18,
        state: 'PRACTICED',
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
      courseId: null,
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      mode: 'QUICK',
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

function courseQuickRevisionSessionResponse() {
  return {
    session: {
      id: 'revision-session-1',
      status: 'STARTED',
      subjectId: 'subject-1',
      courseId: 'course-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      mode: 'QUICK',
      createdAt: new Date('2026-06-15T12:00:00.000Z'),
      completedAt: null,
    },
    currentAction: {
      id: 'action-1',
      kind: 'DIAGNOSTIC_QUIZ',
      status: 'READY',
      displayOrder: 0,
      activitySessionId: 'quiz-session-1',
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      payload: diagnosticQuizActivity(),
    },
    history: [
      {
        id: 'action-1',
        kind: 'DIAGNOSTIC_QUIZ',
        status: 'READY',
        displayOrder: 0,
        activitySessionId: 'quiz-session-1',
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
      courseId: null,
      documentId: 'document-1',
      knowledgeUnitId: 'unit-1',
      mode: 'QUICK',
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
### docs/core/MVP_CORE_ACCEPTANCE_RUNBOOK.md

```md
# MVP Core acceptance runbook

Ce runbook vérifie le parcours MVP Core réel côté backend, sans mode démo durable et sans `CourseSource`.

## Périmètre

Le parcours attendu est :

1. Utilisateur authentifié.
2. Matières réelles accessibles.
3. Création d'un cours réel.
4. Ouverture du détail du cours.
5. Upload d'une source PDF via le cours.
6. Traitement documentaire jusqu'au statut `READY`.
7. Fiche de cours course-level.
8. Révision rapide course-level.
9. Réponse au QCM.
10. Progression réelle course/subject.

## Endpoints critiques

- `GET /subjects`
- `GET /subjects/:subjectId/courses`
- `POST /subjects/:subjectId/courses`
- `GET /courses/:courseId`
- `POST /courses/:courseId/source/course-pdf`
- `DELETE /courses/:courseId/sources/:documentId`
- `GET /courses/:courseId/revision-sheet`
- `POST /courses/:courseId/revision-sheet`
- `POST /courses/:courseId/revision-sessions/quick`
- `GET /courses/:courseId/progress`
- `GET /subjects/:subjectId/progress`

## Vérifications API

```bash
npx prisma validate
npx prisma generate
npm run build
npm run lint:check
npm test -- modules/courses --runInBand
npm test -- revision-sessions --runInBand
npm test -- --runInBand
npm run test:e2e -- --runInBand
git diff --check
```

## Smoke manuel local

1. Démarrer l'API en environnement local/dev.
2. S'authentifier avec un utilisateur de test.
3. Créer une matière réelle si nécessaire.
4. Créer un cours sous cette matière.
5. Uploader un PDF avec `POST /courses/:courseId/source/course-pdf`.
6. Vérifier que le document passe de `UPLOADED`/`PROCESSING` à `READY`.
7. Appeler `GET /courses/:courseId/progress` et vérifier un état cohérent.
8. Appeler `POST /courses/:courseId/revision-sessions/quick` quand une source `READY` existe.
9. Soumettre l'activité générée par la session.
10. Recharger `GET /courses/:courseId/progress` et `GET /subjects/:subjectId/progress`.

## Hors MVP Core

- Révision approfondie.
- Préparation examen.
- Résultat final dédié de session.
- Gamification durable.
- Multi-source avancé.
- Table ou modèle `CourseSource`.
- SSE/WebSocket de processing.

## Garde-fous

- Le client ne fournit pas `studentId`.
- L'upload sous cours dérive `subjectId` depuis le cours.
- La révision rapide choisit la source et la notion côté backend.
- Les endpoints protégés doivent répondre `401` sans bearer token.
- Les documents sans `courseId` ne polluent pas la progression course-level.

```

````````
