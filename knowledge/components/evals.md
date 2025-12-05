# Evals: Quality Measurement & Competitive Intelligence

## What This Is

A systematic approach to measuring, tracking, and improving the quality of Carmenta's
responses—and comparing that quality against competitors.

Three interconnected capabilities:

1. **Integration Testing** - Validate system behavior (routing, reasoning, tools)
2. **Quality Scoring** - Measure how good responses actually are
3. **Competitive Benchmarking** - Compare against ChatGPT, Perplexity, Claude.ai

## Platform Decision: Arize Phoenix

We use [Arize Phoenix](https://phoenix.arize.com) for LLM observability and evals.

**Why Phoenix:**

- Tracing AND evals in one platform
- Native Vercel AI SDK integration via OpenTelemetry
- Open source with self-host option
- Clean, modern—not LangChain-adjacent
- Reasonable pricing ($50/mo Pro, free tier available)

**Clean separation of concerns:**

| Concern                               | Tool    | Why                               |
| ------------------------------------- | ------- | --------------------------------- |
| LLM traces (prompts, outputs, tokens) | Phoenix | Has evals, designed for LLM       |
| LLM evaluations                       | Phoenix | Core capability                   |
| Error tracking & alerts               | Sentry  | Already set up, excellent at this |
| Non-LLM APM                           | Sentry  | General performance monitoring    |
| Session replay                        | Sentry  | User behavior debugging           |

**No redundant LLM traces.** Phoenix owns all LLM observability. Sentry catches errors
but doesn't duplicate the detailed prompt/response/token data.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Carmenta                                                   │
│  ┌──────────────┐                                           │
│  │ User Query   │──▶ Concierge ──▶ LLM ──▶ Response         │
│  └──────────────┘                                           │
│         │                              │                    │
│         │                              ▼                    │
│         │                    [OpenTelemetry]                │
│         │                              │                    │
│         │                              ▼                    │
│         │                        ┌─────────┐                │
│         │                        │ Phoenix │                │
│         │                        │ (LLM)   │                │
│         │                        └─────────┘                │
│         │                              │                    │
│         ▼                              ▼                    │
│    [Errors]                    ┌─────────────┐              │
│         │                      │ Evals       │              │
│         ▼                      │ + Tracking  │              │
│    ┌──────────┐                └─────────────┘              │
│    │  Sentry  │                                             │
│    │ (Errors) │                                             │
│    └──────────┘                                             │
└─────────────────────────────────────────────────────────────┘
```

- **Phoenix**: All LLM traces, evals, experiments, quality tracking
- **Sentry**: Errors, exceptions, non-LLM performance, alerts

## Implementation Status

### Phase 1: Integration Tests + Phoenix Setup - COMPLETE

**What's implemented:**

- Phoenix OTEL tracing via `@arizeai/phoenix-otel` in `instrumentation.ts`
- Sentry configured with `skipOpenTelemetrySetup: true` (no LLM trace duplication)
- Integration test runner at `scripts/evals/run-integration-tests.ts`
- 22 test queries covering all routing dimensions

**Configuration:**

```bash
# Required env vars in .env.local
TEST_USER_TOKEN=<long-lived JWT from Clerk>
ARIZE_API_KEY=<from phoenix.arize.com>
```

**Running integration tests:**

```bash
bun evals              # Run all tests
bun evals:fast         # Skip slow tests (deep research)
bun evals:routing      # Model routing tests only
bun evals:tools        # Tool invocation tests only
bun evals:reasoning    # Reasoning tests only
bun evals:overrides    # Override tests only
bun evals:verbose      # Show full response content
```

**Test categories:**

| Category   | Tests | What's Validated                                     |
| ---------- | ----- | ---------------------------------------------------- |
| routing    | 6     | Model selection (haiku/sonnet/opus), temperature     |
| tools      | 4     | Tool invocation (weather, search, compare, research) |
| reasoning  | 3     | Reasoning enabled/disabled based on complexity       |
| overrides  | 6     | User overrides respected (model, temp, reasoning)    |
| edge-cases | 3     | Unicode, long context, edge inputs                   |

### Phase 2: Quality Scoring - COMPLETE

**What's implemented:**

- LLM-as-judge evaluators in `scripts/evals/evaluators.ts`
- Three quality dimensions: Correctness, Helpfulness, Relevance
- Quality eval runner at `scripts/evals/run-quality-evals.ts`
- Claude Haiku 3.5 as the judge model

**Running quality evals:**

```bash
bun evals:quality              # Run quality scoring (5 tests default)
bun evals:quality:verbose      # Show full responses
bun evals:quality --limit=10   # Run more tests
```

**Evaluators:**

- **Correctness**: Is the information factually accurate? (correct/partially/incorrect)
- **Helpfulness**: Would a user find this useful? (very/somewhat/not helpful)
- **Relevance**: Does it answer what was asked? (relevant/partial/irrelevant)

**Output:**

```
Query ID                  | Correct    | Helpful    | Relevant   | Overall
--------------------------------------------------------------------------------
route-simple-factual      | correct    | very_help  | relevant   | 100%
route-code-task           | correct    | very_help  | relevant   | 100%
...
```

**Value:** Know if responses are actually good, not just routed correctly.

### Phase 3: Competitive Benchmarking

**Goal:** Compare Carmenta against competitors on same queries.

Competitors:

- **ChatGPT** (OpenAI API)
- **Perplexity** (Perplexity API)
- **Claude.ai** (Anthropic API, raw—no our orchestration)

Process:

1. Same test query → Carmenta, ChatGPT, Perplexity, Claude
2. Same evaluators score all responses
3. Aggregate into comparison matrix

Output:

| Query Type  | Carmenta | ChatGPT  | Perplexity | Claude   |
| ----------- | -------- | -------- | ---------- | -------- |
| Factual     | 0.95     | 0.90     | 0.98       | 0.92     |
| Research    | 0.88     | 0.75     | 0.92       | 0.80     |
| Code        | 0.90     | 0.88     | 0.70       | 0.92     |
| Creative    | 0.85     | 0.82     | 0.65       | 0.88     |
| **Overall** | **0.90** | **0.84** | **0.81**   | **0.88** |

**Value:** Know where we win, where we lose, marketing ammunition.

### Phase 4: Operationalize

**Goal:** Make evals part of the development workflow.

- Run evals before deploying prompt/model changes
- Track scores over time in Phoenix dashboards
- Alert on regressions
- Grow test set as we discover edge cases
- Consider publishing comparison table publicly

**Value:** Continuous quality, catch regressions before users do.

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

**Different judge:** Use GPT-4 or Claude Opus as judge, not the same model generating

## Decisions Made

1. **Judge model:** Claude Haiku 3.5 (fast, cost-effective, good enough for evals)
2. **Packages:** `@arizeai/phoenix-otel`, `@arizeai/phoenix-evals`,
   `@arizeai/phoenix-client`
3. **Sentry integration:** `skipOpenTelemetrySetup: true`, no `vercelAIIntegration`

## Open Questions

1. **How often to run competitor comparison?** Weekly? Monthly?
2. **Public results:** Publish the comparison matrix? Where?
3. **CI integration:** Run evals on every PR? Just before release?
4. **Phoenix integration:** Should quality scores be logged to Phoenix automatically?

## Resources

- [Phoenix Docs](https://arize.com/docs/phoenix)
- [Phoenix Evals Guide](https://arize.com/docs/phoenix/evaluation/evals)
- [Vercel AI SDK Integration](https://arize.com/docs/phoenix/integrations/vercel/vercel-ai-sdk-tracing-js)
- [LLM-as-Judge Best Practices](https://www.evidentlyai.com/llm-guide/llm-as-a-judge)
