# MCP Configuration

Agent-assisted configuration for remote MCP servers. Users describe what they want or
paste configuration—Carmenta figures out the rest.

**Related**: See [external-tools.md](./external-tools.md) for ecosystem strategy. See
[mcp-oauth/spec.md](./mcp-oauth/spec.md) for OAuth implementation details.

---

## Why This Exists

MCP won. 97M+ monthly SDK downloads. Backing from Anthropic, OpenAI, Google, Microsoft.
[Official Registry](https://registry.modelcontextprotocol.io) launched September 2025.
Every AI interface now needs MCP support.

But MCP configuration remains a developer ritual:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "ghp_xxx" }
    }
  }
}
```

Users paste this into `~/.cursor/mcp.json` or `claude_desktop_config.json`, restart
their client, debug why it's not connecting, realize they need Node.js installed, wonder
what "stdio transport" means...

The people who would benefit most from MCP tools—non-developers who want AI to do
things—are the least equipped to configure them.

### Competitor Approaches

**[LobeChat](https://github.com/lobehub/lobe-chat)**: Marketplace with one-click
installation. Excellent discovery. Still requires dependency installation for stdio
servers. Progress tracking through 7-step workflow. JSON Schema-driven configuration
forms.

**[LibreChat](https://github.com/danny-avila/LibreChat)**: YAML configuration with OAuth
support. Multi-user credential isolation. Per-user vs. app-level server distinction.
1000+ lines of OAuth handling code.

**[Smithery](https://smithery.ai)**: Marketplace with 3,400+ servers. Hosted MCP option
(tokens passed ephemerally). CLI for local installation.

**[Composio](https://composio.dev)**: Fully managed platform. 100+ pre-built servers.
Natural language task completion. OAuth handled server-side.

**[Cursor](https://cursor.com)**: One-click OAuth installation for curated servers. JSON
config for custom servers. Global or project-level configuration.

### The Gap

Nobody has solved agent-assisted configuration. Users still need to:

- Know what transport type they want
- Understand the difference between stdio and HTTP
- Install system dependencies
- Edit JSON/YAML files
- Manage API keys manually

Carmenta's opportunity: **The configuration agent**. Paste anything—URL, JSON blob,
screenshot, description of what you want—and Carmenta figures out the rest.

---

## Design Philosophy

### Remote-First Architecture

Local MCP servers (stdio transport) require:

- Node.js, Python, or other runtimes installed
- Spawning subprocesses
- Platform-specific considerations (macOS vs Windows vs Linux)
- Desktop app architecture

Remote-first simplifies everything:

- HTTP/SSE transport only
- No dependency management
- Works in web clients
- Simpler security model
- Scales to serverless

**Decision**: Phase 1 is remote-only. Local server support is a future consideration,
not MVP.

**Local Server Detection**: The config agent detects and elegantly rejects local/stdio
servers:

- `"transport": "stdio"` in JSON
- `"command":` field in JSON (indicates stdio server)
- `file://` URLs
- `npx`, `node`, `python` commands

Users receive a helpful message explaining why remote-only and suggesting they provide
an HTTP endpoint if their server has one.

### Agent-Assisted Over Form-Driven

Traditional approach: Present a form with fields for URL, headers, auth type, etc.

Carmenta approach: A conversational agent that:

1. Accepts any input format (URL, JSON, screenshot, natural language)
2. Figures out what the user is trying to configure
3. Validates the connection
4. Handles errors with helpful guidance
5. Stores the working configuration

The agent **is** the configuration UI.

### Progressive Disclosure

For users who just want to connect:

> "Connect me to the GitHub MCP server"

For users pasting config from documentation:

> [pastes JSON blob]

For users with specific requirements:

> "I need to connect to my company's internal MCP server at
> https://mcp.internal.company.com with my API key from 1Password"

The same interface handles all cases without forcing users through a wizard.

---

## Core Functions

### Input Parsing

The configuration agent accepts multiple input formats:

