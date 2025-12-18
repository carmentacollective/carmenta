# Concierge Model Selection

**Decision**: Use `google/gemini-3-pro-preview` as the Concierge model.

**Date**: December 2025

**Status**: Decided

## Context

The Concierge is Carmenta's routing layer - it analyzes incoming requests and selects
the optimal model, temperature, reasoning configuration, and generates connection
titles. It runs on every new conversation, so performance matters.

Previously using `anthropic/claude-haiku-4.5` for speed.

## Evaluation

Ran 32 test cases across 9 categories (speed signals, complexity, creativity, code,
reasoning, sensitivity, attachments, hints, edge cases) against 4 candidates.

See `knowledge/research/2025-12-18-concierge-model-eval.md` for full data.

### Results Summary

| Model            | Model Selection | Temperature | Reasoning | Speed | Cost/Call |
| ---------------- | --------------- | ----------- | --------- | ----- | --------- |
| Claude Haiku 4.5 | 95%             | 85.7%       | 92.3%     | 2.65s | $0.0037   |
| Gemini 3 Pro     | **100%**        | **100%**    | 92.3%     | 9.4s  | $0.0044   |
| Grok 4.1 Fast    | **100%**        | **100%**    | 92.3%     | 6.1s  | $0.0165   |
| GPT-5 Mini       | **100%**        | **100%**    | 92.3%     | 18.9s | $0.0014   |

## Decision Rationale

**Why Gemini 3 Pro:**

1. **100% accuracy** on model selection and temperature - no misroutes
2. **Reasonable cost** - only ~$70/month more than Haiku at 100K calls/month
3. **Acceptable latency** - 9.4s for routing is fine since it's one-time per
   conversation
4. **Native multimodal** - handles audio/image/video routing naturally

**Why not Haiku (current):**

The 6.4% accuracy gap (95% vs 100% model selection, 85.7% vs 100% temperature) means
real user impact. 6 out of 100 queries get routed to wrong model or temperature.

**Why not GPT-5 Mini:**

Cheapest and most accurate, but 19 seconds is too slow. Users would feel lag on every
new conversation.

**Why not Grok 4.1 Fast:**

4.5x the cost of Gemini for only marginally better speed (6s vs 9.4s). Not worth it.

## Implementation

Update `lib/concierge/types.ts`:

```typescript
export const CONCIERGE_MODEL = "google/gemini-3-pro-preview";
```

## Tradeoffs Accepted

- **Slower than Haiku** - 9.4s vs 2.65s. Acceptable since it's one-time per
  conversation.
- **Slightly higher cost** - $0.0044 vs $0.0037 per call. Worth it for accuracy.
- **No reasoning tokens** - Gemini 3 Pro doesn't support extended reasoning. Not needed
  for the concierge task (classification, not analysis).

## Monitoring

Track in Braintrust:

- Classification accuracy over time
- Title quality scores
- Latency p50/p95/p99
- Cost per routing decision

Re-evaluate quarterly or when new model releases occur.
