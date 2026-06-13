export const DOCUMENT_FILE_STORAGE = Symbol('DOCUMENT_FILE_STORAGE');

export interface StoredDocumentFile {
  fileName: string;
  storagePath: string;
  mimeType: string;
}

export interface DocumentFileStorage {
  saveCoursePdf(input: {
    firebaseUid: string;
    subjectId: string;
    originalFileName: string;
    content: Buffer;
    mimeType: string;
  }): Promise<StoredDocumentFile>;

  delete(input: { storagePath: string }): Promise<void>;
}