**URLs**: Detect MCP endpoint, probe for server info

```
https://mcp.example.com/sse
```

**JSON Configuration**: Parse and validate

```json
{
  "url": "https://mcp.example.com",
  "headers": { "Authorization": "Bearer xxx" }
}
```

**Natural Language**: Understand intent, search registry

```
"I want to connect to Notion"
```

**Smithery/Registry Links**: Extract server metadata

```
https://smithery.ai/server/@anthropics/claude-mcp
```

**Screenshots**: OCR configuration from documentation images

### Server Discovery

Three discovery paths:

1. **Official Registry**: Query
   [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io) for
   canonical server information. Namespace format: `io.github.org/server` or
   `com.company/server`.

2. **Third-Party Marketplaces**: Integrate with Smithery, LobeHub, and other catalogs
   for broader discovery. These provide curated listings and user ratings.

3. **Direct URL**: For custom/internal servers not in any registry.

Discovery returns:

- Server name and description
- Available tools and resources
- Connection requirements (auth type, required headers)
- Configuration schema (if any)

### Connection Validation

Before saving configuration:

1. Attempt connection to the MCP endpoint
2. Fetch server capabilities (`initialize` → `initialized`)
3. List available tools (`tools/list`)
4. Verify auth works (if configured)
5. Report success or actionable failure

Validation feedback is conversational:

> "Connected to GitHub MCP. Found 12 tools including `create_issue`,
> `search_repositories`, and `get_file_contents`. Ready to use?"

### Configuration Storage

Per-user storage in PostgreSQL:

```typescript
interface UserMcpServer {
  id: string; // UUID
  userId: string; // FK to users
  identifier: string; // Registry identifier or custom name
  accountId: string; // For multi-account (e.g., "work-github", "personal-github")
  displayName: string; // User-facing name
  accountDisplayName?: string; // From server manifest (e.g., "@nick" for GitHub)
  url: string; // MCP endpoint URL
  transport: "sse" | "http"; // Transport type
  auth: {
    type: "none" | "bearer" | "header" | "oauth";
    token?: string; // Encrypted
    headerName?: string; // For custom header auth
    oauthConnectionId?: string; // FK to oauth connections
  };
  headers?: Record<string, string>; // Additional headers (encrypted values)
  isDefault: boolean; // Default account for this server
  enabled: boolean; // Active for this user
  status: "connected" | "error" | "expired" | "disconnected";
  lastConnected?: Date;
  lastError?: string;
  serverManifest?: {
    // Cached from server
    name: string;
    version?: string;
    toolCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Unique constraint: (userId, identifier, accountId)

interface McpConnectionEvent {
  id: string;
  userId: string;
  serverIdentifier: string;
  accountId?: string;
  eventType: "CONNECTED" | "DISCONNECTED" | "ERROR" | "TOKEN_EXPIRED" | "RECONNECTED";
  eventSource: "USER" | "SYSTEM" | "WEBHOOK";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
}
```

### Per-Query Server Selection

Users can enable/disable servers per conversation or query:

**Ambient mode**: All enabled servers available, Carmenta routes automatically.

**Explicit mode**: User selects specific servers for a query.

> "Using GitHub and Linear: create an issue for this bug and add it to the sprint"

UI shows active servers as chips/pills, toggleable before sending.

---

## User Experience

### Dedicated Configuration Page

Path: `/settings/mcp` or `/integrations/mcp`

**Layout**: Split view with chat interface (left) and server list (right).

**Chat Interface** (like Librarian):

- Thin input bar at bottom
- Conversation thread above
- Tool activity indicators
- Clear "Add Server" call-to-action when empty

**Server List**:

- Cards showing each configured server
- Status indicator (connected, error, disabled)
- Quick actions (test, edit, remove, disable)
- Tool count badge

### Configuration Flow

**Happy path** (paste URL):

