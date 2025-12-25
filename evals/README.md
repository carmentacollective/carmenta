# Carmenta Evals

Braintrust-based evaluations for Carmenta's Concierge routing system, concierge model
comparison, competitive benchmarks, and file attachment handling.

## Quick Start

### Prerequisites

1. **For routing/attachment/competitive evals**: Start the Carmenta server:

   ```bash
   pnpm dev
   ```

   The server must be running at `http://localhost:3000` for these evals.

2. **For concierge model eval**: Server not required - calls OpenRouter directly.

3. **Environment variables** in `.env.local`:
   - `BRAINTRUST_API_KEY` - Get from https://www.braintrust.dev
   - `OPENROUTER_API_KEY` - Get from https://openrouter.ai
   - `TEST_USER_TOKEN` - Long-lived JWT from Clerk Dashboard (for routing/attachment
     evals)

### Run the Evals

```bash
# Run concierge model comparison
pnpm braintrust eval evals/concierge/eval.ts

# Run with specific model only
CONCIERGE_MODEL=openai/gpt-5-nano pnpm braintrust eval evals/concierge/eval.ts

# Enable LLM-as-judge scoring for title quality (expensive, more detailed)
ENABLE_LLM_JUDGE=true pnpm braintrust eval evals/concierge/eval.ts

# Run routing evaluation (requires server running)
pnpm braintrust eval evals/routing/eval.ts

# Run attachment evaluation
pnpm braintrust eval evals/attachments/eval.ts

# Run competitive benchmark
pnpm braintrust eval evals/competitive/eval.ts

# Watch mode - re-run on file changes
pnpm braintrust eval evals/routing/eval.ts --watch

# Just list the tests without running
pnpm braintrust eval evals/routing/eval.ts --list

# View results online
# After running, visit the URL shown in terminal or:
# https://www.braintrust.dev/app/Carmenta%20Collective
```

## Directory Structure

```
evals/
├── routing/           # Concierge routing decisions
│   ├── eval.ts        # Braintrust eval definition
│   ├── cases.ts       # Test case data
│   └── scorer.ts      # Scoring logic
├── concierge/         # Concierge model comparison
│   ├── eval.ts        # Braintrust eval definition
│   ├── cases.ts       # Test case data
│   ├── scorer.ts      # Scoring logic
│   ├── runner.ts      # Configurable model runner
│   └── title-scorer.ts # LLM-as-judge for titles
├── attachments/       # File attachment handling
│   └── eval.ts        # Eval with inline scorer
├── competitive/       # Competitive benchmark
│   ├── eval.ts        # Braintrust eval definition
│   └── queries.ts     # Benchmark queries
├── shared/            # Shared utilities
│   ├── diagnose.ts    # Diagnostic utilities
│   └── diagnose-failure.ts
└── fixtures/          # Test files (images, PDFs, audio, text)
```

## Evals Available

### Routing (`routing/eval.ts`)

Tests the Concierge model selection and routing logic.

**What it tests:**

- Model selection (Haiku for simple tasks, Sonnet for code, Opus for complex analysis)
- Temperature adjustment based on task type
- Reasoning enable/disable decisions
- Tool invocation (webSearch, compareOptions, deepResearch)
- Parameter overrides (model, temperature, reasoning)

### Concierge (`concierge/eval.ts`)

Compares different models for the Concierge role (the model that does the routing).

**What it tests:**

- Classification accuracy (does it route to the right model?)
- Temperature selection (does it match query type?)
- Reasoning enablement (does it enable reasoning when needed?)
- Title generation quality (concise, descriptive, not generic)
- Latency (how fast is each model?)

**Model candidates tested:**

- `anthropic/claude-haiku-4.5` - Current production model
- `google/gemini-3-pro-preview` - Google's latest pro model
- `x-ai/grok-4.1-fast` - xAI's fast model
- `openai/gpt-5-mini` - OpenAI's current mid-tier model

### Attachments (`attachments/eval.ts`)

Tests file handling across different media types.

**What it tests:**

- Image processing (PNG, JPEG descriptions)
- PDF text extraction
- Audio transcription (MP3 -> Gemini)
- Text file handling (plain text, markdown)

### Competitive (`competitive/eval.ts`)

End-to-end quality benchmark with 25 diverse queries.

**What it tests:**

- Infrastructure health (HTTP success, stream stability)
- Response substance (word count, completeness)
- Tool usage (web search, reasoning)
- Latency

## Troubleshooting

### "Cannot connect to API" Error

The Carmenta server isn't running or isn't reachable.

```bash
# Start the server in another terminal
pnpm dev

# Then run the evals
pnpm braintrust eval evals/routing/eval.ts
```

### "TEST_USER_TOKEN not found"

Missing Clerk JWT in environment variables.

1. Get a long-lived JWT from Clerk Dashboard
2. Add to `.env.local`: `TEST_USER_TOKEN=<your_token>`
3. Run evals again

## Adding New Tests

To add new routing test cases:

1. Edit `routing/cases.ts`
2. Add a new test case object to the `testData` array
3. Run `pnpm braintrust eval evals/routing/eval.ts`

Example test case:

```typescript
{
    input: {
        id: "my-test",
        description: "What this tests",
        content: "User prompt here",
        category: "routing",
    },
    expected: {
        model: "haiku",
        shouldSucceed: true,
    },
    tags: ["custom"],
},
```
