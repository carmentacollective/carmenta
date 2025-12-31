# Infrastructure Stack Decision

**Date**: 2024-11-29 **Status**: Decided **Decision Makers**: Nick, with comprehensive
research and architecture analysis

## Context

Building Carmenta requires foundational infrastructure choices across multiple concerns:

- App authentication (user accounts, sessions)
- Service OAuth (connecting to Gmail, Notion, etc)
- Database (conversations, memory, knowledge base)
- File storage (uploads, attachments, processed artifacts)
- Admin tooling (viewing/managing data)

These decisions ripple through everything we build. Getting them right early avoids
painful rewrites. Getting them wrong means fighting infrastructure instead of building
product.

## The Decision

**Clerk + Render Architecture**

```
┌─────────────────────────────────────────────┐
│ Carmenta Infrastructure Stack                │
├─────────────────────────────────────────────┤
│                                             │
│ 1. App Auth:        Clerk                   │
│    - User sign-up/sign-in                   │
│    - Session management                     │
│    - User profiles                          │
│    - Status: Integrated ✅                  │
│                                             │
│ 2. Hosting:         Render                  │
│    - Next.js web service                    │
│    - Persistent disk for Claude Code        │
│    - No serverless timeouts                 │
│    - Background workers available           │
│                                             │
│ 3. Database:        Render PostgreSQL       │
│    - Conversations & messages               │
│    - Memory (profile, facts, preferences)   │
│    - Knowledge base (ltree + FTS)           │
│    - Encrypted credentials (OAuth + API)    │
│    - File metadata                          │
│    - ORM: Drizzle                           │
│    - Admin: Drizzle Studio                  │
│                                             │
│ 4. File Storage:    Supabase Storage        │
│    - User uploads (PDFs, images, audio)     │
│    - Processed artifacts                    │
│    - CDN delivery (Cloudflare)              │
│    - Image transformations (on-the-fly)     │
│                                             │
│ 5. Service OAuth:   In-House                │
│    - Custom OAuth flows per provider        │
│    - Token storage (encrypted in Postgres)  │
│    - Automatic token refresh                │
│    - Webhook disconnect handlers            │
│    - Multi-account support                  │
│                                             │
└─────────────────────────────────────────────┘
```

## Rationale

### Why Clerk for App Auth

**Decision**: Keep Clerk (already integrated)

**Why**:

- ✅ Already working - no migration needed
- ✅ Best-in-class developer experience for startups
- ✅ Beautiful pre-built UI components
- ✅ Session management, OAuth, magic links built-in
- ✅ Organizations/roles ready when needed

**vs. Alternatives**:

- **Auth0**: Enterprise-focused, steeper learning curve, doesn't help with service OAuth
- **Supabase Auth**: Good, but Clerk's DX is better for our stage
- **Custom**: Months of work for commodity functionality

### Why Render for Hosting + Database

**Decision**: Render for both hosting and PostgreSQL

**Why Render (not Vercel)**:

We initially used Vercel for its excellent Next.js DX. However, Carmenta's workloads
outgrew serverless constraints:

- ❌ Vercel 300s timeout incompatible with deep research (10-30 min)
- ❌ Vercel has no filesystem for Claude Code execution
- ❌ Vercel requires step gymnastics for Inngest long-running tasks
- ✅ Render has persistent compute with no timeouts
- ✅ Render has persistent disk for Claude Code workspaces
- ✅ Render PostgreSQL on same platform = simpler architecture
- ✅ Drizzle Studio for admin (replaces Supabase Studio)

**Why Render PostgreSQL (not Supabase)**:

- ✅ **Same platform** as hosting = simpler ops, one dashboard
- ✅ **No cross-platform latency** between app and database
- ✅ **ltree extension** available for knowledge base hierarchy
- ✅ **pgvector** available for Phase 2 memory embeddings
- ✅ **Drizzle Studio** for admin (`pnpm db:studio`)

**File storage stays on Supabase** - image transformations and CDN still valuable.

**Schema Foundation**:

- Users (extends Clerk data)
- Conversations & Messages (chat foundation)
- Service Connections (OAuth integration metadata)
- Documents (knowledge base with ltree paths)
- Files (attachment metadata + processing status)
- Memory (profile facts, eventual embeddings)

### Why Supabase Storage for Files

**Decision**: Supabase Storage (not Uploadcare or Cloudflare R2)

**Why**:

