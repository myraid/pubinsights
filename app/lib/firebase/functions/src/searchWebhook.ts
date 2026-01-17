import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import axios from 'axios';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

/*
 * NOTE: This Firebase function is no longer used as we now call the webhook directly from the API
 * instead of triggering it from Firestore document creation. This file is kept for reference.
 * The webhook functionality has been moved to app/api/insights/route.ts
 */

// This function is no longer triggered as we don't rely on Firestore triggers anymore
export const onSearchDocumentUpdated = onDocumentCreated('users/{userId}/searches/{keyword}', async (event) => {
  // Function implementation is kept for reference but is no longer used
  console.log('This function is deprecated and no longer used. Webhooks are called directly from the API.');
  return null;
}); 