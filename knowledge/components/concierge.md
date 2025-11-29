# Concierge

The Concierge sits between our input and AI processing - the intelligent layer that
transforms casual requests into optimized queries, selects the right models, and
determines how to respond. We experience a simple interface while the Concierge handles
complexity invisibly.

## Why This Exists

Every AI interaction involves choices: which model, what context to include, how to
structure the query, what response strategy fits best. Most interfaces push these
choices to us when we don't want to think about them, or make rigid default choices that
work poorly for many cases.

The Concierge makes these choices intelligently for each request. A quick question gets
a fast model. A research task gets a thorough one. A creative request gets appropriate
temperature. We get what we need without understanding the machinery.

The Concierge is foundational to everything else. It determines what the Interface needs
to display, what Memory to retrieve, which agents to invoke. Building it first means
other components can be designed around known output types rather than retrofitting.

## Processing Pipeline

When a message arrives, the Concierge runs a multi-stage pipeline. Each stage runs in
parallel where possible to meet latency targets.

```
User Input
    |
[Stage 1: Fast Classification] (~10ms, parallel)
├── Intent classification (Semantic Router)
├── Emotion detection
├── Ambiguity scoring
└── Multi-intent detection
    |
[Stage 2: Cache Check] (~5ms, parallel with Stage 1)
└── Semantic cache lookup
    |
    |-- (cache hit) --> Return cached response
    |
[Stage 3: Query Transformation] (~15ms)
├── Query rewriting (if retrieval needed)
├── Multi-intent decomposition (if detected)
└── Context compression (for long histories)
    |
[Stage 4: Context Assembly] (~15ms, parallel)
├── Memory retrieval
├── User profile injection (at START of context)
└── Relevant history selection (at END of context)
    |
[Stage 5: Routing Decision]
├── Model selection (RouteLLM + our rubric)
├── Response format selection
└── Confidence threshold check
    |
[LLM Generation] (streaming)
    |
[Output Processing] (streaming, parallel)
├── Format transformation
└── Cache store (async)
    |
User Output (via AG-UI protocol)
```

**Total preprocessing target: <50ms** - below human perception threshold.

## Core Functions

### Request Analysis

When a message arrives, the Concierge classifies what kind of request it is and
determines how to handle it.

**Intent Classification**: Use Semantic Router (embedding-based, not LLM) for fast
routing in ~10ms. Define routes for each task type with representative utterances. Fall
back to LLM classification for edge cases where confidence is low.

**Emotion Detection**: Run emotion classifier in parallel with intent. Detected emotion
influences both routing (emotional queries get more capable models) and response style
(empathetic framing). Critical for our heart-centered philosophy and especially for
voice input where prosody carries emotional nuance.

**Multi-Intent Detection**: Detect when a single request contains multiple distinct
intents ("What are the pricing options AND what's your refund policy?"). Decompose into
separate processing streams that recombine in the response.

**Ambiguity Scoring**: Score how ambiguous the request is. High confidence (>0.95)
proceeds. Multiple competing intents triggers clarification. Domain-critical decisions
always clarify. User history influences threshold - speed-focused users get lower bars.

### Task Types

Our classification taxonomy, validated against research on production systems:

| Type               | Priorities (quality/speed/cost) | Example                                         | Notes                                        |
| ------------------ | ------------------------------- | ----------------------------------------------- | -------------------------------------------- |
| **QUICK**          | 0.1 / 0.5 / 0.4                 | "What's 15% of 340?"                            | Quality floor low, just needs to be correct  |
| **CONVERSATION**   | 0.4 / 0.4 / 0.2                 | "Tell me about the French Revolution"           | Balance matters - engaging but responsive    |
| **DEEP_ANALYSIS**  | 0.7 / 0.1 / 0.2                 | "Analyze tradeoffs between these architectures" | Quality dominates - worth waiting and paying |
| **CREATIVE**       | 0.6 / 0.2 / 0.2                 | "Write a product announcement"                  | Needs style and originality                  |
| **TASK_EXECUTION** | 0.5 / 0.3 / 0.2                 | "Create a GitHub issue for this bug"            | Tool use required, reliability critical      |
| **CODE**           | 0.6 / 0.2 / 0.2                 | "Write a function to parse this format"         | Correctness non-negotiable                   |
| **EMOTIONAL**      | 0.7 / 0.2 / 0.1                 | "I'm feeling overwhelmed"                       | Tone and empathy critical, never cut corners |

This taxonomy is sufficient for MVP. Can refine based on production data - e.g., CODE
could split into "write new" vs. "debug existing" if data shows different optimal
routing.

### Query Enhancement

Our requests rarely arrive optimized for AI processing. The Concierge transforms them.

**Query Rewriting**: For retrieval-heavy requests, generate 3-5 variant queries, execute
in parallel, combine results via reciprocal rank fusion. For ambiguous queries, use
decomposition to break into clearer sub-queries.

