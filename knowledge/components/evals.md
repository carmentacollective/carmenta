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

## Implementation Plan

### Phase 1: Integration Tests + Phoenix Setup

**Goal:** Validate system behavior, record everything to Phoenix from day one.

Setup:

1. Sign up at [phoenix.arize.com](https://phoenix.arize.com) (free tier)
2. Install packages:
   ```bash
   bun add @arizeai/openinference-vercel @arizeai/phoenix-otel
   ```
3. Create `instrumentation.ts` for Next.js (Phoenix tracing)
4. Configure Sentry with `skipOpenTelemetrySetup: true`
5. Remove `experimental_telemetry` from Sentry (Phoenix owns LLM traces now)

Integration tests - 10 seed queries:

| ID               | Query                                     | Tests                          |
| ---------------- | ----------------------------------------- | ------------------------------ |
| simple-factual   | "What year did WW2 end?"                  | model=haiku, reasoning=false   |
| complex-analysis | "Analyze economic implications of UBI..." | model=opus, reasoning=true     |
| code-task        | "Write a debounce function"               | model=sonnet, temp<0.5         |
| creative         | "Write a poem about the ocean"            | temp>0.6                       |
| speed-signal     | "Quick question: capital of France?"      | model=haiku                    |
| math-proof       | "Prove sqrt(2) is irrational"             | reasoning=high                 |
| weather-tool     | "Weather in San Francisco?"               | response contains weather data |
| web-search       | "Latest AI regulation news"               | response contains current info |
| casual-chat      | "Hey, how's it going?"                    | reasoning=false                |
| precise-code     | "Exact regex for email validation"        | temp<0.4                       |

Runner script:

- Uses JWT auth (long-lived Clerk token)
- Calls `/api/connection` with full UIMessage format
- Asserts on response headers (model, temp, reasoning)
- All traces recorded to Phoenix automatically

**Value:** Confidence that routing, reasoning, and tools work correctly.

### Phase 2: Quality Scoring

**Goal:** Measure response quality with LLM-as-judge.

Define evaluators:

```typescript
// Correctness: Is the information accurate?
const correctnessEval = createClassifier({
  model: judge,
  choices: { correct: 1, incorrect: 0 },
  promptTemplate: `...`,
});

// Helpfulness: Would a user find this useful?
const helpfulnessEval = createClassifier({
  model: judge,
  choices: { "very helpful": 1, "somewhat helpful": 0.5, "not helpful": 0 },
  promptTemplate: `...`,
});

// Relevance: Does it answer what was asked?
const relevanceEval = createClassifier({
  model: judge,
  choices: { relevant: 1, "partially relevant": 0.5, irrelevant: 0 },
  promptTemplate: `...`,
});
```

Workflow:

1. Run test queries through Carmenta
2. Score each response with evaluators
3. Log scores to Phoenix
4. Establish baseline metrics

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

## Open Questions

1. **Judge model:** GPT-4o? Claude Opus? Panel of multiple judges?
2. **How often to run competitor comparison?** Weekly? Monthly?
3. **Public results:** Publish the comparison matrix? Where?
4. **CI integration:** Run evals on every PR? Just before release?

## Resources

- [Phoenix Docs](https://arize.com/docs/phoenix)
- [Phoenix Evals Guide](https://arize.com/docs/phoenix/evaluation/evals)
- [Vercel AI SDK Integration](https://arize.com/docs/phoenix/integrations/vercel/vercel-ai-sdk-tracing-js)
- [LLM-as-Judge Best Practices](https://www.evidentlyai.com/llm-guide/llm-as-a-judge)
