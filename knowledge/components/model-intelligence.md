# Model Intelligence

The routing rubric that tells Carmenta which model to use for which request. Built from
external benchmarks, our own validation, and production signals. The Concierge consults
this rubric for every request.

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

## Trained Routers

Beyond static rubrics, trained routers use ML to predict optimal model selection
per-query. Research shows these can achieve significant cost reduction while maintaining
quality.

### RouteLLM (LMSYS, ICLR 2025)

Open-source framework for training routers using human preference data. Routes between
"strong" (expensive) and "weak" (cheap) models.

**Results**:

- 85% cost reduction on MT Bench
- 45% cost reduction on MMLU
- 95% of GPT-4 performance maintained

**Router architectures available**:

- Matrix factorization (best default)
- BERT classifier
- Weighted Elo calculation
- LLM-based classifier

**Recommendation**: Start with RouteLLM as baseline. Train custom routers as we collect
production evaluation data. The matrix factorization router is fastest and works well
for most cases.

### Commercial Alternatives

**Martian** (used by Amazon, Zapier): Uses interpretability techniques to predict model
performance without running inference. Claims up to 98% cost reduction. Query-by-query
routing with automatic rerouting on failures.

**Not Diamond**: Powers OpenRouter's auto-router. Makes routing decisions in ~60ms (less
than streaming a single token). Supports custom router training with your evaluation
data.

Since we're using OpenRouter, Not Diamond's routing is available automatically. We can
layer RouteLLM on top for task-type-specific optimization.

### Cascading Strategies

**FrugalGPT** (Stanford, 2023): Sequentially query models from cheapest to most
expensive until a reliable response is found. Self-verification determines adequacy.
Results: matches GPT-4 performance with up to 98% cost reduction, or improves accuracy
by 4% at same cost.

**Application**: Use cascading for DEEP_ANALYSIS tasks where cost tolerance is higher
and quality is paramount. Skip cascading for QUICK tasks where latency matters more.

### User-Tier Routing

Route based on subscription tier:

```typescript
function getModelTier(user: User, taskType: TaskType): ModelTier {
  if (user.plan === "pro") {
    // Pro users get premium models for all task types
    return "premium";
  }

  // Basic users get premium only for complex tasks
  if (taskType === "DEEP_ANALYSIS" || taskType === "CODE") {
    return "premium";
  }

  return "standard";
}
```

This creates differentiated value for paid tiers while ensuring all users get quality
responses for complex requests.

## Fallback and Reliability

### Retry Strategy

- Automatic retries with exponential backoff (up to 5 retries)
- Different retry delays per provider based on their rate limit patterns
- Jitter to prevent thundering herd

### Circuit Breaker

Monitor error rates per model/provider. When threshold exceeded:

1. Mark provider as unhealthy
2. Route to fallback automatically
3. Probe periodically to detect recovery
4. Restore when healthy

### Load Balancing

- Distribute requests across API keys to avoid rate limits
- Weight distribution by key capacity
- Track per-key usage in real-time

### Context Window Fallbacks

When request exceeds model's context window:

1. Try compression (LLMLingua)
2. If still too large, route to larger-context model
3. If no capable model, inform user and suggest truncation

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

### Task Type Granularity

Seven task types balance usefulness with maintainability. Could be more granular (CODE
could split into "write new" vs "debug existing") but complexity cost isn't worth it
yet. Can refine based on production data.

### Weighted Priorities Over Rankings

Each task type has explicit priority weights (quality, speed, cost). This makes the
tradeoffs visible and adjustable. Different products might weight differently - we
optimize for quality-conscious users who still value responsiveness.

---

## Decisions Made

### RouteLLM as Starting Implementation

Use RouteLLM's matrix factorization router as baseline. Open-source, trained on human
preference data, 85% cost reduction documented. We can train custom routers as we
collect production data.

### Layered Routing: Not Diamond + RouteLLM + Rubric

1. OpenRouter's Not Diamond handles base routing (~60ms)
2. Our RouteLLM layer optimizes for task types
3. Rubric provides explainable overrides and debugging

This gives us intelligent routing without building everything from scratch.

### Multi-Model Cascading for Deep Analysis Only

Research validated cascading (FrugalGPT) but latency cost is high. Use only for
DEEP_ANALYSIS tasks where users expect longer processing. QUICK tasks go straight to
fast models.

### User-Tier Differentiation

Pro users get premium models for all task types. Basic users get premium for complex
tasks only. This creates clear value for paid tiers without degrading basic experience.

---

## Open Questions

### Benchmark Source Trust

How much do we trust each source? LMSYS has selection bias (tech-savvy users). Provider
benchmarks are marketing. Should we weight sources differently?

### Capability Discovery

How do we detect new capabilities in models? Providers don't always announce everything.
Should we probe systematically?

### Personalized Routing Over Time

Research shows GNN-based routers can learn user preferences. Should we track which
models users respond well to (via implicit signals) and calibrate routing per user over
time? Or is consistency more valuable?

---

## Research References

Key sources that informed these decisions:

- **RouteLLM**: LMSYS/ICLR 2025, open-source trained router, 85% cost reduction
- **FrugalGPT**: Stanford 2023, cascading strategies, up to 98% cost reduction
- **Martian**: Commercial router used by Amazon, Zapier
- **Not Diamond**: Powers OpenRouter's auto-router, ~60ms routing decisions
- **Portkey**: AI gateway patterns for reliability (retries, circuit breaker)
