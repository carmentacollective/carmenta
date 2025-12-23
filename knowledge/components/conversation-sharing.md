# Conversation Sharing

Share conversations with others - from simple view-only links to full collaborative
sessions with shared context. Sharing is a first-class feature, not an afterthought.

## Why This Matters

Carmenta users build things at the speed of thought. The conversations they have are
valuable artifacts - problem-solving sessions, research explorations, decision-making
threads. Sharing these extends the value beyond the original creator.

Most competitors treat sharing as secondary - bolted-on snapshot links that strip
context and reduce conversations to bare transcripts. No one positions sharing as core
identity. This is our opening.

Carmenta's memory is a differentiator. We can share not just what was said, but the
understanding that made it valuable.

## Sharing Models

Four distinct ways to share, each serving different needs:

### View Only

The simplest share. A snapshot of the conversation at a point in time.

**What it does:**

- Creates a unique short URL (`/s/abc1234`)
- Recipients see the conversation as read-only
- No memory context included (stripped for privacy)
- Static - doesn't update if original conversation continues
- No authentication required to view

**When to use:**

- "Look what we figured out"
- Sharing a useful technique or solution
- Quick reference for a colleague

**Privacy features:**

- Optional anonymity toggle (hide creator name) - pattern from ChatGPT
- Files and attachments excluded by default
- Tool call raw data stripped (only final output visible) - pattern from Claude

### Fork

Recipients get their own copy to continue independently.

**What it does:**

- Everything in View Only, plus:
- "Continue this conversation" button for authenticated users
- Creates a copy in their workspace
- They can take it in their own direction
- Original owner never sees their fork
- Optional: include suggested context for their continuation

**When to use:**

- "Start from where I left off"
- Handing off research for someone else to continue
- Template conversations
- Sharing a technique others can adapt

### Collaborate

Real collaboration with shared context. This is the novel capability.

**What it does:**

- Multiple users can participate in the same conversation
- Conversation has its own shared context pool (see below)
- All participants see all messages in real-time
- Each participant can contribute context to the shared pool
- Presence indicators show who's active
- Typing indicators for awareness

**When to use:**

- Working through a problem together
- Ongoing projects with AI assistance
- Team knowledge building
- Decision-making with shared AI support

**Participant limits:**

Based on ChatGPT Groups research, cap at 20 participants. Beyond this, coordination
overhead exceeds benefit. For larger groups, consider channel-based patterns.

### Audio Overview (Future)

Inspired by NotebookLM, generate shareable audio summaries of conversations.

**What it does:**

- Generates podcast-style audio with two AI hosts discussing the conversation
- Shareable as standalone audio file or embedded player
- Multiple formats: Deep Dive, Brief, Critique, Debate
- Supports 80+ languages for output (not just input language)

**When to use:**

- Summarizing research for stakeholders who prefer audio
- Creating shareable podcasts from AI sessions
- Making conversations accessible during commute/exercise

## The Shared Context Pool

This is what makes Collaborate special and aligns with heart-centered philosophy.

### Core Concept

When a conversation becomes collaborative, it gets its own memory - separate from any
individual user's personal memory. The conversation becomes a "we" with accumulated
shared understanding.

This pattern is validated by ChatGPT Groups research: personal memory never leaks to
shared spaces. Context isolation is foundational for trust.

```
┌─────────────────────────────────────────────┐
│         Collaborative Conversation           │
│                                              │
│  ┌───────────────────────────────────────┐  │
│  │        Shared Context Pool             │  │
│  │                                        │  │
│  │  Context contributed by User 1         │  │
│  │  Context contributed by User 2         │  │
│  │  Context generated during conversation │  │
│  └───────────────────────────────────────┘  │
│                                              │
│  [Conversation history - visible to all]    │
└─────────────────────────────────────────────┘

User 1's personal memory ─┐
                          │ NOT accessible
User 2's personal memory ─┘ (privacy preserved)
```

### How Context Contribution Works

**When creating a collaborative share:**

1. User sees: "Include relevant context?"
2. Carmenta suggests context that seems relevant to the conversation
3. User selects what to include (explicit consent)
4. Selected context is copied into the shared pool
5. Preview shows exactly what collaborators will see

**When joining:**

1. New participant sees the conversation and knows shared context exists
2. They can contribute their own context: "Add to shared context"
3. Their personal memory is never directly accessed
4. Notification appears for existing participants

