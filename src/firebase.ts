import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

/**
 * CRITICAL: Pass `firebaseConfig.firestoreDatabaseId` to target the provisioned named Firestore database.
 */
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): FirestoreErrorInfo {
  return {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
}

/**
 * Structured Firestore error logger & wrapper required for diagnostics.
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Converts low-level Firebase/Firestore exceptions into clear, friendly French UI messages
 * without crashing the app or blocking Solo AI mode.
 */
export function formatUserFriendlyFirestoreError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  if (lower.includes('quota exceeded')) {
    return 'Quota Firestore atteint pour aujourd’hui. Le mode 🤖 Jouer avec IA reste 100 % disponible.';
  }
  if (lower.includes('permission') || lower.includes('insufficient')) {
    return 'Accès Firestore refusé par les règles de sécurité. Vérifie la connexion ou utilise le mode 🤖 Jouer avec IA.';
  }
  if (lower.includes('offline') || lower.includes('unavailable') || lower.includes('network')) {
    return 'Connexion réseau instable ou hors ligne. Vérifie ta connexion Internet et réessaie.';
  }
  return 'Impossible de joindre le salon Cloud Firestore pour le moment. Réessaie ou joue avec l’IA.';
}

/**
 * Startup connectivity validation to catch misconfigured / offline Firestore early.
 */
async function testConnection(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
