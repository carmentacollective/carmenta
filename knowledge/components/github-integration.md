# GitHub Integration

How Carmenta accesses GitHub for code mode and autonomous development workflows.

## Context

God Mode requires GitHub access for:

- Reading issues, PRs, actions, discussions
- Creating branches, commits, PRs
- Merging after approval (or autonomously for trusted paths)
- Reacting to repo events via webhooks

Two authentication approaches evaluated: OAuth (user's token) vs GitHub App (Carmenta
identity).

## OAuth (User's Token)

User authenticates with their GitHub account. Carmenta acts as the user.

**Strengths:**

- Simple setup - user connects once
- Full user permissions - whatever they can do, Carmenta can do
- Private repos work immediately
- No app approval process
- Works for God Mode right away

**Weaknesses:**

- Token management (refresh, expiration, secure storage)
- Scope creep risk - broad scopes "just in case"
- User liability - actions happen as user legally/audit-wise
- No granular repo control
- User's personal rate limit (5000/hr)

## GitHub App (Carmenta Identity)

A GitHub App installed on repos/orgs. Carmenta acts as itself with delegated
permissions.

**Strengths:**

- Explicit installation - user chooses which repos, clear boundaries
- Higher rate limits (15000/hr per installation)
- Webhook-native - designed for event-driven workflows (always-on agents)
- Transparent identity - commits show `Carmenta[bot]` as committer
- Fine-grained permissions per-repo
- Enterprise-friendly - orgs can approve, audit trail
- Clean revocation - uninstall app, access gone

**Weaknesses:**

- Installation friction per repo/org
- Private repos require explicit grant
- App review needed for marketplace listing
- More complex auth flow (JWT + installation tokens)
- Two identities - commits as bot, not as user

## Commit Authorship Model

GitHub Apps can set custom author when creating commits via API:

```
Author: Nick Sullivan <nick@heartcentered.ai>
Committer: Carmenta AI <ai@carmenta.com>
```

This gives AI transparency while preserving human attribution.

## GitHub App Setup

**Create in GitHub Settings > Developer settings > GitHub Apps:**

- Name: `Carmenta` or `Carmenta AI`
- Homepage: `https://carmenta.com`
- Webhook URL: `https://carmenta.com/api/webhooks/github`
- Webhook secret: random string for payload validation

**Permissions (start minimal):**

```
Repository:
  Contents: Read & Write (files, commits)
  Issues: Read & Write
  Pull requests: Read & Write
  Metadata: Read (required)
  Workflows: Read (Actions status)

Account:
  Email: Read (optional, user identity)
```

**Events for Phase 4 webhooks:**

- `push` - commits to branches
- `pull_request` - opened/closed/merged
- `issues` - created/commented
- `check_run` / `check_suite` - CI status
- `workflow_run` - Actions completed

**Credentials generated:**

- App ID (numeric, public)
- Private Key (.pem file, signs JWTs)
- Webhook Secret

## Server Authentication

GitHub Apps use two-step token flow:

```
Server ──(JWT signed with private key)──> GitHub
Server <──(Installation Access Token)──── GitHub
Server ──(API calls with token)─────────> GitHub
```

**Environment variables:**

```bash
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_WEBHOOK_SECRET=your-webhook-secret
```

Installation tokens are NOT stored - generated on-demand, cached briefly (1hr TTL).

**Using @octokit/app:**

```typescript
import { App } from "@octokit/app";

const app = new App({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_PRIVATE_KEY!,
  webhooks: { secret: process.env.GITHUB_WEBHOOK_SECRET! },
});

// Handles JWT signing + token exchange + caching + refresh
async function getOctokitForInstallation(installationId: number) {
  return await app.getInstallationOctokit(installationId);
}
```

**Per-user storage:** Only the `installationId` (numeric) linking user to their app
installation. No tokens in database.

## Installation Flow

**Direct install link:**

```
https://github.com/apps/carmenta/installations/new
```

User selects repos, installs. GitHub redirects with `installation_id`.

**For God Mode specifically:** Could hardcode Nick's installation ID initially:

```bash
GITHUB_INSTALLATION_ID=78901234
```

## Current Status

Evaluation complete. GitHub App is the stronger long-term architecture for:

- Event-triggered agents (webhooks)
- Enterprise deployment
- Clear AI identity in commits
- Rate limits at scale

For immediate God Mode development, local dev mode continues to work. GitHub App setup
is a future milestone when code mode moves to hosted infrastructure.

## Related

- [Code Mode Vision](../code-mode/vision.md) - phased rollout plan
- [Ephemeral Compute](./ephemeral-compute.md) - execution environment options

## Sources

- [REST API endpoints for Codespaces](https://docs.github.com/en/rest/codespaces/codespaces)
- [Codespace Ownership and Billing](https://docs.github.com/en/codespaces/managing-codespaces-for-your-organization/choosing-who-owns-and-pays-for-codespaces-in-your-organization)
- [Using Codespaces with GitHub CLI](https://docs.github.com/en/codespaces/developing-in-a-codespace/using-github-codespaces-with-github-cli)
