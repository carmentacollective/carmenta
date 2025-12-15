# God Mode

AI that acts AS you across your entire digital surface. Not just an assistant that helps
you—a digital twin that operates with your identity, your access, your judgment. The
highest tier of the [AI Team](./ai-team.md), where the boundary between human and AI
action dissolves.

**Infrastructure**: God Mode requires dedicated execution environments—either
user-operated (BYOM: Bring Your Own Mac) or Carmenta-managed infrastructure. See
[execution infrastructure](../ai-pm/execution-infrastructure.md) for architecture
details.

## Why This Exists

The [AI Team](./ai-team.md) handles work alongside you. But some actions require YOUR
identity:

- Sending a message from your phone number
- Committing code under your name
- Responding to an email as you
- Taking action in systems that don't have API access

These actions can't be delegated to a generic AI assistant. They require infrastructure
that can literally act as you—with your credentials, your access, your identity.

For executives and founders, this is the difference between "AI that drafts for me" and
"AI that handles it." The goal is not to review every message, but to wake up with your
inbox at zero because your digital twin handled it overnight.

## Trust Hierarchy

God Mode operates at Level 4 of the trust hierarchy:

| Level | Capability            | Example                                                |
| ----- | --------------------- | ------------------------------------------------------ |
| 1     | Read data             | Access integrations, browse connected services         |
| 2     | Take actions in tools | Create tickets, update docs, schedule meetings         |
| 3     | Modify code           | Commit, create PRs, merge trusted paths                |
| 4     | **Speak as you**      | Send messages, emails, communications as your identity |

Level 4 is qualitatively different. A bad action at Level 2 can be undone. A bad message
at Level 4 is sent. The trust requirements, audit requirements, and progressive autonomy
requirements are all higher.

## Core Capabilities

### Messaging Platforms

Send and receive messages as the user across platforms:

| Platform | Access Method           | Infrastructure | Notes                         |
| -------- | ----------------------- | -------------- | ----------------------------- |
| iMessage | AppleScript/bridges     | Requires Mac   | User's Apple ID signed in     |
| WhatsApp | Business API or bridges | Cloud or Mac   | Personal accounts risk ban    |
| Signal   | signal-cli              | Any            | Privacy-focused, smaller base |
| Telegram | Official Bot/TDLib      | Any            | Most developer-friendly       |
| SMS      | Twilio or similar       | Any            | Official APIs, easy           |
| Email    | SMTP/API                | Any            | Sending as user's address     |

iMessage is the constraint that shapes infrastructure—it requires macOS with the user's
Apple ID. This drives the BYOM model for users who need iMessage access.

### Development Environment

Full local environment with quality gates:

- Repository access (read, write, commit, PR)
- Pre-commit hooks (linting, formatting, type checking)
- Test execution
- Claude Code or similar AI coding tool
- Cross-repo orchestration

This enables the [AI PM autonomous loop](../ai-pm/README.md) with proper quality
guarantees—code that passes the same checks as local development.

### Digital Surface Operations

Actions across the user's entire digital presence:

- Browser automation for sites without APIs
- Desktop automation for native apps
- File system access for local documents
- Calendar management (not just reading—scheduling, moving, declining)

### Acting with Judgment

God Mode isn't just automation—it's judgment. The AI learns:

- Your voice and communication style
- Who gets immediate responses vs. who can wait
- What decisions you'd make in common situations
- When to escalate vs. when to handle autonomously

Over time, the AI becomes a genuine digital twin—not just executing scripts, but making
decisions as you would.

## Progressive Autonomy

Users don't get Level 4 access immediately. Trust is earned through demonstrated
reliability:

### Week 1-2: Draft Mode

- AI prepares messages, user approves before sending
- AI suggests responses, user edits and sends
- Full visibility into what AI would have done

### Week 3-4: Supervised Mode

- AI sends low-stakes messages (confirmations, scheduling)
- User notified immediately after each send
- High-stakes messages still require approval

### Week 5+: Autonomous Mode

- AI handles routine communications autonomously
- Daily digest of what was sent
- Escalation for unusual situations
- Human override always available

### Configuration Dimensions

Users control autonomy along multiple dimensions:

