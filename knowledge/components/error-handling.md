# Error Handling

Error tracking, reporting, and recovery - catching problems before users notice them,
understanding what went wrong when they do, and building resilience into the system.

## Why This Exists

Things break. APIs fail. Models hallucinate. Edge cases surprise you. The question isn't
whether errors will happen - it's whether you'll know about them, understand them, and
fix them quickly.

Good error handling is invisible when it works. Errors get caught, logged, and often
recovered from automatically. When errors do surface, we get helpful messages, not stack
traces. And developers get the context they need to fix issues fast.

## Core Functions

### Error Capture

Catch and record errors across the system:

- Uncaught exceptions and crashes
- API failures and timeouts
- Validation errors
- AI-specific errors (model failures, content policy violations)

### Error Context

Capture the context needed to debug:

- User and session information
- Request data and state
- Stack traces and source maps
- Breadcrumbs (recent user actions)
- Environment information

### Error Reporting

Surface errors to the right people:

- Real-time alerts for critical errors
- Aggregation and deduplication
- Trend detection (new errors, regressions)
- Assignment and tracking

### Error Recovery

Handle errors gracefully:

- Retry logic for transient failures
- Fallback behaviors when services are unavailable
- Graceful degradation
- User-friendly error messages

## Technology Choice: Sentry

We use Sentry for error tracking. Decision rationale:

- **Best-in-class error tracking**: Source maps, stack traces, breadcrumbs
- **Next.js integration**: First-party SDK with automatic instrumentation
- **Performance monitoring**: Traces and spans integrated with errors
- **Unified with LLM observability**: Single platform for errors + AI tracing (see
  observability.md)
- **Separates concerns**: PostHog for product analytics, Sentry for errors

Sentry captures exceptions with rich context. See `typescript-coding-standards.mdc` for
usage patterns: `Sentry.captureException` with tags and extra data, breadcrumbs for
state changes, spans for performance monitoring.

## Implementation (M1)

### Error Boundaries

We use Next.js App Router error boundaries at two levels:

- **`app/global-error.tsx`**: Catches errors in the root layout. Last line of defense.
  Renders a full-page error UI with retry button.
- **`app/error.tsx`**: Catches errors in route segments. Shows inline error with retry
  and home link options.

Both boundaries:

- Report to Sentry with `Sentry.captureException`
- Include error digest for correlation
- Show user-friendly messages (no stack traces)
- Provide retry functionality

### API Error Handling

API routes wrap logic in try-catch and report to Sentry:

```typescript
try {
  // ... route logic
} catch (error) {
  logger.error({ error }, "Request failed");
  Sentry.captureException(error, {
    tags: { component: "api", route: "chat" },
  });
  return new Response(JSON.stringify({ error: "User-friendly message" }), {
    status: 500,
  });
}
```

### Configuration

- **Production**: Sentry enabled by default
- **Development**: Disabled unless `SENTRY_ENABLED=true` in `.env.local`
- **Sampling**: 100% in dev, 10% in production (adjustable)
- **Session replay**: Enabled for debugging user issues

## Integration Points

- **All components**: Every component should integrate error handling
- **Observability**: Errors correlate with Sentry traces for debugging
- **Analytics**: Error events as part of user journey (separate from PostHog)
- **Interface**: User-facing error states and messages
- **Scheduled Agents**: Alert on scheduled job failures

## Success Criteria

- Errors are captured with enough context to debug
- Critical errors alert the team immediately
- Error trends are visible and tracked
- We see helpful messages, not technical errors
- Recovery happens automatically when possible

---

## Decisions Made

- **Error boundaries**: Route-level (`error.tsx`) + global (`global-error.tsx`). No
  component-level boundaries yet - add as needed for complex components.
- **User communication**: Inline error UI with retry button. No toasts yet.
- **Error detail level**: Generic user-friendly messages. Technical details only in
  Sentry.

## Open Questions

### Architecture

- **Retry strategies**: What's our retry policy for different failure types?
- **Fallback behaviors**: What do we show/do when components fail?

### Product Decisions

- **Recovery options**: Beyond retry, what actions can users take? Report button?

### Technical Specifications Needed

- Error classification taxonomy
- Retry and fallback patterns for LLM failures
- Alert routing and escalation rules