1. User pastes: `https://mcp.example.com/sse`
2. Agent: "Connecting to mcp.example.com..."
3. Agent: "Found Example MCP Server with 5 tools. It requires an API key. Do you have
   one, or should I help you get set up?"
4. User: "Here's my key: sk-xxx"
5. Agent: "Connected! I can now [list capabilities]. Added to your active servers."

**Happy path** (natural language):

1. User: "I want to connect to the Notion MCP server"
2. Agent: "I found the official Notion MCP server. It needs OAuth to access your Notion
   workspace. Ready to connect?"
3. User: "Yes"
4. [OAuth flow in popup]
5. Agent: "Connected to your Notion workspace 'Acme Corp'. I can now search pages, read
   databases, and create content."

**Error path**:

1. User pastes malformed JSON
2. Agent: "I see you're trying to configure an MCP server. The JSON has a syntax error
   on line 3—there's a missing comma. Here's the corrected version: [formatted JSON].
   Want me to use this?"

### In-Conversation Server Selection

When composing a message, users see:

```
┌─────────────────────────────────────────────────────────────┐
│ [GitHub ✓] [Notion ✓] [Linear ✓] [+ Add]    ⚙️ Settings    │
├─────────────────────────────────────────────────────────────┤
│ What would you like to do?                                  │
│                                                    [Send →] │
└─────────────────────────────────────────────────────────────┘
```

Clicking a server chip toggles it. Clicking "+" opens the configuration interface.

### Status Indicators

| State      | Icon | Meaning                            |
| ---------- | ---- | ---------------------------------- |
| Connected  | 🟢   | Active and working                 |
| Disabled   | ⚪   | User disabled, not in use          |
| Error      | 🔴   | Connection failed, needs attention |
| Needs Auth | 🟡   | Token expired or auth required     |

---

## Architecture

### Configuration Agent

The configuration agent is a specialized Carmenta agent with:

**System prompt** focused on:

- Parsing various input formats
- Querying MCP registries
- Validating connections
- Guiding users through auth flows
- Storing working configurations

**Tools**:

- `search_registry`: Query official and third-party registries
- `probe_endpoint`: Test MCP server connectivity
- `parse_config`: Extract configuration from various formats
- `save_server`: Persist validated configuration
- `list_servers`: Show user's configured servers
- `test_connection`: Verify existing configuration still works
- `remove_server`: Delete a server configuration

**Context**:

- User's existing server configurations
- Recent connection errors
- Available registry sources

### MCP Client

Carmenta acts as an MCP client connecting to remote servers:

```
┌─────────────────┐     HTTP/SSE     ┌─────────────────┐
│    Carmenta     │ ◄──────────────► │   MCP Server    │
│  (MCP Client)   │                  │   (Remote)      │
└─────────────────┘                  └─────────────────┘
        │
        │ stores
        ▼
┌─────────────────┐
│   PostgreSQL    │
│ (User Configs)  │
└─────────────────┘
```

**Transport**: Streamable HTTP per MCP 2025-03-26 spec. SSE is deprecated.

**Transport Types** (as of January 2026):

- `http` = Streamable HTTP (current standard, our default)
- `sse` = Server-Sent Events (deprecated, supported for legacy servers)
- `streamable-http` = Claude Desktop's name for the same thing as `http` (we normalize)

**Streamable HTTP Modes**:

- **Stateful**: Server assigns `Mcp-Session-Id` header; client includes it on subsequent
  requests
- **Stateless**: Server sets `sessionIdGenerator: undefined`; no session tracking
  (simpler, Machina uses this)

**Our @ai-sdk/mcp mapping**:

- `type: "http"` → Streamable HTTP transport
- `type: "sse"` → Legacy SSE transport (if URL contains `/sse`)

**Connection pooling**: Per-user connections cached with idle timeout (1 hour).
Reconnect on demand.

### Security Model

**Credential encryption**: Same AES-256-GCM pattern as existing integrations.

**Token isolation**: Each user's tokens stored separately. No cross-user access.

