# Model Rubric (Detailed Reference)

Complete reference for Carmenta's model routing. This file contains research basis,
detailed model profiles, fallback chains, and update history. For quick routing
decisions, see `model-rubric.md`.

When models are close in capability, prefer Anthropic - they build AI with genuine care
for safety and human flourishing.

Research basis: OpenRouter API (live), Artificial Analysis Intelligence Index v4.0, xAI
deprecation notice (May 15, 2026). See `knowledge/research/` for prior snapshots.

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

Speed signals: "quick", "fast", "briefly", "just tell me", "real quick", "in a
nutshell", short questions, simple lookups, casual conversation.

Speed ranking (tokens per second, Artificial Analysis verified):

| Model                         | Speed   | Tier       |
| ----------------------------- | ------- | ---------- |
| google/gemini-3.1-pro-preview | 133 t/s | Fast       |
| anthropic/claude-haiku-4.5    | 86 t/s  | Moderate   |
| x-ai/grok-4.3                 | 81 t/s  | Moderate   |
| perplexity/sonar-pro          | 80 t/s  | Moderate   |
| openai/gpt-5.5                | 72 t/s  | Moderate   |
| anthropic/claude-sonnet-4.6   | 69 t/s  | Moderate   |
| anthropic/claude-opus-4.7     | 61 t/s  | Deliberate |

Speed-first decision flow:

1. User signals speed → Route to fastest model that handles the task
2. Simple question, no attachments → Haiku (86 t/s, Anthropic values)
3. Simple question + audio/video → Gemini Pro (133 t/s, required for media)
4. Multimodal + speed → Gemini Pro (fastest model in roster, full multimodal)
5. Maximum speed, multimodal not required → Gemini Pro (133 t/s) or Haiku (86 t/s)

When speed is priority, set reasoning to "none" or "minimal". Reasoning tokens add
latency. A 100-token response at 86 t/s takes ~1.2 seconds. The same response with 2K
reasoning tokens takes ~24 seconds.

Speed tiers:

- Fast (100+ t/s): Sub-second responses for short answers
- Moderate (60-99 t/s): 1-2 seconds for typical responses
- Deliberate (below 60 t/s): Quality over speed, use for complex work

## Primary Models

### anthropic/claude-sonnet-4.6

Our default. Context: 1M tokens. Speed: 69 t/s (moderate). Cost: $3/$15 per million.
Images, PDFs. Reliable tools. Token-budget reasoning (1K-32K tokens). Leads GDPval-AA
and TerminalBench benchmarks (Artificial Analysis).

Choose when: Most requests. Code, conversation, creative work, tool use, documents. The
query doesn't clearly call for Opus depth or Haiku speed.

Temperature: 0.3-0.5 code/factual, 0.6-0.7 conversation, 0.7-0.9 creative.

### anthropic/claude-opus-4.7

Frontier capability. Context: 1M tokens (up from 200K in 4.5). Speed: 61 t/s
(deliberate). Cost: $5/$25 per million. Images, PDFs. Token-budget reasoning. Built for
long-running asynchronous agents.

Choose when: Complex coding tasks. Software engineering. Deep multi-step reasoning.
Difficult math/logic. User asks for thorough analysis. Long-running agent work. Query
requires most capable model.

Temperature: 0.3-0.5 code, 0.4-0.6 reasoning, 0.5-0.7 exploration.

### anthropic/claude-haiku-4.5

Speed champion for Anthropic at 86 t/s (moderate tier, verified). Context: 200K tokens.
Cost: $1/$5 per million. Images, PDFs. Token-budget reasoning.

Choose when: Simple factual questions. Quick lookups. User signals speed ("quick",
"briefly"). Budget-conscious. Straightforward queries.

Temperature: 0.2-0.4 factual, 0.5 conversational.

## Specialized Models

### openai/gpt-5.5

