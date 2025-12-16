# Worker Architecture Exploration

An exploration of how to run autonomous agents—both for Nick's personal repo maintenance
workflow ("Nico") and for end-user scheduled tasks. This builds on
[execution-infrastructure.md](./execution-infrastructure.md) and explores the specific
implementation options.

**Status:** Exploration, not decision. Captured from a deep-dive conversation on
2024-12-15.

## The Core Problem

Two related but distinct use cases need execution infrastructure:

### Nick's Workflow ("Nico")

The workflow Nick does hundreds of times per week:

1. Spin up git worktree for a task
2. Run Claude Code to do the work
3. Submit PR
4. Address PR comments
5. Ask questions if stuck / tell me when ready
6. Merge and cleanup

This is trusted enough to automate. The question: what infrastructure runs it?

### End User Scheduled Tasks

Users want to schedule AI tasks: "Summarize my emails every morning", "Review my
calendar weekly", "Maintain my knowledge base."

These tasks need:

- Access to user's live data (knowledge base, integrations)
- Scheduled execution (cron-style)
- Visibility into what's running
- Human-in-the-loop when blocked

## The Key Constraint: Database Access

The exploration surfaced a critical constraint: **workers need access to production
data.**

User tasks require loading context from the database—knowledge bases, integration
credentials, user preferences. This rules out:

- **GitHub Actions** — No database access, wrong security model
- **Isolated sandboxes (Modal, e2b)** — Designed for untrusted code, not trusted code
  needing data access
- **External services** — Adds complexity without benefit if we need DB access anyway

The worker must be part of Carmenta's infrastructure.

## Options Explored

### External Execution Services

| Service            | What It Is           | Why We Explored It                   | Why It May Not Fit                   |
| ------------------ | -------------------- | ------------------------------------ | ------------------------------------ |
| **fly.io**         | Global VM platform   | Spin up machines on demand           | General-purpose, no sandbox features |
| **Modal**          | AI agent sandboxes   | Purpose-built for LLM code execution | Designed for untrusted code          |
| **e2b.dev**        | Firecracker microVMs | Fast, isolated sandboxes             | 24-hour max runtime, no DB access    |
| **GitHub Actions** | CI/CD                | Already there, event-driven          | No DB access, not for user tasks     |

These services solve isolation and scaling—but we need database access more than we need
isolation. Nick's code is trusted. User tasks run against user data, not arbitrary code.

### Orchestration Options

| Service               | What It Is             | Strengths                                                     | Complexity  |
| --------------------- | ---------------------- | ------------------------------------------------------------- | ----------- |
| **Temporal**          | Workflow orchestration | Human-in-the-loop, durable state, waits for days at zero cost | Medium-high |
| **BullMQ**            | Redis job queue        | Simple, scheduling, dashboard                                 | Low-medium  |
| **Celery**            | Python task queue      | Mature, beat scheduling                                       | Medium      |
| **Postgres as queue** | Database polling       | Zero new infrastructure                                       | Low         |

Temporal is powerful for human-in-the-loop workflows (agent blocks, waits days for user
response, resumes). But adds infrastructure complexity.

For simpler cases, Postgres `SELECT ... FOR UPDATE SKIP LOCKED` is a battle-tested job
queue pattern requiring no new services.

### The Simplest Architecture

The minimal version that could work:

```
Carmenta (Next.js) → inserts into `tasks` table
                           ↓
                     POSTGRES
                           ↓
Worker (Python) → polls, claims, executes with Claude Agent SDK
```

No Redis. No external queue. No Temporal. Just:

- A `tasks` table with status, payload, result
- A `scheduled_tasks` table with cron expressions
- A worker process that polls and executes

This gives database access, scheduling, and visibility through the same DB Carmenta
already uses.

## The Split Question

A key tension emerged: should Nick's repo workflow and user scheduled tasks share
infrastructure?

### Arguments for Splitting

- **Different trust models** — Nick's repos vs user data
- **Different interaction patterns** — GitHub (issues, PRs) vs Carmenta UI
- **Ship faster** — Validate repo workflow without full worker infrastructure
- **Iteration clarity** — One problem at a time

### Arguments Against Splitting

