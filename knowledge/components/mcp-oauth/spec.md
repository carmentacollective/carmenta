# MCP OAuth Implementation

OAuth 2.1 authentication for MCP (Model Context Protocol) servers, enabling Carmenta to
connect to remote MCP servers that require authorization. This spec covers both acting
as an OAuth client (connecting to external MCP servers) and leveraging mcp-hubby's
existing OAuth infrastructure.

**Related**: See service-connectivity.md for native integration OAuth patterns. See
external-tools.md for MCP ecosystem strategy.

---

## Why This Matters

MCP is becoming the standard for AI tool integrations. Anthropic donated it to the Linux
Foundation in December 2025, signaling industry-wide adoption. The June 2025 spec update
mandated OAuth 2.1 as the authorization standard, requiring all MCP servers to act as
OAuth resource servers.

The problem: users can't connect to OAuth-protected MCP servers without manual token
management. Every competitor is racing to solve this:

- **LibreChat** shipped MCP OAuth in their UI (December 2025), handling the full OAuth
  dance in-browser with per-user token storage
- **Open WebUI** supports OAuth 2.1 with PKCE and Dynamic Client Registration, plus
  server-side encrypted token storage with automatic refresh

We have a strategic advantage: mcp-hubby already implements comprehensive OAuth 2.1
flows for 23+ services. Carmenta can leverage this infrastructure rather than building
from scratch.

## User Stories

**Connecting to an OAuth-protected MCP server:**

> As a Carmenta user, when I add an MCP server URL that requires authentication, I want
> to complete OAuth authorization in my browser and have Carmenta remember my tokens so
> I don't have to re-authenticate on every use.

**Token refresh without interruption:**

> As a user working with MCP tools mid-conversation, I want Carmenta to automatically
> refresh my tokens when they expire so my workflow isn't interrupted with "please
> re-authorize" messages.

**Multi-account MCP access:**

> As a user with multiple accounts on the same MCP service (work GitHub, personal
> GitHub), I want to connect both and choose which account to use for different tasks.

**Using mcp-hubby services:**

> As a Carmenta user, I want access to all the integrations available through mcp-hubby
> (Notion, Gmail, Slack, GitHub, etc.) without setting them up separately in Carmenta.

## Architecture Overview

Carmenta operates as an MCP client that connects to remote MCP servers. When those
servers require OAuth, Carmenta must:

1. **Discover** - Detect that the server requires authorization
2. **Authorize** - Guide the user through the OAuth flow
3. **Store** - Securely persist tokens
4. **Use** - Include tokens in MCP requests
5. **Refresh** - Automatically renew expired tokens

The architecture leverages two authentication paths:

**Path A: Native MCP OAuth** - For third-party MCP servers that implement the MCP OAuth
spec directly. Carmenta acts as an OAuth client to these servers.

**Path B: mcp-hubby Integration** - For services already connected through mcp-hubby.
Carmenta authenticates to mcp-hubby (which already has user tokens for Notion, Slack,
etc.) and routes requests through its gateway.

## OAuth Flow (MCP 2025-06-18 Specification)

The MCP specification defines a clear OAuth 2.1 flow based on RFC standards.

### Discovery Phase

When Carmenta connects to an MCP server requiring auth:

1. Server returns HTTP 401 with `WWW-Authenticate` header containing a
   `resource_metadata` URL
2. Carmenta fetches the Protected Resource Metadata (RFC 9728) from that URL
3. The metadata includes `authorization_servers` - where to get tokens
4. Carmenta fetches Authorization Server Metadata (RFC 8414) from the AS
5. Metadata reveals endpoints: `authorization_endpoint`, `token_endpoint`,
   `registration_endpoint`

### Authorization Phase

1. **Dynamic Client Registration** (if no client_id): POST to `registration_endpoint`
   with client metadata. Server returns `client_id` and optionally `client_secret`.

