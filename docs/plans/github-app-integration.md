# GitHub App Integration Plan

## Overview

Enable users to file bugs/feedback against Carmenta through natural conversation, with
Carmenta creating GitHub issues in the carmenta-git repo. Phase 1 focuses on bug
reporting; Phase 2 (future) adds PR creation for Nick's "@carmenta fix this" commands.

## Architecture Decision: GitHub App

**Why GitHub App over PAT:**

- **Identity**: Issues show as `carmenta-app[bot]`, not Nick's personal account
- **Minimal permissions**: Request only what's needed (issues, PRs, contents)
- **Webhook-ready**: Can add incoming webhooks later without auth changes
- **Rate limits**: Per-installation, separate from personal usage
- **Professional**: How production bots work (Dependabot, Renovate)

**Auth flow:**

```
App Private Key → JWT (10 min) → Installation Token (1 hour) → API calls
```

## Directory Structure

Following existing patterns: `lib/github-app/` parallels `lib/sms/` (Carmenta's own
credentials, not user integrations). Entity detection integrates into existing concierge
rather than creating a parallel routing system.

```
lib/
  github-app/                 # Carmenta's GitHub App (like lib/sms/)
    AGENTS.md                 # Architecture documentation
    index.ts                  # Module exports
    client.ts                 # Auth + Octokit wrapper with retry logic
    templates.ts              # Issue body templates
    types.ts                  # TypeScript interfaces
    errors.ts                 # Custom error types

  concierge/
    types.ts                  # Add EntityIntent to ConciergeResult
    prompt.ts                 # Add entity detection to rubric
    entity-handlers/          # Intent handlers (lives with routing logic)
      bug-report.ts
      feedback.ts
      suggestion.ts

app/
  api/
    webhooks/
      github/
        route.ts              # (Phase 2) Webhook handler with signature verification
```

## GitHub App Setup

**Registration** (github.com/settings/apps/new):

```
Name: carmenta-ai
Homepage: https://carmenta.ai
Webhook URL: https://carmenta.ai/api/webhooks/github (Phase 2)

Permissions (Phase 1 - minimal):
  - Issues: Read & Write
  - Metadata: Read

Additional Permissions (Phase 2):
  - Pull Requests: Read & Write
  - Contents: Read & Write

Subscribe to events (Phase 2):
  - Issue comment
  - Issues
```

**Environment variables:**

```bash
# GitHub App - Bug reporting and PR creation
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY=base64-encoded-pem
GITHUB_APP_INSTALLATION_ID=789  # For carmenta-git repo
GITHUB_WEBHOOK_SECRET=random    # Phase 2

# IMPORTANT: Never log GITHUB_APP_PRIVATE_KEY - add to logging exclusion rules
```

**Environment validation** (startup check):

```typescript
// In lib/github-app/index.ts
const REQUIRED_ENV = [
  "GITHUB_APP_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_APP_INSTALLATION_ID",
];

export function validateGitHubConfig(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing GitHub App config: ${missing.join(", ")}`);
  }
}
```

## Implementation

### lib/github-app/client.ts

Handles GitHub App authentication with proper error handling. No module-level caching
(problematic in serverless); tokens are fetched fresh each time (1 API call, acceptable
latency).

```typescript
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { GitHubAuthError, GitHubAPIError } from "./errors";

export async function getInstallationOctokit(): Promise<Octokit> {
  try {
    const auth = createAppAuth({
      appId: env.GITHUB_APP_ID,
      privateKey: Buffer.from(env.GITHUB_APP_PRIVATE_KEY, "base64").toString(),
      installationId: env.GITHUB_APP_INSTALLATION_ID,
    });

    const { token } = await auth({ type: "installation" });
    return new Octokit({ auth: token });
  } catch (error) {
    logger.error("[GitHub] Installation token failed", {
      appId: env.GITHUB_APP_ID,
      installationId: env.GITHUB_APP_INSTALLATION_ID,
      error: error instanceof Error ? error.message : "Unknown",
    });
    throw new GitHubAuthError("GitHub authentication failed");
  }
}

