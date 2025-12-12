# Model Rubric

The source of truth for Carmenta's model routing decisions. The Concierge reads this
document when deciding which model to use for each request.

Last updated: 2025-12-01 Version: 2.1.0

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
- **Reasoning**: Extended thinking with token budget (1K-32K tokens)

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
- **Reasoning**: Extended thinking with token budget (1K-32K tokens)

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
- **Reasoning**: Extended thinking with token budget (1K-32K tokens)

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
- **Reasoning**: Not supported (standard response model)

**Choose when**:

- Audio files are attached
- Video files are attached
- Mixed media requiring unified understanding
- When you need multimodal capabilities Claude doesn't have

**Temperature guidance**: 0.5-0.7 depending on task

---

### x-ai/grok-4.1-fast

Best agentic tool calling model. Massive context window. Halves hallucinations vs
4-fast.

- **Context**: 2M tokens (largest available)
- **Cost**: $0.20/$0.50 per million tokens
- **Attachments**: Multimodal
- **Reasoning**: Effort-based (high/medium/low/minimal/none)

**Choose when**:

- Conversation is approaching or exceeds 200K tokens
- Processing extremely long documents
- Research/comparison queries needing reasoning + web search
- Queries requiring extended thinking AND multi-step tool use
- Context length is the primary constraint

**Temperature guidance**: 0.4-0.6

---

### openai/gpt-5.2

SOTA tool calling with adaptive reasoning. Preambles explain intent before each tool
call.

- **Context**: 400K tokens
- **Cost**: $1.75/$14 per million tokens
- **Attachments**: Text, images, files
- **Reasoning**: Adaptive (auto-allocates based on complexity)

**Choose when**:

- Complex research requiring highest-quality tool orchestration
- Multi-step tasks where accuracy matters more than cost
- When you need the model to explain its tool-calling decisions

**Temperature guidance**: 0.5-0.7

---

## Reasoning Support

Some models support extended reasoning/thinking, where they generate internal reasoning
tokens before producing the final response. This makes the AI's thought process
transparent and improves quality for complex tasks.

### When to Enable Reasoning

**Use high reasoning effort (or large token budget) when:**

- Complex multi-step problems requiring careful analysis
- Mathematical or logical reasoning
- Research requiring deep synthesis across multiple sources
- Analysis with many variables or edge cases
- User explicitly requests thorough thinking
- Quality matters more than speed or cost

**Use medium reasoning effort when:**

- Moderate complexity tasks
- Balanced quality and speed requirements
- Standard explanation or analysis requests
- Default for reasoning-capable models on non-trivial queries

**Use low/minimal reasoning effort when:**

- Simpler questions on reasoning-capable models
- User signals speed preference ("quick answer", "briefly")
- Cost sensitivity is a factor
- The task doesn't require deep analysis

**Don't use reasoning (use standard models) when:**

- Quick lookups, simple questions, basic facts
- Creative writing (reasoning can reduce creativity)
- Casual conversational exchanges
- Speed or cost is the clear priority
- The query is straightforward

### Cost Implications

Reasoning tokens are charged as output tokens (the most expensive). For Claude Sonnet
4.5 at $15/million output tokens:

- 2,000 reasoning tokens = $0.03 per request
- 8,000 reasoning tokens = $0.12 per request
- 32,000 reasoning tokens = $0.48 per request

Use reasoning judiciously. The quality improvement must justify the cost.

### Model-Specific Behavior

**Anthropic (Claude 4.5 series):**

- Configure via `reasoning: { maxTokens: 1024-32000 }`
- Returns reasoning tokens in response
- Token budget directly controls depth of reasoning

**x-ai (Grok):**

- Configure via `reasoning: { effort: "high" | "medium" | "low" | "minimal" | "none" }`
- Returns reasoning tokens in response
- Effort level controls percentage of tokens allocated

**OpenAI (o-series):**

- Support reasoning but DON'T return reasoning tokens
- They reason internally but don't expose thinking
- Still configure effort level for internal reasoning depth

**Gemini Flash Thinking:**

- Support reasoning but DON'T return reasoning tokens
- Similar to OpenAI: internal reasoning only

**Standard models (Gemini 3 Pro, older Claude models):**

- No extended reasoning capability
- Respond immediately without separate reasoning phase

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

When files are attached, route based on file type and model capabilities:

| Attachment Type | Required Model                | Routing Rule                                          |
| --------------- | ----------------------------- | ----------------------------------------------------- |
| **Audio**       | `google/gemini-3-pro-preview` | FORCE Gemini (only model with native audio support)   |
| **PDF**         | `anthropic/claude-sonnet-4.5` | PREFER Claude (best document understanding)           |
| **Images**      | `anthropic/claude-sonnet-4.5` | PREFER Claude (excellent vision, values-aligned)      |
| **Video**       | `google/gemini-3-pro-preview` | FORCE Gemini (only model with true video support)     |
| **Code files**  | `anthropic/claude-sonnet-4.5` | PREFER Claude (superior code comprehension, 1M token) |

**Force vs Prefer**:

- FORCE: Audio/video MUST use Gemini. No other model supports these types.
- PREFER: Concierge should choose this model unless user has strong preference or other
  constraints apply.

**Example**: If user attaches an audio file and asks "transcribe this," the concierge
MUST route to Gemini regardless of other factors.

---

## Context Window Reference

| Model                         | Max Context | Notes                                 |
| ----------------------------- | ----------- | ------------------------------------- |
| `x-ai/grok-4.1-fast`          | 2M tokens   | Best agentic tool calling             |
| `anthropic/claude-sonnet-4.5` | 1M tokens   | Best balance of capability + context  |
| `google/gemini-3-pro-preview` | 1M tokens   | Full multimodal at scale              |
| `openai/gpt-5.2`              | 400K tokens | SOTA tool calling, adaptive reasoning |
| `anthropic/claude-opus-4.5`   | 200K tokens | Deep reasoning, moderate context      |
| `anthropic/claude-haiku-4.5`  | 200K tokens | Fast, moderate context                |

---

## Internal System Tasks

Some Carmenta features use LLMs for fast, cheap internal operations. These run
automatically without user awareness and prioritize speed and cost efficiency.

### Current internal uses:

| Task                 | Model                        | Purpose                         |
| -------------------- | ---------------------------- | ------------------------------- |
| **Concierge**        | `anthropic/claude-haiku-4.5` | Route requests to optimal model |
| **Title Generation** | `anthropic/claude-haiku-4.5` | Generate conversation titles    |

### Future considerations:

- **Summarization**: Condensing long conversations for context management
- **Classification**: Categorizing conversations for organization
- **Embedding generation**: For semantic search (may use dedicated embedding model)

**Note**: Haiku 4.5 is our go-to for these tasks. Fast (~200ms), cheap ($1/$5), and
capable enough for structured output and simple inference.

---

## Fallback Behavior

If the Concierge fails to select a model, default to:

- **Model**: `anthropic/claude-sonnet-4.5`
- **Temperature**: 0.5

This is a safe default that handles most requests well.

---

## Update Log

### v2.1.0 (2025-12-01)

**Added reasoning token support**

- Added reasoning capability tracking for each model
- Documented when to use reasoning (high/medium/low/none)
- Added cost implications for reasoning tokens
- Explained model-specific reasoning behavior (token-budget vs effort-based)
- Guidance for concierge on reasoning level determination

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
