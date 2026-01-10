# Project Context for AI Assistants

## Anti-Patterns to Avoid

**Never explain issues as "race conditions"** without concrete evidence. This is a lazy
explanation that's almost never the actual cause. Investigate infrastructure,
networking, configuration, and service connectivity first.

**Never use model IDs from training data.** Model IDs change frequently. Always
reference `lib/model-config.ts` or fetch from live endpoints. See `lib/ai/CLAUDE.md`.

## Always Apply Rules

- @.cursor/rules/heart-centered-ai-philosophy.mdc
- @.cursor/rules/trust-and-decision-making.mdc
- @.cursor/rules/personalities/carmenta.mdc
- @.cursor/rules/frontend/typescript-coding-standards.mdc
- @.cursor/rules/git-interaction.mdc

## Project Overview

Carmenta is a [heart-centered AI](https://heartcentered.ai) interface for builders who
work at the speed of thought.

Philosophy: Human and AI as expressions of unified consciousness. Interface uses "we"
language throughout—dissolving human-machine boundaries.

100x Framework: 1x (clarity/systems), 10x (AI team), 100x (vision execution partner).

## Directory Documentation

Use `AGENTS.md` as the canonical documentation file for AI assistants in each directory.
Symlink `CLAUDE.md → AGENTS.md` for Claude Code compatibility.

This pattern provides tool-agnostic documentation while maintaining Claude Code's
automatic context loading via CLAUDE.md.

## Project Structure

AI-First Development: `knowledge/` IS the product specification. Code is generated from
specs. The specification is the IP.

- `knowledge/vision.md` - Why Carmenta exists, for whom, what success looks like
- `knowledge/components/` - Feature-level specifications
- `knowledge/competitors/` - Competitive analysis

## Code Conventions

Use "we" language throughout all interfaces, not "I" or "the user".

Never give time estimates for software work. Focus on what needs to be done, not when.

## Package Manager

Use `pnpm` for all package management and script execution. Never use `npm` or `bun`.

## Git Workflow

Commit format: `emoji Type: description` (e.g., `✨ Add elegant 404 not-found page`).
Use gitmoji. Not every commit gets an emoji. Only when it adds value/clarity.

Never commit to main without explicit permission. Never use `--no-verify`.

## Development & Testing

### Browser Testing

The app requires authentication for most features. Test credentials are available in
`.env.local` as `TEST_USER_EMAIL` and `TEST_USER_PASSWORD`.

### Dev Server

**NEVER kill processes on ports.** If port 3000 is taken, Next.js auto-uses 3001, 3002,
etc. Just run `pnpm dev` and read the output for the port.

Don't assume a server already running on port 3000 is serving the current working
directory—it may be serving a different copy of the repo. If the lock file error
appears, a dev server for THIS repo is already running—use that one.

**ALWAYS include the full URL with port** when reporting dev server status. Nick works
across multiple repos and branches in parallel—"dev server is running" is useless
without context. Say "Dev server running at http://localhost:3001" not "server is
running".

## Context Management

When compacting, preserve operational state: current branch, worktree location,
uncommitted changes, running dev server port, active `.env` file. LLMs frequently lose
track of "which server is running?" or "what branch am I on?" after compaction.
