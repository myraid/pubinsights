import { adminDb } from '@/app/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export type GenerationType = 'insights' | 'outline' | 'social_ad' | 'social_post';

interface GenerationLogEntry {
  userId: string;
  type: GenerationType;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  model: string;
  createdAt: FirebaseFirestore.FieldValue;
}

export async function logGeneration(
  userId: string,
  type: GenerationType,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  model: string
): Promise<void> {
  try {
    const entry: GenerationLogEntry = {
      userId,
      type,
      input,
      output,
      model,
      createdAt: FieldValue.serverTimestamp(),
    };

    await adminDb.collection('generationLogs').add(entry);
  } catch (error) {
    console.error('Failed to log generation (non-blocking):', error);
  }
}
