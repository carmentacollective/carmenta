# Tool Approval and Human-in-the-Loop

Safe agent operations that require user verification before taking real-world actions.
The pattern that makes powerful capabilities trustworthy.

**Related**: [AI Team](../ai-team.md), [God Mode](../god-mode.md),
[Service Connectivity](../service-connectivity.md)

---

## Why This Exists

AI that can take real-world actions creates a fundamental tension: the more capable the
agent, the more potential for unintended consequences. Deleting files, sending messages,
modifying production data, financial transactions. These actions are valuable precisely
because they have real effects, but real effects require appropriate oversight.

The research is clear: agents operating without human oversight face four major
vulnerabilities:

- Fabricated commands or non-existent resource identifiers
- Permission misuse through ambiguous instructions
- Attempting to bypass or escalate their own access levels
- Complete absence of decision accountability trails

Tool approval solves this by creating explicit checkpoints where humans verify before
agents act. Not every action needs approval. The art is in classification: what's safe
to auto-execute, what needs a pause, and what requires explicit confirmation.

The heart-centered principle applies here too: transparency builds trust. When Carmenta
shows you what it's about to do and waits for your okay, it's not being annoying. It's
being honest about the weight of the action.

## User Stories

**As a user connecting services**, I want to understand what actions Carmenta can take
with my connections and approve sensitive operations before they execute, so I maintain
control over my digital identity.

**As a user in flow state**, I don't want to be interrupted for routine, low-risk
actions that I've implicitly authorized through my preferences, so I can maintain
productive momentum.

**As a user who disconnected mid-conversation**, I want my pending approvals preserved
when I reconnect, so I don't lose work or create duplicate actions.

**As a user working with the AI Team**, I want to set autonomy levels per agent and per
action type, so routine work happens automatically while sensitive work gets my
attention.

**As a user reviewing past actions**, I want to see what was approved, when, and why, so
I can audit my agent's behavior and adjust trust levels.

**As a user who made a mistake**, I want to cancel in-progress actions before they
complete, so errors can be caught before they have real-world effects.

## Autonomy Levels

Carmenta operates across a spectrum of autonomy, drawn from industry research on
human-AI interaction patterns:

### Level 1: Manual

Nothing happens without explicit user action. Every tool execution requires approval.
Useful for new connections, sensitive contexts, or users who prefer full control.

### Level 2: Assisted

Carmenta surfaces context-aware suggestions and prepares actions, but users confirm
before execution. The AI does the work of understanding what's needed. Users make the
final call.

### Level 3: Partial

Carmenta acts for low-risk, well-understood operations. Asks for approval on anything
novel, ambiguous, or above a risk threshold. The default for most users.

### Level 4: Conditional

Carmenta operates independently within defined boundaries. These boundaries are
user-configured: specific action types, specific integrations, specific time windows.
Outside boundaries, it falls back to approval.

### Level 5: Full Bounded

Carmenta operates autonomously in a closed domain. Used in [God Mode](../god-mode.md)
for trusted friends after the progressive trust period. Still has hard limits (financial
transactions, legal commitments, destructive actions).

### Progressive Autonomy

Users don't start at Level 5. Trust is earned through demonstrated reliability:

| Phase           | Duration  | Behavior                                                            |
| --------------- | --------- | ------------------------------------------------------------------- |
| Draft Mode      | Weeks 1-2 | AI prepares actions, user approves before execution                 |
| Supervised Mode | Weeks 3-4 | Low-stakes actions execute, user notified immediately               |
| Autonomous Mode | Week 5+   | Routine operations autonomous, daily digest, escalation for unusual |

This mirrors the [God Mode](../god-mode.md) progressive autonomy model but applies
across all tool usage, not just messaging.

## Tool Classification

Tools are classified into tiers based on reversibility, impact, and risk:

### Safe Tools (Always Execute)

Read-only operations with no side effects. Auto-execute at all autonomy levels.

- Web search and page fetch
- Reading calendar events
- Searching email (not sending)
- Querying Notion pages
- Checking weather
- Viewing task lists
- Knowledge base search

### Sensitive Tools (Approval at Level 1-2)

Actions with real effects that are generally reversible or low-stakes. Auto-execute at
Level 3+ unless user has configured stricter oversight.

