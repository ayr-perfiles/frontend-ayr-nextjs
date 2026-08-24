# Core Logic Instructions

This directory contains shared logic, contracts, and multi-line strategies.

## Stock Strategy Pattern
All stock operations (decrement, reversal) must be implemented using the `StockStrategy` interface in `src/core/sales/strategies/index.ts`.

### Rules for New Strategies
- **Separation:** Each business line must have its own implementation of `StockStrategy`.
- **Transactions:** `writeSaleDecrement` and `writeSaleReversal` MUST only perform writes to the provided `Transaction` object. They should NOT perform any async reads.
- **Naming:** Follow the naming convention: `[lineName]StockStrategy`.
- **Collections:** Use business-line specific collections for stock and movements (e.g., `roofing_stock`, `roofing_stock_movements`).

## Registry
- Register any new strategy in the `getStockStrategy` factory function.
- Ensure all business lines supported by the UI are also supported by the strategy registry.

## Shared Services
- Core services (Auth, CRM, Audit) are transversal and should handle data from all business lines.
- Always include `businessLine` field when logging or registering transversal data if applicable.
