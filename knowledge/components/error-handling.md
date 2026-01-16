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

## Technology Choice: Sentry

We use Sentry for error tracking. Decision rationale:

- **Best-in-class error tracking**: Source maps, stack traces, breadcrumbs
- **Next.js integration**: First-party SDK with automatic instrumentation
- **Performance monitoring**: Traces and spans integrated with errors
- **Unified with LLM observability**: Single platform for errors + AI tracing (see
  observability.md)
- **Separates concerns**: PostHog for product analytics, Sentry for errors

---

## Architecture: Minimal Instrumentation

### The Principle

**If Sentry is configured correctly, automatic capture should handle 95% of errors.**

Manual `Sentry.captureException` calls should only exist in:

1. **Error boundaries** - Next.js intercepts these, so we must manually report
2. **API error wrapper** - Centralized place for API route errors
3. **Background operations** - Fire-and-forget tasks where failure shouldn't crash the
   request
4. **Graceful degradation** - UI features where we catch, report, and continue

### What Sentry Captures Automatically

With correct setup, these need NO manual captureException:

| Error Type                   | Captured By                        |
| ---------------------------- | ---------------------------------- |
| Unhandled client exceptions  | `globalHandlersIntegration`        |
| Unhandled promise rejections | `globalHandlersIntegration`        |
| Server Component errors      | `onRequestError` hook              |
| Middleware errors            | `onRequestError` hook              |
| API route uncaught errors    | `onRequestError` hook              |
| Edge function errors         | `onRequestError` hook (if enabled) |

### What Requires Manual Capture

| Scenario                      | Why Manual?                          | Where                           |
| ----------------------------- | ------------------------------------ | ------------------------------- |
| `error.tsx` boundaries        | Next.js intercepts for recovery UI   | `app/error.tsx`                 |
| `global-error.tsx` boundary   | Next.js intercepts for recovery UI   | `app/global-error.tsx`          |
| API routes returning 500      | We catch to return user-friendly msg | `lib/api/responses.ts`          |
| Background ops (non-blocking) | Failure shouldn't crash request      | Specific locations only         |
| Temporal activities           | Temporal wraps errors, losing stack  | `worker/lib/activity-sentry.ts` |

**The test:** If you're adding `Sentry.captureException` somewhere new, ask: "Why won't
automatic capture catch this?" If you can't answer clearly, you probably don't need it.

---

## Current Issues (January 2026 Audit)

### Issue 1: `ignoreErrors` Hiding Real Failures

```typescript
// ❌ PROBLEM: These filter real API failures
ignoreErrors: [
  "Network request failed", // Real error when API is down
  "Failed to fetch", // Real error when fetch fails
  "Load failed", // Real error on resource load failure
];
```

**Impact:** When our API returns 500 or is unreachable, the client error is filtered
out. We never see it in Sentry.

**Fix:** Remove these from ignoreErrors. Use `beforeSend` with smarter filtering if
needed (check error source, not just message).

### Issue 2: Edge Runtime Not Instrumented

```typescript
// instrumentation.ts - MISSING EDGE SUPPORT
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  // ❌ Missing: if (process.env.NEXT_RUNTIME === "edge")
}
```

**Impact:** Middleware errors, edge API routes, and edge-rendered pages don't report to
Sentry.

**Fix:** Add edge runtime handling and `sentry.edge.config.ts`.

### Issue 3: Over-Instrumentation

- 228 catch blocks in `lib/`
- 99 files have `Sentry.captureException`
- Many catch blocks log but DON'T report to Sentry

This creates:

