# Carmenta Library

Shared utilities, services, and business logic. This directory contains the core
functionality that powers Carmenta.

## Directory Structure

### Database & Persistence

- **`db/`** - Database layer (Drizzle ORM + Supabase Postgres)
  - `schema.ts` - Database schema definitions
  - `index.ts` - Database client and connection management
  - `connections.ts` - Connection (conversation) data access
  - `users.ts` - User data access
  - `message-mapping.ts` - Message format conversions

### AI & Intelligence

- **`concierge/`** - Pre/post query processing, model selection
  - `index.ts` - Main concierge orchestration
  - `context.tsx` - React context for concierge state
  - `types.ts` - TypeScript types
  - `prompt.ts` - System prompts
  - See [knowledge/components/concierge.md](../knowledge/components/concierge.md)

- **`models/`** - Model definitions and configurations
  - Model capabilities, pricing, routing logic

- **`prompts/`** - System and feature prompts
  - Versioned prompt templates
  - Prompt composition utilities

### File Handling

- **`storage/`** - File upload, processing, and routing
  - `upload.ts` - File upload handling
  - `file-config.ts` - File size limits, allowed types
  - `file-validator.ts` - File validation logic
  - `image-processor.ts` - Image optimization and processing
  - `model-routing.ts` - Route files to appropriate models (vision, document)
  - `types.ts` - File handling TypeScript types

### Services & Integrations

- **`auth/`** - Authentication utilities (Clerk integration)
  - Session management helpers
  - User profile utilities

- **`supabase/`** - Supabase client configuration
  - Storage client
  - Database client
  - Edge function utilities

- **`web-intelligence/`** - Web browsing and research
  - Page fetching
  - Content extraction
  - Research coordination

### Infrastructure

- **`logger.ts`** - Pino structured logging (server-side)
- **`client-logger.ts`** - Browser-compatible logging
- **`env.ts`** - Environment variable validation (t3-oss/env-nextjs)
- **`utils.ts`** - General utilities (cn, etc.)
- **`sqids.ts`** - Short ID generation for public-facing IDs

### UI & Interaction

- **`theme/`** - Theme configuration and utilities
  - Dark/light mode
  - Theme persistence

- **`hooks/`** - React hooks
  - Custom hooks for common patterns
  - State management helpers

- **`tools/`** - Tool definitions for LLM tool calling
  - Tool schemas
  - Tool execution handlers

- **`copy-utils.ts`** - Clipboard operations with multi-format support

### Configuration & Appearance

- **`clerk-appearance.ts`** - Clerk component theming
  - Matches Carmenta's holographic design
  - Custom styles for auth components

## Coding Patterns

### Error Handling

Use typed errors for different failure modes:

```typescript
import { ValidationError, AuthenticationError } from "@/lib/errors";

if (!requiredParam) {
  throw new ValidationError("Parameter is required");
}
```

Errors bubble up to error boundaries. Only catch when you have recovery logic.

### Logging

Use structured logging with context objects:

```typescript
import { logger } from "@/lib/logger";

logger.info({ userId, connectionId }, "Connection created");
logger.error({ error, context }, "Operation failed");
```

Use `client-logger` for browser code. Logs auto-silence during tests.

### Database Access

Use Drizzle ORM with typed queries:

```typescript
import { db } from "@/lib/db";
import { connections } from "@/lib/db/schema";

const connection = await db.query.connections.findFirst({
  where: eq(connections.id, connectionId),
});
```

Transaction support available for multi-step operations.

### Environment Variables

Validate and type environment variables in `env.ts`:

```typescript
import { env } from "@/lib/env";

const apiKey = env.OPENROUTER_API_KEY; // Type-safe, validated at build time
```

### Async Patterns

Use async/await, not raw Promises. Use `Promise.all()` for independent operations:

```typescript
// Parallel - independent operations
const [user, connections] = await Promise.all([
  fetchUser(email),
  fetchConnections(userId),
]);

// Sequential - dependent operations
const connection = await getConnection(id);
const messages = await getMessages(connection.id);
```

## Adding New Modules

1. Choose appropriate directory based on functionality
2. Export public API from module's `index.ts`
3. Keep implementation files private within module
4. Use TypeScript with explicit types
5. Add JSDoc comments for complex functions
6. Include structured logging for operations
7. Use environment variables for configuration
8. Add error handling with typed errors

## Related Documentation

- [.cursor/rules/frontend/typescript-coding-standards.mdc](../.cursor/rules/frontend/typescript-coding-standards.mdc) -
  TypeScript standards
- [knowledge/tech-architecture.md](../knowledge/tech-architecture.md) - Architecture
  decisions
- [knowledge/components/data-storage.md](../knowledge/components/data-storage.md) -
  Database architecture
