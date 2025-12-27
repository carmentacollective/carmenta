# God Mode Development

Build Carmenta in Carmenta. Replace terminal entirely with a web-based agentic coding
interface that runs 24/7 on dedicated infrastructure with full access to all repos.

**This is the convergence of [Dev Mode](./dev-mode.md) and [God Mode](./god-mode.md)**:
Dev Mode's coding capabilities + God Mode's always-on infrastructure + multi-repo
orchestration for how Nick actually works.

## Why This Exists

Nick codes with Claude Code many hours daily across multiple repositories and worktrees.
The current workflow:

- Terminal sessions per repo
- Context lost when switching
- Manual session management
- No persistent memory across sessions
- Browser and terminal are separate worlds

The vision: **One interface to rule them all.** Carmenta becomes the IDE, the terminal,
the git client, the task manager. Not by replacing those tools, but by orchestrating
them through natural language with full agentic capability.

## Two Installations

### Public Carmenta (carmenta.com)

The product everyone uses:

- Sandboxed execution (no filesystem access)
- Service integrations via OAuth
- Memory and conversations
- AI Team for leverage

### God Mode Carmenta (god.carmenta.com)

Nick's personal installation:

- **Full filesystem access** to all repos on the server
- **Full bash with sudo** - no sandbox restrictions
- **24/7 operation** - server always running, checking tasks, running agents
- **GitHub as Nick** - personal access token, creates PRs under his name
- **Multi-repo awareness** - knows about all projects, can work across them
- **Persistent sessions** - resume any coding session from any device

Only Nick has access. The server runs on dedicated infrastructure (cloud VM or Mac Mini)
with his credentials, repos, and identity.

## Core Capabilities

### Agentic Development

Wrap Claude Agent SDK to provide full development environment:

```typescript
// God Mode uses bypassPermissions - no approval needed
const options: ClaudeAgentOptions = {
  cwd: workspace.path,
  resume: workspace.sessionId,
  allowedTools: ["Read", "Edit", "Write", "Bash", "Glob", "Grep", "Task"],
  permissionMode: "bypassPermissions",
  systemPrompt: {
    type: "preset",
    preset: "claude_code",
    append: godModeContext, // Nick's preferences, current tasks, etc.
  },
};
```

- All Claude Code tools available (Read, Edit, Write, Bash, Glob, Grep, Task)
- Session persistence via `session_id`
- Subagent spawning for parallel work
- No permission dialogs - full autonomy

### Multi-Repo Orchestration

Nick works across multiple repos simultaneously:

```
/Users/nick/src/
├── carmenta/              # Main repo
├── carmenta-worktrees/    # Git worktrees for parallel features
│   ├── feature-memory/
│   ├── feature-voice/
│   └── fix-auth-bug/
├── ai-coding-config/      # Plugin repo
├── reference/             # Cloned reference repos
└── other-projects/
```

God Mode understands this structure:

- **Workspace = repo path + agent session + persistent context**
- **Quick switching** between workspaces preserves each session
- **Cross-repo operations** possible (e.g., "update the plugin and test it in Carmenta")
- **Worktree awareness** - knows which worktrees exist, their branches, their purpose

### Always-On Operation

Unlike ephemeral dev sessions, God Mode runs continuously:

- **Background agents** execute long-running tasks
- **Task queue** for scheduled and deferred work
- **Notification system** alerts Nick when attention needed
- **Daily digest** summarizes what happened overnight

Example flows:

- "Run the full test suite and fix any failures" → Agent works in background, notifies
  when done
- "Every morning, check for new issues and triage them" → Scheduled agent
- "When tests fail on main, investigate and create a fix PR" → Event-triggered agent

### GitHub Integration

Full GitHub access as Nick:

- **Read**: Issues, PRs, actions, discussions
- **Write**: Create branches, commits, PRs
- **Merge**: After approval or for trusted paths
- **Webhooks**: React to repo events

