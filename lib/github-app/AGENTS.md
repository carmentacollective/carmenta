# GitHub App

Carmenta's GitHub App for internal operations as `carmenta-bot[bot]`.

## Not a User Integration

This module is **Carmenta's own GitHub App** - it uses Carmenta's credentials to act on
Carmenta's repo. When users connect their GitHub accounts (future
`lib/integrations/adapters/github.ts`), that's a separate user integration using OAuth.

| Aspect      | This Module         | Future User Integration               |
| ----------- | ------------------- | ------------------------------------- |
| Location    | `lib/github-app/`   | `lib/integrations/adapters/github.ts` |
| Credentials | Carmenta's App      | User's OAuth token                    |
| Actor       | `carmenta-bot[bot]` | User's GitHub account                 |
| Repos       | Carmenta's repo     | User's repos                          |

## Purpose

This module enables Carmenta to perform GitHub operations on its own repo - filing bug
reports, managing issues, eventually PRs. All actions appear as `carmenta-bot[bot]`.

## Architecture

```
lib/github-app/
├── index.ts     # Public exports (clean barrel)
├── tool.ts      # Permission-gated tool for AI conversations
├── client.ts    # Auth + low-level API operations
├── errors.ts    # Custom error types (GitHubAuthError, etc.)
├── templates.ts # Issue body formatting
├── types.ts     # TypeScript interfaces
└── AGENTS.md    # This file
```

Follows the `lib/sms/` pattern:

- Carmenta's own credentials (not user integrations)
- Structured returns (`{ success, data }` or `{ success: false, error }`)
- Never throws from public functions
- Sentry spans for observability
- Pino logging with context

## Permission Model

Operations are permission-gated based on user role:

**Public (anyone):**

- `create_issue` - File bug reports, feature requests, feedback
- `search_issues` - Find existing issues

**Admin only:**

- `add_reaction` - React to issues/PRs
- `add_label` - Manage labels
- `close_issue` / `reopen_issue` - Change issue state
- `add_comment` - Comment on issues
- `create_pr` / `merge_pr` / `approve_pr` - PR operations (future)
- `push_commit` - Push changes (future)

Admin status is determined by `user.publicMetadata.role === "admin"` from Clerk.

## Usage

### AI Tool (Recommended)

Use `createGitHubTool` to add GitHub capabilities to an AI conversation:

```typescript
import { createGitHubTool } from "@/lib/github-app";

// Create tool with user context
const githubTool = createGitHubTool({
  userId: user.id,
  isAdmin: user.publicMetadata?.role === "admin",
});

// Add to conversation tools
const tools = {
  ...builtInTools,
  github: githubTool,
};
```

The LLM can then invoke operations:

```typescript
// User says: "file a bug - the voice input cuts off after 5 seconds"
// LLM invokes:
{
  operation: "create_issue",
  title: "Bug: Voice input cuts off after 5 seconds",
  body: "The voice input stops recording...",
  category: "bug"
}

// Admin user says: "close issue 42"
// LLM invokes:
{
  operation: "close_issue",
  issueNumber: 42
}

// Non-admin trying admin operation:
// Returns: { success: false, error: "requires admin permissions" }
```

### Low-Level API

For direct programmatic access:

```typescript
import {
  createIssue,
  searchIssues,
  addReaction,
  formatBugReport,
  getBugLabels,
  isGitHubAppConfigured,
} from "@/lib/github-app";

// Always check configuration first
if (!isGitHubAppConfigured()) {
  return { success: false, error: "GitHub not configured" };
}

// Search for duplicates
const searchResult = await searchIssues({ query: "voice input" });

// Create issue
const result = await createIssue({
  title: "Bug: Voice input cuts off",
  body: formatBugReport({
    description: "Voice input stops recording after 5 seconds",
    errorDetails: "MediaRecorder error: ...",
    reportedAt: new Date(),
  }),
  labels: getBugLabels(),
});
```

## Authentication

Uses GitHub App installation tokens:

1. `GITHUB_APP_ID` - App identifier
2. `GITHUB_APP_PRIVATE_KEY` - Base64-encoded private key
3. `GITHUB_APP_INSTALLATION_ID` - Installation on carmenta repo

Tokens are fetched fresh each call (no caching) for serverless reliability.

## Error Handling

All functions return `GitHubResult<T>`:

```typescript
type GitHubResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; retryable?: boolean };
```

The `retryable` flag indicates transient failures (network, rate limits) that may
succeed on retry.

## Security

- Input sanitization for titles, bodies, and search queries
- Private key never logged (excluded from logging config)
- Permission checks before admin operations
- Rate limiting can be added at the tool level

## Environment Variables

```bash
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY=base64-encoded-pem
GITHUB_APP_INSTALLATION_ID=789
```

All optional at import time, validated with `assertEnv()` when used.

## Extending Operations

To add a new operation:

1. Add to `PUBLIC_OPERATIONS` or `ADMIN_OPERATIONS` in `tool.ts`
2. Add relevant schema fields to `githubToolSchema`
3. Implement handler in `executeOperation` switch statement
4. Add any needed low-level functions to `client.ts`

## Related

- `lib/concierge/entity-handlers/` - Uses this for @carmenta interactions
- `lib/tools/built-in.ts` - Pattern for tool definitions
