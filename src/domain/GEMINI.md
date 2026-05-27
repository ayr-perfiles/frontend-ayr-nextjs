/mo# Domain Logic Instructions

This directory contains pure logic, formulas, and shared types.

## Rules

- **Purity:** No side effects. No Firebase imports. No Browser APIs.
- **Reliability:** 100% test coverage is the goal for this directory.
- **Constants:** Physical constants (density, tolerances) must be defined here and shared across the project.
- **Results:** Use the `Result<T, E>` pattern for complex operations instead of throwing errors.

## Steel & PVC Formulas

- All siderurgical calculations must reside in `src/domain/steel/`.
- All roofing (PVC) calculations must reside in `src/domain/roofing/` (or equivalent).
- Use `Decimal.js` or equivalent if floating point precision becomes an issue (currently using standard numbers with careful rounding).
