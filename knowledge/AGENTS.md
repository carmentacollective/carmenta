# Product Knowledge

**This folder IS the product specification.** Code is generated from it. The
specification is the IP.

## The Paradigm Shift

Code is becoming ephemeral. These specifications are the source of truth—the accumulated
understanding from which decisions are made, code is generated, and new team members
(human or AI) can work intelligently.

You're not documenting a product. You're maintaining the product kernel.

## What This Is

- The context from which code can be regenerated
- Where decisions are recorded inside the files they relate to
- A living specification that evolves with signals (user feedback, competitor moves,
  learnings)

## What This Is Not

- Documentation (documentation is generated FROM this)
- A filing system (organize by lookup, not by type)
- A task tracker
- A rigid schema

## Structure

- `product/` - Core identity: vision.md, personas.md, boundaries.md
- `components/` - Feature-level specifications (one file per capability)
- `competitors/` - Competitive analysis (one file per competitor)
- `decisions/` - Cross-cutting architectural decisions (infrastructure, patterns)
- `roadmap.md` - Milestones and sequencing

Structure serves findability:

- Component-specific decisions go in component files (auth decisions →
  `components/auth.md`)
- Cross-cutting decisions go in `decisions/` (infrastructure stack, architecture
  patterns)
- When in doubt: where would someone look for this?

## Writing for LLM Consumption

These files will be read by LLMs as context for code generation and decision-making.
Follow prompt engineering best practices:

- Front-load critical information (LLMs weight early content more heavily)
- Be explicit—LLMs can't infer context the way humans do
- Use consistent terminology throughout
- Show correct patterns through examples, never anti-patterns
- Focus on goals and outcomes over prescriptive steps

## Processing Signals

When new information arrives (user feedback, competitive intel, learnings), think like a
PM: Does this change what we should build? Does this reveal something we didn't know?
Update the relevant file. Most signals update understanding; some demand action.

@.cursor/rules/prompt-engineering.mdc
