"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onSearchDocumentUpdated = void 0;
const admin = require("firebase-admin");
const searchWebhook_1 = require("./searchWebhook");
Object.defineProperty(exports, "onSearchDocumentUpdated", { enumerable: true, get: function () { return searchWebhook_1.onSearchDocumentUpdated; } });
// Initialize Firebase Admin only if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
//# sourceMappingURL=index.js.map