import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalDocumentFileStorage } from './local-document-file-storage';

describe('LocalDocumentFileStorage', () => {
  const originalRoot = process.env.DOCUMENT_STORAGE_ROOT;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-13T18:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    if (originalRoot === undefined) {
      delete process.env.DOCUMENT_STORAGE_ROOT;
    } else {
      process.env.DOCUMENT_STORAGE_ROOT = originalRoot;
    }
  });

  it('stores PDF content below the configured root and reads it back', async () => {
    const root = await mkdtemp(join(tmpdir(), 'revision-documents-'));
    process.env.DOCUMENT_STORAGE_ROOT = root;
    try {
      const storage = new LocalDocumentFileStorage();

      const stored = await storage.saveCoursePdf({
        firebaseUid: 'firebase-1',
        subjectId: 'subject-1',
        originalFileName: 'Cours 2024-2025.pdf',
        content: Buffer.from('%PDF-1.7'),
        mimeType: 'application/pdf',
      });

      expect(stored).toEqual({
        fileName: '1781373600000-Cours_2024-2025.pdf',
        storagePath:
          'students/firebase-1/subjects/subject-1/1781373600000-Cours_2024-2025.pdf',
        mimeType: 'application/pdf',
      });
      await expect(readFile(join(root, stored.storagePath))).resolves.toEqual(
        Buffer.from('%PDF-1.7'),
      );
      await expect(
        storage.read({ storagePath: stored.storagePath }),
      ).resolves.toEqual(Buffer.from('%PDF-1.7'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects traversal attempts when reading content', async () => {
    const root = await mkdtemp(join(tmpdir(), 'revision-documents-'));
    process.env.DOCUMENT_STORAGE_ROOT = root;
    try {
      await expect(
        new LocalDocumentFileStorage().read({
          storagePath: '../secrets/cours.pdf',
        }),
      ).rejects.toThrow('Document storage path must be relative');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
