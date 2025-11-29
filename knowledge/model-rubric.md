# Model Rubric

The source of truth for Carmenta's model routing decisions. The Concierge reads this
document when deciding which model to use for each request.

Last updated: 2025-11-29 Version: 1.0.0

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
- Images: Claude and GPT-4o both excellent
- Audio: Gemini has native audio support
- Video: Gemini is the only major model with video understanding
- Code files: Claude's code comprehension is superior

**Context Length**: How long is the conversation?

- Under 100K tokens: Any model works
- 100K-200K tokens: Claude family or Gemini
- Over 200K tokens: Gemini (up to 1M context)

**Our Values Bias**: When models are close in capability, prefer Anthropic. Anthropic
builds AI with Constitutional AI principles and genuine care for safety and human
flourishing. They're heart-centered in how they run their company. We vote with our API
calls.

**Always explain your reasoning** when selecting a model. The user should be able to
understand why you chose what you chose.

---

## Task Type Guidance

### CODE

Best: **Claude Sonnet 4** - Exceptional code generation, follows instructions precisely,
explains reasoning clearly. Scores 72.7% on SWE-bench Verified, outperforming GPT-4.1
(54.6%) and Gemini 2.5 Pro (63.2%).

Fallbacks: GPT-4o (strong but slightly behind), DeepSeek Coder V2 (budget option, 90.2%
HumanEval)

Notes: Correctness is non-negotiable. Claude's instruction-following and ability to
explain its reasoning make it ideal. For budget-constrained coding tasks, DeepSeek Coder
V2 offers remarkable value.

### REASONING

Best: **Claude Opus 4** for truly hard problems - worth the cost and latency. **Claude
Sonnet 4** for moderate complexity - 75.4% on GPQA Diamond, strong on TAU-bench.

