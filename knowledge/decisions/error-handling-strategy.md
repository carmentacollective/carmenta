# Error Handling Strategy

**Decision:** Fail Loud, Recover at Boundaries  
**Status:** ✅ Adopted  
**Date:** 2026-01-03

## The Problem

Silent error swallowing is one of the most insidious patterns in JavaScript. Code that
catches errors, logs them, and returns `null` or a fallback value hides failures from
both users and observability. Issues that should surface in Sentry instead get buried in
logs nobody reads.

The JavaScript/TypeScript ecosystem normalizes defensive try/catch everywhere. This
creates a false sense of safety while actually making systems harder to debug.

## The Principle

**Errors are information. Hiding them is lying.**

Every error that occurs in production should be visible in Sentry. We can ignore,
filter, or adjust alert thresholds in Sentry—but we can't observe what we never capture.
The cost of noise in Sentry is low. The cost of invisible failures is catastrophic.

## The Strategy: Fail Loud, Recover at Boundaries

Business logic throws. Boundaries catch, report, and decide recovery. Middle-layer code
should not catch errors.

### Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Error Boundaries (React, Next.js, API handlers)            │
│  - Catch everything that bubbles up                         │
│  - Report to Sentry with full context                       │
│  - Render user-friendly recovery UI                         │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ errors bubble up
                              │
┌─────────────────────────────────────────────────────────────┐
│  Business Logic / Domain Layer                              │
│  - NEVER catches errors                                     │
│  - Throws typed errors (ValidationError, NotFoundError)     │
│  - Trusts boundaries to handle failures                     │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ errors bubble up
                              │
┌─────────────────────────────────────────────────────────────┐
│  Infrastructure / Integration Layer                         │
│  - Catches ONLY for retry or cleanup                        │
│  - Enriches errors with context, then rethrows              │
│  - Service adapters throw, don't return error objects       │
└─────────────────────────────────────────────────────────────┘
```

### What Our Boundaries Capture

We already have comprehensive error boundaries:

1. **`app/error.tsx`** - Route segment errors → Sentry
2. **`app/global-error.tsx`** - Root layout errors → Sentry
3. **`instrumentation.ts` `onRequestError`** - Server errors → Sentry
4. **Sentry's `globalHandlersIntegration`** - Uncaught exceptions → Sentry
5. **`httpClient` hooks** - HTTP failures → Sentry spans/breadcrumbs

These boundaries mean we don't need defensive try/catch in business logic. Errors will
be caught, reported, and handled appropriately.

## When Try/Catch IS Allowed

### 1. Retry Logic

When you're actually going to retry the operation:

```typescript
// ✅ Good - retry with backoff
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await sleep(Math.pow(2, attempt) * 100);
    }
  }
  throw new Error("Unreachable");
}
```

### 2. Resource Cleanup

When you need to release resources regardless of success or failure:

```typescript
// ✅ Good - finally ensures cleanup on both paths
async function withConnection<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
  const conn = await pool.acquire();
  try {
    return await fn(conn);
  } finally {
    await conn.release(); // runs on success AND error
  }
  // errors still bubble up to boundary
}
```

### 3. Specific Error Type Handling

When you're catching a specific error type to handle it, and rethrowing everything else:

```typescript
// ✅ Good - handle specific case, rethrow others
async function createSchedule(params: ScheduleParams) {
  try {
    await scheduleClient.create(params);
  } catch (error) {
    if (error instanceof ScheduleAlreadyRunning) {
      // Specific recovery: update instead of create
      await scheduleClient.update(params);
      return;
    }
    throw error; // everything else bubbles up
  }
}
```

### 4. Non-Critical Background Operations

For fire-and-forget operations that genuinely shouldn't affect the main flow. These
still report to Sentry:

```typescript
// ✅ Good - background op with Sentry reporting
void (async () => {
  try {
    await db.activityLog.create({ data: logEntry });
  } catch (error) {
    logger.error({ error }, "Failed to log activity");
    Sentry.captureException(error, {
      level: "warning",
      tags: { category: "background", operation: "activity_log" },
    });
  }
})();
```

### 5. User-Facing Graceful Degradation

For UI operations where failure shouldn't crash the experience, but we still want
visibility:

```typescript
// ✅ Good - graceful UI degradation with Sentry
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    logger.error({ error }, "Clipboard copy failed");
    Sentry.captureException(error, {
      level: "info", // low severity - not critical
      tags: { category: "ui", operation: "clipboard" },
    });
    return false;
  }
}
```

## When Try/Catch IS BANNED

### ❌ Catch-Log-Return-Null

This is error swallowing. The caller has no idea something failed:

```typescript
// ❌ BANNED - swallows error, returns deceptive null
async function getUser(id: string): Promise<User | null> {
  try {
    return await db.user.findUnique({ where: { id } });
  } catch (error) {
    logger.error({ error, id }, "Failed to get user");
    return null; // Caller thinks user doesn't exist, but actually DB is down
  }
}
```

**Fix:** Let it throw. The boundary will handle it:

```typescript
// ✅ Good - throws on failure, returns null only for "not found"
async function getUser(id: string): Promise<User | null> {
  return await db.user.findUnique({ where: { id } });
  // Returns null if not found (Prisma behavior)
  // Throws on DB connection failure (correct behavior)
}
```

### ❌ Catch-All with Generic Fallback

```typescript
// ❌ BANNED - hides what actually failed
async function fetchData(): Promise<Data> {
  try {
    return await apiClient.getData();
  } catch (error) {
    logger.error({ error }, "API failed, using fallback");
    return DEFAULT_DATA; // What failed? Auth? Network? Rate limit? We'll never know.
  }
}
```

**Fix:** Let errors bubble. If you need a fallback, do it at the boundary with full
context:

```typescript
// ✅ Good - let it throw, handle at boundary
async function fetchData(): Promise<Data> {
  return await apiClient.getData();
}

