# Real-Time Collaboration

Multiplayer editing and presence in an AI chat interface. Multiple people working with
Carmenta together - seeing each other, thinking together, building together.

## The Vision

### Underlying Need

**Being in the same room with someone while working with AI.**

The deepest collaborative moments happen when people are together - finishing each
other's thoughts, building on ideas in real-time, feeling the energy of shared creation.
Current AI interfaces are fundamentally solitary. We talk to AI alone. We share
transcripts after the fact. The collaboration happens before or after the AI
interaction, never during.

What people actually want: "Let's work through this together with AI." Not sequential
turns with a shared tool, but genuine co-presence - seeing each other think, building
momentum together, arriving at understanding as a group.

### The Ideal

**A shared thinking space where humans and AI flow together.**

Open a conversation. Invite someone. They appear - you see their cursor, their presence,
their focus. Start talking to Carmenta together. The AI responds to you as a group,
understanding when to address everyone versus someone specifically. You see each other's
reactions. Typing indicators show who's about to contribute. Ideas build naturally.

The conversation becomes a "we" - not just in Carmenta's voice, but in lived experience.
Three or four people, synchronized in attention, with AI as a participant rather than a
tool being passed around.

When it works: The feeling of a productive whiteboard session, but with AI that can
remember everything, synthesize perspectives, and contribute without being asked. You
leave with shared understanding, not just shared transcript.

### Core Insight

**Current multiplayer AI treats collaboration as turn-taking. The ideal treats it as
co-presence.**

ChatGPT Groups (November 2025) showed the industry is moving toward multiplayer AI. But
their model is still fundamentally turn-based - people take turns prompting, AI responds
to one person at a time. It's shared access to a tool, not shared experience of
thinking.

The reframe: Collaboration isn't about who's prompting. It's about feeling together
while thinking with AI. Presence indicators, shared focus, real-time awareness - these
create the feeling of being in the same room. The AI becomes a participant in a group
conversation, not a tool being shared.

## The Landscape

### What Leaders Do Today

**ChatGPT Groups** (OpenAI, November 2025):

- Up to 20 participants in a shared conversation
- Personal memory isolated from group chats (privacy preserved)
- AI has "social behaviors" - decides when to respond vs. stay quiet
- No presence indicators, typing awareness, or cursor sharing
- Turn-based interaction: person prompts, AI responds to that person
- GPT-5.1 Auto selects appropriate model per response
- Rate limits apply per-person (based on who AI responds to)

**Figma AI** (indirect reference):

- Real-time cursors and presence are foundational to the experience
- AI features operate in the collaborative canvas context
- Multiple humans + AI can work simultaneously
- Represents gold standard for multiplayer product design

**Liveblocks** (infrastructure):

- Presence indicators (cursors, avatars, selection highlighting)
- React hooks: `useOthers()`, `useMyPresence()`, `useUpdateMyPresence()`
- WebSocket-based real-time sync with automatic reconnection
- Storage primitives for shared state
- Used by production apps at scale
- Pricing: $99-299/month for Pro/Enterprise

**Yjs** (CRDT library):

- Conflict-free replicated data types for concurrent editing
- Works offline, syncs when reconnected
- Provider-agnostic (WebSocket, WebRTC, P2P)
- Used by Notion, Figma, and many collaborative editors
- Often paired with text editors (Tiptap, Slate, Lexical)

**PartyKit** (infrastructure):

- Edge-native WebSocket infrastructure on Cloudflare
- Y-PartyKit addon for Yjs backends
- Durable Objects for stateful collaboration
- Developer-friendly with generous free tier

### Patterns Worth Adopting

**From ChatGPT Groups:**

- Memory isolation: Personal memory never leaks to shared spaces
- AI social behavior: Knows when to respond vs. observe
- Participant limits: 20 people maximum (coordination overhead beyond this)
- Group profiles: Username/photo to identify who's speaking
- Custom instructions per group: Different tone for different contexts