The AI creates commits with:

```
Author: Nick Sullivan <nick@heartcentered.ai>
Committer: Carmenta AI <ai@carmenta.com>
```

This transparency shows AI-assisted work while preserving Nick's authorship.

### Voice-First Development

Leverage Carmenta's voice capabilities for coding:

- Describe changes verbally, see diffs visually
- "Add a new API endpoint for user preferences" → Agent codes while you watch
- "What's the status of the auth refactor?" → Agent explores and reports
- Approve/reject with voice or clicks

Perfect for:

- Architecture discussions and exploration
- Debugging with verbal hypothesis testing
- Code review and explanation
- Multitasking while agent works

## Architecture

### Backend Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GOD MODE BACKEND (god.carmenta.com)                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Session Manager                              │   │
│  │  - Track active workspaces and their sessions                       │   │
│  │  - Persist session IDs to database                                  │   │
│  │  - Resume sessions across browser disconnects                       │   │
│  └──────────────────────────────────┬──────────────────────────────────┘   │
│                                      │                                      │
│  ┌─────────────────┐  ┌─────────────┴─────────────┐  ┌─────────────────┐   │
│  │  Task Queue     │  │    Agent Orchestrator     │  │  Event Handler  │   │
│  │                 │  │                           │  │                 │   │
│  │  - Background   │  │  - Spawn SDK processes    │  │  - GitHub       │   │
│  │    jobs         │  │  - Stream events to UI    │  │    webhooks     │   │
│  │  - Scheduled    │  │  - Handle interrupts      │  │  - File changes │   │
│  │    agents       │  │  - Coordinate subagents   │  │  - Test results │   │
│  └────────┬────────┘  └────────────┬──────────────┘  └────────┬────────┘   │
│           │                        │                          │            │
│  ┌────────┴────────────────────────┴──────────────────────────┴────────┐   │
│  │                       Claude Agent SDK                               │   │
│  │                                                                      │   │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │
│  │   │ Read     │  │ Edit     │  │ Bash     │  │ Task     │           │   │
│  │   │ Write    │  │ Glob     │  │ Grep     │  │ (sub)    │           │   │
│  │   └──────────┘  └──────────┘  └──────────┘  └──────────┘           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                            ┌─────────┴─────────┐                            │
│                            │    Filesystem     │                            │
│                            │                   │                            │
│                            │  /Users/nick/src/ │                            │
│                            │  (full access)    │                            │
│                            └───────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Frontend Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GOD MODE FRONTEND                                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Workspace Switcher                           │   │
│  │  [carmenta] [ai-coding-config] [worktree:feature-x] [+ Add]         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────┐  ┌────────────────────────────────┐  │
│  │         Chat/Agent Panel         │  │        Context Panel           │  │
│  │                                  │  │                                │  │
│  │  [Voice Input] [Text Input]      │  │  ┌────────────────────────┐   │  │
│  │                                  │  │  │ Files Changed          │   │  │
│  │  Agent: Reading src/lib/auth.ts  │  │  │ - lib/auth.ts (+24)    │   │  │
│  │  ├─ Line 42-87: Token validation │  │  │ - lib/auth.test.ts     │   │  │
│  │  └─ Found the bug in refresh...  │  │  └────────────────────────┘   │  │
│  │                                  │  │                                │  │
│  │  Agent: Editing lib/auth.ts      │  │  ┌────────────────────────┐   │  │
│  │  ├─ Replacing lines 55-58        │  │  │ Terminal Output        │   │  │
│  │  └─ [View Diff]                  │  │  │ $ pnpm test            │   │  │
│  │                                  │  │  │ PASS auth.test.ts      │   │  │
│  │  Agent: Running tests...         │  │  │ 24 passed, 0 failed    │   │  │
│  │                                  │  │  └────────────────────────┘   │  │
│  │  [Interrupt] [Clear] [Settings]  │  │                                │  │
│  │                                  │  │  ┌────────────────────────┐   │  │
│  └──────────────────────────────────┘  │  │ Active Tasks           │   │  │
│                                        │  │ ◉ Fixing auth bug      │   │  │
│                                        │  │ ○ Review PR #123       │   │  │
│                                        │  │ ○ Update deps          │   │  │
│                                        │  └────────────────────────┘   │  │
│                                        └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Model

