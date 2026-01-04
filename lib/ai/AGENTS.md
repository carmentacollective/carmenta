# AI Provider Configuration

## Model IDs - DO NOT USE TRAINING DATA

Model IDs change frequently. **Never use model IDs from memory or training data.**

Always verify against live sources:

- **Vercel AI Gateway**:
  `curl https://ai-gateway.vercel.sh/v1/models -H "Authorization: Bearer $AI_GATEWAY_API_KEY" | jq '.data[].id'`
- **OpenRouter**: `curl https://openrouter.ai/api/v1/models | jq '.data[].id'`

The canonical model configuration lives in `lib/model-config.ts`. All model references
should use IDs from that file, not hardcoded strings.

## Current Stack

We use **Vercel AI Gateway** (not OpenRouter) for production. The gateway.ts file
handles model ID translation where needed (e.g., `x-ai/` → `xai/`).

## Adding New Models

1. Fetch the current model list from the Gateway endpoint above
2. Add the model to `MODELS` array in `lib/model-config.ts`
3. Add fallback chain in `MODEL_FALLBACKS`
4. Update `ALLOWED_MODELS` in `lib/concierge/types.ts` if the concierge should route to
   it

## Common Mistakes

- Using `anthropic/claude-sonnet-4` instead of `anthropic/claude-sonnet-4.5`
- Using `x-ai/grok-*` instead of `xai/grok-*` (Gateway uses `xai/` prefix)
- Using `google/gemini-3.0-*` instead of `google/gemini-3-*` (no `.0`)
- Using old model versions like `claude-3-5-sonnet-20241022`

When in doubt, check the live endpoint or `lib/model-config.ts`.
