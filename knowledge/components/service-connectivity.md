# Service Connectivity

Native integrations with external services - the connective tissue that lets Carmenta
access your tools, data, and accounts. One subscription covers full connectivity. MCP
servers remain supported for custom integrations.

## Why This Exists

AI assistants that can't access your actual tools are limited to conversation. Real
productivity requires reaching into Gmail, Calendar, Notion, GitHub, and the other
services where work actually happens.

Current solutions are fragmented. ChatGPT plugins came and went. MCP is promising but
requires technical setup. Most users just copy-paste between AI and their tools.

Carmenta provides native, seamless integrations. Connect once, use everywhere. The AI
can read your calendar, draft emails, check GitHub issues, search your Notion - without
leaving the conversation.

## Core Functions

### Connection Management

- OAuth flows for supported services
- Credential storage and refresh
- Connection status visibility
- Disconnect and reconnect capabilities

### Service Operations

Execute actions across connected services:
- **Read**: Fetch emails, calendar events, documents, issues
- **Write**: Send messages, create tasks, update records
- **Search**: Find content across connected services

### Native Integrations

Priority services based on vision.md:
- **Productivity**: Notion, ClickUp, Miro, Linear
- **Communication**: Gmail, Slack, LinkedIn, X/Twitter
- **Storage**: Google Drive, Dropbox
- **Media**: YouTube, Instagram, Google Photos, Spotify
- **AI/Data**: Limitless, Fireflies.ai, Exa
- **Dev/Ops**: GitHub, Sentry
- **Finance**: Monarch Money, CoinMarketCap
- **Calendar/Contacts**: Google Calendar, Google Contacts

### MCP Support

For services without native integration or custom internal tools:
- Connect user-provided MCP servers
- Standard MCP protocol support
- Tool discovery and invocation

## Integration Points

- **Concierge**: Routes service requests, understands what's available
- **AI Team**: Agents use services to complete tasks
- **Scheduled Agents**: Automated workflows across services
- **Memory**: Service data can inform context
- **Interface**: Shows connection status, OAuth flows

## Success Criteria

- Connect to a service in under a minute
- Service operations feel instant (appropriate caching/prefetch)
- Clear feedback when operations succeed or fail
- Users understand what Carmenta can access
- Security: minimal scopes, encrypted credentials, audit logging

---

## Open Questions

### Architecture

- **Integration approach**: Build each integration natively? Use unified API platforms
  (Merge, Unified.to, Nango)? What's the build vs. buy tradeoff?
- **MCP Hubby integration**: We have existing MCP infrastructure. How does native
  connectivity relate to that? Replace, complement, or wrap it?
- **Credential management**: Where do OAuth tokens live? How do we handle refresh?
  Multi-user credential isolation?
- **Rate limiting and quotas**: How do we handle API limits across services? Queue
  management? User feedback when limited?

### Product Decisions

- **Service prioritization**: Which integrations are MVP vs. later? What do target users
  need most urgently?
- **Scope granularity**: Do users control exactly what permissions each service gets? Or
  keep it simple with sensible defaults?
- **Shared vs. individual**: Can team members share service connections? Or always
  per-user?
- **Service discovery**: How do users find out what Carmenta can connect to? Prominent
  showcase vs. discovered through use?

### Technical Specifications Needed

- Service adapter interface (common contract for all integrations)
- OAuth flow implementation for each provider
- Credential storage schema and encryption approach
- MCP server registration and management
- Error handling and retry patterns per service

### Research Needed

- Evaluate unified API platforms (Merge, Unified.to, Nango, Paragon)
- Audit OAuth scopes needed for each priority service
- Study how Zapier/Make handle multi-service authentication
- Research MCP adoption and ecosystem maturity
- Security review of credential storage patterns