```typescript
// Workspaces track repo locations and their agent sessions
interface Workspace {
  id: string;
  name: string; // "carmenta", "feature-memory"
  path: string; // "/Users/nick/src/carmenta"
  sessionId?: string; // Claude Agent SDK session ID
  lastAccessed: Date;
  context: WorkspaceContext; // Cached understanding
}

interface WorkspaceContext {
  recentFiles: string[]; // Files the agent has been working with
  gitBranch: string;
  gitStatus: string; // clean, dirty, ahead/behind
  activeTask?: string; // Current focus
  learnings: string[]; // Things remembered about this workspace
}

// Background tasks for always-on operation
interface BackgroundTask {
  id: string;
  workspaceId: string;
  prompt: string;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: Date;
  completedAt?: Date;
  result?: string;
  error?: string;
}

// Scheduled agents for recurring work
interface ScheduledAgent {
  id: string;
  name: string; // "Morning Issue Triage"
  cron: string; // "0 8 * * 1-5"
  workspaceId: string;
  prompt: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun: Date;
}
```

### Streaming Architecture

Building on patterns from reference implementations:

```typescript
// NDJSON streaming with AbortController (from claude-code-webui)
export async function POST(req: Request) {
  const { prompt, workspaceId, taskId } = await req.json();
  const workspace = await getWorkspace(workspaceId);

  const abortController = new AbortController();
  activeRequests.set(taskId, abortController);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const msg of query({
          prompt,
          options: {
            resume: workspace.sessionId,
            cwd: workspace.path,
            permissionMode: "bypassPermissions",
            includePartialMessages: true,
          },
        })) {
          if (abortController.signal.aborted) break;

          // Capture session ID on init
          if (msg.type === "system" && msg.subtype === "init") {
            await updateWorkspaceSession(workspaceId, msg.session_id);
          }

          // Stream to client
          const chunk = JSON.stringify(msg) + "\n";
          controller.enqueue(new TextEncoder().encode(chunk));
        }
      } finally {
        activeRequests.delete(taskId);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}

// Abort endpoint
export async function DELETE(req: Request) {
  const { taskId } = await req.json();
  const controller = activeRequests.get(taskId);
  if (controller) {
    controller.abort();
    return Response.json({ success: true });
  }
  return Response.json({ error: "Task not found" }, { status: 404 });
}
```

### Background Task Execution

For always-on operation, tasks must survive browser disconnection:

```typescript
// Background task runner (separate process)
class BackgroundTaskRunner {
  private queue: BackgroundTask[] = [];
  private running: Map<string, Query> = new Map();

  async processQueue() {
    for (const task of this.queue.filter((t) => t.status === "queued")) {
      await this.executeTask(task);
    }
  }

  async executeTask(task: BackgroundTask) {
    const workspace = await getWorkspace(task.workspaceId);
    await updateTask(task.id, { status: "running" });

    try {
      const messages: SDKMessage[] = [];
      const q = query({
        prompt: task.prompt,
        options: {
          resume: workspace.sessionId,
          cwd: workspace.path,
          permissionMode: "bypassPermissions",
        },
      });

      this.running.set(task.id, q);

      for await (const msg of q) {
        messages.push(msg);
        // Persist events for later replay
        await persistEvent(task.id, msg);
      }

      await updateTask(task.id, {
        status: "completed",
        result: summarizeMessages(messages),
      });
    } catch (error) {
      await updateTask(task.id, {
        status: "failed",
        error: String(error),
      });
    } finally {
      this.running.delete(task.id);
    }
  }

  async interrupt(taskId: string) {
    const q = this.running.get(taskId);
    if (q) await q.interrupt();
  }
}
```

