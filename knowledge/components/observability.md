# Observability

LLM and agent observability - tracing, debugging, and understanding what's happening
inside AI interactions. Essential for development, debugging, and improving quality over
time.

## Why This Exists

AI systems are opaque. When something goes wrong - a bad response, unexpected behavior,
a slow interaction - you need to understand what happened. What prompt was sent? What
context was retrieved? How did the model respond? Why did the agent take that path?

Observability makes the invisible visible. Traces capture the full journey of a request
through the system. Developers can debug issues, identify patterns, and understand model
behavior. This is table stakes for building reliable AI products.

## The Prompt is Not an Observability Sink

**Common pitfall**: Sticking debug logs, error messages, and giant tool outputs into the
prompt. This pollutes attention and degrades agent performance.

**Humans need observability**. Agents drown in it.

What NOT to do:

- ❌ Adding debug logs to the context window
- ❌ Injecting error messages meant for developers
- ❌ Including giant tool outputs in full
- ❌ Using the prompt to track internal state

Instead:

- ✅ Log to structured logging system (Pino)
- ✅ Store tool outputs to disk, pass pointers/handles
- ✅ Keep prompt focused on what the agent needs to act
- ✅ Build observability views for humans separately

A well-constructed context engineering system IS observable - you can trace session
logs, compaction events, memory updates. But this tracing happens **outside** the
agent's working context.

The separation is critical: observability for developers happens in Sentry, logs, and
traces. Context for agents stays minimal and action-focused.

## Technology Choice: Sentry AI Monitoring

We use Sentry for LLM observability, unified with error tracking. Decision rationale:

- **Unified platform**: Errors and LLM traces in one place, correlated automatically
- **Vercel AI SDK integration**: Native support via `experimental_telemetry`
- **Full-stack context**: LLM traces connect to frontend replays, backend spans
- **No additional vendor**: Already using Sentry for errors (see error-handling.md)
- **Included in plan**: LLM monitoring included with Sentry Business/Enterprise

Alternatives considered:

- **Langfuse**: More mature LLM-specific features (prompt versioning, evals) but adds
  vendor sprawl. Consider if we need advanced prompt management.
- **Helicone**: Good for cost tracking, but Sentry covers basics.
- **Langsmith**: Tightly coupled to LangChain, we use Vercel AI SDK.

## Implementation (M1)

### Vercel AI SDK Telemetry

LLM tracing is enabled via the `experimental_telemetry` option on `streamText`:

```typescript
const result = await streamText({
  model: openrouter.chat(MODEL_ID),
  system: SYSTEM_PROMPT,
  messages: convertToModelMessages(messages),
  experimental_telemetry: {
    isEnabled: true,
    functionId: "chat",
    recordInputs: true,
    recordOutputs: true,
    metadata: { model: MODEL_ID },
  },
});
```

### What Gets Captured

- Input prompts (system, user messages)
- Model ID and parameters
- Output responses (streamed text)
- Token usage and latency
- Errors with full context

### Sentry Configuration

- **Server**: `instrumentation.ts` → `sentry.server.config.ts` with
  `vercelAIIntegration`
- **Client**: `instrumentation-client.ts` (unified with PostHog init)
- **Sampling**: 100% in dev, 10% in production

## Core Functions

### LLM Tracing

Capture every interaction with language models:

- Input prompts (system, user, context)
- Model parameters (temperature, max tokens, model ID)
- Output responses (full text, token usage, latency)
- Cost tracking per request and aggregated

### Agent Tracing

For multi-step agent workflows:

- Step-by-step execution traces
- Tool calls and their results
- Decision points and routing choices
- Memory retrievals and context injection
- Handoffs between agents

### Debug Tools

Make traces actionable:

- Search and filter traces by user, time, model, status
- Replay traces to understand behavior
- Compare traces across versions
- Identify slow steps and bottlenecks

### Quality Metrics

Track quality signals over time:

- Response latency distributions
- Token usage patterns
- Error rates by type
- Model performance comparisons

## Integration Points

- **Concierge**: Trace classification, routing, and enhancement decisions
- **AI Team**: Trace multi-agent orchestration and handoffs
- **Memory**: Trace retrieval queries and results
- **Service Connectivity**: Trace external service calls
- **Product Intelligence**: Feed quality signals into product improvement

## Success Criteria

- Developers can debug any user interaction within minutes
- Performance bottlenecks are visible and measurable
- Cost per interaction is tracked and attributable
- Quality trends are visible over time
- Traces don't noticeably impact performance

---

## Decisions Made

- **Platform choice**: Sentry with Vercel AI SDK integration. Unified with error
  tracking, no additional vendor needed.
- **Sampling**: 100% in dev for debugging, 10% in production to manage costs.
- **Real-time vs. batch**: Real-time streaming via Sentry's built-in transport.
- **Input/output recording**: Enabled. Be mindful of PII in prompts/responses.

## Open Questions

### Architecture

- **Data retention**: How long do we keep traces? Sentry's default retention policy?
- **Cost tracking**: How do we aggregate token costs across conversations?

### Product Decisions

- **User visibility**: Do users see any observability data? Response times? Token usage?
- **Alerting**: What conditions trigger alerts? Who gets notified?

### Future Considerations

- **Prompt versioning**: If we need prompt A/B testing or versioning, consider adding
  Langfuse alongside Sentry.
- **Evaluations**: Sentry doesn't do LLM evals. May need separate tooling for quality
  scoring.
- **Multi-agent tracing**: Current setup traces single LLM calls. Agent orchestration
  (M4) will need span hierarchies.
