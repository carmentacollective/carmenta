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

**Clerk + Supabase + Nango Architecture**

```
┌─────────────────────────────────────────────┐
│ Carmenta Infrastructure Stack                │
├─────────────────────────────────────────────┤
│                                             │
│ 1. App Auth:        Clerk                   │
│    - User sign-up/sign-in                   │
│    - Session management                     │
│    - User profiles                          │
│    - Status: Already integrated ✅          │
│                                             │
│ 2. Database:        Supabase Postgres       │
│    - Conversations & messages               │
│    - Memory (profile, facts, preferences)   │
│    - Knowledge base (ltree + FTS)           │
│    - Service connections (Nango metadata)   │
│    - File metadata                          │
│    - ORM: Drizzle                           │
│    - Admin: Supabase Studio                 │
│                                             │
│ 3. File Storage:    Supabase Storage        │
│    - User uploads (PDFs, images, audio)     │
│    - Processed artifacts                    │
│    - CDN delivery (Cloudflare)              │
│    - Image transformations (on-the-fly)     │
│                                             │
│ 4. Service OAuth:   Nango                   │
│    - OAuth flows (200+ services)            │
│    - Token storage & refresh                │
│    - API proxying                           │
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

### Why Supabase for Database

**Decision**: Supabase Postgres (with Drizzle ORM)

**Why**:

- ✅ **Supabase Studio** = Django admin equivalent (visual table editor, SQL runner)
- ✅ **ltree extension** ready for knowledge base hierarchy (from
  knowledge-base-storage.md decision)
- ✅ **pgvector** ready for Phase 2 memory embeddings
- ✅ **Includes file storage** (one vendor, one bill)
- ✅ **Free tier** to start (500MB DB, 1GB storage)
- ✅ **Drizzle works perfectly** (type-safe, lightweight ORM we want)

**vs. Alternatives**:

- **Neon**: Great product, but no built-in admin UI or file storage
- **Vercel Postgres**: More expensive than Neon directly, tied to Vercel
- **Railway**: Good, but less features than Supabase
- **Render**: No free tier for databases

**Schema Foundation** (from mcp-hubby patterns + Vercel ai-chatbot + our requirements):

- Users (extends Clerk data)
- Conversations & Messages (chat foundation)
- Service Connections (Nango integration metadata)
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

### Why Nango for Service OAuth

**Decision**: Nango for third-party service connections

**Why**:

- ✅ **Built for service integrations** (200+ pre-built: Gmail, Notion, Slack, etc)
- ✅ **Handles OAuth flows** - we don't build them
- ✅ **Token refresh automatic** - invisible to us
- ✅ **API proxying** - unified interface across providers
- ✅ **Multi-account support** built-in (work + personal Gmail)
- ✅ **Proven by mcp-hubby** (production implementation we can reference)

**Integration Pattern** (from mcp-hubby):

```typescript
// 1. User initiates OAuth
const authUrl = await nango.auth({
  providerConfigKey: "google-mail",
  connectionId: `${userEmail}-gmail`,
});

// 2. After OAuth, store metadata in our DB
await db.insert(connections).values({
  userEmail: userEmail,
  service: "gmail",
  connectionId: `${userEmail}-gmail`, // Nango identifier
  accountId: "user@gmail.com",
  status: "CONNECTED",
});

