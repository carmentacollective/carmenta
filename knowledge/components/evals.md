# Evals: Quality Measurement & Competitive Intelligence

## What This Is

A systematic approach to measuring, tracking, and improving the quality of Carmenta's
responses—and comparing that quality against competitors.

Four interconnected capabilities:

1. **LLM Routing Tests** - Validate Concierge model/temperature/reasoning selection
2. **File Attachment Tests** - Validate file handling across models
3. **Quality Scoring** - Measure how good responses actually are
4. **Competitive Benchmarking** - Compare against ChatGPT, Perplexity, Claude.ai

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
├── llm-routing-queries.ts       # Test queries for model routing
├── quality-evaluators.ts        # LLM-as-judge scoring
├── run-llm-routing-tests.ts     # Model routing test runner
├── file-attachment-queries.ts   # Test queries for file handling
├── run-file-attachment-tests.ts # File attachment test runner
├── fixtures/                    # Sample files for attachment tests
│   ├── sample.pdf
│   ├── sample.png
│   ├── sample.mp3
│   └── sample.txt
└── results/                     # Test output (gitignored)
```

## LLM Routing Tests

**Goal:** Validate that the Concierge routes queries to appropriate models.

Categories:

- **Routing** - Model selection based on query complexity
- **Tools** - Search, research invocation
- **Reasoning** - When enabled/disabled and at what level
- **Overrides** - User preference handling
- **Edge cases** - Unicode, long context, etc.

Run tests:

```bash
bun scripts/evals/run-llm-routing-tests.ts --fast  # Skip slow tests
bun scripts/evals/run-llm-routing-tests.ts         # All tests
bun scripts/evals/run-llm-routing-tests.ts --test=route-simple-factual  # Single test
```

Requires `TEST_USER_TOKEN` in `.env.local` (long-lived Clerk JWT).

## File Attachment Tests

**Goal:** Smoke tests for file handling across different models.

What we test:

- **Model Routing** - Audio → Gemini (only option), PDF/Images → Claude (preferred)
- **File Processing** - LLM can actually read/describe the file content
- **Error Handling** - Graceful failures for unsupported types

Run tests:

```bash
bun scripts/evals/run-file-attachment-tests.ts           # All file tests
bun scripts/evals/run-file-attachment-tests.ts --type=image  # Just images
bun scripts/evals/run-file-attachment-tests.ts --type=audio  # Just audio
```

These tests require actual files in `scripts/evals/fixtures/` and make real API calls.

## Quality Scoring

**Goal:** Measure response quality with LLM-as-judge.

Three evaluators:

| Evaluator   | Measures          | Scores                                      |
| ----------- | ----------------- | ------------------------------------------- |
| Correctness | Factual accuracy  | correct, partially_correct, incorrect       |
| Helpfulness | User value        | very_helpful, somewhat_helpful, not_helpful |
| Relevance   | On-topic response | relevant, partially_relevant, irrelevant    |

Each uses GPT-5.1 as judge with specific prompts. Overall score = average of three.

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
- Tool invocation (search, research, comparison)
- File attachment handling

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
