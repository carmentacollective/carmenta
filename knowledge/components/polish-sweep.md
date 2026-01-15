# Polish Sweep

Automated detection of user-facing quality issues - the "last 15%" that separates good
from polished. Multi-agent code analysis focused on what users feel, not what linters
complain about.

## Why This Exists

Apps feel 85% complete but something's off. Users can't articulate it, but they feel it:
inconsistent hover states, missing loading indicators, tooltips that behave differently
in different places, error messages that dead-end. These aren't bugs - they're polish
deficits that accumulate into an unfinished feeling.

Traditional tools don't help:

- **Linters** catch syntax and style, not user experience
- **Type checkers** catch type errors, not inconsistent patterns
- **Test coverage** measures execution paths, not perceived quality

Polish Sweep catches the things that make users trust (or distrust) an application.

## Philosophy

### What We Detect

Issues that affect **user-perceived quality**:

- Pattern inconsistency (different solutions to the same UX problem)
- Missing states (loading, error, empty states)
- Incomplete micro-interactions (haptics, animations, feedback)
- Dead-end user paths (errors without recovery)
- Broken continuity (state that doesn't persist as expected)

### What We Explicitly Ignore

- Dead code (ship what you use, but that's not polish)
- Magic numbers (code hygiene, not UX)
- Accessibility/ARIA (separate concern with different tooling)
- Generic linting rules (covered by ESLint)
- Type coverage (covered by TypeScript)
- Test coverage (covered by Vitest)

### Severity Philosophy

Not all issues are equal. We score by **user impact**:

| Impact     | Description                                          | Examples                                |
| ---------- | ---------------------------------------------------- | --------------------------------------- |
| **High**   | User notices immediately, affects task completion    | Missing loading state, error dead-ends  |
| **Medium** | User might notice, affects perceived quality         | Inconsistent patterns, missing feedback |
| **Low**    | User unlikely to notice, affects developer intuition | Style variance, naming inconsistency    |

## Architecture

### Multi-Agent Design

One command spawns 4 specialized agents in parallel. Each agent has domain expertise and
returns findings in a consistent format.

```
┌─────────────────────────────────────────────────────────────────────┐
│  /polish-sweep                                                      │
│                                                                     │
│  ┌─────────────────┬─────────────────┬─────────────┬────────────────────┐
│  │  ux-clarity     │ ux-consistency  │  recovery   │ code-consistency   │
│  │   -reviewer     │    -reviewer    │  -reviewer  │     -reviewer      │
│  └─────────────────┴─────────────────┴─────────────┴────────────────────┘
│                                                                     │
│  Aggregator: Deduplicates, scores, prioritizes, groups by file      │
└─────────────────────────────────────────────────────────────────────┘
```

### Why Multiple Agents

1. **Parallel execution** - 4 agents finish faster than 1 doing everything
2. **Domain focus** - Each agent has specific expertise and prompting
3. **Model efficiency** - Smaller, focused contexts produce better results
4. **Maintainability** - Add/remove/modify agents independently
5. **UX vs Code separation** - 3 UX-focused agents, 1 code-focused agent

### Agent Responsibilities

| Agent                         | Model  | Focus                                             | Tools            |
| ----------------------------- | ------ | ------------------------------------------------- | ---------------- |
| **ux-clarity-reviewer**       | Sonnet | Missing feedback (loading, success, error, empty) | Read, Grep, Glob |
| **ux-consistency-reviewer**   | Sonnet | Behavioral inconsistency (tooltips, animations)   | Read, Grep, Glob |
| **recovery-reviewer**         | Sonnet | Dead-end error paths, missing retry options       | Read, Grep, Glob |
| **code-consistency-reviewer** | Sonnet | Code pattern variance (props, conventions)        | Read, Grep, Glob |

All agents are **read-only** - they analyze and report, never modify.

## Agent Specifications

Full agent definitions live in `.claude/agents/`. Summary of each:

### 1. UX Clarity Reviewer

**Question:** "Does the user KNOW what's happening?"

Finds moments where users are left wondering. Missing loading states, absent success
feedback, swallowed errors, empty states without guidance.

Research-backed timing standards: <100ms needs no feedback, 400ms-1s needs loading
indicator, >3s needs progress context.

See: `.claude/agents/ux-clarity-reviewer.md`

### 2. UX Consistency Reviewer

**Question:** "Does the same action FEEL the same everywhere?"

Finds behavioral inconsistencies that make apps feel unfinished. Tooltip timing
variance, animation differences, feedback pattern mismatches.

Research-backed standards: 300-500ms tooltip delay, 5-8s toast duration, duration tokens
for transitions.

See: `.claude/agents/ux-consistency-reviewer.md`

### 3. Recovery Reviewer

**Question:** "When things fail, can users MOVE FORWARD?"

Finds dead-end error paths. Errors without retry, failures that lose data, cryptic
messages, missing escape hatches.

3-part error message standard: What went wrong, why it happened, how to fix it.

See: `.claude/agents/recovery-reviewer.md`

### 4. Code Consistency Reviewer

**Question:** "Are we solving the same PROBLEM the same WAY in code?"

Finds implementation variance that creates developer friction and often leaks into UX
problems. Prop naming chaos, boolean convention mix, import pattern variance.

Research-backed naming: `is*` for state, `has*` for possession, `can*` for capability,
`on*` for prop handlers, `handle*` for implementations.

See: `.claude/agents/code-consistency-reviewer.md`

## Output Format

### Aggregated Report

The command aggregates all agent findings into a prioritized report:

```markdown
# Polish Sweep Report

**Scanned:** 262 components, 45 pages **Found:** 23 issues (4 high, 12 medium, 7 low)
**Focus areas:** components/ui/, components/tools/, app/chat/

## High Priority (4)

### components/tools/code/file-writer.tsx

- **[resilience]** Line 67: Async file operation has no error handling
- **[states]** Line 34: Component shows no loading during file write

### components/chat/simple-composer.tsx

- **[resilience]** Line 145: Submit can fail silently - no error feedback
- **[states]** Line 89: No disabled state during submission

## Medium Priority (12)

### components/ui/oracle-menu.tsx

- **[consistency]** Line 45: Uses legacy `data-tooltip-*` instead of Radix Tooltip
- **[consistency]** Line 78: Uses `data-tooltip-*` instead of Radix Tooltip

...

## Patterns Summary

| Pattern             | Occurrences | Files Affected |
| ------------------- | ----------- | -------------- |
| legacy-tooltip      | 8           | 6              |
| missing-loading     | 5           | 4              |
| unhandled-error     | 4           | 3              |
| inconsistent-naming | 3           | 2              |
| missing-haptic      | 3           | 3              |
```

## Implementation

### Command: `/polish-sweep`

```yaml
---
description: Scan codebase for user-facing polish issues - the "last 15%"
argument-hint: "[scope: all | components | app | path/to/dir]"
version: 1.0.0
model: inherit
---
```

**Workflow:**

1. Parse scope argument (default: `components/` and `app/`)
2. Spawn 4 agents in parallel with scope
3. Collect findings from all agents
4. Deduplicate (same file+line from multiple agents)
5. Score and sort by severity
6. Group by file for actionability
7. Output formatted report

### Agent Definition Template

Each agent follows the same structure:

```yaml
---
name: consistency-scanner
description: Detects pattern inconsistencies across codebase
version: 1.0.0
model: sonnet
tools: Read, Grep, Glob
---
```

### Scope Control

Users can focus the sweep:

```bash
/polish-sweep                     # Full sweep (components + app)
/polish-sweep components          # Just components directory
/polish-sweep app                 # Just app directory
/polish-sweep components/tools    # Specific subdirectory
```

## Current Codebase Issues (From Analysis)

Based on exploration of Carmenta's codebase, these issues exist today:

### High Priority

1. **Dual tooltip systems** - Legacy `data-tooltip-*` in oracle-menu, oracle-whisper,
   gif-card vs Radix `<Tooltip>` in newer components
2. **Inconsistent async state** - Mix of `isLoading` boolean, `status` enum, and
   `ButtonState` type across components
3. **Missing error props** - SimpleComposer accepts `isLoading` but no `error` prop

### Medium Priority

4. **Prop naming chaos** - `isLoading`, `isPushLoading`, `tokenLoading` in same file
5. **Boolean convention mix** - `can*` vs `is*` vs past-tense (`downloaded`, `copied`)
6. **AriaLabel variance** - `aria-label` attribute vs `ariaLabel` prop

### Low Priority

7. **Haptic hook returns** - Different shapes from useHapticFeedback
8. **Tool status display** - Some inline, some via ToolRenderer wrapper

## Gap Assessment

### Achievable Now

- All 4 agents with current Claude Code subagent architecture
- Grep/Glob/Read tools sufficient for pattern detection
- Parallel execution via Task tool
- JSON output for CI integration

### Emerging (6-12 months)

- **AST-based analysis**: More accurate pattern detection via TypeScript AST instead of
  regex. Tools like ts-morph or Semgrep could provide deeper analysis.
- **Auto-fix suggestions**: Generate actual code patches, not just descriptions
- **Historical tracking**: Track polish score over time, catch regressions

### Aspirational

- **Visual regression**: Detect UI inconsistencies from rendered output
- **User perception scoring**: ML model trained on user feedback about polish
- **Cross-repo patterns**: Learn patterns from best-in-class repos

## Integration Points

- **CI/CD**: Run on PR to catch regressions (`/polish-sweep --ci`)
- **Sentry**: Correlate with error rates (files with resilience issues)
- **Observability**: Track which issues get fixed vs ignored
- **Empathy Reviewer**: Deeper UX analysis for high-severity findings

## Success Criteria

- Developers run sweep before PRs to catch polish issues
- High-severity findings are always actionable
- False positive rate under 10%
- Sweep completes in under 60 seconds for full codebase
- Issues include clear fix guidance

## Open Questions

### Architecture

- **Incremental scanning**: Should we cache results and only re-scan changed files?
- **Custom patterns**: How do users add project-specific patterns to detect?

### Product Decisions

- **Severity thresholds**: What makes something high vs medium?
- **Fix automation**: Should we offer to auto-fix simple issues?

---

## Architecture Decisions

### ✅ Multi-agent over single agent

Rationale: Parallel execution, domain expertise, maintainability. Based on patterns from
Qodo (15+ agents) and community best practices.

### ✅ Read-only agents

Rationale: Analysis should never modify code. Fixes require human review.

### ✅ Sonnet for analysis, Haiku for pattern matching

Rationale: Analysis requires judgment (Sonnet). Pattern matching is mechanical (Haiku).

### ✅ Grep/Glob/Read tools only

Rationale: Pattern detection doesn't require code execution. Simpler = safer.

## Sources

- [Qodo AI](https://www.qodo.ai/) - 15+ specialized review agents pattern
- [VoltAgent awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) -
  100+ agent examples
- [Claude Code subagent docs](https://code.claude.com/docs/en/sub-agents) - Official
  patterns
- [State of AI Code Review 2025](https://www.devtoolsacademy.com/blog/state-of-ai-code-review-tools-2025/) -
  Industry landscape
- [DeepScan](https://deepscan.io/) - Data-flow analysis patterns
- [Semgrep](https://semgrep.dev/) - Custom pattern enforcement approach
