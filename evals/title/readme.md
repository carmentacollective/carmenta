# Title Generation Eval

Evaluates title generation quality across different models using Braintrust.

## What This Evaluates

- **Topic Capture**: Does the title reflect the message content?
- **Anti-Patterns**: Avoids generic titles like "Help with...", "Question about..."
- **Length Compliance**: Stays within 40 character limit
- **Emoji Conventions**: Uses gitmoji for code context (bug fix, feature, refactor)
- **Latency**: Fast generation for good UX

## Usage

```bash
# Run with all model candidates
pnpm braintrust eval evals/title/eval.ts

# Run with specific model
TITLE_MODEL=openai/gpt-4o-mini pnpm braintrust eval evals/title/eval.ts

# Filter by category
TITLE_CATEGORY=code pnpm braintrust eval evals/title/eval.ts
```

## Available Models

| Model                               | Description              |
| ----------------------------------- | ------------------------ |
| `anthropic/claude-haiku-4.5`        | Current production model |
| `google/gemini-2.0-flash-exp`       | Google's fast model      |
| `openai/gpt-4o-mini`                | OpenAI's fast model      |
| `meta-llama/llama-3.3-70b-instruct` | Meta's open model        |

## Test Categories

- `conversation` - General topics (trip planning, gifts, decisions)
- `code` - Coding tasks with gitmoji conventions
- `technical` - Technical explanations (OAuth, databases)
- `creative` - Writing and brainstorming
- `edge-cases` - Unicode, long input, minimal input

## Requirements

- `BRAINTRUST_API_KEY` in `.env.local`
- `OPENROUTER_API_KEY` in `.env.local`

## Scoring

Each test case produces multiple scores:

| Score         | Weight | Description              |
| ------------- | ------ | ------------------------ |
| Success       | -      | Did generation succeed?  |
| Length        | 1      | Within 40 char limit     |
| Topic Capture | 2      | Matches expected pattern |
| Not Generic   | 2      | Avoids anti-patterns     |
| Gitmoji       | 1      | Emoji for code context   |
| Latency       | 1      | Response time            |
| Ideal Length  | 1      | 10-30 chars is ideal     |
