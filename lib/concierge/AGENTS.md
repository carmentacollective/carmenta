# Concierge - Intelligent Model Routing

Routes incoming requests to the optimal model, temperature, reasoning level, and
generates connection titles. Uses Haiku 4.5 for fast inference (~200ms).

@.cursor/rules/prompt-engineering.mdc

**Before editing `prompt.ts`, invoke the `writing-for-llms` skill.**

## Key Files

- `prompt.ts` - System prompt with rubric injection. Changes here affect all routing.
- `types.ts` - ConciergeResult interface, allowed models whitelist, token budgets
- `index.ts` - Runtime: runs concierge, parses JSON response, validates models

## Constraints

**Model whitelist is enforced.** If the prompt asks for a model not in ALLOWED_MODELS,
it falls back to defaults. Update both the rubric (`knowledge/model-rubric.md`) and the
whitelist in `types.ts` when adding models.

**Title generation is now integrated.** The concierge generates titles in the same call
as model selection. No separate title generator call.

**Output must be valid JSON.** The prompt explicitly requests JSON-only output. Avoid
examples that might encourage markdown wrapping.
