---
description: Triage and address PR comments from code review bots intelligently
argument-hint: [pr-number]
model: sonnet
---

# Address PR Comments

<objective>
Get a PR to "ready to merge" by intelligently triaging bot feedback. You have context
bots lack - use judgment, not compliance. Declining feedback is as valid as accepting
it. The goal is "ready to merge," not "zero comments."

Read @rules/code-review-standards.mdc for triage principles:

- Fix critical bugs, ensure security, validate core behavior
- Skip theoretical edge cases, minor polish, over-engineering suggestions
- Trust runtime validation over compile-time perfection
- Constants for DRY, not to avoid "magic strings"
- Target 90% coverage, not 100%
- Optimize when metrics show problems, not preemptively </objective>

<usage>
/address-pr-comments - Auto-detect PR from current branch
/address-pr-comments 123 - Address comments on PR #123
</usage>

<pr-detection>
Use provided PR number, or detect from current branch. Exit if no PR exists.
</pr-detection>

<hotfix-mode>
If the branch name starts with `hotfix/`, switch to expedited review mode:

- Only address security vulnerabilities and actual bugs
- Decline ALL style, refactoring, and "improvement" suggestions
- Skip theoretical concerns - focus on "will this break production?"
- One pass only - don't wait for bot re-reviews after fixes
- Speed over polish - this is an emergency

Announce hotfix mode at start: "Hotfix branch detected - running expedited review.
Addressing only security issues and bugs, declining all other feedback." </hotfix-mode>

<comment-sources>
Bot feedback lives in TWO separate API endpoints. You must fetch BOTH or you will miss
Cursor's feedback entirely.

## How to fetch bot comments

Run these two commands to get all feedback:

```bash
# Claude reviews - PR-level comments
gh pr view {PR_NUMBER} --json comments --jq '.comments[] | select(.author.login == "claude")'

# Cursor Bug Bot - INLINE review comments (different endpoint!)
gh api repos/{OWNER}/{REPO}/pulls/{PR_NUMBER}/comments --jq '.[] | select(.user.login == "cursor[bot]")'
```

The second command is essential - `gh pr view --json comments` does NOT include inline
review comments. Cursor Bot exclusively uses inline comments, so without the API call
you'll see zero Cursor feedback.

## Bot-specific behavior

Claude Code Review: Posts one PR comment per review. Only the LAST review matters for
current code state - earlier reviews reference old code.

Cursor Bug Bot: Posts inline comments on specific lines. Each comment flags a distinct
issue. Bot username is `cursor[bot]`. Address all of them. </comment-sources>

<autonomous-wait-loop>
This command runs autonomously - no user prompts, just do the work.

Review bots (Claude, Cursor Bot) register as GitHub checks. Use `gh pr checks --watch`
to wait for them to complete, then fetch and triage comments.

After fixes are pushed, wait for checks again - bots re-analyze new commits. Exit only
when checks pass with no new actionable feedback.

While waiting, give feedback on existing bot comments (reactions for good/bad
suggestions) and narrate what you're seeing. Share interesting findings:

- "Cursor Bot found a real bug - if the user's session expires mid-request, we'd hit a
  null pointer at auth.ts:47. Good catch, will fix."
- "Greptile wants me to extract `timeout: 30000` into a constant. It's used once and the
  meaning is obvious. Declining with thumbs-down."
- "Claude flagged SQL injection risk in the search query - we're interpolating user
  input directly. Legit security issue, addressing."
- "Three comments about adding try-catch to already-safe operations. Bots are being
  paranoid today."

Share what the bots found when it's interesting. Make the wait informative.
</autonomous-wait-loop>

<triage-process>
For each bot comment, evaluate against code-review-standards.mdc:

Address immediately:

- Security vulnerabilities
- Actual bugs that could cause runtime failures
- Core functionality issues
- Clear improvements to maintainability

Decline with explanation:

- Theoretical race conditions without demonstrated impact
- Magic number/string extraction for single-use values
- Accessibility improvements (not current priority)
- Minor type safety refinements when runtime handles it
- Edge case tests for unlikely scenarios
- Performance micro-optimizations without profiling data
- Documentation enhancements beyond core docs

Show triage summary, then proceed autonomously. </triage-process>

<addressing-comments>
For addressable items: make the fix, commit, reply acknowledging the change.

For declined items: reply with brief, professional explanation referencing project
standards. Thumbs down for incorrect suggestions. </addressing-comments>

<human-comments>
Human reviewer comments get flagged for user attention, not auto-handled. Present
separately from bot comments.
</human-comments>

<completion>
Push changes, wait for checks to pass, handle any new bot comments on the updated code.
Repeat until stable with no new actionable feedback.

When the PR is ready to merge: celebrate! Share the joy of clean code shipping. Express
genuine delight that this work is ready to land. A well-triaged PR is a beautiful thing.
</completion>