// Retry wrapper for transient failures
async function withRetry<T>(
  fn: () => Promise<T>,
  { maxRetries = 3, baseDelay = 1000 } = {}
): Promise<T> {
  let lastError: Error = new Error("No attempts made");

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry auth errors or client errors (except rate limits)
      if (error instanceof GitHubAuthError) throw error;
      if ((error as any).status >= 400 && (error as any).status < 500) {
        if ((error as any).status !== 403) throw error; // 403 might be rate limit
      }

      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}
```

### lib/github-app/client.ts (continued)

Typed wrapper for GitHub operations with input sanitization:

```typescript
export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  html_url: string;
  state: "open" | "closed";
  labels: Array<{ name: string }>;
}

// Input sanitization to prevent injection
function sanitizeTitle(title: string): string {
  return title
    .substring(0, 256)
    .replace(/[\r\n]/g, " ")
    .trim();
}

function sanitizeBody(body: string): string {
  const maxLength = 65536; // GitHub's limit
  if (body.length > maxLength) {
    return body.substring(0, maxLength - 50) + "\n\n...[truncated]";
  }
  return body;
}

function sanitizeSearchQuery(query: string): string {
  return query
    .replace(/["\\\-:]/g, " ") // Remove special search operators
    .substring(0, 256)
    .trim();
}

export async function searchIssues(query: string): Promise<GitHubIssue[]> {
  return withRetry(async () => {
    const octokit = await getInstallationOctokit();
    const { data } = await octokit.search.issuesAndPullRequests({
      q: `${sanitizeSearchQuery(query)} repo:${REPO_OWNER}/${REPO_NAME} is:issue`,
      per_page: 5,
      sort: "updated",
    });
    return data.items;
  });
}

export async function createIssue(params: {
  title: string;
  body: string;
  labels?: string[];
}): Promise<GitHubIssue> {
  return withRetry(async () => {
    const octokit = await getInstallationOctokit();
    const { data } = await octokit.issues.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title: sanitizeTitle(params.title),
      body: sanitizeBody(params.body),
      labels: params.labels,
    });
    return data;
  });
}

