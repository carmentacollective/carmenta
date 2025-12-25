# Carmenta Evaluation Benchmark Dataset

Version: 1.0.0 | Total: 150 queries

## Overview

This benchmark dataset is designed for rigorous competitive evaluation of Carmenta
against frontier LLMs (ChatGPT, Claude, Gemini, etc.). It enables:

1. **Publishable Comparisons**: Statistically significant head-to-head results
2. **Quality Improvement**: Identify weaknesses and track improvements
3. **System Resilience Testing**: Validate robustness under challenging conditions
4. **Tool Invocation Validation**: Test Carmenta's intelligent tool use

## Dataset Structure

### Core Benchmark (100 queries)

Balanced coverage across 5 categories:

| Category         | Count | Focus Areas                                                         |
| ---------------- | ----- | ------------------------------------------------------------------- |
| Reasoning        | 20    | Logic puzzles, probability, systems thinking, code analysis, proofs |
| Web Search       | 20    | Current events, pricing, product updates, research, fact-checking   |
| Tool Integration | 20    | Comparisons, deep research, MCP integrations                        |
| Edge Cases       | 20    | Loaded questions, ethics, misinformation, ambiguity, boundaries     |
| Real-World       | 20    | Career, debugging, estimation, system design, code review           |

Each category includes three difficulty levels:

- **Standard** (60%): Clear intent, typical user queries
- **Hard** (30%): Multiple approaches, requires judgment
- **Expert** (10%): Multi-step, tests capability limits

### Challenge Cases (50 queries)

System resilience under challenging conditions:

| Category            | Count | Tests                                                    |
| ------------------- | ----- | -------------------------------------------------------- |
| Long Context        | 10    | 10K+ token queries, key extraction, comparison           |
| Multi-Turn          | 10    | Context switching, preference changes, incremental input |
| Ambiguous Tool      | 10    | Multiple valid tools, source disambiguation              |
| Conflicting Signals | 10    | Speed vs depth, model hints vs task, style conflicts     |
| Format Edge Cases   | 10    | Unicode, code blocks, CSV, regex, YAML, shell escaping   |

## Files

- `queries.ts` - Core 100-query benchmark with types and utilities
- `challenge-cases.ts` - 50 challenge case scenarios
- `index.ts` - Combined exports and validation

## Usage

```typescript
import {
  benchmarkQueries,
  challengeCases,
  getQueriesByCategory,
  getQueriesByDifficulty,
  getQueriesExpectingTool,
  getChallengeCasesByCategory,
} from "@/evals/benchmark";

// Get all reasoning queries
const reasoning = getQueriesByCategory("reasoning");

// Get expert-level queries only
const expert = getQueriesByDifficulty("expert");

// Get queries that should trigger web search
const webSearchQueries = getQueriesExpectingTool("webSearch");

// Get long-context challenge cases
const longContext = getChallengeCasesByCategory("long-context");
```

## Running Evaluations

```bash
# Full benchmark
pnpm eval:benchmark

# Specific category
pnpm eval:benchmark --category reasoning

# Against specific baseline
pnpm eval:benchmark --baseline gpt-4o

# Challenge cases only
pnpm eval:benchmark --challenges-only
```

## Scoring Dimensions

Queries are scored on relevant dimensions:

| Dimension     | Description                           |
| ------------- | ------------------------------------- |
| accuracy      | Factually correct, no hallucinations  |
| completeness  | Addresses all aspects of the query    |
| clarity       | Well-structured, easy to understand   |
| recency       | Uses current information (web search) |
| actionability | Provides concrete next steps          |
| tool_usage    | Correctly selects and invokes tools   |

## Methodology

Full methodology documented in `knowledge/evals/dataset-methodology.md`, including:

- Source datasets (Arena-Hard v2.0, BFCL, MT-Bench, LMSYS)
- Selection criteria and adaptation process
- Difficulty stratification approach
- LLM-as-judge evaluation methodology
- Statistical significance requirements

## Sources

This dataset incorporates and adapts queries from:

- [Arena-Hard v2.0](https://github.com/lmarena/arena-hard-auto) (Apache 2.0)
- [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/)
- [MT-Bench-101](https://github.com/mtbench101/mt-bench-101)
- [LMSYS Chat-1M](https://huggingface.co/datasets/lmsys/lmsys-chat-1m)
- Custom queries for Carmenta-specific capabilities

## Versioning

Semantic versioning:

- **Major**: Category restructuring, methodology changes
- **Minor**: New queries added, existing queries refined
- **Patch**: Typo fixes, metadata corrections

## Contributing

When adding queries:

1. Follow the `BenchmarkQuery` or `ChallengeCase` interface
2. Include rationale explaining what the query tests
3. Tag appropriately for filtering
4. Assign difficulty based on guidelines
5. Run validation: `pnpm eval:benchmark --validate`
