# Evals

Braintrust-based evaluations for Carmenta's AI capabilities.

See `README.md` for full documentation on running evals.

@.cursor/rules/prompt-engineering.mdc

## Quick Reference

```bash
pnpm eval:nightly      # Main eval suite
pnpm eval:routing      # Concierge routing decisions
pnpm eval:competitive  # End-to-end benchmark
```

## Directory Structure

Each eval suite has:

- `eval.ts` - Braintrust entry point (run via `braintrust eval`)
- `cases.ts` - Test case definitions
- `scorer.ts` - Scoring logic
- `runner.ts` - Model execution (if needed)

## Why Knip Flags These as Unused

Static analysis tools like knip don't understand braintrust's entry point pattern. These
files ARE used - they're invoked via `pnpm braintrust eval <path>`. The eval.ts files
are entry points, and they import from cases.ts, scorer.ts, etc.

**Do not delete eval files based on knip output.**

## When Editing Prompts

Invoke the `writing-for-llms` skill before editing prompts in eval runners.
