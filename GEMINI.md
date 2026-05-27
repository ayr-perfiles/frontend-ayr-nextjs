# Project Instructions: AYR Steel ERP

This project is a modular ERP for steel and PVC products.
Adhere to these rules to maintain transactional integrity, security, and domain consistency.

## Tech Stack & Commands
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4
- **Backend:** Firebase (Auth, Firestore, Storage, Functions)
- **Testing:** Vitest, @testing-library/react
- **Validation:** Zod

### Commands
- `npm run emulate`: Start Firebase emulators and Next.js dev server (Recommended)
- `npm run lint`: Run ESLint
- `npm run test`: Run all tests (Mandatory before commit)
- `npm run type-check`: Run TypeScript compiler check

## Architecture & Conventions
- **Modular Structure:**
    - `src/core/`: Shared logic (auth, crm, audit, sales strategies).
    - `src/domain/`: Pure logic (steel formulas, pricing, result types).
    - `src/modules/`: Business lines (drywall, roofing).
- **Language:** UI and error messages in **Spanish (es-PE)**; code (identifiers, types, comments) in **English**.
- **No `any`:** Use explicit types or `unknown` with guards.

## Mandatory Rules

### 1. Transactional Integrity
- **Stock, Kardex, Sales, Production:** ALL operations must be inside `runTransaction`.
- **Pattern:** Perform ALL reads FIRST, then ALL writes.
- **Audit Logs:** Include an audit log document within the same transaction for sensitive operations.

### 2. Multi-line Strategy
- **Sales:** A sale can have items from multiple business lines.
- **Pattern:** Use the Strategy Pattern (`getStockStrategy(businessLine)`) instead of conditional blocks per line.
- **Validation:** Always validate `businessLine` for each item in a sale.

### 3. Stock Management
- **Negative Stock:** Allowed for ALL lines. Do not block sales.
- **UI Hint:** Ensure a visual warning is provided when stock is insufficient.

### 4. Security
- **RBAC:** Managed via custom claims (ADMIN, SUPERVISOR, OPERATOR).
- **Integrity:** `firestore.rules`, layout checks, and middleware must remain synchronized.

### 5. Testing
- **Coverage:** >80% for pure domain logic.
- **Location:** `.test.ts` files must be adjacent to the source file.
- **Requirement:** Run `npm run test` to verify changes.

## When to Ask for Confirmation
- Modifying `firestore.rules` or `storage.rules`.
- Changing physical constants or core business formulas.
- Renaming/Deleting Firestore collections.
- Modifying the `BusinessLineModule` contract.
- Changing `processSale` transaction logic.

Refer to `CLAUDE.md` for more detailed domain glossary and SKU conventions.
