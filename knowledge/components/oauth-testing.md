# OAuth Flow Testing

Testing strategy for in-house OAuth implementation. Focuses on robust, simple approaches
that don't require real browsers or live provider connections.

## Testing Philosophy

OAuth flows look complex but decompose into testable units:

1. **URL building** - Pure function, fully unit testable
2. **State management** - CSRF generation/validation, database operations
3. **Token exchange** - HTTP POST to provider, mockable
4. **Token storage** - Encryption + database, already tested via encryption module
5. **Token refresh** - Time-based logic + HTTP, mockable

The only untestable part is the user clicking "Authorize" on the provider's site. We
don't own that, so we don't test it.

## Testing Layers

### Layer 1: Unit Tests (No Mocks)

Test pure functions in isolation:

**Provider configuration (`lib/integrations/oauth/providers/*.ts`):**

- Authorization URL building with correct params
- Scope parameter handling (`scope` vs `user_scope` for Slack)
- Additional provider-specific params

**State management (`lib/integrations/oauth/state.ts`):**

- State encoding/decoding roundtrip
- Expiration logic (state older than TTL should fail validation)
- CSRF token format and uniqueness

**Token parsing:**

- `expires_in` → `expires_at` conversion
- Missing fields handled gracefully
- Token rotation detection

```typescript
// Example: State expiration test
describe("validateState", () => {
  it("rejects expired state", async () => {
    const state = createTestState({ createdAt: Date.now() - 6 * 60 * 1000 }); // 6 min ago
    const encoded = encodeState(state);

    const result = await validateState(encoded);

    expect(result).toBeNull();
  });
});
```

### Layer 2: Integration Tests with Mocked HTTP

Use `msw` (Mock Service Worker) to intercept provider API calls.

**Why MSW:**

- Intercepts at network level (not function mocking)
- Works with any HTTP client (ky, fetch, axios)
- Same mocks work in tests and development
- No test-specific code paths needed

**Setup:**

```typescript
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer(
  // Mock Notion token endpoint
  http.post("https://api.notion.com/v1/oauth/token", async ({ request }) => {
    const body = await request.json();

    // Validate request format
    if (!body.code || !body.redirect_uri) {
      return HttpResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    // Return mock token response
    return HttpResponse.json({
      access_token: "mock_access_token_123",
      token_type: "bearer",
      workspace_id: "workspace_abc",
      workspace_name: "Test Workspace",
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**Test callback flow:**

```typescript
describe("OAuth callback", () => {
  it("exchanges code for tokens and stores them", async () => {
    // Arrange: Create valid state in database
    const state = await generateState("user@example.com", "notion");

    // Act: Simulate callback request
    const response = await testClient.get("/integrations/oauth/callback", {
      searchParams: {
        code: "auth_code_from_notion",
        state,
      },
    });

    // Assert: Redirect to success page
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("/integrations?connected=notion");

    // Assert: Tokens stored in database
    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.userEmail, "user@example.com"),
        eq(integrations.service, "notion")
      ),
    });
    expect(integration).toBeDefined();
    expect(integration.encryptedCredentials).toBeTruthy();
    expect(integration.status).toBe("connected");
  });
});
```

### Layer 3: Error Scenario Tests

Test failure modes without touching real providers:

**Provider returns error:**

```typescript
server.use(
  http.post("https://api.notion.com/v1/oauth/token", () => {
    return HttpResponse.json(
      {
        error: "invalid_grant",
        error_description: "Authorization code expired",
      },
      { status: 400 }
    );
  })
);

it("handles token exchange failure gracefully", async () => {
  const state = await generateState("user@example.com", "notion");

  const response = await testClient.get("/integrations/oauth/callback", {
    searchParams: { code: "expired_code", state },
  });

  expect(response.status).toBe(302);
  expect(response.headers.location).toContain("error=");
});
```

**Invalid state (CSRF attack simulation):**

```typescript
it("rejects invalid CSRF state", async () => {
  const response = await testClient.get("/integrations/oauth/callback", {
    searchParams: {
      code: "valid_code",
      state: "tampered_or_replay_state",
    },
  });

  expect(response.status).toBe(302);
  expect(response.headers.location).toContain("error=invalid_state");
});
```

**Network failure:**

```typescript
server.use(
  http.post("https://api.notion.com/v1/oauth/token", () => {
    return HttpResponse.error(); // Simulate network failure
  })
);

