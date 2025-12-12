# Anthropic Thinking Blocks: Multi-Step Tool Limitation

Date: 2025-12-12 Status: Decided

## Context

When using Anthropic models with extended thinking (reasoning) AND multi-step tool
calling, the API rejects on step 2+ with:

```
messages.1.content.2: `thinking` or `redacted_thinking` blocks in the latest
assistant message cannot be modified
```

This error occurs in production when users send research or comparison queries that need
both deep reasoning AND multiple web searches (e.g., "Compare Claude vs GPT pricing with
current data").

## The Problem

The failure sequence:

1. User sends query requiring reasoning + research (e.g., "Compare Claude vs GPT
   pricing")
2. Carmenta routes to Claude with reasoning enabled (concierge decision)
3. Claude responds with thinking blocks + web search tool call (step 1)
4. Vercel AI SDK builds next request, including previous response with thinking blocks
5. Anthropic API rejects: thinking blocks can't be included in subsequent messages
6. User sees cryptic error, query fails

**Root cause**: Anthropic's API design doesn't allow thinking blocks to be echoed back
in conversation history. The Vercel AI SDK's multi-step tool calling includes previous
responses by design.

**SDK limitation**: We explored filtering thinking blocks between steps using the
`prepareStep` callback, but SDK bug
[vercel/ai#9631](https://github.com/vercel/ai/issues/9631) means modified messages
aren't actually used. The SDK uses an internal append-only `responseMessages` array.

## Attempted Approaches

### 1. Filter thinking blocks in prepareStep (Failed)

```typescript
prepareStep: ({ steps }) => {
  const lastStep = steps[steps.length - 1];
  const filtered = filterThinkingBlocks(lastStep.response.messages);
  return { messages: filtered }; // SDK ignores this
};
```

**Result**: SDK bug #9631 - modified messages aren't used for subsequent steps.

### 2. Disable multi-step for ALL models when reasoning enabled

**Result**: Works but overly broad. Penalizes Grok and future models that don't have
this limitation.

## Decision

Two-layer solution:

### Layer 1: Concierge Routing (Primary Fix)

Update `model-rubric.md` so the concierge routes reasoning + research queries to Grok.

Updated Grok from `grok-4-fast` → `grok-4.1-fast` (best agentic tool calling, halves
hallucinations). Added `openai/gpt-5.2` as premium alternative with SOTA tool calling.

Added to Grok's "Choose when" section:

- Research/comparison queries needing reasoning + web search
- Queries requiring extended thinking AND multi-step tool use

Both Grok 4.1-fast and GPT-5.2 handle reasoning + multi-step tools gracefully without
the thinking blocks issue. Verified on 2025-12-12.

### Layer 2: Code Safety Net (Fallback)

Disable multi-step for Anthropic + reasoning in `route.ts`.

```typescript
const isAnthropicModel = modelConfig?.provider === "anthropic";
const disableMultiStepForReasoning = isAnthropicModel && concierge.reasoning.enabled;

// In streamText config:
...(modelSupportsTools && !disableMultiStepForReasoning && { stopWhen: stepCountIs(5) }),
```

This catches:

- Users who manually select an Anthropic model
- Concierge edge cases where it still picks Claude despite routing guidance
- Single-step tool use still works (graceful degradation)

## Trade-offs

**Accepted**:

- Grok may have different reasoning style than Claude for some queries
- Users who explicitly select Claude + high reasoning get single-step tool use only
- Slightly more complex routing logic in concierge

**Why acceptable**:

- Grok is capable for research/comparison queries
- Single-step is better than a cryptic error
- The SDK bug may be fixed eventually, making this temporary

## Future Considerations

**If SDK bug #9631 is fixed**: We could remove the safety net code and let Claude handle
reasoning + multi-step directly. The concierge routing could also be relaxed.

**If OpenAI models added**: o-series models may handle reasoning + tools differently.
Research needed before adding to ALLOWED_MODELS.

**Prompt engineering option**: Teaching Claude to batch tool calls in parallel (single
step) rather than sequential multi-step might improve UX regardless of this bug.

## Verification

- [x] Grok tested with reproduction query: reasoning + multi-step works
- [x] Anthropic safety net: gracefully falls back to single-step
- [x] Existing tests pass
- [x] No regression in normal (non-reasoning) multi-step queries

## References

- [vercel/ai#9631](https://github.com/vercel/ai/issues/9631) - prepareStep
  messages-overriding is not preserved between steps (OPEN)
- [vercel/ai#7729](https://github.com/vercel/ai/issues/7729) - Extended thinking with
  tool use (OPEN)
- [vercel/ai#6615](https://github.com/vercel/ai/issues/6615) - prepareStep should allow
  response message modification (OPEN)
