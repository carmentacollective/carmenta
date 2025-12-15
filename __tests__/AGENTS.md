# Tests

Vitest unit tests and Playwright E2E tests. Uses PGlite (in-memory PostgreSQL) for real
database operations.

## Database Setup is OPT-IN

Tests that need a database must explicitly call `setupTestDb()`:

```typescript
import { setupTestDb } from "@/vitest.setup";
setupTestDb(); // Before describe() blocks
```

Tests without this call get **zero database overhead**. Only 5 test files currently need
the database - the rest run without any PGlite initialization.

## Critical Rule: One Global Mock, Zero Local Mocks

Never create local `vi.mock("@/lib/db")` in test files—it overrides the global PGlite
mock from `vitest.setup.ts` and breaks tests with partial interface errors.

Use real database operations. Insert data, call production code, verify results. No
`vi.mocked()`, no `mockResolvedValue()` for database calls.

Test fixtures live in `__tests__/fixtures/`.

## External API Integration Tests

Some integration tests make real API calls to external services and require API keys.
These tests are automatically skipped unless the required environment variables are set.

### Giphy Integration Tests

Location: `__tests__/integration/lib/integrations/adapters/giphy.integration.test.ts`

Run with API key:

```bash
GIPHY_API_KEY=your_key_here pnpm test giphy.integration
```

Without the API key, these tests are skipped automatically. This allows CI/CD to run
without requiring external API credentials while still enabling local testing with real
APIs.

### CoinMarketCap Integration Tests

Location:
`__tests__/integration/lib/integrations/adapters/coinmarketcap.integration.test.ts`

Run with API key:

```bash
COINMARKETCAP_API_KEY=your_key_here pnpm test coinmarketcap.integration
```

Without the API key, these tests are skipped automatically. Tests cover all major
operations including listings, quotes, global metrics, cryptocurrency info, categories,
price conversion, and raw API access.

### Limitless Integration Tests

Location:
`__tests__/integration/lib/integrations/adapters/limitless.integration.test.ts`

Run with API key:

```bash
LIMITLESS_API_KEY=your_key_here pnpm test limitless.integration
```

Without the API key, these tests are skipped automatically. Tests cover all major
operations including search, list recordings, lifelog details, chats, audio download,
and raw API access. Destructive operations (delete_lifelog, delete_chat) only test
parameter validation to protect real user data.

### Fireflies Integration Tests

Location:
`__tests__/integration/lib/integrations/adapters/fireflies.integration.test.ts`

Run with API key:

```bash
FIREFLIES_API_KEY=your_key_here pnpm test fireflies.integration
```

Without the API key, these tests are skipped automatically. Tests cover all 5 adapter
operations: list_transcripts, get_transcript, search_transcripts, generate_summary, and
raw_api (GraphQL). Note: Fireflies free plan has 50 API calls/day limit.

@.cursor/rules/testing-standards-typescript.mdc