**Context Compression**: For users with extensive conversation history, apply
compression (LLMLingua achieves 10-20x compression). Balance compression ratio against
context fidelity based on query importance - don't compress context for emotional
queries.

**Context Placement**: Research shows LLMs struggle with information in the middle of
long contexts. Place user profile at START of context (highest attention), place
retrieved memories at END before current query. Less critical context goes in the
middle.

**Prompt Enhancement**: Use DSPy for automatic prompt optimization as we collect
production data. Define declarative signatures for each task type, let optimizers
discover effective patterns.

### Model Selection

Different requests need different models. Quick questions get fast, cheap models. Deep
analysis gets powerful, expensive ones.

There are two paths for model selection:

**Path 1: Concierge Chooses (Default)**

Most users never think about models. The Concierge:

1. Classifies the request into a task type (CODE, REASONING, CONVERSATION, etc.)
2. Checks the user's speed mode (Swift, Balanced, Deep)
3. Reads the [model rubric](../model-rubric.md) for recommendations
4. Filters by capabilities (needs vision? needs tools? context length?)
5. Factors in detected emotion (emotional queries bias toward quality)
6. Selects the optimal model and configures it (temperature, etc.)
7. Explains its reasoning in response metadata

**Path 2: User Chooses Explicitly**

Power users can override model selection:

- Available via settings or a picker in the input area
- Shows human-friendly names ("Claude Sonnet 4" not "anthropic/claude-sonnet...")
- Can lock preference for session or use one-time
- Concierge still enhances the query, just skips routing

The Concierge queries the [model rubric](../model-rubric.md) for current
recommendations. The rubric is updated via the `/update-model-rubric` command when the
model landscape changes. See [model-intelligence.md](./model-intelligence.md) for how
the system works.

**Implementation**: Start with RouteLLM as open-source baseline - achieves 85% cost
reduction while maintaining 95% of GPT-4 performance. Train custom routers as we collect
production evaluation data.

**Fallback Strategy**:

- Automatic retries with exponential backoff (up to 5 retries)
- Circuit breaker: monitor error thresholds, remove unhealthy providers
- Load balancing across API keys to counter rate limits
- Context window fallbacks: switch to larger-context models when needed

### Response Strategy

Beyond model selection, the Concierge determines how to respond:

**Use rich UI (AG-UI) when**:

- Displaying structured data (tables, charts, forms)
- User needs to make selections from options
- Content exceeds 15 lines and is self-contained
- Iterative editing is expected
- Data visualization aids comprehension

**Use conversational text when**:

- Quick, conversational exchanges
- Explaining concepts without data structure
- Emotional/supportive interactions
- Creative content generation

For heart-centered philosophy: default to conversational text for emotional queries
regardless of content length or structure.

### Semantic Caching

Cache LLM responses indexed by query embeddings. Similar (not exact) queries return
cached results. 2-10x speedup for repeated patterns.

**Cache key strategy**: `hash(query + user_preferences + session_context)` to avoid
returning generic cached responses to personalized queries.

**Cache invalidation**: Time-based decay, explicit memory updates, user profile changes.

## Controls

While the Concierge handles complexity automatically, we get simple overrides. Keep
controls minimal - most users should never need them.

### Speed Modes

- **Swift**: Prioritize speed. Use fastest capable model (typically Claude 3.5 Haiku or
  Gemini 2.0 Flash). For users who want quick answers and conversational flow.
- **Balanced**: Use the rubric's recommended model for the task type. Default mode.
  Optimizes for quality within reasonable latency.
- **Deep**: Prioritize quality. Use most capable model (typically Claude Opus 4). For
  research, analysis, important decisions. Worth the wait.

### Model Override

Power users can explicitly select a model, bypassing Concierge routing. The Concierge
still enhances the query but routes to the specified model.

### Response Format Hint

Users can suggest chat vs. rich UI preference. Concierge considers this alongside its
own assessment of the content.

### Explainability

When the Concierge selects a model, it should be able to explain why:

- "Your request was classified as CODE"
- "You're in Balanced mode"
- "For CODE + Balanced, our rubric recommends Claude Sonnet 4"
- "Source: rubric v1.0, based on SWE-bench performance"

This explanation can be:

- Available on request ("Why this model?")
- Included in response metadata for debugging
- Logged for analytics and rubric validation

## Model Provider

We use **OpenRouter** as the model gateway. One API key provides access to 300+ models
from all major providers (Anthropic, OpenAI, Google, Meta, Mistral, etc.) with unified
billing and transparent per-token pricing.

Why OpenRouter over direct provider APIs:

- **Model flexibility**: Switch models without managing multiple API keys
- **Cost optimization**: Compare pricing across providers, use cheapest option for task
- **Fallback capability**: If one provider is down, route to another
- **New model access**: Immediate availability when providers release new models
- **Usage tracking**: Unified dashboard across all model usage
- **Not Diamond integration**: OpenRouter's auto-router uses Not Diamond, which makes
  routing decisions in ~60ms