**No credential logging**: Tokens never appear in logs or error messages.

**Principle of least privilege**: Store only what's needed. Don't cache full server
responses.

---

## Patterns from mcp-hubby

mcp-hubby (our MCP gateway server) has solved several patterns we can port to the client
configuration experience:

### Service Registry Pattern

mcp-hubby uses a centralized `SERVICE_REGISTRY` (`lib/services.ts:33-335`) that defines
all services as metadata:

```typescript
{
  id: "github",
  name: "GitHub",
  authMethod: "oauth",
  status: "available",
  supportsMultipleAccounts: false
}
```

**Apply to Carmenta**: Create an `MCP_SERVER_REGISTRY` for featured/known servers. New
servers added by declaring metadata, not scattering config. Registry includes auth
requirements, default URLs, documentation links.

### Unified Credential Interface

mcp-hubby's `getCredentials()` (`lib/connection-manager.ts:59-202`) abstracts away OAuth
vs API key differences. Callers get credentials without caring how they're stored or
refreshed.

**Apply to Carmenta**: Same pattern—unified `getMcpServerCredentials(userId, serverId)`
returns ready-to-use auth headers regardless of auth type.

### Multi-Account from Day One

Gmail, Google Drive, etc. support multiple accounts. mcp-hubby handles this with:

- `accountId` field on connections
- `isDefault` flag for default selection
- Auto-promote oldest account when default disconnected
- Unique constraint: `(userEmail, service, accountId)`

**Apply to Carmenta**: Same user might connect work and personal GitHub. Design schema
for multi-account from start: `(userId, serverIdentifier, accountId)`.

### Connection Event Logging

Every connection change logged to `connection_history` table:

- Event type: `CONNECTED`, `DISCONNECTED`, `TOKEN_EXPIRED`, etc.
- Event source: `USER`, `WEBHOOK`, `SYSTEM`
- Metadata, error codes, timestamps

**Apply to Carmenta**: Add `mcp_connection_events` table. Query for debugging, audit
trails, analytics ("which servers have highest error rates?").

### Account Info Fetching

After OAuth completes, mcp-hubby fetches account info from the service API
(`lib/fetch-account-info.ts`). Gmail returns the email address, Google Drive returns
account name, etc.

**Apply to Carmenta**: After connecting an MCP server, fetch server manifest and store
`serverName`, `serverVersion`, `toolCount` for display. Don't rely on user-provided
names alone.

### Error Messages That Guide

When credentials unavailable:

```
❌ Gmail is not connected to your account.
Please connect Gmail at: https://app.com/integrations/gmail
Once connected, try your request again.
```

**Apply to Carmenta**: Same pattern. When MCP server unreachable: "GitHub MCP server
connection expired. [Reconnect] to continue using GitHub tools."

### Progressive Disclosure (Gateway Pattern)

mcp-hubby's gateway reduces 200K tokens → 7.5K tokens by only exposing service summaries
upfront, loading full operation lists on-demand.

**Apply to Carmenta**: Don't dump all tools from all servers into every conversation.
Load server capabilities when relevant, or when user explicitly selects a server.

---

## Authentication Phases

### Phase 1: Simple Auth

**No auth**: Public MCP servers that don't require authentication.

**Bearer token**: User provides API key, stored encrypted, sent as
`Authorization: Bearer <token>`.

**Custom header**: User specifies header name and value, e.g., `X-API-Key: <token>`.

Implementation: Headers attached to every request to that server.

### Phase 2: OAuth

Full OAuth 2.1 implementation per MCP spec. See
[mcp-oauth/spec.md](./mcp-oauth/spec.md).

Key additions:

- OAuth discovery via `/.well-known/oauth-protected-resource`
- Dynamic client registration (RFC 7591)
- PKCE (RFC 7636)
- Token storage and refresh
- Re-authorization flows

The configuration agent guides users through OAuth:

> "This server requires you to sign in with your GitHub account. Click here to connect,
> and I'll remember the connection for future use."

