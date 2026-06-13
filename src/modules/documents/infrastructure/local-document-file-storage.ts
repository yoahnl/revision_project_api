import { Injectable } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import type { DocumentContentReader } from '../application/document-content-reader';
import type {
  DocumentFileStorage,
  StoredDocumentFile,
} from '../application/document-file-storage';

const MAX_FILE_NAME_LENGTH = 255;
const MAX_STORAGE_PATH_LENGTH = 512;

@Injectable()
export class LocalDocumentFileStorage
  implements DocumentFileStorage, DocumentContentReader
{
  async saveCoursePdf(input: {
    firebaseUid: string;
    subjectId: string;
    originalFileName: string;
    content: Buffer;
    mimeType: string;
  }): Promise<StoredDocumentFile> {
    if (input.mimeType !== 'application/pdf') {
      throw new Error('PDF documents must use application/pdf');
    }

    if (input.content.length === 0) {
      throw new Error('Document content is required');
    }

    const storageOwnerId = validateStorageSegment(input.firebaseUid, true);
    const subjectId = validateStorageSegment(input.subjectId, false);
    const fileName = buildStoredFileName(input.originalFileName);
    const storagePath = `students/${storageOwnerId}/subjects/${subjectId}/${fileName}`;

    if (storagePath.length > MAX_STORAGE_PATH_LENGTH) {
      throw new Error('Document storage path is too long');
    }

    const absolutePath = resolveStoragePath(storagePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.content);

    return {
      fileName,
      storagePath,
      mimeType: 'application/pdf',
    };
  }

  async read(input: { storagePath: string }): Promise<Buffer> {
    return readFile(resolveStoragePath(input.storagePath));
  }

  async delete(input: { storagePath: string }): Promise<void> {
    await unlink(resolveStoragePath(input.storagePath)).catch(
      (error: unknown) => {
        if (isNodeError(error) && error.code === 'ENOENT') {
          return;
        }

        throw error;
      },
    );
  }
}

function buildStoredFileName(originalFileName: string): string {
  const safeBaseName = sanitizeFileName(originalFileName);
  const timestamp = Date.now().toString();
  const prefix = `${timestamp}-`;
  const maxBaseNameLength = MAX_FILE_NAME_LENGTH - prefix.length;

  if (maxBaseNameLength < 1) {
    throw new Error('Document file name is too long');
  }

  const fileName = `${prefix}${truncateFileName(
    safeBaseName,
    maxBaseNameLength,
  )}`;

  if (!fileName.toLowerCase().endsWith('.pdf')) {
    throw new Error('Course documents must be PDF files');
  }

  return fileName;
}

function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.trim();

  if (
    trimmed.length === 0 ||
    trimmed === '.' ||
    trimmed === '..' ||
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    trimmed.includes('%')
  ) {
    throw new Error('Document file name must be canonical');
  }

  return trimmed.replaceAll(/[^a-zA-Z0-9._-]/g, '_');
}

function truncateFileName(fileName: string, maxLength: number): string {
  if (fileName.length <= maxLength) {
    return fileName;
  }

  const extensionStart = fileName.lastIndexOf('.');
  const hasExtension =
    extensionStart > 0 && extensionStart < fileName.length - 1;

  if (!hasExtension) {
    return fileName.slice(0, maxLength);
  }

  const extension = fileName.slice(extensionStart);

  if (extension.length >= maxLength) {
    return fileName.slice(0, maxLength);
  }

  return `${fileName.slice(0, maxLength - extension.length)}${extension}`;
}

function validateStorageSegment(value: string, allowDots: boolean): string {
  const trimmed = value.trim();

  if (
    trimmed.length === 0 ||
    trimmed === '.' ||
    trimmed === '..' ||
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    trimmed.includes('%') ||
    (!allowDots && trimmed.includes('.'))
  ) {
    throw new Error('Document storage path must be canonical');
  }

  return trimmed;
}

function resolveStoragePath(storagePath: string): string {
  const relativePath = storagePath.trim();

  if (
    relativePath.length === 0 ||
    relativePath !== storagePath ||
    isAbsolute(relativePath) ||
    relativePath.includes('\\') ||
    relativePath.split('/').includes('..')
  ) {
    throw new Error('Document storage path must be relative');
  }

  const root = resolve(
    process.env.DOCUMENT_STORAGE_ROOT ?? 'storage/revision-documents',
  );
  const absolutePath = resolve(root, relativePath);
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;

  if (!absolutePath.startsWith(rootPrefix)) {
    throw new Error('Document storage path must be relative');
  }

  return absolutePath;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
