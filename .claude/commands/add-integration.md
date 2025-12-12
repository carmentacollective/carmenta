---
description: Create a new external service integration
---

# Add Integration Command

`/add-integration <service-name>`

<objective>
Build a complete, tested service integration that works with Carmenta's chat interface.
An integration is NOT complete without unit tests. Study existing adapters, research the
target service's API, and create an adapter that follows established patterns.
</objective>

<definition-of-done>
An integration is complete when ALL of these are done. Use TodoWrite to track progress.

**Required for every integration:**

- [ ] Service adapter implemented with all operations
- [ ] Service registry entry added
- [ ] Adapter exported and registered in tools.ts
- [ ] Service logo added
- [ ] Unit tests written and passing (REQUIRED - not optional)
- [ ] All quality checks pass (type-check, lint, build, test)

**For OAuth services, also:**

- [ ] fetchAccountInfo() method implemented
- [ ] Nango configuration documented

**Create this todo list at the start of work.** Mark items complete as you go. The
integration is not ready for review until every checkbox is checked.
</definition-of-done>

<context>
Carmenta uses two authentication patterns:

**OAuth services** (Notion, ClickUp): Nango handles OAuth flow and proxied API calls.
Adapter uses `connectionId` from `getCredentials()`. OAuth infrastructure already exists

- you only need to add the service adapter and configure Nango.

**API key services** (Giphy, Fireflies, Limitless): Direct API calls with encrypted
credentials. Adapter uses decrypted `credentials.apiKey` from `getCredentials()`.

All service metadata lives in `lib/integrations/services.ts` SERVICE_REGISTRY. Adapters
extend `ServiceAdapter` base class and implement `getHelp()`, `execute()`, and
`executeRawAPI()`. </context>

<oauth-infrastructure>
For OAuth services, the infrastructure is already built (implemented for ClickUp):

**OAuth Callback** (`app/oauth/callback/route.ts`):

- Custom callback URL for branding (users never see api.nango.dev)
- 308 redirect to Nango preserving all OAuth parameters
- No changes needed for new OAuth services

**Session Token API** (`app/api/connect/route.ts`):

- Creates Nango connect sessions for initiating OAuth
- Generic implementation works for all OAuth services
- Maps service names to Nango integration keys

**Webhook Handler** (`app/api/webhooks/nango/route.ts`):

- Receives auth events (creation, deletion, refresh)
- HMAC signature verification for security
- Fetches account info using adapter's `fetchAccountInfo()` method
- Generic implementation works for all OAuth services

**Frontend Integration** (`app/integrations/page.tsx`):

- OAuth flow already wired up
- Works automatically for any service with `authMethod: "oauth"`

To add a new OAuth service: create the adapter with `fetchAccountInfo()` method,
configure Nango, and the rest works automatically. </oauth-infrastructure>

<reference-files>
Study these files to understand patterns:
- `lib/integrations/adapters/clickup.ts` - OAuth adapter with fetchAccountInfo
- `lib/integrations/adapters/notion.ts` - OAuth adapter example
- `lib/integrations/adapters/giphy.ts` - API key adapter example
- `lib/integrations/services.ts` - Service registry
- `lib/integrations/connection-manager.ts` - Credential access
- `lib/integrations/tools.ts` - Tool factory
</reference-files>

<deliverables>
1. **Service adapter** at `lib/integrations/adapters/[service].ts`
   - Extends ServiceAdapter base class
   - Implements 4-12 core operations based on API research
   - Uses `getCredentials()` for authentication
   - For OAuth services: implements `fetchAccountInfo()` method that returns
     `{ identifier: string, displayName: string }` - webhook handler calls this
   - Includes comprehensive error handling

2. **Service registry entry** in `lib/integrations/services.ts`
   - Start with `status: "coming_soon"` until tested
   - Include capabilities array for tool descriptions
   - Set `authMethod: "oauth"` or `authMethod: "api_key"`

3. **System registration**
   - Export adapter from `lib/integrations/adapters/index.ts`
   - Add to adapterMap in `lib/integrations/tools.ts`
   - For OAuth: add service mapping in `app/api/connect/route.ts` if key differs

4. **Service logo** at `public/logos/[service].svg`

5. **Unit tests** at `__tests__/unit/lib/integrations/adapters/[service].test.ts`
   - MANDATORY - integration is incomplete without tests
   - Test service configuration (name, display name)
   - Test help documentation structure
   - Test connection validation (testConnection method)
   - Test each operation with mocked HTTP responses
   - Test error handling (auth errors, invalid inputs, API errors)
   - Use existing adapter tests as templates (giphy, limitless, coinmarketcap)

6. **Integration tests** (if adding connection-manager features)
   - Add test fixtures to `__tests__/fixtures/integration-fixtures.ts` if needed
   - Test credential retrieval patterns if adding new auth types
   - Follow patterns in `__tests__/integration/lib/integrations/` </deliverables>

<minimum-test-coverage>
Every adapter MUST have tests covering:

1. **Configuration tests** (2+ tests)
   - serviceName and serviceDisplayName are correct
   - getHelp() returns valid documentation structure

