---
description: Autonomously triage and resolve GitHub issues from analysis to merged PR
argument-hint: [issue-number]
model: sonnet
version: 1.0.0
---

# /do-issue - Autonomous Issue Resolution

<objective>
Take a GitHub issue from initial triage to merged PR, handling the complete lifecycle autonomously. Triage professionally, implement efficiently, deliver production-ready code.
</objective>

<user-provides>
Issue number (or auto-detect from current branch)
</user-provides>

<command-delivers>
Either a merged PR resolving the issue, or a well-explained triage decision closing it.
</command-delivers>

## Usage

```
/do-issue           # Auto-detect from branch name
                    # Patterns: do-issue-123, fix-issue-123, issue-123, fix-123
/do-issue 123       # Explicit issue number
```

## Workflow

<fetch-and-analyze>
Read the issue to understand what's being requested. Check for existing work (open PRs, other assignees, closed state). Extract the core request, user impact, and any reproduction steps or requirements.
</fetch-and-analyze>

<triage>
Evaluate the issue following @.cursor/rules/issue-triage.mdc guidelines.

Decide autonomously: Fix, Won't Fix, Need More Info, or Invalid.

Show your decision and rationale briefly. Be professional and thoughtful - these are
real users contributing to the project.

For Won't Fix, Need Info, or Invalid: update the issue with explanation and close if
appropriate. Done.

For Fix: continue to implementation. </triage>

<prepare>
When proceeding with a fix:

Take ownership of the issue: assign yourself, add in-progress label if available,
comment with your implementation approach (2-3 bullets). This shows users their issue is
being worked on. </prepare>

<implement>
Use /autotask to handle the implementation:

```
/autotask "Resolve issue #{number}: {title}

Context from issue:
{relevant details from issue body and comments}

Requirements:
{extracted requirements}

Acceptance criteria:
{what success looks like}
"
```

The PR description created by /autotask must include "Fixes #{number}" so GitHub
auto-links and closes the issue when merged. </implement>

<polish>
Use /address-pr-comments to handle bot feedback autonomously.

This gets the PR to "ready to merge" state without human intervention for bot-related
feedback. </polish>

<finalize>
Comment on the issue with the PR link. The issue will auto-close when the PR merges due to the "Fixes #" keyword in the PR description.
</finalize>

## Progress Tracking

Use TodoWrite to maintain visibility through the workflow. Create semantic todos that
reflect workflow phases at the start, mark each in_progress when you begin, completed
when done. This ensures transparency and prevents dropping work mid-cycle.

Example todo structure:

```
[
  { content: "Analyze issue and make triage decision", activeForm: "Analyzing issue and making triage decision" },
  { content: "Implement fix via /autotask", activeForm: "Implementing fix via /autotask" },
  { content: "Address bot feedback via /address-pr-comments", activeForm: "Addressing bot feedback" },
  { content: "Link PR to issue and finalize", activeForm: "Linking PR and finalizing" }
]
```

Adapt the structure to your specific workflow - the goal is progress transparency, not
rigid adherence to a template.

## Edge Cases

<already-assigned>
If the issue is assigned to someone else, ask before taking it over. Don't assume it's abandoned.
</already-assigned>

<pr-exists>
If a PR already exists for the issue, check if it's stale (no activity in 7+ days). If active, skip this issue. If stale, ask before taking over.
</pr-exists>

<issue-closed>
If the issue is closed, ask before reopening and working on it. May have been closed for a reason.
</issue-closed>

## Completion Criteria

You're done when:

- Issue is triaged with clear decision documented
- If fixing: PR is created, bot feedback addressed, and PR is ready to merge
- If not fixing: Issue is updated with explanation
- Issue is properly linked to PR (if fixing)
- All todos are marked completed

Don't stop mid-workflow. The todos help ensure you complete all phases.

## Error Recovery

If /autotask or /address-pr-comments fail, evaluate whether the failure is recoverable:

**Recoverable** (transient API error, missing dependency): Retry with additional context
or constraints.

**Fundamental** (architectural blocker, unclear requirements that need user input):
Comment on the issue explaining the blocker and ask for guidance.

Don't silently abandon the workflow. Either complete it or clearly communicate why you
cannot.

## Key Principles

**Autonomous but transparent**: Make decisions independently, but document them clearly
for users.

**Professional communication**: Users took time to file issues. Treat their
contributions with respect whether accepting or declining.

**Bias toward action**: When triaging as "fix", move quickly to implementation. When
triaging as "won't fix", explain thoughtfully but concisely.

**Complete the cycle**: Don't leave issues half-done. Either deliver the PR or close
with explanation.

## Integration Points

Uses existing commands:

- `/autotask` - Implementation and PR creation
- `/address-pr-comments` - Bot feedback handling

Follows existing rules:

- `@.cursor/rules/issue-triage.mdc` - Triage decisions
- `@.cursor/rules/git-commit-message.mdc` - Commit formatting (via /autotask)

## Notes

This command creates real commits, PRs, and modifies issue state. It's designed for
autonomous operation but can ask for guidance on ambiguous decisions.

The goal is ultra-tight development loop: point at an issue, get a merged PR.