**From Figma:**

- Presence as foundational, not feature
- Cursors with user identity (name, color)
- Real-time updates with low latency (sub-100ms target)
- Graceful degradation on poor connections

**From Liveblocks:**

- Provider abstraction for presence hooks
- Suspense-compatible React primitives
- Automatic cursor position normalization (viewport percentages)
- Connection state management with auto-reconnect

**From Research (MUCA, OverlapBot, Inner Thoughts papers):**

- AI should have "internal dialog" to decide when to contribute
- Support "textual overlap" - typing simultaneously, not strict turn-taking
- The "3W" framework: What to say, When to speak, Who to address

### Technical State of the Art

**WebSocket Infrastructure:**

- Industry standard for real-time: WebSocket with fallbacks
- Modern stacks: Liveblocks, PartyKit, Pusher, Ably, Socket.io
- Edge deployment reduces latency significantly
- Heartbeat + reconnection patterns well-established

**Conflict Resolution:**

- CRDTs (Yjs, Automerge) for concurrent edits without server authority
- Operational Transformation (OT) used by Google Docs (more complex)
- For chat (append-only), CRDT complexity often unnecessary
- Presence is ephemeral - no conflict resolution needed

**React Patterns:**

- Hooks for presence: `usePresence()`, `useOthers()`, `useSelf()`
- Refs + CSS properties for high-frequency updates (cursors)
- Optimistic updates for perceived responsiveness
- Suspense for loading states

## Gap Assessment

### Achievable Now

**Full co-presence experience:**

- Real-time cursors with user identity
- Presence indicators (avatar stacks, online status)
- Typing indicators for awareness
- Participant list with activity status
- WebSocket infrastructure (Liveblocks or custom)

**Collaborative conversation model:**

- Shared conversation with multiple participants
- AI responds to group, not individuals
- Shared context pool (separate from personal memory)
- Turn-based contributions (like ChatGPT Groups)

**Privacy-preserving collaboration:**

- Personal memory isolated from shared conversations
- Context explicitly contributed by consent
- Audit trail for enterprise compliance

### Emerging (6-12 months)

**AI social intelligence:**

- AI deciding when to contribute without being prompted
- Understanding group dynamics and energy
- Addressing individuals vs. group appropriately
- Reducing interruptions when humans are flowing

**Collaborative artifacts:**

- Real-time co-editing of AI-generated artifacts (code, documents, diagrams)
- CRDT-based conflict resolution for concurrent edits
- Version history with attribution

**Voice multiplayer:**

- Multiple people speaking with AI simultaneously
- Real-time transcription visible to all participants
- AI voice responding in group context

### Aspirational

**True conversational flow:**

- Overlapping typing without strict turns
- AI interjecting naturally (not just when prompted)
- Emotional attunement to group energy
- Cultural adaptation across different collaboration styles

**Persistent collaborative spaces:**

- Ongoing project rooms that persist across sessions
- Knowledge accumulates over time
- Channel-like patterns for larger groups
- Async + sync modes seamlessly

## Relationship to Existing Components

**Conversation Sharing** (`conversation-sharing.md`): The Collaborate sharing mode IS
this feature. Real-time collaboration extends conversation sharing from static snapshots
to live, multiplayer experiences. The shared context pool defined there is the
foundation.

**Memory** (`memory.md`): Critical privacy boundary: Personal memory never leaks to
collaborative conversations. Shared context pool is separate storage - contributors
explicitly choose what to share.

**Conversation Sync** (`conversation-sync.md`): Collaborative conversations can be
synced just like solo ones. The challenge is attribution - who said what when multiple
people contribute.

## Core Functions

### Presence Layer

Real-time awareness of who's here and what they're doing:

- **Avatar stack**: Who's in this conversation right now
- **Activity status**: Active, idle, or away
- **Cursors**: See where others are focused (optional, toggle-able)
- **Typing indicators**: Know when someone's about to contribute
- **Focus indicators**: Highlight what someone is looking at

