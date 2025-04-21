import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

export const onSearchDocumentUpdated = functions.firestore
  .document('users/{userId}/searches/{keyword}')
  .onCreate(async (snapshot, context) => {
    const searchData = snapshot.data();
    const { userId, keyword } = context.params;

    // Only trigger if we have both trends and books data
    if (searchData.trendData && searchData.books?.length > 0) {
      try {
        // Replace this URL with your Make webhook URL
        const webhookUrl = process.env.MAKE_WEBHOOK_URL;
        
        if (!webhookUrl) {
          console.error('Make webhook URL not configured');
          return;
        }

        // Prepare the data for Make
        const payload = {
          userId,
          keyword,
          trendData: searchData.trendData,
          books: searchData.books,
          timestamp: searchData.timestamp
        };

        // Call the Make webhook
        const response = await axios.post(webhookUrl, payload);
        
        // Log the response
        console.log('Make webhook response:', response.status);
        
        // Update the document to indicate webhook was called
        await snapshot.ref.update({
          webhookCalled: true,
          webhookTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });

      } catch (error) {
        console.error('Error calling Make webhook:', error);
        // Optionally update document to indicate failure
        await snapshot.ref.update({
          webhookError: error.message,
          webhookTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  }); 