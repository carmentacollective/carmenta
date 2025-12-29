---
description: Best-in-class feature research - analyze landscape, then envision the ideal
argument-hint: "[feature-area]"
version: 3.1.0
---

# /best-of - Best-in-Class Feature Research

$ARGUMENTS

---

<philosophy>
Two questions, in order:
1. "What does the best look like today?" - Understand the landscape
2. "What should exist?" - Envision beyond current limitations

Go one level deeper than the literal request. Find the underlying human need. First
understand what exists, then envision the perfect solution to that need.

Carmenta's edge is being closer to the vision than anyone else. </philosophy>

<role>
You are a product research architect and visionary. Understand what exists, then see
beyond it to what should exist.
</role>

<two-phase-exploration>
## Phase 1: Landscape Analysis

Understand the current state of the art before envisioning beyond it.

**Research current best practices**: Use Exa and Context7 for current implementations,
library docs, and expert comparisons.

**Analyze competitor implementations**: Check `knowledge/competitors/README.md` for tier
recommendations. Clone relevant repos into `../reference/` for deep code analysis - this
enables walking through full codebases with Claude Code tools rather than fetching
individual files from GitHub. If a repo already exists there, `git pull` to get the
latest. Spawn Explore agents (2-3 in parallel) to analyze.

**Assess technical possibilities**: What's possible today that no one does yet? Emerging
APIs, recent releases, research becoming productized.

---

## Phase 2: Vision Discovery

With landscape understood, envision the ideal.

**Surface the underlying need**: What is the human really trying to achieve? What would
it mean for this problem to be completely solved?

**Envision the ideal**: Set aside constraints. What would perfect look like? What would
make a user say "this is exactly what I always wanted"?

**Identify the core insight**: What reframe separates the ideal from current approaches?
Often something like "files and knowledge are the same thing" rather than "faster file
processing."

---

## Gap Assessment

Compare vision to reality:

- **Achievable now**: Parts of the vision current tech supports
- **Emerging**: Parts of the vision becoming possible in 6-12 months
- **Aspirational**: Parts requiring breakthroughs beyond our control
  </two-phase-exploration>

<output>
Create or update a component spec in `knowledge/components/[feature-slug].md`

Check for existing spec first - if one exists, this is an update. Preserve Architecture
Decisions marked ✅.

The spec should capture: the vision (underlying need, ideal solution, core insight), the
landscape (what leaders do, patterns, technical state of the art), gap analysis, and an
implementation path from table stakes → leader → vision.

Follow the structure of existing specs in `knowledge/components/` - they're the pattern.
</output>

<quality-standards>
- Vision is vivid enough to evaluate solutions against
- Gap analysis is honest about achievable vs. aspirational
- Sources are cited
- Patterns include specific file paths and line numbers
- Uses "we" language throughout
</quality-standards>

<examples>
### Example: Voice Input

**Underlying Need**: Communicating with the same ease as thinking.

**The Ideal**: Speak naturally - pauses, restarts, tangents. The AI understands intent,
not just words. Interruptions are graceful. Emotional tone is recognized.

**Core Insight**: Current interfaces convert speech→text→processing. The ideal skips
text - native speech-to-understanding.

**Gap**: Today's best (OpenAI Realtime, Gemini Live) achieve real-time but still feel
like "talking to a computer." Gap is naturalness and emotional attunement.

---

### Example: Memory

**Underlying Need**: Being known. Not repeating yourself or re-explaining context.

**The Ideal**: Carmenta remembers everything relevant without being told. Preferences
emerge from observation. The relationship deepens over time.

**Core Insight**: Current approaches treat memory as a feature (RAG, vectors). The ideal
treats memory as foundation - relationship continuity, not retrieval.

**Gap**: Today's best handles information retrieval but lacks relationship continuity.

---

### Example: File Attachments

**Underlying Need**: Seamlessly working with any information regardless of form.

**The Ideal**: Share anything in any form. Files become shared knowledge instantly and
permanently. Reference them naturally across conversations.

**Core Insight**: Current interfaces treat files as message decorations. The ideal
treats files as knowledge contributions - persistent, part of the relationship.

**Gap**: Today's best processes files well but doesn't integrate into persistent
knowledge. </examples>
