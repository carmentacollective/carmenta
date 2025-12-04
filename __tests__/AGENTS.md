# Tests

Vitest unit tests and Playwright E2E tests. Uses PGlite (in-memory PostgreSQL) for real
database operations.

**Critical Rule: One Global Mock, Zero Local Mocks**

Never create local `vi.mock("@/lib/db")` in test files—it overrides the global PGlite
mock from `vitest.setup.ts` and breaks tests with partial interface errors.

Use real database operations. Insert data, call production code, verify results. No
`vi.mocked()`, no `mockResolvedValue()` for database calls.

Test fixtures live in `__tests__/fixtures/`.

@.cursor/rules/testing-standards-typescript.mdc