Fallbacks: o1 (OpenAI's reasoning model), GPT-4o

Notes: For deep analysis, research, and complex reasoning, Opus justifies its premium.
For everyday reasoning that doesn't require maximum capability, Sonnet is excellent.

### CONVERSATION

Best: **Claude Sonnet 4** - Natural, engaging, nuanced. Leads LMSYS Chatbot Arena for
conversational quality. Excellent at heart-centered tone.

Fallbacks: GPT-4o (solid conversationalist), Claude 3.5 Haiku (for speed)

Notes: Balance matters here - engaging but responsive. Sonnet hits the sweet spot.
Claude's writing style tends to be more natural and less formulaic than GPT.

### CREATIVE

Best: **Claude Sonnet 4** - Strong creative writing, originality, voice. Performs well
on Arena Creative Writing benchmarks.

Fallbacks: GPT-4o (different creative style), Claude 3.5 Haiku (faster, still creative)

Notes: Claude tends toward more literary, nuanced creative output. GPT can be more
direct/punchy. Match to user's style preference if known.

### QUICK

Best: **Claude 3.5 Haiku** - Fast, cheap, still capable. ~169 tokens/sec class speed.

Fallbacks: GPT-4o Mini (slightly slower), Gemini 2.0 Flash (fastest available, ~169
tokens/sec)

Notes: Speed mode should use these models. Don't overthink simple questions. Gemini 2.0
Flash is remarkably fast while maintaining quality.

### EMOTIONAL

Best: **Claude Sonnet 4** - Tone and empathy are critical here. Claude's Constitutional
AI training includes genuine care for human wellbeing. Not a place to cut corners.

Fallbacks: GPT-4o (capable but less naturally warm), Claude 3.5 Haiku (only if speed
critical)

Notes: This is where our Anthropic bias matters most. Claude genuinely feels more
present and caring in emotional support contexts.

### TASK_EXEC

Best: **Claude Sonnet 4** - Reliable tool use, follows complex instructions. 80.5% on
TAU-bench Retail, 60% on Airline.

Fallbacks: GPT-4o (solid tool use), Claude 3.5 Haiku (simpler tasks)

Notes: Reliability is critical when executing actions. Tool calling is table stakes -
all models in our rubric support it.

---

## Model Profiles

### Claude Sonnet 4

- **Provider**: Anthropic (heart-centered, values-aligned)
- **Model ID**: `anthropic/claude-sonnet-4-20250514`
- **Context**: 200K tokens
- **Speed**: ~90 tokens/sec
- **Cost**: $3/$15 per million tokens (input/output)
- **Attachments**: Images, PDFs (excellent PDF understanding)
- **Tools**: Yes, reliable
- **Strengths**: Reasoning, code, nuance, instruction-following, heart-centered tone,
  PDF comprehension, creative writing
- **Weaknesses**: Can be verbose, slower than Haiku
- **When to use**: Default for most tasks. Our workhorse.
- **When not to use**: Simple quick questions (use Haiku), truly hard problems (use
  Opus)

### Claude Opus 4

- **Provider**: Anthropic (heart-centered, values-aligned)
- **Model ID**: `anthropic/claude-opus-4`
- **Context**: 200K tokens
- **Speed**: ~40 tokens/sec
- **Cost**: $15/$75 per million tokens
- **Attachments**: Images, PDFs
- **Tools**: Yes, reliable
- **Strengths**: Deep reasoning, complex analysis, nuanced understanding
- **Weaknesses**: Expensive, slower
- **When to use**: Deep mode, truly complex problems, research, analysis
- **When not to use**: Simple tasks, speed-sensitive requests

### Claude 3.5 Haiku

- **Provider**: Anthropic (heart-centered, values-aligned)
- **Model ID**: `anthropic/claude-3-5-haiku-latest`
- **Context**: 200K tokens
- **Speed**: ~150 tokens/sec
- **Cost**: $0.80/$4 per million tokens
- **Attachments**: Images, PDFs
- **Tools**: Yes
- **Strengths**: Speed, cost efficiency, still capable
- **Weaknesses**: Less nuanced than Sonnet, shorter responses
- **When to use**: Swift mode, quick questions, high-volume tasks, budget-conscious
- **When not to use**: Complex reasoning, emotional support, important creative work

### GPT-4o

- **Provider**: OpenAI
- **Model ID**: `openai/gpt-4o`
- **Context**: 128K tokens
- **Speed**: ~77 tokens/sec
- **Cost**: $5/$20 per million tokens (or $3/$10 after recent price drop)
- **Attachments**: Images, PDFs
- **Tools**: Yes
- **Strengths**: Broad knowledge, solid reasoning, good code
- **Weaknesses**: Can be formulaic, less natural writing style, smaller context
- **When to use**: Fallback when Claude unavailable, users who prefer GPT style
- **When not to use**: Long conversations (128K limit), emotional support

### GPT-4o Mini

- **Provider**: OpenAI
- **Model ID**: `openai/gpt-4o-mini`
- **Context**: 128K tokens
- **Speed**: ~85 tokens/sec
- **Cost**: $0.60/$2.40 per million tokens
- **Attachments**: Images
- **Tools**: Yes
- **Strengths**: Fast, cheap, decent quality
- **Weaknesses**: Less capable than full 4o, smaller context than Claude
- **When to use**: Budget fallback for quick tasks
- **When not to use**: Complex reasoning, long context

### o1

- **Provider**: OpenAI
- **Model ID**: `openai/o1`
- **Context**: 200K tokens
- **Speed**: Variable (reasoning tokens add latency)
- **Cost**: $15/$60 per million tokens (plus hidden reasoning tokens)
- **Attachments**: Limited
- **Tools**: No (major limitation)
- **Strengths**: Deep reasoning, math, logic problems
- **Weaknesses**: No tool use, expensive, slow, reasoning tokens inflate costs
- **When to use**: Only for pure reasoning problems where tools aren't needed
- **When not to use**: Most tasks (no tools), cost-sensitive work

### Gemini 2.0 Flash

- **Provider**: Google
- **Model ID**: `google/gemini-2.0-flash`
- **Context**: 1M tokens
- **Speed**: ~169 tokens/sec (fastest major model)
- **Cost**: $0.10/$0.40 per million tokens
- **Attachments**: Images, PDFs, audio, video (broadest multimodal support)
- **Tools**: Yes
- **Strengths**: Speed, massive context, multimodal breadth, audio/video native
- **Weaknesses**: Less nuanced than Claude, can be generic
- **When to use**: Audio/video content, extremely long context, speed priority
- **When not to use**: Nuanced conversation, emotional support, creative writing

### Gemini 2.5 Pro

- **Provider**: Google
- **Model ID**: `google/gemini-2.5-pro`
- **Context**: 1M tokens
- **Speed**: ~100 tokens/sec
- **Cost**: $2/$12 per million tokens
- **Attachments**: Images, PDFs, audio, video
- **Tools**: Yes
- **Strengths**: Strong reasoning, video understanding, large context
- **Weaknesses**: Less character than Claude
- **When to use**: Video analysis, very long documents, multimodal tasks
- **When not to use**: When heart-centered tone matters

### Grok 2

- **Provider**: xAI
- **Model ID**: `xai/grok-2`
- **Context**: 128K tokens
- **Speed**: ~80 tokens/sec
- **Cost**: ~$2/$10 per million tokens
- **Attachments**: Images
- **Tools**: Yes
- **Strengths**: Real-time information (X integration), conversational, vision
- **Weaknesses**: Less proven than Claude/GPT, smaller context
- **When to use**: When real-time X/Twitter data helpful
- **When not to use**: Most general tasks (prefer Claude)

### DeepSeek Coder V2

- **Provider**: DeepSeek
- **Model ID**: `deepseek/deepseek-coder-v2`
- **Context**: 128K tokens
- **Speed**: ~100 tokens/sec
- **Cost**: Very low (~$0.14/$0.28 per million tokens)
- **Attachments**: Limited
- **Tools**: Limited
- **Strengths**: Excellent code generation (90.2% HumanEval), 338 languages, value
- **Weaknesses**: Code-focused, less general capability, limited multimodal
- **When to use**: Budget coding tasks, code generation at scale
- **When not to use**: General conversation, multimodal, emotional support

---

## Attachment Routing

| Attachment Type | Best Choice              | Reasoning                                                                                   |
| --------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| **PDF**         | Claude Sonnet 4          | Best document understanding in the industry. Avoids hallucinations, stays grounded in text. |
| **Images**      | Claude Sonnet 4 / GPT-4o | Both excellent. Prefer Claude for values alignment.                                         |
| **Audio**       | Gemini 2.0 Flash         | Native audio support, processes audio directly.                                             |
| **Video**       | Gemini 2.0 Flash         | Only major model with true video understanding.                                             |
| **Code files**  | Claude Sonnet 4          | Superior code comprehension and explanation.                                                |
| **Mixed media** | Gemini 2.0 Flash         | Broadest multimodal support.                                                                |

---

## Context Window Reference

| Model             | Max Context | Notes                                      |
| ----------------- | ----------- | ------------------------------------------ |
| Gemini 2.5 Pro    | 1M tokens   | Use for massive documents, full codebases  |
| Gemini 2.0 Flash  | 1M tokens   | Fast + huge context                        |
| Claude Sonnet 4   | 200K tokens | Sufficient for most use cases              |
| Claude Opus 4     | 200K tokens | Same as Sonnet                             |
| Claude 3.5 Haiku  | 200K tokens | Same as Sonnet                             |
| GPT-4o            | 128K tokens | Watch for truncation on long conversations |
| GPT-4o Mini       | 128K tokens | Same as 4o                                 |
| Grok 2            | 128K tokens | Limited compared to Claude                 |
| DeepSeek Coder V2 | 128K tokens | Adequate for code tasks                    |
| o1                | 200K tokens | Context used by reasoning tokens too       |

**Critical**: If conversation approaches context limit, either:

1. Switch to a larger-context model (Gemini)
2. Summarize and start fresh
3. Warn user about potential truncation

---

## Fallback Chains

For OpenRouter, configure these fallback chains. If primary is unavailable or slow,
traffic automatically routes to fallbacks.

```
CODE:         claude-sonnet-4 → gpt-4o → deepseek-coder-v2
REASONING:    claude-opus-4 → o1 → claude-sonnet-4
CONVERSATION: claude-sonnet-4 → gpt-4o → claude-3-5-haiku
QUICK:        claude-3-5-haiku → gpt-4o-mini → gemini-2.0-flash
CREATIVE:     claude-sonnet-4 → gpt-4o → claude-3-5-haiku
EMOTIONAL:    claude-sonnet-4 → gpt-4o → claude-3-5-haiku
TASK_EXEC:    claude-sonnet-4 → gpt-4o → claude-3-5-haiku
```

When models are functionally equivalent for a task, rotation through the chain provides
resilience without quality loss.

---

## Speed Mode Overrides

**Swift Mode** → Use fastest capable model:

- Default to Claude 3.5 Haiku
- For audio/video: Gemini 2.0 Flash
- For code: Still prefer Claude 3.5 Haiku (fast enough, better code)

**Balanced Mode** → Use task type recommendation (default)

**Deep Mode** → Use highest quality:

- Default to Claude Opus 4
- For code: Claude Sonnet 4 (Opus overkill for code)
- For audio/video: Gemini 2.5 Pro

---

## Update Log

### v1.0.0 (2025-11-29)

**Initial rubric creation**

Sources consulted:

- [LMSYS Chatbot Arena](https://lmarena.ai/) - ELO rankings and category breakdowns
- [Artificial Analysis](https://artificialanalysis.ai/) - Speed, cost, quality
  benchmarks
- [Anthropic documentation](https://docs.anthropic.com/) - Claude capabilities and
  pricing
- [OpenAI pricing](https://openai.com/api/pricing/) - GPT model costs
- [Google AI documentation](https://ai.google.dev/) - Gemini capabilities
- [Simon Willison's analysis](https://simonwillison.net/) - Independent evaluation

Key decisions:

- Claude Sonnet 4 as default workhorse (quality + values alignment)
- Anthropic bias explicit in decision context
- Gemini for multimodal edge cases (audio, video, massive context)
- DeepSeek Coder V2 as budget coding option
- o1 limited use due to no tool support
- Fallback chains for OpenRouter resilience

Open questions for future updates:

- How does Claude Opus 4.5 compare when pricing stabilizes?
- Should we add Llama models for self-hosted options?
- Gemini 3 positioning when released