it("handles network failures", async () => {
  // ... test graceful degradation
});
```

### Layer 4: Token Refresh Tests

Test refresh logic with time manipulation:

```typescript
describe("token refresh", () => {
  it("refreshes token when expiring within 5 minutes", async () => {
    // Store token that expires in 3 minutes
    await storeTokens("user@example.com", "slack", {
      access_token: "old_token",
      refresh_token: "refresh_token",
      expires_at: Math.floor(Date.now() / 1000) + 180, // 3 min from now
    });

    // Mock refresh endpoint
    server.use(
      http.post("https://slack.com/api/oauth.v2.access", () => {
        return HttpResponse.json({
          access_token: "new_token",
          refresh_token: "new_refresh_token",
          expires_in: 3600,
        });
      })
    );

    const credentials = await getCredentials("user@example.com", "slack");

    expect(credentials.accessToken).toBe("new_token");
  });

  it("does not refresh token with plenty of time remaining", async () => {
    // Store token that expires in 30 minutes
    await storeTokens("user@example.com", "slack", {
      access_token: "valid_token",
      expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 min from now
    });

    const credentials = await getCredentials("user@example.com", "slack");

    expect(credentials.accessToken).toBe("valid_token");
    // Verify no refresh call was made
  });
});
```

## Test Fixtures

Create reusable fixtures for common scenarios:

```typescript
// test/fixtures/oauth.ts

export const mockNotionTokenResponse = {
  access_token: "notion_access_token_123",
  token_type: "bearer",
  workspace_id: "workspace_abc",
  workspace_name: "Test Workspace",
};

export const mockSlackTokenResponse = {
  ok: true,
  access_token: "xoxp-user-token-123",
  refresh_token: "xoxr-refresh-token-456",
  token_type: "bearer",
  scope: "channels:read,chat:write",
  team: { id: "T123", name: "Test Team" },
  authed_user: { id: "U123" },
  expires_in: 43200,
};

export const createTestState = (overrides?: Partial<OAuthState>): OAuthState => ({
  csrf: "test_csrf_" + Math.random().toString(36),
  userEmail: "test@example.com",
  service: "notion",
  createdAt: Date.now(),
  ...overrides,
});
```

## What We Don't Test

**The provider's authorization page:** We can't control or test what happens on
Notion/Slack/Google's OAuth consent screens. That's their responsibility.

**Real token validity:** We test that we store and retrieve tokens correctly, not that
they actually work against the real API. That's integration testing at a different level
(and would require real credentials).

**Browser redirects:** We test that our routes return the correct redirect URLs. We
don't test that the browser actually follows them - that's browser behavior, not our
code.

## CI Considerations

All tests run without network access to real providers:

- MSW intercepts all HTTP calls
- No environment variables needed for provider credentials
- Fast and deterministic
- No rate limiting concerns

For local development, create a `.env.test`:

```bash
# Test encryption key (different from prod)
CREDENTIALS_ENCRYPTION_KEY=test_key_for_ci_only

# Database URL (PGlite in-memory or test database)
DATABASE_URL=postgresql://test:test@localhost:5432/carmenta_test
```

## Summary

| Layer           | What it tests                            | Tools        | Mocking    |
| --------------- | ---------------------------------------- | ------------ | ---------- |
| Unit            | URL building, state logic, token parsing | Vitest       | None       |
| Integration     | Full callback flow, storage              | Vitest + MSW | HTTP calls |
| Error scenarios | Provider errors, CSRF attacks, timeouts  | Vitest + MSW | HTTP calls |
| Refresh         | Time-based token refresh                 | Vitest + MSW | HTTP calls |

This approach gives high confidence without browser automation complexity or real
provider dependencies. Tests are fast, deterministic, and run in CI without special
setup.
