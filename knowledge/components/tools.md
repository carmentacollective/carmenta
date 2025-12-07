# Tools

What Carmenta can do beyond conversation. The capabilities that let AI take action in
the world.

## Why This Exists

Every AI interface hits a wall. Ask it to check your calendar, analyze a spreadsheet, or
search the web for current information - and it apologizes. The intelligence is there;
the capabilities aren't.

Tools extend what Carmenta can do. They're the bridge between conversation and action.

## Architecture Decision (2024-12-06)

Tools fall into three tiers based on who provides credentials and who controls the
experience.

### Tier 1: Core Tools

Carmenta provides the capability. No user setup required.

**Credential model**: Carmenta's API keys. Users get this functionality as part of the
product.

**Examples**:

- Web search and content extraction
- Deep research across multiple sources
- YouTube transcript extraction
- Code execution (sandboxed)
- Image analysis and generation
- Comparison tables

**Philosophy**: These are table-stakes capabilities that every user expects. They should
just work.

### Tier 2: Direct Integrations

User connects their account. Carmenta controls the experience.

**Credential model**: User's OAuth tokens or API keys, managed via Nango. Carmenta
controls how the tool presents itself, how responses are formatted, and how errors are
handled.

**Examples**:

- Gmail (read, search, send)
- Google Calendar
- Notion
- GitHub
- Slack
- Limitless
- ClickUp

**Philosophy**: These are services users already use. Carmenta provides a superior
interface to those services - progressive disclosure, LLM-optimized responses, smart
error handling - while the user retains ownership of their data and credentials.

### Tier 3: External MCP (Deferred)

User provides everything. Escape hatch for power users.

**Credential model**: User manages their own MCP server, credentials, and configuration.
Carmenta provides transport.

**Examples**:

- Local filesystem access
- Custom enterprise APIs
- Self-hosted databases

**Philosophy**: Some users have specialized needs. Rather than building everything, we
provide clean MCP client support for those who need it.

**Status**: Deferred until demand is validated. Focus on Tier 1 and Tier 2 first. If
users request specific MCP capabilities, that's signal to either build native support
(Tier 2) or prioritize MCP client implementation.

### Delineation Framework

The decision of which tier a capability belongs to:

**Tier 1 if**: Carmenta can provide API keys, no user auth needed, universal utility.

**Tier 2 if**: User has their own account, we want to control the UX, the service has
broad appeal.

**Tier 3 if**: Local-only capability, highly specialized, or user explicitly wants to
bring their own implementation.

## Current Tool Inventory

### Core Tools (Tier 1)

**Web Intelligence**:

- `webSearch` - Search the web for current information
- `fetchPage` - Extract content from URLs
- `deepResearch` - Comprehensive research across multiple sources

**Utilities**:

- `compareOptions` - Generate comparison tables

**Planned**:

- `youtubeTranscript` - Extract and summarize video content
- `codeExecution` - Run Python/JavaScript in sandbox
- `imageAnalysis` - Analyze uploaded images
- `imageGeneration` - Generate images from descriptions

**Remove**:

- `getWeather` - Mock demo tool with no real utility. Either implement with real API or
  remove entirely.

### Direct Integrations (Tier 2)

See service-connectivity.md for OAuth/Nango architecture. Priority integrations:

**Communication**: Gmail, Slack, LinkedIn **Productivity**: Notion, ClickUp, Miro,
Linear **Development**: GitHub, Sentry **Media**: YouTube, Limitless, Fireflies
**Storage**: Google Drive, Dropbox

## MCP Hubby Reuse

MCP Hubby (mcphubby.ai) solves the same problem with a mature architecture. Rather than
rebuilding, we port proven patterns.

### What We Reuse

**ServiceAdapter base class**: Abstract class providing consistent error handling,
response formatting, validation, and help documentation. Every integration extends this.

**Gateway pattern**: One tool per service with an `action` parameter. Progressive
disclosure via `action="describe"`. Dramatically reduces context window pollution
compared to exposing every operation as a separate tool.

**Nango proxy pattern**: All credentials (OAuth and API keys) flow through Nango.
Adapters never see raw tokens. Consistent authentication regardless of credential type.

**LLM-optimized responses**: Responses formatted for AI consumption, not raw API dumps.
Smart error messages that guide toward resolution. Structured content for machine
parsing.

**Multi-account support**: Users can connect multiple accounts per service (work Gmail,
personal Gmail). Explicit account selection when ambiguous.

