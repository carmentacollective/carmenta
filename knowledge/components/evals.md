# Evals: Quality Measurement & Competitive Intelligence

## What This Is

A systematic approach to measuring, tracking, and improving the quality of Carmenta's
responses—powered by Braintrust for experiment tracking and production observability.

Four interconnected capabilities:

1. **LLM Routing Tests** - Validate Concierge model/temperature/reasoning selection
2. **File Attachment Tests** - Validate file handling across models
3. **Quality Scoring** - Measure how good responses actually are (via autoevals)
4. **Production Tracing** - Monitor live requests and export to datasets

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Braintrust Platform                                        │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐  │
│  │ Experiments  │     │ Datasets     │     │ Tracing     │  │
│  │ (eval runs)  │ ←── │ (test cases) │ ←── │ (prod logs) │  │
│  └──────────────┘     └──────────────┘     └─────────────┘  │
│         │                                        ↑          │
│         ↓                                        │          │
│  ┌─────────────────┐                   ┌─────────────────┐  │
│  │ Dashboard UI    │                   │ /api/connection │  │
│  │ - Comparisons   │                   │ - Span logging  │  │
│  │ - Regressions   │                   │ - Metadata      │  │
│  └─────────────────┘                   └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
evals/                        # Top-level, first-class concern
├── routing.eval.ts           # Concierge routing decisions
├── attachments.eval.ts       # File handling across models
├── scorers/
│   └── routing-scorer.ts     # Custom validation scorer
└── fixtures/                 # Sample files for tests
    ├── sample.pdf, .png, .jpg, .mp3
    ├── sample.txt, .md
    └── README.md
```

## Running Evals

```bash
# Run routing evals
bunx braintrust eval evals/routing.eval.ts

# Run attachment evals
bunx braintrust eval evals/attachments.eval.ts

# Watch mode - re-run on file changes
bunx braintrust eval evals/routing.eval.ts --watch

# Run locally without sending to Braintrust
BRAINTRUST_NO_SEND_LOGS=1 bunx braintrust eval evals/routing.eval.ts
```

Requires:

- `BRAINTRUST_API_KEY` in `.env.local`
- `TEST_USER_TOKEN` in `.env.local` (long-lived Clerk JWT)

## Test Categories

### Routing Tests

| Category   | What it tests                                      |
| ---------- | -------------------------------------------------- |
| routing    | Model selection (Haiku/Sonnet/Opus) based on query |
| tools      | Tool invocation (webSearch, compareOptions, etc.)  |
| reasoning  | When reasoning is enabled/disabled                 |
| overrides  | User preference handling                           |
| edge-cases | Unicode, long context, short responses             |

### Attachment Tests

| File Type | Expected Model | What it tests                  |
| --------- | -------------- | ------------------------------ |
| image     | Claude         | PNG/JPEG description           |
| pdf       | Claude         | Document text extraction       |
| audio     | Gemini         | Audio transcription            |
| text      | Claude         | Inline text content processing |

## Scoring

The routing scorer validates multiple dimensions per test:

- **Model Selection** - Did Concierge pick the right model?
- **Temperature** - Is it within expected range?
- **Reasoning** - Was reasoning enabled/disabled correctly?
- **Tool Invocation** - Was the expected tool called?
- **HTTP Success** - Did the request succeed?

Each dimension is scored 0 or 1, with metadata showing expected vs actual values.

## Production Tracing

The `/api/connection` route logs to Braintrust when `BRAINTRUST_API_KEY` is set:

**What's captured:**

- Input: message count, last message preview
- Metadata: model, temperature, reasoning config, explanation
- Output: response text (truncated), tools called
- Metrics: token usage (input, output, cached)

This enables:

- Monitoring production quality
- Exporting interesting traces to datasets
- Comparing production behavior to eval expectations

## Braintrust Dashboard

View results at [braintrust.dev](https://www.braintrust.dev):

- **Experiments** - Each eval run creates an experiment with scores
- **Comparisons** - Side-by-side diffs between runs
- **Datasets** - Test cases versioned and pinnable
- **Traces** - Production request logs with full context

## Configuration

Environment variables:

| Variable           | Required | Description                        |
| ------------------ | -------- | ---------------------------------- |
| BRAINTRUST_API_KEY | Yes      | API key from braintrust.dev        |
| TEST_USER_TOKEN    | Yes      | Long-lived Clerk JWT for API auth  |
| BASE_URL           | No       | API base URL (default: localhost)  |
| COMMIT_SHA         | No       | Git commit for experiment metadata |

## CI Integration

Add to GitHub Actions for automated evals on PR:

```yaml
- name: Run evals
  run: bunx braintrust eval evals/routing.eval.ts
  env:
    BRAINTRUST_API_KEY: ${{ secrets.BRAINTRUST_API_KEY }}
    TEST_USER_TOKEN: ${{ secrets.TEST_USER_TOKEN }}
```

The Braintrust GitHub Action can also post results as PR comments.

## Adding New Tests

1. Add test case to the `testData` array in the relevant eval file
2. Specify `input` (test data) and `expected` (validation criteria)
3. Add appropriate `tags` for filtering
4. Run the eval to verify

Example:

```typescript
{
    input: {
        id: "new-test-id",
        description: "What this tests",
        content: "The query to send",
        category: "routing",
    },
    expected: {
        model: "sonnet",
        reasoningEnabled: false,
        shouldSucceed: true,
    },
    tags: ["routing", "new-feature"],
}
```

## Competitive Benchmarking

Future: Create `competitive.eval.ts` to compare Carmenta against:

- ChatGPT (OpenAI API)
- Perplexity (Perplexity API)
- Claude.ai (Anthropic API, raw—no orchestration)

Same evaluators score all responses → comparison matrix in Braintrust.
