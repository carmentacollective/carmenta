# MCP OAuth Implementation

OAuth 2.1 authentication for MCP (Model Context Protocol) servers, enabling Carmenta to
connect to remote MCP servers that require authorization. This spec covers the complete
auth lifecycle: discovery, authorization, token management, and UX patterns for
surfacing connection states.

**Related**: See service-connectivity.md for native integration OAuth patterns. See
external-tools.md for MCP ecosystem strategy. See mcp-configuration.md for the
configuration agent.

---

## Why This Matters

MCP is the standard for AI tool integrations. The June 2025 spec update mandated OAuth
2.1 as the authorization standard, requiring all MCP servers to act as OAuth resource
servers. The March 2025 update deprecated SSE transport in favor of Streamable HTTP.

The problem: users can't connect to OAuth-protected MCP servers without manual token
management. Competitors have made progress:

- **LibreChat** (December 2025): Most advanced implementation with dynamic status icons,
  in-browser OAuth, MCPConfigDialog for auth flows, and inline authentication prompts
- **Open WebUI**: OAuth 2.1 with PKCE and Dynamic Client Registration, server-side
  encrypted token storage with automatic refresh
- **Cursor**: One-click OAuth for curated servers, JSON config for custom servers
- **Claude Desktop/Code**: Known reconnection bug after OAuth requires app restart
  (GitHub issue #10250)

Carmenta's advantage: mcp-hubby already implements comprehensive OAuth 2.1 flows for 23+
services. We leverage this infrastructure rather than building from scratch, plus our
configuration agent handles the complexity users shouldn't see.

## Transport: SSE Deprecation → Streamable HTTP

**Status**: SSE transport officially deprecated as of MCP specification 2025-03-26.

### Why SSE Was Deprecated

The old SSE transport had fundamental issues:

- **Connection reliability**: Responses lost if SSE connection dropped during long
  operations
- **Security blind spots**: Persistent connections only check credentials once at
  connection time
- **Token exposure**: Developers often passed access tokens in URL query strings
- **Implementation overhead**: Servers and clients needed coordination logic between
  separate connections

### What Streamable HTTP Offers

Streamable HTTP enables bidirectional communication through a single endpoint (typically
`/mcp`):

- **Per-request authentication**: Every request includes Authorization header
- **Connection independence**: No long-lived connection state to manage
- **Serverless-friendly**: Works with edge functions and serverless deployments
- **Security**: Tokens in headers, not query strings

### Backwards Compatibility

For older servers, maintain backwards compatibility:

1. Attempt Streamable HTTP connection first
2. Fall back to SSE if server doesn't support HTTP transport
3. Log deprecation warning for SSE connections
4. Surface to users: "This server uses legacy transport (SSE). It will continue working
   but may lose support in future MCP updates."

**Implementation**: Check for `/mcp` endpoint first. If 404, try `/sse` endpoint with
deprecation tracking.

## User Stories

**Connecting to an OAuth-protected MCP server:**

> As a Carmenta user, when I add an MCP server URL that requires authentication, I want
> to complete OAuth authorization in my browser and have Carmenta remember my tokens so
> I don't have to re-authenticate on every use.

**Token refresh without interruption:**

> As a user working with MCP tools mid-conversation, I want Carmenta to automatically
> refresh my tokens when they expire so my workflow isn't interrupted with "please
> re-authorize" messages.

**Visual indication of connection state:**

> As a user, I want to see at a glance which of my MCP servers are connected, which need
> attention, and which are initializing—without having to click into settings.

**In-conversation auth prompts:**

> As a user, when I try to use a tool from a server that needs authentication, I want an
> inline prompt to connect rather than a cryptic error about missing credentials.

**Multi-account MCP access:**

> As a user with multiple accounts on the same MCP service (work GitHub, personal
> GitHub), I want to connect both and choose which account to use for different tasks.

## OAuth Flow (MCP 2025-06-18 Specification)

The MCP specification defines OAuth 2.1 based on RFC standards. MCP servers act as
**OAuth Resource Servers**, not Authorization Servers.

### Discovery Phase

When Carmenta connects to an MCP server requiring auth:

1. **Initial Request**: Carmenta sends request without token
2. **401 Response**: Server returns HTTP 401 with `WWW-Authenticate` header containing
   `resource_metadata` URL
3. **Protected Resource Metadata**: Carmenta fetches
   `/.well-known/oauth-protected-resource` from the URL specified in the header
   (RFC 9728)
4. **Authorization Servers**: The metadata includes `authorization_servers` array
5. **AS Metadata**: Carmenta fetches `/.well-known/oauth-authorization-server` from the
   selected authorization server (RFC 8414)
6. **Endpoint Discovery**: Metadata reveals `authorization_endpoint`, `token_endpoint`,
   `registration_endpoint`

### Authorization Phase

1. **Dynamic Client Registration** (RFC 7591): If no client_id exists, POST to
   `registration_endpoint` with client metadata. Server returns `client_id` and
   optionally `client_secret`.

2. **PKCE Generation** (Required):
   - Generate cryptographically random `code_verifier` (43-128 characters)
   - Create `code_challenge` = base64url(SHA256(code_verifier))

3. **Authorization Request**: Redirect user to `authorization_endpoint` with:
   - `response_type=code`
   - `client_id`
   - `redirect_uri` (Carmenta's callback URL)
   - `scope` (typically `mcp:access`)
   - `state` (CSRF protection, cryptographically random)
   - `code_challenge` and `code_challenge_method=S256`
   - `resource` parameter (RFC 8707) specifying the MCP server URL

4. **User Authorization**: User authenticates with the authorization server and grants
   consent

5. **Callback Handling**: User redirected to Carmenta's callback URL with authorization
   `code`

6. **Token Exchange**: POST to `token_endpoint` with:
   - `grant_type=authorization_code`
   - `code`
   - `redirect_uri`
   - `code_verifier` (PKCE proof)
   - `resource` (RFC 8707, same as authorization request)
   - Client authentication (Basic auth or post body)

7. **Token Response**: Receive `access_token`, `refresh_token`, `expires_in`, `scope`

### Access Phase

Include the access token in **every** MCP request:

```
Authorization: Bearer <access_token>
```

Per-request auth is critical for Streamable HTTP—there's no session to maintain.

### Resource Indicators (RFC 8707)

Required by June 2025 MCP spec to prevent token confusion attacks:

**Canonical URI Format**:

- Must include scheme (https)
- No fragment component
- Lowercase scheme and host
- Valid examples: `https://mcp.example.com/mcp`, `https://mcp.example.com:8443`
- Invalid: `mcp.example.com` (no scheme), `https://mcp.example.com#frag` (fragment)

**Why Required**:

- Binds tokens to intended resource server
- Prevents token reuse across different MCP servers
- Mitigates confused deputy vulnerability
- Send `resource` parameter regardless of whether AS supports it

## Token Management

### Storage Requirements

Tokens stored encrypted with same security as other credentials:

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
- Status: `active`, `expired`, `needs_reauth`

### Proactive Token Refresh

Refresh before expiry to avoid request failures:

1. Check token expiry before each MCP request
2. If expires within 5 minutes, trigger background refresh
3. Use refresh token to obtain new access token
4. Update stored tokens atomically
5. If refresh fails with `invalid_grant`, mark status as `needs_reauth`

### Refresh Token Rotation

Per OAuth 2.1 Section 4.3.1, for public clients:

- Authorization servers MUST rotate refresh tokens
- Each refresh returns new refresh token
- Old refresh token immediately invalidated
- Store new token atomically with access token

### Revocation Handling

When the authorization server revokes tokens:

1. MCP server returns 401 with appropriate error
2. Carmenta attempts token refresh
3. If refresh fails with `invalid_grant`, mark connection as `needs_reauth`
4. Update status indicator to amber (needs attention)
5. When user attempts to use tool: inline auth prompt

## UX Patterns

### Connection Status Indicators

Display connection state visually across multiple surfaces. Pattern inspired by
LibreChat's MCPServerStatusIcon:

| State          | Icon    | Color  | Meaning                  |
| -------------- | ------- | ------ | ------------------------ |
| Connected      | Gear    | Green  | Working, ready to use    |
| Initializing   | Loader  | Blue   | Connecting/validating    |
| OAuth Required | Key     | Amber  | Needs authentication     |
| Error          | Warning | Red    | Connection failed        |
| Disconnected   | Plug    | Orange | User disabled or removed |

**Where indicators appear:**

1. **Integrations page**: Badge on MCP server cards
2. **MCP sidebar panel**: Status icon next to each server
3. **Chat composer**: Status indicator in server selection chips
4. **Tool call UI**: Status on tool responses when auth fails

### Needs Reconnect Badge on Integrations Page

When an MCP server's token expires or gets revoked:

1. Server card shows amber "Needs Reconnect" badge
2. Badge persists until user clicks Reconnect
3. Clicking badge or Reconnect button initiates OAuth flow
4. Success: badge disappears, status returns to connected

**Badge design:**

```
┌─────────────────────────────────────────────┐
│ 🔑 GitHub MCP                   [Reconnect] │
│     ⚠ Needs reconnection                    │
│     Last connected: 2 days ago              │
└─────────────────────────────────────────────┘
```

### In-Conversation Auth Modal

When user invokes a tool from an unauthenticated MCP server:

1. Tool call shows loading state
2. Detect 401 from server
3. Display inline modal (not full-page redirect):

```
┌─────────────────────────────────────────────────────┐
│  🔑 GitHub MCP needs authentication                 │
│                                                     │
│  Connect your GitHub account to use these tools.   │
│                                                     │
│  [Connect with GitHub]       [Cancel]               │
└─────────────────────────────────────────────────────┘
```

4. OAuth opens in popup or new tab (not full redirect to preserve conversation)
5. On success: automatically retry the tool call
6. On cancel: show cancellation message, user can try again

### Lazy Initialization

Don't connect to every MCP server on page load. Initialize lazily:

**When to initialize:**

- User explicitly selects server in composer
- User invokes tool from that server
- User clicks "Test Connection" in settings
- User opens MCP settings panel (for status display only)

**When NOT to initialize:**

- Page load with MCP servers configured
- Switching conversations
- Refreshing the page

This preserves resources and avoids unnecessary auth prompts.

### Progressive Disclosure for Auth

1. **No auth required**: Connect immediately, show tools
2. **Bearer token required**: Prompt for API key in configuration agent chat
3. **OAuth required**: Show "Connect" button, explain what permissions are needed
4. **OAuth expired**: Show "Reconnect" badge, don't block other servers

### Error Recovery in Conversation

When OAuth expires mid-conversation:

1. Tool call fails with 401
2. Display inline prompt: "Your GitHub connection expired. [Reconnect] to continue."
3. User clicks Reconnect
4. OAuth flow in popup
5. On success: automatically retry the failed tool call
6. Preserve conversation state throughout

## Multi-Node Considerations

Carmenta will run across multiple server instances. Token management must handle this:

### Token Storage: Database, Not Redis

Store tokens in PostgreSQL, not Redis:

- Tokens are long-lived (hours to days) - not a caching use case
- Need durability guarantees - Redis persistence is complex
- Already have encrypted credential storage patterns in the database
- Refresh operations are infrequent - database latency acceptable

### Refresh Token Race Conditions

When multiple requests simultaneously detect an expired token:

**Solution: Database-level locking**

```sql
SELECT * FROM mcp_tokens
WHERE user_id = $1 AND server_url = $2
FOR UPDATE
```

Lock during refresh, release after update. Prevents duplicate refresh attempts. Token
refresh is infrequent enough that lock contention won't be a bottleneck.

### Session Affinity Not Required

Stateless design: any server instance can handle any request because tokens live in the
shared database. No sticky sessions needed.

## Integration with mcp-hubby

Carmenta has a strategic advantage: mcp-hubby already handles OAuth for 23+ services.
Rather than duplicating this infrastructure, Carmenta leverages it.

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
5. User manages individual service connections through Carmenta's integrations page

**Benefits:**

- Immediate access to 23+ integrations without building each OAuth flow
- Token refresh handled by mcp-hubby, not Carmenta
- Progressive disclosure pattern reduces context window usage
- Single MCP connection gives access to many services

### MCP Page Location

Add navigation to MCP configuration page below the integrations link in settings:

```
Settings
├── Profile
├── Integrations        ← Existing native integrations
├── MCP Servers         ← NEW: Custom MCP servers
├── Preferences
└── Billing
```

The MCP page shows servers from both sources:

1. mcp-hubby services (managed, always available)
2. Custom user-configured MCP servers

## Security Considerations

### PKCE (Proof Key for Code Exchange)

Required by OAuth 2.1 and the MCP spec:

1. Generate cryptographically random `code_verifier` (43-128 characters)
2. Create `code_challenge` = base64url(SHA256(code_verifier))
3. Send `code_challenge` with authorization request
4. Send `code_verifier` with token exchange
5. Authorization server verifies the relationship

### No Token Pass-Through

The MCP spec explicitly prohibits passing client tokens to upstream APIs. When an MCP
server needs to call external services, it must use its own credentials for those
services—not relay the token it received from the MCP client.

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

## Architecture Decisions

### ✅ OAuth Callback URL Architecture

**Decision**: `/api/mcp/oauth/callback` - single callback, server identified by state

Rationale:

- Simpler than per-server callbacks
- State parameter already required for CSRF protection
- Server ID encoded in state token
- Works with Dynamic Client Registration (callback URL known in advance)

### ✅ mcp-hubby Integration Depth

**Decision**: Start with MCP client only, evolve toward shared UI

Phase 1: Carmenta connects to mcp-hubby via MCP protocol Phase 2: Carmenta UI can
initiate mcp-hubby OAuth flows Phase 3: Unified credential storage (future)

### ✅ Token Storage Location

**Decision**: New `mcp_oauth_tokens` table (cleaner separation)

Separate from native integrations because:

- Different lifecycle (DCR creates client credentials)
- Different schema (resource indicators, AS metadata)
- Cleaner querying for MCP-specific operations

## Open Questions

### Scope Granularity for MCP

MCP defines `mcp:access` as the default scope. Should we request additional scopes?

Some MCP servers might support:

- `mcp:read` - read-only tool access
- `mcp:write` - tools that modify data
- `mcp:admin` - administrative operations

Need to understand what scopes MCP servers actually implement before designing UI around
scope selection.

### Hosted MCP Option

Should Carmenta offer hosted MCP servers for high-value integrations?

Like Composio, we could manage the server and user just authenticates. This simplifies
UX (no URL needed) but adds operational complexity.

Consider for: GitHub, Notion, Slack where we can provide better UX than generic MCP.

---

## Sources

MCP Specification:

- [MCP Authorization Specification (June 2025)](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [MCP Transports Specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)
- [MCP Spec Updates June 2025 - Auth0](https://auth0.com/blog/mcp-specs-update-all-about-auth/)
- [Why MCP Deprecated SSE](https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-go-with-streamable-http/)
- [MCP SSE → Streamable HTTP Security](https://auth0.com/blog/mcp-streamable-http/)
- [Let's fix OAuth in MCP - Aaron Parecki](https://aaronparecki.com/2025/04/03/15/oauth-for-model-context-protocol)

Competitor Implementations:

- [LibreChat MCP OAuth PR #8598](https://github.com/danny-avila/LibreChat/pull/8598)
- [LibreChat MCP Documentation](https://www.librechat.ai/docs/features/mcp)
- [Claude Code OAuth Bug #10250](https://github.com/anthropics/claude-code/issues/10250)
- [Cursor MCP Docs](https://cursor.com/docs/context/mcp)
- [Continue.dev MCP OAuth Issue #6282](https://github.com/continuedev/continue/issues/6282)

OAuth RFCs:

- RFC 6749 - OAuth 2.0 Authorization Framework
- RFC 7591 - Dynamic Client Registration
- RFC 7636 - PKCE
- RFC 8414 - Authorization Server Metadata
- RFC 8707 - Resource Indicators
- RFC 9728 - Protected Resource Metadata
