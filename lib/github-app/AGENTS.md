# GitHub App

Carmenta's GitHub App integration for issue management in the carmenta-git repository.

## Purpose

This module enables users to file bug reports, feedback, and suggestions from Carmenta
chat. Issues are created using GitHub App authentication, appearing as
`carmenta-app[bot]` rather than any individual user.

## Architecture

```
lib/github-app/
├── index.ts         # Public exports (clean barrel)
├── client.ts        # Auth + API operations with retry logic
├── issue-creator.ts # Intelligent issue creation with LLM classification
├── errors.ts        # Custom error types (GitHubAuthError, etc.)
├── templates.ts     # Issue body formatting
├── types.ts         # TypeScript interfaces
└── AGENTS.md        # This file
```

Follows the `lib/sms/` pattern:

- Carmenta's own credentials (not user integrations)
- Structured returns (`{ success, data }` or `{ success: false, error }`)
- Never throws from public functions
- Sentry spans for observability
- Pino logging with context

## Authentication

Uses GitHub App installation tokens:

1. `GITHUB_APP_ID` - App identifier
2. `GITHUB_APP_PRIVATE_KEY` - Base64-encoded private key
3. `GITHUB_APP_INSTALLATION_ID` - Installation on carmenta-git repo

Tokens are fetched fresh each call (no caching) for serverless reliability.

## Usage

### Intelligent Issue Creation (Recommended)

Use `createIntelligentIssue` for automatic classification, duplicate detection, and
smart filtering. The LLM (Haiku) decides whether the issue is worth filing:

```typescript
import { createIntelligentIssue } from "@/lib/github-app";

// User-reported bug
const result = await createIntelligentIssue({
  userMessage: "Voice input stops after 5 seconds every time",
  source: "user_report",
});

// Agent error (auto-files with stack trace)
const result = await createIntelligentIssue({
  userMessage: "Failed to process search",
  errorDetails: "TypeError: Cannot read property...",
  source: "agent_error",
  sourceAgent: "librarian",
});

// Result can be: created, found_duplicate, declined, or failed
if (result.action === "created") {
  console.log(`Created #${result.issueNumber}: ${result.title}`);
} else if (result.action === "declined") {
  console.log(`Not filed: ${result.message}`);
}
```

The classifier filters out:

- Vague complaints ("this is slow sometimes")
- User questions ("how do I upload?")
- Transient errors

### Low-Level API

For cases where you've already classified the issue:

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

// Create issue if no duplicate
const result = await createIssue({
  title: "Bug: Voice input cuts off",
  body: formatBugReport({
    description: "Voice input stops recording after 5 seconds",
    errorDetails: "MediaRecorder error: ...",
    reportedAt: new Date(),
  }),
  labels: getBugLabels(),
});

if (result.success) {
  console.log(`Created issue #${result.data.number}`);
} else {
  console.error(result.error);
}
```

## Error Handling

All public functions return `GitHubResult<T>`:

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
- Rate limiting handled via `@upstash/ratelimit` in entity handlers

## Environment Variables

```bash
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY=base64-encoded-pem
GITHUB_APP_INSTALLATION_ID=789
```

All optional at import time, validated with `assertEnv()` when used.

## Related

- `lib/concierge/entity-handlers/` - Uses this client for @carmenta interactions
- `docs/plans/github-app-integration.md` - Full implementation plan
