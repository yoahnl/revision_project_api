import { Injectable } from '@nestjs/common';
import { getStorage } from 'firebase-admin/storage';
import { ensureFirebaseAdminApp } from '../../../shared/infrastructure/firebase/firebase-admin-app';
import type { DocumentContentReader } from '../application/document-content-reader';

@Injectable()
export class FirebaseStorageDocumentReader implements DocumentContentReader {
  constructor() {
    ensureFirebaseAdminApp();
  }

  async read(input: { storagePath: string }): Promise<Buffer> {
    const bucket = getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET);
    const [content] = await bucket.file(input.storagePath).download();

    return content;
  }
}
