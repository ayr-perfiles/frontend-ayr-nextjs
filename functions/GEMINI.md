# Firebase Functions Instructions

This directory contains the backend logic running on Firebase Functions (v2).

## Tech Stack
- **Runtime:** Node.js (Latest supported by Firebase)
- **SDK:** `firebase-functions/v2`, `firebase-admin`
- **Language:** TypeScript

## Rules
- **Transactional Integrity:** Use `admin.firestore().runTransaction()` for sequential operations (e.g., generating sequential IDs).
- **Security:** Always verify `request.auth` and check `request.auth.token.role` in `onCall` functions.
- **Audit Logs:** Use `onDocumentCreated` triggers to automatically generate audit logs for sensitive collections (`sales`, `coils`, `production_logs`).
- **Error Handling:** Use `HttpsError` with appropriate codes (`unauthenticated`, `permission-denied`, `internal`) and **Spanish** error messages.
- **Idempotency:** Ensure triggers are idempotent as they may be retried by Firebase.

## Best Practices
- Keep `index.ts` organized by grouping functions by purpose (e.g., Auth, Sales, Inventory).
- Log errors to `console.error` with enough context for debugging in GCP Logs.
- Avoid heavy computation in triggers; keep them lean to avoid timeouts.
