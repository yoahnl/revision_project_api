import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedStudent } from '../../auth/interfaces/authenticated-student';
import { CurrentStudent } from '../../auth/interfaces/current-student.decorator';
import { FirebaseAuthGuard } from '../../auth/interfaces/firebase-auth.guard';
import { GetDocumentUseCase } from '../application/get-document.use-case';
import { ListSubjectDocumentsUseCase } from '../application/list-subject-documents.use-case';
import { RegisterDocumentUseCase } from '../application/register-document.use-case';
import { DOCUMENT_KINDS, type DocumentKind } from '../domain/document.entity';

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

@Controller()
@UseGuards(FirebaseAuthGuard)
export class DocumentsController {
  constructor(
    private readonly registerDocument: RegisterDocumentUseCase,
    private readonly listSubjectDocuments: ListSubjectDocumentsUseCase,
    private readonly getDocument: GetDocumentUseCase,
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
      .catch((error: unknown) => {
        normalizeDocumentRegistrationError(error);
      });
  }

  @Get('documents/:documentId')
  get(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('documentId') documentId: string,
  ) {
    return this.getDocument.execute({
      studentId: student.id,
      documentId,
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
      error.message === 'PDF documents must use application/pdf' ||
      error.message === 'Exam images must use an image mime type' ||
      error.message ===
        'Exam images must use image/jpeg, image/png, or image/webp')
  ) {
    throw new BadRequestException(error.message);
  }

  throw error;
}