**During the conversation:**

- AI searches the shared context pool for all messages
- AI can suggest: "Should we add this to our shared context?"
- Context accumulates as the collaboration continues
- AI adapts behavior for group dynamics (knows when to speak vs. listen)

### Context Pool Governance

**Owner controls, contributors add:**

- Anyone can add context to the pool
- Only conversation owner can remove context
- Prevents accidental deletion while allowing growth
- Audit log of who contributed what (enterprise feature)

## Carmenta's AI Behavior in Shared Contexts

Based on ChatGPT Groups research, AI needs "social behaviors" for collaboration:

**Flow awareness:**

- Sense when participants are asking each other vs. asking Carmenta
- Decide when to respond vs. when to stay quiet
- Don't dominate - let humans talk
- Jump in when value is clear

**Consistent context:**

- Use the same shared context for all participants
- Don't favor one participant's framing over another
- Maintain neutrality while being helpful

**Proactive suggestions:**

- "This seems important - should we add it to our shared context?"
- "I notice we're making decisions here. Want me to summarize the key points?"

## Access Controls

### Initial Implementation

| Control         | Description                             |
| --------------- | --------------------------------------- |
| **Create link** | Generates unique shareable URL          |
| **Revoke link** | Kills the link, shared view returns 404 |
| **View shares** | See all your active shared links        |
| **Anonymity**   | Toggle to hide creator name (per share) |
| **Preview**     | See exactly what recipients will see    |

### Phase 2 Features

| Control            | Description                                  |
| ------------------ | -------------------------------------------- |
| **Expiration**     | Auto-expire after 30/90 days or custom       |
| **View analytics** | Who viewed, when, how long                   |
| **Download count** | Track how many times transcript was exported |

### Enterprise Features

| Control                 | Description                                  |
| ----------------------- | -------------------------------------------- |
| **Domain restriction**  | Only @company.com emails can view            |
| **Password protection** | Additional layer for sensitive content       |
| **Audit trail**         | Full log of shares, views, revocations       |
| **Admin override**      | Workspace admin can disable sharing entirely |
| **SCIM provisioning**   | Okta/Azure AD/Google Workspace user sync     |

## Privacy & Security

### ID Anonymization

Never expose internal IDs in shared content. Prevents enumeration attacks:

```typescript
// Internal: convo_123, msg_456, user_789
// Shared view: xK9mQ2, pL3nR7, aB5cD1

function generateShareKey(): string {
  return nanoid(10); // URL-safe, 64^10 possibilities
}
```

### Content Stripping (View Only / Fork)

For non-collaborative shares, strip:

- Personal memory context
- Knowledge base references
- File attachments (unless explicitly included)
- Tool call raw data (show outputs only)
- MCP server responses (show summaries only)

What remains: the conversation transcript with rendered outputs.

### Sensitive Data Exclusions

Never include in shared context (pattern from ChatGPT bio tool):

- Race, ethnicity, religion
- Political affiliation
- Medical/mental health information
- Precise geolocation
- Sexual orientation
- Trade union membership
- Financial account details
- API keys, passwords, secrets

### Consent Steps

**Before creating any share:**

> "This will create a shareable link. Anyone with the link can view this conversation.
> Files and attachments will not be included."

**Before enabling collaboration:**

> "This conversation may reference your personal context. Select what to include in the
> shared context pool. Your full memory will never be accessible to collaborators."

**Preview before sharing:**

Show exactly what recipients will see - stripping applied, anonymization shown.

### Temporary Conversations (Future)

Pattern from Gemini: temporary chats that don't appear in history.

- Not used for personalization or training
- Retained 72 hours for response only
- Ideal for sensitive one-off discussions
- Cannot be shared (by design)

## Technical Implementation

### URL Structure

Short, memorable URLs using nanoid:

| Type        | Pattern         | Example         |
| ----------- | --------------- | --------------- |
| View        | `/s/{nanoid10}` | `/s/xK9mQ2pL3n` |
| Fork        | `/s/{nanoid10}` | `/s/aB5cD1qR7m` |
| Collaborate | `/c/{nanoid10}` | `/c/jH8kN4wE2x` |
| Audio       | `/a/{nanoid10}` | `/a/pQ9sT6yU1i` |