// In the component/boundary:
const { data, error } = useSWR("/api/data", fetchData);
if (error) return <FallbackUI reason={error.message} />;
```

### ❌ "Just in Case" Defensive Catches

```typescript
// ❌ BANNED - defensive programming that hides bugs
function processItems(items: Item[]) {
  return items.map((item) => {
    try {
      return transformItem(item);
    } catch (error) {
      logger.error({ error, item }, "Transform failed");
      return null; // "Just in case" - but now we have silent data corruption
    }
  });
}
```

**Fix:** If `transformItem` can fail, figure out why and handle it explicitly. Don't
wrap everything in try/catch "just in case":

```typescript
// ✅ Good - validate input, let real errors throw
function processItems(items: Item[]) {
  return items.map((item) => {
    if (!isValidItem(item)) {
      throw new ValidationError(`Invalid item: ${item.id}`);
    }
    return transformItem(item);
  });
}
```

### ❌ Empty Catch Blocks

```typescript
// ❌ BANNED - the worst pattern
try {
  await riskyOperation();
} catch {
  // ignore - this literally hides all failures
}
```

**Fix:** If you genuinely don't care about the error (rare), you still need Sentry:

```typescript
// ✅ If you truly don't care, still report it
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    level: "info",
    tags: { category: "ignored", reason: "non-critical cleanup" },
  });
}
```

## Integration Adapters

Service adapters (Gmail, Notion, Slack, etc.) should throw errors, not return error
objects. This keeps the pattern consistent and lets callers decide how to handle
failures.

```typescript
// ❌ BANNED - mixed return pattern
async function listEmails(params: ListParams): Promise<EmailResult> {
  try {
    const response = await gmailClient.list(params);
    return { success: true, data: response };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ✅ Good - throws on failure
async function listEmails(params: ListParams): Promise<Email[]> {
  return await gmailClient.list(params);
  // Throws on auth failure, rate limit, network error, etc.
  // Caller decides: retry? fallback? bubble to user?
}
```

## Typed Errors

Use typed errors from `@/lib/errors` to communicate failure modes:

```typescript
import { ValidationError, NotFoundError, AuthenticationError } from "@/lib/errors";

// These map to HTTP status codes automatically
throw new ValidationError("Email format is invalid"); // 400
throw new AuthenticationError(); // 401
throw new NotFoundError("User"); // 404
```

API route handlers and error boundaries can then make intelligent decisions based on
error type.

## Sentry Configuration

All errors go to Sentry. We filter and prioritize there, not in code.

- **Critical:** Unhandled exceptions, boundary catches
- **Warning:** Background operation failures, retry exhaustion
- **Info:** Graceful degradation (clipboard, optional features)

Use tags to enable filtering:

```typescript
Sentry.captureException(error, {
  level: "warning",
  tags: {
    category: "integration",
    service: "gmail",
    operation: "list_messages",
  },
  extra: { userId, attemptCount },
});
```

## Migration Strategy

1. **New code follows this standard immediately**
2. **Audit existing try/catches** - 173 in `lib/` as of 2026-01-03
3. **Fix patterns by priority:**
   - Catch-log-return-null (highest risk of hidden failures)
   - Empty catch blocks
   - Adapter mixed return patterns
   - Defensive catches

## Summary

| Pattern                             | Verdict    | Action                       |
| ----------------------------------- | ---------- | ---------------------------- |
| Retry logic                         | ✅ Allowed | Keep                         |
| Resource cleanup + rethrow          | ✅ Allowed | Keep                         |
| Specific error type handling        | ✅ Allowed | Keep                         |
| Background ops with Sentry          | ✅ Allowed | Keep                         |
| UI graceful degradation with Sentry | ✅ Allowed | Keep                         |
| Catch-log-return-null               | ❌ Banned  | Remove catch, let throw      |
| Catch-all with fallback             | ❌ Banned  | Handle at boundary           |
| Defensive "just in case"            | ❌ Banned  | Remove catch, validate input |
| Empty catch blocks                  | ❌ Banned  | Add Sentry or remove         |

**The test:** Can you explain why this specific try/catch exists and what recovery it
enables? If not, remove it.
