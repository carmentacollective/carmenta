# Prompt Testing

Prompts are code. They define Carmenta's behavior as much as TypeScript does. We test them
with the same rigor - versioned, evaluated across models, iterated to measurable targets.

This is distinct from Model Intelligence. Model Intelligence tells us which models are
best for which tasks (built from external benchmarks). Prompt Testing verifies our
prompts work correctly across the models we'll route to.

## Why This Exists

In an AI-first product, prompts ARE the specification. The Concierge's classification
prompt determines which model handles a request. The memory retrieval prompt determines
what context gets included. The response generation prompt determines how we're answered.

Untested prompts are bugs waiting to happen. A "small improvement" to a classification
prompt might route research questions to the fast model. A tweaked system prompt might
change the response tone we've carefully calibrated. Without tests, we discover these
regressions in production.

Prompt testing gives us confidence to iterate fast. Change a prompt, run the tests, see
exactly what changed across multiple models. No more "I think this sounds better" - we
measure.

## Core Concepts

### Prompts as Functions

Every prompt is a TypeScript function that returns a message array. This gives us type
safety, composability, and testability.

```typescript
export function classifyRequest(userMessage: string, recentContext: string[]) {
  return {
    messages: [
      {
        role: 'system',
        content: `You are a request classifier for an AI assistant.

Classify the user's request into exactly one category:
- QUICK: Simple questions, lookups, brief tasks
- CONVERSATION: Discussion, exploration, back-and-forth
- DEEP_ANALYSIS: Research, complex reasoning, thorough investigation
- CREATIVE: Writing, brainstorming, ideation
- TASK_EXECUTION: Actions that need tools or external services
- EMOTIONAL: Support, encouragement, personal matters

Output only the category name, nothing else.`
      },
      {
        role: 'user',
        content: userMessage
      }
    ]
  };
}
```

### Multi-Model Evaluation

Every prompt runs against multiple models. What works on Claude might fail on GPT. What's
cheap on Haiku might be wrong. We test across our model tiers to ensure consistent
behavior.

Default test providers:
- claude-3-5-haiku (fast tier)
- claude-3-5-sonnet (balanced tier)
- gpt-4o-mini (fast tier alternative)
- gpt-4o (balanced tier alternative)

### Assertion Types

Tests verify prompt behavior through multiple assertion types:

**LLM-as-Judge**: Another model evaluates if the output meets criteria
```yaml
- type: llm-rubric
  value: "Should classify coding questions as TASK_EXECUTION or DEEP_ANALYSIS, not QUICK"
```

**Contains/Excludes**: Output must include or exclude specific strings
```yaml
- type: contains-any
  value: ["QUICK", "CONVERSATION", "DEEP_ANALYSIS"]
- type: not-contains
  value: "I think"
```

**Custom Logic**: JavaScript assertions for complex validation
```yaml
- type: javascript
  value: "['QUICK','CONVERSATION','DEEP_ANALYSIS','CREATIVE','TASK_EXECUTION','EMOTIONAL'].includes(output.trim())"
```

**Regex**: Pattern matching
```yaml
- type: regex
  value: "^(QUICK|CONVERSATION|DEEP_ANALYSIS|CREATIVE|TASK_EXECUTION|EMOTIONAL)$"
```

## Directory Structure

```
packages/prompts/
├── src/
│   ├── chains/                    # Production prompt functions
│   │   ├── classifyRequest.ts
│   │   ├── enhanceQuery.ts
│   │   ├── generateTitle.ts
│   │   ├── selectModel.ts
│   │   └── index.ts
│   └── index.ts                   # Package exports
├── promptfoo/
│   ├── classify-request/
│   │   ├── eval.yaml              # Test configuration
│   │   ├── prompt.ts              # Wrapper that imports src/chains/
│   │   └── tests/
│   │       └── basic-case.ts      # Test cases
│   ├── enhance-query/
│   │   └── ...
│   └── generate-title/
│       └── ...
├── promptfooconfig.yaml           # Master configuration
├── package.json
└── README.md
```

## Test Configuration Pattern

Each prompt gets a directory with three files:

**eval.yaml** - Test configuration
```yaml
description: Classify user requests into routing categories

providers:
  - openai:chat:gpt-4o-mini
  - openai:chat:claude-3-5-haiku-latest
  - openai:chat:claude-3-5-sonnet-latest
  - openai:chat:gpt-4o

prompts:
  - file://promptfoo/classify-request/prompt.ts

tests:
  - file://./tests/basic-case.ts
```

**prompt.ts** - Thin wrapper importing production code
```typescript
import { classifyRequest } from '@carmenta/prompts';

interface PromptVars {
  userMessage: string;
  recentContext?: string[];
}

export default function generatePrompt({ vars }: { vars: PromptVars }) {
  const result = classifyRequest(vars.userMessage, vars.recentContext ?? []);
  return result.messages;
}
```

