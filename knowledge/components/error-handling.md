# Error Handling

How errors flow through the system, where they're caught, and when to intervene.

## The Policy

**Let errors throw.** Don't add try-catch unless it serves one of two purposes:

1. **API Routes** - Return structured JSON via `serverErrorResponse()`
2. **Graceful Degradation** - Return fallbacks when failure is acceptable

Everything else: error boundaries, SDK hooks, and wrappers handle capture automatically.

---

## Why This Policy

### What Catches Errors Automatically

| Context           | Caught By                               | What Happens                              |
| ----------------- | --------------------------------------- | ----------------------------------------- |
| React Components  | `app/error.tsx`, `app/global-error.tsx` | User sees error UI, Sentry captures       |
| Server Components | `onRequestError` hook                   | Sentry captures, error propagates         |
| Server Actions    | `onRequestError` hook                   | Sentry captures, caller gets rejection    |
| Middleware        | `onRequestError` hook                   | Sentry captures                           |
| AI Agent Tools    | `safeInvoke()` wrapper                  | Sentry captures, returns structured error |

### When Try-Catch Adds Value

**API Routes** - Clients need JSON, not raw 500s:

```typescript
// ✅ KEEP - Returns structured response
try {
  const data = await doThing();
  return NextResponse.json(data);
} catch (error) {
  return serverErrorResponse(error, { context: "doThing" });
}
```

**Graceful Degradation** - Feature fails but app continues:

```typescript
// ✅ KEEP - Returns fallback, doesn't crash
export async function getRedisClient() {
  try {
    return await connectRedis();
  } catch (error) {
    Sentry.captureException(error, { level: "warning" });
    return null; // App works without cache
  }
}
```

### When Try-Catch Is Noise

**AI Agent Tools** - Wrapper handles everything:

```typescript
// ❌ REMOVE - safeInvoke already does this
try {
  const result = await kb.search(query);
  return successResult(result);
} catch (error) {
  logger.error({ error }, "Search failed");
  Sentry.captureException(error);
  return errorResult("PERMANENT", error.message);
}

// ✅ CORRECT - Let it throw, wrapper catches
const result = await kb.search(query);
return successResult(result);
```

**Server Actions** - SDK catches thrown errors:

```typescript
// ❌ REMOVE - SDK captures via onRequestError
try {
  await db.update(data);
} catch (error) {
  logger.error({ error }, "Update failed");
  throw error;
}

// ✅ CORRECT - Just do the operation
await db.update(data);
```

**Server Actions with Typed Results** - Like API routes, need manual capture:

```typescript
// ✅ KEEP - Returns structured response for client display
// onRequestError only captures thrown errors, not caught ones
try {
  await connectService(serviceId);
  return { success: true };
} catch (error) {
  Sentry.captureException(error, {
    tags: { component: "action", action: "connect_service" },
  });
  return { success: false, error: "Couldn't connect - check your credentials" };
}
```

When a server action returns typed results (`{ success, error }`), it must capture
manually because the error is caught, not thrown.

---

## Architecture

### Error Boundaries

```
app/
├── global-error.tsx    # Root boundary (catches layout errors)
└── error.tsx           # Route boundary (catches page errors)
```

Both boundaries:

- Capture to Sentry with context
- Auto-refresh once (handles deployment transitions)
- Show error UI if error persists

### SDK Configuration

```
project-root/
├── instrumentation.ts       # Registers server + edge SDK, exports onRequestError
├── sentry.server.config.ts  # Server runtime config
├── sentry.edge.config.ts    # Edge runtime config
└── sentry.client.config.ts  # Browser config with beforeSend filtering
```

Key settings:

- `tracesSampleRate: 1.0` - Full trace visibility (DO NOT reduce)
- `enabled: process.env.NODE_ENV === "production"` - No dev noise
- `beforeSend` filters by stack trace origin, not error message

### Wrapper Functions

**`serverErrorResponse()`** - API routes:

```typescript
// lib/api/responses.ts
export function serverErrorResponse(error: unknown, context?: object) {
  logger.error({ error, ...context }, "API error");
  Sentry.captureException(error, { extra: context });
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
```

**`safeInvoke()`** - AI agent tools:

```typescript
// lib/ai-team/dcos/utils.ts
// Wraps tool execution with timeout + error normalization + Sentry spans
// Tools can just throw - wrapper converts to SubagentResult
```

---

## Legitimate Capture Sites

After cleanup, manual `Sentry.captureException` should only exist in:

| Location                        | Why Manual Capture                  |
| ------------------------------- | ----------------------------------- |
| `app/error.tsx`                 | Next.js intercepts for recovery UI  |
| `app/global-error.tsx`          | Next.js intercepts for recovery UI  |
| `lib/api/responses.ts`          | Catch for structured JSON response  |
| `lib/ai-team/dcos/utils.ts`     | Wrapper for all agent tools         |
| `worker/lib/activity-sentry.ts` | Temporal wraps errors, losing stack |
| Graceful degradation sites      | Intentional fallback behavior       |

Everything else should let errors throw to boundaries.

---

## The Test

Before adding try-catch, ask:

1. **Does this need a user-friendly JSON response?** → Use `serverErrorResponse()`
2. **Does this intentionally return a fallback?** → Keep, add Sentry capture
3. **Is there a wrapper that already handles this?** → Remove try-catch
4. **Will an error boundary catch this?** → Remove try-catch

If you can't answer "why won't automatic capture catch this?" - you don't need
try-catch.

---

## Graceful Degradation Sites

These are intentional - failure returns fallback instead of crashing:

| File                     | Function                   | Fallback             | Rationale                       |
| ------------------------ | -------------------------- | -------------------- | ------------------------------- |
| `lib/redis/client.ts`    | `getRedisClient()`         | `null`               | App works without cache         |
| `lib/title/generator.ts` | `generateTitle()`          | Default title        | Don't block connection creation |
| `lib/title/evolution.ts` | `evaluateTitleEvolution()` | `{ action: "keep" }` | Keep current title              |
| `lib/concierge/index.ts` | `runConcierge()`           | `CONCIERGE_DEFAULTS` | Don't block chat                |
| `lib/sparks/actions.ts`  | `getSparkData()`           | Empty arrays         | Sparks are optional             |
| `lib/storage/upload.ts`  | Spreadsheet parsing        | Skip extraction      | File still uploads              |

These KEEP their try-catch because the fallback behavior is intentional design.
