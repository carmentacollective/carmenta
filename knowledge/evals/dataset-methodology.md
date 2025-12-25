# Carmenta Evaluation Dataset: Methodology

This document describes how we constructed the Carmenta evaluation dataset, our sources,
selection criteria, and the rationale behind each category. This methodology is designed
to be reproducible and transparent for publication.

## Design Philosophy

### Goals

1. **Competitive Benchmarking**: Compare Carmenta against vanilla ChatGPT, Claude,
   Gemini, and other frontier models with statistical significance
2. **Quality Improvement**: Identify areas where Carmenta underperforms and drive
   targeted improvements
3. **System Resilience**: Validate robustness across diverse query types, challenge
   cases, and failure modes
4. **Tool Invocation Validation**: Test Carmenta's differentiating
   capability—intelligent tool selection and execution

### Principles

- **Real-world relevance**: Prioritize queries that reflect actual user needs over
  academic puzzles
- **Difficulty stratification**: Include standard, hard, and expert levels within each
  category
- **Reproducibility**: Use established datasets where possible, with clear sampling
  methodology
- **Balanced coverage**: No category dominates; each represents ~20% of the core
  benchmark
- **Minimal contamination**: Avoid queries likely to be in training data of models we're
  testing

## Dataset Structure

### Tier 1: Core Competitive Benchmark (200 queries)

The primary benchmark for head-to-head comparison against other LLMs.

| Category                | Count | Purpose                                                |
| ----------------------- | ----- | ------------------------------------------------------ |
| Reasoning               | 40    | Logic, math, systems thinking, code analysis           |
| Web Search              | 40    | Current information, fact verification, trend analysis |
| Tool Integration        | 40    | Structured comparisons, deep research, MCP operations  |
| Edge Cases & Nuance     | 40    | Loaded questions, ethics, ambiguity, boundaries        |
| Real-World Applications | 40    | Debugging, estimation, career, system design           |

### Tier 2: Tool Invocation Deep Dive (100 queries)

Carmenta's differentiator is intelligent tool use. This tier stress-tests that
capability.

| Tool Category    | Count | Tests                                               |
| ---------------- | ----- | --------------------------------------------------- |
| webSearch        | 25    | Current events, fact verification, pricing research |
| compareOptions   | 20    | Framework comparisons, product decisions, tradeoffs |
| deepResearch     | 15    | Multi-source synthesis, comprehensive analysis      |
| MCP Integrations | 40    | Calendar, GitHub, Slack, Gmail, Notion, Spotify     |

### Tier 3: Challenge Cases (50 queries)

Challenging conditions that test system resilience.

| Type                     | Count | Tests                                               |
| ------------------------ | ----- | --------------------------------------------------- |
| Long Context             | 10    | 10K+ token queries, context window limits           |
| Multi-turn               | 10    | Context switching, reference resolution             |
| Ambiguous Tool Selection | 10    | Could reasonably use multiple tools                 |
| Conflicting Signals      | 10    | Speed hint + complex query, model hint + wrong task |
| Format Edge Cases        | 10    | Unicode, code blocks, structured data, attachments  |

## Source Datasets

### Arena-Hard v2.0