- **Same core operation** — Load context → run agent → produce result
- **Duplicate infrastructure** — Two systems to maintain
- **Intersection cases** — "Every night, scan my repos for issues" is both
- **Deferred complexity** — Eventually need to reunify anyway

The counter-argument is stronger: the operations are fundamentally the same, just with
different triggers and contexts. Building two systems means maintaining two systems.

## Claude Code Interface: Visibility and Interaction

A goal is recreating the claude.ai/code experience: multiple running sessions ("tabs"),
ability to tap in, see what's happening, send messages.

### Key Components

1. **Task list** — All running/waiting/completed tasks
2. **Conversation view** — Full history of agent's work
3. **Input** — Send messages to running task (human-in-the-loop)
4. **Status** — Running, waiting for input, blocked, completed

### The Streaming Problem

Claude Agent SDK produces streaming output. How to show real-time updates in UI?

**Options:**

1. **Poll database** — Worker writes progress to DB, UI polls (simple, slight lag)
2. **WebSocket side-channel** — Worker publishes events, UI subscribes (real-time)
3. **Temporal queries** — If using Temporal, query workflow state (built-in)

For v1, polling every 1-2 seconds is probably sufficient.

## Temporal Deep Dive

If we use Temporal, the mapping is clean:

| Concept               | Temporal Primitive             |
| --------------------- | ------------------------------ |
| Task                  | Workflow                       |
| Task state            | Workflow state (durable)       |
| Send message          | Signal                         |
| Get state             | Query                          |
| Scheduled task        | Schedule                       |
| Wait for human (days) | `wait_condition()` — zero cost |

Temporal's value proposition for this use case:

- **Durable state** — Survives crashes, restarts
- **Human-in-the-loop** — Signals are first-class
- **Long waits** — Can wait days/weeks without consuming resources
- **Audit trail** — Full workflow history

The tradeoff is added infrastructure (Temporal Cloud or self-hosted) and learning curve.

## Open Questions

### Where Does the Worker Run?

| Option                  | Pros                | Cons                |
| ----------------------- | ------------------- | ------------------- |
| Same server as Carmenta | Simple deployment   | Resource contention |
| Separate EC2/fly.io     | Isolated, dedicated | More infrastructure |
| Nick's Mac (dev)        | Full environment    | Not always on       |

### Temporal vs Simpler Queue?

For human-in-the-loop (agent waits days for user input), Temporal is purpose-built.

For simpler "run task, store result" patterns, BullMQ or Postgres queue may suffice.

The decision depends on how much human-in-the-loop we need.

### Unified or Split?

Current leaning: unified infrastructure makes sense architecturally, but there's
pragmatic appeal to shipping the GitHub workflow first without full worker
infrastructure.

The question: can the repo workflow be fully self-contained in GitHub (Actions +
webhooks), or does it need to talk to Carmenta's database for visibility/state?

If self-contained → split is fine, reunify later. If needs Carmenta → build unified from
the start.

## Key Insights

1. **Database access is the constraint** — Workers need production data, not isolation
   from production data.

2. **Technology isn't the moat** — Rather than juggling external services, simpler to
   run own infrastructure (Render/EC2) with full control.

3. **Same core operation** — Repo work and user tasks are both "load context, run agent,
   produce output" with different triggers.

4. **Postgres is a job queue** — `SELECT ... FOR UPDATE SKIP LOCKED` is battle-tested.
   May not need Redis/BullMQ/Temporal for v1.

5. **Temporal solves human-in-the-loop** — If tasks need to wait days for user input,
   Temporal's signal/wait model is elegant. But adds complexity.

## Relationship to Other Docs

- [execution-infrastructure.md](./execution-infrastructure.md) — The broader
  infrastructure vision, dev server recommendation
- [architecture.md](./architecture.md) — System data flows
- [actors.md](./actors.md) — AI Engineer role specification
- [../components/god-mode.md](../components/god-mode.md) — God Mode shares this
  infrastructure

## Next Steps (Not Decisions)

These are directions to explore, not commitments:

1. **Prototype the simplest version** — Postgres queue + Python worker with Claude Agent
   SDK
2. **Validate the GitHub workflow** — Can it be self-contained, or needs Carmenta
   integration?
3. **Evaluate Temporal** — Spike on human-in-the-loop pattern to understand complexity
4. **Design the task UI** — What does "tap in" to a running agent actually look like?
