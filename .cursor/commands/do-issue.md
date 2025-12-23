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
/do-issue           # Auto-detect from branch name (do-issue-123)
/do-issue 123       # Work on issue #123
```

## Workflow

<fetch-and-analyze>
Read the issue to understand what's being requested:

```bash
gh issue view {number} --json title,body,labels,assignees,state,comments,url
```

Check for existing work:

- Is there a PR already addressing this?
- Is it assigned to someone else?
- Is it closed?

Extract the core request, user impact, and any reproduction steps or requirements.
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

Assign the issue to yourself:

```bash
gh issue edit {number} --add-assignee @me
```

Add "in-progress" label if it exists in the repo.

Comment on the issue with your implementation approach (brief - 2-3 bullet points). This
shows users their issue is being worked on. </prepare>

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
Comment on the issue with the PR link:

```bash
gh issue comment {number} --body "Fixed in #{pr-number} 🎉"
```

The issue will auto-close when the PR merges due to the "Fixes #" keyword. </finalize>

## Progress Tracking

Use TodoWrite to track progress throughout the workflow. Create todos at the start and
update them as you complete each phase. This ensures you don't lose track of where you
are in long-running tasks.

Example todo structure:

1. Fetch and analyze issue
2. Make triage decision
3. Prepare for implementation (assign, label, comment)
4. Run /autotask for implementation
5. Run /address-pr-comments for bot feedback
6. Finalize and link PR to issue

Mark each todo as in_progress when starting, completed when done. This creates
transparency about progress and ensures completion.

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
