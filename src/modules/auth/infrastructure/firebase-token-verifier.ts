import { Injectable } from '@nestjs/common';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type {
  TokenVerifier,
  VerifiedFirebaseToken,
} from '../application/token-verifier';

@Injectable()
export class FirebaseTokenVerifier implements TokenVerifier {
  constructor() {
    if (getApps().length === 0) {
      initializeApp();
    }
  }

  async verify(idToken: string): Promise<VerifiedFirebaseToken> {
    const decoded = await getAuth().verifyIdToken(idToken);

    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: typeof decoded.name === 'string' ? decoded.name : null,
    };
  }
}
