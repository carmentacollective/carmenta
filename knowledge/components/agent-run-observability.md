# Agent Run Observability & Learning

How we track scheduled agent runs, expose debugging interfaces, and enable agents to
learn across executions. The unified system for run history, debug panels, and cross-run
memory.

## Why This Exists

Scheduled agents run in the background - daily briefings, monitoring tasks, research
digests. When something goes wrong (or when it works unexpectedly well), we need to
understand what happened. And when an agent runs repeatedly, it should get smarter -
building playbooks from experience rather than starting fresh each time.

This sits at the intersection of three concerns:

1. **Observability for humans** - Debug panels, run history, step-by-step traces
2. **Learning for agents** - Notes, playbooks, knowledge transfer between runs
3. **Access control** - Which users can see the debug panel (Clerk metadata)

## The Deeper Question

"Run history" is really about **trust through transparency**. When agents work
autonomously, users need to verify they're working correctly. When agents fail, we need
to understand why. When agents succeed, we want to replicate that success.

"Notes for next run" is really about **emergent expertise**. An agent that runs daily
should accumulate wisdom. It should notice patterns, refine strategies, and build an
internal playbook - not through training, but through structured reflection on its own
executions.

---

## Landscape Analysis

### Workflow Automation Platforms

**n8n** - Most mature execution tracking:

- Separate `ExecutionData` table for large payloads (lazy-loaded)
- `ExecutionMetadata` key-value pairs for custom data
- Status enum: `new → running → success/error/crashed/canceled/waiting`
- Node-level `ITaskData` with timing, input/output, errors
- Debug panel loads data from previous executions for replay
- Real-time WebSocket push for live execution updates
- Recovery from crashed executions via event log reconstruction

**Activepieces** - Clean step-level model:

- `FlowRun` entity with `steps: Record<string, StepOutput>`
- StepOutput includes: type, status, input, output, duration, errorMessage
- BullMQ queue for deduplication of rapid status updates
- File-based execution state (logsFileId → S3/blob storage)
- Two retry strategies: FROM_FAILED_STEP or ON_LATEST_VERSION
- Distributed locking prevents concurrent updates to same run

**Make.com** (Integromat):

- Scenario history with replay from failed runs
- DevTool with scenario debugger
- Catch-All Scenario pattern for centralized error logging
- API access to execution logs (List Scenario Logs endpoint)

**Temporal** - Event-sourced execution:

- Complete Event History for entire workflow lifecycle
- Replay reconstructs execution from history (deterministic)
- Workflow Replay Debugger for step-through debugging
- Event History doubles as audit log
- Replayer tests ensure backward compatibility

**Inngest** - Developer-focused observability:

- Waterfall trace view (inspired by OpenTelemetry)
- Function runs search across millions of runs (milliseconds)
- Local Dev Server at localhost:8288 for development
- Step-level timing, retries, errors visible
- Replay function runs or send events to local dev

Sources:

