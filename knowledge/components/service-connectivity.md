# Service Connectivity

In-house OAuth and credential management for user-connected services.

**Related**: See tools.md for tool architecture and tier decisions. See
external-tools.md for MCP ecosystem strategy.

---

Native integrations with external services - the connective tissue that lets Carmenta
access your tools, data, and accounts. One subscription covers full connectivity. MCP
servers remain supported for custom integrations.

## Why This Exists

AI assistants that can't access our actual tools are limited to conversation. Real
productivity requires reaching into Gmail, Calendar, Notion, GitHub, and the other
services where work actually happens.

Current solutions are fragmented. ChatGPT plugins came and went. MCP is promising but
requires technical setup. Most of us just copy-paste between AI and our tools.

Carmenta provides native, seamless integrations. Connect once, use everywhere. The AI
can read our calendar, draft emails, check GitHub issues, search our Notion - without
leaving the conversation.

## Architecture Decision (2024-12-14)

**Service OAuth Platform**: In-House

### Why We Moved Away From Nango

We initially chose Nango for its promise of simplified OAuth management. After
implementation, we discovered critical limitations:

- **Slack user_scope bug**: Nango's Slack integration uses `scope` parameter (bot
  tokens) instead of `user_scope` parameter (user tokens). Users couldn't connect Slack
  to act as themselves - only as a bot. This is fundamental to Carmenta's identity as a
  tool that acts AS the user, not ON BEHALF of the user.
- **Limited OAuth URL control**: No way to customize authorization URL parameters for
  provider-specific requirements.
- **Visual mismatch**: Nango's Connect UI didn't match Carmenta's design quality.
- **External dependency on critical path**: OAuth failures blocked users from core
  functionality, and we couldn't debug or fix Nango issues ourselves.

### Why In-House Is Better

- **Full control over OAuth URLs**: Handle provider quirks (Slack user_scope, Google
  consent screens, etc.)
- **Beautiful custom UI**: Modals that match Carmenta's design language
- **One less vendor**: Fewer external dependencies on critical path
- **Unified credential storage**: OAuth tokens stored same as API keys (encrypted)
- **Direct API calls**: Simpler debugging, no proxy abstraction layer
- **Cost reduction**: No Nango fees at scale

See `knowledge/decisions/infrastructure-stack.md` for full infrastructure rationale.

## Core Behaviors

### Connection Flow

When a user initiates a service connection:

1. **Service Selection**: User chooses a service from the integrations settings page or
   is prompted when Carmenta needs a capability
2. **Information Display**: Before OAuth, show what this connection enables (what
   Carmenta can do) and what permissions are required (scopes being requested)
3. **OAuth Flow**: User is redirected to the service's authorization page in a new tab
   or modal
4. **Callback Processing**: On return, validate the OAuth response, exchange code for
   tokens, encrypt and store credentials
5. **Success Confirmation**: Return user to Carmenta with clear confirmation of what's
   now connected

### Account Identification

Each connected service must capture a human-readable account identifier. This is what
appears in the settings UI ("nick@carmentacollective.com" not "connection_123abc").

**Provider-specific identifiers**:

- Gmail/Google: Email address from token's `id_token` or userinfo endpoint
- Slack: Workspace name + user display name
- Notion: Workspace name
- GitHub: Username
- LinkedIn: Profile name
- ClickUp: Workspace name + user name

### Multi-Account Support

Users need to connect multiple accounts for the same service (work Gmail + personal
Gmail, multiple Slack workspaces). The system supports:

