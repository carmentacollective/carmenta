# Carmenta Evals

Braintrust-based evaluations for Carmenta's Concierge routing system, concierge model
comparison, and file attachment handling.

## Quick Start

### Prerequisites

1. **For routing/attachment evals**: Start the Carmenta server:

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
# Run concierge model comparison (compares Haiku, GPT-5 Nano, Gemini Flash)
pnpm braintrust eval evals/concierge.eval.ts

# Run with specific model only
CONCIERGE_MODEL=openai/gpt-5-nano pnpm braintrust eval evals/concierge.eval.ts

# Enable LLM-as-judge scoring for title quality (expensive, more detailed)
ENABLE_LLM_JUDGE=true pnpm braintrust eval evals/concierge.eval.ts

# Run routing evaluation (requires server running)
pnpm braintrust eval evals/routing.eval.ts

# Run attachment evaluation
pnpm braintrust eval evals/attachments.eval.ts

# Watch mode - re-run on file changes
pnpm braintrust eval evals/routing.eval.ts --watch

# Just list the tests without running
pnpm braintrust eval evals/routing.eval.ts --list

# View results online
# After running, visit the URL shown in terminal or:
# https://www.braintrust.dev/app/Carmenta%20Collective
```

## Evals Available

### Concierge Model Eval (`concierge.eval.ts`)

Compares different models for the Concierge role (the model that does the routing).

**What it tests:**

- Classification accuracy (does it route to the right model?)
- Temperature selection (does it match query type?)
- Reasoning enablement (does it enable reasoning when needed?)
- Title generation quality (concise, descriptive, not generic)
- Latency (how fast is each model?)

**Model candidates tested:**

- `anthropic/claude-haiku-4.5` - Current production model
- `openai/gpt-5-nano` - Fast and cheap alternative
- `google/gemini-3-flash-preview` - Newest Google flash model

**Test cases:** 30+ covering speed signals, complexity, creativity, code, reasoning,
sensitivity, attachments, hints, and edge cases.

**Key features:**

- Tests the concierge directly (doesn't require server running)
- Side-by-side comparison of multiple models in Braintrust dashboard
- Optional LLM-as-judge scoring for nuanced title quality assessment
- Tracks cost and latency alongside accuracy

### Routing Eval (`routing.eval.ts`)

Tests the Concierge model selection and routing logic.

**What it tests:**

- Model selection (Haiku for simple tasks, Sonnet for code, Opus for complex analysis)
- Temperature adjustment based on task type
- Reasoning enable/disable decisions
- Tool invocation (webSearch, compareOptions, deepResearch)
- Parameter overrides (model, temperature, reasoning)
- Edge cases (unicode, short responses, etc.)

**Test cases:** 20 (excludes slow tests by default)

**Key categories:**

- **Routing** - Model selection accuracy
- **Tools** - Tool invocation detection
- **Reasoning** - Reasoning enable/disable correctness
- **Overrides** - Parameter override behavior
- **Edge cases** - Special character handling, response length, etc.

### Attachments Eval (`attachments.eval.ts`)

Tests file handling across different media types.

**What it tests:**

- Image processing (PNG, JPEG descriptions)
- PDF text extraction
- Audio transcription (MP3)
- Text file handling (plain text, markdown)

**Test cases:** 7

## Troubleshooting

### "Cannot connect to API" Error

The Carmenta server isn't running or isn't reachable.

**Fix:**

```bash
# Start the server in another terminal
npm run dev

# Then run the evals
pnpm dlx braintrust eval evals/routing.eval.ts
```

### "fetch failed" Errors (All Tests Fail)

The server likely isn't running at the expected URL.

**Check:**

- Is `npm run dev` running? (should be at `http://localhost:3000`)
- Is `TEST_USER_TOKEN` set in `.env.local`?
- Can you access `http://localhost:3000` in your browser?

**Fix:**

```bash
# Kill any existing server
pkill -f "next dev"

# Start fresh
npm run dev
```

### "TEST_USER_TOKEN not found"

Missing Clerk JWT in environment variables.

**Fix:**

1. Get a long-lived JWT from Clerk Dashboard
2. Add to `.env.local`: `TEST_USER_TOKEN=<your_token>`
3. Run evals again

## Files

- `concierge.eval.ts` - Concierge model comparison evaluation
- `concierge-test-data.ts` - Test cases for concierge model eval
- `lib/concierge-runner.ts` - Configurable runner for testing different concierge models
- `scorers/concierge-scorer.ts` - Scoring logic for concierge decisions
- `scorers/title-quality-scorer.ts` - LLM-as-judge scorer for title quality
- `routing.eval.ts` - Concierge routing evaluation (full API pipeline)
- `routing-test-data.ts` - Test cases for routing eval
- `attachments.eval.ts` - File attachment handling evaluation
- `scorers/routing-scorer.ts` - Custom scoring logic for routing decisions
- `fixtures/` - Test files for attachment eval (images, PDFs, audio, text)

## Important Notes

- **Evals connect to your local Carmenta server** - The server must be running
- **Tests are read-only** - They don't modify any data
- **Results are logged to Braintrust** - Visible at https://www.braintrust.dev
- **Network-dependent** - If the API is slow, tests may timeout

## Adding New Tests

To add new routing test cases:

1. Edit `routing-test-data.ts`
2. Add a new test case object to the `testData` array
3. Run `pnpm dlx braintrust eval evals/routing.eval.ts`

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
