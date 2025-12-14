# Ephemeral Compute

On-demand compute infrastructure that spins up machines for tasks and tears them down
when complete. The unified execution layer for code execution, scheduled agents, and
powerhouse development capabilities.

## Why This Exists

Carmenta needs to do work that doesn't fit the request-response model of a web app:

- **Code execution**: Run Python data analysis for 30 seconds
- **Scheduled agents**: Check email hourly, process transcripts daily
- **Powerhouse mode**: Clone repos, write code, run tests, create PRs (5-10 minutes)

These share a pattern: spin up compute, do work, tear it down. Rather than build three
separate systems, we build one ephemeral compute layer that handles all three.

## Architecture Decision

**The web app (Render) stays focused on the interface.** Real-time chat, conversation
management, user authentication - that's Render's job.

**Ephemeral compute handles background work.** When Carmenta needs to do something that
takes time, uses heavy resources, or requires special tooling (git, gh, Python), she
dispatches it to ephemeral compute.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Carmenta on Render                            │
│                    (web app, always-on)                          │
│                                                                  │
│   - Real-time chat                                               │
│   - Conversation management                                      │
│   - User auth (Clerk)                                            │
│   - Concierge routing                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ API calls to ephemeral compute
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               Ephemeral Compute Layer                            │
│               (Fly.io Machines OR E2B - TBD)                     │
│                                                                  │
│   Machines spin up on demand, auto-destroy after task            │
│                                                                  │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│   │ Code        │  │ Scheduled   │  │ Powerhouse              │ │
│   │ Execution   │  │ Agents      │  │                         │ │
│   │             │  │             │  │ git, gh CLI, Node       │ │
│   │ Python,     │  │ Email       │  │ Clone repos             │ │
│   │ pandas,     │  │ processing, │  │ Create worktrees        │ │
│   │ matplotlib  │  │ transcript  │  │ Write code, run tests   │ │
│   │             │  │ ingestion   │  │ Create PRs              │ │
│   │ ~30s tasks  │  │ ~minutes    │  │ ~5-10 min tasks         │ │
│   └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Capability Tiers

### Code Execution

For all users. Python sandbox with data analysis packages.

- pandas, numpy, matplotlib, etc.
- File upload/download
- Stateful sessions within a conversation
- 30 second default timeout

### Scheduled Agents

For users with scheduling enabled. Long-running background tasks.

- Cron-triggered or event-triggered
- Service integrations (email, calendar, Limitless)
- Minutes to hours runtime
- Results delivered via notifications or in-app

### Powerhouse Mode

For admin users only (via Clerk). Full development environment.

- Git and GitHub CLI access
- Node toolchain
- Clone any repo the user has access to
- Create worktrees, branches, PRs
- Run tests and builds
- 10+ minute tasks

Powerhouse mode is gated by user permissions. Regular users never see it. Admin users
(starting with Nick) can say things like "create a PR that fixes the voice timeout bug"
and Carmenta does the full development cycle.

## GitHub Integration

Ephemeral compute machines need GitHub access for:

- Creating issues (from @carmenta feedback)
- Creating PRs (from powerhouse mode)
- Reading repos (for context and code generation)

**Authentication**: A Personal Access Token (PAT) stored in Render's environment
variables, passed to ephemeral machines when they're created. The token has `repo` scope
for full repository access.

```typescript
// When creating an ephemeral machine
const machine = await createMachine({
  image: "carmenta/powerhouse:latest",
  env: {
    GH_TOKEN: process.env.GH_TOKEN,
    TASK: userRequest,
  },
  autoDestroy: true,
});
```

The machine runs `gh` commands authenticated with the token, then auto-destroys. The
token never touches the client.

## Platform Decision: Open Question

Two viable options for the ephemeral compute layer:

### Option A: Fly.io Machines

Firecracker microVMs controllable via REST API. Self-managed but full control.

**Pros:**

- Usage-based pricing (~$0.0000022/s)
- No base cost
- Full Docker support - any tooling
- Data stays in our infrastructure
- 35+ global regions

**Cons:**

- More infrastructure to manage
- Learning curve (CLI-first)
- Need to build/maintain machine images

### Option B: E2B

Managed sandboxed execution as an API. Zero infrastructure.

**Pros:**

- Turnkey - just API calls
- Firecracker under the hood (same tech as Fly)
- ~150ms cold start
- Full Python ecosystem

**Cons:**

- $150/mo base cost + usage
- Data leaves our infrastructure
- Vendor dependency
- May not support full dev toolchain (git, gh, Node) for powerhouse mode

### Current Status

**Undecided.** Both options work for code execution and scheduled agents. The key
question is whether E2B can support powerhouse mode's full dev toolchain, or if we need
Fly.io's flexibility.

Research needed:

- Can E2B run git, gh CLI, and Node in a sandbox?
- What's realistic E2B pricing at our expected usage?
- What's the actual migration effort to set up Fly.io Machines?

## Integration with Carmenta Interaction

When a user says "@carmenta bug report", the flow may use ephemeral compute:

1. Concierge detects @carmenta mention, routes to entity mode
2. Carmenta gathers context (errors, conversation, browser info)
3. Carmenta searches GitHub for similar issues (API call, no compute needed)
4. If creating issue, Carmenta calls GitHub API directly (no compute needed)
5. If the bug involves code investigation, Carmenta might spin up a machine to analyze

For powerhouse mode:

1. Admin user says "Create a PR that adds conversation export"
2. Concierge detects powerhouse intent, checks permissions
3. Carmenta spins up ephemeral machine with git/gh/Node
4. Machine: clones repo, creates worktree, Carmenta writes code
5. Machine: runs tests, commits, pushes, creates PR
6. Machine returns PR URL, auto-destroys
7. Carmenta shows user the PR link

## Success Criteria

- Code execution works for all users without infrastructure overhead
- Scheduled agents run reliably on their schedules
- Powerhouse mode enables Nick to develop via conversation
- Costs scale with usage, not with idle time
- Security: machines are isolated, auto-destroy, no persistent state
- GitHub operations (issues, PRs) work seamlessly

## Related Components

- [Code Execution](./code-execution.md): Detailed spec for Python sandbox use cases
- [Scheduled Agents](./scheduled-agents.md): Cron-triggered background work
- [Carmenta Interaction](./carmenta-interaction.md): @carmenta pattern uses this for
  GitHub issues
- [Product Intelligence](./product-intelligence.md): May use scheduled agents for
  competitor monitoring