- ✅ **Already using Supabase** for database (one vendor)
- ✅ **Real-time image transformations** via URL params (resize, crop, format, quality)
- ✅ **Global CDN** (Cloudflare edge network)
- ✅ **Simple integration** (same client as database)
- ✅ **Good DX** (direct browser uploads, signed URLs)

**Image Transformation Capabilities** (confirmed):

```typescript
// On-the-fly via URL parameters
const thumbnail = `${publicUrl}?width=150&height=150&resize=cover`;
const webp = `${publicUrl}?width=800&quality=85&format=webp`;
const smart = `${publicUrl}?width=600&resize=cover&gravity=auto`; // Smart crop
```

Full capabilities:

- Resize (width, height, both)
- Crop modes (contain, cover, fill)
- Format conversion (WebP, AVIF, JPEG, PNG)
- Quality control (1-100)
- Smart cropping (gravity=auto)
- PDF thumbnails (page=1)

**vs. Alternatives**:

- **Cloudflare R2**: Cheaper at scale ($0 egress), but no image transformations,
  separate vendor
- **Uploadcare**: More features, more expensive, separate vendor
- **Vercel Blob**: Simple but expensive

**When to migrate**: If bandwidth costs spike (>200GB/month), consider R2. Until then,
simplicity wins.

### Service OAuth: In-House Implementation

**Decision**: Build OAuth in-house, store credentials in our Postgres database

**Previous approach**: We initially used Nango for third-party OAuth. While Nango
promised simplified OAuth management, we encountered critical limitations:

- **Slack user_scope bug**: Nango's Slack integration uses `scope` parameter (bot
  tokens) instead of `user_scope` parameter (user tokens). This meant users couldn't
  connect Slack to act as themselves - only as a bot. GitHub issues #3560 and #3561
  confirm this is a known, unresolved problem.
- **Limited OAuth URL control**: No way to customize authorization URL parameters for
  provider-specific requirements.
- **Ugly modal UI**: Nango's Connect UI didn't match Carmenta's design quality.
- **External dependency for critical path**: OAuth failures blocked users from core
  functionality, and we couldn't debug or fix Nango issues ourselves.

**Why in-house is better for us**:

- ✅ **Full control over OAuth URLs** - handle provider quirks (Slack user_scope, etc.)
- ✅ **Beautiful custom UI** - modals that match Carmenta's design language
- ✅ **One less vendor** - fewer external dependencies on critical path
- ✅ **Unified credential storage** - OAuth tokens stored same as API keys (encrypted)
- ✅ **Direct API calls** - simpler debugging, no proxy abstraction layer
- ✅ **Cost reduction** - no Nango fees at scale

**What we're building**:

- Custom OAuth flows per provider (authorize route + callback route)
- Token storage encrypted in Postgres (AES-256-GCM, same as API keys)
- Automatic token refresh before expiration
- Webhook handlers for disconnect notifications
- Beautiful connection modals with real-time validation

**See**: `knowledge/components/service-connectivity.md` for full specification.

**Alternatives considered**:

- **Auth0**: Has Token Vault for third-party APIs, but enterprise pricing and would
  require migrating from Clerk. Overkill for current needs.
- **Clerk privateMetadata**: Could store tokens, but 8KB limit problematic (Google
  tokens alone can be 4KB). Not purpose-built for credential lifecycle management.
- **Doppler/Vault**: External secrets storage. Adds complexity without solving OAuth
  flow issues. Can revisit if compliance requirements demand it.

### Why This Combination Works

**Separation of concerns**:

```
Clerk      → Who are you? (app authentication)
Postgres   → Where's your data? (database + encrypted credentials)
Supabase   → Files + Admin UI (storage + Studio)
Our code   → Service OAuth (custom flows, token refresh)
```

**Proven architecture**:

- knowledge-base-storage.md decided: Postgres + ltree
- file-attachments.md decided: Supabase Storage

**Best-in-class tools**:

- Each service does one thing exceptionally well
- Clerk: best auth DX for user authentication
- Supabase: best Postgres admin (Studio) + integrated file storage
- Our OAuth: full control, provider-specific handling, beautiful UX

**Cost-effective**:

- **Free to start** (Clerk and Supabase have generous free tiers)
- **~$50/mo at scale** (10K users, 100GB storage - no Nango fees)
- Can optimize later (R2 for files if bandwidth spikes)

**Future-proof**:

- ✅ Postgres ready for ltree (Phase 1 knowledge base)
- ✅ Postgres ready for pgvector (Phase 2 memory embeddings)
- ✅ OAuth architecture supports any OAuth 2.0 provider
- ✅ Can add external secrets manager later if compliance requires

