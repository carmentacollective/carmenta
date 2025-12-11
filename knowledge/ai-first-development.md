# AI-First Development

How products get built in the age of AI. The methodology Carmenta follows and enables.

## The Core Insight

Products are conversations, not artifacts.

A product is an ongoing dialogue between creators and users, continuously shaped by
signals, never finished. The specification is a living model of intent that evolves as
understanding deepens.

Code is derived. The specification is the source of truth. When understanding changes,
implementation follows.

## The Self-Improving Product Loop

```
Vision → Specification → Implementation → Usage → Signals
              ↑                                      ↓
              ←←←←←←←← AI Product Intelligence ←←←←←←
```

Traditional products iterate over months. User research, planning, development, launch,
feedback collection, analysis, more planning. The loop takes quarters.

AI-first products compress this loop to hours:

1. AI agents test the product continuously, generating usage signals
2. AI Product Manager synthesizes signals into proposed specification updates
3. AI implements approved changes
4. Loop repeats

The product improves while you sleep. Feedback flows directly into improvement.
Competitor capabilities are automatically analyzed. The structural advantage compounds.

## What the Specification Contains

The specification captures complete product understanding. An AI with no other context
could build and evolve the product from this alone.

Why this exists:

- The problem being solved
- Who experiences this problem
- What success looks like
- What this is explicitly not

How it behaves:

- Observable behaviors from a user's perspective
- Edge cases and error states
- What correct means, testably

What constraints apply:

- Security requirements
- Performance boundaries
- Integration contracts

What has been learned:

- Decisions made and their rationale
- Approaches tried and abandoned
- Assumptions that proved wrong

## The Dialogue Interface

Specification maintenance happens through dialogue. The AI:

Understands context. Reads and internalizes the full specification before responding.
Knows what exists, what has been tried, what constraints apply.

Clarifies before acting. When intent is ambiguous, asks. When a request conflicts with
existing spec, surfaces the conflict.

Proposes changes explicitly. Shows exactly what would change before making changes.

Seeks appropriate approval. Some changes require explicit approval. Others proceed with
notification. The boundary shifts based on observed patterns.

Executes completely. Once approved, updates the specification and triggers regeneration.

## Signal Processing

All external signals flow through the same dialogue interface:

| Signal            | Potential Specification Update             |
| ----------------- | ------------------------------------------ |
| Feature request   | New behaviors, modified boundaries         |
| Bug report        | Implementation fix or spec clarification   |
| User feedback     | Persona understanding, behavior priorities |
| Analytics         | Learnings, deprecation candidates          |
| Error logs        | Constraint adjustments, edge case coverage |
| Competitive intel | Boundaries, behavior gaps                  |
| Security advisory | Constraint updates, forced regeneration    |

The AI processes signals by proposing specification updates, following the same approval
flow as human-initiated changes.

## Approval Boundaries

The system learns when to ask and when to proceed.

Always ask:

- Changes to why the product exists
- New architectural boundaries
- Modifications to security or legal constraints
- Removal of existing behaviors

Ask once, then proceed on pattern:

- New behavior specs within existing boundaries
- Updates to persona understanding
- Integration with new external systems

Proceed, notify after:

- Implementation details that do not change behavior specs
- Bug fixes where implementation did not match existing spec

Proceed silently:

- Regeneration from unchanged specification
- Formatting and structural improvements to spec

These boundaries shift based on observed approval patterns. The system learns your
judgment over time.

## What Remains Human

Taste. Knowing what is worth building. The difference between a product that technically
works and one people love. AI generates variations. Someone chooses.

Accountability. When the system fails and there are consequences, someone owns the
decision to ship. AI optimizes. It cannot be responsible.

Novel insight. AI works from patterns in training data. When doing something genuinely
unprecedented, human creativity leads. AI accelerates execution of human insight.

Trust and relationships. People hire people. Your network, reputation, ability to
understand what someone really needs. This is durable.

## The Self-Building Layer

Two components enable self-improvement:

Product Intelligence: The AI product manager. Processes user feedback, analyzes
competitors, synthesizes insights into specification updates. Maintains the knowledge
base. Proposes improvements continuously.