2. **Connection test** (2+ tests)
   - testConnection() succeeds with valid credentials
   - testConnection() fails gracefully with invalid credentials

3. **Operation tests** (2+ tests per operation)
   - Each operation executes successfully with valid input
   - Each operation handles errors appropriately

4. **Error handling** (3+ tests)
   - Authentication errors (401/403)
   - Invalid input validation
   - API errors (500, rate limits, timeouts)

**Minimum total: 10-15 tests per adapter**, scaling with operation count.

Adapters without tests will not be merged. This is non-negotiable.
</minimum-test-coverage>

<testing-guide>
**Test Structure for Adapters:**

Reference `__tests__/unit/lib/integrations/adapters/giphy.test.ts` for complete pattern.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { YourAdapter } from "@/lib/integrations/adapters/your-service";
import { ValidationError } from "@/lib/errors";

// Mock connection manager and HTTP client
vi.mock("@/lib/integrations/connection-manager", () => ({
  getCredentials: vi.fn(),
}));
vi.mock("@/lib/http-client", () => ({
  httpClient: { get: vi.fn(), post: vi.fn() },
}));
vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://carmenta.app" },
}));

describe("YourAdapter", () => {
  let adapter: YourAdapter;
  const testUserEmail = "test@example.com";

  beforeEach(() => {
    adapter = new YourAdapter();
    vi.clearAllMocks();
  });

  describe("Service Configuration", () => {
    it("has correct service properties", () => {
      expect(adapter.serviceName).toBe("your-service");
      expect(adapter.serviceDisplayName).toBe("Your Service");
    });
  });

  describe("getHelp", () => {
    it("returns help documentation", () => {
      const help = adapter.getHelp();
      expect(help.service).toBe("Your Service");
      expect(help.operations).toBeDefined();
      expect(help.docsUrl).toBe("https://docs.yourservice.com");
    });
  });

  describe("Connection Testing", () => {
    it("validates credentials using test endpoint", async () => {
      const { httpClient } = await import("@/lib/http-client");
      (httpClient.get as Mock).mockReturnValue({
        json: vi.fn().mockResolvedValue({ success: true }),
      } as never);

      const result = await adapter.testConnection("test-api-key");
      expect(result.success).toBe(true);
    });

    it("returns error for invalid credentials", async () => {
      const { httpClient } = await import("@/lib/http-client");
      (httpClient.get as Mock).mockReturnValue({
        json: vi.fn().mockRejectedValue(new Error("HTTP 401: Unauthorized")),
      } as never);

      const result = await adapter.testConnection("invalid-key");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid");
    });
  });

  describe("operation_name operation", () => {
    it("executes operation with correct params", async () => {
      const { getCredentials } = await import("@/lib/integrations/connection-manager");
      const { httpClient } = await import("@/lib/http-client");

      (getCredentials as Mock).mockResolvedValue({
        type: "api_key",
        credentials: { apiKey: "test-key" },
      });

      (httpClient.get as Mock).mockReturnValue({
        json: vi.fn().mockResolvedValue({
          // Match actual API response structure
          data: [{ id: "123", name: "Test" }],
        }),
      } as never);

      const result = await adapter.execute(
        "operation_name",
        { param: "value" },
        testUserEmail
      );

      expect(result.isError).toBe(false);
      expect(httpClient.get).toHaveBeenCalledWith(
        expect.stringContaining("api.yourservice.com"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-key",
          }),
        })
      );
    });
  });
});
```

**Key Testing Requirements:**

- Mock HTTP responses must match actual API response structure (check for nested data,
  image objects, etc.)
- Use `as never` type assertion for mocked HTTP client returns to satisfy TypeScript
- Test both success and error paths for each operation
- For limit/offset params: expect string values (adapters convert numbers to strings)
- Use `setupTestDb()` for integration tests that need database access
- Import test fixtures from `@/__tests__/fixtures/integration-fixtures` </testing-guide>

<quality-checks>
Before marking complete, ALL must pass:

1. `bun run type-check` - no TypeScript errors
2. `bun run lint` - no linting errors
3. `bun run build` - production build succeeds
4. `bun run test` - all tests pass, including YOUR NEW ADAPTER TESTS

If tests don't exist for the adapter, the integration is not complete. Go back and write
them before proceeding. </quality-checks>

<user-setup-instructions>
After code is complete, provide manual setup instructions:

For OAuth services:

1. **OAuth Provider Setup:**
   - Where to create OAuth app (e.g., ClickUp App Directory, Notion Integrations)
   - OAuth settings to configure
   - Redirect URI: `https://yourdomain.com/oauth/callback` (your custom callback)
   - Scopes required for adapter operations

2. **Nango Configuration:**
   - Add integration in Nango dashboard
   - Configure provider settings (client ID, client secret, scopes)
   - Set webhook URL: `https://yourdomain.com/api/webhooks/nango`
   - Test OAuth flow with Nango's test feature

3. **Environment Variables:**
   - Add to `.env.local`: `NANGO_SECRET_KEY`, `NANGO_WEBHOOK_SECRET`
   - Add to `.env.example` with documentation

For API key services:

- Where to get an API key from the service
- How to connect via `/integrations` page
- Any required API key permissions or scopes </user-setup-instructions>