**tests/basic-case.ts** - Test cases
```typescript
const testCases = [
  // Quick lookups
  {
    vars: { userMessage: "What time is it in Tokyo?" },
    assert: [
      { type: 'contains', value: 'QUICK' }
    ]
  },
  {
    vars: { userMessage: "Convert 100 USD to EUR" },
    assert: [
      { type: 'contains', value: 'QUICK' }
    ]
  },

  // Deep analysis
  {
    vars: { userMessage: "Analyze the competitive landscape for AI chat interfaces" },
    assert: [
      { type: 'contains', value: 'DEEP_ANALYSIS' }
    ]
  },
  {
    vars: { userMessage: "Help me understand the tradeoffs between PostgreSQL and MongoDB for my use case" },
    assert: [
      { type: 'contains', value: 'DEEP_ANALYSIS' }
    ]
  },

  // Task execution
  {
    vars: { userMessage: "Create a new GitHub issue for the authentication bug" },
    assert: [
      { type: 'contains', value: 'TASK_EXECUTION' }
    ]
  },
  {
    vars: { userMessage: "Send an email to the team about tomorrow's meeting" },
    assert: [
      { type: 'contains', value: 'TASK_EXECUTION' }
    ]
  },

  // Creative
  {
    vars: { userMessage: "Write a haiku about debugging" },
    assert: [
      { type: 'contains', value: 'CREATIVE' }
    ]
  },

  // Emotional
  {
    vars: { userMessage: "I'm feeling overwhelmed with this project" },
    assert: [
      { type: 'contains', value: 'EMOTIONAL' }
    ]
  },

  // Edge cases - ambiguous requests
  {
    vars: { userMessage: "Tell me about React" },
    assert: [
      {
        type: 'llm-rubric',
        provider: 'openai:gpt-4o',
        value: 'Should classify as CONVERSATION or QUICK, not DEEP_ANALYSIS (request is vague, not requesting thorough investigation)'
      }
    ]
  }
];

export default testCases;
```

## Iteration Workflow

Target: 5-10% improvement per iteration, 3-5 rounds to reach 100% pass rate.

### 1. Run Tests

```bash
pnpm test:prompts                              # All prompts
pnpm promptfoo eval -c promptfoo/classify-request/eval.yaml  # Single prompt
pnpm promptfoo:view                            # Web UI for results
```

### 2. Analyze Failures

Identify patterns in failures:
- Which models fail? All or specific ones?
- What input types trigger failures?
- Is the prompt ambiguous or the test too strict?

### 3. Update Prompt

Common fixes:

**Add explicit constraints**
```typescript
// Before
content: 'Classify the request'

// After
content: `Classify the request.

Rules:
- Output ONLY the category name
- No explanations or reasoning
- Choose the single best category`
```

**Add examples for edge cases**
```typescript
content: `Classify the request.

Examples:
- "What's 2+2?" → QUICK
- "Explain quantum computing" → CONVERSATION (unless they say "thoroughly" or "in depth")
- "Research the history of..." → DEEP_ANALYSIS`
```

**Use MUST/SHOULD hierarchy**
```typescript
content: `Classify the request.

Rules:
- MUST output exactly one category name
- MUST NOT include any other text
- SHOULD prefer simpler categories when ambiguous
- MAY consider recent context for disambiguation`
```

### 4. Re-run and Repeat

```bash
pnpm promptfoo eval -c promptfoo/classify-request/eval.yaml
```

Track progress: Round 1 (75%) → Round 2 (85%) → Round 3 (92%) → Round 4 (100%)

## Prompt Engineering Patterns

### Output Constraints

Be explicit about format:
```typescript
content: `Generate a title for this conversation.

Rules:
- Maximum 8 words
- No punctuation at the end
- Capture the main topic, not the first message
- Output only the title, nothing else`
```

### Context Handling

Distinguish between no context and irrelevant context:
```typescript
content: hasContext
  ? `Answer using the provided context.

If context is relevant: Use it as foundation, supplement with knowledge
If context is unrelated: State this clearly, do not answer`
  : `Answer using your knowledge.`
```

### Classification with Examples

Anchor behavior with concrete examples:
```typescript
content: `Determine the urgency level.

Examples:
- "The site is down" → URGENT
- "Can we add a feature?" → NORMAL
- "Just thinking about..." → LOW

Output only: URGENT, NORMAL, or LOW`
```

## Integration Points

- **Model Intelligence**: Tells us which models to test against. The rubric's recommended
  models for each task type are the models we verify our prompts work on.
- **Testing Infrastructure**: Prompt tests run alongside unit tests in CI.
- **Concierge**: Classification and routing prompts are primary test targets.
- **Memory**: Query enhancement and context selection prompts.
- **AI Team**: Agent instruction prompts and handoff prompts.

## Commands

```bash
# Run all prompt tests
pnpm test:prompts

# Run specific prompt tests
pnpm promptfoo eval -c promptfoo/classify-request/eval.yaml

# View results in browser
pnpm promptfoo:view

# CI mode (JSON output, no interactive)
pnpm test:prompts:ci

# Generate summary report
pnpm test:prompts:summary
```

## Success Criteria

- All production prompts have test coverage
- Tests pass at 100% across all configured models
- New prompts require tests before merge
- Regression failures block deployment
- Prompt changes include before/after test results

## Decisions

### Promptfoo Over Custom

Promptfoo provides multi-model testing, assertion types, caching, and reporting out of
the box. Building custom would duplicate effort. The tool is well-maintained and
open-source.

### TypeScript Test Cases Over YAML

Test cases live in TypeScript files, not inline YAML. This gives us type checking,
easier maintenance, inline comments, and the ability to generate test cases
programmatically.

### Wrapper Pattern for Prompts

Test wrappers import production functions rather than duplicating prompt text. This
ensures tests always run against the actual code. A prompt change automatically updates
all tests.

### Multi-Model by Default

Every prompt tests against multiple models by default. Single-model testing misses
provider-specific failures. The cost is acceptable for the confidence gained.

## Open Questions

### Model Selection for Rubrics

Which model should judge LLM-as-judge assertions? Currently using gpt-4o. Should we use
the same model being tested? A stronger model? Multiple judges?

### Test Case Generation

Should we generate test cases from usage logs? When we see real user inputs that trigger
unexpected behavior, automatically add them as test cases?

### Performance Budgets

Should tests include latency assertions? "This prompt must complete in under 500ms on
the fast tier"?

### Prompt Versioning

How do we track prompt versions over time? Git history? Explicit version numbers in the
prompt functions? Changelog?
