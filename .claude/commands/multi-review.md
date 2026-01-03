---
description: Multi-agent code review with diverse perspectives
argument-hint: [count]
---

# Multi-Agent Code Review

<objective>
Run N parallel code review agents with diverse perspectives. Each agent operates in
isolation, catching issues that others miss. Synthesize their findings into a unified
report.

Usage: `/multi-review [count]` where count defaults to 3. </objective>

<why-multiple-agents>
Single reviewers have blind spots. A security expert notices auth issues but misses
performance problems. A performance reviewer catches N+1 queries but overlooks error
handling gaps. Multiple perspectives operating independently surface more issues than
any single comprehensive review.
</why-multiple-agents>

<agent-discovery>
Discover available review agents by examining the Task tool's agent types and any
project-specific agents in .claude/agents/. Look for agents with "review" or "audit" in
their name or description.

Categorize discovered agents by their focus area (correctness, security, performance,
architecture, quality, UX, observability, etc.). Select N agents ensuring diversity
across categories—don't pick multiple agents from the same domain.

When the code has characteristics that no discovered agent covers well, create a dynamic
agent using general-purpose with a focused prompt. </agent-discovery>

<execution>
Identify the code to review from context (branch diff, PR changes, staged changes, or
recent modifications). Analyze what domains the code touches. Select N agents ensuring
diversity across domains. Launch all agents in parallel using multiple Task tool calls
in a single message. Synthesize results: deduplicate, group by severity, note which
agent caught each issue.
</execution>

<dynamic-agents>
When code requires domain expertise no existing agent provides, create a focused
reviewer. Use subagent_type="general-purpose" with a prompt specifying the domain and
key concerns. Keep prompts goal-focused—state what to review for, not how to review.

Temporal workflows: determinism, activity configuration, versioning, compensation
patterns GraphQL: N+1 resolvers, field authorization, null safety, schema design
Database migrations: backwards compatibility, rollback safety, lock duration, data loss
Rate limiting: bypass vulnerabilities, key design, distributed consistency
</dynamic-agents>

<quality-bar>
Every review surfaces actionable insights. If all agents return no issues, note this
explicitly—either the code is solid or agents need more context.

Report only high-confidence issues. Preserve each agent's unique lens rather than
homogenizing into generic feedback. </quality-bar>