// 3. Make API calls (Nango handles tokens)
const emails = await nango.proxy({
  providerConfigKey: "google-mail",
  connectionId: connectionId,
  endpoint: "/gmail/v1/users/me/messages",
});
// Token expired? Nango refreshes automatically
// We never see or manage tokens
```

**vs. Alternatives**:

- **Auth0**: Can do OAuth, but awkward for service integrations (designed for SSO)
- **WorkOS**: B2B focused, overkill for our use case
- **Custom OAuth**: Months of work per service, token refresh complexity, ongoing
  maintenance

**Pricing**:

- Free: Up to 1K users
- $250/mo: Up to 10K users
- Can self-host if needed (open source)

### Why This Combination Works

**Separation of concerns**:

```
Clerk      → Who are you? (app authentication)
Nango      → Connect to Gmail (service OAuth, different concern)
Supabase   → Where's your data? (database + files)
```

**Proven architecture**:

- mcp-hubby validated: Clerk + Nango + Postgres
- knowledge-base-storage.md decided: Postgres + ltree
- file-attachments.md decided: External storage service

**Best-in-class tools**:

- Each service does one thing exceptionally well
- Clerk: best auth DX
- Supabase: best Postgres admin (Studio)
- Nango: best service OAuth platform

**Cost-effective**:

- **Free to start** (all have generous free tiers)
- **~$300/mo at scale** (10K users, 100GB storage)
- Can optimize later (R2 for files, self-host Nango)

**Future-proof**:

- ✅ Postgres ready for ltree (Phase 1 knowledge base)
- ✅ Postgres ready for pgvector (Phase 2 memory embeddings)
- ✅ Nango ready for 200+ services
- ✅ Can swap any piece independently

## What We're NOT Doing

❌ **Auth0** - Overkill, worse DX, doesn't solve service OAuth ❌ **Separate vector
DB** - Supabase has pgvector ❌ **Elasticsearch** - Postgres FTS sufficient for Phase 1
❌ **Graph database** - Postgres join tables handle document links ❌ **Building OAuth
flows** - Nango does this professionally ❌ **Building file CDN** - Supabase Storage has
this ❌ **Multiple file storage vendors** - Keep it simple

## Implementation Priority

**Phase 1: Foundation** (Do this first)

1. Set up Drizzle with Supabase Postgres
2. Create schema: users, conversations, messages, files
3. Configure Supabase Storage buckets
4. Test file upload → storage → metadata flow

**Phase 2: Service Connectivity** (After basic chat works)

1. Integrate Nango SDK
2. Add connections table (service, connectionId, status)
3. Build OAuth callback flow
4. Test Gmail connection → API call flow

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
- Nango: $250/mo (10K users)
- **Total: ~$300/mo**

At 1K users (getting traction):

- Clerk: Free (under 10K MAU)
- Supabase: Free or $25/mo (depends on growth)
- Nango: Free (under 1K users)
- **Total: $0-25/mo**

**Future optimizations** (if costs spike):

- Migrate files to Cloudflare R2 ($0 egress)
- Self-host Nango (open source)
- Use Neon for database (cheaper than Supabase)

But don't optimize prematurely. Simplicity and speed matter more at this stage.

## Success Metrics

**We'll know this decision was right if**:

- ✅ Setup takes days, not weeks
- ✅ Supabase Studio gives us Django-like admin experience
- ✅ Drizzle provides type-safe database access
- ✅ File uploads work seamlessly with transformations
- ✅ Service OAuth flows work without building them
- ✅ We're not fighting infrastructure

**We'll know we need to revisit if**:

- ❌ Costs exceed $500/mo before revenue justifies it
- ❌ Supabase performance becomes bottleneck
- ❌ Nango limitations block critical integrations
- ❌ We spend >20% time on infrastructure vs features

## Related Decisions

- `knowledge-base-storage-architecture.md` - Chose Postgres + ltree for knowledge base
- `knowledge/components/auth.md` - Clerk integration already complete
- `knowledge/components/data-storage.md` - Updated to reflect this decision
- `knowledge/components/service-connectivity.md` - Updated with Nango choice
- `knowledge/components/file-attachments.md` - Updated with Supabase Storage choice

## References

**Proven implementations**:

- mcp-hubby (../mcp-hubby) - Clerk + Nango + Postgres production app
- Vercel ai-chatbot - Drizzle + Postgres patterns

**Research**:

- Supabase Storage docs: https://supabase.com/docs/guides/storage
- Supabase image transformations:
  https://supabase.com/docs/guides/storage/serving/image-transformations
- Nango docs: https://docs.nango.dev
- Drizzle ORM: https://orm.drizzle.team

## Next Steps

1. **Database setup**: Create Supabase project, configure Drizzle
2. **Schema design**: Build initial tables (users, conversations, messages, files)
3. **File storage setup**: Create buckets, test uploads and transformations
4. **Nango integration**: Set up account, configure first provider (Gmail)
5. **Validate end-to-end**: Upload file → process → store → retrieve flow

No timelines. Build when ready. Validate each piece before moving to next.
