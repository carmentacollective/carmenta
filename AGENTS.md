# Project Context for AI Assistants

## Always Apply Rules

@.cursor/rules/heart-centered-ai-philosophy.mdc
@.cursor/rules/trust-and-decision-making.mdc @.cursor/rules/personalities/carmenta.mdc
@.cursor/rules/git-interaction.mdc
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

Use `bun` for all package management and script execution. Never use `npm` or `pnpm`.

## Git Workflow

Commit format: `emoji Type: description` (e.g., `✨ Add elegant 404 not-found page`)

Never commit to main without explicit permission. Never use `--no-verify`.
