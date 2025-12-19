---
description: Create a new external service integration
---

# Add Integration Command

`/add-integration <service-name>`

<objective>
Build a complete, tested service integration with excellent user experience. Study
existing adapters, research the target API, and follow established patterns. The
integration should feel delightful to use - tool results are intermediate data the AI
processes; users care about the synthesized response, not raw API dumps.
</objective>

<critical-lessons>
You're building high-value AI tools that return synthesis-ready data.

What makes an excellent integration:

- Returns rich content (summaries, full text) so the AI synthesizes in one call
- Provides convenience methods for common AI workflows (search by topic, list recent)
- Tool guidance steers AI toward efficient patterns
- Default limit: 10 results with summaries included

Design for the AI's workflow. Ask: "What does the AI need to answer a user's question in
one call?" Return summaries/content inline so the AI synthesizes immediately.

Before writing any code:

1. Read the official API documentation thoroughly
2. Look for search/filter capabilities - most APIs have them
3. Check what fields are returned in list/search responses
4. Identify which endpoints return rich data ready for synthesis
5. Find the highest-value convenience methods

Verify API capabilities against official docs. The Fireflies adapter originally did
client-side search filtering because a code comment claimed the API lacked server-side
search. The API actually had `keyword` and `scope` parameters for full-text search all
along.

Quality checklist:

- Search queries full content (transcripts, bodies), not just titles/metadata
- List/search results include enough data for AI to synthesize without fetching each
  item
- Tool guidance tells the AI which operations to prefer and why
- Defaults are sensible (10 results with summaries included)
- Answering "What did I discuss about X?" requires 1 call

Compare your adapter against `lib/integrations/adapters/limitless.ts` - that's the gold
standard for AI-first design. </critical-lessons>

<definition-of-done>
Use TodoWrite to track progress. An integration includes:

- [ ] API research completed (read official docs, verified search/filter capabilities,
      identified high-value endpoints)
- [ ] Service adapter with operations that return synthesis-ready data
- [ ] Tool guidance that steers AI toward efficient patterns
- [ ] Service registry entry
- [ ] Adapter exported and registered in tools.ts
- [ ] Tool configuration added to lib/tools/tool-config.ts
- [ ] Tool UI component for displaying results
- [ ] ToolPartRenderer case added
- [ ] Service logo
- [ ] Unit tests
- [ ] Quality checks pass

For OAuth services:

- [ ] fetchAccountInfo() method implemented in adapter
- [ ] Service registered in lib/integrations/fetch-account-info.ts</definition-of-done>

<context>
Carmenta uses two authentication patterns:

**OAuth services** (Notion, ClickUp, Slack, etc.): In-house OAuth implementation handles
token exchange, storage, and refresh. Adapter receives `accessToken` from
`getCredentials()`. OAuth infrastructure already exists - you only need to add the
service adapter and configure the OAuth provider.

**API key services** (Giphy, Fireflies, Limitless): Direct API calls with encrypted
credentials. Adapter uses decrypted `credentials.apiKey` from `getCredentials()`.

All service metadata lives in `lib/integrations/services.ts` SERVICE_REGISTRY. Adapters
extend `ServiceAdapter` base class and implement `getHelp()`, `execute()`, and
`executeRawAPI()`. </context>

<tool-ui-philosophy>
Tool results are intermediate data the AI processes. Users care about the AI's
synthesized response, not raw API output. Tool UI components show minimal status: what
happened, with optional expansion for debugging.

Design principles:

- Compact one-line status for success states ("Loaded 10 recordings", "Found 3 tasks")
- Loading states show action in progress ("Searching...", "Fetching tasks...")
- Error states are clear but not alarming
- Optional JSON expansion for debugging (collapsed by default)
- Let the AI's response do the heavy lifting - the UI just confirms the tool worked

Reference `components/generative-ui/limitless.tsx` for the pattern to follow.
</tool-ui-philosophy>

<oauth-infrastructure>
For OAuth services, the in-house OAuth infrastructure is already built:

**OAuth Flow** (`lib/integrations/oauth/`):

- Handles authorization URL generation with state/PKCE
- Token exchange after callback
- Encrypted token storage in database
- Automatic token refresh before expiry
- Provider configs for each OAuth service

**OAuth Callback** (`app/integrations/oauth/callback/route.ts`):

- Receives OAuth callback from provider at `/integrations/oauth/callback`
- Validates state to prevent CSRF attacks
- Exchanges auth code for tokens
- Stores encrypted tokens and fetches account info
- Generic implementation works for all OAuth services

