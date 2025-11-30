# Concierge Improvement Loop

Watches every live query and response. Evaluates quality, detects patterns, drives
product improvement. The Concierge gets better through actual usage.

## What It Does

Per-interaction evaluation: After every interaction, assess whether we helped, what was
missing, quality signals from user follow-up behavior, and technical metrics like
latency and cost.

Pattern detection: Across all interactions, identify common failures, missing
capabilities, model performance issues, and prompt problems.

Improvement generation: Based on patterns, create prioritized recommendations, draft
specs, suggest prompt optimizations, and eventually implement fixes directly.

## Data Architecture

Observation schema:

```typescript
interface Observation {
  id: string;
  timestamp: Date;
  userId: string;
  query: string;
  queryComplexity: "trivial" | "simple" | "moderate" | "complex";
  attachments: string[];
  modelSelected: string;
  contextAssembled: string[];
  toolsAvailable: string[];
  toolsUsed: string[];
  latencyMs: number;
  tokenCount: { input: number; output: number };
  cost: number;
  qualityScore: number;
  qualityReasoning: string;
  gapsIdentified: string[];
  userFollowUp: "none" | "clarification" | "frustration" | "thanks" | "abandoned";
}
```

Pattern schema:

```typescript
interface Pattern {
  id: string;
  detectedAt: Date;
  type: "failure_pattern" | "missing_capability" | "model_issue" | "prompt_issue";
  description: string;
  frequency: number;
  severity: "low" | "medium" | "high" | "critical";
  exampleObservations: string[];
  suggestedAction: string;
  actionStatus: "identified" | "reviewed" | "in_progress" | "resolved";
}
```

## Storage

Errors go to Sentry. Observations go to database (Turso or Postgres). Patterns derived
from observations live in database. Note: Render disks are ephemeral, so file-based
storage does not work.

## Autonomy Levels

Level 1 Observe: Log observations to database. No action. Fully automatic.

Level 2 Detect: Aggregate observations into patterns. Surface via weekly digest. Human
reviews digest.

Level 3 Recommend: Propose specific solutions. Draft specs and prompt changes. Human
approves or rejects.

Level 4 Draft: Create branch with implementation. Open PR for review. Human reviews
code.

Level 5 Autonomous: Identify issue, implement fix, test, merge. Notify human but do not
block. Human can revert.

Start at Level 1-2. Graduate to higher levels as trust builds.

## Quality Assessment

Run post-interaction prompt asynchronously:

```
Given this interaction:
- User query: {query}
- Response: {response}
- Context provided: {context}
- Tools used: {tools}

Evaluate:
1. Did the response answer what was asked? (1-10)
2. Was the response accurate? (1-10)
3. Was the format appropriate? (1-10)
4. What was missing or could be improved?
5. What capabilities would have helped?

Output JSON with scores and reasoning.
```

This runs async and does not block the user response.

## Implementation Phases

Phase 1: Define observation schema, create database tables, instrument response pipeline
to log observations, build quality assessment prompt.

Phase 2: Scheduled job to analyze observations, pattern extraction logic, storage for
detected patterns, weekly digest generation.

Phase 3: AI prompt to suggest improvements based on patterns, spec generation,
integration with issue tracking.

Phase 4: PR creation capability, automated testing, human approval workflow, merge and
deploy automation.

## Privacy Considerations

Observations include query content which creates PII risk. Options: hash/anonymize
queries after pattern extraction, retention limits, user opt-out, aggregate-only
storage.

## Open Questions

Quality assessment accuracy: How good is AI at evaluating AI responses? Need human
validation sample to calibrate.

Storage costs: How much data per interaction? What retention policy? Aggregation vs raw
storage?

Autonomy boundaries: What changes are safe for autonomous action? How to define low
risk? What rollback strategy?

Cross-user privacy: Pattern detection needs all users. How to aggregate without exposing
individual data? GDPR implications?

## Related Components

Carmenta Presence: The improvement loop drives Carmenta's evolution. Concierge:
Evaluates and improves concierge decisions. Observability: Extends existing monitoring.
Data Storage: Where observations live.

## Success Criteria

100% of interactions logged. Quality assessment runs on all responses. Latency impact
under 100ms (async).

Meaningful patterns surfaced within 1 week of emergence. False positive rate under 20%.
Patterns correlate with actual user pain points.

Time from pattern detection to fix decreases over time. Product quality metrics improve
measurably.
