# External Tools

MCP ecosystem strategy and future vision for tool extensibility.

**Related**: See tools.md for current tool architecture, inventory, and implementation
decisions. See service-connectivity.md for OAuth/Nango patterns.

---

Connecting Carmenta to tools and services beyond conversation. The layer that lets your
AI actually do things in the world.

## Why This Exists

Every AI interface hits a wall. You ask it to check your calendar, pull data from your
CRM, or run a script - and it apologizes. "I don't have access to that." The underlying
intelligence is there; the connections aren't.

MCP (Model Context Protocol) solved the technical problem - a standard way for AI to
connect to tools and services. But MCP is infrastructure, not experience. Installing an
MCP server means editing JSON config files, running commands, managing dependencies. The
people who need external tools most are least equipped to set them up.

Carmenta abstracts the complexity. We don't talk about "MCP servers" - we talk about
tools. Can Carmenta read your email? Check your analytics? Query your database? These
are questions about what your AI can do, not what protocols it speaks.

The underlying technology remains MCP. We benefit from the ecosystem - any MCP server
works with Carmenta. But the experience is human-first: discover tools that matter,
enable them with a click, use them through natural conversation.

## Design Philosophy

### Function, Not Configuration

We frame this around what you gain, not what you install:

- "Enable email access" not "Install Gmail MCP server"
- "Connect to Notion" not "Configure stdio transport"
- "Add web browsing" not "Set up Puppeteer with headless Chrome"

The function is the unit of value. The implementation is hidden until you need it.

### Trust Through Transparency

Extending AI access creates legitimate security concerns. We handle this through:

**Clear tool descriptions**: What exactly can this do? Read emails? Send them? Delete
them? Specific, honest descriptions - not vague "full access" language.

**Permission boundaries**: Tools request specific permissions. Email reading and email
sending are separate, not bundled.

**Audit visibility**: What has Carmenta done with each tool? Recent actions visible, not
hidden in logs.

**Reversibility**: Disconnect any tool instantly. Credentials are revoked, not just
hidden.

### Curated Over Chaotic

The MCP ecosystem is growing fast. Not every MCP server is well-built, secure, or
useful. We curate:

**Featured tools**: Tested, documented, maintained. These work reliably.

**Community tools**: User-contributed, with ratings and reviews. May require more
technical comfort.

**Custom tools**: For technical users who want to connect their own MCP servers. Full
flexibility, no hand-holding.

This tiered approach serves different users without forcing everyone into technical
complexity or limiting advanced users.

## Core Functions

### Discovery

Finding tools that matter to you:

**Tool library**: Browse featured tools organized by category - productivity,
communication, development, data, media. Each with clear description of what it enables.

**Contextual suggestions**: When Carmenta can't do something you ask, suggest relevant
tools. "I can't access your calendar yet. Want to enable Google Calendar?"

**Search**: Find tools by what you want to do, not by technical name. "database"
surfaces PostgreSQL, MySQL, MongoDB options without requiring you to know which.

### Enabling

Connecting tools to your Carmenta:

**One-click setup** for featured tools: OAuth flow for services, guided installation for
local tools. No JSON editing, no command-line.

**Configuration when needed**: Some tools require choices. Database connection strings.
API endpoints. Presented as simple forms, not config files.

**Testing on connect**: Verify the tool works before saving. Clear success/failure
feedback with actionable guidance when things go wrong.

### Management

Understanding and controlling what's connected:

**Tool overview**: All enabled tools in one view. Status (connected, disconnected,
error), last used, permissions granted.

**Usage history**: What has Carmenta done with each tool? Recent actions, not just "was
used 5 times."

**Quick controls**: Disable, reconnect, remove. No hunting through settings.

**Permission management**: Review and modify what each tool can do. Revoke specific
permissions without full disconnect when possible.

### Using External Tools

How tools appear in conversation:

**Invisible when working**: If Carmenta has calendar access, it just knows your
schedule. You don't see "invoking Google Calendar MCP server."

**Visible when relevant**: When Carmenta takes action - sends an email, creates a task,
runs code - the action is acknowledged. "I sent that email to Sarah."

**Graceful degradation**: When a tool fails, clear explanation and options. Not cryptic
errors, not silent failure.

## Tool Categories

### Productivity Tools

- **Document services**: Notion, Google Docs, Dropbox Paper
- **Task management**: ClickUp, Linear, Todoist, Asana
- **Note systems**: Obsidian vault access, Apple Notes

### Communication

- **Email**: Gmail, Outlook (read, draft, send with appropriate permissions)
- **Messaging**: Slack (read channels, send messages)
- **Calendar**: Google Calendar, Outlook Calendar

