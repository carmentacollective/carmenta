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

**Strategic Vision:** Carmenta's competitive moat is transparent proof that we get
better answers.

### Why This Matters

Most AI products claim to be better but show no evidence. Carmenta will publish
systematic benchmarks proving where we win. This becomes:

- **Marketing differentiator** - "Ranked #1 in reasoning, web search, and real-world
  queries"
- **Product signal** - Data-driven decisions about which tools/models to invest in
- **User trust** - New signups see hard evidence we're worth the time
- **Continuous improvement** - Monthly results show we're getting better

### Architecture

Create `competitive.eval.ts` that runs 25 test queries against:

- Carmenta (you—orchestrated with tools)
- ChatGPT (OpenAI API—baseline)
- Claude (Anthropic API raw—no Concierge routing)
- Perplexity (if API available—their strength is web search)
- Google Gemini (emerging competitor)

Same rubric scores all responses → comparison matrix in Braintrust.

### Query Design (25 Total)

The test suite exercises real-world use cases where Carmenta should excel:

**Reasoning (5 queries)**

- Logic puzzles requiring multi-step deduction
- Mathematical proofs
- Systems thinking and scenario analysis
- Contradiction identification
- Novel problem-solving under constraints

**Web Search (5 queries)**

- Current events requiring real-time data
- Recent product launches and features
- Current pricing/market comparisons
- Breaking news synthesis
- Emerging trend analysis

**Tool Integration (5 queries)**

- Comparison tasks (frameworks, products, approaches)
- Research synthesis with multi-source analysis
- Fact-checking and myth-busting
- Decision-making frameworks
- Data interpretation and analysis

**Edge Cases & Nuance (5 queries)**

- Biased questions requiring balanced treatment
- Ethical dilemmas with multiple valid perspectives
- Misinformation correction
- Context-dependent interpretation
- Domain-specific expertise

**Real-World Use Cases (5 queries)**

- Career and technical decision-making
- Learning pathway design
- Project planning and estimation
- Debugging complex issues
- Strategic business questions

### Scoring Rubric

Each response scored on (0-100 scale):

- **Accuracy** - Factual correctness and evidence quality
- **Completeness** - Coverage of relevant angles
- **Clarity** - Explanation quality and structure
- **Recency** - Uses current information where needed
- **Actionability** - User can actually act on it
- **Tool Usage** - Appropriate tool application
- **Overall** - Composite score across all dimensions

Store in Braintrust for easy comparison matrices and trend analysis.

### Publishing Strategy

**MVP: Public Dashboard**

- Live comparison table: 25 queries × 5 models
- Heatmap showing Carmenta wins (🟢), ties (🟡), losses (🔴)
- Category breakdowns (reasoning, web search, real-world)
- Average scores by model
- Sample responses side-by-side for transparency

**Marketing Content**

- Blog: "We benchmarked 5 AI models against 25 real-world queries. Here's what we
  found."
- Category deep-dives: "Carmenta wins on reasoning 87% of the time because..."
- Monthly updates: "October benchmark: New improvements in X category"
- Press releases: Share strong results with media

**In-App Integration**

- Landing page: "See how Carmenta compares"
- Interactive demo: Pick a query, see all 5 responses
- Trust signal: "Based on 25 benchmark queries..."
- Feature pages: "Our web search integration ranks #1"

### Implementation Roadmap

**Phase 1 (Weeks 1-2): Query + Scoring Design**

- Finalize 25 queries across all categories
- Write detailed rubric with examples
- Get team alignment on evaluation criteria

**Phase 2 (Weeks 3-4): MVP Implementation**

- Build API integration for OpenAI + Anthropic (easiest)
- Implement basic automated scoring
- Manual human scoring for all responses
- Create static comparison dashboard

**Phase 3 (Weeks 5-6): Expansion + Publishing**

- Add Perplexity and Gemini APIs
- Automate scoring where possible
- Publish first blog post with findings
- Deploy interactive dashboard

**Phase 4 (Ongoing): Monthly Cycles**

- Run 25 queries monthly
- Update dashboard with new results
- Publish trend analysis
- Use results to guide product improvements
- Expand to 50-100 queries based on learnings

### Continuous Improvement Loop

Each month's results inform product decisions:

- Weak category? Invest in that feature
- Specific query type we lose? Debug and fix
- Competitor making ground? Analyze why and respond
- Win opportunity? Double down and expand

This closes the loop: evals measure quality → results guide development → new features
prove out in next month's benchmarks.

### Database Schema

```typescript
// queries table
{
  id: string;
  text: string;
  category: "reasoning" | "web-search" | "tools" | "edge-cases" | "real-world";
  created_at: timestamp;
  tags: string[];
}

// responses table
{
  id: string;
  query_id: string;
  model: "carmenta" | "chatgpt" | "claude" | "perplexity" | "gemini";
  response_text: string;
  latency_ms: number;
  tokens_used: number;
  tools_called: string[];
  created_at: timestamp;
}

// scores table
{
  id: string;
  response_id: string;
  accuracy: number; // 0-100
  completeness: number;
  clarity: number;
  recency: number;
  actionability: number;
  tool_usage: number;
  overall: number;
  scored_by: string;
  created_at: timestamp;
}

// Computed: comparison_results
// Query aggregation showing which model ranks best per query and category
```

### Expected Competitive Advantages

- **Transparency** - You publish detailed results; most competitors don't
- **Trust signal** - New users see proof before committing time
- **Product insights** - See exactly where to improve next
- **Marketing fuel** - Quantified claims backed by real data
- **Continuous validation** - Monthly benchmarks show improvement over time
