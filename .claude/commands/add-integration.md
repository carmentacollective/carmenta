---
description: Create a new service integration for Carmenta
---

# Add Integration Command

Build a new service integration for Carmenta's external connectivity system.

## Arguments

`/add-integration <service-name>`

Example: `/add-integration spotify` or `/add-integration jira`

## Mission

Add a new service integration to Carmenta. This is a **collaborative process**: we
handle the code (adapter, service registry, UI), then guide through manual setup (API
key or OAuth configuration).

## Key Context

**Architecture Overview:**

- `lib/integrations/services.ts` - SERVICE_REGISTRY with all service definitions
- `lib/integrations/adapters/*.ts` - ServiceAdapter implementations per service
- `lib/integrations/tools.ts` - Vercel AI SDK tool factory (auto-registers adapters)
- `app/integrations/page.tsx` - UI for managing connections

**Authentication Methods:**

- **API Key services** (Giphy, Limitless, Fireflies): Users enter key in UI, encrypted
  and stored
- **OAuth services** (Notion, ClickUp): Use Nango.dev for token management

**Progressive Disclosure Pattern:**

Each service exposes ONE tool to the LLM:

- `action='describe'` returns full documentation
- Other actions perform operations
- ~95% token reduction vs separate tools per operation

## Reference Implementations

Study existing adapters to understand patterns:

**API Key service:** `lib/integrations/adapters/giphy.ts`

- Simple API key authentication
- Direct HTTP calls with native fetch
- Error handling patterns

**OAuth service:** `lib/integrations/adapters/notion.ts`

- Uses `nangoProxyRequest` for API calls
- `makeRequest` helper pattern
- Connection ID passed to Nango

## What to Build

### 1. Service Registry Entry (`lib/integrations/services.ts`)

Add to SERVICE_REGISTRY:

```typescript
{
    id: "spotify",
    name: "Spotify",
    description: "Music streaming and playback control",
    logo: "/logos/spotify.svg",
    authMethod: "oauth", // or "api_key"
    status: "beta", // ALWAYS use "beta" for new integrations
    capabilities: ["search", "playlists", "playback", "recommendations"],

    // For API key services:
    getApiKeyUrl: "https://developer.spotify.com/dashboard",
    apiKeyPlaceholder: "Your Spotify API key",

    // For OAuth services:
    nangoIntegrationKey: "spotify",

    // Optional:
    docsUrl: "https://developer.spotify.com/documentation/web-api",
}
```

**Status Values:**

- `beta` - Visible only to admins (always use for new integrations)
- `available` - Visible to all users
- `coming_soon` - Shown but not connectable
- `internal` - Hidden from UI

### 2. Service Adapter (`lib/integrations/adapters/[service].ts`)

Create adapter extending ServiceAdapter:

```typescript
import { ServiceAdapter } from "./base";
import { getCredentials, nangoProxyRequest } from "../connection-manager";
import type { HelpResponse, AdapterResponse, RawAPIParams } from "../types";

export class SpotifyAdapter extends ServiceAdapter {
  serviceName = "spotify";
  serviceDisplayName = "Spotify";

  getHelp(): HelpResponse {
    return {
      service: this.serviceDisplayName,
      description: "Music streaming service",
      commonOperations: ["search", "get_playlists", "play"],
      operations: [
        {
          name: "search",
          description: "Search for tracks, albums, or artists",
          annotations: { readOnlyHint: true },
          parameters: [
            {
              name: "query",
              type: "string",
              required: true,
              description: "Search query",
              example: "bohemian rhapsody",
            },
          ],
          returns: "Array of search results",
          example: `search({ query: "bohemian rhapsody" })`,
        },
        // ... more operations
        {
          name: "raw_api",
          description: "Direct API access for operations not listed above",
          parameters: [
            { name: "endpoint", type: "string", required: true },
            { name: "method", type: "string", required: true },
            { name: "body", type: "object", required: false },
          ],
          returns: "Raw API response",
        },
      ],
      docsUrl: "https://developer.spotify.com/documentation/web-api",
    };
  }

  async execute(
    action: string,
    params: unknown,
    userId: string,
    _accountId?: string
  ): Promise<AdapterResponse> {
    // Validate and route to handlers
    // See existing adapters for patterns
  }
}
```

### 3. Register Adapter

**`lib/integrations/adapters/index.ts`:**

```typescript
export { SpotifyAdapter } from "./spotify";
```

**`lib/integrations/tools.ts` - adapterMap:**

```typescript
const adapterMap: Record<string, ServiceAdapter> = {
  // ... existing
  spotify: new SpotifyAdapter(),
};
```

**`lib/integrations/index.ts`:**

```typescript
export { SpotifyAdapter } from "./adapters";
```

### 4. Service Logo

Add logo to `public/logos/[service].svg`

Requirements:

- SVG format
- Square icon (no text)
- Official service colors
- ~64x64 viewBox recommended

## Operations to Implement

Choose 4-12 core operations based on:

- What AI agents would actually use
- Common user workflows
- Read (list, search, get) + Write (create, update) coverage

**Naming Convention:**

- Use `{verb}_{resource}` pattern
- Match the service's API terminology
- Examples: `list_messages`, `create_task`, `search_tracks`

## Quality Checks

Before committing:

```bash
# Type check
npx tsc --noEmit

# Lint
bun run lint

# Tests (if added)
bun test
```

## Git Workflow

1. Create branch: `git checkout -b feature/[service]-integration`
2. Commit with emoji: `✨ Add [Service] integration`
3. Push and create PR
4. Test through UI at `/integrations`

## Post-Implementation

After code is complete, provide setup instructions:

**For API Key services:**

1. Direct user to service's API key page
2. Have them enter key in Carmenta UI
3. Test through chat interface

**For OAuth services:**

1. Set up OAuth app in service
2. Configure in Nango dashboard
3. Test OAuth flow through Carmenta UI

## Completion Report

```
✅ [Service] Integration Complete!

**What was built:**
- [Service]Adapter with [N] operations
- Service registry entry (status: beta)
- Logo added

**Your next steps:**
1. [Get API key from X / Create OAuth app at Y]
2. Connect through /integrations
3. Test via chat: "Search for X on [service]"
4. Change status to "available" when ready for users

Let me know if you need help with setup!
```
