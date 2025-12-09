# Concierge

The Concierge operates before and after every model call. Pre-query: understands needs,
assembles context, selects model. Post-response: formats output, adds enhancements.

## Why This Exists

Every AI interaction involves choices: which model, what context, how to structure the
query, what format for response. Most interfaces push these to users or use rigid
defaults.

The Concierge makes choices intelligently per request. Quick questions get fast models.
Complex research gets capable models with relevant context. Users experience a simple
interface while the Concierge handles complexity.

## Pre-Query Phase

Before the message reaches the main model:

Understands what is needed by inferring complexity from the query (not user-selected
modes), detecting capability requirements like vision or tools, considering attachments,
and reading implicit signals.

Assembles context by searching knowledge base, pulling user memories and preferences,
and gathering conversation context.

Selects the right model by routing based on actual needs using the model rubric. Shows
model selection explanation in response metadata.

Determines reasoning level by assessing task complexity and deciding if extended
reasoning would improve quality enough to justify the cost.

Enriches the query by structuring the prompt for optimal performance and adding context
the user did not provide.

## Post-Response Phase

After the model responds:

Shapes output by transforming to appropriate UI. Code gets syntax highlighting.
Comparisons become tables. Research becomes reports.

Adds enhancements including follow-up suggestions, related resources, and clarifying
questions if needed.

Maintains personality through consistent voice and emotional attunement.

## Routing

### @carmenta Detection (Entity Mode)

Before any other routing, the Concierge checks for @carmenta mentions. When detected,
the message routes to Carmenta entity mode rather than to an LLM.

Entity mode handles:

- Feedback and suggestions → GitHub Issues integration
- Bug reports → GitHub Issues with structured context
- Settings changes → Apply directly (confirm if destructive)
- Help requests → Answer from product knowledge

The response comes from Carmenta herself with distinct visual treatment, not from an
LLM. See [carmenta-interaction.md](./carmenta-interaction.md) for full details.

### Standard Routing

For messages without @carmenta, the Concierge infers what is needed from the query
itself rather than relying on user-selected speed modes.

Signals read: Query length and complexity. Explicit signals like "quick question."
Attachment types (image needs vision). Tool requirements. Conversation context.
Emotional content.

Decisions made: Which model. What temperature. What reasoning level. How much context.
Which tools. Response depth.

The model rubric at knowledge/model-rubric.md provides recommendations. The Concierge
reads this at runtime so updates do not require code changes.

## Reasoning Level Determination

For models that support extended reasoning (see model-rubric.md), the Concierge
determines appropriate reasoning effort:

High reasoning when: Complex multi-step problems. Mathematical or logical reasoning.
Deep research and synthesis. User explicitly asks for thorough analysis. Quality matters
more than speed or cost.

Medium reasoning when: Moderate complexity. Balanced quality and speed needs. Standard
explanations. Default for reasoning-capable models on non-trivial queries.

Low reasoning when: Simpler questions. User signals speed preference. Cost sensitivity.

No reasoning when: Quick lookups. Creative writing (reasoning can reduce creativity).
Conversational exchanges. Speed or cost is priority.

Reasoning is transparent: Users see the AI's thought process via ReasoningDisplay
component. Reasoning tokens are stored with messages for continuity and analytics.

## Transparency

Users see why Carmenta made choices: "Searched your project files, found 3 relevant
docs." "Using Opus for this complex analysis." "Quick lookup, using Haiku for speed."
"Enabling extended reasoning for this deep analysis."

Not classification labels like "CODE task" but actual transparency about what was done.

When reasoning is enabled, users see the AI's thinking process via the ReasoningDisplay
component. This builds trust and helps users understand how conclusions were reached.

## Response Formatting

Rich UI when: Structured data. User needs selections. Interactivity aids comprehension.

Conversational text when: Quick exchanges. Explaining concepts. Emotional interactions.
Creative content.

Progressive enhancement: Basic response streams immediately. Enhancements added after.
Page continues building.

## User Controls

Optional overrides, not required inputs:

Speed preference: "Quick answer" or "take your time."

Model override: Explicitly select a model. Concierge still assembles context.

Format preference: "Give me a table" or "just explain it."

Most users never touch these.

## Implementation Details

The Concierge returns a ConciergeResult with four fields:

- modelId: OpenRouter model identifier (e.g., "anthropic/claude-sonnet-4.5")
- temperature: Float 0.0-1.0 for response variability
- explanation: One warm sentence explaining the routing decision (shown to users)
- reasoning: Configuration object with { enabled, effort, maxTokens }

Reasoning configuration:

For Anthropic models: Uses maxTokens (1K-32K) to set budget directly.

For effort-based models (Grok): Uses effort level (high/medium/low/none).

OpenRouter accepts either effort OR max_tokens, not both. The Concierge determines
effort level and we convert to max_tokens for Anthropic models using these defaults:

- high: 16,000 tokens
- medium: 8,000 tokens
- low: 4,000 tokens

## Integration Points

Knowledge Base: Pre-query searches for context. Memory: Preferences inform all
decisions. Interface: Post-response determines rendering. Model Intelligence: Rubric
provides recommendations. Reasoning Tokens: Extended thinking capability for complex
tasks. Improvement Loop: Evaluates concierge decisions including reasoning ROI.

## Decisions Made

Inference over classification: No task types like CODE or REASONING. Assess needs and
route accordingly.

No required user input: Speed modes and model selection are optional overrides.

Rubric at runtime: Model recommendations in knowledge folder. No code changes for
updates.

Transparency by default: Show what the Concierge did. Display reasoning when enabled.

Post-response as first-class: Formatting and enhancement are core, not afterthoughts.

Field naming clarity: The concierge's output field is called "explanation" (not
"reasoning") to avoid confusion with reasoning tokens from the model. Explanation = why
we chose this model. Reasoning = the model's extended thinking.

## Open Questions

Inference accuracy: How well can complexity be inferred from query alone? Need real
usage data to calibrate.

Reasoning level calibration: How accurately can we determine appropriate reasoning
effort from query alone? Production data needed to tune.

Latency budget: Pre-query adds time before first token. Target under 500ms for inference
plus context assembly. Reasoning adds additional latency.

Context assembly depth: How much KB search per query? Balance relevance and latency.

Post-response timing: Enhancements after or integrated? How to stream while enhancing?

Reasoning ROI: Does reasoning quality improvement justify the cost and latency? Need
analytics to measure.

## Success Criteria

Inference correctly assesses query complexity. Reasoning level determination is
appropriate. Context assembly improves response quality. Post-response formatting
matches content.

Users feel understood. Responses are appropriately fast or thorough. Formatting makes
content more useful. Reasoning transparency builds trust.

Users can see what the Concierge did. Model selection explanation is understandable.
Reasoning process (when shown) helps users understand how conclusions were reached.
Builds trust in the system.
