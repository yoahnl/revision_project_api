import { BadRequestException } from '@nestjs/common';
import { GetDocumentUseCase } from '../application/get-document.use-case';
import { ListSubjectDocumentsUseCase } from '../application/list-subject-documents.use-case';
import { RegisterDocumentUseCase } from '../application/register-document.use-case';
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
      },
    ]);

    const listSubjectDocuments = {
      execute: executeList,
    } as unknown as ListSubjectDocumentsUseCase;

    const executeGet = jest.fn().mockResolvedValue({
      id: 'document-1',
      studentId: 'student-1',
      subjectId: 'subject-1',
      kind: 'COURSE_PDF',
      fileName: 'cours.pdf',
      storagePath: 'students/firebase-1/subjects/subject-1/cours.pdf',
      mimeType: 'application/pdf',
      status: 'UPLOADED',
    });

    const getDocument = {
      execute: executeGet,
    } as unknown as GetDocumentUseCase;

    return {
      controller: new DocumentsController(
        registerDocument,
        listSubjectDocuments,
        getDocument,
      ),
      execute,
      executeList,
      executeGet,
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

    await controller.get(student, 'document-1');

    expect(executeGet).toHaveBeenCalledWith({
      studentId: 'student-1',
      documentId: 'document-1',
    });
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
