# Integrations Connection UX

User experience for connecting, managing, and troubleshooting service integrations. The
surface layer above Service Connectivity infrastructure.

**Related**: See service-connectivity.md for OAuth architecture, Nango integration, and
credential storage. See external-tools.md for MCP ecosystem strategy.

---

## Why This Exists

Integrations are the bridge between conversation and action. Without them, Carmenta can
only talk. With them, she can read our calendar, draft emails, create tasks, search our
files—work happens inside the conversation instead of alongside it.

The integrations page is where we establish and maintain these bridges. It needs to be
dead simple: see what's available, connect what we want, know when something's wrong,
fix it quickly. The current experience leaks implementation complexity into UX—
connection states that don't match how users think, unclear distinctions between
"disconnect" and "remove," broken integrations hiding among healthy ones.

## User Mental Model

Users have one question: **Can I use this service with Carmenta?**

Three answers:

- **Yes** — it's connected and working
- **Not yet** — they haven't set it up
- **It was, but something's wrong** — needs attention

That's it. The page should reflect this mental model directly.

## Vocabulary

**Integrations** — services connected to Carmenta (Notion, Gmail, etc.). Distinct from
"connections" which are conversations/chats.

Four verbs:

| Verb           | When               | What happens                                  |
| -------------- | ------------------ | --------------------------------------------- |
| **Connect**    | First-time setup   | Establish the integration                     |
| **Reconnect**  | Fix broken         | Re-establish (OAuth expired, API key invalid) |
| **Test**       | Verify working     | Check credentials still valid                 |
| **Disconnect** | User wants it gone | Remove the integration entirely               |

Connect/disconnect is a natural pair. Reconnect clearly means "connect again." Test
provides confidence without waiting for something to break. All four work for both OAuth
and API key flows — the user doesn't need to know which auth method is involved.

## Design Principles

### Match the user's vocabulary

Users think "connected" or "not connected." They think "broken" or "needs fixing," not
"OAuth token expired."

### Surface problems, don't hide them

A broken integration shouldn't look healthy. It stays where the user expects to find it
(their integrations) but clearly signals something's wrong with an obvious action to fix
it.

### One action, clear outcome

"Disconnect" does one thing: removes the integration entirely. No soft-delete limbo. If
they want it back, they reconnect. Simple.

### Fail forward

When something goes wrong during connection, don't just show an error and leave them
stranded. Show what happened and what to try next.

## Information Architecture

Single unified list of all integrations. No separate "connected" vs "available"
sections. Visual state distinguishes connection status at a glance.

Each card displays: service icon, name, description, and available actions based on
state.

**Design Lab**: See `/app/design-lab/integrations-ux` for visual implementation.

## Connection States

Each integration has exactly one of these states:

| State           | Meaning                         | Actions Available     |
| --------------- | ------------------------------- | --------------------- |
| Connected       | Working, ready to use           | Test, Disconnect      |
| Needs Attention | Something's wrong, user can fix | Reconnect, Disconnect |
| Available       | Not yet connected               | Connect               |

Transient states (connecting, testing) show loading indicator in the action button.

"Needs Attention" covers multiple technical conditions—user sees Reconnect button
regardless of the underlying cause (OAuth expired, API key invalid, permissions
revoked). We handle the technical details; they just click Reconnect.

## Connection Flows

### First-Time Connection — OAuth

1. User clicks **Connect** on an available integration
2. Redirect to provider's OAuth consent screen
3. User authorizes requested permissions
4. Redirect back to Carmenta
5. Validate connection (test API call)
6. Success: integration becomes Connected
7. Failure: integration becomes Needs Attention

### First-Time Connection — API Key

1. User clicks **Connect** on an available integration
2. Modal opens: "Enter your [Service] API key" with link to where they get one
3. User pastes key
4. Validate against the service in real-time
5. Valid: modal closes, integration becomes Connected
6. Invalid: inline error in modal, user can retry or cancel

### Reconnection

When an integration needs attention (OAuth expired, API key invalid, permissions
revoked), Reconnect action is available.

1. User clicks **Reconnect**
2. OAuth flow or API key modal (depending on service type)
3. Integration returns to Connected state

### Disconnect

Direct action with undo safety net (no confirmation dialog):

1. User clicks **Disconnect** button
2. Integration immediately becomes Available
3. Undo toast appears: "[Service] disconnected" with **Undo** button
4. Toast auto-dismisses after 5 seconds
5. If no undo: credentials deleted from our system (Nango connection deleted)
6. If undo clicked: integration returns to previous Connected state

### Test

Connected integrations can be tested to verify they're still working:

1. User clicks **Test** button
2. We make a lightweight API call to verify credentials
3. Success: no change (already Connected)
4. Failure: integration becomes Needs Attention

## Error Handling

### OAuth Failure During Connection