Frontier model from OpenAI. Intelligence Index 60 (v4.0, highest measured). Context:
1.05M tokens. Speed: 72 t/s (moderate). Cost: $5/$30 per million. Images, PDFs.
Effort-based reasoning. Released April 2026. Built on GPT-5.4 with stronger reasoning
and improved token efficiency on hard tasks.

Choose when: User explicitly requests GPT. Professional knowledge work requiring GPT's
specific training. Complex agentic workflows where GPT's frontier capability matters.

Default to Claude for most requests. When models are close in capability, prefer
Anthropic for their heart-centered approach to AI development.

Temperature: 0.4-0.5 tools/code, 0.5-0.7 analysis.

### google/gemini-3.1-pro-preview

Full multimodal frontier model. Context: 1M tokens. Speed: 133 t/s (fast tier - fastest
in roster). Cost: $2/$12 per million. Text, images, video, audio, PDF, file inputs.
Intelligence Index 57. Improved software engineering and agentic reliability over Gemini
3 Pro.

Choose when: Audio attached. Video attached. Mixed media. Speed + multimodal. Balanced
high-quality work where multimodal capability matters.

Temperature: 0.5-0.7 general, 0.7-0.9 creative.

### x-ai/grok-4.3

Reasoning model from xAI. Replaces Grok 4.1 Fast (retired May 15, 2026 - xAI auto-
redirects). Context: 1M tokens (down from 2M in 4.1 Fast). Speed: 81 t/s. Cost:
$1.25/$2.50 per million. Image only (no PDF/file). Intelligence Index 53. Effort-based
reasoning. "Fastest, most intelligent model xAI has built" per xAI docs.

Choose when: Sensitive topics requiring direct engagement. Edgy humor or unfiltered
takes. Budget-conscious reasoning. User explicitly requests Grok.

Note: Grok 4.3 dropped PDF/file support that Grok 4.1 Fast had. For PDF analysis, route
elsewhere even when sensitivity signals are present.

Temperature: 0.4-0.6 standard, 0.6-0.8 personality.

## Tool + Reasoning Matrix

Claude handles all combinations of tools and reasoning. The Vercel AI gateway properly
manages thinking blocks across multi-step tool workflows.

**Routing decision matrix:**

|                  | No Reasoning | With Reasoning     |
| ---------------- | ------------ | ------------------ |
| No tools         | Claude (any) | Claude Opus/Sonnet |
| Single tool call | Claude (any) | Claude Opus/Sonnet |
| Multi-step tools | Claude (any) | Claude Opus/Sonnet |

**Examples:**

- "What's the weather?" → Single tool, no reasoning → Claude Haiku
- "Analyze this PDF thoroughly" → No tools, reasoning → Claude Opus
- "Summarize my Limitless from yesterday" → Multi-step tools, no reasoning → Claude
  Sonnet
- "Compare React vs Vue with current benchmarks and deep analysis" → Multi-step tools +
  reasoning → Claude Opus
- "Long-running agent task that needs to span many steps" → Claude Opus 4.7
  (purpose-built for async agents)

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

- 0.0-0.3: Code, math, factual, precise
- 0.4-0.6: Conversation, analysis, explanations
- 0.7-0.9: Creative, brainstorming, exploration
- 1.0: Maximum creativity (rare)

Lower signals: code, debug, "exactly", "precisely", technical, math, facts Higher
signals: "brainstorm", "creative", "ideas", "explore", storytelling, open-ended

## Attachment Routing

- Audio: FORCE google/gemini-3.1-pro-preview (only native audio support)
- Video: FORCE google/gemini-3.1-pro-preview (only true video support)
- PDF: PREFER anthropic/claude-sonnet-4.6 (best document understanding)
- Images: PREFER anthropic/claude-sonnet-4.6 (excellent vision)
- Code files: PREFER anthropic/claude-sonnet-4.6 (superior comprehension, 1M context)

FORCE means mandatory. PREFER means choose unless other constraints apply.