## What We're NOT Doing

❌ **Auth0** - Enterprise pricing, would require Clerk migration ❌ **Nango** - Limited
OAuth control, can't handle provider quirks ❌ **External secrets manager** - Adds
complexity, Postgres encryption sufficient ❌ **Separate vector DB** - Supabase has
pgvector ❌ **Elasticsearch** - Postgres FTS sufficient for Phase 1 ❌ **Graph
database** - Postgres join tables handle document links ❌ **Multiple file storage
vendors** - Keep it simple

## Implementation Priority

**Phase 1: Foundation** (Done ✅)

1. Set up Drizzle with Supabase Postgres
2. Create schema: users, conversations, messages, files
3. Configure Supabase Storage buckets
4. Test file upload → storage → metadata flow

**Phase 2: Service Connectivity** (In Progress)

1. Build OAuth authorize and callback routes
2. Implement token storage with encryption
3. Add automatic token refresh
4. Test Slack connection with user_scope
5. Add webhook handlers for disconnect notifications

**Phase 3: Knowledge Base** (After file storage works)

1. Add documents table with ltree
2. Enable full-text search (tsvector)
3. Build ingestion pipeline (files → text → documents)
4. Test search and retrieval

**Phase 4: Memory System** (After knowledge base proven)

1. Add memory table
2. Build fact extraction
3. Add pgvector column (Phase 2 embedding capability)
4. Integrate with Concierge context assembly

## Costs at Scale

**Monthly infrastructure cost projection**:

At 10K active users, 100GB storage:

- Clerk: $25/mo (10K MAU)
- Supabase: $25/mo (8GB DB + 100GB storage + 250GB bandwidth)
- OAuth: $0 (in-house)
- **Total: ~$50/mo**

At 1K users (getting traction):

- Clerk: Free (under 10K MAU)
- Supabase: Free or $25/mo (depends on growth)
- OAuth: $0 (in-house)
- **Total: $0-25/mo**

**Future optimizations** (if costs spike):

- Migrate files to Cloudflare R2 ($0 egress)
- Use Neon for database (cheaper than Supabase)

But don't optimize prematurely. Simplicity and speed matter more at this stage.

## Success Metrics

**We'll know this decision was right if**:

- ✅ Setup takes days, not weeks
- ✅ Supabase Studio gives us Django-like admin experience
- ✅ Drizzle provides type-safe database access
- ✅ File uploads work seamlessly with transformations
- ✅ Service OAuth flows handle provider quirks elegantly
- ✅ We're not fighting infrastructure

**We'll know we need to revisit if**:

- ❌ Costs exceed $500/mo before revenue justifies it
- ❌ Supabase performance becomes bottleneck
- ❌ OAuth maintenance burden exceeds 10% of dev time
- ❌ Compliance requirements demand external secrets manager

## Related Decisions

- `knowledge-base-storage-architecture.md` - Chose Postgres + ltree for knowledge base
- `knowledge/components/auth.md` - Clerk integration already complete
- `knowledge/components/data-storage.md` - Updated to reflect this decision
- `knowledge/components/service-connectivity.md` - In-house OAuth specification
- `knowledge/components/file-attachments.md` - Updated with Supabase Storage choice

## References

**Proven implementations**:

- mcp-hubby (../mcp-hubby) - Clerk + Postgres production app patterns
- Vercel ai-chatbot - Drizzle + Postgres patterns

**Research**:

- Supabase Storage docs: https://supabase.com/docs/guides/storage
- Supabase image transformations:
  https://supabase.com/docs/guides/storage/serving/image-transformations
- Drizzle ORM: https://orm.drizzle.team
- OAuth 2.0 RFC 6749: https://tools.ietf.org/html/rfc6749
- Slack OAuth v2: https://api.slack.com/authentication/oauth-v2

## Next Steps

1. **Database setup**: Create Supabase project, configure Drizzle ✅
2. **Schema design**: Build initial tables (users, conversations, messages, files) ✅
3. **File storage setup**: Create buckets, test uploads and transformations
4. **OAuth implementation**: Build authorize/callback routes per provider (start with
   Slack)
5. **Token management**: Implement encryption, storage, and automatic refresh
6. **Validate end-to-end**: Connect service → store credentials → refresh tokens → API
   calls

No timelines. Build when ready. Validate each piece before moving to next.