**Connection Page** (`app/connect/[service]/page.tsx`):

- Initiates OAuth flow when user clicks "Connect" for a service
- Generates authorization URL with proper scopes
- Handles CSRF protection with state tokens
- Works automatically for any service with `authMethod: "oauth"`

**Frontend Integration** (`app/integrations/page.tsx`):

- OAuth connection flow already wired up
- Works automatically for any service with `authMethod: "oauth"`

To add a new OAuth service: create the OAuth provider config in
`lib/integrations/oauth/providers.ts`, create the adapter with `fetchAccountInfo()`
method, and the rest works automatically. </oauth-infrastructure>

<reference-files>
Study these files to understand patterns:
- `lib/integrations/adapters/limitless.ts` - API key adapter with rich tool guidance
- `lib/integrations/adapters/clickup.ts` - OAuth adapter with fetchAccountInfo
- `lib/integrations/adapters/notion.ts` - OAuth adapter example
- `lib/integrations/adapters/giphy.ts` - Simple API key adapter
- `components/generative-ui/limitless.tsx` - Tool UI component pattern
- `components/connection/holo-thread.tsx` - ToolPartRenderer (add case here)
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
   - Tool guidance in `getHelp()` that steers AI toward efficient usage patterns

2. **Service registry entry** in `lib/integrations/services.ts`
   - Start with `status: "coming_soon"` until tested
   - Include capabilities array for tool descriptions
   - Set `authMethod: "oauth"` or `authMethod: "api_key"`

3. **System registration**
   - Export adapter from `lib/integrations/adapters/index.ts`
   - Add to adapterMap in `lib/integrations/tools.ts`
   - For OAuth: add service case in `lib/integrations/fetch-account-info.ts`
   - For OAuth: add service mapping in `app/api/connect/route.ts` if key differs

4. **Tool configuration** in `lib/tools/tool-config.ts`
   - Add entry to TOOL_CONFIG with display name, icon, and status messages
   - Import appropriate Lucide icon (Mic2 for audio, Database for data, etc.)
   - Include delight messages for warmth and engagement

5. **Tool UI component** at `components/generative-ui/[service].tsx`
   - Follow the compact status display pattern from limitless.tsx
   - Handle loading, error, and success states
   - Generate human-readable status messages per action
   - Optional JSON expansion for debugging

6. **ToolPartRenderer case** in `components/connection/holo-thread.tsx`
   - Add case in the switch statement matching the service name
   - Import and render the tool UI component

7. **Service logo** at `public/logos/[service].svg`

8. **Unit tests** at `__tests__/unit/lib/integrations/adapters/[service].test.ts`
   - Use existing adapter tests as templates (giphy, limitless, coinmarketcap)

9. **Integration tests** (if adding connection-manager features)
   - Add test fixtures to `__tests__/fixtures/integration-fixtures.ts` if needed
   - Test credential retrieval patterns if adding new auth types
   - Follow patterns in `__tests__/integration/lib/integrations/` </deliverables>

<tool-ui-pattern>
Create a compact status display component following this structure:

```typescript
"use client";

import { useState } from "react";
import { ServiceIcon, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { ToolStatus } from "@/lib/tools/tool-config";

interface ServiceToolResultProps {
    toolCallId: string;
    status: ToolStatus;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
}

export function ServiceToolResult({
    status,
    action,
    input,
    output,
    error,
}: ServiceToolResultProps) {
    const [expanded, setExpanded] = useState(false);

    // Loading state - single line with pulse animation
    if (status === "running") {
        return (
            <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                <ServiceIcon className="h-3.5 w-3.5 animate-pulse" />
                <span>{getStatusMessage(action, input, "running")}</span>
            </div>
        );
    }

    // Error state - red text, clear message
    if (status === "error" || error) {
        return (
            <div className="flex items-center gap-2 py-1 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{error || `Service ${action} failed`}</span>
            </div>
        );
    }

    // Success - compact summary with optional JSON expansion
    const summary = getStatusMessage(action, input, "completed", output);

    return (
        <div className="py-1">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex w-full items-center gap-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
                <ServiceIcon className="h-3.5 w-3.5 text-primary/70" />
                <span className="flex-1">{summary}</span>
                {output && (expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
            </button>

            {expanded && output && (
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/30 p-2 text-xs text-muted-foreground">
                    {JSON.stringify(output, null, 2)}
                </pre>
            )}
        </div>
    );
}

function getStatusMessage(
    action: string,
    input: Record<string, unknown>,
    status: "running" | "completed",
    output?: Record<string, unknown>
): string {
    const isRunning = status === "running";

    switch (action) {
        case "list_items": {
            if (isRunning) return "Loading items...";
            const count = (output?.items as unknown[])?.length ?? 0;
            return `Loaded ${count} items`;
        }
        case "search": {
            const query = input.query as string;
            if (isRunning) return `Searching "${query}"...`;
            const count = (output?.results as unknown[])?.length ?? 0;
            return `Found ${count} results for "${query}"`;
        }
        case "get_item": {
            if (isRunning) return "Loading details...";
            const title = output?.title as string;
            return title ? `Loaded: ${truncate(title, 50)}` : "Loaded item";
        }
        case "create_item":
            return isRunning ? "Creating..." : "Created successfully";
        case "update_item":
            return isRunning ? "Updating..." : "Updated successfully";
        case "delete_item":
            return isRunning ? "Deleting..." : "Deleted";
        default:
            return isRunning ? `Running ${action}...` : `Completed ${action}`;
    }
}

function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + "…";
}
```

