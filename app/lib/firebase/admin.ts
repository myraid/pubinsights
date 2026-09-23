import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { createPrivateKey } from 'crypto';

function parsePrivateKey(raw?: string): string | undefined {
  if (!raw) return undefined;
  // Strip a surrounding quote pair that survived into the value. .env.local wraps the
  // key in double quotes and dotenv removes them, but a secret store handed that same
  // literal string keeps them — and cert() then fails with "Failed to parse private
  // key". A PEM never starts with a quote, so dropping a matched pair is always safe.
  const unquoted = raw.replace(/^\s*(['"])([\s\S]*)\1\s*$/, '$2');
  // Normalize escaped newlines
  const pem = unquoted.replace(/\\n/g, '\n');
  try {
    // Re-export as PKCS#8 PEM — works with OpenSSL 3.x in Node 22+
    return createPrivateKey(pem).export({ type: 'pkcs8', format: 'pem' }) as string;
  } catch {
    // Fallback to raw PEM if already in a compatible format
    return pem;
  }
}

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    }),
  });
}

// Initialized on first use, not at import. `next build` evaluates this module
// while collecting page data, where the service account secrets are not
// available — constructing credentials there fails the build.
function lazy<T extends object>(create: () => T): T {
  let instance: T | undefined;
  return new Proxy({} as T, {
    get(_target, prop) {
      instance ??= create();
      const value = (instance as Record<string | symbol, unknown>)[prop];
      return typeof value === 'function' ? value.bind(instance) : value;
    },
  });
}

const firebaseAdmin = lazy<App>(getAdminApp);
const adminDb = lazy<Firestore>(() => getFirestore(getAdminApp()));
const adminAuth = lazy<Auth>(() => getAuth(getAdminApp()));

export { firebaseAdmin, adminDb, adminAuth };