---

## Integration Points

### Concierge

Concierge routes requests to available MCP tools:

- Knows which servers are enabled for the user
- Understands tool capabilities from server manifests
- Selects appropriate tools based on user intent

### AI Team

Agents inherit user's MCP configurations:

- Agent tasks can use tools from enabled servers
- Per-agent server restrictions possible (future)

### Memory / Knowledge Librarian

MCP usage patterns inform context:

- "You usually use the production database server"
- Tool preferences learned over time

### Service Connectivity

Native integrations (Notion, Gmail, etc.) coexist with MCP:

- User sees unified "integrations" view
- Some services available both ways (native + MCP)
- Prefer native when available (tighter integration)

---

## Success Criteria

- **Zero JSON editing**: Users never see or edit configuration files
- **Under 60 seconds**: Connect to a new server in under a minute
- **Paste anything**: URLs, JSON, screenshots, natural language all work
- **Clear errors**: When things fail, users know exactly what to do
- **No dependencies**: Remote-first means no "install Node.js" messages

---

## Gap Assessment

### Achievable Now

- Remote HTTP/SSE MCP client implementation
- Configuration agent with parsing and validation
- Per-user encrypted credential storage
- Bearer token and custom header auth
- Server list UI with status indicators
- Per-query server selection

### Emerging (6-12 months)

- OAuth 2.1 with PKCE (spec finalized, implementations maturing)
- Official MCP Registry API integration (API freeze Oct 2025)
- MCP Apps visual tool interfaces (SEP-1865 draft)
- Cross-platform sync of configurations

### Aspirational

- Automatic server suggestions based on conversation
- Self-healing connections (detect and fix common issues)
- Server creation wizard (help users deploy their own)
- Organization-level server sharing

---

## Open Questions

### Registry Strategy

Which registries do we query?

- **Official only**: Simple, authoritative, but limited catalog
- **Official + Smithery**: Broader discovery, dependency on third party
- **Federated**: Query multiple registries, dedupe results

Recommendation: Start with official registry + direct URL support. Add Smithery
integration based on user demand.

### Hosted MCP Option

Should Carmenta offer hosted MCP servers?

- **Yes**: Like Composio, we manage the server, user just authenticates
- **No**: Focus on connecting to existing servers

Hosted servers simplify UX (no URL needed) but add operational complexity. Consider for
high-value integrations (GitHub, Notion, Slack) where we can provide better UX than
generic MCP.

### Configuration Agent vs. Dedicated UI

How much should the agent do vs. traditional UI?

- **Agent-first**: Everything through conversation, minimal forms
- **Hybrid**: Agent for complex cases, quick forms for simple ones
- **UI-first**: Traditional settings page, agent for help

Recommendation: Agent-first with graceful fallback to forms when users prefer. The agent
IS the differentiator.

### Server Sharing

Can users share server configurations?

- Team-level servers (admin configures, users access)
- Shareable config links
- Organization server libraries

Phase 2 consideration. Start with per-user only.

---

## MCP Tool Integration Architecture

How MCP tools are wired into LLM calls. This section documents the industry patterns and
our implementation approach.

### Industry Patterns (from research)

**All major implementations fetch tools at connection/install time, not per-request:**

| Implementation     | When Tools Fetched                       | Where Cached    | Dynamic Updates   |
| ------------------ | ---------------------------------------- | --------------- | ----------------- |
| Claude Desktop     | App startup                              | Session cache   | Not supported     |
| LobeChat           | Install step 5 (GETTING_SERVER_MANIFEST) | Plugin manifest | Not supported     |
| LibreChat          | MCPServerInspector.inspect()             | Server config   | Not supported     |
| Vercel AI SDK      | On-demand via `mcpClient.tools()`        | None built-in   | Via `listChanged` |
| MCP TypeScript SDK | `client.listTools()`                     | Validator cache | Via `listChanged` |

