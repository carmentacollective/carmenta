# Model Discovery

Dynamic discovery of available LLM models, their capabilities, and performance
characteristics. Complements static routing rubrics with real-time model data.

## Why This Exists

The LLM landscape changes weekly. New models release, old ones deprecate, performance
varies by time of day, pricing shifts without notice. Static configuration requires
manual updates and risks routing to unavailable or deprecated models.

Vercel's ai-chatbot shipped dynamic model discovery from Vercel AI Gateway in
December 2025. OpenRouter exposes 500+ models through a single API with rich metadata.
The infrastructure for dynamic discovery exists; we need to leverage it.

Static rubrics remain valuable for routing heuristics, values alignment, and benchmark
interpretation. Dynamic discovery handles availability, pricing, and capability
verification.

## User Stories

As a user, when I start a conversation, Carmenta knows which models are currently
available so I never see errors from deprecated or unavailable models.

As a user, when I attach audio or video, Carmenta routes to a model that actually
supports those modalities right now, not one that supported them last month.

As a power user, when a new model releases, I see it in the model selector without
waiting for a Carmenta update.

As the Concierge, when routing a request, I know current throughput characteristics so I
can route speed-sensitive requests to the fastest available option.

As an operator, when a provider has an outage, routing automatically adapts without
manual intervention.

## Discovery Sources

### Primary: OpenRouter Models API

OpenRouter's `/api/v1/models` endpoint returns comprehensive metadata for 500+ models.
This is our primary discovery source since Carmenta routes through OpenRouter.

What OpenRouter provides:

- Model identifiers (exact IDs for API calls)
- Context window sizes
- Pricing (input/output per token)
- Input modalities (text, image, audio, video, file)
- Output modalities (text, image, embeddings)
- Supported parameters (tools, temperature, top_p, etc.)
- Architecture details (tokenizer, instruction type)
- Provider performance data

What OpenRouter does not provide:

- Speed benchmarks (tokens/second) - only provider selection hints
- Quality rankings (LMSYS ELO, etc.)
- Detailed capability descriptions
- Deprecation warnings (sometimes)

Dynamic variants available through OpenRouter:

- `:nitro` routes to fastest provider by throughput
- `:floor` routes to cheapest provider
- `:thinking` enables reasoning by default
- `:online` adds web search capability

Source: https://openrouter.ai/docs/api/api-reference/models/get-models

### Secondary: Vercel AI Gateway

Vercel's `gateway.listModels()` returns models configured for the gateway with basic
metadata. Less comprehensive than OpenRouter but useful for validation.

What Vercel provides:

- Model ID and name
- Model type (language-model, embedding-model)
- Basic description

The gateway also handles provider selection dynamically based on uptime and latency,
which reduces our routing burden.

Source: https://vercel.com/docs/ai-gateway/models-and-providers

### Tertiary: Artificial Analysis (Speed Data)

Artificial Analysis benchmarks model performance 8 times daily across providers. Their
methodology measures real-world API performance, not theoretical maximums.

What they provide:

- Output speed (tokens/second, averaged after first token)
- Time to first token (TTFT)
- Total response time for 100 output tokens
- Historical performance trends
- Provider-specific measurements

Limitation: No public API. Speed data would require scraping or manual updates.

Source: https://artificialanalysis.ai/methodology/performance-benchmarking

## Metadata Schema

What we need to know about each model for routing decisions:

```
ModelDiscoveryData {
  // Identity
  id: string                    // OpenRouter model ID (e.g., "anthropic/claude-sonnet-4.5")
  provider: string              // anthropic, openai, google, x-ai, etc.
  displayName: string           // Human-friendly name

  // Availability
  available: boolean            // Currently accepting requests
  deprecated: boolean           // Marked for removal
  lastSeen: timestamp           // Last successful discovery

  // Capabilities (from API)
  contextWindow: number         // Maximum tokens
  inputModalities: string[]     // text, image, audio, video, file
  outputModalities: string[]    // text, image, embeddings
  supportsTools: boolean        // Function/tool calling
  supportsStreaming: boolean    // Streaming responses
  supportedParameters: string[] // temperature, top_p, etc.

  // Performance (from API or static)
  tokensPerSecond: number       // Output speed (static until we have dynamic source)
  speedTier: fast|moderate|deliberate

  // Cost (from API)
  inputCostPerMillion: number   // USD per million input tokens
  outputCostPerMillion: number  // USD per million output tokens

  // Metadata
  discoverySource: string       // openrouter, vercel, static
  lastUpdated: timestamp
}
```

### Fields from Discovery vs Static

From discovery (updated at runtime):

- id, provider, displayName
- available, deprecated
- contextWindow
- inputModalities, outputModalities
- supportsTools, supportsStreaming, supportedParameters
- inputCostPerMillion, outputCostPerMillion

From static rubric (until we have dynamic speed source):

- tokensPerSecond, speedTier
- Routing heuristics (sensitivity, values alignment)
- Quality assessments (benchmark interpretations)

## Caching Strategy

### Cache Layers

1. **Edge cache (Vercel)**: OpenRouter API responses cached 5 minutes
2. **Application cache**: Parsed model data in memory, refreshed on edge miss
3. **Fallback cache**: Last known good data persisted to handle discovery failures