Adapt the `getStatusMessage` function for your service's specific actions. The pattern
stays the same: running state with "...", completed state with result summary.
</tool-ui-pattern>

<tool-part-renderer-case>
Add to the switch statement in `components/connection/holo-thread.tsx`:

```typescript
case "your-service":
    return (
        <YourServiceToolResult
            toolCallId={part.toolCallId}
            status={status}
            action={(input?.action as string) ?? "unknown"}
            input={input}
            output={output}
            error={getToolError(part, output, "Service request failed")}
        />
    );
```

Import the component at the top of the file with other generative-ui imports.
</tool-part-renderer-case>

<adapter-tool-guidance>
Write tool descriptions that guide the AI toward efficient usage. Example from Limitless:

```typescript
getHelp(): HelpResponse {
    return {
        service: this.serviceDisplayName,
        description:
            "Access conversations recorded by Limitless Pendant. " +
            "IMPORTANT: Use 'search' for topic-based queries (what did I discuss about X?). " +
            "Use 'list_recordings' with date filter for time-based queries (what did I talk about yesterday?). " +
            "Both return summaries - only use get_lifelog if you need the full transcript.",
        commonOperations: ["search", "list_recordings"],
        operations: [
            {
                name: "search",
                description:
                    "Primary action for finding conversations by topic. Returns summaries - no need to fetch each recording.",
                // ... parameters
                returns: "Lifelogs with summaries. Synthesize from these - don't fetch each individually.",
            },
            // ...
        ],
    };
}
```

Key principles:

- Tell the AI which operations to prefer and why
- Note when results include enough data for synthesis
- Warn against inefficient patterns (fetching each item individually)
- Use sensible defaults (10 results instead of 50) </adapter-tool-guidance>

<minimum-test-coverage>
Tests cover:
- Service configuration and help documentation
- Connection validation (success and failure)
- Each operation (success and error paths)
- Auth errors, invalid inputs, API failures

Reference existing adapter tests (giphy, limitless, coinmarketcap) for patterns.
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
  env: { NEXT_PUBLIC_APP_URL: "https://carmenta.ai" },
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

**Gotchas:**

- Mock HTTP responses must match actual API response structure exactly
- Use `as never` type assertion for mocked httpClient returns
- Limit/offset params become strings (adapters stringify numbers) </testing-guide>

<quality-checks>
Type-check, lint, build, and tests pass before marking complete.
</quality-checks>

<user-setup-instructions>
After code is complete, provide manual setup instructions:

For OAuth services:

1. **OAuth Provider Setup:**
   - Where to create OAuth app (e.g., ClickUp App Directory, Notion Integrations)
   - OAuth settings to configure
   - Redirect URI: `https://yourdomain.com/integrations/oauth/callback`
   - Scopes required for adapter operations

2. **OAuth Provider Configuration:**
   - Add provider config to `lib/integrations/oauth/providers.ts`
   - Configure authorization URL, token URL, and scopes
   - Include required OAuth parameters (e.g., response_type, grant_type)

3. **Environment Variables:**
   - Add to `.env.local`: `[SERVICE]_CLIENT_ID`, `[SERVICE]_CLIENT_SECRET`
   - Add to `.env.example` with documentation

For API key services:

- Where to get an API key from the service
- How to connect via `/integrations` page
- Any required API key permissions or scopes </user-setup-instructions>