### Participation Model

How multiple people interact with the same AI conversation:

- **Sequential contributions**: Anyone can send a message at any time
- **AI response routing**: AI addresses the group, with ability to @mention individuals
- **Turn awareness**: Visual indication of who AI is responding to
- **Message attribution**: Every message clearly shows who sent it
- **Reactions**: Quick emoji responses to messages (like ChatGPT Groups)

### Shared Context Pool

Collaborative understanding that accumulates (defined in conversation-sharing.md):

- **Explicit contribution**: Users choose what context to share
- **Preview before sharing**: See exactly what will be visible to others
- **Context from conversation**: AI can suggest adding insights to shared pool
- **No personal memory leakage**: Strict isolation from individual memory stores

### AI Behavior Adaptation

How Carmenta behaves differently in group context:

- **Flow awareness**: Sense when humans are talking to each other vs. asking AI
- **Selective response**: Decide when to contribute vs. observe
- **Group addressing**: Speak to "we" unless specifically addressing someone
- **Consistency**: Same context for all participants (no favoritism)
- **Proactive synthesis**: Offer to summarize when discussion gets complex

### Access Control

Who can do what in collaborative conversations:

- **Invite by link**: Share a link to invite up to 20 participants
- **Role-based access**: Owner, collaborator (different permissions)
- **Remove participants**: Owner can remove anyone except themselves
- **Leave conversation**: Anyone can leave at any time
- **Notification preferences**: Per-conversation notification settings

## Technical Architecture

### Connection Management

```typescript
interface CollaborativeRoom {
  id: string;
  conversationId: string;
  participants: Participant[];
  presenceState: Map<string, PresenceData>;
  connectionState: "connecting" | "connected" | "reconnecting" | "disconnected";
}

interface Participant {
  userId: string;
  username: string;
  avatarUrl?: string;
  color: string; // For cursor/presence identification
  role: "owner" | "collaborator";
  joinedAt: Date;
  lastActiveAt: Date;
}

interface PresenceData {
  cursor: { x: number; y: number } | null; // Viewport percentages
  isTyping: boolean;
  focusedMessageId: string | null;
  lastSeen: Date;
}
```

### Real-Time Events

```typescript
type CollaborationEvent =
  // Presence
  | { type: "presence_update"; userId: string; presence: PresenceData }
  | { type: "participant_joined"; participant: Participant }
  | { type: "participant_left"; userId: string }

  // Conversation
  | { type: "message_created"; message: Message }
  | { type: "message_streaming"; messageId: string; delta: string }
  | { type: "ai_responding_to"; userId: string | null } // null = responding to group

  // Context
  | { type: "context_added"; item: SharedContextItem; contributorId: string }
  | { type: "context_removed"; itemId: string }

  // Meta
  | { type: "room_settings_updated"; settings: RoomSettings }
  | { type: "typing_start"; userId: string }
  | { type: "typing_end"; userId: string };
```

### Infrastructure Options

**Option A: Liveblocks (Recommended for MVP)**

Pros:

- React hooks out of the box (`useOthers`, `useMyPresence`)
- Presence + storage handled
- Battle-tested at scale
- Good documentation and examples

Cons:

- Monthly cost ($99-299+ for Pro)
- Vendor dependency
- Less control over infrastructure

**Option B: Custom WebSocket + Redis**

Pros:

- Full control
- No vendor dependency
- Can optimize for our specific patterns

Cons:

- More implementation work
- Must handle edge cases (reconnection, presence decay, etc.)
- Maintenance burden

**Option C: PartyKit**

Pros:

- Edge-native (Cloudflare Workers/Durable Objects)
- Great developer experience
- Built-in Yjs support
- Generous free tier

Cons:

- Cloudflare ecosystem lock-in
- Less mature than Liveblocks

