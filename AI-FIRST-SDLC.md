# AI-First SDLC

A methodology for building products in the age of AI.

## The Shift

Code is becoming ephemeral. The specification is becoming the source of truth.

Traditional SDLC: Write code, then document it, then test it.

AI-first SDLC: Write the specification, generate the code, regenerate when specs change.

The specification - the complete product understanding - is the artifact you maintain.
Code is generated, disposable, regenerable. If requirements change, you don't refactor;
you update the spec and regenerate.

The specification is the IP. Code can always be regenerated.

## Core Principles

**The specification is the product.** Implementation is a derived artifact. When the
spec changes, implementation follows. When implementation drifts from spec,
implementation is wrong.

**One process for all change.** Creating a new feature and processing a bug report are
the same operation: updating the specification, then regenerating what's affected. There
is no separate "maintenance mode." The process that creates also maintains.

**AI builds with you, not for you.** The system engages in dialogue. It asks questions
to clarify intent. It knows when to ask for approval and when to proceed. It learns your
judgment over time.

**Rationale over decisions.** The specification captures _why_, not just _what_. "We
chose X because of Y, and if Y changes, we'd reconsider." This enables AI to make
intelligent future decisions, not just follow instructions.

## What the Specification Contains

The specification answers these questions completely enough that an AI with no other
context could build and evolve the product:

**Why does this exist?**

- The problem being solved
- Who experiences this problem
- What success looks like
- What this is explicitly _not_ (boundaries matter)

**How should it behave?**

- Observable behaviors from a user's perspective
- Described precisely enough to be testable
- Edge cases and error states
- What "correct" means

**What constraints apply?**

- Security requirements
- Legal and compliance requirements
- Performance boundaries
- Integration contracts with external systems

**What's been learned?**

- Decisions made and their rationale
- Approaches tried and abandoned (and why)
- Assumptions that turned out wrong

## The Dialogue Interface

Interaction with the specification happens through dialogue. The AI:

**Understands context** - It reads and internalizes the full specification before
responding. It knows what exists, what's been tried, what constraints apply.

**Clarifies before acting** - When intent is ambiguous, it asks. When a request
conflicts with existing spec, it surfaces the conflict.

**Proposes changes explicitly** - Shows exactly what would change in the specification
before making changes.

**Seeks appropriate approval** - Some changes require explicit approval. Others can
proceed with notification. The boundary is learnable.

**Executes completely** - Once approved, it updates the specification and triggers
whatever regeneration is needed.

## Approval Boundaries

The system learns when to ask and when to proceed. Starting defaults:

**Always ask:**

- Changes to why the product exists
- New architectural boundaries
- Modifications to security or legal constraints
- Removal of existing behaviors

**Ask once, then proceed on pattern:**

- New behavior specs within existing boundaries
- Updates to persona understanding
- Integration with new external systems

**Proceed, notify after:**

- Implementation details that don't change behavior specs
- Bug fixes where implementation didn't match existing spec

**Proceed silently:**

- Regeneration from unchanged specification
- Formatting and structural improvements to spec itself

These boundaries shift based on observed approval patterns.

## Signal Processing

External signals flow through the same dialogue interface:

| Signal            | Specification Update                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| Feature request   | Potentially: new behaviors, modified boundaries                            |
| Bug report        | Either: implementation wrong (regenerate) or spec incomplete (update spec) |
| User feedback     | Potentially: persona understanding, behavior priorities                    |
| Analytics         | Potentially: learnings, deprecation candidates                             |
| Error logs        | Potentially: constraint adjustments, behavior edge cases                   |
| Competitive intel | Potentially: boundaries, behavior gaps                                     |
| Security advisory | Constraint updates, forced regeneration                                    |

The AI processes signals by proposing specification updates, following the same approval
flow as human-initiated changes.

## Initialization

When starting a new project, the system conducts a structured interview:

1. **Purpose** - What problem are you solving? For whom? Why now? Why you?

2. **Success** - How will you know this is working? What does good look like?

3. **Boundaries** - What is this NOT? What's out of scope?

4. **Behaviors** - What should a user be able to do? Walk through the core flows.

5. **Constraints** - What must be true? Security? Legal? Performance?

6. **Unknowns** - What don't you know yet? What assumptions are you making?

The interview is conversational, not a form. The AI asks follow-up questions. It
reflects back understanding. It flags gaps and ambiguities.

## What This Enables

**Handoff** - Give the specification to any capable AI (current or future). It can
immediately understand the product deeply enough to contribute meaningfully.

**Regeneration** - Framework changed? Language preference shifted? Better AI available?
Regenerate implementation from spec. The product understanding is preserved.

**Onboarding** - New humans read the specification to understand the product. It's
complete, coherent, and explains rationale.

**Debugging intent** - When something's wrong, you can trace whether the spec was
incomplete, the generation was faulty, or the spec was correct but not followed.

**Compound learning** - Every bug fixed, every feature shipped, every user interaction
enriches the specification. The product gets easier to evolve over time, not harder.

## What This Is Not

**Not documentation** - Documentation describes what exists. The specification defines
what should exist. Documentation is derived from the spec.

**Not project management** - This doesn't track tasks, assignments, timelines. It tracks
product truth.

**Not a prompt library** - This isn't a collection of prompts for generating code. It's
a complete product representation that any generation approach can use.

