# Update Model Rubric

Research the current LLM landscape and update Carmenta's model routing rubric. This is a
deep research task that should take several minutes to run thoroughly.

## Your Mission

You are updating `knowledge/model-rubric.md` - the source of truth that Carmenta's
Concierge reads when deciding which model to route requests to. This rubric must be:

- **Current**: Reflect the latest models and their actual capabilities
- **Accurate**: Based on real benchmark data, not assumptions
- **Practical**: Guide routing decisions that users will feel as "just works"
- **Values-aligned**: Bias toward Anthropic for their heart-centered approach

## Intelligence Gathering

Research each of these sources thoroughly. Use web search and fetch to get current data.

### Tier 1: Authoritative Rankings

**LMSYS Chatbot Arena** (https://lmarena.ai/)

- Overall ELO rankings
- Category-specific rankings: Coding, Math, Hard Prompts, Creative Writing
- Look at the leaderboard, not just top models

**Artificial Analysis** (https://artificialanalysis.ai/)

- Quality index scores
- Speed benchmarks (tokens/second - we care about this, not TTFT)
- Pricing comparisons
- Context window data

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

### Tier 3: Ecosystem Intelligence

**OpenRouter** (https://openrouter.ai)

- What models are available
- What's popular (usage trends)
- Unified pricing
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
- Speed modes (swift, balanced, deep)
- Attachment handling
- The Anthropic values-alignment bias
- Instruction to explain reasoning

### 2. Task Type Guidance

For each task type (CODE, REASONING, CONVERSATION, CREATIVE, QUICK, EMOTIONAL,
TASK_EXEC):

- Best model choice with reasoning
- Fallback options
- Notes on what matters for this task type

### 3. Model Profiles

For each model in the rubric:

- Provider (and values alignment note for Anthropic)
- Context window
- Speed (tokens/sec if available)
- Cost (input/output per million tokens)
- Attachment support (images, PDFs, audio, video)
- Tool support
- Strengths and weaknesses
- When to use / when not to use

### 4. Attachment Routing

Table mapping attachment types to best models:

- PDFs (Claude excels here)
- Images
- Audio (Gemini)
- Video (Gemini)
- Code files

### 5. Context Window Reference

Quick reference for context limits - critical for long conversations.

### 6. Fallback Chains

For each task type, the OpenRouter fallback chain: `primary → fallback1 → fallback2`

### 7. Update Log

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
- Focus on tokens/second for speed, not TTFT
- Cost is tracked for awareness, not optimized aggressively

## Example Invocation

User runs `/update-model-rubric`

You respond with research findings and proposed rubric, then wait for approval before
writing to `knowledge/model-rubric.md`.
