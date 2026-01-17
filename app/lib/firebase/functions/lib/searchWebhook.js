"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onSearchDocumentUpdated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const axios_1 = require("axios");
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.onSearchDocumentUpdated = (0, firestore_1.onDocumentCreated)('users/{userId}/searches/{keyword}', async (event) => {
    var _a, _b, _c;
    const snapshot = event.data;
    if (!snapshot) {
        console.log('No data associated with the event');
        return;
    }
    const searchData = snapshot.data();
    const { userId, keyword } = event.params;
    try {
        const webhookUrl = process.env.MAKE_WEBHOOK_INSIGHTS_URL;
        if (!webhookUrl) {
            console.error('Make webhook URL not configured');
            return;
        }
        // Process trend data if available
        let trendMetrics = null;
        if (searchData.trendData) {
            const webSearchTrend = ((_a = searchData.trendData.webSearch) === null || _a === void 0 ? void 0 : _a.timelineData) || [];
            const youtubeTrend = ((_b = searchData.trendData.youtube) === null || _b === void 0 ? void 0 : _b.timelineData) || [];
            // Calculate trend metrics
            const webSearchAvg = webSearchTrend.length > 0
                ? webSearchTrend.reduce((acc, point) => acc + point.value[0], 0) / webSearchTrend.length
                : 0;
            const youtubeAvg = youtubeTrend.length > 0
                ? youtubeTrend.reduce((acc, point) => acc + point.value[0], 0) / youtubeTrend.length
                : 0;
            trendMetrics = {
                webSearchAverageInterest: webSearchAvg,
                youtubeAverageInterest: youtubeAvg,
                webSearchDataPoints: webSearchTrend.length,
                youtubeDataPoints: youtubeTrend.length,
                trends: {
                    webSearch: webSearchTrend,
                    youtube: youtubeTrend
                }
            };
        }
        // Process book data if available
        let marketMetrics = null;
        if (((_c = searchData.books) === null || _c === void 0 ? void 0 : _c.length) > 0) {
            const booksData = searchData.books;
            const avgBSR = booksData.reduce((acc, book) => acc + Math.min(...book.bsr.map((b) => b.rank)), 0) / booksData.length;
            const avgPrice = booksData.reduce((acc, book) => acc + book.price, 0) / booksData.length;
            const indieCount = booksData.filter((book) => book.isIndie).length;
            const traditionalCount = booksData.length - indieCount;
            marketMetrics = {
                averageBSR: avgBSR,
                averagePrice: avgPrice,
                indieAuthorsCount: indieCount,
                traditionalPublishersCount: traditionalCount,
                totalBooks: booksData.length,
                books: booksData
            };
        }
        // Only proceed if we have either trend or market data
        if (trendMetrics || marketMetrics) {
            const payload = Object.assign(Object.assign({ userId,
                keyword, timestamp: searchData.timestamp, historyDocId: searchData.historyDocId }, (trendMetrics && { trendMetrics })), (marketMetrics && { marketMetrics }));
            // Call the Make webhook
            const response = await axios_1.default.post(webhookUrl, payload);
            console.log('Make webhook response:', response.status);
            // Update the document to indicate webhook was called
            await snapshot.ref.update({
                webhookCalled: true,
                webhookTimestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }
    catch (error) {
        console.error('Error calling Make webhook:', error);
        // Update document to indicate failure
        await snapshot.ref.update({
            webhookError: error.message,
            webhookTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    }
});
//# sourceMappingURL=searchWebhook.js.map