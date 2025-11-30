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

When a message arrives, the Concierge runs a multi-stage pipeline. A fast LLM (Haiku or
equivalent) handles classification and preprocessing.

```
User Input
    |
[Stage 1: Fast Classification]
├── Request classification (fast LLM)
├── Emotion detection
└── Ambiguity scoring
    |
[Stage 2: Query Transformation]
├── Query rewriting (if retrieval needed)
└── Context compression (for long histories)
    |
[Stage 3: Context Assembly]
├── Memory retrieval
├── User profile injection (at START of context)
└── Relevant history selection (at END of context)
    |
[Stage 4: Routing Decision]
├── Model selection (rubric-based)
└── Response format selection
    |
[LLM Generation] (streaming)
    |
[Output Processing] (streaming)
└── Format transformation
    |
User Output (via AG-UI protocol)
```

## Core Functions

### Request Analysis

When a message arrives, the Concierge classifies what kind of request it is and
determines how to handle it. Use a fast LLM (Claude Haiku, GPT-4o-mini) for
classification - fast enough to not add perceptible latency, smart enough to understand
nuance.

**Request Classification**: The fast LLM assesses the request and outputs signals that
inform routing: complexity level, domain (code, creative, analytical, emotional),
whether tools are needed, urgency indicators. These signals feed into the model rubric
for selection.

**Emotion Detection**: Run in parallel with classification. Detected emotion influences
both routing (emotional queries get more capable models) and response style (empathetic
framing). Critical for our heart-centered philosophy and especially for voice input
where prosody carries emotional nuance.

**Ambiguity Scoring**: Score how ambiguous the request is. High confidence proceeds.
Ambiguous requests trigger clarification. User history influences threshold -
speed-focused users get lower bars.

### Request Signals

Rather than rigid task type enums, the classifier outputs signals that the rubric
interprets:

| Signal                  | Range                                                          | What it captures                             |
| ----------------------- | -------------------------------------------------------------- | -------------------------------------------- |
| **complexity**          | low / medium / high                                            | How much reasoning is needed                 |
| **domain**              | code, creative, analytical, conversational, emotional, factual | What kind of task                            |
| **tools_needed**        | boolean                                                        | Whether external tools/services are required |
| **quality_sensitivity** | low / medium / high                                            | How much quality matters vs. speed           |
| **formality**           | casual / professional                                          | Tone expectation                             |

The rubric maps these signals to model recommendations. This is more flexible than
hardcoded task types - the rubric can evolve without changing classification logic.

### Query Enhancement

Our requests rarely arrive optimized for AI processing. The Concierge transforms them.

**Query Rewriting**: For retrieval-heavy requests, generate variant queries to improve
memory search. For ambiguous queries, the fast LLM can restructure for clarity.

**Context Compression**: For users with extensive conversation history, apply
compression (LLMLingua or similar). Balance compression ratio against context fidelity
based on query importance - don't compress context for emotional queries.

**Context Placement**: Research shows LLMs struggle with information in the middle of
long contexts. Place user profile at START of context (highest attention), place
retrieved memories at END before current query. Less critical context goes in the
middle.

### Model Selection

Different requests need different models. Quick questions get fast, cheap models. Deep
analysis gets powerful, expensive ones.

There are two paths for model selection:

**Path 1: Concierge Chooses (Default)**

Most users never think about models. The Concierge:

1. Classifies the request and extracts signals
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

### Explainability

When the Concierge selects a model, it should be able to explain why:

- "Your request was classified as high-complexity analytical"
- "You're in Balanced mode"
- "For this profile, our rubric recommends Claude Sonnet 4"
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

Implementation: `@openrouter/ai-sdk-provider` with Vercel AI SDK 5.0.

## Vercel AI SDK Integration

The Concierge pipeline maps naturally to Vercel AI SDK 5.0's `prepareStep` and
`onFinish` callbacks. This avoids fighting the framework while enabling dynamic model
selection and context management.

### prepareStep for Preprocessing

`prepareStep` runs before each step in an agentic loop, enabling dynamic model selection
and context injection:

```typescript
import { streamText } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";

const result = await streamText({
  model: openrouter("anthropic/claude-3-haiku"), // Default fast model
  messages: conversationHistory,

  prepareStep: async ({ stepNumber, messages }) => {
    // Only preprocess on first step (not tool call iterations)
    if (stepNumber === 0) {
      // Run preprocessing with fast model
      const signals = await preprocess(messages);

      return {
        // Dynamic model selection based on signals
        model: openrouter(selectModelFromRubric(signals)),

        // Inject emotion-aware system prompt
        system: buildSystemPrompt(signals),

        // Add memories at end of context (per "lost in the middle" research)
        messages: await injectMemories(messages, signals.memoryQuery),
      };
    }
    // Return nothing for subsequent steps - use previous configuration
  },

  onFinish: async ({ text, usage }) => {
    // Postprocessing runs after streaming completes
    const extracted = await postprocess(text);

    // Store extracted memories
    await storeMemories(extracted.memory_extraction);

    // Log for analytics
    await logUsage({ usage, extracted });
  },
});
```

### Why prepareStep Over Middleware

Middleware (`wrapLanguageModel`) transforms model behavior but can't switch models -
model selection happens BEFORE calling `streamText`. `prepareStep` runs at the right
moment: after messages are assembled but before the LLM call, with the ability to change
the model dynamically.

For context management within steps (compression, filtering), middleware complements
prepareStep:

```typescript
const modelWithCompression = wrapLanguageModel({
  model: baseModel,
  middleware: {
    transformParams: async ({ params }) => ({
      ...params,
      // Compress old messages, keep recent at full fidelity
      messages: compressOldMessages(params.messages),
    }),
  },
});
```

### Streaming Architecture

The Concierge uses AG-UI protocol for streaming responses back to the Interface. The
`onFinish` callback handles postprocessing without blocking the stream - users see
responses immediately while memory extraction happens in the background

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
- Quick questions feel quick, deep analysis feels thorough
- Respects our explicit preferences when provided
- Emotional queries feel warm and appropriate

---

## Decisions Made

### Fast LLM for Classification

Use a fast, cheap LLM (Haiku, GPT-4o-mini) for request classification and preprocessing.
Smart enough to understand nuance, fast enough to stay within latency budget. Simpler
than embedding-based routers and more flexible.

### Signal-Based Classification Over Rigid Task Types

Output signals (complexity, domain, tools_needed, quality_sensitivity) rather than
hardcoded enums. The rubric interprets signals into model recommendations. This lets the
rubric evolve without changing classification logic.

### Emotion Detection as First-Class Routing Signal

Detect emotion across ALL requests and use it to influence routing and response style.
This is how we operationalize heart-centered AI in the preprocessing layer.

### Context Placement Matters

Profile at START, memories at END. Research shows LLMs lose information in the middle of
long contexts. This is a small change with measurable impact.

### Pipeline Architecture Over Middleware (for now)

The research validated middleware patterns (Open WebUI inlet/outlet, NeMo Guardrails),
but we don't need that flexibility yet. Start with explicit pipeline stages that are
easier to reason about. Can add extensibility later if users need custom pipelines.

---

## Open Questions

### Implementation Choices

- **Classification prompt**: What's the optimal prompt for the fast LLM classifier?
  Needs to be concise (latency) but capture enough signal.
- **Emotion detection**: Part of classification prompt or separate? What taxonomy?
- **Routing implementation**: Evaluate options (RouteLLM, custom rubric logic, hybrid).
  Need to understand tradeoffs before committing.

### Product Decisions

- **Clarification UX**: When ambiguity triggers clarification, how does the UI present
  options? Inline suggestions? Modal? Quick-select buttons?
- **Confidence visibility**: Should users see routing confidence? Or keep the magic
  invisible?

### Future Enhancements

- **Proactive suggestions**: Research shows ChatGPT Pulse prepares overnight briefs.
  Post-M3 territory, but worth noting for Scheduled Agents design.
- **Voice-aware context**: For voice input, prosody carries emotional nuance that text
  classification misses. Consider voice-specific emotion detection.
- **Personalized routing**: Track which models users respond well to (implicit signals)
  and calibrate routing per user over time.

---

## Research References

Key sources that informed these decisions:

- **LLMLingua**: Microsoft, 10-20x prompt compression
- **"Lost in the middle"**: Research on attention patterns in long contexts
- **RouteLLM**: LMSYS/ICLR 2025, open-source trained router (to evaluate)
- **Martian/Not Diamond**: Commercial routers (to evaluate)