- Multiple connections per service per user
- One "default" account per service (used when user doesn't specify)
- Account nicknames for disambiguation (e.g., "Work" vs "Personal")
- Clear visual distinction between accounts in settings
- In conversation, users can reference accounts naturally: "check my work email" or
  "post to the dev Slack"

### Token Lifecycle

**Storage**: All credentials (OAuth tokens and API keys) encrypted with AES-256-GCM
before storage. Encryption key from environment variable, separate from database.

**Token Refresh**: Before making API calls with OAuth tokens:

1. Check if access token expires within the next 5 minutes
2. If expiring soon, use refresh token to get new access token
3. Update stored credentials with new tokens
4. Handle refresh token rotation (some providers issue new refresh tokens on each
   refresh)
5. If refresh fails, mark connection as expired and notify user

**Disconnect Handling**: When a service notifies us of revocation (webhook) or when
refresh fails:

1. Mark connection status as "disconnected" or "expired"
2. Show clear indicator in settings UI
3. On next use attempt, prompt user to reconnect
4. Preserve connection record for easy re-authentication

### Provider-Specific Behaviors

**Slack**: Requires `user_scope` parameter (not `scope`) to get user tokens (xoxp-)
rather than bot tokens (xoxb-). User tokens allow acting as the user. Supports refresh
token rotation.

**Google (Gmail, Calendar, Drive, etc.)**: Requires consent screen configuration. May
need to handle "offline" access type for refresh tokens. Tokens can be large (~2KB).

**Notion**: OAuth 2.0 standard flow. Access to specific pages/databases based on user
selection during auth.

**GitHub**: Standard OAuth. Consider whether we need fine-grained PAT permissions vs.
OAuth scopes for repository access.

## User Experience

### Settings Page

The integrations settings page is where users manage all their connected services:

- **Connected services** shown prominently with account identifiers and status
- **Available services** shown with clear "Connect" actions
- **Service details** expandable to show what's connected, what permissions are granted
- **Disconnect action** with confirmation (warn about impact on Carmenta capabilities)
- **Reconnect action** for expired/disconnected services (preserves history)

### Connection Modal

When initiating a connection, present a modal that:

- Shows the service logo and name
- Explains what Carmenta will be able to do with this connection
- Lists the permissions being requested (translated from OAuth scopes to human terms)
- For re-authentication, reminds user this is reconnecting an existing account
- Has clear "Connect" and "Cancel" actions
- Handles OAuth popup/redirect flow gracefully

### In-Conversation Prompts

When Carmenta needs a service that isn't connected:

- Explain why the connection is needed for the current task
- Offer to initiate the connection flow
- If user declines, gracefully continue without that capability
- Remember declined services to avoid repeated prompts in same session

### Status Indicators

Connection status should be visible and actionable:

- **Connected**: Green indicator, shows account identifier
- **Expired**: Yellow indicator, prompts to reconnect
- **Error**: Red indicator, shows what went wrong
- **Disconnected**: Gray indicator, user or service revoked

### Error Handling

When service operations fail:

- **Rate limited**: Inform user, suggest waiting or trying again later
- **Permission denied**: Explain what permission is missing, offer to reconnect with
  expanded scope
- **Service unavailable**: Inform user the service is having issues
- **Token expired**: Transparently attempt refresh, only surface to user if refresh
  fails

## Native Integrations

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

- Connect to a service in under 30 seconds
- Beautiful, Carmenta-branded connection experience (not generic OAuth popups)
- Clear understanding of what Carmenta can do with each connection
- Service operations feel instant (appropriate caching/prefetch)
- Clear feedback when operations succeed or fail
- Users understand what Carmenta can access
- Security: minimal scopes, encrypted credentials, audit logging

---

## Open Questions (Not Yet Figured Out)

### Scope Granularity

How granular should permission requests be?

- **Option A: Kitchen sink**: Request all potentially useful scopes upfront. Simpler
  implementation, but users might balk at permissions they don't understand.
- **Option B: Progressive**: Start with minimal scopes, request additional scopes when
  specific features are used. Better UX but more complex.
- **Option C: Tiered**: Offer "basic" and "full access" options. Let user choose their
  comfort level.

**Leaning toward**: Progressive (Option B) aligns with "minimal scopes" success criteria
but implementation complexity is unknown.

### Webhook Infrastructure

How do we receive disconnect notifications from services?

- Need publicly accessible webhook endpoints
- Each provider has different webhook signature verification
- Some providers (Slack) send multiple event types we may want to handle
- Need to handle webhook delivery failures (retries, idempotency)

**Not yet designed**: Webhook endpoint routing, signature verification per provider,
event handling architecture.

### Refresh Token Race Conditions

When multiple concurrent requests need to refresh the same token:

- How do we prevent multiple simultaneous refresh attempts?
- Database-level locking? In-memory mutex? Token refresh queue?
- What happens if refresh succeeds for one request but fails for another?

**Not yet designed**: Concurrency control for token refresh.

### Consent Screen Management

For Google services specifically:

- How do we handle unverified app warnings?
- Do we need to go through Google's verification process?
- How do we test OAuth flows before verification?

**Needs research**: Google OAuth app verification requirements and timeline.

### Service Adapter Pattern

What's the common interface for all service integrations?

- How much abstraction is helpful vs. harmful?
- Do we want a unified "send message" action that works across Slack, Gmail, LinkedIn?
- Or service-specific actions that expose full capability?

**Not yet designed**: Adapter interface contract, action normalization vs. pass-through.

### Error Recovery UX

When a service connection fails mid-task:

- Should Carmenta automatically retry the connection flow?
- How do we preserve the user's original intent while fixing the connection?
- Should we offer alternative approaches that don't require the broken service?

**Not yet designed**: Graceful degradation and recovery patterns.

### Audit Logging

For security and debugging:

- What service access should we log?
- How long do we retain logs?
- Should users be able to see their own access history?
- How do we handle PII in logs?

**Not yet designed**: Logging schema, retention policy, user visibility.

---

## Technical Specifications Needed

Before implementation:

1. **Provider configuration schema**: How do we store OAuth endpoints, scopes, and
   quirks for each provider?
2. **Callback URL routing**: `/api/oauth/[provider]/callback` vs.
   `/api/connect/callback` with provider in state?
3. **State parameter structure**: What data do we encode? How do we verify?
4. **Token encryption key rotation**: How do we rotate keys without invalidating all
   stored credentials?
5. **Database schema updates**: Current schema supports this architecture, but may need
   refinements for webhook tracking, refresh scheduling.

---

## Historical Context

This architecture replaces an earlier Nango-based approach. The key learning: OAuth is
critical path functionality where we need full control. External dependencies that work
90% of the time are worse than no dependency - the 10% failures happen at the worst
times and we can't fix them ourselves.

The Slack `user_scope` issue was the final straw, but the broader lesson applies:
commoditized OAuth libraries promise simplicity but create invisible constraints. When
those constraints conflict with product requirements (acting AS the user vs. AS a bot),
we're stuck.

Building in-house is more work upfront but gives us:

- Full debugging capability when things go wrong
- Ability to handle any provider's quirks
- UI/UX that matches Carmenta's quality bar
- No vendor dependency on critical path
- Cost control at scale
