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
