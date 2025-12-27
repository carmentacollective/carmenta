# Prompt Engineering

This directory contains prompts that Carmenta uses. These are LLM-to-LLM communications:
prompts written for an LLM to execute.

## Required Reading

@.cursor/rules/prompt-engineering.mdc

## Core Principles

Prompts in this directory teach behavior through patterns. What you show is what the LLM
will do.

**Positive framing over negation.** "Write in flowing prose" not "Don't use bullet
points." LLMs must construct then negate negative patterns, creating unreliable
execution.

**Goals over process.** Describe outcomes, not step-by-step procedures. The executing
model is capable and current. Trust it.

**Examples teach patterns.** Show 3-5 consistent examples of correct behavior. Never
show anti-patterns, even labeled as "wrong."

**Calibrated emphasis.** Reserve CRITICAL, MUST, NEVER for actual consequences. Overuse
trains the LLM to ignore them.

## Code Review Requirement

All changes to files in this directory should be reviewed by the prompt-engineer agent
before committing:

```
/ai-coding-config:prompt-engineer
```

This agent checks for pattern reinforcement issues, negative framing, over-prescription,
and other prompt engineering anti-patterns that erode LLM performance.

## What to Check

Before committing prompt changes:

- Are examples consistent in structure?
- Is framing positive (do X) rather than negative (avoid Y)?
- Does the prompt describe goals or micromanage steps?
- Is strong language reserved for genuine consequences?
- Would a different LLM interpret this the same way?

## Related Files

- `knowledge/users-should-feel.md` - Emotional experience to create
- `.cursor/rules/user-facing-language.mdc` - Voice and anti-AI-cliché guidance
- `.cursor/rules/personalities/carmenta.mdc` - Carmenta's identity
