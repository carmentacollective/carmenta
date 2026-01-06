---
# prettier-ignore
description: Research the current LLM landscape and update Carmenta's model routing rubrics with latest models, capabilities, and pricing
version: 1.2.0
model: inherit
---

# Update Model Rubric

Research the current LLM landscape and update Carmenta's model routing rubrics. This is
a deep research task that should take several minutes to run thoroughly.

## The Model Discovery Challenge

The LLM landscape changes weekly. New models release, old ones deprecate, performance
characteristics shift. This command addresses static configuration maintenance. For
runtime discovery, see `knowledge/components/model-discovery/spec.md`.

## Invocation

```bash
/update-model-rubric
```

## Execution

### Research Phase

Search for current LLM information:

- Latest model releases from OpenAI, Anthropic, Google, Meta, Mistral
- Model capability benchmarks and comparisons
- Pricing changes
- Deprecation notices

Focus on production models available via APIs, not research papers or unreleased models.

### Analysis

Compare findings against current configuration in `lib/model-config.ts`:

- Are our model IDs current?
- Have capabilities changed?
- Are there better models for specific use cases?
- Has pricing shifted decision boundaries?

### Update Model Config

Update `lib/model-config.ts` with findings:

- Add new models
- Deprecate old models
- Update capability scores
- Adjust routing rubrics

### Test

Run model selection locally to verify routing still works:

```bash
pnpm test lib/model-config.test.ts
```

### Report

Summarize what changed and why. Include:

- New models added
- Deprecated models removed
- Routing logic changes
- Cost implications