### What Changes

**Transport layer**: MCP Hubby uses MCP protocol (JSON-RPC over stdio/SSE). Carmenta
uses Vercel AI SDK tool calling. The ServiceAdapter pattern remains identical; only the
transport wrapper changes.

**Context passing**: MCP Hubby passes user context through MCP authentication. Carmenta
passes it through Vercel AI SDK's experimental_context mechanism.

**Tool registration**: MCP Hubby registers tools via MCP server manifest. Carmenta
registers tools directly in the streamText call, dynamically based on user's connected
services.

### Migration Path

1. Copy ServiceAdapter base class and utilities
2. Copy individual adapters unchanged
3. Create thin Vercel AI tool wrapper per adapter
4. Wire up experimental_context for user/connection data
5. Register tools dynamically based on user's Nango connections

The adapters - where all the real work happens - transfer directly.

## Tool Experience

### Discovery

Tools are discovered through use, not configuration.

**Connected services**: Only tools for connected services appear. No "Gmail not
connected" errors cluttering conversations - if Gmail isn't connected, the tool isn't
available.

**Progressive disclosure**: For complex services, `action="describe"` returns operation
documentation. The LLM asks when it needs more information, not upfront.

**Contextual suggestions**: When Carmenta can't do something, suggest relevant tools. "I
can't access your calendar. Want to connect Google Calendar?"

### Execution

**Invisible when working**: If calendar is connected, Carmenta just knows your schedule.
No "invoking Google Calendar tool" noise.

**Visible when acting**: When Carmenta takes action - sends an email, creates a task -
the action is acknowledged. "I sent that email to Sarah."

**Graceful failures**: Clear explanation when things fail. Connection expired? Show
reconnection link. Rate limited? Explain when to retry. Service down? Acknowledge and
offer alternatives.

### Security Model

**Minimal scopes**: Request only what's needed. Read-only where possible.

**User control**: Connect and disconnect any time. Clear visibility into what's
connected.

**Audit trail**: Every tool invocation logged. What tool, what operation, when.

## Integration Points

- **Concierge**: Routes requests to appropriate tools based on intent
- **AI Team**: Agents inherit tools from user context
- **Scheduled Agents**: Tools available for background automation
- **Memory**: Tool usage informs context ("you usually query production database")

## Competitive Analysis (2024-12-06)

### What Competitors Have

**Lobe-Chat**: 5 builtin tools (artifacts, code interpreter, web browsing, local system,
knowledge base). Strong MCP marketplace. Gateway pattern similar to ours.

**LibreChat**: 15 tools across image generation, search, computation. Manifest-based
registry. First-class MCP support with OAuth.

**Open WebUI**: User-creatable tools via Python. Functions for pipelines. Web search,
RAG, image generation.

**Morphic**: 4 focused tools (search, video search, retrieve, clarifying questions).
Multi-provider search abstraction.

### What Everyone Misses

**Memory/persistence**: "Remember this preference" across sessions. Massively
underserved.

**Proactive suggestions**: Anticipating needs rather than just responding.

**Workspace context**: Understanding the user's codebase/project, not just conversation.

### Cargo Cult Tools to Avoid

**Weather**: Demo-ware. Looks good in screenshots, <0.1% of real usage.

**Calculator**: LLMs handle math. Dedicated tool rarely needed.

**Wolfram Alpha**: Impressive but niche. Not worth the complexity.

**Multiple search providers**: Abstraction good (we have web-intelligence provider
pattern), exposing choice to users confusing.

## Success Criteria

- Core tools work without any setup
- Connect a service in under 60 seconds
- Tool usage feels natural - no special syntax or explicit invocation
- Clear understanding of what each tool can do
- Graceful handling of failures with actionable recovery

---

## Open Questions

### Technical Specifications Needed

- ServiceAdapter base class port (from MCP Hubby)
- Tool wrapper pattern for Vercel AI SDK
- Connection lookup and tool registration flow
- experimental_context schema for user/connection data

### Product Decisions

- **Tool prioritization**: Which Tier 1 tools are MVP vs later?
- **Integration sequencing**: Which Tier 2 integrations first? Gmail/Calendar likely
  highest value.
- **MCP timeline**: When do we revisit Tier 3? What signal triggers it?

### Research Needed

- Code execution options (Pyodide browser-side vs backend sandbox)
- Image generation provider selection
- YouTube transcript API reliability
