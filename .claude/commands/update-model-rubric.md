# Update Model Rubric

Research the current LLM landscape and update Carmenta's model routing rubric. This is a
deep research task that should take several minutes to run thoroughly.

## Critical: Avoid Hallucination

**READ THIS FIRST**: @.cursor/rules/trust-and-decision-making.mdc

Model names, versions, and capabilities are EXACTLY the kind of specifics where LLMs
hallucinate. Your parametric knowledge is almost certainly out of date. You MUST:

1. **Never trust your training data** for model names, versions, or capabilities
2. **Verify every model name** against current provider documentation
3. **Get exact model IDs** from OpenRouter's actual model list
4. **Cite your source** for every claim - "I believe" is not acceptable
5. **When uncertain, say so** - don't pattern-match to plausible-sounding names

If you cannot verify a model exists from a primary source, do not include it in the
rubric. A smaller accurate rubric beats a comprehensive hallucinated one.

## Your Mission

You are updating `knowledge/model-rubric.md` - the source of truth that Carmenta's
Concierge reads when deciding which model to route requests to. This rubric must be:

- **Current**: Reflect the latest models and their actual capabilities
- **Accurate**: Based on real benchmark data, not assumptions
- **Verified**: Every model name confirmed against primary sources
- **Practical**: Guide routing decisions that users will feel as "just works"
- **Speed-aware**: Include tokens/second for every model - critical for quick answers
- **Values-aligned**: Bias toward Anthropic for their heart-centered approach

Also update `lib/model-config.ts` with the `tokensPerSecond` field for each model. This
TypeScript config is used by the UI and API.

## Intelligence Gathering

Research each of these sources thoroughly. Use web search and fetch to get current data.

### Tier 1: Authoritative Rankings

