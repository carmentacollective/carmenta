# Agent Robustness & Quality

The infrastructure that makes agents reliable, self-improving, and observable. This
complements [ai-team/spec.md](ai-team/spec.md) which covers execution infrastructure.
This spec covers what happens inside agent runs to make them robust.

## Problem Statement

Current agent architecture has critical gaps:

1. **No cross-agent memory**: Each agent starts fresh. If an agent fails trying approach
   A, the next run has no knowledge of that failure.
2. **No observability**: We can't trace what agents did, how long it took, or why they
   failed. Debugging requires reading conversation logs manually.
3. **No error recovery infrastructure**: Commands have ad-hoc error handling. No retry
   logic, no circuit breakers, no graceful degradation patterns.
4. **No self-improvement**: Agents don't learn from successes or failures. The same
   mistakes repeat across sessions.

These gaps become critical at scale. One user can babysit their agents. A team of AI
agents working autonomously needs infrastructure for reliability.

## Industry Patterns

Research from
[agent memory comparison](https://dev.to/foxgem/ai-agent-memory-a-comparative-analysis-of-langgraph-crewai-and-autogen-31dp)
and [self-evolving agents survey](https://arxiv.org/abs/2508.07407) identifies proven
approaches.

### Memory Systems

**LangGraph**: Stateful graphs with short-term (execution context) and long-term (vector
DB) memory. Memory persists across sessions via checkpointing.

**CrewAI + Mem0**: Role-based agents with external memory service. Mem0 adds persistent
context and reduces token costs by ~90% through semantic deduplication.

**AutoGen**: Message lists as memory, with external integrations for persistence.

**Pattern**: Separate short-term (within conversation) from long-term (across sessions).
Use semantic similarity (vector DBs) for retrieval. Store patterns, not raw
conversations.

### Error Recovery

From
[error recovery patterns](https://sparkco.ai/blog/mastering-retry-logic-agents-a-deep-dive-into-2025-best-practices)
and
[multi-agent failure recovery](https://galileo.ai/blog/multi-agent-ai-system-failure-recovery):

**Exponential backoff with jitter**: Scatter retry attempts to avoid thundering herd.
Different from traditional microservices because agents maintain context.

**Failure classification**: Distinguish transient (network, rate limits) from permanent
(auth, permissions, invalid input). Only retry transient failures.

**Orchestrator pattern**: Don't hardcode fallback in monolithic controller. Use
specialized fallback modules based on error type.

**State machine orchestration**: Explicit states, transitions, retries, timeouts. Makes
agents deterministic and observable.

### Self-Improvement

Three levels from
[self-evolving agents research](https://github.com/EvoAgentX/Awesome-Self-Evolving-Agents):

1. **Prompt & memory evolution** (established): Agents extract insights from successful
   and failed trajectories. Update prompts based on patterns.

2. **Tool & workflow evolution** (emerging): Agents modify their own code and workflows.
   Sakana AI's Darwin Gödel Machine improved from 20% to 50% on SWE-bench through
   self-modification.

3. **Model weight modification** (theoretical): No production systems do this
   autonomously.

**Feedback loops**: Pre-operation hooks analyze and predict. Post-operation hooks
capture outcomes. Training system learns from both. Models improve future predictions.

### Observability

From
[LLM observability guide](https://www.getmaxim.ai/articles/the-best-ai-observability-tools-in-2025-maxim-ai-langsmith-arize-helicone-and-comet-opik/):

**Distributed tracing**: Track lifecycle from user input to final response, including
intermediate operations and tool calls. OpenTelemetry emerging as standard.

**LLM-as-judge evaluation**: Automated quality assessment using secondary model.
Measures relevance, accuracy, coherence. Enables continuous monitoring without human
review for every interaction.

**LangSmith**: Tailor-made for LangChain ecosystem. Step-through debugging,
prompt/template visibility, token consumption tracking.

**Arize Phoenix**: Vendor-agnostic, open-source. "Council of judges" approach combining
multiple AI models with human-in-the-loop.

## Architecture

### Memory Layer

Three memory types, stored in existing Postgres infrastructure:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MEMORY LAYER                                   │
│                                                                         │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│   │  RUN MEMORY      │  │  SESSION MEMORY  │  │  PATTERN MEMORY  │    │
│   │  (last run)      │  │  (conversation)  │  │  (long-term)     │    │
│   │                  │  │                  │  │                  │    │
│   │  What happened   │  │  Key decisions   │  │  Successful      │    │
│   │  Errors hit      │  │  Context built   │  │  patterns        │    │
│   │  Approaches      │  │  Files touched   │  │  Failure modes   │    │
│   │  tried           │  │  State changes   │  │  User prefs      │    │
│   │                  │  │                  │  │                  │    │
│   │  TTL: 24 hours   │  │  TTL: session    │  │  TTL: permanent  │    │
│   └──────────────────┘  └──────────────────┘  └──────────────────┘    │
│                                                                         │
│   Storage: Postgres JSONB (run/session) + pgvector (pattern)           │
└─────────────────────────────────────────────────────────────────────────┘
```

**Run Memory**: Injected into next agent of same type. "Last time we tried X, it failed
because Y." Expires after 24 hours.

**Session Memory**: Key decisions and context within a conversation. Survives
compaction. Different from worktree state hooks—this is agent-specific context.

**Pattern Memory**: Long-term learned patterns. Vectorized for semantic search. "When
user asks about X, they usually mean Y." Permanent storage.

### Error Recovery Layer

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ERROR RECOVERY LAYER                              │
│                                                                         │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│   │  CLASSIFIER      │  │  RETRY ENGINE    │  │  CIRCUIT BREAKER │    │
│   │                  │  │                  │  │                  │    │
│   │  Transient:      │  │  Backoff with    │  │  Failure         │    │
│   │  - Network       │  │  jitter          │  │  threshold: 5    │    │
│   │  - Rate limit    │  │                  │  │                  │    │
│   │  - Timeout       │  │  Max retries: 3  │  │  Recovery: 30s   │    │
│   │                  │  │                  │  │                  │    │
│   │  Permanent:      │  │  Base delay: 1s  │  │  Half-open       │    │
│   │  - Auth          │  │  Max delay: 30s  │  │  after recovery  │    │
│   │  - Permissions   │  │                  │  │                  │    │
│   │  - Invalid input │  │  Preserve        │  │  Fast-fail when  │    │
│   │                  │  │  context         │  │  tripped         │    │
│   └──────────────────┘  └──────────────────┘  └──────────────────┘    │
│                                                                         │
│   Different from microservice patterns: agents maintain context         │
│   across retries. Retry with same context, not fresh start.            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Observability Layer

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        OBSERVABILITY LAYER                               │
│                                                                         │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│   │  TRACE CAPTURE   │  │  EVALUATION      │  │  DASHBOARD       │    │
│   │                  │  │                  │  │                  │    │
│   │  Run ID          │  │  LLM-as-judge    │  │  Run history     │    │
│   │  Agent type      │  │  for quality     │  │  Success rates   │    │
│   │  Input summary   │  │                  │  │  Common errors   │    │
│   │  Tool calls      │  │  Rubrics:        │  │  Duration trends │    │
│   │  Duration        │  │  - Task complete │  │                  │    │
│   │  Token usage     │  │  - Quality met   │  │  Filter by:      │    │
│   │  Output summary  │  │  - No errors     │  │  - Agent type    │    │
│   │  Error (if any)  │  │                  │  │  - Status        │    │
│   │                  │  │  Score: 0-100    │  │  - Date range    │    │
│   │  OpenTelemetry   │  │                  │  │                  │    │
│   │  compatible      │  │  Run async,      │  │  Alerts for      │    │
│   │                  │  │  don't block     │  │  degradation     │    │
│   └──────────────────┘  └──────────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Self-Improvement Layer

Inspired by
[claude-flow's training hooks](https://github.com/ruvnet/claude-flow/issues/419):

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      SELF-IMPROVEMENT LAYER                              │
│                                                                         │
│   PRE-OPERATION HOOKS              POST-OPERATION HOOKS                 │
│   ┌──────────────────┐             ┌──────────────────┐                │
│   │  Predict         │             │  Capture outcome │                │
│   │  complexity      │             │  Compare to      │                │
│   │                  │             │  prediction      │                │
│   │  Suggest optimal │             │                  │                │
│   │  approach based  │             │  Extract pattern │                │
│   │  on patterns     │             │  if successful   │                │
│   │                  │             │                  │                │
│   │  Load relevant   │             │  Record failure  │                │
│   │  context from    │             │  mode if failed  │                │
│   │  pattern memory  │             │                  │                │
│   └────────┬─────────┘             └────────┬─────────┘                │
│            │                                │                          │
│            └───────────┬────────────────────┘                          │
│                        │                                               │
│                        ▼                                               │
│             ┌──────────────────┐                                       │
│             │  PATTERN LEARNER │                                       │
│             │                  │                                       │
│             │  Aggregate       │                                       │
│             │  patterns from   │                                       │
│             │  session         │                                       │
│             │                  │                                       │
│             │  Update prompts  │                                       │
│             │  if pattern is   │                                       │
│             │  strong enough   │                                       │
│             │  (threshold:     │                                       │
│             │   5 occurrences) │                                       │
│             │                  │                                       │
│             │  Human approval  │                                       │
│             │  for prompt      │                                       │
│             │  changes         │                                       │
│             └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Observability Foundation (Week 1-2)

Add tracing to every agent run. This is prerequisite for everything else—we can't
improve what we can't measure.

**Schema**:

```sql
CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  agent_type TEXT NOT NULL,  -- 'browser-verifier', 'empathy-reviewer', etc.
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL,  -- 'running', 'completed', 'failed', 'timeout'
  input_summary TEXT,
  output_summary TEXT,
  error_message TEXT,
  error_type TEXT,  -- 'transient', 'permanent', 'unknown'
  tool_calls JSONB,  -- [{tool, params, duration, success}]
  token_usage JSONB,  -- {input_tokens, output_tokens, model}
  duration_ms INTEGER,
  quality_score INTEGER,  -- 0-100 from LLM-as-judge
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_runs_type ON agent_runs(agent_type);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);
CREATE INDEX idx_agent_runs_conversation ON agent_runs(conversation_id);
```

**Hook integration**: Modify existing `.claude/hooks/` to capture run data:

```python
# .claude/hooks/capture-agent-run.py
# PreToolUse: Record start of agent run
# PostToolUse: Record completion/failure with metrics
```

### Phase 2: Run Memory (Week 3-4)

Give each agent type access to its last run's context.

**Schema**:

```sql
CREATE TABLE agent_run_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL,
  user_id UUID,  -- NULL for global patterns
  memory_type TEXT NOT NULL,  -- 'last_run', 'session', 'pattern'
  content JSONB NOT NULL,
  embedding vector(1536),  -- for pattern memory only
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_memory_lookup ON agent_run_memory(agent_type, memory_type);
CREATE INDEX idx_agent_memory_embedding ON agent_run_memory USING ivfflat (embedding vector_cosine_ops);
```

**Injection pattern**: Add to agent system prompts:

```markdown
## Context from Previous Run

Last run (24 hours ago): Attempted to verify checkout flow. Failed because Stripe test
mode wasn't enabled. Suggested fix: Enable test mode in .env.local.

Use this context to avoid repeating the same issues.
```

### Phase 3: Error Recovery Infrastructure (Week 5-6)

Add retry logic with failure classification.

**Error classifier** (integrate with existing error handling):

```typescript
type ErrorType = "transient" | "permanent" | "unknown";

function classifyError(error: Error): ErrorType {
  // Network/timeout errors
  if (
    error.message.includes("ETIMEDOUT") ||
    error.message.includes("ECONNREFUSED") ||
    error.message.includes("fetch failed")
  ) {
    return "transient";
  }

  // Rate limits
  if (error.message.includes("rate_limit") || error.message.includes("429")) {
    return "transient";
  }

  // Auth/permission errors
  if (
    error.message.includes("401") ||
    error.message.includes("403") ||
    error.message.includes("unauthorized")
  ) {
    return "permanent";
  }

  return "unknown";
}
```

**Retry with backoff** (preserve agent context):

```typescript
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  context: AgentContext,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000 } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const errorType = classifyError(error);

      // Don't retry permanent errors
      if (errorType === "permanent") {
        throw error;
      }

      // Last attempt failed
      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
      await sleep(delay);

      // Log retry for observability
      await logRetry(context, attempt, error, delay);
    }
  }
}
```

### Phase 4: Self-Improvement (Week 7-8)

Add pattern learning and prompt evolution.

**Pattern extraction** (run at session end):

```typescript
async function extractPatterns(sessionId: string): Promise<Pattern[]> {
  const runs = await getSessionRuns(sessionId);

  const patterns: Pattern[] = [];

  // Find repeated successes
  const successfulApproaches = runs
    .filter((r) => r.status === "completed" && r.quality_score > 80)
    .groupBy((r) => r.agent_type);

  for (const [agentType, runs] of Object.entries(successfulApproaches)) {
    if (runs.length >= 3) {
      patterns.push({
        type: "success_pattern",
        agent_type: agentType,
        description: await summarizeApproach(runs),
        confidence: runs.length / 10, // More occurrences = higher confidence
      });
    }
  }

  // Find repeated failures
  const failures = runs
    .filter((r) => r.status === "failed")
    .groupBy((r) => r.error_type);

  for (const [errorType, runs] of Object.entries(failures)) {
    if (runs.length >= 2) {
      patterns.push({
        type: "failure_pattern",
        error_type: errorType,
        description: await summarizeFailures(runs),
        suggested_prevention: await suggestPrevention(runs),
      });
    }
  }

  return patterns;
}
```

**Prompt evolution** (human-approved):

```typescript
async function proposePromptUpdate(
  agentType: string,
  patterns: Pattern[]
): Promise<PromptUpdate | null> {
  const strongPatterns = patterns.filter((p) => p.confidence > 0.7);

  if (strongPatterns.length === 0) return null;

  const currentPrompt = await getAgentPrompt(agentType);
  const proposedUpdate = await generatePromptUpdate(currentPrompt, strongPatterns);

  // Store for human review, don't auto-apply
  return {
    agent_type: agentType,
    current_prompt_hash: hash(currentPrompt),
    proposed_changes: proposedUpdate,
    supporting_patterns: strongPatterns,
    requires_approval: true,
  };
}
```

## Integration with Existing Architecture

### Hook System

Extend existing `.claude/hooks/` with new lifecycle hooks:

| Hook                   | Trigger            | Purpose                             |
| ---------------------- | ------------------ | ----------------------------------- |
| `capture-run-start.py` | PreToolUse (Task)  | Record run start, load memory       |
| `capture-run-end.py`   | PostToolUse (Task) | Record completion, extract patterns |
| `load-run-memory.py`   | SessionStart       | Inject last-run context             |

### Agent Definitions

Add memory and retry configuration to agent YAML:

```yaml
---
name: browser-verifier
description: ...
model: sonnet
memory:
  enabled: true
  types: [last_run, session]
retry:
  enabled: true
  max_attempts: 3
  backoff: exponential
observability:
  enabled: true
  evaluate: true # Run LLM-as-judge
---
```

### Claude Code Settings

Add observability hooks to `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "python .claude/hooks/capture-run-start.py"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "python .claude/hooks/capture-run-end.py"
          }
        ]
      }
    ]
  }
}
```

## Success Metrics

### Robustness

- **Retry success rate**: % of transient failures recovered via retry
- **Mean time to recovery**: Average delay before successful retry
- **False positive rate**: % of permanent errors incorrectly retried

### Observability

- **Trace coverage**: % of agent runs with complete traces
- **Dashboard adoption**: Time spent in agent dashboard
- **Debugging time**: Time from error report to root cause

### Self-Improvement

- **Pattern accuracy**: % of learned patterns that improve outcomes
- **Prompt update acceptance**: % of proposed updates approved by human
- **Quality score trend**: Movement in LLM-as-judge scores over time

### Memory

- **Context reuse rate**: % of runs that use memory from previous runs
- **Repeat error reduction**: % decrease in same errors across runs
- **Token efficiency**: Reduction in tokens via semantic deduplication

## Open Questions

### Memory Granularity

**Per-user vs. global patterns?** User-specific patterns are more relevant but require
more storage. Global patterns help new users. Start with per-user, add global later.

**How long to retain patterns?** Permanent storage grows unbounded. Options: rolling
window (keep last N), decay (reduce confidence over time), manual cleanup. Start with
90-day retention, evaluate.

### Self-Improvement Safety

**Auto-apply prompt updates?** Research shows
[claude-flow](https://github.com/ruvnet/claude-flow/issues/419) auto-applies with
thresholds. Safer: require human approval for all prompt changes. Start conservative.

**What if learned patterns are wrong?** Need rollback mechanism. Version prompt changes,
track quality scores, auto-revert if scores drop.

### Observability Scope

**Full traces vs. summaries?** Full traces consume storage but enable debugging.
Summaries are cheaper but lose detail. Start with full traces, add compression later.

**Who sees agent dashboards?** Just developers? All users? Start with developer-only,
add user-facing visibility for their own agents.

## References

### Industry Research

- [Agent Memory Comparison](https://dev.to/foxgem/ai-agent-memory-a-comparative-analysis-of-langgraph-crewai-and-autogen-31dp)
- [CrewAI Memory Deep Dive](https://sparkco.ai/blog/deep-dive-into-crewai-memory-systems)
- [Advanced Memory Persistence](https://sparkco.ai/blog/advanced-memory-persistence-strategies-in-ai-agents)
- [Retry Logic Best Practices](https://sparkco.ai/blog/mastering-retry-logic-agents-a-deep-dive-into-2025-best-practices)
- [Multi-Agent Failure Recovery](https://galileo.ai/blog/multi-agent-ai-system-failure-recovery)
- [12 Failure Patterns](https://www.concentrix.com/insights/blog/12-failure-patterns-of-agentic-ai-systems/)
- [Self-Evolving Agents Survey](https://arxiv.org/abs/2508.07407)
- [OpenAI Self-Evolving Cookbook](https://cookbook.openai.com/examples/partners/self_evolving_agents/autonomous_agent_retraining)
- [LLM Observability Tools 2025](https://www.getmaxim.ai/articles/the-best-ai-observability-tools-in-2025-maxim-ai-langsmith-arize-helicone-and-comet-opik/)

### Implementation Examples

- [claude-flow Training Hooks](https://github.com/ruvnet/claude-flow/issues/419) -
  Comprehensive self-improving workflow with Claude Code hooks
- [EvoAgentX](https://evoagentx.github.io/EvoAgentX/index.html) - Self-evolving agent
  ecosystem

### Carmenta Context

- [AI Team Architecture](ai-team/spec.md) - Execution infrastructure
- [DCOS Architecture](dcos-architecture.md) - Supervisor pattern
- [Agent Orchestration](agent-orchestration.md) - Multi-agent coordination
