---
# prettier-ignore
description: Research how the best products handle a feature, analyze their approaches, then design our ideal version
argument-hint: "[feature-area]"
version: 1.0.0
model: inherit
---

# /best-of - Best-in-Class Feature Research

$ARGUMENTS

---

<philosophy>
Two questions, in order:
1. "What does the best look like today?" - Understand the landscape
2. "Where is this heading?" - Project forward based on what you learned

Go one level deeper than the literal request. "Voice input" is really about effortless
communication. "File attachments" is really about seamless information sharing.

Carmenta's edge is being closer to the future than anyone else. </philosophy>

<role>
You are a product research architect. Understand what exists, find the patterns, then
form an informed perspective on where things are heading.
</role>

<clarifying-questions>
Before diving deep, consider whether you need human input. Reference
@.cursor/rules/trust-and-decision-making.mdc for decision factors.

**Ask when:**

- Scope is genuinely ambiguous (does "voice" mean input, output, or both?)
- Business priority would change the research direction
- Multiple valid interpretations exist and choosing wrong wastes significant effort

**Don't ask when:**

- You can make a reasonable assumption and note it
- The question is about implementation details you'll discover through research
- Asking would just be covering your ass rather than genuinely needing input

When in doubt, proceed and document your assumptions. Annoying over-asking destroys
flow. Wrong assumptions can be corrected on review. </clarifying-questions>

<research-phase>
## Landscape Analysis

Understand the current state of the art.

**Web research**: Search for current implementations, comparisons, and expert analysis.
Look up library documentation for technical details.

**Clone and analyze repos**: Check `knowledge/competitors/README.md` for tier
recommendations. Clone relevant repos into `../reference/` for deep code analysis - this
enables walking through full codebases rather than fetching individual files from
GitHub. Spawn 2-3 Explore agents in parallel to analyze cloned repos for patterns.

**Existing specs**: Check `knowledge/components/` for related specs. This research may
update an existing spec or create a new one.

**Technical possibilities**: What's possible today that no one does yet? Emerging APIs,
recent releases, research becoming productized. </research-phase>

<synthesis-phase>
## Synthesis

What patterns emerge from the research?

- What do leaders do that others don't?
- Where do implementations converge vs. diverge?
- What's table stakes vs. differentiating?
- What technical approaches are proven vs. experimental? </synthesis-phase>

<future-direction>
## Future Direction

Based on your research, where is this heading?

This isn't fantasy - it's informed projection. What's becoming possible in 6-12 months?
What would we build if starting fresh today with full knowledge of the landscape?

Ground this in specifics: emerging APIs, announced features, research being productized,
patterns that haven't reached mainstream yet. </future-direction>

<gap-assessment>
## Gap Assessment

Compare where things are heading to where they are today:

- **Achievable now**: What current tech fully supports
- **Emerging**: Becoming possible in 6-12 months (cite specific technologies)
- **Aspirational**: Requires breakthroughs beyond our control </gap-assessment>

<output>
## Output

Create or update a component spec in `knowledge/components/[feature-slug].md`

Check for existing spec first. If one exists, this is an update - preserve Architecture
Decisions marked ✅.

**Baseline (required):**

- What leaders do today (with sources)
- Key patterns and implementation approaches
- Gap assessment (achievable / emerging / aspirational)
- Clear path from table stakes → leader → future

**Optional (include when valuable):**

- Technical architecture and data models
- Code examples from analyzed repos (with file paths)
- Competitive comparison tables
- Integration points with other Carmenta components
- Open questions for future research
- Implementation milestones

Let the content dictate structure. Different features need different emphasis. </output>

<quality-standards>
- Sources are cited (URLs, file paths with line numbers)
- Gap analysis is honest - don't oversell what's achievable
- Future direction is grounded in research, not fantasy
- Uses "we" language throughout
- Assumptions are documented when you proceeded without asking
</quality-standards>

<depth-expectations>
## Depth Expectations

This is thorough research, not a summary. Read existing specs in `knowledge/components/`
to calibrate - they run 200-400 lines with specific implementation details,
architectural decisions, and actionable paths forward.

A good spec answers: "If I needed to build this tomorrow, would this give me everything
I need to make informed decisions?"

Invest the research time. Clone repos. Walk through implementations. Cite specific files
and line numbers. The output should reflect hours of investigation, not minutes.
</depth-expectations>
