# Testing

Comprehensive testing infrastructure that gives us confidence to move fast. Vitest for
unit and integration tests, Playwright for end-to-end browser testing. Built for a
Next.js codebase with TypeScript throughout.

## Why This Exists

We build at the speed of thought. That requires confidence - confidence that changes
work correctly, that edge cases are handled, that the system behaves as expected.
Testing provides that confidence.

Good tests also serve as living documentation. They show how components are meant to be
used, what inputs they expect, how they handle errors. When we or AI agents revisit code
months later, tests explain intent.

## Testing Layers

### Unit Tests (Vitest)

Fast, isolated tests for individual functions and components. Run in milliseconds.

We test pure business logic, utility functions, React component rendering and behavior,
data transformations, validations, and error handling paths.

### Integration Tests (Vitest + PGlite)

Tests that verify components work together correctly. Use real database operations with
PGlite (in-memory PostgreSQL) instead of mocking.

We test API route handlers with real request/response cycles, database operations with
actual SQL execution, multi-component workflows, and authentication flows.

Key pattern: Mock the database MODULE (swap Postgres for PGlite), but use real database
OPERATIONS. This catches missing migrations, wrong schemas, and broken relationships.

### End-to-End Tests (Playwright)

Browser-based tests that verify the full application works from a user's perspective.
Slower but highest confidence. Run against a real dev server.

We test critical user journeys like onboarding and core workflows, page rendering and
navigation, and authentication redirects.

## Directory Structure

```
__tests__/
├── unit/           # Vitest unit tests
│   ├── lib/        # Utility and business logic tests
│   ├── components/ # React component tests
│   └── app/        # API route and page tests
├── integration/    # Vitest integration tests (with PGlite)
├── e2e/            # Playwright browser tests
└── fixtures/       # Shared test data factories
```

## Test Fixtures

Reusable factory functions that create test data. Keep tests DRY while maintaining
explicit, type-safe data creation.

## Running Tests

```bash
# Run all unit/integration tests
bun test

# Run specific test file
bun vitest run __tests__/unit/lib/utils.test.ts

# Run tests matching pattern
bun vitest run -t "validates email"

# Run with coverage
bun test:coverage

# Run E2E tests
bun test:e2e

# Run E2E in headed mode
bun playwright test --headed
```

## Coverage Goals

Target 90% line coverage and 85% branch coverage through meaningful tests. Prioritize
user-facing features, business logic, error handling, and data transformations.

## Integration Points

CI/CD runs tests on every PR, blocking merge on failure. Pre-commit hooks optionally run
fast tests on staged files.

Agent Testing (see [agent-testing.md](./agent-testing.md)) will extend our testing
capabilities with AI-driven synthetic users. These agents exercise the product as real
users would, generate signals about friction points, discover edge cases we would miss,
and provide continuous regression testing at scale.

The signals from Agent Testing inform what we add to our traditional test suite. When an
agent discovers a bug or friction point, we capture it as a regression test here.
Traditional tests provide deterministic, fast, precise coverage. Agent tests provide
exploratory, realistic discovery of unknowns.

## Decisions

### Vitest over Jest

Speed: 10-30x faster through Vite's native ESM and esbuild. TypeScript works natively
without ts-jest configuration. Hot module replacement re-runs only changed tests.
Configuration shares vite.config.ts. API is Jest-compatible for easy migration.

### Playwright over Cypress

Native support for Chromium, Firefox, and WebKit. Built-in waiting for elements removes
need for explicit waits. Test isolation enables true parallel execution. Excellent trace
viewer and headed mode for debugging. Can test HTTP endpoints directly.

### PGlite for Database Tests

Tests run actual PostgreSQL queries instead of mocked returns. In-memory WASM execution
requires no external database. Tests verify migrations work correctly. Each test gets
fresh schema via DROP/CREATE for isolation.

## Integration with Prompt Testing

Traditional tests (unit, integration, E2E) verify code behavior. Prompt tests verify AI
behavior. Both are essential.

Prompt Testing (see [prompt-testing.md](./prompt-testing.md)) handles:

- Multi-model evaluation of prompt functions
- LLM-as-judge assertions for semantic correctness
- Iteration workflow for prompt optimization
- Regression prevention for prompt changes

The two systems complement each other:

- Unit tests verify prompt functions return correct message structures
- Prompt tests verify those messages produce correct AI behavior
- Integration tests verify the full pipeline (prompt → model → response → UI)

## Open Questions

### Test Organization

Should we co-locate tests with source files or keep separate **tests** directory? How do
we handle tests that need external services like Redis or external APIs?

### CI Performance

At what test count do we need to shard across multiple runners? Should we separate fast
unit tests from slower integration tests in CI?