export async function addReaction(
  issueNumber: number,
  reaction: "+1" | "heart"
): Promise<void> {
  return withRetry(async () => {
    const octokit = await getInstallationOctokit();
    await octokit.reactions.createForIssue({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: issueNumber,
      content: reaction,
    });
  });
}
```

### lib/github-app/templates.ts

Issue body formatting with transparency about included context:

```typescript
export function formatBugReport(context: {
  description: string;
  conversationExcerpt?: string;
  errorDetails?: string;
  browserInfo?: string;
  reportedAt: Date;
}): string {
  return `## Description

${context.description}

## Context

- Reported via Carmenta chat
- Timestamp: ${context.reportedAt.toISOString()}
${context.browserInfo ? `- Browser: ${context.browserInfo}` : ""}

${context.errorDetails ? `## Error Details\n\n\`\`\`\n${context.errorDetails}\n\`\`\`` : ""}

${context.conversationExcerpt ? `## Conversation Excerpt\n\n${context.conversationExcerpt}` : ""}

---
*Filed automatically by Carmenta from chat conversation*`;
}
```

### lib/concierge/entity-handlers/index.ts

Entity intent routing integrated into concierge (not a separate system):

```typescript
export async function handleEntityIntent(
  intent: EntityIntent,
  context: ConversationContext
): Promise<EntityResponse> {
  try {
    switch (intent.type) {
      case "bug_report":
        return handleBugReport(intent.details, context);
      case "feedback":
        return handleFeedback(intent.details, context);
      case "suggestion":
        return handleSuggestion(intent.details, context);
      case "settings":
        return handleSettings(intent.details, context);
      case "help":
        return handleHelp(intent.details, context);
      default:
        return { text: "Not sure what you'd like—could you clarify?" };
    }
  } catch (error) {
    logger.error("[Entity] Handler failed", { intent: intent.type, error });
    return {
      text: "Something went wrong. Could you try that again?",
      isError: true,
    };
  }
}
```

### lib/concierge/entity-handlers/bug-report.ts

Bug report flow with comprehensive error handling and empathetic copy:

```typescript
export async function handleBugReport(
  details: BugDetails,
  context: ConversationContext
): Promise<EntityResponse> {
  // 1. Search for similar existing issues (failure doesn't block)
  let existing: GitHubIssue[] = [];
  try {
    existing = await searchIssues(details.keywords.join(" "));
  } catch (error) {
    logger.warn("[BugReport] Search failed, proceeding to create", { error });
    // Continue - we'll just create a new issue
  }

  // 2. If duplicate found, add signal and acknowledge warmly
  if (existing.length > 0) {
    const topMatch = existing[0];

    // Try to add +1, but don't fail if it doesn't work
    try {
      await addReaction(topMatch.number, "+1");
    } catch (error) {
      logger.warn("[BugReport] Failed to add reaction", { issue: topMatch.number });
    }

    return {
      text: `You're not the only one—we've seen this before.

Added your voice to **#${topMatch.number}**: "${topMatch.title}"

The more reports we get, the faster we fix it. Thank you for telling us.
[View the issue](${topMatch.html_url})`,
    };
  }

  // 3. Create new issue
  try {
    const issue = await createIssue({
      title: details.title,
      body: formatBugReport({
        description: details.description,
        conversationExcerpt: context.recentMessages,
        errorDetails: context.lastError,
        browserInfo: context.userAgent,
        reportedAt: new Date(),
      }),
      labels: ["bug", "from-chat"],
    });

    return {
      text: `Tracked it.

**#${issue.number}**: ${issue.title}
[View on GitHub](${issue.html_url})

Included: error details and recent conversation context.
We check issues daily. Thank you for surfacing this.`,
    };
  } catch (error) {
    logger.error("[BugReport] Issue creation failed", { error });

    // Graceful degradation: acknowledge we heard them
    return {
      text: `Heard you. GitHub isn't responding right now, so we couldn't file this.

Here's what we understood: "${details.title}"

Could you try again in a moment? Your feedback matters.`,
      isError: true,
    };
  }
}
```

## Detection Strategy

### Explicit @carmenta commands (high confidence)

```
@carmenta this is broken
@carmenta file a bug about X
@carmenta I found a bug
```

→ File immediately, confirm with link

### Clear bug descriptions (medium confidence)

```
The export button throws an error
Voice input keeps cutting off
This worked yesterday but now it doesn't
```

→ Offer: "That sounds like a bug. Want me to track it on GitHub?"

### Frustration/vague (low confidence)

```
ugh this is so frustrating
something weird is happening
```

→ Clarify first, help troubleshoot, offer filing only if confirmed as bug

## Rate Limiting

Prevent abuse with per-user rate limits:

```typescript
import { Ratelimit } from "@upstash/ratelimit";

const issueCreationLimiter = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(5, "1h"), // 5 issues per hour per user
});

// In handleBugReport, before creating:
const { success, remaining } = await issueCreationLimiter.limit(context.userId);

if (!success) {
  return {
    text: `You've filed several issues recently. Please wait before filing more,
or reach out directly at support@carmenta.ai if something is urgent.`,
  };
}
```

## Integration with Concierge

Entity detection integrates into the existing concierge flow (not a separate system).
The concierge's LLM analysis already classifies messages; we extend it to detect entity
intents.

```typescript
// In lib/concierge/types.ts - extend ConciergeResult
entityIntent?: {
  type: 'bug_report' | 'feedback' | 'suggestion' | 'settings' | 'help' | 'none';
  confidence: 'high' | 'medium' | 'low';
  details?: Record<string, unknown>;
};

// In lib/concierge/prompt.ts - add to analysis rubric
mentionsEntity: /@carmenta\b/i.test(queryText), // Signal for entity detection

// In concierge routing logic
if (result.entityIntent && result.entityIntent.type !== 'none') {
  return handleEntityIntent(result.entityIntent, context);
}
// Otherwise continue to normal LLM flow
```

This keeps routing unified in the concierge rather than creating parallel detection
systems.

## Dependencies

```json
{
  "@octokit/rest": "^21.0.0",
  "@octokit/auth-app": "^7.0.0"
}
```

## Phase 2: Webhook Security (Documentation for Future)

When adding webhooks, signature verification is **mandatory**:

```typescript
// app/api/webhooks/github/route.ts
import crypto from "crypto";

function verifyWebhookSignature(payload: string, signature: string): boolean {
  const expected = `sha256=${crypto
    .createHmac("sha256", env.GITHUB_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex")}`;

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!signature || !verifyWebhookSignature(payload, signature)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const event = JSON.parse(payload);
  // Process webhook...
}
```

## Environment Setup

1. Create GitHub App at github.com/settings/apps/new
2. Generate private key, download .pem file
3. Install app on carmenta-git repo, note installation ID
4. Add to Render environment:
   - `GITHUB_APP_ID`
   - `GITHUB_APP_PRIVATE_KEY` (base64 encode the .pem)
   - `GITHUB_APP_INSTALLATION_ID`

## Build Sequence

### Phase 1: Bug Reporting

1. **GitHub App setup** (manual)
   - [ ] Register GitHub App at github.com/settings/apps/new
   - [ ] Generate and download private key (.pem)
   - [ ] Install app on carmenta-git repo
   - [ ] Note installation ID from URL
   - [ ] Add env vars to Render (base64 encode private key)

2. **GitHub client** (`lib/github-app/`)
   - [ ] Add @octokit/rest and @octokit/auth-app dependencies
   - [ ] Create AGENTS.md with architecture docs
   - [ ] Implement errors.ts (GitHubAuthError, GitHubAPIError)
   - [ ] Implement types.ts (GitHubIssue, etc.)
   - [ ] Implement client.ts (auth + retry + sanitization)
   - [ ] Implement templates.ts (bug report format)
   - [ ] Implement index.ts (exports + env validation)
   - [ ] Add env vars to lib/env.ts schema

3. **Entity handlers** (`lib/concierge/entity-handlers/`)
   - [ ] Create index.ts (intent routing with error boundary)
   - [ ] Implement bug-report.ts (search → create/aggregate flow)
   - [ ] Add rate limiting with @upstash/ratelimit

4. **Concierge integration**
   - [ ] Extend ConciergeResult in types.ts with EntityIntent
   - [ ] Add @carmenta detection signal to prompt.ts
   - [ ] Route entity intents to handlers in main flow
   - [ ] Return entity responses to chat

5. **Testing**
   - [ ] Unit tests for GitHub client (mock Octokit)
   - [ ] Unit tests for bug-report handler (mock client)
   - [ ] Integration test: @carmenta bug report in chat
   - [ ] Verify duplicate detection adds +1
   - [ ] Verify graceful degradation when GitHub down

### Phase 2: PR Creation (Future)

- Add createPullRequest, createBranch to client
- Add code fix intent handler
- Integrate with existing code generation
- Webhook handler for PR events (with signature verification)
- Additional permissions: Pull Requests, Contents

## Success Criteria

- [ ] User says "@carmenta this is broken" → Issue created in carmenta-git
- [ ] Duplicate reports add +1 reaction instead of new issue
- [ ] Issue body includes conversation context
- [ ] Issues labeled appropriately (bug, feedback, suggestion)
- [ ] Carmenta responds with issue link