**Recommendation**: Start with Liveblocks for fast MVP. Evaluate migration to
PartyKit/custom if cost or control becomes an issue at scale.

### React Implementation Pattern

```typescript
// Collaborative wrapper component
function CollaborativeConversation({ conversationId }: Props) {
  return (
    <RoomProvider id={`conversation-${conversationId}`}>
      <PresenceLayer />
      <ConversationContent />
      <TypingIndicators />
      <ParticipantList />
    </RoomProvider>
  );
}

// Presence layer (cursors, focus)
function PresenceLayer() {
  const others = useOthers();
  const updateMyPresence = useUpdateMyPresence();

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      updateMyPresence({
        cursor: {
          x: (e.clientX / window.innerWidth) * 100,
          y: (e.clientY / window.innerHeight) * 100,
        },
      });
    };

    const handleLeave = () => updateMyPresence({ cursor: null });

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerleave', handleLeave);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerleave', handleLeave);
    };
  }, [updateMyPresence]);

  return (
    <>
      {others.map(({ connectionId, presence, info }) => (
        presence?.cursor && (
          <Cursor
            key={connectionId}
            x={presence.cursor.x}
            y={presence.cursor.y}
            name={info?.name}
            color={info?.color}
          />
        )
      ))}
    </>
  );
}

// Typing indicators
function TypingIndicators() {
  const others = useOthers();
  const typingUsers = others.filter(({ presence }) => presence?.isTyping);

  if (typingUsers.length === 0) return null;

  const names = typingUsers.map(({ info }) => info?.name).filter(Boolean);

  return (
    <div className="typing-indicator">
      {names.length === 1
        ? `${names[0]} is typing...`
        : names.length === 2
        ? `${names[0]} and ${names[1]} are typing...`
        : `${names.length} people are typing...`}
    </div>
  );
}
```

## UX Design

### Entry Points

**Start new collaborative conversation:**

```
[New Conversation] → [+] Add people → Enter emails/usernames → [Create]
```

**Convert existing conversation to collaborative:**

```
[Share button] → Collaborate mode → Select context to share → [Create Link]
```

**Join existing collaborative conversation:**

```
Click shared link → (Auth if needed) → Join room → See participants + history
```

### Presence Indicators

**Avatar Stack** (header area):

- Overlapping avatars showing who's in the conversation
- Green dot for active, gray for idle
- "+N more" when many participants
- Click to see full participant list

**Cursors** (optional, enabled per-room):

- Small cursor icon with user's name label
- Color-coded per participant
- Smooth interpolation (not jumpy)
- Fades when user is idle

**Typing Indicator** (input area):

- Shows below/beside input when others are typing
- Animating dots with user name(s)
- Disappears after ~3 seconds of no typing

### Message Attribution

Every message clearly shows:

- Sender's name and avatar
- Timestamp
- "Responding to [name]" when AI addresses specific person
- Reaction counts and participants who reacted

### Collaborative Input

- Input field shows who else is typing
- No blocking - anyone can send anytime
- Messages appear instantly for all participants
- Streaming AI responses visible to everyone simultaneously

## Competitive Analysis

### Current Landscape (December 2025)

| Platform   | Multiplayer | Presence | Cursors  | Context Model      | Max Users |
| ---------- | ----------- | -------- | -------- | ------------------ | --------- |
| ChatGPT    | Groups      | No       | No       | Memory isolated    | 20        |
| Claude     | None        | N/A      | N/A      | Project-scoped     | N/A       |
| Gemini     | Workspace   | Via Docs | Via Docs | Private by default | Team      |
| Open WebUI | Channels    | No       | No       | RBAC controlled    | Unlimited |
| LibreChat  | None        | N/A      | N/A      | N/A                | N/A       |
| LobeChat   | None        | N/A      | N/A      | Privacy-first      | N/A       |

### What No One Does (Our Differentiation)

1. **True co-presence**: Cursors, typing indicators, activity status - the feeling of
   being in the same room, not just sharing a tool

