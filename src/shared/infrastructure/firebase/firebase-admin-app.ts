import { cert, getApps, initializeApp } from 'firebase-admin/app';

type FirebaseServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

export function ensureFirebaseAdminApp(): void {
  if (getApps().length > 0) {
    return;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

  if (!serviceAccountJson) {
    initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    return;
  }

  const serviceAccount = parseServiceAccount(serviceAccountJson);

  initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
    projectId: serviceAccount.project_id ?? process.env.FIREBASE_PROJECT_ID,
  });
}

function parseServiceAccount(value: string): FirebaseServiceAccount {
  try {
    return JSON.parse(value) as FirebaseServiceAccount;
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON');
  }
}
