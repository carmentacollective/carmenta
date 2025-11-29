# Model Intelligence

The system that tells Carmenta which model to use for which request. This document
describes HOW model selection works. For the actual recommendations (WHICH model for
WHAT task), see [`model-rubric.md`](../model-rubric.md).

## Document Separation

- **This document** (`model-intelligence.md`): The system architecture - how routing
  works, what factors matter, how updates happen
- **The rubric** (`model-rubric.md`): The actual data - current model recommendations,
  profiles, fallback chains. Updated via `/update-model-rubric` command.

The Concierge reads the rubric at runtime. Developers read this document to understand
the system.

## Why This Exists

Model selection is a first-order problem. Pick wrong and you waste money on simple
questions, or deliver poor quality on complex ones. The model landscape changes weekly -
new releases, price changes, capability updates, silent degradations.

Most products either hardcode choices (falls behind immediately) or punt to users (bad
UX). Carmenta maintains a living rubric that answers: "For this type of request, which
model is best right now?"

This isn't about running our own benchmarks from scratch. The AI community produces
extensive benchmark data - LMSYS Chatbot Arena, Artificial Analysis, provider
announcements, independent evaluations. We aggregate this intelligence, validate what
matters for our use cases, and maintain the routing rubric the Concierge needs.

## The Routing Rubric

The rubric maps task types to model recommendations:

```typescript
interface RoutingRubric {
  taskTypes: {
    [taskType: string]: TaskTypeRubric;
  };
  lastUpdated: Date;
  version: string;
}

interface TaskTypeRubric {
  taskType: TaskType;
  description: string;

  // What matters for this task type
  priorities: {
    quality: number; // 0-1 weight
    speed: number; // 0-1 weight
    cost: number; // 0-1 weight
  };

  // Ranked model recommendations
  recommendations: ModelRecommendation[];

  // Minimum requirements
  requirements: {
    minQualityScore?: number;
    maxLatencyMs?: number;
    requiredCapabilities?: string[];
  };
}

interface ModelRecommendation {
  modelId: string;
  tier: "primary" | "fallback" | "budget";
  scores: {
    quality: number; // 0-100
    speed: number; // 0-100 (inverse of latency)
    cost: number; // 0-100 (inverse of price)
    overall: number; // Weighted combination
  };
  notes?: string; // Why this model for this task
  source: IntelligenceSource[];
}
```

### Task Types

**QUICK** - Simple lookups, conversions, brief questions

- Priorities: speed (0.5), cost (0.4), quality (0.1)
- Example: "What's 15% of 340?"
- Notes: Quality floor is low - just needs to be correct

**CONVERSATION** - Discussion, exploration, back-and-forth

- Priorities: quality (0.4), speed (0.4), cost (0.2)
- Example: "Tell me about the French Revolution"
- Notes: Balance matters - engaging but responsive

**DEEP_ANALYSIS** - Research, complex reasoning, thorough investigation

- Priorities: quality (0.7), speed (0.1), cost (0.2)
- Example: "Analyze the tradeoffs between these architectures"
- Notes: Quality dominates - worth waiting and paying for

**CREATIVE** - Writing, brainstorming, ideation

- Priorities: quality (0.6), speed (0.2), cost (0.2)
- Example: "Write a product announcement"
- Notes: Needs capability for style and originality

**TASK_EXECUTION** - Actions requiring tools or external services

- Priorities: quality (0.5), speed (0.3), cost (0.2)
- Example: "Create a GitHub issue for this bug"
- Notes: Tool use capability required, reliability critical

**CODE** - Programming, debugging, technical implementation

- Priorities: quality (0.6), speed (0.2), cost (0.2)
- Example: "Write a function to parse this format"
- Notes: Correctness non-negotiable, best practices matter

**EMOTIONAL** - Support, encouragement, personal matters

- Priorities: quality (0.7), speed (0.2), cost (0.1)
- Example: "I'm feeling overwhelmed"
- Notes: Tone and empathy critical, not a place to cut corners

## Intelligence Sources

We don't reinvent benchmarking. We aggregate and validate.

### External Benchmarks

