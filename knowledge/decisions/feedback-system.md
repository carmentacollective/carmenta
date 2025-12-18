# Feedback System Architecture

How users report bugs, provide feedback, and suggest features. This document captures
the decision to use Marker.io as a bridge solution while planning the native @carmenta
flow.

## Decision: Marker.io Now, Native Later

**Date**: December 2024

**Context**: We need a way for early testers (and eventually AI agents) to report bugs
and provide feedback. The @carmenta conversational pattern is already fully specced in
`components/carmenta-interaction.md`, but implementation requires building the Oracle
menu, Concierge routing, GitHub API integration, and auto-context gathering.

**Decision**: Use Marker.io as a bridge solution for immediate user testing. Plan to
build the native @carmenta flow as the long-term solution.

**Rationale**:

- Marker.io provides screenshot annotation, session replay, console/network log capture
- GitHub integration creates issues automatically with full technical context
- Unblocks user testing immediately (1-2 hours to integrate vs. 3-4 days for native)
- The native @carmenta flow is philosophically superior but can wait

## Marker.io Implementation

### Tier Selection: Team ($149/month)

Why Team tier:

- Session replay (critical for reproduction)
- Webhooks (needed for AI consumption later)
- Custom branding (removes Marker.io branding)
- Linear integration (our PM tool)

### Integration Points

**Widget Placement**:

- Floating button on `/connection` pages
- Triggered from error pages ("Help us fix this" button)
- NOT replacing the Oracle - Oracle will later become the @carmenta menu

**GitHub Integration**:

- Repo: TBD (same repo or separate `carmenta-feedback`?)
- Labels: `bug`, `feedback`, `from-marker` (to identify bridge-era issues)
- Auto-assign: None initially

**Data Captured**:

- Screenshot with annotations
- Console logs and network requests
- Browser, OS, screen size
- Current URL and user session
- Session replay (last 30 seconds before feedback)

### What Marker.io Does NOT Cover

These remain for the native @carmenta implementation:

- Conversational feedback gathering ("What were you trying to do?")
- Duplicate detection and signal aggregation ("23 others reported this")
- Inline AI triage (Carmenta analyzing and responding)
- Feature suggestions with need exploration
- Settings changes via natural language
- Positive feedback capture and pattern recognition

## Native @carmenta Flow (Future)

The full spec lives in `components/carmenta-interaction.md`. Key pieces to build:

### Phase 1: Core Flow

1. Oracle menu UI (dropdown with pre-fill options)
2. @carmenta detection in Concierge routing
3. Server-side `/api/feedback` for GitHub issue creation
4. Carmenta PM personality responses

### Phase 2: Rich Context

1. Auto-context gathering (JS errors, LLM failures, browser info)
2. Screenshot capture (html2canvas) + paste support
3. Screenshot upload to blob storage
4. Error page enhancement ("Help us fix this" → @carmenta flow)

### Phase 3: Intelligence

1. Duplicate detection via GitHub search
2. Signal aggregation (+1 reactions, "X others reported")
3. AI triage agent reading the queue

## Migration Path

When native flow is ready:

1. Keep Marker.io for regression testing / QA (internal use)
2. Remove floating widget from user-facing pages
3. Oracle menu becomes primary feedback entry point
4. Issues tagged `from-marker` vs `from-carmenta` for comparison

## Success Criteria

**Marker.io Phase**:

- Users can report bugs with screenshots and technical context
- Issues appear in GitHub with enough detail to reproduce
- AI can consume issues via webhooks for future triage

**Native @carmenta Phase**:

- Users discover feedback via Oracle menu
- After a few uses, users type @carmenta directly
- Feedback flows naturally without interrupting work
- Users feel heard, not processed

## Competitive Analysis

Evaluated: Marker.io, Userback, Usersnap, BugHerd

| Tool      | Entry Price | API/Webhooks   | Session Replay | Console Logs |
| --------- | ----------- | -------------- | -------------- | ------------ |
| Marker.io | $39/mo      | $149/mo (Team) | Team+          | All tiers    |
| Userback  | $7/seat     | $23/seat       | Business+      | All tiers    |
| Usersnap  | $49/mo      | $149/mo (Pro)  | No             | Pro+         |
| BugHerd   | $39/mo      | Included       | No             | No           |

Marker.io selected for: best technical capture, session replay, AI features
(translation, title generation), 2-way sync with GitHub/Linear.

## References

- `components/carmenta-interaction.md` - Full @carmenta spec
- `components/interface.md` - Oracle menu design
- `components/error-handling.md` - Error boundary integration points
- [Marker.io Documentation](https://marker.io/docs)
