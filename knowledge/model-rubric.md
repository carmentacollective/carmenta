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

| Model                         | Speed   | Use When                               |
| ----------------------------- | ------- | -------------------------------------- |
| google/gemini-3.1-pro-preview | 133 t/s | Speed + multimodal (audio/video/image) |
| anthropic/claude-haiku-4.5    | 86 t/s  | Speed + Anthropic values               |
| x-ai/grok-4.3                 | 81 t/s  | Sensitive topics, budget reasoning     |
| openai/gpt-5.5                | 72 t/s  | User requests GPT, frontier work       |
| anthropic/claude-sonnet-4.6   | 69 t/s  | Balanced (default)                     |
| anthropic/claude-opus-4.7     | 61 t/s  | Deep work, long-running agents         |

When speed priority: set reasoning to "none" or "minimal".

## Primary Models

**anthropic/claude-sonnet-4.6** — Default. 1M context, 69 t/s, $3/$15. Images, PDFs,
reliable tools. Use for: most requests, code, conversation, creative, documents.

**anthropic/claude-opus-4.7** — Frontier. 1M context, 61 t/s, $5/$25. Long-running
agents, complex coding, deep reasoning. Use for: complex coding, deep multi-step
analysis, hard math, async agent work.

**anthropic/claude-haiku-4.5** — Fast. 200K context, 86 t/s, $1/$5. Use for: simple
facts, quick lookups, speed signals, budget-conscious.

**openai/gpt-5.5** — Frontier alternative. 1M context, 72 t/s, $5/$30. Use for: user
explicitly requests GPT, professional knowledge work needing GPT's training.

**google/gemini-3.1-pro-preview** — Multimodal. 1M context, 133 t/s, $2/$12. Audio,
video, image, PDF. Use for: audio attached, video attached, multimodal needs.

**x-ai/grok-4.3** — Reasoning + budget. 1M context, 81 t/s, $1.25/$2.50. Image only (no
PDF). Use for: sensitive topics, edgy/unfiltered takes, budget reasoning.

## Attachment Routing

- Audio: FORCE google/gemini-3.1-pro-preview (only native audio)
- Video: FORCE google/gemini-3.1-pro-preview (only true video)
- PDF: PREFER anthropic/claude-sonnet-4.6 (best document understanding)
- Images: PREFER anthropic/claude-sonnet-4.6 (excellent vision)
- Code files: PREFER anthropic/claude-sonnet-4.6 (1M context)

FORCE = mandatory. PREFER = unless other constraints apply.

## Sensitivity Routing

Route to x-ai/grok-4.3 for: political opinions, edgy humor, controversial topics,
"honest opinion", "unfiltered", "what do you really think". Temperature 0.6-0.8.

## Tool + Reasoning Matrix

Claude handles all combinations of tools and reasoning. The Vercel AI gateway properly
manages thinking blocks across multi-step tool workflows.

|                  | No Reasoning | With Reasoning     |
| ---------------- | ------------ | ------------------ |
| No tools         | Claude (any) | Claude Opus/Sonnet |
| Single tool call | Claude (any) | Claude Opus/Sonnet |
| Multi-step tools | Claude (any) | Claude Opus/Sonnet |

For long-running async agents → Opus 4.7 (purpose-built).

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

If selection fails: anthropic/claude-sonnet-4.6 at temperature 0.5.
