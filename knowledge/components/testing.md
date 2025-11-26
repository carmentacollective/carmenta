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

```typescript
import { describe, it, expect } from "vitest";

describe("validateEmail", () => {
  it("accepts valid email format", () => {
    expect(validateEmail("user@example.com").valid).toBe(true);
  });

  it("rejects invalid email format with helpful message", () => {
    const result = validateEmail("not-an-email");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Please enter a valid email address");
  });
});
```

### Integration Tests (Vitest + PGlite)

Tests that verify components work together correctly. Use real database operations
with PGlite (in-memory PostgreSQL) instead of mocking.

We test API route handlers with real request/response cycles, database operations with
actual SQL execution, multi-component workflows, and authentication flows.

Key pattern: Mock the database MODULE (swap Postgres for PGlite), but use real database
OPERATIONS. This catches missing migrations, wrong schemas, and broken relationships.

```typescript
import { db, schema } from "@/lib/db";
import { createTestUser } from "@/__tests__/fixtures/db-fixtures";

describe("User API", () => {
  it("creates user with all required fields", async () => {
    const user = await createTestUser({ email: "test@example.com" });

    const result = await getUserByEmail("test@example.com");

    expect(result.email).toBe("test@example.com");
  });

  it("returns user with their connections", async () => {
    const [user] = await db
      .insert(schema.users)
      .values({
        email: "test@example.com",
        clerkId: "clerk_123",
        name: "Test User",
      })
      .returning();

    await db.insert(schema.connections).values({
      userId: user.id,
      service: "github",
      status: "CONNECTED",
    });

    const result = await db.query.users.findFirst({
      where: eq(schema.users.email, "test@example.com"),
      with: { connections: true },
    });

    expect(result?.connections).toHaveLength(1);
    expect(result?.connections[0].service).toBe("github");
  });
});
```

### End-to-End Tests (Playwright)

Browser-based tests that verify the full application works from a user's perspective.
Slower but highest confidence. Run against a real dev server.

We test critical user journeys like onboarding and core workflows, page rendering and
navigation, and authentication redirects.

```typescript
import { test, expect } from "@playwright/test";

test("landing page renders with main content", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /Welcome/i })
  ).toBeVisible();

  await expect(
    page.getByRole("link", { name: /Get Started/i })
  ).toBeVisible();
});

test("protected pages redirect unauthenticated users", async ({ page }) => {
  await page.goto("/dashboard");

  await page.waitForURL(/sign-in/);
  expect(page.url()).toContain("sign-in");
});
```

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

```typescript
// __tests__/fixtures/db-fixtures.ts
export async function createTestUser(options: Partial<User> = {}) {
  const [user] = await db
    .insert(schema.users)
    .values({
      email: options.email ?? "test@example.com",
      name: options.name ?? "Test User",
      ...options,
    })
    .returning();
  return user;
}

export async function createTestUserWithSession() {
  const user = await createTestUser();
  const session = await createTestSession({ userId: user.id });
  return { user, session };
}
```

## Running Tests

```bash
# Run all unit/integration tests
pnpm test

# Run specific test file
pnpm vitest run __tests__/unit/lib/utils.test.ts

# Run tests matching pattern
pnpm vitest run -t "validates email"

# Run with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e

# Run E2E in headed mode
pnpm playwright test --headed
```

## Coverage Goals

Target 90% line coverage and 85% branch coverage through meaningful tests. Prioritize
user-facing features, business logic, error handling, and data transformations.

## Integration Points

CI/CD runs tests on every PR, blocking merge on failure. Pre-commit hooks optionally
run fast tests on staged files.

Agent Testing (see [agent-testing.md](./agent-testing.md)) will extend our testing
capabilities with AI-driven synthetic users. These agents exercise the product as real
users would, generate signals about friction points, discover edge cases we would miss,
and provide continuous regression testing at scale.

The signals from Agent Testing inform what we add to our traditional test suite. When
an agent discovers a bug or friction point, we capture it as a regression test here.
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

## Open Questions

### Test Organization

Should we co-locate tests with source files or keep separate __tests__ directory? How
do we handle tests that need external services like Redis or external APIs?

### AI Testing Strategy

How do we test AI/LLM interactions? Options include mock responses, recorded fixtures,
or live calls in integration. How do we test the Concierge's response quality without
making tests flaky?

### CI Performance

At what test count do we need to shard across multiple runners? Should we separate fast
unit tests from slower integration tests in CI?
