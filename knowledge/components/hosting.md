# Hosting

Application hosting and deployment infrastructure - where Carmenta runs, how it deploys,
and how it scales.

## Why This Exists

Every line of code needs somewhere to run. Hosting choices ripple through the entire
architecture: what runtimes are available, how long requests can take, what databases we
can use, how preview environments work, and what the bill looks like at scale.

## Decision: Vercel

We're using **Vercel** for Carmenta's hosting infrastructure.

### Why Vercel

| Factor               | Benefit                                      |
| -------------------- | -------------------------------------------- |
| **Next.js native**   | First-party support, automatic optimizations |
| **Edge network**     | Fast global response times                   |
| **Preview deploys**  | Every PR gets a preview URL                  |
| **DX**               | Excellent developer experience, zero config  |
| **Serverless scale** | Scales to zero, scales to millions           |

### Considerations for AI Workloads

Vercel's serverless model requires attention for LLM-heavy applications:

- **Function timeouts**: Pro plan has 60s default, can extend to 300s for specific
  routes
- **Streaming**: Use streaming responses to avoid timeout issues - response starts fast,
  streams as LLM generates
- **Background work**: For truly long-running tasks, use external services (Inngest,
  QStash, or separate workers)

### Infrastructure

- **Web**: Vercel serverless functions
- **Database**: External (Neon, Supabase, or similar for Postgres; Upstash for Redis)
- **Cron**: Vercel Cron for scheduled tasks (with timeout limits)
- **Background jobs**: Inngest or similar for async processing

## Deployment Configuration

### Build Settings

- **Framework**: Next.js (auto-detected)
- **Build command**: `pnpm build`
- **Output**: Automatic serverless optimization

### Environment Strategy

- **Production**: Main branch auto-deploys
- **Preview**: PR branches get preview URLs automatically
- **Environment variables**: Managed in Vercel dashboard

## Integration Points

- **Data Storage**: External Postgres and Redis
- **Observability**: Sentry for errors, PostHog for analytics
- **CI/CD**: GitHub integration for auto-deploys
- **Domain**: Custom domain with automatic SSL

## Success Criteria

- Deploys complete quickly
- Zero-downtime deployments
- Preview environments for every PR
- Streaming responses keep LLM interactions feeling fast
- Costs scale with usage
- High uptime

---

## Open Questions

### Architecture

- **Long-running tasks**: What's the right pattern for scheduled agents and background
  processing on Vercel? Inngest? Separate worker service?
- **Slackbot**: Slack bots need persistent connections or long timeouts - may need
  separate hosting (see components/slackbot/architecture.md)

### Technical Specifications Needed

- vercel.json configuration for timeout extensions
- Inngest or similar for background job processing
- Cron job setup for scheduled agents