- Creating calendar events
- Creating tasks in ClickUp
- Creating Notion pages
- Sending Slack messages to channels (not DMs)
- Posting to X/Twitter
- Creating files in Dropbox

### High-Stakes Tools (Approval at Level 1-3)

Actions with significant effects that may be difficult to reverse. Require approval
below Level 4.

- Sending emails
- Sending direct messages
- Modifying existing documents
- Deleting files
- Updating calendar events (changing times, canceling)
- Committing code

### Dangerous Tools (Always Require Confirmation)

Actions with irreversible or highly consequential effects. Always require explicit
confirmation, even at Level 5. Use modal confirmation, not inline.

- Sending messages as the user (God Mode)
- Financial transactions
- Legal commitments (accepting terms, signing)
- Account deletions
- Bulk deletions
- Publishing content publicly

### Dynamic Classification

Some tools have variable risk based on parameters:

```
needsApproval: async ({ command }) => command.includes("rm -rf")
```

The Vercel AI SDK v6 pattern: approval can be a boolean OR a function that evaluates the
specific parameters. This allows nuanced control without over-categorizing.

Examples of dynamic approval triggers:

- `rm` command: safe for temp files, dangerous for system directories
- Email send: safe for replies, approval required for cold outreach
- Slack message: safe for channels, approval required for DMs to executives
- Code commit: safe for branches, approval required for main

## Approval UX Patterns

### Inline Approval (Default)

For most approvals, the request appears inline in the conversation flow:

```
Carmenta is about to:
  [Icon] Send email to john@example.com
  Subject: "Meeting follow-up"
  [Preview of content...]

  [Approve] [Edit] [Cancel]
```

Key principles:

