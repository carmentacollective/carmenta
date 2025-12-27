# AI Team Architecture

The infrastructure that enables background agents, resumable streams, long-running jobs,
and scheduled tasks. This is the execution layer that transforms Carmenta from a chat
interface into a team of AI agents working alongside you.

## Vision

The AI Team represents the
[10x layer](../../context/100x-framework.md#capacity-achieving-10x-your-ai-team) of
Carmenta: one person operating at their full capacity (1x) becomes a team of ten (10x).
This isn't about faster responses - it's about work that continues when you're not
watching.

Today's AI chat interfaces require your attention. You ask a question, you wait, you get
an answer. The AI Team flips this: agents work in the background, surface results when
ready, and ask for help when stuck. You check in on your team rather than babysitting a
chat window.

The key insight: **the same infrastructure that enables scheduled tasks also enables
resumable streams, background agents, and Claude Code integration.** These aren't
separate systems - they're different access patterns for a unified execution layer.

### What "AI Team" Means

Not chatbots with different personalities. Specialized execution contexts with focused
capabilities:

- **Digital Chief of Staff**: Tracks commitments, maintains context, anticipates needs
- **Background Agents**: Long-running tasks that continue without UI (research,
  analysis)
- **Scheduled Tasks**: Cron-triggered automation (briefings, monitoring, digests)
- **Resumable Streams**: Disconnect recovery for any of the above

All agents share:

- Access to your Memory and Knowledge Base
- The same service integrations you've connected
- The ability to escalate when stuck
- Progress visibility in the Carmenta UI

## User Stories

### Background Agents

> "Run deep research on this topic. I'll check back later."

The user kicks off a research task and closes their laptop. The agent continues working,
saves results to the Knowledge Base, and sends a notification when complete. If the user
reopens Carmenta mid-task, they see live progress.

> "Analyze all my calendar meetings from last quarter and identify patterns."

A task that takes 15 minutes shouldn't require 15 minutes of attention. The user starts
the analysis, does other work, and returns to a complete report.

### Resumable Streams

> "Continue from where we left off."

The user's connection drops during a long response. When they reconnect, the response
picks up exactly where it stopped - no lost work, no repeated content, no restart.

> "I closed the tab by accident. Is my research still running?"

Background work doesn't die when the browser closes. The agent continues, and the user
reconnects to an in-progress or completed task.

### Scheduled Tasks

> "Give me a daily briefing at 7am with my calendar, priorities, and overnight signals."

Carmenta works while you sleep. You wake up to prepared context, not an empty inbox to
process.

> "Monitor HackerNews for mentions of our competitors and summarize weekly."

Recurring tasks that would require manual effort now happen automatically with results
delivered on schedule.

> "Before each meeting, prepare context on attendees and previous discussions."

Event-triggered agents that anticipate your needs without explicit requests.

### Agent Orchestration

> "Create a comprehensive market analysis. Use multiple sources and approaches."

One request spawns multiple specialized agents: one searches academic papers, one
analyzes competitor filings, one synthesizes social sentiment. Results converge into a
unified report.

> "Write the blog post and have it reviewed before publishing."

A creator agent drafts content, a reviewer agent provides critique, and the creator
revises based on feedback - all without human intervention for routine cases.

## Components

### Resumable Streams

**Problem**: LLM responses can take minutes. Network is unreliable. Users close tabs.
When these interruptions happen, work is lost.

**Solution**: Separate generation from delivery. The agent generates into durable
storage; clients read from that storage and can resume from any point.

**Key Principles**:

1. **Generation continues regardless of client state**: The backend doesn't know or care
   if anyone is watching. It writes chunks to persistent storage (Redis Streams or
   Postgres) with sequential IDs.

2. **Clients track their position**: Each client maintains its own cursor (last seen
   ID). On reconnect, it requests "everything after position X" and resumes seamlessly.

3. **Horizontal scaling**: Multiple clients can connect to the same stream. New browser
   tabs, mobile devices, or API consumers all read from the same source of truth.

4. **Graceful expiration**: Streams expire after a configurable window (e.g., 15
   minutes). Old streams don't accumulate indefinitely.

**User Experience**:

- Response continues streaming after page refresh
- "Reconnecting..." indicator with progress preserved
- Switch devices mid-response without loss
- Multiple tabs show the same content in sync

**Relationship to Background Agents**: Resumable streams are the foundation. Background
agents are just streams that run longer and store richer state.

### Background Agents

**Problem**: Some tasks take minutes or hours. Holding a connection open that long is
impractical. Users need to close laptops, switch contexts, and return later.

**Solution**: Decouple task submission from result delivery. Tasks run on dedicated
infrastructure, store state persistently, and notify when complete.

**Key Principles**:

1. **Task as first-class entity**: Each background task has an ID, status, progress
   updates, and results. It exists independently of any client connection.

2. **Worker isolation**: Tasks run on ephemeral compute (Fly.io Machines, E2B) separate
   from the web application. A slow task doesn't affect chat responsiveness.

3. **Progress visibility**: Users see what the agent is doing in real-time when
   connected, and can review the full history when reconnecting.

4. **Human-in-the-loop**: Agents can pause and wait for user input. "I need access to
   your Salesforce. Approve?" The task sleeps, waits for the signal, then resumes.

**Task Lifecycle**:

1. **Submitted**: User initiates task, receives task ID immediately
2. **Running**: Agent executes on worker infrastructure, streams progress
3. **Waiting**: Agent needs input (approval, credentials, clarification)
4. **Completed**: Results stored, notification sent, visible in history
5. **Failed**: Error captured, user notified, retry available

**User Experience**:

- "Task started. We'll notify you when complete."
- Progress bar and status in conversation
- Notification (push, email, or in-app) on completion
- Full task history available in the UI
- Click to "tap in" to a running agent

### Scheduled Tasks

**Problem**: Valuable work should happen proactively, not just on demand. You shouldn't
have to remember to ask for your morning briefing.

**Solution**: Cron-like scheduling for agent tasks with delivery via notification
channels.

**Trigger Types**:

1. **Time-based**: "Every morning at 7am", "Weekly on Monday", "First of month"
2. **Event-triggered**: "Before each calendar meeting", "When new email from X arrives"
3. **Interval-based**: "Every 4 hours", "Every 30 minutes during market hours"

**Common Patterns**:

- **Daily briefing**: Calendar, priorities, overnight signals, weather
- **Meeting prep**: Context on attendees, previous discussions, relevant materials
- **Monitoring**: Keyword alerts, competitor mentions, threshold breaches
- **Research digests**: Weekly summary of tracked topics
- **Follow-up reminders**: Surface commitments coming due

**Delivery Channels**:

- Push notification (PWA/mobile)
- Email digest
- In-app dashboard/briefing view
- Proactive message in conversation

**User Experience**:

- "Set up a daily briefing" creates a scheduled task
- Dashboard shows all active schedules and last run times
- Edit schedules with natural language or structured UI
- View history of past scheduled task runs
- Mute/pause/resume individual schedules

### Agent Orchestration

**Problem**: Complex tasks benefit from specialized agents working together. A single
agent doing everything is less effective than a team with focused roles.

**Solution**: Orchestration layer that spawns, coordinates, and aggregates results from
multiple sub-agents.

**Orchestration Patterns**:

1. **Sequential handoff**: Planner -> Executor -> Verifier
2. **Parallel gathering**: Multiple research agents, results merged
3. **Conditional routing**: Route to different specialists based on task type
4. **Iterative refinement**: Creator -> Reviewer -> Creator (cycle until quality met)

**Agent Roles** (functional, not anthropomorphized):

- **Planner**: Breaks complex requests into executable steps
- **Executor**: Carries out individual steps
- **Verifier**: Validates outputs against requirements
- **Researcher**: Gathers information from KB and external sources
- **Synthesizer**: Merges results from multiple agents

**Communication Protocol**:

Agents communicate through structured artifacts, not conversation transcripts:

- Task breakdowns (structured schemas)
- Results with success/failure states
- Validation reports with specific issues
- Findings with sources and confidence scores

This prevents cross-talk, context pollution, and reasoning drift that occur when agents
share a conversation context.

**Relationship to Zapier's Approach**: Zapier Agents now supports
[agent-to-agent calling](https://help.zapier.com/hc/en-us/articles/37902635257101) where
one agent can delegate to others. Their pattern: main agent determines routing, calls
specialized agents, aggregates results. Carmenta can follow a similar pattern while
keeping agents internal rather than requiring separate configuration.

## Architecture Overview

The architecture separates concerns into distinct layers that compose to handle all use
cases:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CARMENTA WEB (Render)                            │
│                                                                         │
│    Chat Interface │ Task Dashboard │ Schedule Manager │ Progress View   │
│                                                                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     │ API / WebSocket
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATION LAYER                               │
│                                                                         │
│    Task Queue │ Scheduler │ State Machine │ Routing │ Notifications     │
│                                                                         │
│    ┌──────────────────────────────────────────────────────────────┐    │
│    │                     DURABLE STATE                             │    │
│    │         Postgres (tasks, schedules, results)                  │    │
│    │         Redis (streams, real-time state)                      │    │
│    └──────────────────────────────────────────────────────────────┘    │
│                                                                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     │ Dispatch
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXECUTION LAYER                                   │
│                                                                         │
│    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐     │
│    │  Ephemeral      │   │  Ephemeral      │   │  Ephemeral      │     │
│    │  Worker         │   │  Worker         │   │  Worker         │     │
│    │                 │   │                 │   │                 │     │
│    │  Claude Agent   │   │  Claude Agent   │   │  Claude Agent   │     │
│    │  SDK            │   │  SDK            │   │  SDK            │     │
│    │                 │   │                 │   │                 │     │
│    │  Tools, MCP,    │   │  Tools, MCP,    │   │  Tools, MCP,    │     │
│    │  Integrations   │   │  Integrations   │   │  Integrations   │     │
│    └─────────────────┘   └─────────────────┘   └─────────────────┘     │
│                                                                         │
│    Fly.io Machines (spin up on demand, auto-destroy after task)         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Why this separation**:

1. **Web layer stays responsive**: Chat and UI never blocked by long tasks
2. **Workers scale independently**: Burst to many parallel agents when needed
3. **State survives everything**: Workers crash, clients disconnect, nothing is lost
4. **Same infrastructure, all use cases**: Streaming, background tasks, and scheduled
   jobs all flow through the same orchestration layer

## State Management

### Task State

Every task (whether streaming response, background job, or scheduled run) is recorded:

- **Task ID**: Unique identifier, returned immediately on submission
- **Status**: submitted, running, waiting, completed, failed, cancelled
- **Progress**: Percentage or step count, for progress bars
- **Events**: Timestamped log of significant happenings
- **Result**: Final output (text, structured data, file references)
- **Error**: If failed, what went wrong
- **Parent/Children**: For orchestrated multi-agent tasks

### Stream State

For resumable streams specifically:

- **Chunks**: Ordered sequence of content pieces with IDs
- **Cursor positions**: Per-client tracking of last-seen chunk
- **Expiration**: When this stream can be garbage collected

### Schedule State

For recurring tasks:

- **Schedule expression**: Cron syntax or event trigger
- **Last run**: When it last executed, status, duration
- **Next run**: When it will next execute
- **Enabled**: Whether currently active
- **History**: Recent execution history with results

### Storage Strategy

**Postgres** for:

- Task definitions and metadata
- Schedule configurations
- Completed results
- Long-term history

**Redis** for:

- Active stream chunks (with TTL)
- Real-time status updates
- Client cursor tracking
- Job queue (if using BullMQ)

This follows LibreChat's pattern where Redis handles real-time streaming state and
Postgres handles durable records. See their
[Redis configuration](https://www.librechat.ai/docs/configuration/redis) for reference.

## Progress Visibility

Users should always know what their agents are doing.

### Active Task View

When a task is running:

- Current status message ("Researching academic papers...")
- Progress indicator (percentage or step X of Y)
- Live log of actions taken
- "Tap in" to see full conversation/reasoning
- Cancel button for abort

### Task History

All tasks appear in history:

- Filterable by status, type, date
- Full results viewable
- Re-run capability for failed tasks
- Duration and resource usage

### Dashboard

Overview of AI Team activity:

- Currently running tasks
- Upcoming scheduled tasks
- Recent completions
- Tasks waiting for input

### Notifications

When attention is needed:

- Task completed with results summary
- Task waiting for approval/input
- Task failed with error context
- Scheduled task completed (digest format)

## Human-in-the-Loop

Agents should escalate rather than guess when uncertain.

### Approval Patterns

- **Credential requests**: "I need access to Salesforce to continue"
- **High-impact actions**: "About to send email to 500 people. Confirm?"
- **Ambiguous intent**: "Did you mean X or Y?"
- **Quality gates**: "The analysis is ready. Review before publishing?"

### Escalation Mechanics

1. Agent determines it needs human input
2. Task status changes to "waiting"
3. Notification sent to user via preferred channel
4. Task sleeps (zero resource cost while waiting)
5. User provides input via conversation or approval UI
6. Task resumes from wait point with new context

### Waiting Duration

Tasks can wait:

- Minutes (quick approval)
- Hours (user is busy)
- Days (complex review needed)

Durable execution means no resource cost while waiting. This is where Temporal's signal
model excels: workflows can `wait_condition()` for days at zero compute cost. See
[Temporal for AI](https://temporal.io/solutions/ai) for their approach to this pattern.

### Configurable Autonomy

Users set autonomy preferences:

- "Always ask before sending external communications"
- "Auto-approve spending under $10"
- "Never modify production systems without confirmation"

## Infrastructure Considerations

### Current Stack

Carmenta runs on Render with Postgres (Supabase) and is evaluating compute options:

- **Fly.io Machines**: Ephemeral VMs, ~500ms cold start, usage-based pricing
- **E2B**: Managed sandboxes, ~150ms cold start, $150/mo base + usage

See [ephemeral-compute.md](../ephemeral-compute.md) for detailed comparison.

### Why Fly.io for Background Agents

Fly.io fits the background agent pattern well:

1. **Spin up on demand**: Worker boots when task submitted
2. **Full toolchain**: Docker images with any dependencies
3. **Auto-destroy**: Machine terminates when task completes
4. **Usage-based**: Pay only for actual compute time
5. **Database access**: Can connect to production Postgres

The [Fly Machines API](https://fly.io/docs/blueprints/work-queues/) enables programmatic
worker lifecycle management. Their
[task scheduling guide](https://fly.io/docs/blueprints/task-scheduling/) shows Cron
Manager for scheduled jobs.

### Redis for Real-Time State

Redis handles:

- Stream chunks for resumable delivery
- Real-time task status
- Pub/sub for notifications
- Job queue (if using BullMQ)

LibreChat recently added
[Redis ping interval](https://www.librechat.ai/changelog/v0.7.8) to prevent connection
drops. We should implement similar connection stability patterns.

### Durable Execution Option

For complex human-in-the-loop workflows, consider Temporal or Inngest:

**Temporal** ([temporal.io](https://temporal.io/solutions/ai)):

- Purpose-built for workflows that wait for human input
- Used by OpenAI for Codex and ChatGPT image generation
- Signals for injecting events into waiting workflows
- Zero cost while sleeping

**Inngest** ([inngest.com](https://www.inngest.com/uses/durable-workflows)):

- Event-driven durable functions
- Works with existing serverless infrastructure
- Step-based execution with automatic retry
- Simpler learning curve than Temporal

The decision depends on complexity: simple background tasks work fine with Postgres +
Redis. Workflows that wait days for approval benefit from Temporal's model.

## Claude Code Integration

The [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-python) provides
the execution harness that powers Claude Code. Carmenta can use this same SDK to run
sophisticated agents.

### SDK Capabilities

The SDK (Python, version 0.1.18 as of December 2025) provides:

- **Bidirectional conversation**: Multi-turn interactive sessions
- **Custom tools**: Python functions as MCP servers
- **Hook system**: Logic before/after tool execution
- **Permission control**: Fine-grained tool-usage permissions
- **Async-first**: Built on anyio for cross-platform async

See [Anthropic's documentation](https://platform.claude.com/docs/en/agent-sdk/overview)
for the full API reference.

### Integration Patterns

**Pattern 1: Claude Agent SDK as Worker**

```
User Request → Orchestration → Fly.io Machine → Claude Agent SDK → Results
```

The worker boots with the Claude Agent SDK installed, runs the task, and terminates.
This gives full Claude Code capabilities (file operations, shell, browser automation) in
an isolated environment.

**Pattern 2: Wrapping Claude Code CLI**

The SDK spawns the Claude Code CLI as a subprocess. For tasks that benefit from Claude
Code's existing harness (code editing, test running, PR creation), we can invoke Claude
Code directly rather than reimplementing its tooling.

**Pattern 3: Hybrid Approach**

Light tasks run with the Vercel AI SDK (current Carmenta implementation). Heavy tasks
dispatch to Claude Agent SDK workers. The orchestration layer decides based on task
complexity, expected duration, and required capabilities.

### Key Insight from Anthropic

From
[their engineering blog](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk):

> The key design principle behind the Claude Agent SDK is to give your agents a
> computer, allowing them to work like humans do. We believe giving Claude a computer
> unlocks the ability to build agents that are more effective than before.

This aligns with Carmenta's vision: agents that work autonomously with the same tools
and access you would have.

## Security & Limits

### Rate Limits

- **Concurrent tasks per user**: Limit parallel agent runs (e.g., 5)
- **Scheduled tasks per user**: Limit active schedules (e.g., 10)
- **Compute time per day**: Cap total agent runtime
- **API calls per task**: Prevent runaway tool invocations

### Cost Controls

- **Per-task budget**: Maximum spend before pause and escalation
- **Monthly budget**: User-set spending cap
- **Model restrictions**: Limit expensive models for background tasks
- **Approval thresholds**: Require confirmation above cost threshold

### Permissions

- **Tool access**: Which tools each agent type can use
- **Integration access**: Which services agents can call
- **Action restrictions**: Read-only for some users/tasks
- **Data boundaries**: Agents can't access other users' data

### Audit Trail

- **Full history**: Every action logged with timestamp
- **Tool invocations**: What was called, with what parameters
- **Results**: What was returned
- **Approvals**: Who approved what, when

### Sandboxing

Workers run in isolated environments:

- Ephemeral machines with clean state
- No access to other users' data
- Network restricted to approved endpoints
- Auto-destroy after task completion

ChatGPT Agent takes this seriously:
["This is the first time users can ask ChatGPT to take actions on the live web"](https://openai.com/index/introducing-chatgpt-agent/)
requires explicit confirmation before high-impact actions, restricts certain actions,
and offers settings to delete browsing data.

## Open Questions

### Architecture Decisions

**Temporal vs. Postgres Queue?**

For simple background tasks, Postgres with `SELECT ... FOR UPDATE SKIP LOCKED` is
battle-tested. For workflows that wait days for human approval, Temporal's signal model
is elegant. Decision: start with Postgres queue, add Temporal if human-in-the-loop
patterns become complex.

**Where do workers run?**

Fly.io Machines vs. E2B vs. Render background jobs. Current leaning: Fly.io for
flexibility and database access. E2B is simpler but may not support full dev toolchain.

**Same infrastructure for all agent types?**

Arguments for unified: same core operation (load context, run agent, produce output).
Arguments for split: different trust models, different interaction patterns. Current
leaning: unified infrastructure, different agent configurations.

### Product Decisions

**How visible is agent activity?**

Minimal (just notifications) vs. dashboard with live progress vs. full "tap in"
capability. ChatGPT's approach: progress indicators during active tasks, history
available after.

**Default schedules?**

Do we start with pre-configured schedules (daily briefing) or require explicit setup?
ChatGPT Pulse (Pro feature) does proactive research without explicit configuration.

**Agent naming?**

Abstract "the team" vs. named agents (DCOS, Researcher)? The existing ai-team.md spec
uses named roles. Keep names for personality, but functionality matters more.

**Autonomy levels per user?**

Configurable preferences ("never send email without asking") vs. default safe behaviors.
Start conservative, expand based on demonstrated reliability.

### Technical Questions

**Stream storage: Redis Streams vs. Postgres?**

Redis Streams are purpose-built for this. Postgres could work for simpler cases. Start
with Redis given industry precedent (LibreChat, AI SDK).

**How long do streams persist?**

15 minutes? 1 hour? Configurable? The AI SDK resumable-stream package has configurable
expiration. Start with 15 minutes, extend based on usage patterns.

**WebSocket vs. SSE for real-time updates?**

Current streaming uses SSE. Background task status updates could use either. SSE is
simpler; WebSocket enables bidirectional communication for "tap in" interaction.

**Multi-region execution?**

Fly.io supports 35+ regions. Do we run agents near users for latency, or centralized for
simplicity? Start centralized, distribute if latency becomes an issue.

## References

### Industry Implementations

- [ChatGPT Tasks](https://help.openai.com/en/articles/10291617-tasks-in-chatgpt):
  OpenAI's scheduled automation (January 2025)
- [ChatGPT Agent](https://openai.com/index/introducing-chatgpt-agent/): Combines
  Operator and Deep Research (July 2025)
- [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-python): Anthropic's
  Python SDK for agents (December 2025)
- [Zapier Agent Orchestration](https://zapier.com/blog/orchestrate-zapier-agents/):
  Agent-to-agent calling (May 2025)
- [LibreChat Resumable Streams](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams):
  AI SDK implementation pattern

### Infrastructure Patterns

- [Fly.io Work Queues](https://fly.io/docs/blueprints/work-queues/): Background job
  pattern with Machines
- [Temporal for AI](https://temporal.io/solutions/ai): Human-in-the-loop orchestration
- [Inngest Durable Workflows](https://www.inngest.com/uses/durable-workflows):
  Event-driven durable execution
- [Upstash Resumable Streams](https://upstash.com/blog/resumable-llm-streams): Redis
  Streams for LLM output

### Carmenta Context

- [AI Team Overview](../ai-team.md): High-level vision and success criteria
- [Scheduled Agents](../scheduled-agents.md): Cron-triggered background work
- [Agent Orchestration](../agent-orchestration.md): Multi-agent patterns
- [Ephemeral Compute](../ephemeral-compute.md): Execution infrastructure options
- [Worker Architecture Exploration](../../ai-pm/worker-architecture-exploration.md):
  Deep dive on worker patterns
- [Execution Infrastructure](../../ai-pm/execution-infrastructure.md): Dev server and
  God Mode infrastructure
