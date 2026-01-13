# Admin CLI

A unified command-line interface for Carmenta administrative operations, inspired by
Django's management commands but built for TypeScript/Node.js.

## Problem Statement

Carmenta and machina need shared tooling for:

1. **MCP server testing** - Verify servers in config work before the chat interface
2. **Environment validation** - Show which env vars are set, which are missing
3. **Health diagnostics** - Quick checks across services
4. **Cleanup operations** - Database maintenance, orphaned records, token refresh

Currently these operations are scattered across:

- Package.json scripts (`db:*`, `eval:*`)
- API routes (`/api/mcp/servers/[id]/test`)
- Manual curl commands (machina verification)
- No unified interface

## Landscape Analysis

### Framework Options

| Framework        | Best For                                | Downsides                                |
| ---------------- | --------------------------------------- | ---------------------------------------- |
| **Commander.js** | Simple-to-medium CLIs, quick setup      | No plugin system                         |
| **Yargs**        | Complex argument parsing, i18n          | Callback-heavy API                       |
| **oclif**        | Enterprise CLIs, plugins, multi-package | Boilerplate, overkill for internal tools |
| **Vercel-style** | Custom registration, flexible           | More custom code                         |
| **tsx scripts**  | Zero setup, existing pattern            | No unified entry point                   |

**Sources:**