- Show exactly what will happen (not "send an email" but "send THIS email to THIS
  person")
- Provide full preview of content where applicable
- Allow editing before approval (not just approve/reject binary)
- Keep the conversation context visible. Don't hide behind a modal for routine approvals

### Modal Confirmation (Dangerous Actions)

For dangerous tools, interrupt the flow with a modal that demands attention:

- Full-screen or centered overlay
- Clear warning about irreversibility
- Explicit confirmation (not just a button. Require typing "CONFIRM" for truly dangerous
  actions)
- Escape route always visible

### Batch Approval

When an agent proposes multiple related actions, allow approving them as a group:

```
Carmenta is about to:
  [x] Create calendar event: "Design Review" on Thursday at 2pm
  [x] Send invite to 3 attendees
  [x] Create Notion page: "Design Review Agenda"

  [Approve All] [Review Individually] [Cancel All]
```

"Review Individually" expands to per-item approval. Users can approve some, modify
others, reject some.

### Voice Approval

When using voice interface, approvals must work without screen:

- Clear audio description of proposed action
- Simple voice commands: "Yes" / "No" / "Tell me more"
- Fallback to screen for complex previews
- Never auto-execute on voice ambiguity

## State Management

### Pending Approvals

Approvals that are awaiting user response:

- Stored in database, not just in-memory
- Associated with the conversation/message that triggered them
- Timestamped for timeout handling
- Include full context needed to execute (parameters, credentials reference)

### Approval Timeout

Approvals don't wait forever:

| Tool Type   | Timeout    | On Expiry                     |
| ----------- | ---------- | ----------------------------- |
| Safe        | N/A        | Auto-execute                  |
| Sensitive   | 24 hours   | Expire, notify user           |
| High-Stakes | 1 hour     | Expire, notify user           |
| Dangerous   | 15 minutes | Expire, require re-initiation |

Expired approvals surface in the conversation: "This action timed out. Let me know if
you still want to proceed."

### Reconnection Persistence

Critical lesson from CopilotKit: HITL state must survive reconnection.

When user disconnects:

1. Pending approvals are preserved in database
2. Execution is paused (not cancelled)
3. State includes: proposed action, parameters, conversation context, timestamp

When user reconnects:

1. Check for pending approvals
2. Resume the approval UI where they left off
3. Refresh any time-sensitive data (e.g., calendar conflicts may have changed)
4. Respect timeout. If expired, notify and offer to retry

This is especially important for mobile/PWA where connections are unreliable.

### Approval States

```
┌─────────────┐
│   PENDING   │ ──── User hasn't responded yet
└──────┬──────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
┌──────┐ ┌──────────┐
│APPROVED│ │ REJECTED │
└───┬───┘ └────┬─────┘
    │          │
    ▼          ▼
┌──────────┐ ┌──────────┐
│ EXECUTING│ │ CANCELLED│
└────┬─────┘ └──────────┘
     │
 ┌───┴───┐
 │       │
 ▼       ▼
┌──────┐ ┌──────┐
│SUCCESS│ │ ERROR│
└──────┘ └──────┘
```

All state transitions are logged for audit trail.

## Progressive Trust

The system learns from user behavior to reduce friction over time:

### Implicit Trust Signals

- Approving the same action type repeatedly. After N approvals of "send Slack message to
  #general", suggest auto-approving that pattern
- Fast approvals (< 2 seconds) suggest the user considers this low-risk
- Edits before approval suggest the user wants more control. Don't auto-approve this
  pattern

### Explicit Trust Configuration

Users can configure approval preferences:

| Dimension   | Options                                     |
| ----------- | ------------------------------------------- |
| Action type | "Auto-approve all calendar creates"         |
| Integration | "Always ask before using Twitter"           |
| Contact     | "Auto-approve messages to my team"          |
| Time        | "Ask during work hours, auto-approve after" |
| Confidence  | "Ask if AI confidence < 90%"                |

### Trust Decay

Trust isn't permanent:

- If user starts rejecting previously auto-approved actions, revert to asking
- After security events (password changes, suspicious activity), reset to conservative
- After long inactivity (30+ days), re-confirm trust levels

## Bulk Operations

For operations that affect multiple items:

### Preview and Sampling

When an agent proposes "delete all completed tasks", don't just show a count:

- Show a sample of what will be affected (first 5-10 items)
- Provide total count
- Offer to expand the full list
- Require explicit confirmation that scales with count (10 items = button, 1000 items =
  type to confirm)

### Chunked Execution

For large bulk operations, execute in chunks with checkpoints:

1. First chunk executes
2. Show progress and results
3. User confirms to continue OR aborts
4. Subsequent chunks execute
5. Final summary

This allows catching errors early before the entire bulk operation completes.

### Undo for Bulk

Where possible, bulk operations should be reversible:

- Keep records of what was changed
- Offer "Undo last bulk operation" for a time window
- For irreversible bulk operations, require higher confirmation

## Audit Trail

Every tool execution is logged with:

```
{
  timestamp: "2024-12-27T14:23:45Z",
  tool: "gmail.send_message",
  parameters: { to: "john@example.com", subject: "..." },
  approval: {
    status: "approved",
    approver: "user",
    approvedAt: "2024-12-27T14:23:42Z",
    method: "inline" | "modal" | "auto" | "voice"
  },
  execution: {
    status: "success",
    duration: 1234,
    result: { messageId: "..." }
  },
  context: {
    conversationId: "...",
    messageId: "...",
    autonomyLevel: 3
  }
}
```

### User-Facing Audit

Users can view their action history:

- Filter by integration, action type, time range
- See what was approved, what was auto-executed, what was rejected
- Export for compliance or personal records

### Admin/Debug View

For troubleshooting:

- Full parameter logging (with PII handling)
- Execution traces
- Error details with stack traces
- Performance metrics

## Cancellation

Users need escape hatches at every stage:

### Before Execution

Cancel button always visible on pending approvals. No confirmation needed. Immediate
response.

### During Execution

For long-running tools:

- Show progress indicator with cancel button
- Cancel sends interrupt signal to tool
- Tool implementation must respect cancellation
- Partial results may remain (document what cleanup happens)

### After Execution

Where possible, offer undo:

- Email: "Unsend" within provider's window
- Calendar: Delete the created event
- Notion: Restore from trash
- Slack: Delete the message

For irreversible actions, cancellation isn't possible. This is why we classify them as
Dangerous and require explicit confirmation.

### Emergency Stop

Global "pause all agents" control:

- Accessible from settings, also via command (cmd+shift+escape)
- Immediately pauses all pending and executing actions
- Clears all pending approvals
- Notifies user of what was stopped
- Requires explicit re-enablement

## Integration with AI Team

When the [AI Team](../ai-team.md) operates, approval patterns adapt:

### Per-Agent Autonomy

Different agents may have different trust levels:

- DCOS (Digital Chief of Staff): Higher trust after onboarding, handles routine
  coordination
- Researcher: High autonomy for read operations, approval for writes
- Creator: Approval for publishing, auto-execute for drafts

### Agent Chaining

When agents hand off to each other:

- Approval at the point of external action, not internal handoff
- If Researcher gathers data and Creator drafts a post, approval happens at "post to
  LinkedIn", not at internal steps
- Trace shows the full chain: who proposed, who approved, who executed

### Background Agent Approval

For agents running in the background (scheduled, monitoring):

- Approvals queue for user attention
- Summary notification: "3 actions waiting for your approval"
- Can bulk-review at convenient time
- Timeout behavior per tool type still applies

## Technical Integration

### AI SDK v6 Pattern

Carmenta uses the Vercel AI SDK. Tool approval integrates via:

```typescript
export const sendEmail = tool({
  description: "Send an email",
  inputSchema: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
  }),
  needsApproval: true, // or: async (params) => isSensitiveRecipient(params.to)
  execute: async (params) => {
    // ...
  },
});
```

Frontend handles `approval-requested` state:

```typescript
if (invocation.state === 'approval-requested') {
  return <ApprovalCard invocation={invocation} onRespond={handleApproval} />;
}
```

### Database Schema

Pending approvals need persistence:

```sql
-- approval_requests table
id UUID PRIMARY KEY,
user_id UUID REFERENCES users(id),
conversation_id UUID REFERENCES conversations(id),
message_id UUID REFERENCES messages(id),
tool_name TEXT NOT NULL,
parameters JSONB NOT NULL,
status TEXT NOT NULL, -- pending, approved, rejected, expired, cancelled
created_at TIMESTAMP NOT NULL,
expires_at TIMESTAMP,
resolved_at TIMESTAMP,
resolved_by TEXT, -- user, system, timeout
metadata JSONB -- autonomy level, confidence, etc
```

### Real-time Updates

Approval state changes should sync across devices:

- WebSocket or SSE for real-time updates
- If user approves on mobile, desktop sees immediate update
- No duplicate approvals if user responds on multiple devices

---

## Open Questions

### Approval Fatigue

How do we prevent users from developing "click approve without reading" habits?

- Vary the UI slightly so it's not completely automatic?
- Require different confirmation for consecutive approvals?
- Track approval speed as a signal of fatigue?

### Multi-User Approval

For team contexts, might some actions require approval from multiple people?

- Meeting invites that need manager approval
- Spend over a threshold
- Public communications

### Revocation After Approval

If user approves but then wants to revoke before execution completes:

- How quickly can we guarantee cancellation?
- What if the action is already in-flight with the external service?
- Should we add a "execution delay" for high-stakes actions?

### Approval Delegation

Can users delegate approval authority to others?

- "My assistant can approve calendar actions on my behalf"
- Security and audit implications
- How does this interact with autonomy levels?

### Offline Approval

For PWA/mobile scenarios with intermittent connectivity:

- Can we queue approvals for when user comes online?
- How do we handle timeouts when user can't respond?
- Should some actions just fail if user can't be reached?

### Integration-Specific Limits

Some integrations have their own rate limits and approval requirements:

- Twitter has rate limits on posting
- Gmail has send limits
- How do we surface these alongside our own approval system?

---

## Success Criteria

- Users feel in control without feeling interrupted
- Dangerous actions never execute without explicit confirmation
- Approval UI is clear, fast, and doesn't break flow
- Reconnection preserves pending approvals
- Audit trail provides confidence and accountability
- Progressive trust genuinely reduces friction over time
- Emergency stop works instantly and completely

## Sources

Research compiled from:

- Vercel AI SDK v6 documentation and blog (December 2025)
- Microsoft Design: "UX Design for Agents" (April 2025)
- CopilotKit documentation and HITL patterns (November 2025)
- Permit.io: "Human-in-the-Loop for AI Agents: Best Practices" (June 2025)
- Anthropic: "Claude Code Sandboxing" (October 2025)
- Galileo: "How to Build Human-in-the-Loop Oversight" (December 2025)
- Internal competitive analysis:
  `knowledge/research/ai-interface-innovations-december-2025.md`
