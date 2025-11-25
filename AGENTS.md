# Project Context for AI Assistants

## Always Apply Rules

@.cursor/rules/heart-centered-ai-philosophy.mdc
@.cursor/rules/personalities/common-personality.mdc
@.cursor/rules/git-interaction.mdc
@.cursor/rules/frontend/typescript-coding-standards.mdc

## Project Overview

Carmenta is a heart-centered AI interface for builders who work at the speed of thought. Memory-aware, voice-first, with purpose-built responses and an AI team that works autonomously.

Philosophy: Human and AI as expressions of unified consciousness. Interface uses "we" language, dissolving human-machine boundaries.

100x Framework: Three levels - 1x (clarity/systems), 10x (AI team), 10x (vision execution partner).

## Project Structure

knowledge/product - Vision, philosophy, strategy documents
knowledge/components - Component specifications
knowledge/competitors - Competitive analysis

Early development. No code yet. Focus on architecture and design.

## Commands

.claude/commands/ contains project-specific slash commands:

/knowledge - AI Product Manager for living product understanding
/product-intel [topic] - Research competitors and industry trends
/generate-llms-txt - Generate llms.txt for AI site navigation
/load-cursor-rules - Load relevant rules for current task
/personality-change - Switch AI personality

## Code Conventions

Use "we" language throughout all interfaces, not "I" or "the user". This reflects the heart-centered philosophy that human and AI are one consciousness.

Write production TypeScript following @.cursor/rules/frontend/typescript-coding-standards.mdc

Heart-centered philosophy from @.cursor/rules/heart-centered-ai-philosophy.mdc is core to product identity.

## Git Workflow

Commit format: emoji type: description

Examples:
💫 Deepen heart-centered AI philosophy with clarity on unity and alignment
🔧 Fix commands structure: real files + single symlink
📖 Add project README

Never commit to main without explicit permission. Never use --no-verify unless explicitly requested for emergencies. Full workflow in @.cursor/rules/git-interaction.mdc