### Development

- **Repositories**: GitHub, GitLab (issues, PRs, code search)
- **Databases**: PostgreSQL, MySQL, SQLite (query, with appropriate read/write controls)
- **Code execution**: Sandboxed Python, JavaScript, shell

### Data & Analytics

- **Spreadsheets**: Google Sheets, Airtable
- **Analytics**: Google Analytics, Mixpanel, PostHog
- **APIs**: Custom REST/GraphQL endpoints

### Media & Content

- **Storage**: Google Drive, Dropbox, S3
- **Images**: Upload, analyze, generate
- **Video**: YouTube metadata and transcripts

### System & Local

- **File system**: Local file access (with directory boundaries)
- **Browser**: Web browsing and research
- **Commands**: Shell execution (sandboxed)

## Integration Points

- **Concierge**: Routes requests to appropriate tools, understands what's available
- **AI Team**: Agents inherit tools from user context
- **Service Connectivity**: Native integrations appear alongside MCP-based tools -
  seamless from user perspective
- **Memory**: Tool usage informs context ("you usually query the production database")
- **Scheduled Agents**: Tools available to background automation

## Security Model

### Credential Handling

Credentials never touch Carmenta's core. They flow directly to tool services, encrypted
at rest, never logged. OAuth tokens refresh automatically. API keys are stored encrypted
with user-specific keys.

### Sandboxing

Tools run isolated. A compromised tool can't access other tools. Network boundaries,
filesystem restrictions, resource limits.

### Permission Scopes

Every tool declares what it needs:

- **read**: View data only
- **write**: Create or modify data
- **delete**: Remove data
- **execute**: Run code or commands

Users grant specific scopes, not blanket access. Carmenta requests only what's needed
for the task at hand.

### Audit Trail

Every tool invocation logged:

- What tool
- What operation
- What inputs (sanitized)
- What result
- When

Accessible to users for transparency. Retained for debugging and accountability.

## User Experience

### First Connection

When enabling a tool for the first time:

1. Clear explanation of what it does and why you might want it
2. Permissions requested with specific descriptions
3. OAuth flow or credential entry
4. Connection test with success feedback
5. Tool available immediately in conversation

Total time: Under 60 seconds for OAuth-based tools.

### Ongoing Use

Tools are ambient, not invoked:

- "What's on my calendar tomorrow?" just works (calendar enabled)
- "Summarize that document" just works (Google Drive enabled)
- "Check the latest errors in Sentry" just works (Sentry enabled)

No special syntax, no tool prefixes, no explicit selection. Natural language, Carmenta
routes appropriately.

### Error States

When tools fail, we communicate clearly:

**Connection lost**: "I lost connection to your Gmail. Want me to try reconnecting?"

**Permission denied**: "I don't have permission to send emails, only read them. Want to
update permissions?"

**Service down**: "Google Calendar isn't responding right now. I'll try again in a few
minutes."

**Tool removed**: "I no longer have access to Notion. Let me know if you want to
reconnect."

## Future: Visual Tool Interfaces (MCP Apps)

MCP Apps (SEP-1865) is an emerging extension to the Model Context Protocol that enables
interactive user interfaces for MCP tools. Currently in draft specification, co-authored
by Anthropic and OpenAI core teams.

### What MCP Apps Enables

**Visual tool experiences**: Instead of tools returning text or JSON that Carmenta must
interpret, tools can deliver purpose-built interactive interfaces. A data visualization
tool provides an interactive chart component. A form-builder tool renders the actual
form. A calendar tool shows visual availability.

**Technical approach**: HTML-based UIs in sandboxed iframes, communicating via JSON-RPC
(same protocol as base MCP). Pre-declared UI resources using `ui://` URI scheme allow
host prefetch and security review before execution.

**Security model aligns with our philosophy**: Iframe sandboxing, pre-declared templates
for review, auditable messages, user consent for UI-initiated actions. Defense-in-depth
matches our transparency approach.

### Strategic Implications

**Differentiation opportunity**: Competitors (LobeChat, LibreChat) support MCP but only
text-based tool interactions. Visual, interactive tool experiences would be
differentiated capability.

**Complements AG-UI**: AG-UI handles response rendering (restaurant query → rich card).
MCP Apps handles tool interfaces (data analysis tool → interactive visualization). Two
complementary layers of the interface.

**Aligns with positioning**: "The best connection to AI" includes the best interface to
AI tools. Visual tool experiences strengthen this positioning.

### Implementation Considerations

