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
reasoning in response metadata.

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

Inference over selection: The system infers what is needed from the query itself rather
than relying on user-selected speed modes.

Signals read: Query length and complexity. Explicit signals like "quick question."
Attachment types (image needs vision). Tool requirements. Conversation context.
Emotional content.

Decisions made: Which model. How much context. Which tools. Response depth.

The model rubric at knowledge/model-rubric.md provides recommendations. The Concierge
reads this at runtime so updates do not require code changes.

## Transparency

Users see why Carmenta made choices: "Searched your project files, found 3 relevant
docs." "Using Opus for this complex analysis." "Quick lookup, using Haiku for speed."

Not classification labels like "CODE task" but actual transparency about what was done.

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

## Integration Points

Knowledge Base: Pre-query searches for context. Memory: Preferences inform all
decisions. Interface: Post-response determines rendering. Model Intelligence: Rubric
provides recommendations. Improvement Loop: Evaluates concierge decisions.

## Decisions Made

Inference over classification: No task types like CODE or REASONING. Assess needs and
route accordingly.

No required user input: Speed modes and model selection are optional overrides.

Rubric at runtime: Model recommendations in knowledge folder. No code changes for
updates.

Transparency by default: Show what the Concierge did.

Post-response as first-class: Formatting and enhancement are core, not afterthoughts.

## Open Questions

Inference accuracy: How well can complexity be inferred from query alone? Need real
usage data to calibrate.

Latency budget: Pre-query adds time before first token. Target under 500ms for inference
plus context assembly.

Context assembly depth: How much KB search per query? Balance relevance and latency.

Post-response timing: Enhancements after or integrated? How to stream while enhancing?

## Success Criteria

Inference correctly assesses query complexity. Context assembly improves response
quality. Post-response formatting matches content.

Users feel understood. Responses are appropriately fast or thorough. Formatting makes
content more useful.

Users can see what the Concierge did. Reasoning is understandable. Builds trust.