**Key insight**: Claude Desktop injects tool schemas directly into the system prompt. A
five-server setup with 58 tools can consume ~55K tokens before conversation starts. This
is why progressive disclosure matters.

**Vercel's mcp-to-ai-sdk approach**: Generate static tool definitions at build time to
avoid security issues and token waste. Tools don't change at runtime.

### Our Implementation: Gateway Pattern

We use progressive disclosure to reduce token usage by ~95%:

```
┌─────────────────────────────────────────────────────────────────┐
│ Tool: mcp_github                                                │
│ Description: GitHub. Top operations: create_issue,             │
│              search_repositories, get_file_contents +9 more.    │
│              Use action='describe' for full list.               │
│ Schema: { action: string, params?: object }                     │
└─────────────────────────────────────────────────────────────────┘
```

Instead of 12 individual tools with full schemas (~3K tokens each), one gateway tool
with a summary (~200 tokens). Full tool list fetched on-demand when LLM invokes
`action='describe'`.

### Critical Requirement: Manifest at Connection Time

**The tool description must be useful to the LLM.** When the LLM sees:

> "Machina. Use action='describe' to see available operations."

It has no idea what Machina does or when to use it. But when it sees:

> "Machina. Top operations: list_tasks, create_task, search_files +8 more"

It can make routing decisions.

**This means: we MUST fetch and cache the server manifest when the connection is first
established**, not wait for the first tool call.

### Implementation Pattern

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Connection Flow                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. User adds MCP server (URL + credentials)                         │
│                 │                                                     │
│                 ▼                                                     │
│  2. Connection validation                                            │
│     - initialize + initialized handshake                              │
│     - tools/list → fetch available tools                             │
│     - Store manifest: { name, toolCount, tools: [...] }              │
│                 │                                                     │
│                 ▼                                                     │
│  3. Server saved with cached manifest                                │
│                 │                                                     │
│                 ▼                                                     │
│  4. Tool description includes top operations                         │
│     "GitHub. Top operations: create_issue, search_repos +10"         │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                        Query Flow                                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. getMcpGatewayTools(userEmail)                                    │
│     - Lists enabled servers from DB                                   │
│     - Uses CACHED manifest for tool descriptions                      │
│     - NO network calls (fast, token-efficient)                        │
│                 │                                                     │
│                 ▼                                                     │
│  2. LLM sees tool with meaningful description                        │
│     - Can route appropriately based on top operations                │
│                 │                                                     │
│                 ▼                                                     │
│  3. If LLM needs full tool list: action='describe'                   │
│     - THEN we fetch tools/list from server                           │
│     - Update cached manifest (lazy refresh)                          │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### What This Requires

**On server creation:**

1. Create server record in DB (fast, no network)
2. Fire-and-forget: kick off background test to fetch manifest
3. User sees success immediately, manifest populates async

**On test (background or manual):**

1. Connect to server, call `tools/list`
2. Store result in `serverManifest`:
   - `name`: Server's declared name or display name
   - `toolCount`: Number of available tools
   - `tools`: Array of tool names (for description)
3. Update status to "connected" or "error"

**On query (building LLM tools):**

1. Read servers from DB (with cached manifest) - NO network calls
2. Build tool description from cached manifest
3. If manifest missing: generic description (still works, less optimal)

**On describe action (LLM requests full tool list):**

1. Fetch fresh `tools/list` from server
2. Update cached manifest in DB (lazy refresh)
3. Return full tool list to LLM

### Non-Blocking Principle

**Manifest is a performance optimization, not a correctness requirement.**

- Tool works without manifest (generic description)
- Slow/down MCP servers don't block user flows
- Fire-and-forget background fetches
- User never waits on external MCP server connectivity

If an MCP server is slow or unreachable:

- Server creation succeeds immediately
- Query tool building uses cached/empty manifest
- User only notices if they invoke the specific tool

### Future: Dynamic Updates via listChanged