## Worker Architecture

### Node.js vs Python/Celery Mental Model

Coming from Python, the instinct is Celery: separate worker processes, message broker
(Redis/RabbitMQ), serialized tasks. Node.js is fundamentally different because of the
event loop - "background work" means something different.

```
Python/Celery:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Web Process │────▶│ Redis/RMQ   │────▶│ Worker      │
│ (Django)    │     │ (Broker)    │     │ Process(es) │
└─────────────┘     └─────────────┘     └─────────────┘
     │                                        │
     └──────── Completely separate ───────────┘

Node.js Event Loop:
┌─────────────────────────────────────────────────────┐
│                  Single Process                      │
│                                                      │
│   Request A ──▶ await fetch() ──▶ continues...      │
│   Request B ──▶ await db.query() ──▶ continues...   │
│   Request C ──▶ await agentSDK() ──▶ continues...   │
│                                                      │
│   All concurrent via event loop, no separate workers │
└─────────────────────────────────────────────────────┘
```

Node handles concurrent I/O naturally. You only need separate processes when you need
**durability across restarts** or **CPU-bound work** (which agent SDK is not - it's I/O
bound, waiting on Anthropic API calls).

### Three Options for Background Work

**Option 1: Async in Request Handler** (simplest, but fragile)

```typescript
app.post("/api/agent", async (req, res) => {
  for await (const msg of query({ prompt })) {
    res.write(JSON.stringify(msg));
  }
  res.end();
});
// Problem: browser disconnect = work dies
```

**Option 2: Fire-and-Forget with DB Persistence** (good for local dev)

```typescript
const activeTasks = new Map<string, Query>();

app.post("/api/agent/start", async (req, res) => {
  const taskId = crypto.randomUUID();

  // Start but don't await - runs in event loop background
  runTaskInBackground(taskId, req.body.prompt);

  res.json({ taskId }); // Return immediately
});

async function runTaskInBackground(taskId: string, prompt: string) {
  const q = query({ prompt, options });
  activeTasks.set(taskId, q);

  try {
    for await (const msg of q) {
      await db.taskEvent.create({ data: { taskId, event: msg } });
    }
    await db.task.update({ where: { id: taskId }, data: { status: "completed" } });
  } finally {
    activeTasks.delete(taskId);
  }
}
```

Survives: browser disconnect ✓ Dies on: server restart ✗ (but events up to that point
are in DB)

**Option 3: Separate Worker Process with Job Queue** (production)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Next.js Server  │────▶│ Redis + BullMQ  │────▶│ Worker Process  │
│ (queues jobs)   │     │ (job queue)     │     │ (executes SDK)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

Survives: browser disconnect ✓, server restart ✓, worker restart ✓

### Job Queue Options for Node.js

| Library         | Broker     | Notes                                       |
| --------------- | ---------- | ------------------------------------------- |
| **BullMQ**      | Redis      | Most popular, battle-tested, Bull Board UI  |
| **pg-boss**     | Postgres   | No Redis needed, uses existing Postgres     |
| **Inngest**     | HTTP/Cloud | Serverless-friendly, built-in dashboard     |
| **Trigger.dev** | Postgres   | Good for long-running, built-in persistence |

For God Mode, **BullMQ** is the standard choice. If avoiding Redis, **pg-boss** uses
Postgres we already have.

### Phased Approach to Workers

**G1-G2 (Local Dev)**: Option 2 - fire-and-forget with DB persistence

- Single Next.js process handles everything
- Simple, no extra infrastructure
- `pnpm dev` is all you need
- Sufficient for proving the concept

**G3 (Background Execution)**: Option 3 - add BullMQ + Redis

- Worker process runs alongside Next.js
- Two terminals: `pnpm dev` + `pnpm worker`
- Tasks survive server restarts