**Timing**: Specification is draft but backed by major players (Anthropic, OpenAI) with
existing implementations (Postman, Shopify, HuggingFace, ElevenLabs). Early adopter
advantage possible, but spec finalization risk exists.

**Architecture**: Requires iframe sandbox implementation, integration with AG-UI
response rendering, security review of communication patterns. Desktop vs web
considerations for iframe capabilities.

**Product decision needed**: MVP capability or post-launch enhancement? Does this change
external tools roadmap sequencing? Featured tools showcase visual experiences as key
differentiator?

**Reference**: SEP-1865 pull request at
https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1865

---

## Success Criteria

- Enable any featured tool in under 60 seconds
- Clear understanding of what each tool can and cannot do
- No JSON editing, command-line work, or technical configuration for standard use
- Tool usage feels natural - no special syntax or explicit invocation
- Security controls visible and understandable without being intrusive
- Graceful handling of failures with actionable recovery paths

---

## Open Questions

### Architecture

- **MCP transport strategy**: Which transports do we support? stdio for local, SSE for
  remote? streamable-http for modern servers? How do we abstract transport selection?
- **Server lifecycle**: Who manages MCP server processes? Desktop app can spawn
  subprocesses; web needs backend proxy. How unified is the abstraction?
- **Multi-user isolation**: Per-user MCP connections with their own credentials. How do
  we handle connection pooling and resource limits?
- **Tool registry**: How do we maintain the featured tool catalog? Manual curation?
  Community submissions? Automated testing?

### Product Decisions

- **External tools vs. service connectivity**: Service Connectivity provides native
  integrations. External Tools provides MCP-based extensions. Is the distinction visible
  to users or transparent? Should native Gmail appear alongside MCP Gmail?
- **Pricing implications**: Do tools count against usage? Are some premium? Is there a
  tool limit per tier?
- **Community marketplace**: Do we host community tools, or point to external registries
  (Smithery, LobeHub)? Curation burden vs. ecosystem access.
- **Desktop vs. web parity**: Some tools only make sense locally (file system, local
  databases). How do we handle web-only users?

### Technical Specifications Needed

- MCP client implementation and connection management
- Tool registry schema and API
- Permission model and scope definitions
- Credential storage and encryption approach
- Tool testing and health check framework
- Audit logging schema and retention policy

### Research Needed

- Evaluate MCP hosting solutions (for web users who can't run local servers)
- Study LobeChat's marketplace model for tool curation patterns
- Research LibreChat's multi-user MCP isolation approach
- Security audit of MCP protocol and common server implementations
- Performance analysis of MCP overhead per request
- **MCP Apps (SEP-1865) evaluation**: Review draft specification, assess iframe sandbox
  security, evaluate integration patterns with AG-UI, analyze reference implementations
  from Postman/Shopify/HuggingFace, determine timing for adoption (early vs post-MVP)

---

## Competitor Insights

### LobeChat Approach

LobeChat built an MCP Marketplace - a curated catalog with one-click installation.
Discovery is excellent: browse by category, search by function, see ratings and usage.
Installation reduces to clicking "Add" for many tools.

Strengths:

- Discovery-first experience - browse what's possible
- One-click for marketplace tools
- Visual status indicators
- Agent-level tool assignment

Weaknesses:

- Still exposed as "MCP plugins" - technical framing
- Configuration still required for many tools
- Limited abstraction over the underlying protocol

### LibreChat Approach

LibreChat integrates with Smithery.ai as external marketplace, plus manual YAML config.
More enterprise-focused with OAuth support for MCP servers and multi-user credential
isolation.

Strengths:

- Multi-user credential isolation
- OAuth flow for secure tool auth
- Status indicators (connected, error, initializing)
- Agent and non-agent endpoint support

Weaknesses:

- Requires external marketplace (Smithery)
- Manual YAML editing for custom tools
- Technical terminology throughout ("MCP servers", "stdio transport")

### Our Differentiation

Neither competitor has fully solved the "MCP is too geeky" problem. Both still frame
tools in technical terms. Both require some technical comfort for anything beyond
pre-configured options.

Carmenta's opportunity: Complete abstraction for featured tools. You don't know MCP
exists unless you want to. Natural language discovery ("what can you connect to?"). Tool
suggestions in context of failed requests. Human-first framing throughout.

**Visual tool experiences**: With MCP Apps support, Carmenta could deliver interactive
tool UIs while competitors remain text-only. Data visualizations render as interactive
charts, not JSON dumps. Form-based tools show actual forms, not text-based prompts. This
strengthens "best connection to AI" positioning.

For technical users: Full MCP access remains available. Custom servers, advanced config,
direct protocol access. But the default experience assumes no technical knowledge.
