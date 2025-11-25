# Data Storage

Database infrastructure - where our data lives, how we access it, and how it scales.
PostgreSQL for relational data, Redis for caching and real-time features, with careful
choices about hosting and ORM.

## Why This Exists

Every component needs to persist data somewhere. Memory stores context. Conversations
stores messages. Auth stores sessions. Service Connectivity stores OAuth tokens. Without
a solid data layer, nothing else works.

The choices here ripple through everything: what queries are fast, how we handle
migrations, what our hosting costs look like, how we scale. Getting this right early
avoids painful rewrites later.

## Core Functions

### PostgreSQL (Primary Database)

Relational data storage for structured, transactional data:
- User accounts and profiles
- Conversations and messages
- Service connections and OAuth tokens
- AI team configurations
- Application state and settings

PostgreSQL is battle-tested, has excellent tooling, and handles complex queries well.
Extensions like pgvector could potentially handle vector storage too, reducing
infrastructure complexity.

### Redis (Cache & Real-time)

Fast in-memory storage for:
- Session data and authentication tokens
- Response caching for expensive operations
- Rate limiting counters
- Real-time features (presence, typing indicators)
- Job queue backing store (if using Redis-based queue)

Redis keeps hot paths fast and offloads read pressure from PostgreSQL.

### Vector Storage

For Memory's semantic search:
- Could use pgvector (PostgreSQL extension) for simplicity
- Could use dedicated vector DB (Pinecone, Weaviate, Qdrant) for scale
- Decision depends on scale expectations and retrieval performance needs

### ORM / Database Access

How we interact with the database in code:
- Type-safe queries
- Migration management
- Connection pooling
- Query building and raw SQL escape hatches

## Hosting Considerations

### PostgreSQL Hosting Options

**Managed PostgreSQL services:**
- **Neon** - Serverless Postgres, scales to zero, branching for dev/preview
- **Supabase** - Postgres + extras (auth, storage, realtime), generous free tier
- **Railway** - Simple deployment, good DX, predictable pricing
- **Render** - Managed Postgres alongside other services
- **Vercel Postgres** - Tight Next.js integration, powered by Neon
- **PlanetScale** - MySQL not Postgres, but worth noting for serverless model

**Self-managed (not recommended initially):**
- AWS RDS, Google Cloud SQL, Azure Database

### Redis Hosting Options

**Managed Redis services:**
- **Upstash** - Serverless Redis, pay-per-request, global replication
- **Redis Cloud** - Official Redis hosting
- **Railway** - Redis alongside Postgres
- **Render** - Redis as part of infrastructure

### Recommended Stack (Initial Thinking)

For a Next.js app with Vercel deployment:
- **PostgreSQL**: Neon or Vercel Postgres (serverless, good Next.js integration)
- **Redis**: Upstash (serverless, Vercel integration, global edge)
- **ORM**: Drizzle (type-safe, lightweight, good migrations)

This gives us serverless scaling, minimal ops burden, and excellent TypeScript DX.

## ORM Comparison

### Drizzle

- Lightweight, SQL-like syntax
- Excellent TypeScript inference
- Fast runtime, small bundle
- Good migration tooling
- Growing ecosystem

### Prisma

- Most popular, largest ecosystem
- Schema-first approach
- Great DX and documentation
- Heavier runtime, larger bundle
- Some edge deployment limitations

### Kysely

- Type-safe query builder
- Very lightweight
- More manual than Prisma/Drizzle
- Good for complex queries

**Current leaning**: Drizzle for its balance of type safety, performance, and SQL
familiarity.

## Integration Points

- **Auth**: User accounts, sessions
- **Memory**: Profile data, facts (relational); embeddings (vector)
- **Conversations**: Message history, thread metadata
- **Service Connectivity**: OAuth tokens, connection status
- **Analytics**: Event storage (or separate analytics DB)
- **All components**: Configuration, state, logs

## Success Criteria

- Queries are fast enough that we don't notice database latency
- Migrations are safe and reversible
- Connection pooling handles concurrent requests
- Costs scale reasonably with usage
- Local development mirrors production behavior
- Type safety catches schema mismatches at compile time

---

## Open Questions

### Architecture

- **Vector storage strategy**: pgvector for simplicity or dedicated vector DB for
  performance? At what scale does this decision matter?
- **Multi-region**: Do we need global database replication? Neon and Upstash support
  this, but adds complexity.
- **Connection pooling**: Serverless functions need external pooling (PgBouncer,
  Neon's pooler). How do we configure this?
- **Backup and recovery**: What's our backup strategy? Point-in-time recovery needs?

### Product Decisions

- **Data residency**: Do we need to store data in specific regions for compliance?
- **Soft vs hard delete**: Do we soft-delete data or purge? Implications for GDPR
  "right to be forgotten"?

### Technical Specifications Needed

- Database schema design (tables, relationships, indexes)
- Migration strategy and tooling
- Connection configuration for serverless
- Caching strategy (what to cache, TTLs, invalidation)
- Backup and disaster recovery plan

### Research Needed

- Benchmark Neon vs Supabase vs Vercel Postgres for our expected workload
- Evaluate pgvector vs dedicated vector DB performance
- Compare Drizzle vs Prisma for our use cases
- Research Upstash vs Redis Cloud pricing at scale
- Study connection pooling patterns for serverless
