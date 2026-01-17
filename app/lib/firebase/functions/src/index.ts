import * as admin from 'firebase-admin';
import { onSearchDocumentUpdated } from './searchWebhook';

// Initialize Firebase Admin only if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Export the search webhook function
export { onSearchDocumentUpdated }; 