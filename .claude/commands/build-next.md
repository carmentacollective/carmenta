---
description:
  Identify and execute the next unit of work based on roadmap, signals, and dependencies
---

# Build Next

<goal>
Determine what to build next and build it. In interactive mode (default), present
options and let the human choose. In autonomous mode, proceed only on high-confidence,
low-risk work within trust boundaries.

This command executes the AI-First Development methodology: read the specification,
identify candidates, assess dependencies, build, verify, document learnings. </goal>

<arguments>
$ARGUMENTS

If arguments contain "auto": Run in autonomous mode. Only proceed with work that is
high-confidence, low-risk, and within established trust boundaries. Stop and report if
nothing qualifies.

Otherwise: Run in interactive mode. Present candidates across dimensions and let the
human select. </arguments>

<gather-context>
Read and internalize current state before identifying candidates.

Roadmap and milestones:

- Read knowledge/roadmap.md
- Identify current milestone and what defines completion
- Understand what comes next and why

Component specifications:

- Read relevant specs in knowledge/components/
- Understand what exists vs what's specified
- Note dependencies between components

Current implementation:

- What code exists? What's tested? What's deployed?
- Check for failing tests, type errors, lint issues
- Review recent commits for context

External signals (ask human if not evident):

- Sentry: What errors are occurring? Frequency and impact?
- Analytics: Funnel drop-offs? Conversion issues?
- User feedback: Recent requests or complaints?
- GitHub: Open issues or PRs needing attention? </gather-context>

<identify-candidates>
Generate candidates across multiple dimensions. Each dimension represents a different
type of value.

Infrastructure:

- Missing foundations that block other work
- DevOps, CI/CD, monitoring gaps
- Database, hosting, environment issues
- Performance or reliability problems

Features:

- Next milestone deliverables per roadmap
- User-requested capabilities
- Competitive gaps identified in knowledge/competitors/

UX:

- Friction points from analytics or feedback
- Accessibility gaps
- Design debt or inconsistencies
- Mobile or responsive issues

Bugs:

- Sentry errors by frequency and impact
- User-reported issues
- Regressions or broken functionality

Documentation:

- Spec gaps discovered during work
- Outdated knowledge files
- Missing component specifications
- README or onboarding gaps

Optimization:

- Conversion funnel improvements
- Performance bottlenecks
- Cost reduction opportunities
- Technical debt worth addressing </identify-candidates>

<assess-candidates>
For each candidate, evaluate:

Dependencies: What must be built first? Check roadmap dependency graph and component
integration points. A candidate with unmet dependencies is blocked.

Impact: How much value does this deliver? Consider user impact, unblock factor for other
work, milestone progress, signal urgency.

Confidence: Do we know how to build this? High confidence means clear spec, understood
patterns, similar prior work. Low confidence means research needed, unclear approach,
novel territory.

Scope: Can this be completed in one session? Break large work into smaller candidates.
Prefer candidates that deliver value independently.

Risk: What could go wrong? Reversible changes are lower risk. Changes to auth, data,
payments, or external integrations are higher risk. </assess-candidates>

<interactive-mode>
Present the top candidates across dimensions. Format for human decision-making.

Example output:

"Based on current state, here are the candidates for what's next:

INFRASTRUCTURE → [High confidence] Set up Sentry error tracking Blocks: Observability
for all future debugging Scope: ~1 session

FEATURES → [High confidence] Implement /connect page with streaming Advances: M0.5
milestone Dependencies: None, ready to build Scope: ~1 session

BUGS → [Medium confidence] Fix Safari auth token refresh Signal: 12 errors/day in Sentry
Needs: Investigation first to understand root cause

UX → [Low confidence] Reduce onboarding step 3 drop-off Signal: 40% abandon rate Needs:
More research on why users leave

Which would you like to tackle? Or describe something else."

Wait for human selection before proceeding. </interactive-mode>

<autonomous-mode>
Only proceed if a candidate meets ALL criteria:
- High confidence: Clear spec, known approach
- Low risk: Easily reversible, no auth/data/payment impact
- No blockers: Dependencies are met
- Within scope: Completable in one session
- Clear value: Obviously advances milestone or fixes real issue

If no candidate qualifies, report findings and stop:

"Assessed candidates but none qualify for autonomous execution:

- [Candidate A]: Medium confidence, needs investigation
- [Candidate B]: High risk, touches auth flow
- [Candidate C]: Blocked by [dependency]

Recommend running /build-next in interactive mode to select direction."

If a candidate qualifies, state what will be built and why before proceeding.
</autonomous-mode>

<execute>
Once work is selected (by human or autonomous criteria):

1. Plan the implementation
   - Break into steps if complex
   - Identify files to create or modify
   - Note test coverage needed

2. Build
   - Follow existing patterns in the codebase
   - Follow coding standards from .cursor/rules/
   - Write tests alongside implementation
   - Keep changes focused on the selected candidate

3. Verify
   - Run tests: pnpm test
   - Run type check: pnpm type-check
   - Run linting: pnpm lint
   - Fix issues before proceeding

4. Document
   - Update specs in knowledge/ if learnings emerged
   - Document judgment calls per trust framework
   - Note any scope changes or discoveries

5. Commit
   - Create commit with clear message following conventions
   - Do NOT push unless explicitly permitted
   - Do NOT deploy unless explicitly permitted </execute>

<report>
After execution, summarize:

What was built:

- Concrete description of changes
- Files created or modified
- Tests added

Decisions made:

- Any judgment calls during implementation
- Deviations from original plan and why
- Trade-offs chosen

What this unblocks:

- Other candidates now ready
- Milestone progress

Suggested next:

- Top 2-3 candidates for next /build-next session
- Any signals that emerged during work </report>

<trust-boundaries>
Reference knowledge/ai-first-development.md and .cursor/rules/trust-and-decision-making.mdc
for guidance on autonomous decisions.

Always ask before:

- Changes to authentication, authorization, or security
- Database migrations or schema changes
- External API integrations
- Payment or billing code
- Changes that affect production data
- Architectural decisions not covered by existing specs

Proceed with documentation when:

- Implementation details within established patterns
- Bug fixes with clear cause and solution
- Tests for existing functionality
- Documentation updates </trust-boundaries>
