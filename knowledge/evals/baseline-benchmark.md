# Baseline Quality Benchmark

## What This Is

A systematic measurement of absolute answer quality using established benchmarks. This
answers: "How good are Carmenta's answers?" independent of competitive comparison.

## Why It Matters

- **Quality tracking** - Detect regressions before users do
- **Model comparison** - Objectively evaluate new models when they drop
- **Improvement signal** - Measure whether changes actually make things better
- **Baseline for competitive** - Same questions used in head-to-head comparisons

## Benchmark Selection: Arena-Hard v2.0

Arena-Hard v2.0 (April 2025) is the recommended benchmark for Carmenta's quality
baseline.

### Why Arena-Hard

- **750 real user questions** from Chatbot Arena (500 real-world + 250 creative)
- **87.4% separability** - Clearly distinguishes model quality levels
- **89.1% human preference agreement** - Scores correlate with what users actually
  prefer
- **~$25 per run** - Affordable for nightly/weekly runs
- **Open source** - Full control, no vendor lock-in
- **Used by LMArena** - Industry standard leaderboard

### Question Categories

| Category         | Count | Focus                               |
| ---------------- | ----- | ----------------------------------- |
| Real-world tasks | 500   | Practical queries from actual users |
| Creative writing | 250   | Open-ended, creative responses      |

### Scoring Method

Arena-Hard uses LLM-as-judge with pairwise comparison against a reference model
(typically GPT-4o). Each response gets:

- Win/Loss/Tie against reference
- Numeric score (Elo-style or percentage)
- Category breakdown

## Alternative: LiveBench

LiveBench offers contamination-resistant evaluation with monthly question refresh.
Consider adding as a secondary benchmark if training data contamination becomes a
concern.

## Implementation

### Access Pattern

All models accessed via OpenRouter. No separate provider API keys needed.

```
Carmenta → OpenRouter → Model Response → LLM-as-judge → Score
```

### Integration with Braintrust

Each benchmark run creates an experiment in Braintrust with:

- Individual question scores
- Category aggregations
- Comparison to previous runs
- Metadata (commit SHA, timestamp, model versions)

### Scoring Dimensions

For each response, capture:

| Dimension         | What It Measures                      |
| ----------------- | ------------------------------------- |
| **Accuracy**      | Factual correctness, evidence quality |
| **Completeness**  | Coverage of relevant angles           |
| **Clarity**       | Explanation quality, structure        |
| **Actionability** | User can act on the information       |
| **Overall**       | Composite score                       |

## Baseline Tracking

Current baseline metrics (updated by automation):

| Metric             | Value | Date | Commit |
| ------------------ | ----- | ---- | ------ |
| Arena-Hard Overall | TBD   | -    | -      |
| Reasoning          | TBD   | -    | -      |
| Creative           | TBD   | -    | -      |
| Real-world         | TBD   | -    | -      |

### Regression Thresholds

| Metric       | Alert Threshold   |
| ------------ | ----------------- |
| Overall      | -3% from baseline |
| Any category | -5% from baseline |

## Sources

- [Arena-Hard-Auto](https://github.com/lmarena/arena-hard-auto) - Benchmark source
- [LMArena Leaderboard](https://lmarena.ai/leaderboard) - Human preference data
- [LiveBench](https://livebench.ai/) - Contamination-resistant monthly refresh
