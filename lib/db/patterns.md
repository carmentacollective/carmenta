# Drizzle ORM Patterns

Modern Drizzle patterns for the Carmenta codebase. These patterns leverage Drizzle 0.45+
features for cleaner, more maintainable database code.

## Error Handling

Database errors automatically capture rich context when using `serverErrorResponse`:

```typescript
import { serverErrorResponse } from "@/lib/api/responses";

try {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });
} catch (error) {
  // DrizzleQueryError automatically captures: SQL, params, driver error
  return serverErrorResponse(error, { route: "users", userEmail: email });
}
```

The `serverErrorResponse` function detects `DrizzleQueryError` and sends rich context to
Sentry:

- Generated SQL query
- Query parameters
- Original PostgreSQL driver error

This happens automatically - no manual context threading required.

## ID Column Patterns

Choose the right ID strategy for each table type:

### UUID - User-facing entities

```typescript
// Use for: users, documents, notifications
// Why: Globally unique, non-guessable, safe to expose
id: uuid("id").primaryKey().defaultRandom();
```

### Serial - High-volume operational data

```typescript
// Use for: existing tables (connections, integrations)
// Why: Fast inserts, compact storage, works with Sqids encoding
id: serial("id").primaryKey();
```

### Identity - New tables (modern PostgreSQL)

```typescript
// Use for: NEW tables needing auto-increment integers
// Why: Modern standard, explicit sequence control, clearer intent
id: integer("id").primaryKey().generatedAlwaysAsIdentity();
```

Note: Don't migrate existing `serial()` columns. Use identity for new tables only.

### Text - External system IDs

```typescript
// Use for: messages (Vercel AI SDK provides IDs)
// Why: Preserve external system identifiers
id: text("id").primaryKey();
```

## Relational Queries

### Limiting Related Data

Always limit and select specific columns when loading relations:

```typescript
// Good - only load what's needed
const connection = await db.query.connections.findFirst({
  where: eq(schema.connections.id, connectionId),
  with: {
    messages: {
      limit: 50,
      orderBy: (messages, { desc }) => [desc(messages.createdAt)],
      columns: { id: true, content: true, role: true, createdAt: true },
    },
    user: {
      columns: { id: true, email: true, displayName: true },
    },
  },
});

// Avoid - loads everything
const connection = await db.query.connections.findFirst({
  with: { messages: true, user: true },
});
```

### Subqueries for Aggregations

Use subqueries instead of N+1 patterns:

```typescript
import { sql, eq } from "drizzle-orm";

// Good - single query with embedded count
const connectionsWithCounts = await db
  .select({
    id: schema.connections.id,
    title: schema.connections.title,
    messageCount: db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.messages)
      .where(eq(schema.messages.connectionId, schema.connections.id)),
  })
  .from(schema.connections)
  .where(eq(schema.connections.userEmail, userEmail));

// Avoid - N+1 pattern
const connections = await db.query.connections.findMany();
for (const conn of connections) {
  const count = await db
    .select({ count: sql`count(*)` })
    .from(schema.messages)
    .where(eq(schema.messages.connectionId, conn.id));
}
```

## Timestamp Handling

### $onUpdate for updatedAt

All tables with `updatedAt` use the `$onUpdate()` trigger:

```typescript
updatedAt: timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date());
```

**Important**: `$onUpdate()` does NOT fire during upserts. Set explicitly:

```typescript
await db
  .insert(schema.users)
  .values({ email, clerkId })
  .onConflictDoUpdate({
    target: schema.users.clerkId,
    set: {
      email,
      updatedAt: new Date(), // Must set explicitly in upserts
    },
  });
```

## Transaction Patterns

Use transactions for multi-step operations:

```typescript
import { db } from "@/lib/db";

await db.transaction(async (tx) => {
  const [connection] = await tx
    .insert(schema.connections)
    .values({ userEmail, title })
    .returning();

  await tx.insert(schema.messages).values({
    connectionId: connection.id,
    role: "system",
    content: "Connection initialized",
  });

  return connection;
});
```

## Performance Tips

1. **Use indexes for WHERE clauses**: Check that filtered columns have indexes
2. **Select specific columns**: Don't `select()` everything when you need 3 fields
3. **Limit early**: Apply `limit()` in the query, not after fetching
4. **Use EXPLAIN ANALYZE**: Test complex queries against production-like data

```sql
EXPLAIN ANALYZE SELECT * FROM connections WHERE user_email = 'test@example.com';
```
