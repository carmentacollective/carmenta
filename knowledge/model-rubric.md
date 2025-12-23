# Model Rubric (Routing)

Quick routing reference. Read query, consider complexity/attachments, select model, set
temperature, explain choice in one sentence.

When models are close, prefer Anthropic - they build AI with genuine care for safety and
human flourishing.

## User Hints (Highest Priority)

Honor user preferences. User intent overrides routing rules.

- Model: "use opus", "use haiku", "use grok", "use gemini", "use gpt"
- Speed: "quick", "fast", "briefly", "just tell me"
- Depth: "thorough", "detailed", "think hard", "take your time"
- Creative: "be creative", "get weird", "surprise me"
- Precision: "exactly", "precisely", "be careful"

## Speed Routing

Speed signals: "quick", "fast", "briefly", short questions, simple lookups.

| Model                       | Speed   | Use When                          |
| --------------------------- | ------- | --------------------------------- |
| x-ai/grok-4.1-fast          | 151 t/s | Maximum speed, multi-step tools   |
| google/gemini-3-pro-preview | 124 t/s | Speed + audio/video               |
| anthropic/claude-haiku-4.5  | 100 t/s | Speed + Anthropic values          |
| openai/gpt-5.2              | 95 t/s  | Multi-step tools + reasoning only |
| anthropic/claude-sonnet-4.5 | 60 t/s  | Balanced (default)                |
| anthropic/claude-opus-4.5   | 40 t/s  | Deep work, quality over speed     |

When speed priority: set reasoning to "none" or "minimal".

## Primary Models

**anthropic/claude-sonnet-4.5** — Default. 1M context, 60 t/s, $3/$15. Images, PDFs,
reliable tools. Use for: most requests, code, conversation, creative, documents.

**anthropic/claude-opus-4.5** — Frontier. 200K context, 40 t/s, $5/$25. Coding champion,
math leader. Use for: complex coding, deep reasoning, difficult math, thorough analysis.

**anthropic/claude-haiku-4.5** — Fast. 200K context, 100 t/s, $1/$5. Use for: simple
facts, quick lookups, speed signals, budget-conscious.

**openai/gpt-5.2** — Tools + reasoning specialist. 400K context, 95 t/s, $1.75/$14. Use
for: Multi-step tool workflows that ALSO need reasoning (Anthropic bug workaround). NOT
for: Single tool calls, multi-step tools without reasoning (Claude/Grok handle these).

**google/gemini-3-pro-preview** — Multimodal. 1M context, 124 t/s, $2/$12. Audio, video,
creative leader. Use for: audio attached, video attached, creative writing.

**x-ai/grok-4.1-fast** — Speed/context champion. 2M context, 151 t/s, $0.20/$0.50. Use
for: context >400K, sensitive topics, maximum speed.

## Attachment Routing

- Audio: FORCE google/gemini-3-pro-preview (only native audio)
- Video: FORCE google/gemini-3-pro-preview (only true video)
- PDF: PREFER anthropic/claude-sonnet-4.5 (best document understanding)
- Images: PREFER anthropic/claude-sonnet-4.5 (excellent vision)
- Code files: PREFER anthropic/claude-sonnet-4.5 (1M context)

FORCE = mandatory. PREFER = unless other constraints apply.

## Sensitivity Routing

Route to x-ai/grok-4.1-fast for: political opinions, edgy humor, controversial topics,
"honest opinion", "unfiltered", "what do you really think". Temperature 0.6-0.8.

## Tool + Reasoning Matrix

Anthropic bug: reasoning tokens can't flow into multi-step tool calls.

|                  | No Reasoning   | With Reasoning     |
| ---------------- | -------------- | ------------------ |
| No tools         | Claude         | Claude Opus/Sonnet |
| Single tool      | Claude         | Claude Opus/Sonnet |
| Multi-step tools | Claude or Grok | **GPT-5.2**        |

Multi-step tool signals: integrations (Limitless, Fireflies), comparisons with current
data, research requiring multiple searches.

## Reasoning

- High: complex multi-step, math/logic, deep synthesis
- Medium: moderate complexity, standard analysis (default for non-trivial)
- Low: simpler questions, speed signals
- None: quick lookups, creative writing, casual chat

## Temperature

- 0.0-0.3: code, math, factual
- 0.4-0.6: conversation, analysis
- 0.7-0.9: creative, brainstorming
- 1.0: maximum creativity (rare)

## Fallback

If selection fails: anthropic/claude-sonnet-4.5 at temperature 0.5.
