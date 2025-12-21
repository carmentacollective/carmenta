# Concierge Model Selection

**Decision**: Use `google/gemini-3-flash-preview` as the Concierge model.

**Date**: December 2025

**Status**: Decided (Updated 2025-12-20)

## Context

The Concierge is Carmenta's routing layer - it analyzes incoming requests and selects
the optimal model, temperature, reasoning configuration, and generates connection
titles. It runs on every new conversation, so latency matters significantly.

## History

1. **Claude Haiku 4.5** - Fast (2.65s) but 95% accuracy on model selection
2. **Gemini 3 Pro** - 100% accuracy but 9.4s latency felt slow
3. **Grok 4.1 Fast** - 100% accuracy, 6.1s latency, but no prompt caching support

## The Caching Insight

The concierge system prompt is ~4-5K tokens (model rubric + instructions). Without
prompt caching, every call processes this entire prompt fresh.

**Caching support through OpenRouter:**

| Model            | Caching      | Minimum Tokens | Notes                                                                 |
| ---------------- | ------------ | -------------- | --------------------------------------------------------------------- |
| Gemini 3 Flash   | ✅ Automatic | 2,048          | Just works ([source](https://ai.google.dev/gemini-api/docs/gemini-3)) |
| Claude Haiku 4.5 | ⚠️ Manual    | 1,024          | Requires `cache_control` breakpoints                                  |
| Grok 4.1 Fast    | ❌ None      | N/A            | Every call is fresh                                                   |

Gemini 3 Flash's automatic caching with 2,048 token minimum means our ~4-5K token system
prompt qualifies automatically. After the first call, subsequent calls only process the
user query portion (~100-500 tokens).

## Current Decision: Gemini 3 Flash

**Why Gemini 3 Flash Preview:**

1. **Fastest raw speed** - 218 t/s output, 45% faster than Haiku/Grok (~150 t/s)
2. **Automatic prompt caching** - No code changes needed, 1,028 token minimum met
3. **Lowest cost** - $0.50/$3 per M tokens vs Haiku's $1/$5
4. **Native multimodal** - Handles routing with any attachment type naturally
5. **1M context** - Future-proof for any prompt expansion

**Expected latency with caching:**

- Cold (first call): ~1-2s (processing full ~4-5K token prompt)
- Warm (cached): Sub-second (processing only ~100-500 token user query)

The cache TTL is reasonable for interactive use - subsequent messages in a session will
hit the warm cache.

## Implementation

Update `lib/concierge/types.ts`:

```typescript
export const CONCIERGE_MODEL = "google/gemini-3-flash-preview";
```

## Tradeoffs Accepted

- **Not Anthropic** - We prefer Anthropic when models are close, but the automatic
  caching + speed advantage of Gemini 3 Flash is significant here.
- **Preview model** - Using preview version; will update to stable when available.

## Alternative: Claude Haiku 4.5 with Manual Caching

If we need to switch back to Anthropic, we can implement explicit `cache_control`
breakpoints in the message structure. This requires code changes but can reduce latency
by up to 85% per Anthropic's documentation.

## Monitoring

Track in Braintrust:

- Classification accuracy over time
- Title quality scores
- Latency p50/p95/p99 (expect significant improvement)
- Cache hit rate (via OpenRouter usage stats)
- Cost per routing decision

Re-evaluate when Gemini 3 Flash reaches stable or if latency issues emerge.
