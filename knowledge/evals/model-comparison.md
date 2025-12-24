# Model Comparison Framework

## What This Is

A fast evaluation workflow for when new models drop. Answers: "Is this model better for
our use case?"

## When To Use

- New model release from any provider (Claude 4, GPT-5, Gemini 2, etc.)
- Considering swapping a model in the routing config
- Evaluating a model for a specific category (reasoning, creative, coding)

## The Flow

```
New Model Drops
      ↓
Run Arena-Hard subset (50-100 questions)
      ↓
Compare to current production model
      ↓
Category breakdown: Where does it win/lose?
      ↓
Decision: Adopt, reject, or use for specific categories
```

## Quick Comparison Mode

For rapid evaluation, run a representative subset:

| Category   | Questions | Purpose                      |
| ---------- | --------- | ---------------------------- |
| Reasoning  | 20        | Logic, math, multi-step      |
| Creative   | 15        | Writing, open-ended          |
| Real-world | 30        | Practical user queries       |
| Edge cases | 10        | Stress tests, unusual inputs |
| **Total**  | **75**    | ~15 minutes, ~$3 cost        |

## Full Comparison Mode

Run the complete Arena-Hard 750 questions for production-grade decisions.

## Output Format

Comparison generates a report:

```
Model Comparison: Claude 3.5 Sonnet vs Claude 4 Opus
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Overall:    Claude 4 +7.3%  [████████████░░░░░░] 67% win rate

By Category:
  Reasoning:    Claude 4 +12%  [██████████████░░░░] 74% win
  Creative:     Claude 4 +4%   [█████████░░░░░░░░░] 58% win
  Real-world:   Claude 4 +6%   [██████████░░░░░░░░] 62% win
  Edge cases:   Tie            [████████░░░░░░░░░░] 51% win

Cost:
  Claude 3.5: $0.003/1K input, $0.015/1K output
  Claude 4:   $0.015/1K input, $0.075/1K output
  Delta:      5x cost increase

Latency (p50):
  Claude 3.5: 1.2s
  Claude 4:   2.8s
  Delta:      +133%

Recommendation: Use Claude 4 for reasoning-heavy queries, keep Claude 3.5
for general use until cost/latency improve.
```

## Integration Points

### With Concierge Routing

Model comparison results inform routing decisions:

- If new model wins on reasoning but costs 5x more → use only for complex queries
- If new model wins everywhere → migrate routing config
- If new model loses on latency → consider for async/batch only

### With Braintrust

Each comparison run creates an experiment with:

- Side-by-side response comparison
- Win/loss/tie per question
- Category aggregation
- Cost and latency metrics

## Access Pattern

All models via OpenRouter:

```
comparison.eval.ts
      ↓
OpenRouter API (model A) → Response A
OpenRouter API (model B) → Response B
      ↓
LLM-as-judge comparison
      ↓
Braintrust experiment
```

## Implementation

The model comparison script is implemented at `/scripts/compare-models.ts`.

Usage:

```bash
pnpm eval:compare-models <model-a> <model-b>
```

Example:

```bash
pnpm eval:compare-models anthropic/claude-3.5-sonnet anthropic/claude-opus-4.5
```

The script:

- Runs all 25 competitive queries against both models in parallel
- Uses Claude 3.5 Sonnet as the LLM-as-judge
- Generates a comparison report with win rates by category
- Stores detailed results in Braintrust for analysis

## Trigger Options

1. **Manual** - Run when new model is announced
2. **Automated** - Monitor model provider release feeds, trigger on new versions
3. **Scheduled** - Weekly check of latest model versions vs current production

## Decision Criteria

When to adopt a new model:

| Criterion              | Threshold            |
| ---------------------- | -------------------- |
| Overall improvement    | +5% win rate         |
| No category regression | >-3% in any category |
| Cost acceptable        | Within 2x current    |
| Latency acceptable     | Within 1.5x current  |

These are starting points. Adjust based on experience.
