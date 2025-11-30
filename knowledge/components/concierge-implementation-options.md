# Concierge Implementation Options

Design options for key technical decisions. These are possibilities, not prescriptions.

## Streaming Concierge Data to UI

The Concierge makes decisions before the main model responds. How to surface these in
the UI.

Option A Custom Data Parts: Extend AI SDK UIMessage with custom data parts. Stream
concierge metadata as data-concierge part before text response. Native to AI SDK. UI
renders insight immediately. Requires custom type definitions. Parts array handling for
AI SDK 5.x.

Option B Response Headers: Send decisions as HTTP headers. Simple implementation.
Available before stream starts. Size limits. Not part of message history.

Option C Separate API Call: Client makes two requests. Clean separation. Adds latency.
Client manages coordination.

Option D First Chunk Protocol: First chunk contains JSON metadata. Single connection.
Client parses first chunk differently. Less native to AI SDK.

## Model Rubric Management

Where model recommendations live.

Option A File-Based Runtime Read: Read knowledge/model-rubric.md at runtime. Easy to
update. File I/O on every request (cacheable). Rubric lives with other knowledge.

Option B Compiled Configuration: Import rubric as TypeScript at build time. Type-safe.
No runtime I/O. Requires deploy to update.

Option C External Configuration: Store in database or config service. Update without
deploy. Additional infrastructure. Could support A/B testing.

## Complexity Inference

The Concierge infers complexity rather than user selection.

Option A Fast Model: Use Haiku to assess complexity before routing. Adds latency (small
model is fast). Can assess multiple signals. Cost per request.

Option B Heuristics: Rule-based assessment using query length, keywords, attachments. No
model call. Deterministic. May miss nuance. Easy to tune.

Option C Hybrid: Heuristics for obvious cases, model for ambiguous. Fast path for
simple. Model reasoning when needed.

## Context Assembly

Pre-query phase assembles context.

Option A Parallel Fetches: Knowledge search, memory lookup, preference fetch run in
parallel. Minimizes latency. Promise.all pattern.

Option B Cascading: Quick relevance check first, deep context only if needed. Saves work
for simple queries. May miss useful context.

Option C Streaming Assembly: Begin model call immediately, inject context via tool
calls. Lowest time-to-first-token. Complex coordination.

## Post-Response Enhancement

Concierge adds value after model responds.

Option A Synchronous: Transform before streaming. Clean output. Adds latency.

Option B Progressive: Stream response, then enhancements. Fast first token. Page builds
over time. Better perceived performance.

Option C Client-Side: Client fetches enhancements separately. Response unblocked.
Additional requests.

## Observation Storage

Where per-interaction observations live.

Option A Relational Database: Postgres or Turso. Queryable. Schema migrations. Works
with existing layer. Render disks are ephemeral.

Option B Append-Only Log: Simple write path. Natural for events. Batch processing for
patterns.

Option C Existing Observability: Extend Sentry or add Honeybadger. Leverages
infrastructure. May not fit schema. Good for errors, less for quality.

Option D Hybrid: Errors to Sentry, observations to database, patterns via scheduled job.
Right tool for each job.

## Quality Assessment Timing

When improvement loop evaluates response quality.

Option A Synchronous: Evaluate before request complete. Guaranteed. Adds latency.

Option B Fire-and-Forget: Queue evaluation, do not wait. No latency. May lose on crash.

Option C Background Worker: Separate process consumes queue. Decoupled. Survives
restarts. Render supports this.

## Prior Exploration

The feature/concierge branch explored some options. Reference files:

lib/types/ui-message.ts: Extended UIMessage with ConciergeData interface. Type guard
isConciergeDataPart. Pattern for streaming metadata alongside response.

lib/concierge/rubric.ts: Reads model-rubric.md at runtime. Caching with clearRubricCache
for testing. Fallback models. CONCIERGE_MODELS config.

lib/concierge/index.ts: runConcierge entry point. extractMessageText handles AI SDK 5.x
parts. formatMessagesForClassification for context. parseClassificationResponse with
fallbacks. Sentry span instrumentation.

components/connect/model-reasoning.tsx: Collapsible transparency component. Format
helpers. Animation patterns.

app/api/connect/route.ts: Zod request validation. Graceful fallback. Tool definitions.
Telemetry integration.

Learnings: User-selected speed mode felt wrong and led to inference approach. Rigid task
types felt brittle and were eliminated. Classification prompt was too prescriptive.

These are reference points. A fresh approach may find better solutions.
