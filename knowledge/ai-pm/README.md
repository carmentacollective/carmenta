# Autonomous AI Product Manager

Carmenta building herself. A closed-loop system where AI processes feedback, creates
issues, implements changes, and submits PRs—with human approval as the single control
point.

## Why This Exists

Building the best AI interface in the world requires development velocity that human
teams cannot match. The only way to achieve this as a small team is to have AI doing the
building.

This is not automation for its own sake. It is leverage that matches the ambition.

## The Core Loop

```
Users (real + simulated) → AI PM → GitHub Issues → AI Engineer → PRs → Human Approval → Deploy
     ↑                                                                                    │
     └────────────────────────────────────────────────────────────────────────────────────┘
```

Every signal flows through the same system. User feedback, simulated user testing, bug
reports, analytics anomalies—all are processed by the AI PM, which decides what action
to take: update knowledge, create an issue, or flag for human decision.

GitHub is the coordination layer. Issues are contracts between PM and Engineering. PRs
are contracts between Engineering and Approval. Everything is auditable.

The human touchpoint is PR approval. This is the choke point by design. No auto-merging
to main. Every change requires explicit human consent before reaching production.

## The 2027 Vision

By 2027, this system should be mature enough that:

**The product improves while we sleep.** Simulated users exercise Carmenta continuously.
The AI PM processes feedback overnight. The AI Engineer implements fixes and
improvements. We wake up to PRs ready for review.

**Real users never wait for fixes.** When a real user reports friction, the system
replicates the issue with a simulated user, implements a fix, validates it works, and
creates a PR—often before the user's conversation ends.

**The knowledge base is always true.** Every learning gets captured. Every decision is
documented. Every competitive move is analyzed. The specification stays synchronized
with reality because the same system that builds also maintains understanding.

**Humans focus on what humans do best.** Taste. Judgment. Novel insight. Relationship.
The system handles implementation, testing, documentation, and routine maintenance. We
handle vision, strategy, and the moments that require human wisdom.

**The system knows its boundaries.** It has learned when to ask and when to proceed.
Vision changes always surface for human decision. Bug fixes proceed autonomously after
validation. The autonomy is earned through demonstrated reliability.

## What Makes This Different

Most AI development tools assist humans. This system replaces the need for a human
development team while preserving human judgment at the critical point.

The key insight: PRs are already the place where humans review and approve changes. By
making PRs the only human touchpoint, we preserve the existing approval workflow while
automating everything upstream.

The simulated users are the force multiplier. Real user feedback is precious but sparse.
Simulated users can exercise the product continuously, finding friction that real users
would encounter but might not report.

## System Components

The system has five primary actors:

1. **Real Users** — Humans using Carmenta, providing genuine feedback
2. **Simulated AI Users** — AI personas exercising Carmenta continuously
3. **AI Product Manager** — Processes signals, maintains knowledge, creates issues
4. **AI Engineer** — Implements changes, creates PRs
5. **Human (Nick)** — Final approval, strategic direction

Each actor has a defined role, tools, and boundaries. See [actors.md](./actors.md) for
detailed specifications.

## Related Knowledge

This system builds on existing Carmenta specifications:

- [ai-first-development.md](../ai-first-development.md) — The paradigm this implements
- [product-intelligence.md](../components/product-intelligence.md) — AI PM signal
  processing
- [agent-testing.md](../components/agent-testing.md) — Synthetic user design
- [concierge-improvement-loop.md](../components/concierge-improvement-loop.md) — Quality
  feedback
- [optimal-development-workflow.md](../optimal-development-workflow.md) — /autotask
  pattern

## Implementation Status

This system is in early design. See [milestones.md](./milestones.md) for the
implementation plan and [open-questions.md](./open-questions.md) for unresolved design
decisions.

## Contents

- [architecture.md](./architecture.md) — System design, data flows, mermaid diagrams
- [actors.md](./actors.md) — Detailed specification of each AI actor
- [execution-infrastructure.md](./execution-infrastructure.md) — Where the AI Engineer
  runs
- [milestones.md](./milestones.md) — Implementation sequence
- [open-questions.md](./open-questions.md) — Gaps and unknowns to resolve