Agent Testing: Synthetic users that exercise the product. Generate usage signals at
scale. Find edge cases humans miss. Run continuously, not just at release.

Together they create the flywheel: agents test, AI PM synthesizes, AI builds, agents
test again. The cycle that compresses months into hours.

## Building Autonomously

The `/build-next` command executes this methodology:

1. Read current roadmap and milestone status
2. Assess what exists (code, tests, deployment state)
3. Identify the next coherent unit of work
4. Propose the work (or proceed if within trust boundaries)
5. Implement, test, commit
6. Update specifications with what was learned
7. Report what was done

The AI decides what to build based on the roadmap, current state, and accumulated
learning. Human provides vision, boundaries, and approval for significant decisions.

## Trust and Decision-Making

AI autonomy requires calibrated judgment. The
[trust framework](../.cursor/rules/trust-and-decision-making.mdc) guides when to act,
research, or involve the human:

Knowledge source. Reasoning from code just read differs from parametric memory. Primary
sources beat training data for specifics.

Reversibility. Git revert is easy. Database migrations, published APIs, production
configs are not. Scope of impact shifts the calculus.

Verifiability. Types compile, tests pass, output visible. These let mistakes get caught.
Unverifiable claims need more caution.

Human domain. Voice, brand, design aesthetics, user empathy, business priorities,
ethical judgment. These are appropriately human territory, not AI limitations.

When working autonomously, decisions that would prompt questions become decisions that
get documented. Flag what was decided and why, so the human can review judgment calls
quickly.

## Evolving Strategies

Static prompts freeze agents at version one. Production agents need strategies,
memories, and instructions that update through execution feedback.

This is not fine-tuning with weights. This happens entirely in the memory and
instruction layers when agents are clearly instructed to record and learn from what they
did.

### How Strategies Evolve

Small structured increments that sharpen capabilities instead of overwriting them:

- After completing a task, agent proposes refinements to its approach
- Learnings stored as structured updates (not free-form notes)
- Instructions sharpen based on what worked and what didn't
- Agents learn from doing, not from human tinkering

### What Gets Updated

**Strategies**: Which approaches work for which scenarios. The agent accumulates
pattern-matched solutions.

**Heuristics**: Rules of thumb that improve over time. "When X happens, try Y first."

**Domain knowledge**: Accumulated understanding of the product, codebase, user patterns,
common edge cases.

**Error patterns**: What failed before and how to avoid it. Self-debugging improves as
the agent encounters and resolves issues.

### Constraints

Agents can update their:

- Own approach within defined scope
- Domain-specific knowledge
- Tactical decision-making
- Tool usage patterns

Agents cannot update:

- Core identity or values
- Security constraints
- Product boundaries or vision
- Integration contracts
- Approval boundaries

The system learns your judgment over time - what to ask about, what to proceed with, how
you prefer things done. This learning is scoped appropriately so agents don't drift into
areas requiring human judgment.

### Unlocked Capabilities

Self-improving agents enable:

- Agents that get better at their specific job over time
- Reduced need for prompt engineering as agents tune themselves
- Personalization that scales (agents learn your preferences through execution)
- Cumulative knowledge that persists across sessions

The agent working on task 100 is measurably better than the agent on task 1, without
changing the underlying model weights.

## The 2027 View

Products become organisms, not artifacts.

The team is:

- Human(s) with vision and taste
- AI PM processing all signals
- AI engineers implementing changes
- AI testers validating continuously

The specification is not a markdown file. It is a living model of intent, maintained by
the system, viewable as documents but not limited to them.

Human creative capacity to imagine what is worth building becomes the constraint. The
translation to running software is nearly instantaneous. The product converges toward
user needs automatically.

## Implementation in Carmenta

Carmenta is built this way. The `/knowledge` directory is the specification. Code is
generated from it. The specification is the IP.

Components that implement self-improvement:

- [Product Intelligence](./components/product-intelligence.md) - AI PM
- [Agent Testing](./components/agent-testing.md) - Synthetic users

The [roadmap](./roadmap.md) sequences milestones by usability coherence. Each milestone
answers who can use this now, not what features are done.

Carmenta is AI building itself. The methodology and the product are the same thing.