- [n8n Logging & Monitoring](https://docs.n8n.io/hosting/logging-monitoring/logging/)
- [n8n Debug & Re-run](https://docs.n8n.io/workflows/executions/debug/)
- [Activepieces Debugging Runs](https://www.activepieces.com/docs/flows/debugging-runs)
- [Temporal Event History](https://docs.temporal.io/workflow-execution/event)
- [Inngest Observability](https://www.inngest.com/docs/platform/monitor/observability-metrics)
- [Make.com Execution History](https://www.make.com/en/help/scenarios/scenario-execution-history)

### Agent Memory & Learning Patterns

**CrewAI Memory System**:

- Short-term: ChromaDB with RAG for session context
- Long-term: SQLite3 for task results across sessions
- Entity memory: RAG for people, places, concepts
- Enable with single `memory=True` parameter
- Storage in platform-specific directories, configurable via `CREWAI_STORAGE_DIR`

**LangGraph Checkpointers**:

- Short-term: Thread-level persistence (`InMemorySaver`, `PostgresSaver`, `RedisSaver`)
- Long-term: Stores (`RedisStore`, `MongoDBStore`) for cross-session memory
- LangMem toolkit for procedural, episodic, semantic memory extraction
- State preserved across container restarts via checkpointer

**AutoGen Teachability**:

- Persists user teachings in vector database (memos)
- Memories saved to disk during conversation
- Loaded in future sessions for continuity
- Zep integration for long-term fact management
- Known limitation: Studio 0.4 lacks cross-session history

**ACE (Agentic Context Engineering)** - Self-improving playbooks:

- Generator: Produces reasoning trajectories
- Reflector: Distills insights from successes and errors
- Curator: Integrates insights into structured contexts
- Prevents "context collapse" (iterative rewriting erodes details)
- Prevents "brevity bias" (dropping domain insights for conciseness)
- 17.1% accuracy improvement on AppWorld benchmark

Sources:

- [CrewAI Memory](https://docs.crewai.com/en/concepts/memory)
- [LangGraph Memory](https://docs.langchain.com/oss/python/langgraph/add-memory)
- [AutoGen Teachability](https://microsoft.github.io/autogen/0.2/docs/notebooks/agentchat_teachability/)
- [ACE Paper](https://arxiv.org/abs/2510.04618)
- [ACE GitHub](https://github.com/ace-agent/ace)

---

## Synthesis: What Leaders Do

### Table Stakes

- Run history with status, timing, success/failure
- Basic error messages when things fail
- Ability to see what ran and when

### Leader Features

- Step-by-step execution traces (n8n, Inngest)
- Lazy-loaded execution data (n8n's separate ExecutionData table)
- Real-time status via WebSocket (n8n, Activepieces)
- Replay with original data or retry on latest version (Activepieces)
- Custom metadata on executions (n8n's ExecutionMetadata)
- Searchable run history with filters (Inngest)

### Differentiation Opportunities

- Agent learning from execution feedback (ACE pattern)
- Structured notes/playbooks that persist across runs
- Automatic insight extraction (Reflector pattern)
- Curator that maintains evolving context without collapse
- Connection to existing Memory system (knowledge base integration)

### Convergent Patterns

1. **Separate metadata from payload** - Run metadata in DB, large outputs in file/blob
2. **Status enum with clear transitions** - new → running → terminal state
3. **Step-level granularity** - Each step has timing, input, output, error
4. **Deduplication for rapid updates** - Queue-based batching to prevent DB thrashing
5. **Distributed locking** - Prevent concurrent updates to same run
6. **WebSocket for live updates** - Not polling; push events to connected clients

---

## Architecture

### Data Model

```sql
-- Agent runs (lightweight metadata)
CREATE TABLE agent_runs (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,           -- 'daily-briefing', 'monitoring', etc.
  schedule_id UUID REFERENCES schedules(id),

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'queued', -- queued, running, succeeded, failed, canceled
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,

  -- Error tracking
  failed_step TEXT,                    -- Name of step that failed
  error_message TEXT,

  -- Links
  logs_file_id UUID REFERENCES files(id),  -- Full execution data in blob storage
  notes_id UUID REFERENCES agent_notes(id), -- Cross-run learning

  -- Metadata
  trigger_type TEXT,                   -- 'schedule', 'manual', 'event'
  steps_count INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ              -- Soft delete
);

-- Custom metadata (n8n pattern)
CREATE TABLE agent_run_metadata (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,

  UNIQUE(run_id, key)
);

-- Agent notes/playbooks (cross-run learning)
CREATE TABLE agent_notes (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,

  -- ACE-style structured context
  playbook JSONB,                      -- Accumulated strategies
  insights JSONB,                      -- Recent observations
  last_reflection_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, agent_type)
);

-- Indexes
CREATE INDEX idx_agent_runs_user_status ON agent_runs(user_id, status, created_at DESC);
CREATE INDEX idx_agent_runs_agent_type ON agent_runs(agent_type, created_at DESC);
CREATE INDEX idx_agent_runs_schedule ON agent_runs(schedule_id, created_at DESC);
```

### Execution Data Structure (in blob storage)

```typescript
interface ExecutionOutput {
  steps: Record<string, StepOutput>;
  metadata: Record<string, unknown>;
  reflection?: ReflectionOutput; // Agent's self-analysis
}

interface StepOutput {
  type: string; // 'tool_call', 'llm_completion', 'decision', etc.
  name: string;
  status: "running" | "succeeded" | "failed" | "skipped";

  startedAt: string;
  finishedAt: string;
  duration: number; // milliseconds

  input?: unknown; // What went in
  output?: unknown; // What came out
  error?: {
    message: string;
    stack?: string;
    context?: Record<string, unknown>;
  };
}

interface ReflectionOutput {
  // Agent's notes for next run
  whatWorked: string[];
  whatFailed: string[];
  suggestedImprovements: string[];
  patternsObserved: string[];

  // Curator-integrated playbook updates
  playbookDelta?: {
    addedStrategies: string[];
    removedStrategies: string[];
    refinedStrategies: Array<{ from: string; to: string }>;
  };
}
```

### Access Control (Clerk Integration)

```typescript
// In Clerk user metadata
interface UserMetadata {
  features?: {
    debugPanel?: boolean; // Can see agent run history
    adminAccess?: boolean; // Can see all users' runs
  };
}

// Check in middleware
const canAccessDebugPanel = (user: User): boolean => {
  return user.publicMetadata?.features?.debugPanel === true;
};
```

---

## Core Functions

### 1. Run Tracking

Track agent executions with step-level granularity:

```typescript
async function createRun(params: {
  userId: string;
  agentType: string;
  scheduleId?: string;
  triggerType: "schedule" | "manual" | "event";
}): Promise<AgentRun> {
  const run = await db.agentRuns.create({
    ...params,
    status: "queued",
    createdAt: new Date(),
  });

  // Broadcast to WebSocket
  await pusher.trigger(`user-${params.userId}`, "run-created", { runId: run.id });

  return run;
}

async function updateRunProgress(
  runId: string,
  update: Partial<AgentRun>
): Promise<void> {
  // Dedup via BullMQ (Activepieces pattern)
  await runProgressQueue.add(
    "update",
    { runId, ...update },
    { jobId: runId, removeOnComplete: true } // Dedup by runId
  );
}
```

### 2. Step Capture

Capture each step's execution:

```typescript
async function recordStep(runId: string, step: StepOutput): Promise<void> {
  // Append to in-memory execution state
  const state = await getExecutionState(runId);
  state.steps[step.name] = step;
  await setExecutionState(runId, state);

  // Real-time WebSocket push
  await pusher.trigger(`run-${runId}`, "step-completed", step);
}
```

### 3. Execution Finalization

On completion, save full execution data and trigger reflection:

```typescript
async function finalizeRun(
  runId: string,
  status: "succeeded" | "failed" | "canceled",
  error?: { step: string; message: string }
): Promise<void> {
  const executionState = await getExecutionState(runId);

  // Upload full execution data to blob storage
  const logsFileId = await uploadExecutionLogs(runId, executionState);

  // Update run record
  await db.agentRuns.update(runId, {
    status,
    finishedAt: new Date(),
    logsFileId,
    failedStep: error?.step,
    errorMessage: error?.message,
    stepsCount: Object.keys(executionState.steps).length,
  });

  // Trigger reflection (async, non-blocking)
  if (shouldReflect(status, executionState)) {
    void reflectOnExecution(runId, executionState);
  }

  // WebSocket broadcast
  await pusher.trigger(`run-${runId}`, "run-completed", { status, error });
}
```

### 4. Reflection & Learning (ACE Pattern)

Agent self-reflection after execution:

```typescript
async function reflectOnExecution(
  runId: string,
  executionState: ExecutionOutput
): Promise<void> {
  const run = await db.agentRuns.findById(runId);
  const notes = await db.agentNotes.findOrCreate(run.userId, run.agentType);

  // Reflector: Extract insights from this run
  const reflection = await llm.complete({
    system: `You are reflecting on an agent execution to extract learnings.

    Current playbook:
    ${JSON.stringify(notes.playbook)}

    Execution steps:
    ${JSON.stringify(executionState.steps)}`,

    prompt: `Analyze this execution. Extract:
    1. What worked well (strategies to reinforce)
    2. What failed (patterns to avoid)
    3. Improvements for next time
    4. Patterns observed (recurring situations)

    Format as JSON matching ReflectionOutput schema.`,
  });

  // Curator: Integrate insights into playbook
  const updatedPlaybook = await curatePlaybook(notes.playbook, reflection);

  // Update agent notes
  await db.agentNotes.update(notes.id, {
    playbook: updatedPlaybook,
    insights: reflection,
    lastReflectionAt: new Date(),
  });

  // Store reflection with execution data
  executionState.reflection = reflection;
  await updateExecutionLogs(run.logsFileId, executionState);
}

async function curatePlaybook(
  currentPlaybook: Playbook,
  reflection: ReflectionOutput
): Promise<Playbook> {
  // Prevent context collapse: structured integration, not overwriting
  return await llm.complete({
    system: `You are a curator maintaining an evolving playbook.

    Rules:
    - Preserve valuable existing strategies
    - Add new insights that don't duplicate
    - Remove strategies that consistently fail
    - Refine strategies based on new evidence
    - Keep playbook focused and actionable (max 20 strategies)`,

    prompt: `Current playbook:
    ${JSON.stringify(currentPlaybook)}

    New reflection:
    ${JSON.stringify(reflection)}

    Return updated playbook with changes noted.`,
  });
}
```

### 5. Context Injection for Scheduled Runs

When an agent runs, inject its accumulated knowledge:

```typescript
async function buildAgentContext(userId: string, agentType: string): Promise<string> {
  const notes = await db.agentNotes.find(userId, agentType);

  if (!notes?.playbook) {
    return ""; // First run, no accumulated knowledge
  }

  return `
<agent-playbook purpose="Accumulated wisdom from previous runs">
${formatPlaybook(notes.playbook)}
</agent-playbook>

<recent-insights purpose="Observations from last few runs">
${formatInsights(notes.insights)}
</recent-insights>
`;
}
```

---

## Debug Panel UI

### Components Needed

1. **Run History Table**
   - Filter by agent type, status, date range
   - Status badges (running/succeeded/failed)
   - Duration, step count
   - Quick actions: view details, retry, cancel

2. **Run Detail View**
   - Step-by-step timeline (waterfall style, like Inngest)
   - Expand each step for input/output/error
   - Reflection summary (what the agent learned)
   - Retry buttons (from failed step or fresh)

3. **Agent Notes Panel**
   - Current playbook for each agent type
   - Recent insights
   - Manual edit capability (for user correction)

### Access Control

```typescript
// In page/layout component
export default async function DebugPanelPage() {
  const user = await currentUser();

  if (!user?.publicMetadata?.features?.debugPanel) {
    return notFound(); // Or redirect
  }

  return <DebugPanel />;
}
```

---

## Gap Assessment

### Achievable Now

- Run tracking with status and timing (existing DB patterns)
- Step-level execution capture
- Blob storage for execution data (we have S3/R2)
- Clerk metadata for feature gating
- Basic run history UI
- WebSocket for live updates (Pusher/Ably)

### Emerging (6-12 months)

- ACE-style reflection with modern models (Claude's instruction-following)
- Playbook curation without context collapse
- Integration with existing Knowledge Base (agent notes → KB documents)
- OpenTelemetry tracing for distributed execution

### Aspirational

- Fully autonomous playbook evolution with human oversight
- Cross-user learning (aggregated patterns, privacy-preserving)
- Predictive failure detection based on execution patterns

---

## Integration Points

- **Scheduled Agents** (scheduled-agents.md): Run observability is the "clear feedback
  on what's scheduled and when it last ran" success criterion
- **Memory** (memory.md): Agent notes connect to Knowledge Base storage; playbooks could
  live in `/profile/agent-playbooks/`
- **Observability** (observability.md): LLM tracing via Sentry for the agent execution;
  run-level traces complement request-level traces
- **Ephemeral Compute** (ephemeral-compute.md): Scheduled agents run on this
  infrastructure; execution environment produces the step data

---

## Implementation Milestones

### M1: Run Tracking

- `agent_runs` table with status tracking
- Create/update/finalize run lifecycle
- Basic run history API endpoints

### M2: Step Capture

- Step recording during agent execution
- Blob storage for execution data
- Run detail API with step data

### M3: Debug Panel UI

- Run history table with filters
- Run detail view with step timeline
- Clerk metadata gating

### M4: Reflection & Learning

- Reflection trigger after execution
- Agent notes table
- Playbook curation logic
- Context injection for scheduled runs

### M5: Real-time Updates

- WebSocket integration for live status
- Running execution visibility
- Cancel in-progress runs

---

## Open Questions

### Architecture

- **Blob storage**: Use existing file infrastructure or dedicated execution logs bucket?
- **Queue choice**: BullMQ (if we add Redis) or database-backed queue?
- **Reflection frequency**: Every run, or batch at end of day?

### Product

- **Default visibility**: Debug panel opt-in or default-on for power users?
- **Playbook editing**: Can users manually edit agent playbooks? Should they?
- **Cross-agent learning**: Should monitoring agents learn from briefing agents?

### Research Needed

- ACE paper implementation details for production use
- Optimal reflection prompt engineering
- Playbook size limits before context collapse

---

## References

### Workflow Platforms Analyzed

- n8n execution model: `../reference/n8n-execution/packages/@n8n/db/src/entities/`
- Activepieces run tracking:
  `../reference/activepieces-observability/packages/server/api/src/app/flows/flow-run/`

### Papers & Research

- [ACE: Agentic Context Engineering](https://arxiv.org/abs/2510.04618) - Self-improving
  playbooks
- [Reflection in AI Agents](https://huggingface.co/blog/Kseniase/reflection) - Pattern
  overview
- [Self-Evolving Agents](https://cookbook.openai.com/examples/partners/self_evolving_agents/autonomous_agent_retraining) -
  OpenAI cookbook

### Framework Documentation

- [CrewAI Memory](https://docs.crewai.com/en/concepts/memory)
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/add-memory)
- [Temporal Event History](https://docs.temporal.io/workflow-execution/event)
- [Inngest Observability](https://www.inngest.com/docs/platform/monitor/observability-metrics)

---

**Status**: Research complete, ready for implementation planning

**Assumption Made**: Proceeded with ACE pattern for agent learning rather than simpler
key-value notes. This is the more sophisticated approach but requires more LLM calls.
Can simplify to structured JSON notes if reflection proves too expensive.
