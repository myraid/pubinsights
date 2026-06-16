import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { createPrivateKey } from 'crypto';

function parsePrivateKey(raw?: string): string | undefined {
  if (!raw) return undefined;
  // Normalize escaped newlines
  const pem = raw.replace(/\\n/g, '\n');
  try {
    // Re-export as PKCS#8 PEM — works with OpenSSL 3.x in Node 22+
    return createPrivateKey(pem).export({ type: 'pkcs8', format: 'pem' }) as string;
  } catch {
    // Fallback to raw PEM if already in a compatible format
    return pem;
  }
}

const firebaseAdminConfig = {
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  }),
};

// Initialize Firebase Admin
const firebaseAdmin = getApps().length === 0 ? initializeApp(firebaseAdminConfig) : getApps()[0];
const adminDb = getFirestore(firebaseAdmin);
const adminAuth = getAuth(firebaseAdmin);

export { firebaseAdmin, adminDb, adminAuth }; 