MCP protocol supports `notifications/tools/list_changed` for servers whose tools can
change at runtime. We don't implement this in Phase 1 because:

1. Most MCP servers have static tool sets
2. Claude Desktop doesn't support it either
3. Connection pooling/keepalive complexity
4. Our `describe` action provides on-demand refresh

If we add support later, the pattern is:

- Subscribe to `listChanged` notifications during initialization
- On notification, invalidate cached manifest
- Next tool invocation refetches and caches

### Sources

- [AI SDK MCP](https://github.com/vercel/ai/tree/main/packages/mcp) -
  `packages/mcp/src/tool/mcp-client.ts`
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) -
  `packages/client/src/client/client.ts`
- [LobeChat MCP Integration](https://github.com/lobehub/lobe-chat) -
  `src/store/tool/slices/mcpStore/action.ts:261-536`
- [LibreChat MCP Support](https://github.com/danny-avila/LibreChat) -
  `packages/api/src/mcp/registry/MCPServerInspector.ts`
- [Vercel mcp-to-ai-sdk](https://sdk.vercel.ai/docs/guides/mcp-to-ai-sdk)

---

## Implementation Sequence

### Milestone 1: Foundation

1. MCP client library (HTTP/SSE transport)
2. Database schema for user server configs
3. Basic configuration API (CRUD)
4. Connection validation logic
5. **Manifest fetching at connection time** ← Critical for tool routing

### Milestone 2: Configuration Agent

1. Agent system prompt and tools
2. Input parsing (URL, JSON, natural language)
3. Registry search integration
4. Chat UI for configuration

### Milestone 3: Query Integration

1. Server selection UI in chat composer
2. Tool routing through Concierge
3. Tool execution and response handling
4. Error handling and retry logic

### Milestone 4: OAuth

1. OAuth flow implementation (per mcp-oauth/spec.md)
2. Token storage and refresh
3. Re-authorization UI
4. Multi-account support

---

## Sources

### MCP Specification & Registry

- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP Registry Preview Launch](https://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/)
- [MCP Best Practices Guide](https://modelcontextprotocol.info/docs/best-practices/)
- [MCP Spec Updates June 2025 - Auth0](https://auth0.com/blog/mcp-specs-update-all-about-auth/)

### Competitor Implementations

- [Cursor MCP Docs](https://cursor.com/docs/context/mcp)
- [Smithery Documentation](https://smithery.ai/docs)
- [Composio MCP Guide](https://composio.dev/blog/the-guide-to-mcp-i-never-had)
- [LobeChat GitHub](https://github.com/lobehub/lobe-chat) - MCP marketplace patterns
- [LibreChat GitHub](https://github.com/danny-avila/LibreChat) - OAuth and multi-user

### Configuration Patterns

- [mcp.json Configuration Format](https://gofastmcp.com/integrations/mcp-json-configuration)
- [Amazon Q MCP Configuration](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-mcp-configuration.html)
- [Claude Remote MCP Servers](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)

### Agent-Assisted Configuration Inspiration

- [Beam AI Agent Setup](<https://beam.ai/agentic-insights/agent-setup-create-ai-agents-in-natural-language-(no-technical-skills-needed)>)
- [AWS Strands Agent SOPs](https://aws.amazon.com/blogs/opensource/introducing-strands-agent-sops-natural-language-workflows-for-ai-agents/)
- [Home Assistant Configuration Agent](https://community.home-assistant.io/t/introducing-ha-configuration-agent-ai-powered-home-assistant-configuration-assistant-with-approval-workflow/944620)

### Internal Reference

- **mcp-hubby** (`../mcp-hubby/`) - Our MCP gateway server. Key files:
  - `lib/services.ts:33-335` - Service registry pattern
  - `lib/connection-manager.ts` - Unified credential interface
  - `lib/adapters/base.ts` - Service adapter pattern
  - `drizzle/schema.ts:95-189` - Connection and event schemas
  - `lib/gateway/router.ts` - Progressive disclosure pattern