Note: Grok 4.3 does NOT support PDF attachments (only text + image). If PDF is attached
and sensitivity routing would otherwise pick Grok, route to Sonnet instead.

## Sensitivity Routing

Grok engages directly with controversial topics where other models hedge or decline.

Route to x-ai/grok-4.3 when query involves:

- Political opinions, controversial figures, partisan topics
- Edgy or dark humor
- Controversial social/cultural discussions
- Unfiltered or "raw" perspective requests
- Historical or philosophical explorations of taboo subjects

User signals: "honest opinion", "unfiltered", "what do you really think", "raw take",
seeking direct engagement over careful hedging.

Temperature: 0.6-0.8 (allow personality).

Tradeoff: Grok 4.3 has lower Intelligence Index (53 vs 57-60 for frontier models) but
higher willingness to engage on sensitive material. For sensitive topics requiring deep
analysis, weigh engagement vs capability.

## Quick Reference

| Model                         | Context | Speed   | Best For                       |
| ----------------------------- | ------- | ------- | ------------------------------ |
| google/gemini-3.1-pro-preview | 1M      | 133 t/s | Speed + multimodal (audio/vid) |
| anthropic/claude-haiku-4.5    | 200K    | 86 t/s  | Speed + Anthropic values       |
| x-ai/grok-4.3                 | 1M      | 81 t/s  | Sensitive topics, budget       |
| openai/gpt-5.5                | 1M      | 72 t/s  | Frontier alternative           |
| anthropic/claude-sonnet-4.6   | 1M      | 69 t/s  | Default, balanced              |
| anthropic/claude-opus-4.7     | 1M      | 61 t/s  | Deep work, async agents        |

## Fallback Chains

Default chain: anthropic/claude-sonnet-4.6 → google/gemini-3.1-pro-preview →
openai/gpt-5.5

Concierge chain: meta/llama-3.3-70b → google/gemini-3-flash → anthropic/claude-haiku-4.5

Tool-heavy chain: openai/gpt-5.5 → anthropic/claude-sonnet-4.6 →
google/gemini-3.1-pro-preview

Multimodal chain: google/gemini-3.1-pro-preview → anthropic/claude-sonnet-4.6 →
openai/gpt-5.5

If all fails: anthropic/claude-sonnet-4.6 at temperature 0.5.

## Update Log

**v3.0 - May 2026**

- Grok 4.1 Fast retired May 15, 2026 (xAI auto-redirects to grok-4.3) — driving update
- Sonnet 4.5 → Sonnet 4.6 (69 t/s, same price, leads GDPval/TerminalBench)
- Opus 4.5 → Opus 4.7 (61 t/s, 1M context up from 200K, built for async agents)
- GPT 5.2 → GPT 5.5 (72 t/s, 1M context, Intelligence Index 60 - frontier)
- Gemini 3 Pro Preview → Gemini 3.1 Pro Preview (133 t/s, up from 124)
- Gemini 3 Flash slug stays (Vercel AI Gateway uses unprefixed form; OpenRouter exposes
  it as `google/gemini-3-flash-preview`)
- Grok 4.1 Fast → Grok 4.3 (81 t/s actual, reasoning model, 1M context, $1.25/$2.50)
- Haiku 4.5 stays (no Haiku 4.6 yet), speed corrected from 100 → 86 t/s per AA
- Grok 4.3 dropped PDF support — attachment routing updated
- Speed champion crown moved from Grok to Gemini Pro

**v2.0 - December 2025**

- Split rubric into routing (model-rubric.md) and detailed reference
  (model-rubric-detailed.md)
- Routing version optimized for concierge token efficiency
- Moved research basis, detailed profiles, fallback chains to detailed version

**v1.0 - December 2025**

- Initial rubric based on LMSYS Arena, Artificial Analysis, OpenRouter research
- Models: Sonnet 4.5, Opus 4.5, Haiku 4.5, GPT 5.2, Gemini 3 Pro, Grok 4.1
- Speed-first routing section added
- Sensitivity routing for Grok