- Duplicate error reports (boundary + manual capture)
- False sense of coverage (it's everywhere, but gaps exist)
- Cognitive overhead (do I need Sentry here?)

**Fix:** Remove most manual captures. Trust automatic instrumentation. Keep only the
places listed above.

### Issue 4: Catch-and-Log Without Sentry

Many catch blocks do `logger.error()` without `Sentry.captureException`. The error goes
to Pino logs (which we don't monitor in real-time) and disappears from observability.

**Fix:** Follow the error-handling-strategy.md principle - either rethrow (let boundary
catch) or add Sentry capture with appropriate severity level.

---

## Target Architecture

### Required Files

```
project-root/
├── next.config.ts                # withSentryConfig wrapper
├── instrumentation.ts            # Server + Edge SDK registration + onRequestError
├── instrumentation-client.ts     # Client SDK init
├── sentry.server.config.ts       # Server SDK config
├── sentry.edge.config.ts         # Edge runtime config (NEW)
├── sentry.client.config.ts       # Client SDK config
└── app/
    ├── global-error.tsx          # Root boundary with captureException
    └── error.tsx                 # Route boundary with captureException
```

### Minimal `captureException` Sites

After cleanup, we should have ~10-15 captureException call sites, not 99:

1. `app/error.tsx` - Route error boundary
2. `app/global-error.tsx` - Root error boundary
3. `lib/api/responses.ts` - serverErrorResponse wrapper
4. `worker/lib/activity-sentry.ts` - Temporal activity wrapper
5. ~5-10 legitimate background operations (title evolution, librarian, etc.)

Everything else should either:

- Let errors bubble to boundaries (preferred)
- Be removed if it's defensive try/catch that shouldn't exist

### Client Config Fix

```typescript
// sentry.client.config.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,

  // Smart filtering instead of blanket ignoreErrors
  beforeSend(event, hint) {
    const error = hint.originalException;

    // Ignore browser extension errors
    if (
      event.exception?.values?.[0]?.stacktrace?.frames?.some(
        (frame) =>
          frame.filename?.includes("chrome-extension") ||
          frame.filename?.includes("moz-extension")
      )
    ) {
      return null;
    }

    // Ignore user-initiated aborts (but NOT fetch failures)
    if (error instanceof DOMException && error.name === "AbortError") {
      return null;
    }

    return event;
  },

  integrations: [
    Sentry.breadcrumbsIntegration({
      console: true,
      dom: true,
      fetch: true,
      history: true,
    }),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  initialScope: {
    tags: { component: "client" },
  },
});
```

### Edge Config (New)

```typescript
// sentry.edge.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
});
```

### Instrumentation Fix

```typescript
// instrumentation.ts
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
```

---

## Migration Plan

### Phase 1: Fix Configuration (Immediate)

1. **Remove aggressive ignoreErrors** - Let fetch failures through
2. **Add edge runtime support** - Create sentry.edge.config.ts
3. **Update instrumentation.ts** - Handle edge runtime
4. **Verify onRequestError works** - Test with intentional server error

### Phase 2: Audit Existing Captures

1. **Grep for captureException** - Review all 99 files
2. **Categorize each call:**
   - ✅ Legitimate (error boundary, API wrapper, background op)
   - ❌ Redundant (would be caught by auto-capture anyway)
   - ⚠️ Error swallowing (catches but doesn't rethrow)
3. **Remove redundant captures** - Trust automatic instrumentation
4. **Fix error swallowing** - Either rethrow or justify the catch

### Phase 3: Audit Catch Blocks Without Sentry

1. **Grep for logger.error in catch blocks** - Find catch-log-only patterns
2. **For each:** Either add Sentry capture or remove the try/catch entirely
3. **Follow error-handling-strategy.md** - Fail loud, recover at boundaries

---

## Success Criteria

After migration:

- [ ] **All production errors appear in Sentry** - No more "errors not caught"
- [ ] **~10-15 captureException sites** - Down from 99
- [ ] **Edge errors captured** - Middleware failures visible
- [ ] **Fetch failures captured** - API outages visible on client
- [ ] **No catch-log-only patterns** - Every caught error either rethrows or reports

---

## Decisions Made

- **Error boundaries**: Route-level (`error.tsx`) + global (`global-error.tsx`). ✅
- **Centralized API error handler**: `serverErrorResponse()` in `lib/api/responses.ts`.
  ✅
- **Philosophy**: "Fail Loud, Recover at Boundaries" per `error-handling-strategy.md`.
  ✅
- **Filtering approach**: `beforeSend` hook, not `ignoreErrors` array. (Pending)
- **Edge support**: Required for middleware error capture. (Pending)

## Integration Points

- **Observability**: Errors correlate with Sentry traces for debugging
- **Analytics**: Error events separate from PostHog (product analytics)
- **Temporal**: Activity wrapper preserves stack traces before Temporal wraps them
- **AI Team**: Agent failures captured with job context

## Open Questions

- **Alert routing**: Which errors page us vs. go to backlog?
- **Error budgets**: What's acceptable error rate before we stop shipping?
- **Client vs server distinction**: Should we separate client errors into their own
  project for clearer signal?
