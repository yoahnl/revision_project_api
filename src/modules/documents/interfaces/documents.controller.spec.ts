import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DeleteDocumentUseCase } from '../application/delete-document.use-case';
import { GetDocumentUseCase } from '../application/get-document.use-case';
import { ListDocumentKnowledgeUnitsUseCase } from '../application/list-document-knowledge-units.use-case';
import { ListSubjectDocumentsUseCase } from '../application/list-subject-documents.use-case';
import { RegisterDocumentUseCase } from '../application/register-document.use-case';
import {
  ArchiveDocumentUseCase,
  GetDocumentSourceLifecycleUseCase,
} from '../application/source-lifecycle.use-case';
import { UploadCoursePdfUseCase } from '../application/upload-course-pdf.use-case';
import { SourceDeleteBlockedError } from '../domain/source-lifecycle.entity';
import { DocumentsController } from './documents.controller';

describe('DocumentsController', () => {
  const student = {
    id: 'student-1',
    firebaseUid: 'firebase-1',
    email: 'student@example.com',
    displayName: 'Student One',
  };

  function createController() {
    const execute = jest.fn().mockResolvedValue({
      id: 'document-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: 'cours.pdf',
      storagePath: 'students/firebase-1/subjects/subject-1/cours.pdf',
      mimeType: 'application/pdf',
      status: 'UPLOADED',
      errorCode: null,
    });

    const registerDocument = {
      execute,
    } as unknown as RegisterDocumentUseCase;

    const executeList = jest.fn().mockResolvedValue([
      {
        id: 'document-1',
        studentId: 'student-1',
        subjectId: 'subject-1',
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/firebase-1/subjects/subject-1/cours.pdf',
        mimeType: 'application/pdf',
        status: 'UPLOADED',
        errorCode: null,
      },
    ]);

    const listSubjectDocuments = {
      execute: executeList,
    } as unknown as ListSubjectDocumentsUseCase;

    const executeGet = jest.fn().mockResolvedValue({
      id: 'document-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: 'cours.pdf',
      mimeType: 'application/pdf',
      status: 'UPLOADED',
      errorCode: null,
    });

    const getDocument = {
      execute: executeGet,
    } as unknown as GetDocumentUseCase;

    const executeKnowledgeUnits = jest.fn().mockResolvedValue({
      documentId: 'document-1',
      items: [
        {
          id: 'unit-1',
          title: 'Séparation des pouvoirs',
          summary: 'Résumé court.',
          difficulty: 'MEDIUM',
          displayOrder: 1,
          confidence: 0.84,
          sources: [
            {
              chunkId: 'chunk-1',
              text: 'Extrait source issu du chunk.',
              pageNumber: null,
              index: 0,
            },
          ],
        },
      ],
    });

    const listDocumentKnowledgeUnits = {
      execute: executeKnowledgeUnits,
    } as unknown as ListDocumentKnowledgeUnitsUseCase;

    const executeUpload = jest.fn().mockResolvedValue({
      id: 'document-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: '1710000000000-cours.pdf',
      storagePath:
        'students/firebase-1/subjects/subject-1/1710000000000-cours.pdf',
      mimeType: 'application/pdf',
      status: 'UPLOADED',
      errorCode: null,
    });

    const uploadCoursePdf = {
      execute: executeUpload,
    } as unknown as UploadCoursePdfUseCase;

    const executeDelete = jest.fn().mockResolvedValue(undefined);

    const deleteDocument = {
      execute: executeDelete,
    } as unknown as DeleteDocumentUseCase;

    const executeLifecycle = jest
      .fn()
      .mockResolvedValue(sourceLifecycleDecision());

    const getDocumentSourceLifecycle = {
      execute: executeLifecycle,
    } as unknown as GetDocumentSourceLifecycleUseCase;

    const executeArchive = jest.fn().mockResolvedValue(
      sourceLifecycleDecision({
        status: 'ARCHIVED',
        recommendedAction: 'BLOCK',
        canArchive: false,
      }),
    );

    const archiveDocument = {
      execute: executeArchive,
    } as unknown as ArchiveDocumentUseCase;

    return {
      controller: new DocumentsController(
        registerDocument,
        listSubjectDocuments,
        getDocument,
        listDocumentKnowledgeUnits,
        uploadCoursePdf,
        deleteDocument,
        getDocumentSourceLifecycle,
        archiveDocument,
      ),
      execute,
      executeList,
      executeGet,
      executeKnowledgeUnits,
      executeUpload,
      executeDelete,
      executeLifecycle,
      executeArchive,
    };
  }

  it('registers documents for the current student and ignores body studentId', async () => {
    const { controller, execute } = createController();

    await controller.register(student, {
      studentId: 'attacker-student',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: ' cours.pdf ',
      storagePath: ' students/firebase-1/subjects/subject-1/cours.pdf ',
      mimeType: ' application/pdf ',
    } as never);

    expect(execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: 'cours.pdf',
      storagePath: 'students/firebase-1/subjects/subject-1/cours.pdf',
      mimeType: 'application/pdf',
    });
  });

  it('rejects invalid document payloads with 400', () => {
    const invalidBodies = [
      {
        subjectId: '',
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/firebase-1/subjects/subject-1/cours.pdf',
        mimeType: 'application/pdf',
      },
      {
        subjectId: 'subject-1',
        kind: 'VIDEO',
        fileName: 'cours.pdf',
        storagePath: 'students/firebase-1/subjects/subject-1/cours.pdf',
        mimeType: 'application/pdf',
      },
      {
        subjectId: 'subject-1',
        kind: 'COURSE_PDF',
        fileName: '',
        storagePath: 'students/firebase-1/subjects/subject-1/cours.pdf',
        mimeType: 'application/pdf',
      },
      {
        subjectId: 'subject-1',
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/other-firebase/subjects/subject-1/cours.pdf',
        mimeType: 'application/pdf',
      },
      {
        subjectId: 'subject-1',
        kind: 'EXAM_IMAGE',
        fileName: 'copie.png',
        storagePath: 'students/firebase-1/subjects/subject-1/copie.png',
        mimeType: 'application/pdf',
      },
    ];

    for (const body of invalidBodies) {
      const { controller } = createController();

      expect(() => controller.register(student, body as never)).toThrow(
        BadRequestException,
      );
    }
  });

  it('maps subject ownership failures to 400', async () => {
    const { controller, execute } = createController();
    execute.mockRejectedValue(new Error('Subject does not belong to student'));

    await expect(
      controller.register(student, {
        subjectId: 'subject-2',
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/firebase-1/subjects/subject-2/cours.pdf',
        mimeType: 'application/pdf',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts canonical image document metadata', async () => {
    const { controller, execute } = createController();

    await controller.register(student, {
      subjectId: 'subject-1',
      kind: 'EXAM_IMAGE',
      fileName: 'copie.png',
      storagePath: 'students/firebase-1/subjects/subject-1/copie.png',
      mimeType: 'image/png',
    });

    expect(execute).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'EXAM_IMAGE',
      fileName: 'copie.png',
      storagePath: 'students/firebase-1/subjects/subject-1/copie.png',
      mimeType: 'image/png',
    });
  });

  it('lists documents for a subject owned by the current student', async () => {
    const { controller, executeList } = createController();

    await controller.listForSubject(student, 'subject-1');

    expect(executeList).toHaveBeenCalledWith({
      studentId: 'student-1',
      subjectId: 'subject-1',
    });
  });

  it('maps subject ownership failures while listing documents to 400', async () => {
    const { controller, executeList } = createController();
    executeList.mockRejectedValue(
      new Error('Subject does not belong to student'),
    );

    await expect(
      controller.listForSubject(student, 'subject-2'),
    ).rejects.toThrow(BadRequestException);
  });

  it('gets a document owned by the current student', async () => {
    const { controller, executeGet } = createController();

    const document = await controller.get(student, 'document-1');

    expect(executeGet).toHaveBeenCalledWith({
      studentId: 'student-1',
      documentId: 'document-1',
    });
    expect(document).toEqual({
      id: 'document-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: 'cours.pdf',
      mimeType: 'application/pdf',
      status: 'UPLOADED',
      errorCode: null,
    });
    expect(JSON.stringify(document)).not.toContain('storagePath');
  });

  it('lists sourced knowledge units for a document owned by the current student', async () => {
    const { controller, executeKnowledgeUnits } = createController();

    const response = await controller.listKnowledgeUnits(student, 'document-1');

    expect(executeKnowledgeUnits).toHaveBeenCalledWith({
      studentId: 'student-1',
      documentId: 'document-1',
    });
    expect(response).toEqual({
      documentId: 'document-1',
      items: [
        {
          id: 'unit-1',
          title: 'Séparation des pouvoirs',
          summary: 'Résumé court.',
          difficulty: 'MEDIUM',
          displayOrder: 1,
          confidence: 0.84,
          sources: [
            {
              chunkId: 'chunk-1',
              text: 'Extrait source issu du chunk.',
              pageNumber: null,
              index: 0,
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(response)).not.toContain('storagePath');
  });

  it('rejects empty document ids while reading knowledge units', () => {
    const { controller } = createController();

    expect(() => controller.listKnowledgeUnits(student, '  ')).toThrow(
      BadRequestException,
    );
  });

  it('deletes a document owned by the current student', async () => {
    const { controller, executeDelete } = createController();

    await controller.delete(student, ' document-1 ');

    expect(executeDelete).toHaveBeenCalledWith({
      studentId: 'student-1',
      documentId: 'document-1',
    });
  });

  it('maps lifecycle delete conflicts to 409', async () => {
    const { controller, executeDelete } = createController();
    executeDelete.mockRejectedValue(
      new SourceDeleteBlockedError(sourceLifecycleDecision()),
    );

    await expect(controller.delete(student, 'document-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('loads lifecycle decisions for a document owned by the student', async () => {
    const { controller, executeLifecycle } = createController();

    await expect(
      controller.getLifecycle(student, ' document-1 '),
    ).resolves.toMatchObject({
      documentId: 'document-1',
      recommendedAction: 'ARCHIVE',
    });

    expect(executeLifecycle).toHaveBeenCalledWith({
      studentId: 'student-1',
      documentId: 'document-1',
    });
  });

  it('archives a document owned by the student', async () => {
    const { controller, executeArchive } = createController();

    await expect(
      controller.archive(student, ' document-1 '),
    ).resolves.toMatchObject({
      documentId: 'document-1',
      status: 'ARCHIVED',
      recommendedAction: 'BLOCK',
    });

    expect(executeArchive).toHaveBeenCalledWith({
      studentId: 'student-1',
      documentId: 'document-1',
    });
  });

  it('maps missing lifecycle documents to 404', async () => {
    const { controller, executeLifecycle } = createController();
    executeLifecycle.mockRejectedValue(
      new NotFoundException('Document not found'),
    );

    await expect(
      controller.getLifecycle(student, 'missing-document'),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects empty document ids while deleting', () => {
    const { controller } = createController();

    expect(() => controller.delete(student, '  ')).toThrow(BadRequestException);
  });

  it('uploads course PDFs for the current student', async () => {
    const { controller, executeUpload } = createController();

    await controller.uploadCoursePdf(
      student,
      { subjectId: ' subject-1 ' },
      {
        originalname: ' Cours 2024-2025.pdf ',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.7'),
        size: 8,
      },
    );

    expect(executeUpload).toHaveBeenCalledWith({
      studentId: 'student-1',
      firebaseUid: 'firebase-1',
      subjectId: 'subject-1',
      originalFileName: 'Cours 2024-2025.pdf',
      content: Buffer.from('%PDF-1.7'),
      mimeType: 'application/pdf',
    });
  });

  it('rejects missing or non-PDF course uploads with 400', () => {
    const { controller } = createController();

    expect(() =>
      controller.uploadCoursePdf(
        student,
        { subjectId: 'subject-1' },
        undefined,
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      controller.uploadCoursePdf(
        student,
        { subjectId: 'subject-1' },
        {
          originalname: 'cours.png',
          mimetype: 'image/png',
          buffer: Buffer.from('png'),
          size: 3,
        },
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      controller.uploadCoursePdf(
        student,
        { subjectId: 'subject-1' },
        {
          originalname: 'cours.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.alloc(0),
          size: 0,
        },
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects malformed storage paths with 400', () => {
    const invalidStoragePaths = [
      'students/firebase-1/subjects/subject-1/../cours.pdf',
      'students/firebase-1//subjects/subject-1/cours.pdf',
      'students/firebase-1/subjects/subject-2/cours.pdf',
      'students/firebase-1/subjects/subject-1/nested/cours.pdf',
      'students/firebase-1/subjects/subject-1/cours%2epdf',
      'students/firebase-1/subjects/subject-1/cours%2fpdf',
      'students/firebase-1/subjects/subject-1/not-cours.pdf',
      '/students/firebase-1/subjects/subject-1/cours.pdf',
      'students/student-1/subjects/subject-1/cours.pdf',
    ];

    for (const storagePath of invalidStoragePaths) {
      const { controller } = createController();

      expect(() =>
        controller.register(student, {
          subjectId: 'subject-1',
          kind: 'COURSE_PDF',
          fileName: 'cours.pdf',
          storagePath,
          mimeType: 'application/pdf',
        }),
      ).toThrow(BadRequestException);
    }
  });

  it('rejects overlong document metadata with 400', () => {
    const { controller } = createController();

    expect(() =>
      controller.register(student, {
        subjectId: 'subject-1',
        kind: 'COURSE_PDF',
        fileName: `${'a'.repeat(252)}.pdf`,
        storagePath: `students/firebase-1/subjects/subject-1/${'a'.repeat(
          252,
        )}.pdf`,
        mimeType: 'application/pdf',
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      controller.register(student, {
        subjectId: 'subject-1',
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: `students/firebase-1/subjects/subject-1/${'a'.repeat(
          981,
        )}.pdf`,
        mimeType: 'application/pdf',
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      controller.register(student, {
        subjectId: 'subject-1',
        kind: 'COURSE_PDF',
        fileName: 'cours.pdf',
        storagePath: 'students/firebase-1/subjects/subject-1/cours.pdf',
        mimeType: 'application/'.padEnd(101, 'x'),
      }),
    ).toThrow(BadRequestException);
  });
});

function sourceLifecycleDecision(overrides: Record<string, unknown> = {}) {
  return {
    documentId: 'document-1',
    courseId: null,
    status: 'ACTIVE',
    recommendedAction: 'ARCHIVE',
    canDelete: false,
    canArchive: true,
    blockingReasons: ['HAS_KNOWLEDGE_UNITS'],
    userMessage: 'Cette source peut etre archivee.',
    ...overrides,
  };
}
