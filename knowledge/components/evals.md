# Evals: Quality Measurement & Competitive Intelligence

## What This Is

A systematic approach to measuring, tracking, and improving the quality of Carmenta's
responses—and comparing that quality against competitors.

Three interconnected capabilities:

1. **Integration Testing** - Validate system behavior (routing, reasoning, tools)
2. **Quality Scoring** - Measure how good responses actually are
3. **Competitive Benchmarking** - Compare against ChatGPT, Perplexity, Claude.ai

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Evals Runner                                               │
│  ┌──────────────┐                                           │
│  │ Test Queries │──▶ Carmenta API ──▶ Responses             │
│  └──────────────┘                                           │
│         │                              │                    │
│         │                              ▼                    │
│         │                    ┌─────────────────┐            │
│         │                    │ LLM-as-Judge    │            │
│         │                    │ (correctness,   │            │
│         │                    │  helpfulness,   │            │
│         │                    │  relevance)     │            │
│         │                    └─────────────────┘            │
│         │                              │                    │
│         ▼                              ▼                    │
│    ┌──────────┐                ┌─────────────┐              │
│    │ Results  │                │ Quality     │              │
│    │ (JSON)   │                │ Scores      │              │
│    └──────────┘                └─────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## Scripts

```
scripts/evals/
├── test-queries.ts           # Test query definitions
├── evaluators.ts             # LLM-as-judge scoring
├── run-integration-tests.ts  # Integration test runner
└── run-quality-evals.ts      # Quality eval runner (optional)
```

## Integration Testing

**Goal:** Validate system behavior with 22 test queries.

Categories:

- **Routing** - Model selection, temperature, reasoning
- **Tools** - Weather, search, research invocation
- **Reasoning** - When enabled/disabled
- **Overrides** - User preference handling
- **Edge cases** - Unicode, long context, etc.

Run tests:

```bash
bun scripts/evals/run-integration-tests.ts --fast  # Skip slow tests
bun scripts/evals/run-integration-tests.ts         # All tests
bun scripts/evals/run-integration-tests.ts --test=route-simple-factual  # Single test
```

Requires `TEST_USER_TOKEN` in `.env.local` (long-lived Clerk JWT).

## Quality Scoring

**Goal:** Measure response quality with LLM-as-judge.

Three evaluators:

| Evaluator   | Measures          | Scores                                      |
| ----------- | ----------------- | ------------------------------------------- |
| Correctness | Factual accuracy  | correct, partially_correct, incorrect       |
| Helpfulness | User value        | very_helpful, somewhat_helpful, not_helpful |
| Relevance   | On-topic response | relevant, partially_relevant, irrelevant    |

Each uses Claude as judge with specific prompts. Overall score = average of three.

## Competitive Benchmarking

**Goal:** Compare Carmenta against competitors on same queries.

Competitors:

- **ChatGPT** (OpenAI API)
- **Perplexity** (Perplexity API)
- **Claude.ai** (Anthropic API, raw—no orchestration)

Same evaluators score all responses → comparison matrix.

## Test Query Design Principles

**Coverage:** Test each major capability

- Model routing (Haiku/Sonnet/Opus selection)
- Temperature selection (creative vs precise)
- Reasoning (when enabled, what level)
- Tool invocation (weather, search, research)

**Realism:** Queries should reflect actual user behavior

**Edge cases:** Include adversarial and tricky queries as we discover them

**Ground truth:** Where possible, include expected answers for factual queries

## Evaluator Design Principles

**Specific criteria:** Each evaluator measures one thing

**Clear rubrics:** Judge prompt explains exactly what "good" means

**Calibration:** Test evaluators against human judgment on sample set

**Different judge:** Use a different model as judge than the one generating

## Tracking Results Over Time

Results are stored as JSON in `scripts/evals/results/` (gitignored). Format:

```json
{
  "timestamp": "2025-12-06T19:04:43.369Z",
  "summary": {
    "evaluated": 1,
    "avgOverall": 1
  },
  "results": [
    {
      "id": "route-simple-factual",
      "category": "routing",
      "query": "What year did World War 2 end?",
      "scores": { ... }
    }
  ]
}
```

For persistent tracking across time, integrate with an evals platform (Braintrust,
LangSmith, Arize, etc.) or build a simple dashboard from the JSON files.

## Open Questions

1. **Judge model:** GPT-4o? Claude Opus? Panel of multiple judges?
2. **How often to run competitor comparison?** Weekly? Monthly?
3. **Public results:** Publish the comparison matrix? Where?
4. **CI integration:** Run evals on every PR? Just before release?
5. **Evals platform:** Which vendor for persistent tracking?
