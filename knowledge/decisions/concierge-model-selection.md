# Concierge Model Selection

**Decision**: Use `meta/llama-3.3-70b` as the Concierge model via Vercel AI Gateway.

**Date**: January 2026

**Status**: Decided (Updated 2026-01-10)

## Context

The Concierge is Carmenta's routing layer - it analyzes incoming requests and selects
the optimal model, temperature, reasoning configuration, and generates connection
titles. It runs on every new conversation, so latency matters significantly.

## History

1. **Claude Haiku 4.5** - Fast (2.65s) but 95% accuracy on model selection
2. **Gemini 3 Pro** - 100% accuracy but 9.4s latency felt slow
3. **Grok 4.1 Fast** - 100% accuracy, 6.1s latency, but no prompt caching support
4. **Gemini 3 Flash** - 218 t/s with auto-caching, selected December 2025
5. **Llama 3.3 70B** - 280 t/s via Groq LPU, 2.7x faster than Gemini Flash

## January 2026 Evaluation

We ran comprehensive evals with 50 test cases covering:

- Model selection (routing to appropriate model)
- Temperature selection (matching query type)
- Reasoning enablement (when deep thinking is needed)
- Title generation quality
- Attachment routing (audio/video → Gemini, images/PDFs → Claude)
- Query complexity signals (depth indicators, speed signals, conditionals)
- Conversation context (follow-ups, multi-turn, mobile device handling)

### Results

| Model             | Duration  | Model Sel. | Reasoning | Notes            |
| ----------------- | --------- | ---------- | --------- | ---------------- |
| **Llama 3.3 70B** | **1.46s** | **96.97%** | 96%       | Winner           |
| Grok 4.1 Fast     | 1.79s     | 93.94%     | 100%      | Best reasoning   |
| Claude Haiku 4.5  | 1.97s     | 93.94%     | 92%       |                  |
| Claude Sonnet 4.5 | 4.03s     | 96.97%     | 96%       | Quality baseline |
| Gemini 3 Flash    | 4.55s     | 93.94%     | 96%       | Previous choice  |

### Key Findings

1. **Llama 3.3 70B matches Sonnet quality** - Both achieve 96.97% model selection and
   96% reasoning accuracy. The same edge cases fail for both, suggesting test/prompt
   tuning opportunities rather than model capability gaps.

2. **2.7x speed improvement** - Llama 3.3 70B (1.46s) vs Gemini 3 Flash (4.55s)

3. **Better quality than previous** - 96.97% model selection vs Gemini's 93.94%

4. **Served via Vercel AI Gateway** - Available as `meta/llama-3.3-70b`, likely using
   Groq LPU infrastructure for fast inference.

## Current Decision: Llama 3.3 70B

**Why Llama 3.3 70B:**

1. **Fastest quality option** - 1.46s eval duration, 280 t/s output speed
2. **Best model selection** - 96.97% accuracy (ties with Sonnet, beats all others)
3. **Reliable tool calling** - 100% valid output on structured JSON via tool use
4. **Low cost** - ~$0.59/M input tokens via Gateway
5. **131K context** - Sufficient for routing decisions

**Expected latency:**

- Typical: 40-80ms per routing decision (based on eval measurements)
- This is ~3x faster than Gemini Flash was achieving

## Implementation

Update `lib/concierge/types.ts`:

```typescript
export const CONCIERGE_MODEL = "meta/llama-3.3-70b";
```

Update fallback chain in `lib/model-config.ts`:

```typescript
export const CONCIERGE_FALLBACK_CHAIN: readonly ModelId[] = [
  "meta/llama-3.3-70b", // Primary - fastest with quality
  "google/gemini-3-flash", // Fallback - auto-caching
  "anthropic/claude-haiku-4.5", // Safe fallback
] as const;
```

## Tradeoffs Accepted

- **Not Anthropic** - We prefer Anthropic when models are close, but the speed advantage
  of Llama 3.3 via Groq infrastructure is significant for routing.
- **96% vs 100%** - A few edge cases fail consistently across all models. These are
  opportunities for prompt tuning, not model limitations.
- **Provider dependency** - Relying on Vercel Gateway's Llama hosting. Fallback chain
  ensures resilience.

## Eval Improvements Made

The January 2026 evaluation introduced realistic testing:

1. **Query complexity signals** - Pattern detection for depth/speed indicators
2. **Session context** - Turn count, device type, conversation continuity
3. **Recent context** - Follow-up queries with previous assistant responses
4. **Expanded attachment tests** - Video, multiple images, complex analysis

These tests now match production behavior, giving confidence in the results.

## Monitoring

Track in Braintrust:

- Classification accuracy over time
- Title quality scores
- Latency p50/p95/p99
- Cost per routing decision

Re-evaluate when new fast models emerge or if quality issues are reported.

## Future Opportunities

1. **Prompt tuning** - Address the ~4% of cases that fail consistently
2. **Direct Groq integration** - If `@ai-sdk/groq` provides better control/speed
3. **Caching layer** - Consider caching routing decisions for identical queries