2. **Authorization Request**: Redirect user to `authorization_endpoint` with:
   - `response_type=code`
   - `client_id`
   - `redirect_uri` (Carmenta's callback URL)
   - `scope` (typically `mcp:access`)
   - `state` (CSRF protection)
   - `code_challenge` and `code_challenge_method=S256` (PKCE, required by OAuth 2.1)
   - `resource` parameter (RFC 8707) specifying the MCP server URL

3. **User Authorization**: User authenticates with the authorization server and grants
   consent

4. **Callback Handling**: User redirected to Carmenta's callback URL with authorization
   `code`

5. **Token Exchange**: POST to `token_endpoint` with:
   - `grant_type=authorization_code`
   - `code`
   - `redirect_uri`
   - `code_verifier` (PKCE)
   - Client authentication (Basic auth or post body)

6. **Token Response**: Receive `access_token`, `refresh_token`, `expires_in`, `scope`

### Access Phase

Include the access token in MCP requests:

```
Authorization: Bearer <access_token>
```

When the token expires, use the refresh token to obtain a new access token without user
interaction.

## Token Management

### Storage Requirements

Tokens must be stored encrypted with the same security as other credentials:

- **Encryption**: AES-256-GCM (consistent with existing credential storage)
- **Encryption key**: Environment variable, separate from database
- **Per-user isolation**: Each user's tokens stored separately
- **Per-server tracking**: Link tokens to specific MCP server URLs

**Token record structure:**

- User identifier
- MCP server URL (the resource)
- Authorization server URL (the issuer)
- Access token (encrypted)
- Refresh token (encrypted)
- Token expiry timestamp
- Scopes granted
- Dynamic client registration data (client_id, client_secret if issued)
- Last used timestamp
- Status (active, expired, revoked)

### Token Refresh Strategy

Proactive refresh to avoid request failures:

1. Check token expiry before each MCP request
2. If expires within 5 minutes, trigger refresh
3. Use refresh token to obtain new access token
4. Update stored tokens atomically
5. If refresh fails, mark status as "needs_reauthentication"

### Revocation Handling

When the authorization server revokes tokens (user disconnected app, admin action):

1. MCP server returns 401 with appropriate error
2. Carmenta attempts token refresh
3. If refresh fails with `invalid_grant`, mark connection as "needs_attention"
4. Surface to user: "Your [Service] connection needs to be reconnected"

## Multi-Node Considerations

Carmenta will eventually run across multiple server instances. Token management must
handle this:

### Token Storage: Database, Not Redis

Store tokens in PostgreSQL, not Redis. Reasoning:

- Tokens are long-lived (hours to days) - not a caching use case
- Need durability guarantees - Redis persistence is complex
- Already have encrypted credential storage patterns in the database
- Refresh operations are infrequent - database latency acceptable

### Refresh Token Race Conditions

When multiple requests simultaneously detect an expired token:

**Option A: Database-level locking** - Use SELECT FOR UPDATE when reading tokens, lock
during refresh, release after update. Prevents duplicate refresh attempts.

**Option B: Optimistic concurrency** - Allow simultaneous refresh attempts, use database
constraints to ensure only one succeeds, others retry with the new token.

**Recommendation**: Option A (database locking) is simpler and token refresh is
infrequent enough that lock contention won't be a bottleneck.

### Session Affinity Not Required

Stateless design: any server instance can handle any request because tokens live in the
shared database. No sticky sessions needed.

## UX Patterns

### Adding an OAuth-Protected MCP Server

1. User enters MCP server URL in settings
2. Carmenta attempts connection, receives 401
3. Display: "[Server Name] requires authorization. Connect your account to use these
   tools."
4. User clicks "Connect"
5. Browser opens OAuth authorization page
6. After authorization, browser redirects to Carmenta callback
7. Carmenta completes token exchange
8. Success: "Connected to [Server Name]" - show available tools
9. Failure: Clear error with "Try Again" option

### Re-Authorization Prompts

When a connection needs re-authorization (token revoked, scopes changed):

1. Mark integration as "needs attention" in settings
2. When user attempts to use a tool from that server: "[Server] connection expired.
   Reconnect to continue."
3. Quick reconnect flow - ideally one click to start OAuth

### Dynamic Detection vs. Manual Configuration

**Preferred: Dynamic detection**

1. User enters just the MCP server URL
2. Carmenta discovers OAuth requirements automatically
3. Initiates appropriate flow

**Fallback: Manual configuration**

For servers with non-standard OAuth or discovery issues:

1. User enters MCP server URL
2. User provides OAuth configuration manually:
   - Authorization endpoint
   - Token endpoint
   - Client ID (if pre-registered)
   - Scopes

Most users should never need manual configuration if servers follow the MCP spec.

## Integration with mcp-hubby

Carmenta has a strategic advantage: mcp-hubby already handles OAuth for 23+ services.
Rather than duplicating this infrastructure, Carmenta should leverage it.

### How mcp-hubby Works

mcp-hubby is an MCP gateway that:

1. Exposes a single MCP endpoint with one tool per connected service
2. Handles OAuth flows for each service (Notion, Gmail, Slack, GitHub, etc.)
3. Uses Nango for OAuth token management and refresh
4. Stores encrypted API keys for non-OAuth services
5. Routes MCP tool calls to the appropriate service adapter

### Carmenta + mcp-hubby Architecture

**Authentication flow:**

1. User signs into Carmenta (existing auth)
2. User connects mcp-hubby account (OAuth or mcp-hubby token)
3. Carmenta becomes an MCP client to mcp-hubby
4. mcp-hubby handles per-service OAuth (Notion, Slack, etc.)
5. User manages individual service connections through mcp-hubby's UI or Carmenta's UI

**Benefits:**

- Immediate access to 23+ integrations without building each OAuth flow
- Token refresh handled by mcp-hubby, not Carmenta
- Progressive disclosure pattern reduces context window usage
- Single MCP connection gives access to many services

**Considerations:**

- Dependency on mcp-hubby availability
- User needs accounts in both systems (until unified)
- May want to migrate native integrations to mcp-hubby pattern

### Unified Token Management

Future state: Carmenta and mcp-hubby share a user database, eliminating duplicate OAuth.
User connects a service once, usable from both interfaces.

This requires:

- Shared user identity (Clerk integration already exists in mcp-hubby)
- Shared connection/credential storage
- Carmenta calling mcp-hubby APIs directly (not just MCP protocol)

## Security Considerations

### PKCE (Proof Key for Code Exchange)

Required by OAuth 2.1 and the MCP spec. Protects against authorization code interception
attacks.

1. Generate cryptographically random `code_verifier` (43-128 characters)
2. Create `code_challenge` = base64url(SHA256(code_verifier))
3. Send `code_challenge` with authorization request
4. Send `code_verifier` with token exchange
5. Authorization server verifies the relationship

### Resource Indicators (RFC 8707)

The June 2025 MCP spec requires Resource Indicators to prevent token confusion attacks.

1. Include `resource` parameter in authorization request with MCP server URL
2. Authorization server issues token scoped to that specific resource
3. Token cannot be reused against other MCP servers

### No Token Pass-Through

The MCP spec explicitly prohibits passing client tokens to upstream APIs. When an MCP
server needs to call external services, it must use its own credentials for those
services - not relay the token it received from the MCP client.

This protects against "confused deputy" attacks where a malicious MCP server could use
your tokens to access other services.

### State Parameter

Generate cryptographically random `state` for each OAuth flow. Verify on callback to
prevent CSRF attacks.

### Secure Token Storage

Same security posture as existing credentials:

- AES-256-GCM encryption
- Encryption key from environment (not in codebase)
- Separate from database secrets
- No plaintext tokens in logs
- Tokens never sent to client-side code

### Client Secret Handling

For dynamically registered clients:

- Store `client_secret` encrypted alongside tokens
- `client_secret` may have expiration (`client_secret_expires_at`)
- Re-register if secret expires

For pre-registered clients:

- `client_id` and `client_secret` in environment variables
- Never expose in client-side code

## Open Questions

### OAuth Callback URL Architecture

Where does Carmenta's OAuth callback live?

- **Option A**: `/api/oauth/callback` - single callback, server identified by state
- **Option B**: `/api/oauth/[server-id]/callback` - per-server callbacks
- **Option C**: `/api/mcp/oauth/callback` - MCP-specific namespace

Need to consider: Dynamic Client Registration requires knowing the callback URL in
advance. If we use Option B, we need stable server identifiers before registration.

### mcp-hubby Integration Depth

How deeply should Carmenta integrate with mcp-hubby?

- **Option A: MCP client only** - Carmenta connects to mcp-hubby via MCP protocol, like
  any other MCP server. Simplest but requires users to manage mcp-hubby separately.

- **Option B: Shared UI** - Carmenta UI can initiate mcp-hubby OAuth flows. Users manage
  connections from either interface.

- **Option C: Full unification** - Single user database, shared credentials. Carmenta IS
  mcp-hubby for users who want it.

Current recommendation: Start with Option A, evolve toward Option C.

### Token Storage Location

Should MCP OAuth tokens live in:

- **Option A**: Existing `integrations` table (add `mcpServerUrl` column)
- **Option B**: New `mcp_connections` table (cleaner separation)
- **Option C**: Extend mcp-hubby's schema (if going unified route)

Depends on mcp-hubby integration decision.

### Scope Granularity for MCP

MCP defines `mcp:access` as the default scope. Should we request additional scopes?

Some MCP servers might support:

- `mcp:read` - read-only tool access
- `mcp:write` - tools that modify data
- `mcp:admin` - administrative operations

Need to understand what scopes MCP servers actually implement before designing UI around
scope selection.

### Error Recovery in Conversation

When OAuth expires mid-conversation:

- Should Carmenta automatically start re-auth flow?
- Should we preserve the pending action and resume after auth?
- How do we avoid losing conversation context?

LibreChat handles this by showing an "Authenticate" button inline. We could do similar.

---

## Sources

MCP Specification:

- [MCP Authorization Specification](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [MCP Spec Updates June 2025](https://auth0.com/blog/mcp-specs-update-all-about-auth/)
- [Understanding OAuth 2.1 for MCP Servers](https://www.marktechpost.com/2025/08/31/understanding-oauth-2-1-for-mcp-model-context-protocol-servers-discovery-authorization-and-access-phases/)
- [MCP Authentication Guide](https://stytch.com/blog/MCP-authentication-and-authorization-guide/)
- [Diving Into MCP Authorization Specification](https://www.descope.com/blog/post/mcp-auth-spec)

Competitor Implementations:

- [LibreChat MCP OAuth Architecture Discussion](https://github.com/danny-avila/LibreChat/discussions/8811)
- [LibreChat MCP Servers Configuration](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/mcp_servers)
- [Open WebUI Native MCP Integration](https://github.com/open-webui/open-webui/discussions/16238)
- [Open WebUI MCP Documentation](https://docs.openwebui.com/features/mcp/)
- [MCPO - MCP to OpenAPI Proxy](https://github.com/open-webui/mcpo)

OAuth Best Practices:

- [Building Scalable Auth with Redis and Database Storage](https://dev.to/harmanpreetsingh/building-scalable-authentication-the-smart-way-to-handle-tokens-with-redis-and-database-storage-1lcf)
- [OAuth 2.0 Refresh Token Best Practices](https://stateful.com/blog/oauth-refresh-token-best-practices)
- [Refresh Token Rotation Best Practices](https://www.serverion.com/uncategorized/refresh-token-rotation-best-practices-for-developers/)

FastMCP OAuth Issues:

- [FastMCP OAuth 2.1 Authorization Issue](https://github.com/jlowin/fastmcp/issues/825)
- [FastMCP OAuth Compatibility Issues](https://github.com/jlowin/fastmcp/issues/972)

OAuth RFCs:

- RFC 6749 - OAuth 2.0 Authorization Framework
- RFC 7591 - Dynamic Client Registration
- RFC 7636 - PKCE
- RFC 8414 - Authorization Server Metadata
- RFC 8707 - Resource Indicators
- RFC 9728 - Protected Resource Metadata