2. **Explicit context sharing**: Contributors choose what context to share with preview.
   ChatGPT Groups isolates memory entirely; we enable intentional sharing.

3. **AI social intelligence**: Carmenta decides when to contribute, addresses
   individuals vs. group, synthesizes without being asked

4. **Collaborative artifacts**: Real-time co-editing of AI-generated content (Phase 2)

5. **Voice multiplayer**: Multiple people speaking with AI together (Phase 3)

## Decisions

### Why 20-participant limit

Validated by ChatGPT Groups launch. Beyond 20 people, coordination overhead exceeds
benefit. AI responses become less coherent when addressing too many perspectives. For
larger groups, channel-based patterns (like Slack) work better.

### Why memory isolation is foundational

Personal memory leaking to shared spaces would destroy trust. ChatGPT Groups got this
right - memory is strictly personal. Our shared context pool adds intentional sharing on
top of this foundation.

### Why Liveblocks for MVP

Speed to market. Liveblocks provides battle-tested presence and storage primitives. We
can focus on the AI collaboration layer rather than rebuilding WebSocket infrastructure.
Evaluate custom/PartyKit once we validate the product.

### Why cursors are optional

Not everyone wants their focus visible. Some find cursors distracting. Make it a
room-level setting that participants can toggle.

### Why reactions matter

From ChatGPT Groups: quick feedback without interrupting flow. AI can even react to
messages (with emoji) - adds personality without dominating conversation.

## Open Questions

- **AI contribution triggering**: How does Carmenta decide when to speak unprompted?
  What signals indicate an opportune moment?

- **Cross-cultural adaptation**: Different cultures have different collaboration norms.
  How does AI behavior adapt?

- **Enterprise features**: SSO integration, compliance logging, admin controls. What's
  needed for enterprise adoption?

- **Async collaboration**: What happens when participants aren't online simultaneously?
  Notification model, catch-up experience?

- **Artifact collaboration**: How do we enable real-time co-editing of generated code,
  documents, diagrams? CRDT complexity worth it?

## Implementation Milestones

### Phase 1: Foundation (MVP)

- Liveblocks integration for presence infrastructure
- Basic presence: avatar stack, online status
- Typing indicators
- Shared conversation with message attribution
- Participant management (invite, leave, remove)
- AI responds to group (no individual addressing yet)

### Phase 2: Enhanced Presence

- Real-time cursors (optional, toggle-able)
- Focus indicators (which message someone is reading)
- Reactions to messages
- AI acknowledges specific participants when appropriate
- Shared context pool implementation

### Phase 3: AI Social Intelligence

- AI decides when to respond vs. observe
- Proactive synthesis ("Should I summarize what we've discussed?")
- Individual addressing vs. group addressing
- Flow awareness (don't interrupt when humans are flowing)

### Phase 4: Collaborative Artifacts

- Real-time co-editing of generated content
- CRDT integration (likely Yjs)
- Version history with attribution
- Export/fork artifact independently

### Phase 5: Voice Multiplayer

- Multiple voice participants
- Real-time transcription visible to all
- AI voice in group context
- Turn management for voice (harder than text)

## Sources

- [OpenAI: Introducing group chats in ChatGPT](https://openai.com/index/group-chats-in-chatgpt/)
  (November 2025)
- [Liveblocks Documentation](https://liveblocks.io/docs)
- [Yjs Documentation](https://docs.yjs.dev/)
- [PartyKit Y-PartyKit API](https://docs.partykit.io/reference/y-partykit-api)
- [AI's Missing Multiplayer Mode](https://www.ignorance.ai/p/ais-missing-multiplayer-mode) -
  Charlie Guo
- [Building Figma Multiplayer Cursors](https://mskelton.dev/blog/building-figma-multiplayer-cursors) -
  Mark Skelton
- Research papers: MUCA (Multi-User Chat Assistant), OverlapBot, "Inner Thoughts"