### Refresh Frequency

- **Model list**: Every 5 minutes (edge cache TTL)
- **Pricing**: Same as model list (included in API response)
- **Availability**: Per-request check via fallback chain (OpenRouter handles this)
- **Speed data**: Static until dynamic source available

### Cache Invalidation

- Time-based: 5-minute TTL at edge
- On error: Fall back to previous good data, retry on next request
- Manual: Admin endpoint to force refresh (for known model releases)

## Fallback Behavior

When discovery fails, the system must continue functioning.

### Discovery Unavailable

If OpenRouter API is unreachable:

1. Use cached model data (last successful discovery)
2. If no cache, use static `lib/model-config.ts` as fallback
3. Log warning to Sentry with context
4. Continue with stale data, retry discovery on next request

### Model Unavailable at Request Time

If a discovered model is unavailable when called:

1. OpenRouter's fallback chain handles this automatically
2. We configure fallback chains in `lib/model-config.ts`
3. User sees the response, not the routing complexity

### Newly Discovered Models

When discovery returns models not in our rubric:

1. Model is available in discovery data but not curated
2. Do not automatically add to UI model selector (curation matters)
3. Log new models for human review
4. Admin can add to static rubric after evaluation

## Routing Integration

### Concierge Flow

The Concierge uses both static rubric and dynamic discovery:

1. Read static rubric for routing heuristics (which model for which task)
2. Verify selected model is available via discovery cache
3. Get current pricing for cost-aware decisions
4. Confirm capability requirements (modalities, tools) against discovery data
5. If selected model unavailable, apply fallback from rubric

### Speed Routing

For speed-sensitive requests ("quick", "fast", "briefly"):

1. Get models sorted by tokensPerSecond from static config
2. Filter to available models via discovery
3. Route to fastest available that meets capability requirements

Long-term: If Artificial Analysis or OpenRouter expose speed APIs, use dynamic data.

### Capability Routing

For attachment-based routing (audio, video):

1. Query discovery for models with required input modality
2. Filter to our curated set (not all 500+ models)
3. Apply routing heuristics from rubric
4. Verify availability before routing

## UI Considerations

### Model Selector

The model selector shows curated models, not all discovered models.

Discovery informs the selector:

- Availability indicators (green/red/yellow)
- Current pricing display
- "Deprecated" badge for sunset models
- Capability badges from live data

Discovery does not change the selector:

- Model list comes from static curation
- Order comes from static preference (Anthropic first)
- New models require explicit addition

### Model Info Display

When user selects a model, show:

- Name and provider (static)
- Current price (dynamic)
- Context window (dynamic, usually matches static)
- Capabilities (dynamic, validate against static)
- Speed tier (static)
- Availability status (dynamic)

### Admin View

For operators:

- All discovered models (500+) with metadata
- Comparison to curated list
- New models since last review
- Deprecated models still in rubric
- Pricing changes

## Implementation Phases

### Phase 1: Availability Verification

Use discovery to verify models exist before routing. Fall back gracefully on failure.
Does not change UI or routing logic.

### Phase 2: Capability Verification

Use discovery to confirm capabilities (modalities, tools) match expectations. Log
mismatches for investigation. Still use static rubric for routing.

### Phase 3: Pricing Display

Show live pricing in model selector and admin views. Use discovery data directly.

### Phase 4: Availability Indicators

Show real-time availability in model selector. Requires monitoring discovery over time.

### Phase 5: New Model Detection

Alert operators when new models appear. Facilitate curation workflow.

## Open Questions

**Speed data source**: How do we get tokens/second dynamically? Artificial Analysis has
no API. OpenRouter shows per-provider performance but not aggregated speed. Do we run
our own benchmarks? Accept static speed data as good enough?

**Curation workflow**: When a new model appears, how does it get evaluated and added to
the curated set? Who decides? What criteria?

**Discovery latency**: Does the 5-minute cache TTL affect routing decisions
meaningfully? Should we cache longer/shorter?

**Provider outages**: How do we distinguish "model deprecated" from "provider having a
bad day"? OpenRouter handles this with fallbacks, but should we track it?

**Vercel Gateway integration**: Should we use Vercel's listModels() as primary when
deployed to Vercel, and OpenRouter when self-hosted? Or always use OpenRouter for
consistency?

**Model variants**: Should we expose OpenRouter's :nitro and :floor variants to users?
They could get faster or cheaper responses, but it adds complexity.

## Success Criteria

Users never see "model not found" errors for models in the selector.

Routing decisions use verified capabilities, not assumptions.

Pricing displayed matches what users are charged.

New model releases are discovered within 24 hours of availability on OpenRouter.

Operators can review the full model landscape without manual research.

Static rubric and dynamic discovery stay synchronized (no contradictions).

## Related Components

- `knowledge/model-rubric.md` - Static routing rubric
- `knowledge/model-rubric-detailed.md` - Detailed model reference
- `lib/model-config.ts` - TypeScript model configuration
- `knowledge/components/concierge.md` - How the Concierge uses model data
- `.claude/commands/update-model-rubric.md` - Manual rubric update process