Implementation: `@openrouter/ai-sdk-provider` with Vercel AI SDK 5.0.

## Integration Points

- **Model Intelligence**: Queries for model selection. Provides real benchmark data, not
  guesses.
- **Memory**: Every request triggers context retrieval. Profile at START, memories at
  END.
- **Interface**: Signals how to render responses (chat, rich media, structured reports)
  via AG-UI events.
- **AI Team**: Routes complex requests to specialized agents.
- **Service Connectivity**: Orchestrates access to external services when needed.
- **OpenRouter**: Model gateway for all LLM requests.

## Success Criteria

- We don't think about the Concierge - we just get good responses
- Quick questions feel quick (<300ms to first token), deep analysis feels thorough
- Total preprocessing latency <50ms (imperceptible)
- Cost efficiency improves over static routing (target: 85% reduction from RouteLLM)
- Respects our explicit preferences when provided
- Emotional queries feel warm and appropriate

## Latency Budget

Human perception thresholds define our targets:

| Threshold | Experience                                |
| --------- | ----------------------------------------- |
| <20ms     | Imperceptible - "thinking with" the user  |
| 50-100ms  | Safe preprocessing window                 |
| 100-200ms | Users notice delay but flow uninterrupted |
| >300ms    | Kills collaborative flow                  |
| >1 second | User's thought interrupted                |

**Critical insight**: Time-to-first-token matters more than time-to-last-token.
Streaming output masks processing delays.

**Budget allocation**:

- Cache check: 2-5ms
- Classification: 10-20ms (parallel)
- Context retrieval: 15ms (parallel with classification)
- Query transformation: 10-15ms
- Validation: 10-20ms (parallel)
- **Total: <50ms**

---

## Decisions Made

### Semantic Router for Classification (not LLM-based)

Use embedding-based Semantic Router for initial classification, achieving ~10ms vs.
~5000ms for LLM-based routing. LLM fallback only for edge cases. This answers the open
question about "dedicated fast model vs. self-routing" - neither. Embeddings.

### RouteLLM as Starting Point for Model Routing

Open-source, trained on human preference data, 85% cost reduction while maintaining
quality. Can train custom routers as we collect production data. This gives us
intelligent routing without building from scratch.

### Emotion Detection as First-Class Routing Signal

Don't just treat EMOTIONAL as a task type - detect emotion across ALL requests and use
it to influence routing and response style. This is how we operationalize heart-centered
AI in the preprocessing layer.

### Context Placement Matters

Profile at START, memories at END. Research shows LLMs lose information in the middle of
long contexts. This is a small change with measurable impact.

### Pipeline Architecture Over Middleware (for now)

The research validated middleware patterns (Open WebUI inlet/outlet, NeMo Guardrails),
but we don't need that flexibility yet. Start with explicit pipeline stages that are
easier to reason about. Can add extensibility later if users need custom pipelines.

### Parallel Processing is Non-Negotiable

Run classification, cache check, and retrieval concurrently. Sequential processing would
blow the latency budget. Async-first architecture from day one.

---

## Open Questions

### Implementation Choices

- **Classification model for fallback**: When Semantic Router confidence is low, which
  small/fast LLM handles edge cases? Haiku? GPT-4o-mini?
- **Emotion detection model**: Fine-tuned DistilBERT? Off-the-shelf classifier? What
  emotion taxonomy (basic emotions vs. nuanced)?
- **Cache implementation**: GPTCache? GenerativeCache? Build custom with vector DB we
  already use for memory?

### Product Decisions

- **Clarification UX**: When ambiguity triggers clarification, how does the UI present
  options? Inline suggestions? Modal? Quick-select buttons?
- **Confidence visibility**: Should users see routing confidence? Or keep the magic
  invisible?
- **Multi-intent handling**: When a query has multiple intents, do we respond to all in
  one response, or ask to focus?

### Future Enhancements

- **Proactive suggestions**: Research shows ChatGPT Pulse prepares overnight briefs.
  Post-M3 territory, but worth noting for Scheduled Agents design.
- **Voice-aware context**: For voice input, prosody carries emotional nuance that text
  classification misses. Consider voice-specific emotion detection.
- **Personalized routing**: Research shows GNN-based routers can learn user preferences.
  Track which models users respond well to (implicit signals) and calibrate over time.

---

## Research References

Key sources that informed these decisions:

- **Semantic Router**: Aurelio Labs, sub-10ms classification via embeddings
- **RouteLLM**: LMSYS/ICLR 2025, open-source trained router
- **LLMLingua**: Microsoft, 10-20x prompt compression
- **DSPy**: Stanford, automatic prompt optimization
- **"Lost in the middle"**: Research on attention patterns in long contexts
- **Martian/Not Diamond**: Commercial routers powering OpenRouter
- **GPTCache/GenerativeCache**: Semantic caching implementations
- **CLAM framework**: Stanford, ambiguity detection via log probabilities