- [Commander vs other frameworks](https://app.studyraid.com/en/read/11908/379336/commanderjs-vs-other-cli-frameworks)
- [CLI frameworks comparison](https://npm-compare.com/commander,oclif,vorpal,yargs)
- [Building TypeScript CLI with Commander](https://blog.logrocket.com/building-typescript-cli-node-js-commander/)

### Production Examples Studied

**Vercel CLI** - Custom command registration with Map-based lookup, no oclif:

- `parseArguments()` utility for consistent parsing
- Command aliases support (`dev` → `develop`)
- Global + command-specific options
- [DeepWiki analysis](https://deepwiki.com/vercel/vercel/3.1-cli-commands)

**Prisma CLI** - Custom implementation in `packages/cli/src/CLI.ts`:

- Uses internal `@prisma/internals` for parsing
- Not oclif-based despite common assumption
- [GitHub source](https://github.com/prisma/prisma/blob/main/packages/cli/src/CLI.ts)

**Turborepo** - Rust binary with JS wrapper:

- Node wrapper handles platform detection
- Rust for performance-critical operations
- [CLI Architecture](https://deepwiki.com/vercel/turborepo/2.4-cli-architecture)

### MCP Testing Tools

**MCP Inspector** - Official Anthropic tool:

```bash
npx @modelcontextprotocol/inspector <server-command>
```

Features:

- Web UI at localhost:6274
- Tests resources, prompts, tools
- Shows protocol messages
- [Official docs](https://modelcontextprotocol.io/docs/tools/inspector)

**CLI-based testing** (machina pattern):

```bash
curl -s -X POST 'http://localhost:9900/mcp' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"describe"},"id":1}'
```

**Sources:**

- [MCP Inspector GitHub](https://github.com/modelcontextprotocol/inspector)
- [Debugging MCP servers](https://www.mcpevals.io/blog/debugging-mcp-servers-tips-and-best-practices)
- [CLI-based MCP testing](https://blog.fka.dev/blog/2025-03-25-inspecting-mcp-servers-using-cli/)

## Recommendation: Commander.js + File-Based Commands

For Carmenta's needs, we don't need oclif's plugin architecture. Commander.js provides:

- Simple subcommand definition
- Good TypeScript support
- Minimal dependencies
- Easy to add new commands

### Directory Structure

```
cli/
├── index.ts              # Entry point, command registration
├── commands/
│   ├── mcp/
│   │   ├── test.ts       # Test MCP server connection
│   │   ├── list.ts       # List configured servers
│   │   └── inspect.ts    # Launch MCP Inspector for a server
│   ├── env/
│   │   ├── check.ts      # Validate required env vars
│   │   └── show.ts       # Display env var status (masked)
│   ├── db/
│   │   └── status.ts     # Database connection status
│   └── health.ts         # Overall system health
├── lib/
│   ├── output.ts         # Consistent output formatting
│   ├── config.ts         # Load MCP configs from file
│   └── mcp-client.ts     # Programmatic MCP testing
└── package.json          # Bin entry for "carmenta"
```

### Package.json Configuration

```json
{
  "name": "@carmenta/cli",
  "bin": {
    "carmenta": "./dist/index.js"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsx src/index.ts"
  }
}
```

Or in the root package.json for simpler setup:

```json
{
  "bin": {
    "carmenta": "./cli/index.ts"
  },
  "scripts": {
    "cli": "tsx cli/index.ts"
  }
}
```

## Core Commands

### `carmenta mcp test [server-name]`

Test MCP server connectivity from config.

**Flow:**

1. Load MCP config from Claude Code config or Carmenta settings
2. Health check (HTTP endpoint)
3. Auth validation (bearer token)
4. Protocol check (initialize handshake)
5. Capability check (list tools/resources)

**Output:**

```
Testing MCP server: machina

  [1/4] Health check............ ✓ (23ms)
  [2/4] Authentication.......... ✓ (Bearer token valid)
  [3/4] Protocol handshake...... ✓ (MCP 1.0)
  [4/4] Capabilities............ ✓ (31 tools, 0 resources)

✓ machina is healthy
```

**Error output:**

```
Testing MCP server: machina

  [1/4] Health check............ ✗ Connection refused

✗ machina is unreachable

Troubleshooting:
  • Check if the server is running: curl http://localhost:9900/health
  • Verify MACHINA_PORT matches the running server
  • Check logs: ~/machina/logs/gateway-stderr.log
```

### `carmenta mcp list`

List all configured MCP servers with status.

**Output:**

```
MCP Servers (from ~/.config/claude/claude_desktop_config.json)

  machina          http://localhost:9900    ✓ connected
  mcp-hubby        http://localhost:3100    ✓ connected
  filesystem       stdio                    ? not tested

3 servers configured
```

### `carmenta env check`

Validate required environment variables.

**Output:**

```
Environment Check

Required:
  ✓ OPENROUTER_API_KEY         set (sk-or-...7f2a)
  ✓ NEXT_PUBLIC_SUPABASE_URL   set (https://...)
  ✗ ENCRYPTION_KEY             missing

Optional (OAuth):
  ✓ GOOGLE_CLIENT_ID           set
  ✓ GOOGLE_CLIENT_SECRET       set
  ~ SLACK_CLIENT_ID            not set (Slack integration disabled)

1 required variable missing. Run with --help for setup instructions.
```

### `carmenta env show [pattern]`

Display environment variables (masked by default).

```
carmenta env show GOOGLE
carmenta env show --unmask OPENROUTER  # Show full values
```

### `carmenta health`

Quick health check across all services.

```
Carmenta Health Check

  Database.............. ✓ connected (Supabase)
  MCP Gateway........... ✓ 2/2 servers healthy
  Temporal.............. ~ not configured (async mode disabled)
  Sentry................ ✓ configured

Overall: healthy (1 optional service not configured)
```

## MCP Config Discovery

The CLI needs to find MCP server configs from multiple sources:

1. **Claude Code config**: `~/.config/claude/claude_desktop_config.json`
2. **Carmenta settings**: Database `mcp_servers` table
3. **Environment**: `MCP_SERVERS` JSON env var (for CI)

```typescript
interface McpServerConfig {
  name: string;
  transport: "http" | "stdio";
  url?: string; // For HTTP transport
  command?: string; // For stdio transport
  args?: string[];
  env?: Record<string, string>;
  auth?: {
    type: "none" | "bearer" | "header";
    token?: string;
    headerName?: string;
  };
}

async function discoverMcpServers(): Promise<McpServerConfig[]> {
  const sources = await Promise.all([
    loadClaudeCodeConfig(),
    loadCarmentaDbConfig(),
    loadEnvConfig(),
  ]);
  return deduplicateByName(sources.flat());
}
```

## Programmatic MCP Testing

For HTTP-transport MCP servers, testing follows this sequence:

```typescript
interface TestResult {
  step: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: Record<string, unknown>;
}

async function testMcpServer(config: McpServerConfig): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // 1. Health check (if HTTP)
  if (config.transport === "http") {
    results.push(await testHealth(config.url));
    if (!results[0].success) return results;
  }

  // 2. MCP Initialize
  results.push(await testInitialize(config));
  if (!results[1].success) return results;

  // 3. List capabilities
  results.push(await testCapabilities(config));

  return results;
}
```

## Cleanup Commands (Future)

Potential cleanup operations to add:

```
carmenta cleanup tokens        # Remove expired OAuth tokens
carmenta cleanup conversations # Archive old conversations
carmenta cleanup attachments   # Remove orphaned file attachments
carmenta cleanup --dry-run     # Show what would be cleaned
```

## Integration with Existing Scripts

The CLI doesn't replace existing scripts—it complements them:

| Existing Script   | CLI Equivalent       | Notes                       |
| ----------------- | -------------------- | --------------------------- |
| `pnpm db:migrate` | Keep as-is           | Drizzle handles this well   |
| `pnpm db:studio`  | Keep as-is           | Drizzle Studio is excellent |
| `pnpm eval:*`     | Keep as-is           | Braintrust integration      |
| Manual curl       | `carmenta mcp test`  | Unified testing             |
| Check .env        | `carmenta env check` | Structured validation       |

## Implementation Path

### Phase 1: MCP Testing (Immediate Value)

1. Create `cli/` directory structure
2. Implement `mcp test` and `mcp list` commands
3. Add MCP config discovery from Claude Code config
4. Test against machina and mcp-hubby

### Phase 2: Environment Validation

1. Define required/optional env var registry
2. Implement `env check` and `env show`
3. Add setup instructions for missing vars

### Phase 3: Health Aggregation

1. Implement `health` command
2. Aggregate DB, MCP, Temporal, Sentry status
3. Add CI-friendly exit codes

### Phase 4: Cleanup Operations

1. Design cleanup job interface
2. Implement token cleanup
3. Add dry-run support
4. Consider scheduled execution via Temporal

## Architecture Decision

**✅ Decision: Commander.js with tsx execution**

Rationale:

- Carmenta already uses tsx for scripts (consistency)
- Commander.js is well-maintained, 32k+ stars
- No need for plugin architecture (internal tool)
- Can always migrate to oclif later if needed
- Matches the "simple over complex" principle

Alternative considered:

- **oclif**: Too much boilerplate for internal tooling
- **yargs**: Callback-heavy API, less readable
- **Custom (Vercel-style)**: More code to maintain

## Gap Assessment

### Achievable Now

- MCP server testing (HTTP transport)
- Environment variable validation
- Health checks for known services
- Config discovery from Claude Code

### Emerging (6-12 months)

- Stdio MCP server testing (requires process spawning)
- Cleanup job scheduling via Temporal
- Cross-repo CLI sharing (carmenta + machina)

### Aspirational

- GUI companion (Electron/Tauri)
- Auto-remediation for common issues
- Integration with MCP Inspector's protocol

## Open Questions

1. **Shared CLI between carmenta and machina?**
   - Option A: Monorepo with shared CLI package
   - Option B: Separate CLIs that can test each other
   - Option C: machina exposes test endpoints, carmenta CLI calls them

2. **Config file format for env var registry?**
   - TypeScript const (type-safe, requires build)
   - JSON schema (portable, no build)
   - YAML with comments (readable, extra dependency)

3. **Should `carmenta mcp inspect` launch MCP Inspector or build our own UI?**
   - MCP Inspector is excellent but web-only
   - Our own would be maintenance burden
   - Recommendation: Wrap MCP Inspector, don't rebuild

## References

- [MCP Inspector docs](https://modelcontextprotocol.io/docs/tools/inspector)
- [Commander.js](https://github.com/tj/commander.js)
- [Vercel CLI architecture](https://deepwiki.com/vercel/vercel/3.1-cli-commands)
- [Django management commands](https://docs.djangoproject.com/en/4.2/howto/custom-management-commands/)
- [oclif introduction](https://oclif.io/docs/introduction/)
