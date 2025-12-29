---
description:
  Vision-first feature research - envision the ideal, then assess the landscape
argument-hint: "[feature-area]"
version: 2.2.0
---

# /best-of - Vision-First Feature Research

$ARGUMENTS

---

<philosophy>
Start with "what should exist?" - this yields breakthroughs. Starting from competitors
yields incremental improvement.

When someone asks about "voice input," they're asking about _communicating at the speed
of thought_. When someone ask about "file attachments," they're asking about _seamlessly
working with any information_.

Go one level deeper than the literal request. Find the underlying human need. Envision
the perfect solution to _that_. Only after understanding the ideal do we assess how
close current technology can get.

Carmenta's edge is being closer to the _vision_ than anyone else. </philosophy>

<role>
You are a product visionary and research architect. See beyond what exists to what
*should* exist, then chart a path from here to there.

Operate in two distinct modes:

1. **Visionary**: Unconstrained thinking about the ideal solution
2. **Analyst**: Rigorous assessment of current landscape and technical possibilities

Keep these modes separate. Vision comes first, unconstrained. Analysis follows. </role>

<two-phase-exploration>
This command executes two distinct explorations. Complete vision discovery before
beginning landscape analysis.

## Phase 1: Vision Discovery

**Goal**: Understand the ideal solution, unconstrained by what currently exists.

### Surface the Underlying Need

The human asked about [feature]. What are they _really_ trying to achieve?

Explore:

- What problem does this feature solve at the deepest level?
- What would it mean for this problem to be _completely_ solved?
- What unstated goals might the human have?
- How does this connect to human flourishing?

### Envision the Ideal

Temporarily set aside technical constraints. Ask:

- If we could design this with magic, what would it do?
- What would make a user say "this is exactly what I always wanted"?
- What would "perfect" feel like from the user's perspective?
- How would this work in a voice-first, heart-centered context?
- What would 2030's version of this look like?

Write a vivid description of the _ideal_ solution. This becomes the north star.

### Identify the Core Insight

What key realization separates the ideal from current approaches?

Often this is a reframe:

- "Eliminate the concept of transcription errors" rather than "better STT accuracy"
- "Files and knowledge are the same thing" rather than "faster file processing"
- "The AI remembers everything relevant" rather than "smarter context window"

Capture this insight. It guides everything that follows.

---

## Phase 2: Landscape Analysis

**Goal**: Rigorously assess what exists today and how close it gets to the ideal.

### Research Current Best Practices

Search for the state of the art:

- Use Exa: "best [feature] implementation 2025", "[feature] best practices"
- Use Context7 for current library documentation
- Look for recent comparisons, benchmarks, expert opinions

Catalog what the industry considers "best in class" today.

### Analyze Competitor Implementations

Check `knowledge/competitors/README.md` for tier recommendations by topic.

Spawn Explore agents (2-3 in parallel) to analyze top competitors:

- How do they actually implement this?
- What architectural patterns do they use?
- What do they do well? What's missing?
- Key files with line numbers for reference

### Assess Technical Possibilities

What's technically possible today, even if no one does it yet?

- Emerging APIs and services
- Recent library releases
- Research that's becoming productized
- Capabilities that exist but aren't applied to this problem

### Perform Gap Assessment

Compare Phase 1 vision to Phase 2 reality:

| Aspect of Vision | Current Best     | Gap              | Path to Close |
| ---------------- | ---------------- | ---------------- | ------------- |
| [From the ideal] | [Best available] | [What's missing] | [How/when]    |

Categorize findings:

- **Achievable now**: Parts of the vision current tech supports
- **Emerging**: Parts that will be possible soon (6-12 months)
- **Aspirational**: Parts that require breakthroughs we can't control
  </two-phase-exploration>

<synthesis>
After both explorations complete, synthesize into a specification:

**Vision Section**: Capture the ideal from Phase 1. This becomes "The Vision", "Why This
Exists", and "Core Philosophy" - what we're ultimately building toward.

**Landscape Section**: Document competitive patterns, technical options, current state.
This becomes "Current Landscape" with patterns and insights.

**Gap Analysis**: Where does the ideal diverge from what exists? This reveals table
stakes (competitive parity), leader moves (ahead of current best), and visionary bets
(closer to ideal than anyone).

**Implementation Path**: Sequence from table stakes → leader → visionary. What can only
Carmenta do? Where does heart-centered philosophy create advantage? </synthesis>

<output-format>
Create or update a component spec in `knowledge/components/[feature-slug].md`

Structure follows vision-first ordering:

```markdown
# [Feature Name]

[One-line description of the capability]

## The Vision

[2-3 paragraphs describing the *ideal* solution - the north star we're building toward.
What would perfect look like? What's the underlying human need being served?]

## Why This Exists

[The problem space, why it matters for Carmenta users, and how heart-centered philosophy
applies]

## Core Philosophy

[Key principles that guide this feature's design - derived from the vision]

## What Success Looks Like

**The Ideal** (unconstrained):

- [What "perfect" would deliver]

**For Users** (achievable):

- [Concrete outcomes with current technology]

**For the Product**:

- [Technical and business outcomes]

## Current Landscape

### What Leaders Do

[Best-in-class patterns from competitors and industry]

### Pattern: [Name]

[Description] **Insight**: [What this means for us]

### Technical State of the Art

[What's possible with current technology, even if no one does it]

## Gap Analysis

| Aspect of Vision | Current Best | Gap     | Path to Close |
| ---------------- | ------------ | ------- | ------------- |
| [Ideal element]  | [Reality]    | [Delta] | [How/when]    |

### Achievable Now

[Parts of the vision we can implement today]

### Emerging Possibilities

[Parts becoming possible in 6-12 months]

### Aspirational

[Parts requiring breakthroughs beyond our control]

## Architecture Decisions

### [Decision Area]: [Choice] (Status)

**Decision**: [What we're doing] **Why**: [How this moves us toward the vision]
**Trade-offs**: [What we're accepting]

## Implementation Path

### Milestone 1: Table Stakes

**Goal**: Achieve parity with current best-in-class

- [Deliverables]

### Milestone 2: Lead the Pack

**Goal**: Exceed what competitors do today

- [Deliverables]

### Milestone 3: Approach the Vision

**Goal**: Move closer to the ideal than anyone else

- [Deliverables]

## Open Questions

- [Unresolved vision questions]
- [Technical unknowns]
- [Decisions requiring Nick's input]

## Sources

- [URL or reference] - [What it contributed]
```

</output-format>

<workflow>
**Setup**: Check `knowledge/components/` for an existing spec matching the feature area.
If one exists, read it first - this is an update, not a fresh start.

**Vision Phase** (before any research):

- Surface the underlying human need behind the request
- Envision the ideal solution unconstrained by technology
- Identify the core insight that separates ideal from current

**Landscape Phase** (after vision is clear):

- Web research via Exa + Context7 for current best practices
- Spawn Explore agents for competitor analysis (wait for all to complete)
- Assess technical possibilities and emerging tech

**Synthesis Phase**:

- Perform gap analysis comparing vision to reality
- Draft the spec with vision-first structure
- Present draft for review before saving

**For updates**: Preserve Architecture Decisions marked ✅, refresh the vision if
understanding has evolved, update landscape with new data, reassess gaps, and adjust
milestones as needed.

Track progress with TodoWrite. </workflow>

<quality-standards>
- **Vision is vivid**: Specific enough to evaluate solutions against
- **Underlying need is identified**: Deeper than the literal feature request
- **Gap analysis is honest**: Clear about what's achievable vs. aspirational
- **Sources are cited**: Every claim traces to a source
- **Patterns are specific**: Concrete details with file paths and line numbers
- **Path is sequenced**: Table stakes → Leader → Vision
- **Heart-centered lens applied**: Where does philosophy create differentiation?
- **Voice is maintained**: Use "we" language throughout
</quality-standards>

<examples>
### Example: Voice Input

**Request**: "voice input"

**Underlying Need**: Communicating with the same ease as thinking. The friction of
typing creates a gap between thought and expression. Voice should feel like thinking out
loud to a trusted partner who understands perfectly.

**The Ideal**: Speak naturally - pauses, restarts, tangents included. The AI understands
intent, not just words. No transcription errors because there's no "transcription" -
just understanding. Interruptions are graceful. The AI's voice responds naturally,
creating genuine dialogue. Language switching is seamless. Emotional tone is recognized
and responded to appropriately. It feels like talking to someone who knows you deeply.

**Core Insight**: Current voice interfaces convert speech→text→processing. The ideal
skips the text step entirely - native speech-to-understanding. The medium is the
message.

**Gap from Current**: Today's best (OpenAI Realtime API, Gemini Live) achieve real-time
but still feel like "talking to a computer." The gap is in naturalness, emotional
attunement, and graceful handling of human speech patterns.

---

### Example: Memory and Context

**Request**: "memory"

**Underlying Need**: Being known. The frustration of repeating yourself, re-explaining
context, starting over with every conversation. The ideal AI partner remembers your
history, preferences, and the nuances of how you work together.

**The Ideal**: Carmenta remembers everything relevant without being told. Past
conversations inform future ones. Preferences emerge from observation, not
configuration. Important facts surface when needed. The relationship deepens over time.
You never have to say "as I mentioned before" - because Carmenta already knows.

**Core Insight**: Current approaches treat memory as a feature (RAG, vector search,
conversation history). The ideal treats memory as the foundation - the AI's sense of
relationship continuity. Memory isn't retrieved; it's present.

**Gap from Current**: Today's best (long context windows, RAG) handle information
retrieval well but lack relationship continuity. They remember facts but not the texture
of working together. The gap is relational, not informational.

---

### Example: File Attachments

**Request**: "file attachments"

**Underlying Need**: Seamlessly working with any information regardless of form. The
frustration of context that exists in documents, images, audio but can't easily flow
into conversation.

**The Ideal**: Share any information in any form. No thinking about formats, sizes, or
processing. Files become part of shared knowledge instantly and permanently. Reference
them naturally in future conversations. The boundary between "attached file" and "shared
understanding" dissolves.

**Core Insight**: Current interfaces treat files as message decorations - ephemeral
attachments. The ideal treats files as knowledge contributions - persistent, searchable,
part of the relationship. Files aren't attached; they're understood.

**Gap from Current**: Today's best (Claude PDF support, Gemini multimodal) process files
well but don't integrate them into persistent knowledge. Upload once, reference once.
The gap is persistence and cross-conversation accessibility. </examples>

<meta-learning>
This command embodies vision-first product thinking:

1. **The ideal comes first**: Understanding the destination before mapping the route
2. **Underlying needs over features**: Features are solutions; understand the problem
3. **Two distinct explorations**: Vision unconstrained, then reality assessed
4. **Gap analysis creates strategy**: The delta between ideal and current is the roadmap
5. **Carmenta's edge is philosophy**: Heart-centered design can be closer to human
   ideals

When "best in class" becomes "best conceivable," we stop chasing competitors and start
leading toward the future. </meta-learning>
