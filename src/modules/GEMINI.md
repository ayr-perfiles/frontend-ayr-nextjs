# Business Line Modules Instructions

Every new business line must be implemented as a module in this directory.

## Implementation Checklist
- [ ] **Contract:** Implement the `BusinessLineModule` contract in `index.ts`.
- [ ] **Registry:** Register the new module in `src/core/registry/`.
- [ ] **Engines:** Implement specialized engines (Production, Inventory) if needed.
- [ ] **Schemas:** Define Zod schemas for all new data structures.
- [ ] **Sales Strategy:** Add a new stock strategy in `src/core/sales/strategies/`.
- [ ] **UI:** Use the shared components from `src/components/` when possible.

## Directory Structure
```
modules/[line-name]/
├── components/     # Module-specific UI
├── services/       # Firestore interactions
├── domain/         # Pure logic and SKU generation
├── hooks/          # React hooks
├── engines/        # Implementation of core contracts
├── schemas/        # Zod validation
└── index.ts        # Entry point (export BusinessLineModule)
```

## Rules
- **Isolation:** Never import from another business line module. Only import from `core/`, `domain/`, or `lib/`.
- **Consistency:** Follow the Spanish UI / English Code convention.
- **Testing:** Each service and domain function must have a corresponding `.test.ts` file.
