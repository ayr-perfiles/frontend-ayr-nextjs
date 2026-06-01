# AYR Steel ERP - Project Instructions

## Tech Stack
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS (Vanilla CSS preferred for new components).
- **Backend:** Firebase (Cloud Functions v2, Firestore, Auth, Storage).
- **State Management:** React Context + Hooks.
- **Validation:** Zod.
- **Testing:** Vitest.

## Core Mandates
1. **Security & Secrets:**
   - NEVER log, print, or commit secrets, API keys, or sensitive credentials.
   - Use Firebase Secret Manager for all backend secrets.
   - Secrets are defined in `functions/src/config/secrets.ts`.
   - Binding must be minimal per callable.

2. **Source Control:**
   - Do not stage or commit changes unless specifically requested.
   - Respect `.gitignore` and `.vercelignore`.

3. **Engineering Standards:**
   - **Language:** English for code (variables, attributes, logic), Spanish for UI and user-facing error messages.
   - **Persistence:** Use `runTransaction` for critical writes and sequential ID generation.
   - **Soft Delete:** NEVER use physical deletes. Use `status="VOIDED"` and `audit_logs`.
   - **Stock Management:** Always use `getStockStrategy(line)`. Never hardcode collections.

## Repository Structure
- `functions/`: Cloud Functions v2 logic. [See functions/GEMINI.md](functions/GEMINI.md)
- `src/app/`: Next.js pages and layouts.
- `src/components/`: Reusable UI components.
- `src/core/`: Shared business logic and strategies. [See src/core/GEMINI.md](src/core/GEMINI.md)
- `src/domain/`: Pure logic, formulas, and types. [See src/domain/GEMINI.md](src/domain/GEMINI.md)
- `src/modules/`: Business line specific implementations. [See src/modules/GEMINI.md](src/modules/GEMINI.md)
- `sunat/`: Electronic invoicing logic (UBL, Signing, SOAP).

## Development Workflow
- **Emulators:** Use `npm run emulate` for local development. Data is persisted in `./firebase-data`.
- **Type Checking:** Run `.\node_modules\.bin\tsc.cmd --noEmit` before proposing changes.
- **Linting:** Run `.\node_modules\.bin\eslint.cmd .` to ensure style consistency.
- **Testing:** Add tests for all new domain logic or services. Run `.\node_modules\.bin\vitest.cmd run`.

## Active Context (Sprint 8)
- Focus on SUNAT Electronic Invoicing (Factura/Boleta/Baja).
- Sales Importer Refactor: weight calculation, NC/ND support, idempotency.
- Firestore Security Rules migration (Sprint 7 Debt).
