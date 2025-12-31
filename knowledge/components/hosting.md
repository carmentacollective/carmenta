# Hosting

Application hosting and deployment infrastructure - where Carmenta runs, how it deploys,
and how it scales.

## Why This Exists

Every line of code needs somewhere to run. Hosting choices ripple through the entire
architecture: what runtimes are available, how long requests can take, what databases we
can use, how preview environments work, and what the bill looks like at scale.

## Decision: Render

We're using **Render** for Carmenta's hosting infrastructure.

### Why Render (Not Vercel)

We initially used Vercel for its excellent Next.js DX. However, Carmenta's workloads
outgrew serverless constraints:

| Workload         | Vercel Limit      | Carmenta Needs                  |
| ---------------- | ----------------- | ------------------------------- |
| Deep Research    | 300s max          | 10-30 minutes                   |
| Claude Code      | No filesystem     | Persistent disk, shell, git     |
| Scheduled Agents | 300s max          | Variable, potentially long      |
| Background Jobs  | Via Inngest steps | Direct execution, no gymnastics |

### Why Render Works

| Factor                    | Benefit                                       |
| ------------------------- | --------------------------------------------- |
| **Persistent compute**    | No serverless timeouts, run as long as needed |
| **Persistent disk**       | Claude Code has filesystem access             |
| **Background workers**    | Separate service for long-running tasks       |
| **Next.js support**       | First-class, auto-detected                    |
| **Preview deploys**       | Every PR gets a preview URL                   |
| **Integrated PostgreSQL** | Database + app on same platform               |
| **Simpler architecture**  | One platform instead of two                   |

### Infrastructure

- **Web Service**: Next.js application (auto-scaling)
- **Background Worker**: Long-running tasks, Claude Code execution
- **Database**: Render PostgreSQL
- **Cron**: Inngest (external, works anywhere)
- **File Storage**: Supabase Storage (external, CDN via Cloudflare)

## Deployment Configuration

### render.yaml

```yaml
services:
  - type: web
    name: carmenta-web
    runtime: node
    buildCommand: pnpm install && pnpm build
    startCommand: pnpm start
    envVars:
      - key: NODE_ENV
        value: production

  - type: worker
    name: carmenta-worker
    runtime: node
    buildCommand: pnpm install && pnpm build
    startCommand: pnpm run worker
```

### Build Settings

- **Framework**: Next.js (auto-detected)
- **Build command**: `pnpm install && pnpm build`
- **Output**: Standalone mode (efficient deployment)

### Environment Strategy

- **Production**: Main branch auto-deploys
- **Preview**: PR branches get preview URLs
- **Environment variables**: Managed in Render dashboard

## Integration Points

- **Database**: Render PostgreSQL (same platform)
- **File Storage**: Supabase Storage (external)
- **Auth**: Clerk (external)
- **Background Jobs**: Inngest (external, triggers our endpoints)
- **Observability**: Sentry for errors, PostHog for analytics
- **CI/CD**: GitHub integration for auto-deploys
- **Domain**: Custom domain with automatic SSL

## Inngest on Render

Inngest is not Vercel-specific. It works by calling your endpoint when events/crons
fire. On Render:

- No 300s step limit - functions can run continuously
- Deep research can be a single long operation
- Scheduled agents run without timeout gymnastics

```typescript
// This works on Render with no step workarounds
export const deepResearch = inngest.createFunction(
  { id: "deep-research" },
  { event: "research/start" },
  async ({ event }) => {
    // Can run for 30 minutes straight, no steps needed
    const results = await performDeepResearch(event.data);
    return results;
  }
);
```

## Success Criteria

- Deploys complete quickly
- Zero-downtime deployments
- Preview environments for every PR
- Long-running tasks work without timeouts
- Claude Code has filesystem access
- Costs scale with usage
- High uptime

## Migration Notes

**Migrated from Vercel (December 2024)**

- Reason: Serverless limits incompatible with Claude Code and deep research workloads
- Database migrated from Supabase to Render PostgreSQL
- File storage remains on Supabase (image transformations, CDN)
- Clerk auth unchanged (works on any platform)
- Inngest unchanged (works on any platform)