**LMSYS Chatbot Arena** (https://chat.lmsys.org/)

- Human preference data from blind comparisons
- ELO ratings across models
- Updated continuously with real user votes
- Best signal for conversational quality

**Artificial Analysis** (https://artificialanalysis.ai/)

- Speed benchmarks (TTFT, tokens/sec)
- Price tracking across providers
- Quality index from multiple benchmarks
- Updated frequently, API available

**Provider Benchmarks**

- Anthropic, OpenAI, Google publish capability claims
- Take with appropriate skepticism
- Useful for capability detection (vision, tools, context length)

**Independent Evaluations**

- Simon Willison's LLM analysis
- AI newsletters and researchers
- Community benchmark runs
- Useful for specific capability deep-dives

### Our Own Validation

External benchmarks tell us general capability. We validate for our specific use cases:

**Spot Checks**: When rubric is updated, run representative requests through recommended
models. Verify the ranking makes sense for Carmenta's users.

**Capability Verification**: Confirm models actually support claimed capabilities (tool
use, vision, streaming) in our integration.

**Edge Case Testing**: Test specific scenarios we care about that general benchmarks
might miss (heart-centered tone, specific tool integrations).

### Production Signals

Real usage tells us what benchmarks can't:

**Latency Monitoring**: Actual TTFT and completion times from our infrastructure.
Provider benchmarks don't account for our specific setup.

**Error Rates**: Which models fail, timeout, or refuse inappropriately in production.

**User Signals**: Regeneration requests, explicit feedback, conversation abandonment.
Indirect signal that routing might be wrong.

**Cost Tracking**: Actual spend per model, per task type. Validates pricing assumptions.

## Rubric Maintenance

### Update Triggers

**New Model Release**: Major provider announces new model

1. Pull capability specs from provider
2. Check external benchmarks within 48 hours (they're fast)
3. Add to rubric with preliminary placement
4. Run spot checks for our use cases
5. Enable for production with monitoring

**Benchmark Updates**: LMSYS or Artificial Analysis shows significant ranking change

1. Review the change and methodology
2. Determine if it affects our task types
3. Update rubric if warranted
4. Note the source and reasoning

**Production Signals**: Our monitoring shows unexpected behavior

1. Investigate root cause
2. If model issue, adjust rubric
3. If our issue, fix integration

**Price Changes**: Provider adjusts pricing

1. Update cost scores in rubric
2. Recalculate overall scores
3. May shift recommendations for cost-sensitive task types

### Update Process

Rubric updates are tracked and versioned:

```typescript
interface RubricUpdate {
  version: string;
  timestamp: Date;
  changes: RubricChange[];
  sources: string[];
  reasoning: string;
}

interface RubricChange {
  taskType: TaskType;
  field: string;
  oldValue: any;
  newValue: any;
}
```

Changes are logged so we can trace why the rubric recommends what it does.

## Model Selection Flow

When Concierge needs to select a model:

```typescript
function selectModel(request: ClassifiedRequest, rubric: RoutingRubric): string {
  const taskRubric = rubric.taskTypes[request.taskType];

  // Filter by requirements
  const candidates = taskRubric.recommendations.filter((rec) => {
    const model = getModelProfile(rec.modelId);

    // Check capabilities
    if (taskRubric.requirements.requiredCapabilities) {
      if (!hasCapabilities(model, taskRubric.requirements.requiredCapabilities)) {
        return false;
      }
    }

    // Check request-specific needs
    if (request.hasImages && !model.capabilities.supportsVision) {
      return false;
    }

    if (request.needsTools && !model.capabilities.supportsTools) {
      return false;
    }

    return true;
  });

  // Apply user mode preference
  if (request.mode === "swift") {
    return candidates.sort((a, b) => b.scores.speed - a.scores.speed)[0].modelId;
  }

  if (request.mode === "deep") {
    return candidates.sort((a, b) => b.scores.quality - a.scores.quality)[0].modelId;
  }

  // Default: use rubric's overall score (pre-weighted)
  return candidates[0].modelId; // Already sorted by overall
}
```

### Override Modes

- **Swift**: Fastest capable model (user wants speed)
- **Balanced**: Rubric's weighted recommendation (default)
- **Deep**: Highest quality capable model (user wants thoroughness)
- **Specific**: User explicitly picks a model (power users)

## Model Profiles

Alongside the rubric, we maintain profiles for operational data:

```typescript
interface ModelProfile {
  id: string;
  provider: "anthropic" | "openai" | "google" | "other";
  displayName: string;

  capabilities: {
    maxContextWindow: number;
    supportsVision: boolean;
    supportsTools: boolean;
    supportsStreaming: boolean;
  };

  pricing: {
    inputPerMillion: number;
    outputPerMillion: number;
    cachedInputPerMillion?: number;
  };

  status: "active" | "deprecated" | "testing";
  addedAt: Date;
}
```

Profiles are factual (capabilities, pricing). The rubric is judgmental (which is best).

## Routing Options to Evaluate

Beyond static rubrics, there are trained routers and commercial options worth evaluating
for model selection.

### RouteLLM (LMSYS, ICLR 2025)

Open-source framework for training routers using human preference data. Claims 85% cost
reduction while maintaining 95% of GPT-4 performance. Worth evaluating against simpler
approaches.

### Commercial Routers

**Not Diamond**: Powers OpenRouter's auto-router. Since we're using OpenRouter, this is
available automatically.

**Martian**: Used by Amazon, Zapier. Claims up to 98% cost reduction.

### Simple Approach: Fast LLM Classification

Use a fast LLM (Haiku, GPT-4o-mini) to classify requests and output signals. The rubric
interprets signals into model recommendations. Simpler, more transparent, and may be
good enough.

Need to evaluate these options before committing to an approach.

## Integration Points

- **Concierge**: Queries rubric for every model selection decision
- **Observability**: Production signals feed back into rubric validation
- **Product Intelligence**: Monitors for benchmark updates, new model releases

## Success Criteria

- Routing decisions feel right to users (they don't think about it)
- New models integrated within 48 hours of release
- Cost efficiency improves over static routing
- No incidents from routing to incapable models
- Rubric reasoning is traceable and explainable

## Decisions

### Aggregate Over Originate

We're not a benchmarking company. LMSYS has millions of human comparisons. Artificial
Analysis has dedicated infrastructure. We aggregate their intelligence and validate for
our use cases. Building equivalent benchmarks would be wasted effort.

### Rubric Over Algorithm

The routing logic is a simple rubric lookup, not a complex ML model. Rubrics are
explainable, debuggable, and manually adjustable. When something goes wrong, we can see
exactly why and fix it.

### Signal-Based Classification Over Rigid Task Types

Rather than hardcoded task type enums (QUICK, CODE, CREATIVE, etc.), the classifier
outputs signals (complexity, domain, tools_needed, quality_sensitivity). The rubric
interprets these signals into model recommendations. This is more flexible - the rubric
can evolve without changing classification logic.

## Values Alignment

Carmenta has an explicit bias toward Anthropic models. When capabilities are close, we
prefer Claude.

Why? Anthropic builds AI with Constitutional AI principles and genuine care for safety
and human flourishing. They're heart-centered in how they run their company. We vote
with our API calls.

This isn't blind loyalty - if another provider significantly outperforms Claude for a
task type, we route there. But when models are functionally equivalent, Anthropic wins.

## Future: Ensemble Mode

Design consideration for future implementation.

**Ensemble Mode** broadcasts the same query to multiple models in parallel, then either:

- Presents results side-by-side for user selection
- Synthesizes results into a combined response
- Uses voting/consensus for factual questions

Use cases:

- High-stakes decisions wanting multiple perspectives
- Creative work wanting variety
- Fact-checking critical information
- User curiosity ("show me how different models answer")

Architecture considerations:

- Cost multiplier (2-4x depending on models used)
- Latency determined by slowest model (or timeout)
- Synthesis could require another model call
- UI needs to present multiple responses cleanly
- OpenRouter supports this via multiple model requests

This is future work. The rubric and Concierge should be designed to support it, but
implementation is deferred.

## Keeping the Rubric Current

The `/update-model-rubric` command researches the current model landscape and proposes
updates. It gathers intelligence from:

- LMSYS Chatbot Arena rankings
- Artificial Analysis benchmarks
- Provider official documentation
- OpenRouter availability and pricing

Run this command:

- When a major new model releases
- Monthly as maintenance
- When users report quality issues that might indicate stale routing

The command always proposes changes for human review - it never auto-commits rubric
updates.

---

## Open Questions

### Routing Implementation

Which approach for model selection? Options to evaluate:

- Fast LLM classification (Haiku/GPT-4o-mini) with rubric lookup
- RouteLLM trained router
- OpenRouter's built-in Not Diamond routing
- Hybrid approach

Need to prototype and compare before committing.

### Benchmark Source Trust

How much do we trust each source? LMSYS has selection bias (tech-savvy users). Provider
benchmarks are marketing. Should we weight sources differently?

### Capability Discovery

How do we detect new capabilities in models? Providers don't always announce everything.
Should we probe systematically?

### Personalized Routing Over Time

Should we track which models users respond well to (via implicit signals) and calibrate
routing per user over time? Or is consistency more valuable?

### Nightly Updates

The rubric update command is designed to eventually run nightly. When automated:

1. Run at low-traffic time
2. Compare against current rubric
3. If changes detected, create draft PR
4. Human reviews and merges

This requires building confidence in the research quality first.

---

## Research References

Key sources for routing research:

- **RouteLLM**: LMSYS/ICLR 2025, open-source trained router (to evaluate)
- **Not Diamond**: Powers OpenRouter's auto-router
- **Martian**: Commercial router used by Amazon, Zapier
