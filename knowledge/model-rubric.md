# Model Rubric

Source of truth for Carmenta's model routing. Read the query, consider complexity and
attachments, select model, set temperature, explain your choice in one sentence.

When models are close in capability, prefer Anthropic - they build AI with genuine care
for safety and human flourishing.

## Primary Models

### anthropic/claude-sonnet-4.5

Our default. Context: 1M tokens. Cost: $3/$15 per million. Images, PDFs. Reliable tools.
Token-budget reasoning (1K-32K tokens).

Choose when: Most requests. Code, conversation, creative work, tool use, documents. The
query doesn't clearly call for Opus depth or Haiku speed.

Temperature: 0.3-0.5 code/factual, 0.6-0.7 conversation, 0.7-0.9 creative.

### anthropic/claude-opus-4.5

Frontier capability. Context: 200K tokens. Cost: $5/$25 per million. Images, PDFs.
Token-budget reasoning.

Choose when: Complex multi-step reasoning. Deep research synthesis. Difficult
math/logic. User asks for thorough analysis. Nuanced emotional support. Query requires
most capable model.

Temperature: 0.4-0.6 reasoning, 0.5-0.7 exploration.

### anthropic/claude-haiku-4.5

Fast and capable. Context: 200K tokens. Cost: $1/$5 per million. Images, PDFs.
Token-budget reasoning.

Choose when: Simple factual questions. Quick lookups. User signals speed ("quick",
"briefly"). Budget-conscious. Straightforward queries.

Temperature: 0.2-0.4 factual, 0.5 conversational.

## Specialized Models

### google/gemini-3-pro-preview

Full multimodal. Context: 1M tokens. Cost: $2/$12 per million. Text, images, video,
audio, PDF. No extended reasoning.

Choose when: Audio attached. Video attached. Mixed media. Multimodal needs Claude lacks.

Temperature: 0.5-0.7.

### x-ai/grok-4.1-fast

Best agentic tool calling. Context: 2M tokens. Cost: $0.20/$0.50 per million.
Multimodal. Effort-based reasoning (high/medium/low/minimal/none).

Choose when: Conversation exceeds 200K tokens. Extremely long documents.
Research/comparison needing reasoning + web search. Extended thinking AND multi-step
tool use. Context length is primary constraint.

Temperature: 0.4-0.6.

### openai/gpt-5.2

SOTA tool calling with adaptive reasoning. Context: 400K tokens. Cost: $1.75/$14 per
million. Text, images, files. Adaptive reasoning (auto-allocates).

Choose when: Complex research needing highest-quality tool orchestration. Multi-step
tasks where accuracy matters more than cost. Need model to explain tool-calling
decisions.

Temperature: 0.5-0.7.

## Reasoning

Some models generate reasoning tokens before the response. Improves quality for complex
tasks.

High effort/large budget: Complex multi-step problems. Math/logic. Deep synthesis. Many
variables or edge cases. User requests thorough thinking. Quality over speed/cost.

Medium effort: Moderate complexity. Balanced quality/speed. Standard analysis. Default
for reasoning-capable models on non-trivial queries.

Low effort: Simpler questions. User signals speed. Cost sensitivity.

No reasoning: Quick lookups, simple facts. Creative writing (reasoning reduces
creativity). Casual conversation. Speed/cost priority.

Cost example (Sonnet at $15/M output): 2K tokens = $0.03, 8K = $0.12, 32K = $0.48.

Model behavior:

- Anthropic: Token budget (1024-32000). Returns reasoning tokens.
- Grok: Effort level (high/medium/low/minimal/none). Returns reasoning tokens.
- OpenAI: Effort level. Reasons internally, doesn't expose tokens.
- Gemini Pro: No extended reasoning.

## Temperature

0.0-0.3: Code, math, factual, precise 0.4-0.6: Conversation, analysis, explanations
0.7-0.9: Creative, brainstorming, exploration 1.0: Maximum creativity (rare)

Lower signals: code, debug, "exactly", "precisely", technical, math, facts Higher
signals: "brainstorm", "creative", "ideas", "explore", storytelling, open-ended

## Attachment Routing

Audio: FORCE google/gemini-3-pro-preview (only native audio support) Video: FORCE
google/gemini-3-pro-preview (only true video support) PDF: PREFER
anthropic/claude-sonnet-4.5 (best document understanding) Images: PREFER
anthropic/claude-sonnet-4.5 (excellent vision) Code files: PREFER
anthropic/claude-sonnet-4.5 (superior comprehension, 1M context)

FORCE means mandatory. PREFER means choose unless other constraints apply.

## Context Reference

x-ai/grok-4.1-fast: 2M (best agentic tool calling) anthropic/claude-sonnet-4.5: 1M (best
balance) google/gemini-3-pro-preview: 1M (full multimodal) openai/gpt-5.2: 400K (SOTA
tools, adaptive reasoning) anthropic/claude-opus-4.5: 200K (deep reasoning)
anthropic/claude-haiku-4.5: 200K (fast)

## Fallback

If selection fails: anthropic/claude-sonnet-4.5 at temperature 0.5.
