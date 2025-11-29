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

## Core Functions

### Request Analysis

When a message arrives, the Concierge classifies what kind of request it is and
determines how to handle it. Classification should happen fast enough that we don't
perceive delay.

### Query Enhancement

Our requests rarely arrive optimized for AI processing. The Concierge transforms them by
adding context from Memory, structuring prompts for optimal model performance, and
aligning response tone with our preferences.

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
5. Selects the optimal model and configures it (temperature, etc.)
6. Explains its reasoning in response metadata

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

Beyond model selection, the Concierge determines how to respond: direct chat completion,
purpose-built AG-UI interface, tool routing, multi-agent dispatch, or asking for
clarification when the request is too ambiguous.

## Controls

While the Concierge handles complexity automatically, we get simple overrides:

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

Implementation: `@openrouter/ai-sdk-provider` with Vercel AI SDK 5.0.

## Integration Points

- **Model Intelligence**: Queries for model selection. Provides real benchmark data, not
  guesses.
- **Memory**: Every request triggers context retrieval.
- **Interface**: Signals how to render responses (chat, rich media, structured reports).
- **AI Team**: Routes complex requests to specialized agents.
- **Service Connectivity**: Orchestrates access to external services when needed.
- **OpenRouter**: Model gateway for all LLM requests.

## Success Criteria

- We don't think about the Concierge - we just get good responses
- Quick questions feel quick, deep analysis feels thorough
- Cost efficiency without our involvement
- Respects our explicit preferences when provided

---

## Open Questions

### Architecture

- **Classification approach**: Dedicated fast model for routing vs. letting the main
  model self-route? Fast model adds latency but saves cost on simple requests.
- **Latency budget**: What's acceptable end-to-end? How does that break down across
  classification, context retrieval, and model inference?
- **Error handling**: What happens when classification fails or the selected model is
  unavailable?

### Product Decisions

- **Request type taxonomy**: What categories of requests do we recognize? Initial
  thinking: quick lookup, conversation, deep analysis, creative generation, task
  execution, emotional support. Is this complete? Too granular?
- **Controls**: What knobs do we get? Speed/quality slider? Response mode selection?
  Persona preferences? Or keep it fully automatic?
- **AG-UI triggering**: When does a response become a purpose-built interface vs. chat?
  Our choice, Concierge choice, or both?

### Technical Specifications Needed

- Classification result schema and request type enum
- API contract: input/output types for the Concierge
- Prompt templates for classification and enhancement
- Model selection decision tree with specific model mappings
- Protocol for signaling response type to Interface

### Research Needed

- Benchmark different classification approaches (dedicated model vs. self-routing)
- Analyze latency/cost tradeoffs across model tiers
- Study how other products handle automatic model selection (if any do it well)

### To Investigate: Middleware/Pipeline Architecture

Open WebUI uses inlet/outlet filters that intercept requests and responses. Better
Chatbot has visual workflows that transform data between steps. Both allow cross-cutting
concerns (logging, transformation, validation, routing) without touching core logic.

Currently the Concierge handles preprocessing as a monolith. A middleware pattern could
allow:

- Pluggable request transformers (add context, rewrite queries, inject instructions)
- Pluggable response processors (format output, extract artifacts, trigger side effects)
- User-defined pipelines for custom workflows
- Easier testing of individual transformation steps

Questions to explore:

- Does Carmenta need this flexibility, or is the Concierge sufficient?
- Would middleware add latency that hurts the "speed of thought" goal?
- Is this solving a real problem or adding complexity prematurely?
- Could start simple (Concierge only) and add middleware later if needed?

Reference implementations to study:

- Open WebUI pipeline system in ../reference/open-webui/
- Better Chatbot workflow engine in ../reference/better-chatbot/