10-character nanoid provides 64^10 = 1.15 quintillion possibilities. Rate limit lookups
to prevent enumeration.

### Data Model

```typescript
interface SharedConversation {
  id: string; // nanoid
  conversationId: string; // Original conversation
  ownerId: string; // Who created the share

  type: "view" | "fork" | "collaborate";

  // Snapshot of messages at share time (view/fork)
  // or reference to live conversation (collaborate)
  messages: Message[] | "live";

  // Privacy options
  isAnonymous: boolean; // Hide creator name
  includeFiles: boolean; // Include file attachments
  includeToolCalls: boolean; // Include tool call details

  // For collaborate mode
  sharedContext?: SharedContextPool;
  participants?: Participant[];
  maxParticipants: number; // Default 20

  // Lifecycle
  createdAt: Date;
  expiresAt?: Date;
  revokedAt?: Date;

  // Analytics
  viewCount: number;
  lastViewedAt?: Date;
}

interface Participant {
  userId: string;
  joinedAt: Date;
  lastActiveAt: Date;
  role: "owner" | "collaborator";
}

interface SharedContextPool {
  conversationId: string;
  items: SharedContextItem[];
}

interface SharedContextItem {
  id: string;
  contributorId: string;
  type: "memory" | "document" | "generated";
  content: string;
  addedAt: Date;
}

interface ShareAuditLog {
  id: string;
  shareId: string;
  action: "created" | "viewed" | "revoked" | "expired" | "context_added";
  actorId?: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}
```

### Database Schema

```sql
CREATE TABLE shared_conversations (
  id VARCHAR(10) PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('view', 'fork', 'collaborate')),
  is_anonymous BOOLEAN DEFAULT FALSE,
  include_files BOOLEAN DEFAULT FALSE,
  include_tool_calls BOOLEAN DEFAULT FALSE,
  max_participants INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ
);

CREATE INDEX idx_shared_owner ON shared_conversations(owner_id);
CREATE INDEX idx_shared_conversation ON shared_conversations(conversation_id);
CREATE INDEX idx_shared_expires ON shared_conversations(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE shared_context_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id VARCHAR(10) NOT NULL REFERENCES shared_conversations(id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE share_participants (
  share_id VARCHAR(10) NOT NULL REFERENCES shared_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  role VARCHAR(20) DEFAULT 'collaborator',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (share_id, user_id)
);

CREATE TABLE share_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id VARCHAR(10) NOT NULL REFERENCES shared_conversations(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES users(id),
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints

```
POST   /api/shares                    Create new share
GET    /api/shares                    List user's shares
GET    /api/shares/:id                Get shared conversation (public)
DELETE /api/shares/:id                Revoke share
PATCH  /api/shares/:id                Update share settings

POST   /api/shares/:id/context        Add to shared context (collaborate)
DELETE /api/shares/:id/context/:itemId Remove from shared context (owner only)

GET    /api/shares/:id/participants   List participants (collaborate)
POST   /api/shares/:id/join           Join collaborative conversation
DELETE /api/shares/:id/leave          Leave collaborative conversation

GET    /api/shares/:id/transcript     Download as markdown/JSON
GET    /api/shares/:id/audit          Get audit log (enterprise)
```

### Real-Time Collaboration

For collaborate mode, extend existing SSE infrastructure:

```typescript
// Events for collaborative conversations
type CollaborationEvent =
  | { type: "participant_joined"; participant: Participant }
  | { type: "participant_left"; participantId: string }
  | { type: "context_added"; item: SharedContextItem }
  | { type: "presence_update"; participants: PresenceInfo[] }
  | { type: "typing_start"; userId: string }
  | { type: "typing_end"; userId: string };

interface PresenceInfo {
  userId: string;
  isActive: boolean;
  lastActiveAt: Date;
}
```

## UX Flow

### Creating a Share

```
[Share button] → Modal appears

┌─────────────────────────────────────────────┐
│  Share this conversation                     │
│                                              │
│  ○ View only - Anyone with link can read     │
│  ○ Fork - Others can copy and continue       │
│  ● Collaborate - Work together in real-time  │
│                                              │
│  ─────────────────────────────────────────── │
│                                              │
│  Options:                                    │
│  ☑ Hide my name (share anonymously)          │
│  ☐ Include file attachments                  │
│  ☐ Include tool call details                 │
│                                              │
│  [Preview what others will see]              │
│                                              │
│  ─────────────────────────────────────────── │
│                                              │
│  [For Collaborate:]                          │
│  Include context for collaborators?          │
│  ☑ Project Phoenix overview                  │
│  ☑ Meeting notes from Nov 15                 │
│  ☐ Personal goals                            │
│  ☐ Client contact info                       │
│                                              │
│  [Create Link]                               │
└─────────────────────────────────────────────┘

