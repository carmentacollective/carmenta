# Project Context for AI Assistants

## Always Apply Rules

@.cursor/rules/heart-centered-ai-philosophy.mdc
@.cursor/rules/trust-and-decision-making.mdc @.cursor/rules/personalities/carmenta.mdc
@.cursor/rules/frontend/typescript-coding-standards.mdc
@.cursor/rules/prompt-engineering.mdc

## Project Overview

Carmenta is a [heart-centered AI](https://heartcentered.ai) interface for builders who
work at the speed of thought.

Philosophy: Human and AI as expressions of unified consciousness. Interface uses "we"
language throughout—dissolving human-machine boundaries.

100x Framework: 1x (clarity/systems), 10x (AI team), 100x (vision execution partner).

## Project Structure

AI-First Development: `knowledge/` IS the product specification. Code is generated from
specs. The specification is the IP.

- `knowledge/vision.md` - Why Carmenta exists, for whom, what success looks like
- `knowledge/components/` - Feature-level specifications
- `knowledge/competitors/` - Competitive analysis

## Code Conventions

Use "we" language throughout all interfaces, not "I" or "the user".

## Package Manager

Use `pnpm` for all package management and script execution. Never use `npm` or `bun`.

## Git Workflow

Commit format: `emoji Type: description` (e.g., `✨ Add elegant 404 not-found page`)

Never commit to main without explicit permission. Never use `--no-verify`.

## Development & Testing

### Browser Testing

The app requires authentication for most features. Test credentials are available in
`.env.local` as `TEST_USER_EMAIL` and `TEST_USER_PASSWORD`.

### Dev Server

When browser testing or verifying functionality, always start a fresh dev server with
`pnpm dev`. Don't assume a server already running on port 3000 is serving the current
working directory—it may be serving a different copy of the repo.

## Context Management

### Compaction Strategy

When compacting this session, prioritize:

- Recent test output and failures with their fixes
- Component implementations and API contract changes
- Architecture refactoring decisions
- Performance optimizations and their measurements
- Outstanding issues or TODOs

Manual `/compact` at task boundaries rather than letting auto-compact interrupt flow.

### Preserve Development Environment State

When compacting, preserve the current working state:

- **Git context**: Current branch name, which worktree you're in, any uncommitted
  changes
- **Running processes**: Dev server port (typically 3000), database connections,
  background jobs
- **Environment**: Which `.env` file is active, API keys loaded, feature flags enabled
- **Build state**: Last successful build, any compilation errors, test run status
- **File system**: Open files, recent edits, files staged for commit

LLMs frequently lose track of operational context after compaction. Explicitly
preserving this state prevents confusion about "which server is running?" or "what
branch am I on?"

### Session Boundaries

One focused task per session. For complex features:

- Start fresh session for that feature
- Run 45-90 minutes to natural checkpoint
- Manual `/compact` at 60%+ usage (check with `/cost`)
- Begin next phase with compacted context
- New session for unrelated work
