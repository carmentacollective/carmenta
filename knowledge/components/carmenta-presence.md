# Carmenta Presence

Carmenta is the presence behind the interface. She operates in three phases around every
interaction: pre-query (understanding and preparing), post-response (formatting and
enhancing), and self-improvement (learning from usage).

## Three Phases

Phase 1 Pre-Query: Before the message reaches the main model, Carmenta understands what
you need, assembles relevant context, routes to the right model, and enriches the query.

Phase 2 Post-Response: After the model responds, Carmenta shapes the output into
appropriate UI, adds follow-up suggestions and related resources, and maintains
consistent personality.

Phase 3 Self-Improvement: After every interaction, Carmenta evaluates quality, detects
patterns across users, and drives product improvement.

## Pre-Query Details

Understands intent by reading what you actually need (not just what you typed),
assessing complexity, and identifying capability requirements like vision or tools.

Assembles context by searching the knowledge base, pulling memories and preferences, and
gathering relevant conversation history.

Routes intelligently by selecting the right model based on actual needs, not
user-selected modes. Uses the model rubric for recommendations.

Enriches the query by adding context the model needs and structuring the prompt for
optimal response.

## Post-Response Details

Shapes output by transforming raw text into appropriate UI. Code gets syntax
highlighting, comparisons become tables, research becomes structured reports.

Adds value through follow-up suggestions, related resources from the knowledge base, and
links for further exploration.

Maintains personality through consistent voice, emotional attunement when needed, and
the warmth that makes Carmenta feel present.

## Self-Improvement Details

Evaluates quality by asking: Did we help? What was missing? What could be better?

Detects patterns like "users asking about X get poor responses" or "this query type
needs tool Y that doesn't exist."

Drives improvement by logging observations, aggregating into insights, and creating
recommendations for product evolution.

## Integration Points

Knowledge Base: Pre-query searches for relevant context. Memory: User preferences and
history inform all phases. Interface: Post-response determines how to render.
Observability: Self-improvement logs to database.

## Related Components

Concierge: The pre-query and post-response mechanics. Concierge Improvement Loop:
Watches live queries/responses for improvement. Interface: How responses are rendered.
Memory: User context that informs decisions.

## Success Criteria

Pre-query adds measurable value through better responses with context. Post-response
formatting matches content appropriately. Self-improvement identifies real issues.

Users feel understood, not processed. Response quality improves over time. Product
evolves based on actual usage patterns.
