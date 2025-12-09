---
description: Create a new external service integration
---

# Add Integration Command

`/add-integration <service-name>`

<objective>
Build a complete service integration that works with Carmenta's chat interface. Study existing adapters, research the target service's API, and create an adapter that follows established patterns.
</objective>

<context>
Carmenta uses two authentication patterns:

**OAuth services** (Notion, ClickUp): Nango handles OAuth flow and proxied API calls.
Adapter uses `connectionId` from `getCredentials()`.

**API key services** (Giphy, Fireflies, Limitless): Direct API calls with encrypted
credentials. Adapter uses decrypted `credentials.apiKey` from `getCredentials()`.

All service metadata lives in `lib/integrations/services.ts` SERVICE_REGISTRY. Adapters
extend `ServiceAdapter` base class and implement `getHelp()`, `execute()`, and
`executeRawAPI()`. </context>

<reference-files>
Study these files to understand patterns:
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
   - Includes comprehensive error handling

2. **Service registry entry** in `lib/integrations/services.ts`
   - Start with `status: "coming_soon"` until tested
   - Include capabilities array for tool descriptions

3. **System registration**
   - Export adapter from `lib/integrations/adapters/index.ts`
   - Add to adapterMap in `lib/integrations/tools.ts`

4. **Service logo** at `public/logos/[service].svg` </deliverables>

<quality-checks>
Before committing:
- `bun run type-check` passes
- `bun run lint` passes
- `bun run build` succeeds
</quality-checks>

<user-setup-instructions>
After code is complete, provide manual setup instructions:

For OAuth services:

- Where to create OAuth app and what settings to use
- Nango dashboard configuration steps
- Redirect URI: `https://api.nango.dev/oauth/callback`

For API key services:

- Where to get an API key from the service
- How to connect via `/integrations` page </user-setup-instructions>
