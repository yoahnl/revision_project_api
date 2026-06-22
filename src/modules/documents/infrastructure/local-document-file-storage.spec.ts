import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

  it('deletes an existing file below the configured root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'revision-documents-'));
    process.env.DOCUMENT_STORAGE_ROOT = root;
    try {
      const storagePath = 'students/student-1/subjects/subject-1/cours.pdf';
      await mkdir(join(root, 'students/student-1/subjects/subject-1'), {
        recursive: true,
      });
      await writeFile(join(root, storagePath), Buffer.from('pdf-content'));

      await expect(
        new LocalDocumentFileStorage().delete({ storagePath }),
      ).resolves.toBeUndefined();

      await expect(readFile(join(root, storagePath))).rejects.toMatchObject({
        code: 'ENOENT',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('treats an already missing file as a successful delete', async () => {
    const root = await mkdtemp(join(tmpdir(), 'revision-documents-'));
    process.env.DOCUMENT_STORAGE_ROOT = root;
    try {
      await expect(
        new LocalDocumentFileStorage().delete({
          storagePath: 'students/student-1/subjects/subject-1/missing.pdf',
        }),
      ).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects unsafe delete paths before touching the filesystem', async () => {
    const root = await mkdtemp(join(tmpdir(), 'revision-documents-'));
    process.env.DOCUMENT_STORAGE_ROOT = root;
    try {
      const storage = new LocalDocumentFileStorage();

      await expect(
        storage.delete({ storagePath: '../secrets/cours.pdf' }),
      ).rejects.toThrow('Document storage path must be relative');
      await expect(
        storage.delete({ storagePath: '/tmp/cours.pdf' }),
      ).rejects.toThrow('Document storage path must be relative');
      await expect(
        storage.delete({ storagePath: 'students\\student-1\\cours.pdf' }),
      ).rejects.toThrow('Document storage path must be relative');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not delete directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'revision-documents-'));
    process.env.DOCUMENT_STORAGE_ROOT = root;
    try {
      const storagePath = 'students/student-1/subjects/subject-1';
      await mkdir(join(root, storagePath), { recursive: true });

      await expect(
        new LocalDocumentFileStorage().delete({ storagePath }),
      ).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
