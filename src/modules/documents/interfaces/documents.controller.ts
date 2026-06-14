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

const MAX_FILE_NAME_LENGTH = 255;
const MAX_STORAGE_PATH_LENGTH = 512;
const MAX_MIME_TYPE_LENGTH = 100;
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
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

type UploadedCoursePdfFile = {
  originalname: string;
  mimetype: string;
  buffer?: Buffer;
  size: number;
};

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

function validateCoursePdfFile(file: UploadedCoursePdfFile | undefined): {
  originalFileName: string;
  content: Buffer;
  mimeType: string;
} {
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