**LMSYS Chatbot Arena** (https://lmarena.ai/)

- Overall ELO rankings
- Category-specific rankings: Coding, Math, Hard Prompts, Creative Writing
- Look at the leaderboard, not just top models

**Artificial Analysis** (https://artificialanalysis.ai/)

- Quality index scores
- **Speed benchmarks (tokens/second)** - CRITICAL for routing. Get output t/s for every
  model. This is the primary speed metric.
- Pricing comparisons
- Context window data

Speed data is essential. Users who want quick answers need to be routed to fast models.
A 151 t/s model delivers a 100-token response in 0.7 seconds. A 40 t/s model takes 2.5
seconds. This difference is visceral.

### Tier 2: Provider Official Sources

For each major provider, find their current model lineup:

**Anthropic** (https://anthropic.com, https://docs.anthropic.com)

- Claude model family
- Capabilities (vision, PDFs, tools)
- Context windows
- Pricing

**OpenAI** (https://openai.com, https://platform.openai.com)

- GPT-4 family, GPT-4o variants
- o1/o3 reasoning models
- Capabilities and pricing

**Google** (https://ai.google.dev, https://deepmind.google)

- Gemini family (2.0, 1.5, Flash, Pro)
- Unique capabilities (audio, video, massive context)
- Pricing

**xAI** (https://x.ai)

- Grok models
- Capabilities and positioning

### Tier 3: Ecosystem Intelligence (PRIMARY SOURCE FOR MODEL IDs)

**OpenRouter API** (https://openrouter.ai/api/v1/models)

THIS IS YOUR PRIMARY SOURCE FOR MODEL IDENTIFIERS. The API returns a large JSON file.
Use Bash to download and parse it:

```bash
# Download and save the models list
curl -s https://openrouter.ai/api/v1/models > /tmp/openrouter-models.json

# Extract Anthropic models with their IDs, pricing, and context
cat /tmp/openrouter-models.json | jq '.data[] | select(.id | startswith("anthropic/")) | {id, context_length, pricing}'

# Extract OpenAI models
cat /tmp/openrouter-models.json | jq '.data[] | select(.id | startswith("openai/")) | {id, context_length, pricing}'

# Extract Google models
cat /tmp/openrouter-models.json | jq '.data[] | select(.id | startswith("google/")) | {id, context_length, pricing}'

# Extract xAI models
cat /tmp/openrouter-models.json | jq '.data[] | select(.id | startswith("x-ai/")) | {id, context_length, pricing}'
```

The model IDs in the rubric MUST match OpenRouter's API exactly since that's what
Carmenta uses to route requests. Do not guess or pattern-match model names.

**OpenRouter Website** (https://openrouter.ai/models)

- Popularity/usage trends
- Provider information
- Fallback compatibility

**Hugging Face Open LLM Leaderboard** (for context on open models)

- Only if open models are competitive for our use cases

### Tier 4: Specialized Benchmarks

Find current benchmark results for task-type specific evaluation:

- **Code**: BigCodeBench, HumanEval, SWE-Bench
- **Reasoning**: GPQA, MATH, ARC-Challenge
- **Conversation**: MT-Bench, Arena ELO
- **Creative**: Arena Creative Writing category

## Rubric Structure

The rubric should be structured markdown that an LLM (the Concierge) will read to make
routing decisions. It's a briefing document, not a lookup table.

Required sections:

### 1. Decision Context

Prose guidance for the Concierge on how to think about model selection. Include:

- Task types and what matters for each
- **Speed-first routing** - when users signal speed, route to fastest capable model
- Attachment handling
- The Anthropic values-alignment bias
- Instruction to explain reasoning

### 2. Speed-First Routing (NEW - REQUIRED)

A dedicated section with:

- Speed ranking table (all models sorted by tokens/second)
- Speed tier definitions (Fast: 100+ t/s, Moderate: 60-99 t/s, Deliberate: <60 t/s)
- Speed signals to recognize ("quick", "fast", "briefly", etc.)
- Decision flow for speed-first routing
- Guidance on disabling reasoning for speed

### 3. Task Type Guidance

For each task type (CODE, REASONING, CONVERSATION, CREATIVE, QUICK, EMOTIONAL,
TASK_EXEC):

- Best model choice with reasoning
- Fallback options
- Notes on what matters for this task type

### 4. Model Profiles

For each model in the rubric:

- Provider (and values alignment note for Anthropic)
- Context window
- **Speed (tokens/sec)** - REQUIRED for every model, prominently displayed
- Cost (input/output per million tokens)
- Attachment support (images, PDFs, audio, video)
- Tool support
- Strengths and weaknesses
- When to use / when not to use

### 5. Attachment Routing

Table mapping attachment types to best models:

- PDFs (Claude excels here)
- Images
- Audio (Gemini)
- Video (Gemini)
- Code files

### 6. Quick Reference Table

Combined reference with Context, Speed, and Best Use Case for each model. This is the
at-a-glance routing table the Concierge uses for fast decisions.

### 7. Fallback Chains

For each task type, the OpenRouter fallback chain: `primary → fallback1 → fallback2`

### 8. Update Log

Version, date, what changed, sources used.

## Process

1. **Read current rubric** (if exists): `knowledge/model-rubric.md`
2. **Research all sources** listed above
3. **Compare findings** to current rubric
4. **Draft updates** with clear reasoning
5. **Present to user** for approval
6. **Apply changes** if approved

## Output

After research, present:

1. **Summary of findings** - What's new, what changed, what's stable
2. **Proposed rubric** - The full updated markdown
3. **Change rationale** - Why each significant change was made
4. **Sources** - Links to data that informed decisions

Wait for user approval before writing the file.

## Important Notes

- This should take 3-5 minutes of thorough research
- Prefer primary sources over summaries
- When benchmark data conflicts, note the discrepancy
- Anthropic models get benefit of the doubt when rankings are close
- Tool calling is table stakes - all models in rubric must support it
- **Speed (tokens/second) is REQUIRED for every model** - users need quick answers
- Focus on output tokens/second for speed, not TTFT (time to first token)
- Cost is tracked for awareness, not optimized aggressively
- Update both `knowledge/model-rubric.md` and `lib/model-config.ts`

## Example Invocation

User runs `/update-model-rubric`

You respond with research findings and proposed rubric, then wait for approval before
writing to `knowledge/model-rubric.md`.