- Show error in callback handler with specific issue when possible
- Integration stays in "Available" (never successfully connected)
- Clear action: "Try Again" or "Cancel"

### API Key Validation Failure

- Show error inline in the modal
- Don't close the modal—let them fix it or cancel
- Specific feedback: "Invalid key" vs "Key doesn't have required permissions"

### Service Unreachable

- If a connected service is unreachable when we try to use it:
  - Show **⚠ Service unreachable** with **[Retry]**
  - Don't immediately mark as broken (might be temporary)
  - After multiple failures: suggest checking service status

## Silent Behaviors

Users shouldn't see these—they happen automatically:

- **Token refresh**: When OAuth access token expires, silently refresh using refresh
  token. User never knows.
- **Connection validation**: Periodically verify connections are still valid (low
  frequency, not on every page load).
- **Credential cleanup**: When we detect a connection is definitively broken (revoked
  permissions, deleted account), mark it as needing attention.

## Integration Points

- **Service Connectivity**: Backend OAuth/credential management via Nango
- **Onboarding**: Initial service connection during first-run
- **Concierge**: Routes tool calls to connected services
- **AI Team**: Agents use connected services to complete tasks
- **Settings**: Integrations page lives in user settings

## Success Criteria

- Connect to a service in under 60 seconds (OAuth) or 30 seconds (API key)
- Connection status accurately reflects reality
- Broken integrations surface clearly with obvious fix actions
- Removing an integration is instant and unambiguous
- Zero confusion about what "connected" means

## What We Eliminated

**Disconnected state**: Collapsed into "not connected." If you don't want a service
active, disconnect it. If you want it back, reconnect.

**Pause functionality**: YAGNI. If we hear strong feedback that users want to disable
without removing credentials, we can add it. We won't.

**Separate sections**: No "Your Integrations" vs "Available" split. Single unified list
with visual state indicating connection status. Simpler mental model.

**Confirmation dialogs**: Disconnect uses undo toast instead of "Are you sure?" dialog.
Faster flow, recoverable mistake.

**Overflow menus**: No ⋮ menu hiding actions. All actions are direct buttons on the
card. If there's only one action, show it directly.

---

## Current Implementation Gap

The existing code has a more complex state model that needs simplification:

| Current State  | Current Behavior                               | Target State      |
| -------------- | ---------------------------------------------- | ----------------- |
| `connected`    | Working, shows in Connected                    | ✓ Connected       |
| `error`        | Bad credentials, shows in Connected with error | ⚠ Needs Attention |
| `expired`      | OAuth token expired, shows in Connected        | ⚠ Needs Attention |
| `disconnected` | Soft-deleted, still in DB, shows... somewhere? | Should not exist  |

**Key changes needed:**

1. **Eliminate soft-delete**: Currently "disconnect" soft-deletes (sets status to
   "disconnected"). Change to hard delete. User disconnects → record gone → service
   shows in Available.

2. **Collapse error/expired into "needs attention"**: User doesn't care if token expired
   vs key revoked. They care that it's broken and how to fix it. Show Reconnect button
   (works for both OAuth and API key).

3. **One action: Disconnect**: Current UI has "Disconnect" for connected services and
   "Remove" for already-disconnected. Collapse into single "Disconnect" that hard
   deletes.

4. **Fix the limbo state**: Soft-deleted services currently show... somewhere unclear.
   With hard delete, there's no limbo. Connected or not. Simple.

## Multi-Account Support (Existing)

The codebase already supports multiple accounts per service. First account becomes
default, others are selectable. UX implications:

- Services with multiple accounts show as expandable or with account switcher
- Each account has its own status and can be disconnected independently
- "Add another account" action available

**Decision needed:** How to display multiple accounts? Options:

- Separate card per account (clutters UI)
- Single card with account dropdown (compact, harder to see status per account)
- Single card expandable to show accounts (balanced)

## Rollout Tiers (Existing)

Services have rollout status: `available`, `beta`, `internal`. Only users with
appropriate Clerk metadata flags see beta/internal services. The integrations list
respects this gating—users only see services they have access to.

---

## Open Questions

### Product Decisions

- **Multiple accounts display**: How to show multiple accounts for one service? See
  options above.

- **Integration settings**: Some services have configuration (which Notion workspace,
  which Slack channels). Where does this live? Expandable card section? Separate modal?

- **Permission visibility**: Should users see what permissions each integration has?
  "Notion: Read and write pages" — helpful or noise?

### Technical Specifications Needed

- Migration path: existing "disconnected" records → hard delete
- Error categorization: which API errors trigger "needs attention" vs silent retry
- State machine simplification (available → checking → connected ↔ needs_attention →
  available)

### Deferred

- Team/shared integrations: Can team members share service connections? Deferred until
  we have team accounts.