→ Link created, copied to clipboard

"Link created! Anyone with this link can join."
carmenta.ai/c/xK9mQ2pL3n [Copy]

[Manage all shares]
```

### Preview Before Sharing

Critical for trust - show exactly what recipients see:

```
┌─────────────────────────────────────────────┐
│  Preview: What others will see               │
│                                              │
│  Shared by: [Anonymous] / Nick               │
│  Created: Dec 22, 2025                       │
│                                              │
│  ─────────────────────────────────────────── │
│                                              │
│  [Rendered conversation without stripped     │
│   content, showing exactly how it appears    │
│   to recipients]                             │
│                                              │
│  ⚠️ These items are NOT included:            │
│  • 3 file attachments                        │
│  • 2 tool call details                       │
│  • Personal memory references                │
│                                              │
│  [Looks good, create link]  [Go back]        │
└─────────────────────────────────────────────┘
```

### Recipient Experience

**View Only:**

- Clean, read-only view
- Carmenta branding: "Shared via Carmenta"
- CTA: "Start your own conversation"
- Download options: Markdown, JSON
- No account required

**Fork:**

- Everything above, plus:
- "Continue this conversation" button (requires auth)
- Creates copy in their workspace
- Fork count visible to original owner (optional)

**Collaborate:**

- Joins live conversation
- Presence indicators for all participants
- Shared context indicator with contribution option
- Real-time message streaming
- Typing indicators
- "Add to shared context" button on AI responses

### Managing Shares Dashboard

```
┌─────────────────────────────────────────────┐
│  Your Shared Conversations                   │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │ Project Phoenix Discussion               │ │
│  │ Collaborate · 3 participants · Active    │ │
│  │ Created Dec 20 · 47 views                │ │
│  │ [Copy Link] [Revoke]                     │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │ Auth Implementation Guide                │ │
│  │ View only · Anonymous                    │ │
│  │ Created Dec 15 · 234 views               │ │
│  │ [Copy Link] [Revoke]                     │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │ API Design Session                       │ │
│  │ Fork · Expires in 7 days                 │ │
│  │ Created Dec 10 · 12 views · 3 forks      │ │
│  │ [Copy Link] [Extend] [Revoke]            │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Competitive Analysis

### Current Landscape (December 2025)

| Platform   | Sharing Model             | Context Handling          | Collaboration |
| ---------- | ------------------------- | ------------------------- | ------------- |
| ChatGPT    | Snapshot link, Groups     | Stripped / Group-isolated | Up to 20      |
| Claude     | Snapshot, Artifacts remix | Project-level context     | None          |
| Gemini     | Drive-style permissions   | Private by default        | Via Workspace |
| NotebookLM | Public links, Audio       | Notebook-scoped           | View only     |
| LibreChat  | Branch-specific + QR      | Stripped, anonymized IDs  | None          |
| Open WebUI | Local links, Community    | RBAC controlled           | Channels      |
| LobeChat   | Export only               | N/A (privacy-first)       | None          |

### What No One Does (Our Differentiation)

1. **Shared context pool** - Collaborative conversations with explicitly contributed,
   unified context. ChatGPT Groups keep memory per-user. We share it intentionally.

2. **Context contribution model** - Users explicitly choose what context to share, with
   preview and consent. No one else surfaces this.

3. **Memory-aware sharing** - Share not just transcript but relevant understanding.
   Competitors strip context entirely.

4. **Selective message sharing** - Share specific threads, not entire conversations.
   Everyone else is all-or-nothing.

5. **Share preview** - Show exactly what recipients will see before creating link.
   Competitors lack this transparency.

6. **Reasoning token visibility** - Show AI's thinking process in shared views.
   o1/o3/DeepSeek-R1 reasoning tokens could be exposed in shares.

7. **Voice-first sharing** - Native support for voice conversations as shareable units.
   All competitors are text-only.