**Source**:
[lmarena-ai/arena-hard-auto](https://huggingface.co/datasets/lmarena-ai/arena-hard-auto)

**Why this dataset**:

- 750 queries (500 real-world, 250 creative) sourced from Chatbot Arena
- 87.4% separability between models (high discrimination power)
- 89.1% agreement with human preferences
- LLM-as-judge methodology aligns with our evaluation approach

**Sampling strategy**:

- Pull 50 queries for Reasoning category (math, logic, analysis)
- Pull 30 queries for Real-World category (practical problems)
- Exclude creative writing queries (not our focus)
- Filter for English-only queries
- Remove queries with high training data contamination risk

**Fields used**:

```json
{
  "question_id": "unique identifier",
  "category": "reasoning|coding|creative|...",
  "turns": ["user query text"],
  "cluster": "topic cluster"
}
```

### Berkeley Function Calling Leaderboard (BFCL)

**Source**:
[gorilla-llm/Berkeley-Function-Calling-Leaderboard](https://huggingface.co/datasets/gorilla-llm/Berkeley-Function-Calling-Leaderboard)

**Why this dataset**:

- 4,951 test cases specifically for tool/function calling
- Covers single, parallel, multi-step, and multi-turn function calls
- V4 includes agentic scenarios with error recovery
- Industry standard for function calling evaluation

**Adaptation strategy**:

- Select 40 cases representing diverse function patterns
- Map BFCL function schemas to Carmenta's tool signatures
- Prioritize cases testing:
  - Correct tool selection (when multiple tools could apply)
  - Parameter extraction accuracy
  - Multi-step tool chaining
  - Graceful handling of missing/invalid parameters

**Mapping example**:

```
BFCL: get_weather(location, unit)
Carmenta: webSearch(query) → parse weather from results
```

### xLAM Function Calling 60k

**Source**:
[Salesforce/xlam-function-calling-60k](https://huggingface.co/datasets/Salesforce/xlam-function-calling-60k)

**Why this dataset**:

- 60,000 verified function calls across 21 domains
- 95%+ human-verified accuracy
- Diverse API patterns (REST, structured data, complex parameters)

**Sampling strategy**:

- Sample 20 cases from domains matching Carmenta's MCP integrations
- Focus on edge cases: optional parameters, nested objects, arrays

### MT-Bench-101

**Source**: [mtbench101/mt-bench-101](https://github.com/mtbench101/mt-bench-101)

**Why this dataset**:

- 4,208 turns across 1,388 multi-turn dialogues
- Fine-grained ability taxonomy (13 tasks)
- Tests conversation coherence and context maintenance

**Sampling strategy**:

- Select 30 cases for Edge Cases category
- Focus on: ambiguity resolution, clarification requests, topic shifts
- Include cases where the "right" answer requires understanding context

### LMSYS Chat-1M

**Source**: [lmsys/lmsys-chat-1m](https://huggingface.co/datasets/lmsys/lmsys-chat-1m)

**Why this dataset**:

- 1M real conversations from Chatbot Arena users
- Authentic user queries (not synthetic)
- Reveals actual usage patterns vs. academic benchmarks

**Sampling strategy**:

- Sample 30 conversations for Real-World category
- Filter for:
  - English language
  - Single-turn (for easier evaluation)
  - Non-trivial queries (>20 tokens)
  - Safe content (passing OpenAI moderation)
- Exclude: greetings, simple questions, role-play requests

## Custom Query Development

### Why Custom Queries?

External datasets don't cover:

1. **MCP Integration Testing**: No dataset tests Calendar, GitHub, Slack, Gmail, Notion,
   Spotify tool invocation
2. **Web Search Freshness**: Queries must test current information retrieval, not cached
   knowledge
3. **Carmenta-Specific Edge Cases**: Routing, model selection, reasoning enablement

### Custom Query Categories

#### MCP Integration Tests (40 queries)

Hand-crafted queries that require specific MCP tool invocation:

```typescript
// Example structure
{
  id: "mcp-github-issue-create",
  query: "Create a GitHub issue in the carmenta repo titled 'Fix login timeout' with details about the 30-second timeout affecting SSO users",
  expectedTool: "github",
  expectedAction: "create_issue",
  evaluationCriteria: ["correct_repo", "descriptive_title", "detailed_body"]
}
```

**Integration coverage**:

- GitHub (5): create_issue, list_issues, get_file_contents, search_code,
  get_pull_request
- Google Calendar (5): list_events, create_event, get_freebusy, search_events
- Slack (5): send_message, list_channels, get_channel_history
- Gmail (5): send_message, list_messages, get_message
- Notion (5): search, create_page, query_database
- Spotify (5): search, play, get_currently_playing, create_playlist
- Mixed/Ambiguous (10): queries that could use multiple integrations

#### Web Search Tests (40 queries)

Queries requiring current information that LLMs cannot answer from training data:

```typescript
{
  id: "web-pricing-current",
  query: "What is the current per-token pricing for Claude 3.5 Sonnet vs GPT-4o? Include any volume discounts.",
  category: "web-search",
  evaluationCriteria: ["uses_web_search", "current_pricing", "both_models_covered", "mentions_discounts"]
}
```

**Freshness requirement**: All web search queries are designed to have answers that
change frequently (pricing, version numbers, recent events, product updates).

#### Edge Cases (custom portion)

Queries testing specific Carmenta behaviors:

- **Loaded questions**: Queries with false premises requiring reframing
- **Sensitivity routing**: Political/controversial topics that should route to Grok
- **Boundary awareness**: Medical, legal, financial advice requiring appropriate
  disclaimers
- **Clarification triggers**: Underspecified queries that should prompt clarification

## Difficulty Stratification

Each category includes three difficulty levels:

### Standard (60% of queries)

- Clear intent, well-specified parameters
- Single correct answer or obvious quality gradient
- Representative of typical user queries

### Hard (30% of queries)

- Multiple valid approaches, requires judgment
- Partial information, needs clarification or assumptions
- Tests reasoning depth and nuance

### Expert (10% of queries)

- Multi-step, requires tool chaining or extended thinking
- Ambiguous or conflicting requirements
- Tests limits of capability

## Evaluation Methodology

### Scoring Dimensions

Each query is scored on relevant dimensions (not all apply to every query):

| Dimension     | Description                                   | Scale |
| ------------- | --------------------------------------------- | ----- |
| Accuracy      | Factually correct, no hallucinations          | 1-10  |
| Completeness  | Addresses all aspects of the query            | 1-10  |
| Clarity       | Well-structured, easy to understand           | 1-10  |
| Recency       | Uses current information (web search queries) | 1-10  |
| Actionability | Provides concrete next steps                  | 1-10  |
| Tool Usage    | Correctly selects and invokes tools           | 1-10  |

### LLM-as-Judge Methodology

Following Arena-Hard's approach:

1. Generate response from Carmenta
2. Generate response from baseline model (GPT-4o)
3. Present both responses (randomized order) to judge model
4. Judge provides pairwise preference with reasoning
5. Aggregate across judge models (GPT-4.1, Gemini-2.5)

### Statistical Significance

- Minimum 40 queries per category for meaningful comparison
- Report 95% confidence intervals on win rates
- Use bootstrap resampling for variance estimation
- Flag results where confidence interval overlaps 50%

## Quality Assurance

### Query Review Process

1. **Initial drafting**: Create query with expected behavior
2. **Peer review**: Second reviewer validates clarity and difficulty
3. **Pilot testing**: Run against 2-3 models to verify discrimination
4. **Iteration**: Refine queries that don't differentiate

### Contamination Checks

- Cross-reference queries against known training datasets
- Avoid verbatim copies from popular sources
- Prefer novel phrasings of classic problems
- For reasoning queries, use modified numbers/names from known puzzles

### Bias Mitigation

- Balance difficulty across categories
- Avoid queries that favor specific model architectures
- Include queries where tool use is NOT appropriate (to test over-triggering)
- Review for demographic, cultural, and regional bias

## Dataset Versioning

### Semantic Versioning

- **Major**: Category restructuring, methodology changes
- **Minor**: New queries added, existing queries refined
- **Patch**: Typo fixes, metadata corrections

### Current Version

`carmenta-eval-v1.0.0` - Initial release

### Change Log

Track all modifications with:

- Query ID affected
- Nature of change
- Rationale
- Date

## Reproducibility

### Data Files

All queries stored in:

- `evals/benchmark/queries.ts` - Core competitive benchmark
- `evals/benchmark/tool-tests.ts` - Tool invocation deep dive
- `evals/benchmark/stress-tests.ts` - Stress test suite

### Running the Benchmark

```bash
# Full benchmark
pnpm eval:benchmark

# Specific category
pnpm eval:benchmark --category reasoning

# Against specific baseline
pnpm eval:benchmark --baseline gpt-4o
```

### Reporting

Results published to:

- Braintrust dashboard (internal)
- Public leaderboard (carmenta.ai/benchmarks)
- GitHub releases (versioned snapshots)

## References

1. [Arena-Hard: An Automatic LLM Benchmark](https://arxiv.org/abs/2406.11939)
2. [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/blogs/8_berkeley_function_calling_leaderboard.html)
3. [xLAM: A Family of Large Action Models](https://www.salesforce.com/blog/large-action-model-ai-agent/)
4. [MT-Bench-101: Fine-Grained Multi-Turn Evaluation](https://arxiv.org/abs/2402.14762)
5. [Chatbot Arena: Benchmarking LLMs in the Wild](https://arxiv.org/abs/2403.04132)
