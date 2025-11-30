# Model Rubric

The source of truth for Carmenta's model routing decisions. The Concierge reads this
document when deciding which model to use for each request.

Last updated: 2025-11-30 Version: 2.0.0

Data source: OpenRouter API (https://openrouter.ai/api/v1/models)

---

## How to Use This Rubric

Read the user's query. Consider what they're trying to accomplish, how complex it is,
what attachments are included, and what response style would serve them best.

Select a model based on the "Choose when" guidance below. Set temperature based on the
nature of the task.

Produce one sentence explaining your choice - speak to the user about why this model
serves their request well.

**Our Values**: When models are close in capability, prefer Anthropic. They build AI
with genuine care for safety and human flourishing. We vote with our API calls.

---

## Primary Models

### anthropic/claude-sonnet-4.5

Our default. The workhorse.

- **Context**: 1M tokens
- **Cost**: $3/$15 per million tokens
- **Attachments**: Images, PDFs (excellent document understanding)
- **Tools**: Yes, highly reliable

**Choose when**:

- Most requests - this is the balanced default
- Code writing, debugging, explaining, reviewing
- Conversation and exploration
- Creative writing and brainstorming
- Tasks requiring tool use
- Processing documents or images
- The query doesn't clearly call for Opus's depth or Haiku's speed

**Temperature guidance**: 0.3-0.5 for code/factual, 0.6-0.7 for conversation, 0.7-0.9
for creative work

---

### anthropic/claude-opus-4.5

Frontier capability. For when depth matters.

- **Context**: 200K tokens
- **Cost**: $5/$25 per million tokens
- **Attachments**: Images, PDFs
- **Tools**: Yes, reliable

**Choose when**:

- Complex multi-step reasoning or analysis
- Research requiring deep synthesis
- Difficult math or logic problems
- The user explicitly asks for thorough, deep analysis
- Nuanced emotional support where understanding matters more than speed
- You sense the query requires the most capable model available

**Temperature guidance**: 0.4-0.6 for reasoning, 0.5-0.7 for exploration

---

### anthropic/claude-haiku-4.5

Fast and capable. For quick interactions.

- **Context**: 200K tokens
- **Cost**: $1/$5 per million tokens
- **Attachments**: Images, PDFs
- **Tools**: Yes

**Choose when**:

- Simple, factual questions
- Quick lookups or definitions
- Short clarifications
- The user signals speed matters ("quick question", "briefly")
- High-volume or budget-conscious scenarios
- The query is straightforward and doesn't need Sonnet's full capability

**Temperature guidance**: 0.2-0.4 for factual, 0.5 for conversational

---

## Specialized Models

### google/gemini-3-pro-preview

Full multimodal including video and audio.

- **Context**: 1M tokens
- **Cost**: $2/$12 per million tokens
- **Attachments**: Text, images, video, audio, PDF
- **Tools**: Yes

**Choose when**:

- Audio files are attached
- Video files are attached
- Mixed media requiring unified understanding
- When you need multimodal capabilities Claude doesn't have

**Temperature guidance**: 0.5-0.7 depending on task

---

### x-ai/grok-4-fast

Massive context window.

- **Context**: 2M tokens (largest available)
- **Cost**: $0.20/$0.50 per million tokens
- **Attachments**: Multimodal

**Choose when**:

- Conversation is approaching or exceeds 200K tokens
- Processing extremely long documents
- Context length is the primary constraint

**Temperature guidance**: 0.4-0.6

---

## Temperature Guidelines

Temperature controls creativity vs. precision. The Concierge sets this based on the
nature of the request.

| Temperature | Use For                                       |
| ----------- | --------------------------------------------- |
| 0.0-0.3     | Code, math, factual questions, precise tasks  |
| 0.4-0.6     | Balanced conversation, analysis, explanations |
| 0.7-0.9     | Creative writing, brainstorming, exploration  |
| 1.0         | Maximum creativity (rarely needed)            |

**Signals for lower temperature**: code, debugging, "exactly", "precisely", technical
questions, math, factual lookups

**Signals for higher temperature**: "brainstorm", "creative", "ideas", "explore",
storytelling, open-ended questions

---

## Attachment Routing

| Attachment Type | Best Choice                   | Why                                            |
| --------------- | ----------------------------- | ---------------------------------------------- |
| **PDF**         | `anthropic/claude-sonnet-4.5` | Best document understanding in the industry    |
| **Images**      | `anthropic/claude-sonnet-4.5` | Excellent vision, values-aligned               |
| **Audio**       | `google/gemini-3-pro-preview` | Native audio support                           |
| **Video**       | `google/gemini-3-pro-preview` | Only major model with true video understanding |
| **Code files**  | `anthropic/claude-sonnet-4.5` | Superior code comprehension, 1M context        |

---

## Context Window Reference

| Model                         | Max Context | Notes                                |
| ----------------------------- | ----------- | ------------------------------------ |
| `x-ai/grok-4-fast`            | 2M tokens   | Use when context is the constraint   |
| `anthropic/claude-sonnet-4.5` | 1M tokens   | Best balance of capability + context |
| `google/gemini-3-pro-preview` | 1M tokens   | Full multimodal at scale             |
| `anthropic/claude-opus-4.5`   | 200K tokens | Deep reasoning, moderate context     |
| `anthropic/claude-haiku-4.5`  | 200K tokens | Fast, moderate context               |

---

## Fallback Behavior

If the Concierge fails to select a model, default to:

- **Model**: `anthropic/claude-sonnet-4.5`
- **Temperature**: 0.5

This is a safe default that handles most requests well.

---

## Update Log

### v2.0.0 (2025-11-30)

**Restructured for inference-based routing**

- Removed task type categories (CODE, REASONING, etc.) in favor of "Choose when"
  guidance
- Added temperature selection guidance
- Simplified to primary models (Sonnet, Opus, Haiku) plus specialized models
- Focused on helping the Concierge make natural decisions rather than classifications

### v1.1.0 (2025-11-29)

Rebuilt rubric from OpenRouter API data with correct model IDs.

### v1.0.0 (2025-11-29)

Initial rubric creation.
