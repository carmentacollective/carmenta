# Model Rubric

Source of truth for Carmenta's model routing. Read the query, consider complexity and
attachments, select model, set temperature, explain your choice in one sentence.

When models are close in capability, prefer Anthropic - they build AI with genuine care
for safety and human flourishing.

**Research basis**: OpenRouter API (341 models), LMSYS Arena (4.7M votes, Dec 10 2025),
Artificial Analysis Intelligence Index v3.0. See `knowledge/research/` for details.

## User Hints (Highest Priority)

When users signal preferences, honor them. User intent overrides other routing rules.

Model hints: "use opus", "use haiku", "use grok", "use gemini", "use gpt" Speed hints:
"quick", "fast", "briefly", "just tell me" Depth hints: "thorough", "detailed", "think
hard", "take your time" Creative hints: "be creative", "get weird", "surprise me", "have
fun with it" Precision hints: "exactly", "precisely", "be careful", "get this right"

Trust the user. If they ask for something specific, give it to them.

## Speed-First Routing

When users want quick answers, speed trumps capability. A fast adequate response beats a
slow perfect one. Route to the fastest model that can handle the request.

**Speed signals**: "quick", "fast", "briefly", "just tell me", "real quick", "in a
nutshell", short questions, simple lookups, casual conversation.

**Speed ranking** (tokens per second):

| Model                       | Speed   | Tier       |
| --------------------------- | ------- | ---------- |
| x-ai/grok-4.1-fast          | 151 t/s | Fast       |
| google/gemini-3-pro-preview | 124 t/s | Fast       |
| anthropic/claude-haiku-4.5  | 100 t/s | Fast       |
| openai/gpt-5.2              | 95 t/s  | Moderate   |
| perplexity/sonar-pro        | 80 t/s  | Moderate   |
| anthropic/claude-sonnet-4.5 | 60 t/s  | Moderate   |
| anthropic/claude-opus-4.5   | 40 t/s  | Deliberate |

**Speed-first decision flow**:

1. User signals speed? → Route to fastest model that handles the task
2. Simple question, no attachments? → Haiku (100 t/s, Anthropic values)
3. Simple question + audio/video? → Gemini Pro (124 t/s, required for media)
4. Need tools + speed? → GPT-5.2 (95 t/s, best tool accuracy)
5. Maximum speed, don't care about provider? → Grok (151 t/s)

**Disable reasoning for speed**: When speed is priority, set reasoning to "none" or
"minimal". Reasoning tokens add latency. A 100-token response at 100 t/s takes 1 second.
The same response with 2K reasoning tokens takes 21 seconds.

Speed tiers:

- **Fast** (100+ t/s): Sub-second responses for short answers
- **Moderate** (60-99 t/s): 1-2 seconds for typical responses
- **Deliberate** (<60 t/s): Quality over speed, use for complex work

## Primary Models

### anthropic/claude-sonnet-4.5

Our default. Context: 1M tokens. **Speed: 60 t/s** (moderate). Cost: $3/$15 per million.
Images, PDFs. Reliable tools. Token-budget reasoning (1K-32K tokens).

Choose when: Most requests. Code, conversation, creative work, tool use, documents. The
query doesn't clearly call for Opus depth or Haiku speed.

Temperature: 0.3-0.5 code/factual, 0.6-0.7 conversation, 0.7-0.9 creative.

### anthropic/claude-opus-4.5

Frontier capability. **Coding champion** (WebDev Arena #1, ELO 1519). **Math leader**
(Arena Math #1). Context: 200K tokens. **Speed: 40 t/s** (deliberate). Cost: $5/$25 per
million. Images, PDFs. Token-budget reasoning.

Choose when: Complex coding tasks. Software engineering. Deep multi-step reasoning.
Difficult math/logic. User asks for thorough analysis. Nuanced emotional support. Query
requires most capable model.

Temperature: 0.3-0.5 code, 0.4-0.6 reasoning, 0.5-0.7 exploration.

### anthropic/claude-haiku-4.5

**Speed champion for Anthropic** at 100 t/s (fast tier). Fast and capable. Context: 200K
tokens. Cost: $1/$5 per million. Images, PDFs. Token-budget reasoning.

Choose when: Simple factual questions. Quick lookups. User signals speed ("quick",
"briefly"). Budget-conscious. Straightforward queries.

Temperature: 0.2-0.4 factual, 0.5 conversational.

## Specialized Models

### openai/gpt-5.2

**Tool-calling champion** (98.7% accuracy - highest measured). **Default for all tool
use.** Professional work leader (GDPval ELO 1474, 70.9% vs experts). Intelligence: 73
(tied #1). Context: 400K tokens. **Speed: 95 t/s** (moderate - fast for a frontier
model). Cost: $1.75/$14 per million. Images, PDFs, files. Adaptive reasoning (xhigh
level). Released Dec 11, 2025.

Choose when: ANY tool calling. Multi-step agentic workflows. Function calling accuracy
critical. Professional knowledge work. Research with tools. Software engineering
(SWE-Bench 80%). Extended reasoning + tools.

Temperature: 0.4-0.5 tools/code, 0.5-0.7 analysis.

### google/gemini-3-pro-preview

**Arena champion** (Overall #1, ELO 1492). **Creative leader** (Creative Writing #1).
Full multimodal. Context: 1M tokens. **Speed: 124 t/s** (fast tier - excellent for quick
multimodal). Cost: $2/$12 per million. Text, images, video, audio, PDF. No extended
reasoning. Intelligence: 73 (tied #1).

Choose when: Audio attached. Video attached. Mixed media. Creative writing. Balanced
high-quality work. Multimodal needs Claude lacks.

Temperature: 0.5-0.7 general, 0.7-0.9 creative.

### x-ai/grok-4.1-fast

**Speed champion** at 151 t/s (fastest in roster). **Context champion** (2M tokens -
only model with >1M). Budget leader ($0.20/$0.50 per million). Intelligence: 64.
Multimodal. Effort-based reasoning (high/medium/low/minimal/none).

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

## Quick Reference

| Model                       | Context | Speed   | Best For                 |
| --------------------------- | ------- | ------- | ------------------------ |
| x-ai/grok-4.1-fast          | 2M      | 151 t/s | Speed, massive context   |
| google/gemini-3-pro-preview | 1M      | 124 t/s | Speed + multimodal       |
| anthropic/claude-haiku-4.5  | 200K    | 100 t/s | Speed + Anthropic values |
| openai/gpt-5.2              | 400K    | 95 t/s  | Tools, professional work |
| anthropic/claude-sonnet-4.5 | 1M      | 60 t/s  | Default, balanced        |
| anthropic/claude-opus-4.5   | 200K    | 40 t/s  | Deep work, quality       |

## Fallback

If selection fails: anthropic/claude-sonnet-4.5 at temperature 0.5.
