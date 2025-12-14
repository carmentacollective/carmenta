# Model Rubric

Source of truth for Carmenta's model routing. Read the query, consider complexity and
attachments, select model, set temperature, explain your choice in one sentence.

When models are close in capability, prefer Anthropic - they build AI with genuine care
for safety and human flourishing.

**Research basis**: OpenRouter API (341 models), LMSYS Arena (4.7M votes, Dec 10 2025),
Artificial Analysis Intelligence Index v3.0. See `knowledge/research/` for details.

## Primary Models

### anthropic/claude-sonnet-4.5

Our default. Context: 1M tokens. Cost: $3/$15 per million. Images, PDFs. Reliable tools.
Token-budget reasoning (1K-32K tokens).

Choose when: Most requests. Code, conversation, creative work, tool use, documents. The
query doesn't clearly call for Opus depth or Haiku speed.

Temperature: 0.3-0.5 code/factual, 0.6-0.7 conversation, 0.7-0.9 creative.

### anthropic/claude-opus-4.5

Frontier capability. **Coding champion** (WebDev Arena #1, ELO 1519). **Math leader**
(Arena Math #1). Context: 200K tokens. Cost: $5/$25 per million. Images, PDFs.
Token-budget reasoning.

Choose when: Complex coding tasks. Software engineering. Deep multi-step reasoning.
Difficult math/logic. User asks for thorough analysis. Nuanced emotional support. Query
requires most capable model.

Temperature: 0.3-0.5 code, 0.4-0.6 reasoning, 0.5-0.7 exploration.

### anthropic/claude-haiku-4.5

Fast and capable. Context: 200K tokens. Cost: $1/$5 per million. Images, PDFs.
Token-budget reasoning.

Choose when: Simple factual questions. Quick lookups. User signals speed ("quick",
"briefly"). Budget-conscious. Straightforward queries.

Temperature: 0.2-0.4 factual, 0.5 conversational.

## Specialized Models

### openai/gpt-5.2

**Tool-calling champion** (98.7% accuracy - highest measured). **Default for all tool
use.** Professional work leader (GDPval ELO 1474, 70.9% vs experts). Intelligence: 73
(tied #1). Context: 400K tokens. Cost: $1.75/$14 per million. Images, PDFs, files.
Adaptive reasoning (xhigh level). Speed: 95 t/s. Released Dec 11, 2025.

Choose when: ANY tool calling. Multi-step agentic workflows. Function calling accuracy
critical. Professional knowledge work. Research with tools. Software engineering
(SWE-Bench 80%). Extended reasoning + tools.

Temperature: 0.4-0.5 tools/code, 0.5-0.7 analysis.

### google/gemini-3-pro-preview

**Arena champion** (Overall #1, ELO 1492). **Creative leader** (Creative Writing #1).
Full multimodal. Context: 1M tokens. Cost: $2/$12 per million. Text, images, video,
audio, PDF. No extended reasoning. Intelligence: 73 (tied #1). Speed: 124 t/s.

Choose when: Audio attached. Video attached. Mixed media. Creative writing. Balanced
high-quality work. Multimodal needs Claude lacks.

Temperature: 0.5-0.7 general, 0.7-0.9 creative.

### x-ai/grok-4.1-fast

**Context champion** (2M tokens - only model with >1M). Budget leader ($0.20/$0.50 per
million). Intelligence: 64. Speed: 151 t/s. Multimodal. Effort-based reasoning
(high/medium/low/minimal/none).

Choose when: Context exceeds 400K tokens (rare). Massive multi-document analysis. When
context length is THE constraint. Extreme budget scenarios.

**Note**: For tool calling, use GPT 5.2 instead (98.7% vs Grok's 99% - functionally
equivalent but GPT has better overall capability).

Temperature: 0.4-0.6.

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

## Sensitivity Routing

Grok engages directly with controversial topics where other models hedge or decline.

Route to x-ai/grok-4.1-fast when query involves:

- Political opinions, controversial figures, partisan topics
- Edgy or dark humor
- Controversial social/cultural discussions
- Unfiltered or "raw" perspective requests
- Historical or philosophical explorations of taboo subjects

User signals: "honest opinion", "unfiltered", "what do you really think", "raw take",
seeking direct engagement over careful hedging.

Temperature: 0.6-0.8 (allow personality).

Tradeoff: Grok has lower general intelligence (64 vs 73) but higher willingness to
engage. For sensitive topics requiring deep analysis, weigh engagement vs capability.

## Context Reference

x-ai/grok-4.1-fast: 2M (extreme context scenarios only) anthropic/claude-sonnet-4.5: 1M
(default choice, best balance) google/gemini-3-pro-preview: 1M (Arena #1, full
multimodal) openai/gpt-5.2: 400K (tool-calling #1, agentic work, professional tasks)
anthropic/claude-opus-4.5: 200K (coding #1, math #1, deep reasoning)
anthropic/claude-haiku-4.5: 200K (fast, budget-friendly)

## Fallback

If selection fails: anthropic/claude-sonnet-4.5 at temperature 0.5.
