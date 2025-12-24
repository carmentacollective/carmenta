# Evaluation System

## What This Is

A quality observability system that proves Carmenta gives the best answers and ensures
quality only goes up.

## Core Question

Does Carmenta give the best answer?

Not which model. Not which routing decision. The end-user question: did they get a great
answer?

## Components

| Component              | Purpose                                | File                     |
| ---------------------- | -------------------------------------- | ------------------------ |
| **Baseline Benchmark** | Measure absolute answer quality        | `baseline-benchmark.md`  |
| **Competitive Matrix** | Compare to ChatGPT, Claude, Perplexity | `../components/evals.md` |
| **Model Comparison**   | A/B test new models when they drop     | `model-comparison.md`    |
| **Automation**         | Nightly CI, regression detection       | `automation.md`          |
| **Gap Analyzer**       | AI finds weaknesses, proposes fixes    | `gap-analyzer.md`        |

## The Loop

```
Nightly Evals → Braintrust Data → AI Gap Analysis → Improvements → Better Scores
     ↑                                                                    │
     └────────────────────────────────────────────────────────────────────┘
```

## Key Principle

All evaluations run via OpenRouter. No separate provider API keys needed.

## Sources

- [Arena-Hard-Auto](https://github.com/lmarena/arena-hard-auto) - Benchmark source
- [LMArena Leaderboard](https://lmarena.ai/leaderboard) - Human preference data
- [Braintrust CI/CD Best Practices](https://www.braintrust.dev/articles/best-ai-evals-tools-cicd-2025)
- [LiveBench](https://livebench.ai/) - Contamination-resistant monthly refresh
