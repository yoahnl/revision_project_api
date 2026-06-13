import { Injectable } from '@nestjs/common';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import type { DocumentContentReader } from '../application/document-content-reader';

@Injectable()
export class FirebaseStorageDocumentReader implements DocumentContentReader {
  constructor() {
    if (getApps().length === 0) {
      initializeApp();
    }
  }

  async read(input: { storagePath: string }): Promise<Buffer> {
    const bucket = getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET);
    const [content] = await bucket.file(input.storagePath).download();

    return content;
  }
}
