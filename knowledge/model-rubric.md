# Model Rubric

The source of truth for Carmenta's model routing decisions. The Concierge reads this
document when deciding which model to use for each request.

Last updated: 2025-11-29 Version: 1.1.0

Data source: OpenRouter API (https://openrouter.ai/api/v1/models)

---

## Decision Context for Concierge

When selecting a model, you have discretion. These are guidelines informed by current
benchmarks and our values - not rigid rules. Consider:

**Task Type**: What is the user trying to accomplish?

- CODE: Writing, debugging, explaining code
- REASONING: Complex analysis, math, logic problems
- CONVERSATION: Discussion, exploration, back-and-forth
- CREATIVE: Writing, brainstorming, ideation
- QUICK: Simple questions, lookups, brief responses
- EMOTIONAL: Support, encouragement, personal matters
- TASK_EXEC: Actions requiring tools or external services

**Speed Mode**: What did the user request?

- Swift: Prioritize speed, use fastest capable model
- Balanced: Use recommended model for task type (default)
- Deep: Prioritize quality, use most capable model regardless of cost/speed

**Attachments**: What media is included?

- PDFs: Claude excels here - best document understanding in the industry
- Images: Claude and GPT both excellent
- Audio: Gemini has native audio support
- Video: Gemini is the only major model with video understanding
- Code files: Claude's code comprehension is superior

**Context Length**: How long is the conversation?

- Under 200K tokens: Claude Opus/Haiku, most models work
- 200K-1M tokens: Claude Sonnet 4.5 (1M), Gemini models (1M)
- Over 1M tokens: Grok 4 (2M context)

**Our Values Bias**: When models are close in capability, prefer Anthropic. Anthropic
builds AI with Constitutional AI principles and genuine care for safety and human
flourishing. They're heart-centered in how they run their company. We vote with our API
calls.

**Always explain your reasoning** when selecting a model. The user should be able to
understand why you chose what you chose.

---

## Task Type Guidance

### CODE

Best: **`anthropic/claude-sonnet-4.5`** - Optimized for agentic workflows and coding.
SWE-bench verified performance. 1M token context handles large codebases.

Fallbacks: `openai/gpt-5.1-codex` (engineering workflows), `anthropic/claude-haiku-4.5`
(faster, still capable)

Notes: Sonnet 4.5 is specifically optimized for coding workflows. The 1M context is
critical for large projects.

### REASONING

Best: **`anthropic/claude-opus-4.5`** for truly hard problems - frontier reasoning
capability. **`anthropic/claude-sonnet-4.5`** for moderate complexity.

Fallbacks: `openai/gpt-5-pro` (complex task reasoning), `openai/o3-deep-research`
(multi-step research with web search)

Notes: For deep analysis, research, and complex reasoning, Opus 4.5 justifies its cost.
The o3-deep-research model is uniquely capable for research tasks requiring web access.

### CONVERSATION

Best: **`anthropic/claude-sonnet-4.5`** - Natural, engaging, nuanced. Excellent at
heart-centered tone.

Fallbacks: `openai/gpt-5.1-chat` (optimized for low-latency chat),
`anthropic/claude-haiku-4.5` (for speed)

Notes: Balance matters here - engaging but responsive. Sonnet hits the sweet spot.
Claude's writing style tends to be more natural and less formulaic.

### CREATIVE

Best: **`anthropic/claude-sonnet-4.5`** - Strong creative writing, originality, voice.

Fallbacks: `anthropic/claude-opus-4.5` (when creativity requires deep reasoning),
`openai/gpt-5.1` (different creative style)

Notes: Claude tends toward more literary, nuanced creative output.

### QUICK

Best: **`anthropic/claude-haiku-4.5`** - Fast inference, frontier-level reasoning at
lowest cost.

Fallbacks: `google/gemini-2.5-flash-lite-preview-09-2025` (ultra-low latency),
`x-ai/grok-4.1-fast:free` (free tier option)

Notes: Speed mode should use these models. Don't overthink simple questions.

### EMOTIONAL

Best: **`anthropic/claude-sonnet-4.5`** - Tone and empathy are critical here. Claude's
Constitutional AI training includes genuine care for human wellbeing. Not a place to cut
corners.

Fallbacks: `anthropic/claude-opus-4.5` (when deeper understanding needed),
`openai/gpt-5.1-chat`

Notes: This is where our Anthropic bias matters most. Claude genuinely feels more
present and caring in emotional support contexts.

### TASK_EXEC

Best: **`anthropic/claude-sonnet-4.5`** - Optimized for agentic workflows, reliable tool
use.

Fallbacks: `x-ai/grok-4.1-fast:free` (agentic tool-calling), `openai/gpt-5.1`

Notes: Reliability is critical when executing actions. Sonnet 4.5 is specifically
designed for agentic workflows.

---

## Model Profiles

### anthropic/claude-opus-4.5

- **Provider**: Anthropic (heart-centered, values-aligned)
- **Context**: 200K tokens
- **Cost**: $5/$25 per million tokens (input/output)
- **Attachments**: Images, PDFs (excellent PDF understanding)
- **Tools**: Yes, reliable
- **Strengths**: Frontier reasoning, multimodal, extended context, deepest understanding
- **Weaknesses**: More expensive than Sonnet, slower
- **When to use**: Deep mode, truly complex problems, research, analysis
- **When not to use**: Simple tasks, speed-sensitive requests, budget-conscious

### anthropic/claude-sonnet-4.5

- **Provider**: Anthropic (heart-centered, values-aligned)
- **Context**: 1M tokens
- **Cost**: $3/$15 per million tokens
- **Attachments**: Images, PDFs (excellent PDF understanding)
- **Tools**: Yes, reliable
- **Strengths**: Agentic workflows, coding (SWE-bench verified), massive context,
  balanced
- **Weaknesses**: Not quite Opus-level for hardest reasoning
- **When to use**: Default for most tasks. Our workhorse. Especially coding.
- **When not to use**: Truly hard reasoning problems (use Opus)

### anthropic/claude-haiku-4.5

- **Provider**: Anthropic (heart-centered, values-aligned)
- **Context**: 200K tokens
- **Cost**: $1/$5 per million tokens
- **Attachments**: Images, PDFs
- **Tools**: Yes
- **Strengths**: Fast inference, frontier-level reasoning at low cost
- **Weaknesses**: Less capable than Sonnet for complex tasks
- **When to use**: Swift mode, quick questions, high-volume tasks, budget-conscious
- **When not to use**: Complex reasoning, important creative work

### openai/gpt-5.1

- **Provider**: OpenAI
- **Context**: 400K tokens
- **Cost**: $1.25/$10 per million tokens
- **Attachments**: Images
- **Tools**: Yes
- **Strengths**: Advanced reasoning, adaptive computation, large context
- **Weaknesses**: Less natural writing style than Claude
- **When to use**: Fallback when Claude unavailable, users who prefer GPT style
- **When not to use**: Emotional support (Claude better)

### openai/gpt-5.1-chat

- **Provider**: OpenAI
- **Context**: 128K tokens
- **Cost**: $1.25/$10 per million tokens
- **Attachments**: Images
- **Tools**: Yes
- **Strengths**: Fast chat, low-latency responses
- **Weaknesses**: Smaller context than full 5.1
- **When to use**: Chat applications where latency matters
- **When not to use**: Long context requirements

### openai/gpt-5.1-codex

- **Provider**: OpenAI
- **Context**: 400K tokens
- **Cost**: $1.25/$10 per million tokens
- **Attachments**: Images
- **Tools**: Yes
- **Strengths**: Engineering workflows, code review
- **Weaknesses**: Code-focused
- **When to use**: Alternative to Claude for coding if needed
- **When not to use**: General conversation

### openai/gpt-5-pro

- **Provider**: OpenAI
- **Context**: 400K tokens
- **Cost**: $15/$120 per million tokens
- **Strengths**: Most advanced OpenAI model, complex task reasoning
- **Weaknesses**: Expensive
- **When to use**: When maximum OpenAI capability needed
- **When not to use**: Most tasks (prefer Anthropic)

### openai/o3-deep-research

- **Provider**: OpenAI
- **Context**: 200K tokens
- **Cost**: $10/$40 per million tokens
- **Strengths**: Multi-step research, web search enabled
- **Weaknesses**: Specialized for research
- **When to use**: Research tasks requiring web access
- **When not to use**: General conversation, coding

### google/gemini-3-pro-preview

- **Provider**: Google
- **Context**: 1M tokens
- **Cost**: $2/$12 per million tokens
- **Attachments**: Text, images, video, audio, PDF
- **Tools**: Yes
- **Strengths**: Full multimodal (including video/audio), agentic capabilities, huge
  context
- **Weaknesses**: Preview status, less proven than Claude
- **When to use**: Video/audio content, massive context needs
- **When not to use**: When stability is critical (prefer stable Claude)

### google/gemini-2.5-flash-preview-09-2025

- **Provider**: Google
- **Context**: 1M tokens
- **Cost**: $0.30/$2.50 per million tokens
- **Attachments**: Text, images, video, audio
- **Tools**: Yes
- **Strengths**: Built-in thinking, math/science tasks, very cheap
- **Weaknesses**: Preview status
- **When to use**: Budget option with good capability, math tasks
- **When not to use**: When heart-centered tone matters

### google/gemini-2.5-flash-lite-preview-09-2025

- **Provider**: Google
- **Context**: 1M tokens
- **Cost**: $0.10/$0.40 per million tokens
- **Attachments**: Text, images
- **Tools**: Limited
- **Strengths**: Ultra-low latency, extremely cost-efficient
- **Weaknesses**: Less capable than full Flash
- **When to use**: Maximum speed, minimal cost
- **When not to use**: Complex tasks, quality-sensitive

### x-ai/grok-4-fast

- **Provider**: xAI
- **Context**: 2M tokens
- **Cost**: $0.20/$0.50 per million tokens
- **Attachments**: Multimodal
- **Strengths**: Massive 2M context window, very fast, cheap
- **Weaknesses**: Less proven than Claude/GPT
- **When to use**: Extremely long context needs
- **When not to use**: When quality is paramount

### x-ai/grok-4.1-fast:free

- **Provider**: xAI
- **Context**: 2M tokens
- **Cost**: Free
- **Tools**: Yes (agentic tool-calling)
- **Strengths**: Free tier, agentic capabilities, huge context
- **Weaknesses**: Free tier may have limits, less proven
- **When to use**: Budget-conscious, experimentation
- **When not to use**: Production critical paths

---

## Attachment Routing

| Attachment Type | Best Choice                   | Reasoning                                      |
| --------------- | ----------------------------- | ---------------------------------------------- |
| **PDF**         | `anthropic/claude-sonnet-4.5` | Best document understanding in the industry    |
| **Images**      | `anthropic/claude-sonnet-4.5` | Excellent vision, prefer for values alignment  |
| **Audio**       | `google/gemini-3-pro-preview` | Native audio support                           |
| **Video**       | `google/gemini-3-pro-preview` | Only major model with true video understanding |
| **Code files**  | `anthropic/claude-sonnet-4.5` | Superior code comprehension, 1M context        |
| **Mixed media** | `google/gemini-3-pro-preview` | Broadest multimodal support                    |

---

## Context Window Reference

| Model                                     | Max Context | Notes                                |
| ----------------------------------------- | ----------- | ------------------------------------ |
| `x-ai/grok-4-fast`                        | 2M tokens   | Largest context available            |
| `anthropic/claude-sonnet-4.5`             | 1M tokens   | Best balance of capability + context |
| `google/gemini-3-pro-preview`             | 1M tokens   | Full multimodal at scale             |
| `google/gemini-2.5-flash-preview-09-2025` | 1M tokens   | Budget option with huge context      |
| `openai/gpt-5.1`                          | 400K tokens | Large but not 1M class               |
| `anthropic/claude-opus-4.5`               | 200K tokens | Deep reasoning, moderate context     |
| `anthropic/claude-haiku-4.5`              | 200K tokens | Fast, moderate context               |
| `openai/o3-deep-research`                 | 200K tokens | Research focused                     |
| `openai/gpt-5.1-chat`                     | 128K tokens | Chat optimized, smaller context      |

**Critical**: If conversation approaches context limit, either:

1. Switch to a larger-context model (Sonnet 4.5, Gemini, or Grok)
2. Summarize and start fresh
3. Warn user about potential truncation

---

## Fallback Chains

For OpenRouter, configure these fallback chains. If primary is unavailable or slow,
traffic automatically routes to fallbacks.

```
CODE:         anthropic/claude-sonnet-4.5 → openai/gpt-5.1-codex → anthropic/claude-haiku-4.5
REASONING:    anthropic/claude-opus-4.5 → openai/gpt-5-pro → anthropic/claude-sonnet-4.5
CONVERSATION: anthropic/claude-sonnet-4.5 → openai/gpt-5.1-chat → anthropic/claude-haiku-4.5
QUICK:        anthropic/claude-haiku-4.5 → google/gemini-2.5-flash-lite-preview-09-2025 → x-ai/grok-4.1-fast:free
CREATIVE:     anthropic/claude-sonnet-4.5 → anthropic/claude-opus-4.5 → openai/gpt-5.1
EMOTIONAL:    anthropic/claude-sonnet-4.5 → anthropic/claude-opus-4.5 → openai/gpt-5.1-chat
TASK_EXEC:    anthropic/claude-sonnet-4.5 → x-ai/grok-4.1-fast:free → openai/gpt-5.1
```

When models are functionally equivalent for a task, rotation through the chain provides
resilience without quality loss.

---

## Speed Mode Overrides

**Swift Mode** → Use fastest capable model:

- Default to `anthropic/claude-haiku-4.5`
- For audio/video: `google/gemini-2.5-flash-preview-09-2025`
- For huge context: `x-ai/grok-4-fast`

**Balanced Mode** → Use task type recommendation (default)

**Deep Mode** → Use highest quality:

- Default to `anthropic/claude-opus-4.5`
- For code: `anthropic/claude-sonnet-4.5` (optimized for coding)
- For audio/video: `google/gemini-3-pro-preview`

---

## Update Log

### v1.1.0 (2025-11-29)

**Rebuilt rubric from OpenRouter API data**

- Fixed model IDs to match actual OpenRouter API (e.g., `anthropic/claude-opus-4.5` not
  made-up names)
- Updated pricing from OpenRouter API
- Added context window sizes from API
- Included new models: Grok 4 series (2M context!), GPT-5.1 family, Gemini 3 Pro

Sources:

- [OpenRouter API](https://openrouter.ai/api/v1/models) - Primary source for model IDs,
  pricing, capabilities
- [Anthropic pricing](https://www.anthropic.com/news/claude-haiku-4-5) - Haiku 4.5
  announcement
- [Simon Willison on Opus 4.5](https://simonwillison.net/2025/Nov/24/claude-opus/) -
  Independent analysis

### v1.0.0 (2025-11-29)

Initial rubric creation (contained inaccurate model names - replaced)
