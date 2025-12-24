# Carmenta Nightly Eval Suite

Comprehensive nightly evaluation suite that combines routing and competitive tests.

## Overview

The nightly eval suite runs all test cases from:

- **Routing tests** (`evals/routing/cases.ts`) - Tests Concierge routing decisions
  (model selection, temperature, reasoning, tool invocation)
- **Competitive tests** (`evals/competitive/queries.ts`) - Tests Carmenta's competitive
  capabilities across reasoning, web-search, tools, edge-cases, and real-world scenarios

This provides a single comprehensive suite for nightly CI/CD runs.

## Usage

```bash
# Run the nightly eval suite
pnpm braintrust eval evals/nightly/eval.ts

# Run with specific filters (tags)
pnpm braintrust eval evals/nightly/eval.ts --filter routing
pnpm braintrust eval evals/nightly/eval.ts --filter competitive
pnpm braintrust eval evals/nightly/eval.ts --filter reasoning
```

## Requirements

- `BRAINTRUST_API_KEY` in `.env.local`
- `TEST_USER_TOKEN` in `.env.local` (Clerk JWT for API auth)
- Carmenta server running at `http://localhost:3000` (or set `BASE_URL` env var)

## Test Coverage

### Routing Tests (~20 tests)

- Model routing (haiku/sonnet/opus/grok)
- Temperature selection
- Reasoning enablement
- Tool invocation (webSearch, compareOptions, deepResearch)
- User hints and sensitivity routing
- Override handling (model, temperature, reasoning)
- Edge cases

### Competitive Tests (25 tests)

- **Reasoning** (5 queries): Logic puzzles, probability, systems thinking, code
  analysis, constraint satisfaction
- **Web Search** (5 queries): Current events, pricing, research, product launches,
  emerging trends
- **Tools** (5 queries): Framework comparison, deep research, decision matrices,
  fact-checking, synthesis
- **Edge Cases** (5 queries): Loaded questions, ethical tradeoffs, misinformation,
  ambiguity, boundaries
- **Real-World** (5 queries): Career decisions, learning paths, debugging, estimation,
  system design

## Scoring

The nightly eval applies the appropriate scorer based on test type:

### Routing Scores

- Model Selection (1.0 = correct model)
- Temperature (1.0 = within range)
- Reasoning (1.0 = correct reasoning state)
- Tool Invocation (1.0 = expected tool called)
- HTTP Success (1.0 = 2xx status)

### Competitive Scores

- Infrastructure Health (1.0 = no failures)
- HTTP Success (1.0 = 2xx status)
- Response Substance (1.0 = 50+ words)
- Reasoning Enabled (for reasoning category)
- Web Search Used (for web-search category)
- Tool Used (for tools category)
- Latency (1.0 = <30s, 0.5 = ≥30s)

## Metadata

Each test result includes metadata for analysis:

- `testType`: "routing" or "competitive"
- `category`: Test category
- `id`: Unique test identifier
- Tags for filtering (routing, competitive, reasoning, tools, etc.)

Global metadata:

- `baseUrl`: API endpoint
- `commit`: Git commit SHA
- `environment`: NODE_ENV
- `timestamp`: ISO timestamp
- `routingTestCount`: Number of routing tests
- `competitiveTestCount`: Number of competitive tests

## CI/CD Integration

```yaml
# Example GitHub Actions workflow
name: Nightly Evals
on:
  schedule:
    - cron: "0 2 * * *" # 2 AM daily
  workflow_dispatch:

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm dev &
      - run: sleep 5 # Wait for server
      - run: pnpm braintrust eval evals/nightly/eval.ts
        env:
          BRAINTRUST_API_KEY: ${{ secrets.BRAINTRUST_API_KEY }}
          TEST_USER_TOKEN: ${{ secrets.TEST_USER_TOKEN }}
          BASE_URL: http://localhost:3000
          COMMIT_SHA: ${{ github.sha }}
```

## Notes

- Slow tests (marked with `slow: true`) are skipped by default
- Multi-turn conversations maintain connection state across turns
- Infrastructure failures (HTTP errors, stream crashes, truncation) are separated from
  quality issues
- All tests are tagged with "nightly" for filtering in Braintrust dashboard