**Not configuration** - This isn't environment variables and feature flags. It's product
essence.

## What Remains Human

In AI-first development, certain things remain distinctly human:

**Taste.** Knowing what's worth building. The difference between a product that
technically works and one people love. AI can generate variations; someone has to
choose.

**Accountability.** When the system fails and there are consequences, someone has to own
the decision to ship. AI can optimize; it cannot be responsible.

**Novel problem spaces.** AI works from patterns in training data. When you're doing
something genuinely unprecedented, human creativity leads. AI accelerates execution of
human insight.

**Integration wisdom.** Systems touch regulations, legacy code, physical infrastructure,
organizational dynamics, human behavior that doesn't match the spec. Holistic
pattern-matching across domains is where experience matters.

**Trust and relationships.** People hire people. Your network, your reputation, your
ability to understand what a client really needs - this is durable.

This methodology amplifies what humans uniquely provide. It doesn't replace human
judgment - it makes human judgment go further.

## Open Questions

Things to resolve through practice:

- How does the specification scale for large products? Hierarchical organization?
  Selective loading?
- How do you encode taste and aesthetic judgment? Examples? Anti-examples?
- How do you handle conflicting signals? Surface to human? Weighted resolution?
- What's the right file format? Markdown? Structured data? Hybrid?
- How does this integrate with existing codebases? Gradual specification extraction?

## How It Works In Practice

### Starting a New Project

Run `/knowledge` in an empty repo. The AI conducts an interview:

- "What problem are you solving?" → You explain, AI asks follow-ups
- "Who specifically experiences this?" → Push for concrete personas
- "What is this NOT?" → Define boundaries early
- "Walk me through the core user flows" → Behavior specs emerge

The AI creates `knowledge/` with initial files: `vision.md`, `personas.md`,
`boundaries.md`. Each captures your answers plus the AI's synthesis.

No code yet. Just understanding.

### Building Features

When you're ready to build, you don't start coding. You start specifying:

```
You: "We need user authentication"
AI: "What auth methods? OAuth, email/password, magic links?
     Looking at our personas, Jane needs quick onboarding.
     I'd suggest magic links as primary with OAuth fallback.
     Should I draft the auth component spec?"
You: "Yes"
```

AI creates `knowledge/components/auth.md` - the complete behavior specification. What it
does, edge cases, error states, security constraints.

Then: "Ready to generate implementation?" → Code flows from spec.

### Processing Signals

Bug report comes in:

```
You: "Users are getting logged out randomly on Safari"
AI: "Checking auth spec... the session handling doesn't specify
     browser-specific cookie behavior. Two options:
     1. Implementation bug - spec is correct, code is wrong
     2. Spec gap - we didn't account for Safari's ITP

     Let me investigate... [checks implementation]

     This is a spec gap. Safari's ITP clears cookies after 7 days
     of no interaction. Our spec assumes persistent sessions.

     I'd update the auth spec to include:
     - Session refresh on activity
     - Graceful re-auth flow when session expires

     Should I update the spec and regenerate affected code?"
```

Same process for user feedback, competitive intel, analytics. Signal → assess → propose
spec update → regenerate.

### The `/knowledge` Command

`/knowledge` is the dialogue interface for all of this. It:

- Initializes the specification structure in new projects
- Processes any input (features, bugs, feedback, ideas) as potential spec updates
- Asks clarifying questions before making changes
- Proposes explicit modifications to spec files
- Maintains coherence across the entire specification

You don't manage files manually. You have conversations. The AI maintains the
specification.

### Structure

The specification lives in `knowledge/`:

```
knowledge/
  vision.md           # Why this exists, for whom
  personas.md         # Who uses this, what they need
  boundaries.md       # What this is NOT
  roadmap.md          # Sequencing for usability
  components/         # Feature-level specs
    auth.md
    voice.md
    memory.md
  competitors/        # Landscape understanding
    cursor.md
    chatgpt.md
```

Structure evolves with the product. Put things where someone would look for them.
Reorganize as patterns emerge. The AI helps maintain coherence as structure changes.

### The Full Workflow

The AI-first SDLC includes other commands that work with `/knowledge`:

**`/knowledge`** - Core dialogue interface for specification maintenance. Start here.

**`/product-intel [topic]`** - Research competitors, industry trends. Outputs flow into
`knowledge/competitors/` and may trigger spec updates.

**`/autotask [description]`** - Autonomous implementation from specification. Creates
worktree, generates code from specs, handles review, opens PR.

The flow:

1. `/knowledge` to build/maintain the specification
2. `/product-intel` to understand the landscape (feeds back to knowledge)
3. `/autotask` to generate implementation from specification
4. Signals (bugs, feedback, analytics) processed through `/knowledge`
5. Updated spec triggers regeneration via `/autotask`

One loop. Specification → Implementation → Signals → Specification.

## The Future

This is the first thing you do in a repo. It's also how you maintain the product over
time.

You're not documenting a product. You're maintaining the complete product understanding

- the accumulated knowledge that enables everything else.

Two years from now, you're not writing code. You're specifying systems, validating
architectures, ensuring AI output serves human needs. The fundamentally creative act -
deciding what to build and why - remains yours. The translation to running software
becomes nearly instantaneous.

The question isn't whether this happens. The question is whether you're orchestrating AI
or being replaced by it.