8. **Remix attribution chains** - Track lineage when conversations are forked and
   remixed. Claude has remix but no attribution.

9. **Fine-grained enterprise audit** - Complete sharing audit trail with action
   attribution. Competitors have basic or no audit.

### Patterns Worth Adopting

**From ChatGPT:**

- Group chat with memory isolation (foundational for trust)
- Optional anonymity per share
- AI "social behavior" in groups (knows when to speak)
- Canvas-style artifact sharing with live rendering

**From Claude:**

- Snapshot isolation (messages after share stay private)
- Artifacts remix flow (fork with modifications)
- Smart data filtering (files, tool data excluded)
- Project-scoped memory

**From Gemini:**

- Drive-style permission familiarity (viewer/editor)
- Private-by-default philosophy
- Temporary chats for sensitive conversations
- Audio overviews for accessibility

**From NotebookLM:**

- Podcast-style audio generation
- Featured notebooks discovery
- Public links for research sharing

**From Open WebUI:**

- RBAC for admin governance
- Channel-based collaboration
- SCIM 2.0 for enterprise provisioning

**From LibreChat:**

- QR code generation for mobile sharing
- Multiple export formats (Markdown, JSON, screenshot)
- Conversation branching preservation

## Decisions

**Why shared context pool over per-user memory in collaboration:**

- Privacy: Personal memory never leaks (validated by ChatGPT Groups pattern)
- Consistency: AI uses same context for all participants
- Alignment: Conversation becomes its own "we" with shared understanding
- Control: Explicit contribution means intentional sharing

**Why four modes (view/fork/collaborate/audio):**

- View is table stakes
- Fork enables "continue my work" scenarios
- Collaborate is the core differentiator
- Audio extends accessibility and shareability

**Why preview before sharing:**

- Builds trust through transparency
- Prevents accidental exposure of sensitive content
- Shows exactly what stripping removes
- Pattern missing from all competitors

**Why 20-participant limit for collaboration:**

- Validated by ChatGPT Groups research
- Beyond 20, coordination overhead exceeds benefit
- For larger groups, channel-based patterns are better
- Can increase later based on usage data

**Why anonymous sharing option:**

- Some shares should focus on content, not creator
- Reduces friction for sensitive topics
- Pattern from ChatGPT works well
- Easy to implement (just hide name)

## Resolved Questions

**Voice conversations:** Display transcript + audio playback. Pattern from NotebookLM
shows audio is valuable for accessibility. Consider AI-generated audio summaries.

**Artifacts in shares:** Include by default, renderable in view. For collaborate mode,
consider live collaborative editing (Canvas pattern). Phase 2 feature.

**Notification model:** Real-time for active collaborators (WebSocket/SSE). Email digest
for inactive owners (daily summary of new participants).

**Collaborate limits:** 20 participants maximum, informed by ChatGPT Groups research.

## Open Questions

- **Workspace-level sharing policies:** Should teams be able to set default sharing
  rules? (e.g., "all shares require password", "shares expire after 30 days")

- **Discovery/gallery:** Should we surface a "Featured Conversations" discovery
  experience like NotebookLM? Requires curation system.

- **Collaborative artifact editing:** Canvas-style live editing in collaborate mode?
  Requires CRDT infrastructure (Yjs/pycrdt pattern from Open WebUI).

- **MCP tool access sharing:** Let collaborators invoke same integrations? Security
  implications need exploration.

## Milestones

**Phase 1: View Only (MVP)**

- Snapshot sharing with short URLs
- Anonymity toggle
- Preview before sharing
- Basic stripping (memory, files, tool calls)
- Revocation and share management
- Download as Markdown/JSON

**Phase 2: Fork**

- Continue conversation flow
- Copy to recipient's workspace
- Optional context suggestions for continuation
- Fork count tracking

**Phase 3: Collaborate**

- Shared context pool architecture
- Real-time participation via SSE
- Context contribution model
- Presence and typing indicators
- Participant management (20 limit)
- AI social behavior adaptations

**Phase 4: Enterprise & Polish**

- Expiration dates
- View analytics
- Domain restrictions
- Password protection
- Audit trail
- SCIM provisioning
- Workspace-level policies

**Phase 5: Audio & Discovery**

- AI-generated audio summaries
- Podcast-style sharing
- Featured conversations gallery
- Collaborative artifact editing