| Dimension        | Options                                             |
| ---------------- | --------------------------------------------------- |
| **Contact type** | Family always autonomous, strangers always draft    |
| **Message type** | Scheduling autonomous, negotiations always draft    |
| **Platform**     | SMS autonomous, iMessage supervised                 |
| **Time of day**  | Autonomous during work hours, draft after 6pm       |
| **Confidence**   | Autonomous if AI is >90% confident, draft otherwise |

## Execution Model

God Mode runs on Carmenta-managed infrastructure—dedicated hardware operated by Nick for
a small group of trusted friends.

```
Carmenta Infrastructure (per user)
├── Cloud VM (Linux) - development, APIs, most automation
├── Mac Mini (macOS) - iMessage, Apple-specific features
└── Isolated environment - user's credentials, repos, context
```

**How it works:**

1. User's credentials stored securely (encrypted at rest)
2. Dedicated execution environment per user
3. Full environment maintained by Nick
4. Always-on operation

**Why managed-only:**

- Friends don't want to maintain infrastructure
- "While sleeping" automation requires always-on
- Nick can ensure quality and reliability
- Simpler architecture—one model to build and operate

## Audit and Transparency

Every action logged, reviewable, exportable:

### Action Log

```
2024-12-15 03:47:12 | iMessage | John Smith
Action: Responded to meeting request
Message: "Thursday at 2pm works. See you then."
Reasoning: Checked calendar, slot was free, John is in trusted contacts
Confidence: 94%
```

### Daily Digest

Morning summary of overnight activity:

- Messages sent (with full text)
- Actions taken (with reasoning)
- Decisions made (with confidence levels)
- Items escalated for human review

### Override Capability

- Review any pending action before it executes
- Undo recent actions where possible
- Pause all autonomous action with one command
- Adjust autonomy levels based on experience

## Product Tiers

God Mode fits into the broader Carmenta product structure:

| Tier         | Execution                | Capabilities                        | Target                |
| ------------ | ------------------------ | ----------------------------------- | --------------------- |
| **AI Team**  | Ephemeral compute        | Integration access, scheduled tasks | General users         |
| **God Mode** | Dedicated infrastructure | + Repos, + messaging, + always-on   | Friends (invite-only) |

God Mode is invite-only for trusted friends. Infrastructure costs are real (Mac Mini
cloud hosting ~$50-150/month per user plus compute), but this is about building
something valuable with people who'll give honest feedback, not extracting maximum
revenue.

## Integration Points

- **[AI Team](./ai-team.md)**: God Mode is the highest capability tier of the AI Team
- **[Scheduled Agents](./scheduled-agents.md)**: Run God Mode tasks on schedules
- **[Ephemeral Compute](./ephemeral-compute.md)**: Cloud execution for non-Mac tasks
- **[AI PM](../ai-pm/README.md)**: Development automation uses God Mode execution
- **[Service Connectivity](./integrations.md)**: APIs for platforms with official access
- **[Browser Automation](./browser-automation.md)**: Fallback for platforms without APIs

## Success Criteria

- Users feel like they have a digital twin, not just an assistant
- "While sleeping" automation genuinely works—wake up to completed work
- Trust is earned progressively—users feel in control
- Audit trail provides confidence and transparency
- Messaging feels natural—recipients can't tell it's AI (unless disclosed)
- Development automation matches local environment quality

## Safety Boundaries

Hard limits that God Mode never crosses:

- **Financial transactions**: Never autonomous—always human approval
- **Legal commitments**: Contracts, agreements—always human approval
- **Destructive actions**: Account deletion, data purge—always human approval
- **Disclosure**: If asked "is this AI?", always truthful
- **Platform ToS**: Respects platform terms (with user-acknowledged risks)

---

## Open Questions

### Product Decisions

- **Onboarding**: How do friends get set up? What credentials do they need to provide?
- **Failure modes**: What happens when AI sends a bad message? Recovery workflows?
- **Voice learning**: Should AI learn to match user's writing voice? How explicitly?

### Technical Architecture

- **Credential security**: How to securely store and use user's messaging credentials?
- **iMessage reliability**: How stable are the bridge solutions (BlueBubbles, etc.)?
- **Session management**: How to maintain persistent sessions with messaging platforms?
- **Multi-user isolation**: How to isolate users on shared Mac infrastructure?

### Research Needed

- Technical evaluation of iMessage bridge reliability
- User research on trust thresholds for AI-as-me communication
- Multi-tenant Mac isolation patterns
