---
description: Triage and address PR comments from code review bots intelligently
argument-hint: [pr-number] [--ship]
model: sonnet
---

# Address PR Comments

<objective>
Get a PR to "ready to merge" by triaging bot feedback. You have context bots lack - use
judgment. The goal is a mergeable PR, not zero comments.
</objective>

<modes>
Default: Address all valid, in-scope feedback.
--ship: Blockers only - security vulnerabilities and bugs that would cause runtime failures.
</modes>

<outcomes>
FIX: Valid feedback, in scope for this PR. Make the change.

DEFER: Valid feedback, out of scope. Collect these. After addressing everything else,
use AskUserQuestion to ask whether to create GitHub issues (label: `from-review`).

DECLINE: Feedback that's wrong or conflicts with project standards. Give appropriate
reaction/response so bots learn. </outcomes>

<scope>
In scope: Files touched by this PR, immediate vicinity, security issues anywhere.

Out of scope: Untouched files, codebase-wide changes, feature additions, architectural
shifts. These are DEFER candidates if valid. </scope>

<standards>
Read @rules/code-review-standards.mdc for what this project prioritizes and what it
explicitly does not.
</standards>

<human-comments>
Human reviewer comments need user direction. Use AskUserQuestion.
</human-comments>

<workflow>
Run autonomously. Wait for review bots with `gh pr checks --watch`. Push fixes, wait
again, repeat until stable. Use AskUserQuestion when it would be faster than guessing.

Give reactions/responses to bot comments so they learn from the feedback.

Celebrate when the PR is ready to merge. </workflow>
