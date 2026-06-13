export interface VerifiedFirebaseToken {
  uid: string;
  email: string | null;
  name: string | null;
}

export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

export interface TokenVerifier {
  verify(idToken: string): Promise<VerifiedFirebaseToken>;
}
