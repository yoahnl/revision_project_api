import type { Request } from 'express';

export interface AuthenticatedStudent {
  id: string;
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
}

export interface AuthenticatedRequest extends Request {
  student?: AuthenticatedStudent;
}
