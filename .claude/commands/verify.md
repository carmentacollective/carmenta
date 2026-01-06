---
# prettier-ignore
description: Verify functionality works from an end-user perspective - find issues, fix them, re-verify until working or stuck
argument-hint: [what to verify]
version: 1.0.0
model: inherit
---

# Verify

Verify that functionality works correctly from an end-user perspective. Find issues, fix
them, re-verify until working or stuck.

## What to Verify

$ARGUMENTS

## Context

Current directory: !`pwd` Git branch:
!`git branch --show-current 2>/dev/null || echo "not a git repo"` Dev server:
!`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "not running"`

## Before Starting

Set up the environment:

If on main branch, create a worktree for any fixes needed. If already on a feature
branch or worktree, work there.

If dev server is not running, start it and wait for it to be ready.

Create a working directory for this verification session: /tmp/verify-[timestamp]/

## Verification

Spawn the browser-verifier agent to evaluate the functionality.

The agent will use whatever browser automation is available (Playwright, Puppeteer,
etc.) to interact with the app as a real user would. It evaluates across five
dimensions:

- Works: Does it function correctly?
- Looks: Visual correctness, alignment, consistency
- Clear: Would a user understand what's happening?
- Polished: Any jank, weird states, rough edges?
- Fast: Does it feel responsive?

The agent saves screenshots and findings to the /tmp/verify-[timestamp]/ directory.

## Fix Loop

When findings come back:

Auto-fix without asking:

- Works = broken (functionality objectively broken)
- Looks = broken (missing element, broken layout, clearly wrong)

Ask the human first:

- Looks = warning (something seems off but might be intentional)
- Clear = warning (potentially confusing)
- Polished = warning (rough edge, jank)
- Fast = slow (performance concern)

After making fixes, spawn browser-verifier again to re-verify. Loop until verified or
stuck after 3 attempts on the same issue.

## Done

Report what was verified, what was fixed, what was deferred, and final state. Include
paths to screenshots in /tmp/ if the human wants to review.
