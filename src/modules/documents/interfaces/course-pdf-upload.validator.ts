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
