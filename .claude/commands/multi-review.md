---
# prettier-ignore
description: Multi-agent code review with diverse perspectives - run multiple specialized reviewers in parallel for comprehensive analysis
argument-hint: [count]
version: 2.0.0
model: inherit
---

# Multi-Agent Code Review

<objective>
Run N parallel code review agents to improve code quality. Each agent operates with a
unique lens—security, UX, correctness, etc. Synthesize findings into actionable
improvements, then implement the valuable ones.

The goal is great code, not a list of theoretical concerns. Reviews should make the code
better, not document what could go wrong.

Usage: `/multi-review [count]` where count defaults to 3. </objective>

<philosophy>
Code review exists to improve code. Not to find blockers. Not to cover our asses. Not to
generate a report we can defer.

Good reviews surface insights that make code:

- More robust for real users
- Clearer to read and maintain
- Safer in actual production scenarios
- More delightful in user-facing moments

Bad reviews flag theoretical edge cases, demand premature optimization, or add
complexity without proportional benefit. We don't do those. </philosophy>

<review-standards>
Every agent prompt MUST include these standards from `.cursor/rules/code-review-standards.mdc`:

**When suggestions don't apply:**

- Single-use values flagged as "magic strings" - extraction adds indirection without DRY
  benefit
- Theoretical race conditions - wrong when operations are serialized by queue/mutex/tx
- Redundant type safety - wrong when runtime validation already handles the case
- Premature optimization - wrong without profiling data showing actual problems

**Case-by-case judgment:**

- Test coverage gaps - address if edge case could cause user-facing issues
- Documentation requests - address if genuinely unclear, not restating obvious code
- Accessibility - check project stance first

Agents should apply these standards, not blindly flag everything they notice.
</review-standards>

<why-multiple-agents>
Single reviewers have blind spots. A security expert catches auth issues but misses UX
problems. A performance reviewer notices N+1 queries but overlooks copy quality. Multiple
perspectives operating independently surface insights no single reviewer would find.

But more agents isn't always better. Match agent count to code complexity. Simple
changes need 2-3 agents. Complex architectural changes might warrant 4-5.
</why-multiple-agents>

<agent-selection>
Discover available review agents from:

- Task tool's agent types (empathy-reviewer, robustness-reviewer, etc.)
- Project agents in `.claude/agents/`
- Plugin agents (ai-coding-config:\*, etc.)

Select agents based on what the code touches:

| Code Type             | Agent Types                            |
| --------------------- | -------------------------------------- |
| UI/UX changes         | empathy-reviewer, ux-designer          |
| API/backend           | robustness-reviewer, security-reviewer |
| Data/state changes    | logic-reviewer, test-analyzer          |
| Copy/language changes | empathy-reviewer, carmenta-copy skill  |
| Architecture changes  | architecture-auditor, code-reviewer    |
| Performance-sensitive | performance-reviewer                   |

Ensure diversity—don't pick multiple agents from the same domain. </agent-selection>

<agent-prompting>
Every agent prompt must include:

1. **The diff or code to review** - full context, not summaries
2. **What the change is trying to accomplish** - intent matters for judgment
3. **The review standards** - so agents filter their own suggestions intelligently
4. **What to look for** - domain-specific concerns for that agent's lens

Example prompt structure:

```
Review this change for [domain concerns].

**Intent:** [What the change accomplishes]

**Review Standards:**
- Don't flag single-use values as magic strings
- Don't flag theoretical race conditions without evidence
- Don't suggest premature optimizations
- Focus on issues that affect real users or maintainability

**What to look for:**
- [Domain-specific concerns]

**Diff:**
[Full diff]
```

Agents should return:

- Issues worth addressing (with severity and specific fix)
- Why each issue matters (user impact, maintenance cost, etc.)
- Explicit "no issues found" if the code is solid </agent-prompting>

<execution-flow>
1. **Identify code to review** - branch diff, PR changes, staged changes, or recent
   modifications
2. **Analyze domains touched** - UI? API? State? Copy? Security boundaries?
3. **Select N diverse agents** - match to domains, ensure coverage without overlap
4. **Launch all agents in parallel** - multiple Task tool calls in single message
5. **Synthesize results** - deduplicate, group by value (not just severity)
6. **Implement improvements** - don't just report, actually make the code better
</execution-flow>

<synthesis>
When synthesizing agent results:

**Group by actionability, not severity:**

- "Implement now" - clear improvements, low risk, high value
- "Consider" - judgment calls, tradeoffs involved
- "Skip" - theoretical concerns, premature optimization, complexity without benefit

**Note agreement:** When multiple agents flag the same issue independently, that's a
strong signal. When only one agent flags something, evaluate whether their unique lens
revealed something others missed or whether it's domain-specific noise.

**Preserve unique insights:** Don't homogenize feedback into generic "best practices."
Each agent's lens matters—a UX reviewer's concern about copy tone is different from a
security reviewer's concern about input validation. </synthesis>

<after-review>
The review isn't done when you have findings. The review is done when the code is better.

For each "implement now" item:

1. Make the change
2. Verify it improves the code (doesn't just satisfy the review)
3. If the fix introduces new complexity, reconsider whether the issue was worth
   addressing

For "consider" items, present them to the user with context and let them decide.

For "skip" items, don't even mention them unless the user asks for the full report.
</after-review>

<dynamic-agents>
When code requires expertise no existing agent provides, create a focused reviewer using
`subagent_type="general-purpose"` with a domain-specific prompt.

Common dynamic agent domains:

- Temporal workflows: determinism, activity config, versioning, compensation
- GraphQL: N+1 resolvers, field auth, null safety, schema design
- Database migrations: backwards compat, rollback safety, lock duration
- Rate limiting: bypass vulnerabilities, key design, distributed consistency
- OAuth/auth flows: token handling, state management, redirect security
  </dynamic-agents>