**G4+ (Production)**: PM2 manages both processes

- PM2 = process manager for Node.js (like supervisord)
- Keeps processes running, restarts on crash, handles boot
- `pm2 start ecosystem.config.js` runs both web + worker

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    { name: "god-web", script: "node_modules/.bin/next", args: "start" },
    { name: "god-worker", script: "dist/worker.js" },
  ],
};
```

### Why God Mode Cannot Run on Vercel

Vercel is **serverless** - code only runs when requests arrive:

```
Request → Cold start → Function runs → Response → Function dies
```

No persistent processes. No background workers. No filesystem. Each API route is
ephemeral.

| Requirement                | Vercel     | Real Server (VPS) |
| -------------------------- | ---------- | ----------------- |
| Persistent processes       | ❌         | ✅                |
| Background workers         | ❌         | ✅                |
| Filesystem access          | ❌         | ✅                |
| Long-running tasks (>5min) | ❌         | ✅                |
| Scheduled jobs             | ❌         | ✅                |
| WebSocket (persistent)     | ⚠️ limited | ✅                |

**Deployment split:**

- `carmenta.com` → Vercel (serverless, public product)
- `god.carmenta.com` → VPS + PM2 (persistent, Nick's infrastructure)

### Infrastructure Decision

**Recommended: Start with Cloud VM**

| Provider         | Cost       | Notes                           |
| ---------------- | ---------- | ------------------------------- |
| **Hetzner**      | ~$5-20/mo  | Cheapest, EU-based, great value |
| **Fly.io**       | ~$10-30/mo | Easy deploys, good DX           |
| **Railway**      | ~$10-20/mo | Simple, Vercel-like DX          |
| **DigitalOcean** | ~$12-24/mo | Reliable, good docs             |

**Later: Add Mac Mini for iMessage**

When God Mode messaging (iMessage integration) becomes priority, add macOS
infrastructure. Cloud Mac options: MacStadium (~$50/mo), AWS EC2 Mac (~$100/mo), or
self-hosted Mac Mini (one-time cost).

**Security:**

- Tailscale (simple, secure mesh VPN)
- Or Cloudflare Access (zero-trust with email/OTP)
- god.carmenta.com only resolves via Tailscale/Access

## Implementation Phases

### Phase 1: Foundation

Get the basic loop working with one workspace:

- API route wrapping Claude Agent SDK
- NDJSON streaming to frontend
- Basic chat UI showing agent output
- Session persistence in database
- Single workspace (carmenta repo)

**Acceptance**: Nick can have a coding conversation about Carmenta through the web UI.

### Phase 2: Multi-Workspace

Support multiple repos and worktrees:

- Workspace switcher UI
- Session per workspace
- Quick context switching
- Workspace discovery from filesystem

**Acceptance**: Nick can switch between carmenta, ai-coding-config, and worktrees
seamlessly.

### Phase 3: Background Execution

Tasks survive browser close:

- Background task queue
- Event persistence for replay
- "Completed while away" summaries
- Interrupt capability from UI

**Acceptance**: Nick can start a long task, close browser, return later to see results.

### Phase 4: Always-On Agents

Continuous operation:

- Scheduled agents (cron-style)
- Event-triggered agents (webhook reactions)
- Daily digest notifications
- Proactive suggestions

**Acceptance**: Nick wakes up to issues triaged and tests fixed overnight.

### Phase 5: Visual Polish

Make it feel like an IDE:

- Inline diff viewer for file edits
- Integrated terminal panel
- File tree with git status
- Split pane layouts
- Keyboard shortcuts

**Acceptance**: Comparable UX to Claude Code CLI but with visual advantages.

## Integration Points

- **[Dev Mode](./dev-mode.md)**: God Mode Development is the full realization of Dev
  Mode's vision, running on dedicated infrastructure rather than ephemeral compute
- **[God Mode](./god-mode.md)**: Shares infrastructure concept (dedicated server,
  always- on, full access) but focused on development rather than
  messaging/communication
- **[AI Team](./ai-team.md)**: God Mode agents are specialized AI team members for
  development tasks
- **[Memory](./memory.md)**: Workspace context persists as memory - learnings about each
  repo
- **[Concierge](./concierge.md)**: Routes development queries to God Mode when
  appropriate

## Success Criteria

**Primary**: Nick uses Carmenta as primary development interface for Carmenta work.

**Qualitative**:

- Flow state maintained (no context switching to terminal)
- Voice + visual feedback feels natural for development
- Session context survives across days/weeks
- Cross-repo operations feel unified

**Quantitative**:

- Latency < 200ms for agent response start
- Session resume < 500ms
- 99% uptime for God Mode server
- Zero data loss on browser disconnect

## Decisions Made

### Infrastructure

- **Hosting**: Start with Cloud VM (Hetzner or Fly.io), add Mac Mini later for iMessage
- **Security**: Tailscale for simple mesh VPN access
- **Deployment**: Separate VPS from Vercel - god.carmenta.com is independent
  infrastructure
- **Worker Architecture**: Phased approach - fire-and-forget for local dev (G1-G2),
  BullMQ
  - Redis for production (G3+), PM2 for process management

### Why Not Vercel for God Mode

Vercel is serverless - no persistent processes, no filesystem, no background workers.
God Mode requires all of these. Public Carmenta stays on Vercel; God Mode runs on VPS.

## Open Questions

### Infrastructure (Remaining)

- **Monitoring**: What observability for always-on agents? (Sentry? Custom dashboard?)

### UX

- **Diff viewer**: Build custom or use existing (Monaco? CodeMirror?)?
- **Terminal**: Real PTY or simulated output display?
- **Notifications**: Browser notifications? Mobile push? Email?
- **Mobile**: Accessible from phone for quick checks?

### Agent Behavior

- **Autonomy bounds**: What should agents do without asking? What requires approval?
- **Error recovery**: When an agent fails, how does it recover?
- **Cross-repo**: How to handle operations spanning multiple repos?
- **Rate limiting**: How to prevent runaway agents from burning API credits?

## Reference Implementations

Analyzed repositories in `../reference/`:

| Repo                | Key Pattern               | Adopt For                       |
| ------------------- | ------------------------- | ------------------------------- |
| claude-code-webui   | NDJSON + AbortController  | Streaming architecture          |
| claudecodeui        | File explorer + git + PTY | Visual features                 |
| claude-flow         | Swarm orchestration       | Multi-agent coordination        |
| claude-agent-sdk    | Direct SDK usage          | API patterns                    |
| awesome-claude-code | Community patterns        | CLI enhancements to port to web |

## Risks

### Technical

- **SDK stability**: Claude Agent SDK is new; API may change
- **Session limits**: Unknown limits on session duration/size
- **Concurrency**: Multiple agents modifying same files
- **Context window**: Long sessions may exceed context limits

### Operational

- **Always-on costs**: Server + API costs for 24/7 operation
- **Runaway agents**: Agents that loop or consume excessive resources
- **Security surface**: Full filesystem access requires careful protection

### Adoption

- **Habit change**: Terminal is deeply ingrained; switching takes discipline
- **Feature parity**: Missing features may drive back to CLI
- **Latency tolerance**: Web UI may feel slower than local terminal

## The Vision

This is the endgame for AI-first development:

**Today**: Nick switches between Carmenta (conversation), Claude Code (terminal), GitHub
(browser), and various tools. Context is fragmented. Memory is manual.

**Tomorrow**: Nick opens god.carmenta.com. All his repos are there. He speaks or types
what he wants to build. Agents work in the background. When he returns, work is done.
The boundary between "asking AI for help" and "doing the work" dissolves.

**This is Carmenta building Carmenta** - the ultimate dogfood, the ultimate proof of
concept, the ultimate leverage multiplier.
