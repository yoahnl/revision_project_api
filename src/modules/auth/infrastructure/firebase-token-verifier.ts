import { Injectable } from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import { ensureFirebaseAdminApp } from '../../../shared/infrastructure/firebase/firebase-admin-app';
import type {
  TokenVerifier,
  VerifiedFirebaseToken,
} from '../application/token-verifier';

@Injectable()
export class FirebaseTokenVerifier implements TokenVerifier {
  constructor() {
    ensureFirebaseAdminApp();
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
