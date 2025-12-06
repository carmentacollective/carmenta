# Conversation Sharing

Share conversations with others - from simple view-only links to full collaborative
sessions with shared context.

## Why This Matters

Carmenta users build things at the speed of thought. The conversations they have are
valuable artifacts - problem-solving sessions, research explorations, decision-making
threads. Sharing these extends the value beyond the original creator.

But Carmenta's memory is a differentiator. Most competitors strip context when sharing,
reducing conversations to bare transcripts. We can do better.

## Sharing Models

Three distinct ways to share, each serving different needs:

### View Only

The simplest share. A snapshot of the conversation at a point in time.

**What it does:**

- Creates a unique short URL (`/s/abc1234`)
- Recipients see the conversation as read-only
- No memory context included (stripped for privacy)
- Static - doesn't update if original conversation continues

**When to use:**

- "Look what we figured out"
- Sharing a useful technique or solution
- Quick reference for a colleague

### Fork

Recipients get their own copy to continue independently.

**What it does:**

- Everything in View Only, plus:
- "Continue this conversation" button for authenticated users
- Creates a copy in their workspace
- They can take it in their own direction
- Original owner never sees their fork

**When to use:**

- "Start from where I left off"
- Handing off research for someone else to continue
- Template conversations

### Collaborate

Real collaboration with shared context. This is the novel capability.

**What it does:**

- Multiple users can participate in the same conversation
- Conversation has its own shared context pool (see below)
- All participants see all messages in real-time
- Each participant can contribute context to the shared pool

**When to use:**

- Working through a problem together
- Ongoing projects with AI assistance
- Team knowledge building

## The Shared Context Pool (Model C)

This is what makes Collaborate special and aligns with heart-centered philosophy.

### Core Concept

When a conversation becomes collaborative, it gets its own memory - separate from any
individual user's personal memory. The conversation becomes a "we" with accumulated
shared understanding.

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

**When joining:**

1. New participant sees the conversation and knows shared context exists
2. They can contribute their own context: "Add to shared context"
3. Their personal memory is never directly accessed

**During the conversation:**

- AI searches the shared context pool for all messages
- AI can suggest: "Should I add this to our shared context?"
- Context accumulates as the collaboration continues

### Context Pool Governance

**Owner controls, contributors add:**

- Anyone can add context to the pool
- Only conversation owner can remove context
- Prevents accidental deletion while allowing growth

## Access Controls

Start simple, add complexity only if user research demands it.

### Initial Implementation

| Control         | Description                             |
| --------------- | --------------------------------------- |
| **Create link** | Generates unique shareable URL          |
| **Revoke link** | Kills the link, shared view returns 404 |
| **View shares** | See all your active shared links        |

### Future Considerations (Not MVP)

These are patterns competitors use. Add only if demand surfaces:

- **Password protection** - Sensitive content protection
- **Expiration dates** - Auto-cleanup, force re-share for continued access
- **Domain restriction** - Only @company.com emails
- **View analytics** - Who viewed, when

## Privacy & Security

### ID Anonymization

Never expose internal IDs in shared content. Use the LibreChat pattern:

```typescript
// Internal: convo_123, msg_456, user_789
// Shared view: convo_xK9mQ2, msg_pL3nR7, user_aB5cD1

memoizedAnonymizeId("convo"); // Consistent within session
memoizedAnonymizeId("msg");
memoizedAnonymizeId("user");
```

Prevents ID enumeration attacks and leaking internal structure.

### Memory Stripping (View Only / Fork)

For non-collaborative shares, strip all memory context:

- No personal information from memory
- No knowledge base references
- Just the conversation transcript

### Consent Steps

**Before creating any share:**

> "This will create a shareable link. Anyone with the link can view this conversation."

**Before enabling collaboration:**

> "This conversation may reference your personal context. Select what to include in the
> shared context pool. Your full memory will never be accessible to collaborators."

## Technical Implementation

### URL Structure

Short, memorable URLs:

- View/Fork: `/s/{nanoid7}` → `/s/xK9mQ2p`
- Collaborate: `/c/{nanoid7}` → `/c/aB5cD1q`

7-character nanoid provides 64^7 = 4.4 trillion possibilities.

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

  // For collaborate mode
  sharedContext?: SharedContextPool;
  participants?: string[];

  createdAt: Date;
  revokedAt?: Date;
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
```

### Real-Time Collaboration

For collaborate mode, use existing real-time infrastructure:

- WebSocket for message streaming
- Presence indicators (who's active)
- Typing indicators

## UX Flow

### Creating a Share

```
[Share button] → Modal appears

"How would you like to share?"

○ View only - Anyone with link can read
○ Fork - Others can copy and continue
● Collaborate - Work together in real-time

[For Collaborate:]
"Include context for collaborators?"
☑ Project Phoenix overview
☑ Meeting notes from Nov 15
☐ Personal goals
☐ Client contact info

[Create Link] → Copies to clipboard

"Link created! Anyone with this link can join."
/c/xK9mQ2p [Copy]

[Manage shares] to see all active links
```

### Recipient Experience

**View Only:**

- See conversation, read-only
- Carmenta branding: "Shared via Carmenta"
- CTA: "Start your own conversation"

**Fork:**

- Everything above, plus:
- "Continue this conversation" button (requires auth)
- Creates copy in their workspace

**Collaborate:**

- Joins live conversation
- Sees shared context indicator
- Can contribute context
- Messages appear in real-time

## Competitive Analysis

### What competitors do

| Platform       | Sharing Model           | Context Handling            |
| -------------- | ----------------------- | --------------------------- |
| ChatGPT        | Snapshot link           | Stripped                    |
| ChatGPT Groups | Real-time collab (2025) | Per-user memory, not shared |
| Claude         | Artifacts remix         | Project-level context       |
| LibreChat      | Branch-specific links   | Stripped, anonymized IDs    |
| LobeChat       | Screenshot/URL-encoded  | N/A                         |

### What no one does

- Shared context pool for collaboration
- Explicit context contribution model
- Consent-based context sharing

This is our differentiation.

## Decisions

**Why shared context pool over per-user memory in collaboration:**

- Privacy: Personal memory never leaks
- Consistency: AI uses same context for all participants
- Alignment: Conversation becomes its own "we" with shared understanding
- Control: Explicit contribution means intentional sharing

**Why start with three modes (view/fork/collaborate):**

- View is table stakes
- Fork enables "continue my work" scenarios
- Collaborate is the differentiator worth building toward

**Why no password/expiration initially:**

- Competitors don't have it, no clear demand signal
- Adds friction to sharing flow
- Easy to add later if research shows need

## Open Questions

- **Voice conversations**: How do we handle sharing conversations that include voice?
  Display transcript? Audio playback? Both?

- **Artifacts in shares**: If the conversation generated artifacts (code, documents),
  are they included in shares? Editable in collaborate mode?

- **Notification model**: When someone joins a collaborative conversation, how is the
  owner notified? Real-time? Email?

- **Collaborate limits**: Maximum participants? (ChatGPT caps at 20)

## Milestones

**Phase 1: View Only**

- Simple snapshot sharing
- Short URLs, revocation
- No memory context

**Phase 2: Fork**

- Continue conversation flow
- Copy to recipient's workspace

**Phase 3: Collaborate**

- Shared context pool
- Real-time participation
- Context contribution model
