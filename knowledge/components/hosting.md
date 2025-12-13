# Hosting

Application hosting and deployment infrastructure - where Carmenta runs, how it deploys,
and how it scales.

## Why This Exists

Every line of code needs somewhere to run. Hosting choices ripple through the entire
architecture: what runtimes are available, how long requests can take, what databases we
can use, how preview environments work, and what the bill looks like at scale.

For an AI-first application like Carmenta, hosting constraints are especially critical.
LLM calls take seconds, not milliseconds. Scheduled agents need to run reliably.
Background jobs process for minutes, not moments. The hosting platform needs to support
these patterns without fighting us.

## Decision: Render

We're using **Render** for Carmenta's hosting infrastructure.

### Why Render Over Vercel

| Factor               | Render                    | Vercel                   | Why It Matters                          |
| -------------------- | ------------------------- | ------------------------ | --------------------------------------- |
| **Request timeouts** | Up to 100 minutes         | Strict serverless limits | LLM calls can take 30+ seconds          |
| **Cold starts**      | Zero (always-on)          | 8+ seconds after idle    | Users shouldn't wait for first response |
| **Cron jobs**        | Unlimited, up to 12 hours | 2 on Hobby, daily only   | Scheduled Agents is a core feature      |
| **Database**         | Managed Postgres + Redis  | None native              | Unified infrastructure                  |
| **Cost trajectory**  | Predictable, scales well  | Can spike unexpectedly   | Showzone: $800 → $40 after migration    |
| **Backend support**  | Full-stack native         | Frontend-first           | We need workers, jobs, services         |

### What We Trade Off

- **Edge latency**: Vercel's edge network is faster (21ms vs 68ms US). But LLM response
  times (2-30 seconds) dwarf network latency, making this less relevant.
- **Preview deploys**: Vercel's are slightly more polished. Render's work fine.
- **Next.js auto-optimization**: Vercel auto-detects and optimizes. We configure
  manually on Render, but it's straightforward.

### Why Not Others

- **Railway**: Similar to Render, but less mature. No compelling advantage.
- **Fly.io**: More control, but more ops burden. Overkill for our needs.
- **Self-hosted**: Maximum control, maximum ops. Not worth it at this stage.

## Core Functions

### Web Service

The main Next.js application:

- Standalone build output for minimal deployment size
- Node.js 24 runtime
- Auto-scaling based on traffic
- Health checks and zero-downtime deploys

### Background Workers

For long-running tasks:

- Scheduled agent execution
- Async job processing
- Webhook handling that needs time

### Cron Jobs

Scheduled task execution:

- Daily briefings
- Periodic data sync
- Maintenance tasks
- No artificial limits on count or frequency

### Managed Databases

Co-located with application:

- PostgreSQL for relational data
- Redis for caching and real-time features
- Automatic backups
- Connection pooling handled

## Deployment Configuration

### Build Settings

```yaml
# render.yaml (Infrastructure as Code)
services:
  - type: web
    name: carmenta
    runtime: node
    buildCommand: pnpm install && pnpm build
    startCommand: bun .next/standalone/server.js
    envVars:
      - key: NODE_ENV
        value: production
```

### Environment Strategy

- **Production**: Main branch auto-deploys
- **Preview**: PR branches get preview URLs
- **Staging**: Optional dedicated staging environment

### Build Optimization

Next.js standalone output reduces deployment size ~90%:

- From ~1GB to ~100MB
- Faster deploys
- Lower storage costs

## Integration Points

- **Data Storage**: Render-managed Postgres and Redis
- **Observability**: Sentry for errors, PostHog for analytics
- **CI/CD**: GitHub integration for auto-deploys
- **Domain**: Custom domain with automatic SSL

## Success Criteria

- Deploys complete in under 5 minutes
- Zero-downtime deployments
- Preview environments for every PR
- No request timeouts for normal LLM interactions
- Costs scale linearly with usage
- 99.9% uptime

---

## Open Questions

### Architecture

- **Multi-region**: Do we need deployment in multiple regions? Render supports this but
  adds complexity.
- **Worker separation**: Should background workers be separate services or part of the
  main app?
- **Static assets**: CDN for static files? Render has built-in CDN, but we could add
  Cloudflare.

### Product Decisions

- **Preview environments**: Who gets access? How long do they persist?
- **Staging environment**: Do we need a dedicated staging, or is preview-per-PR enough?

### Technical Specifications Needed

- render.yaml configuration
- Environment variable management
- Secret rotation strategy
- Deployment pipeline details

### Research Needed

- Render's auto-scaling behavior under load
- Cost modeling for expected traffic patterns
- Backup and disaster recovery options
