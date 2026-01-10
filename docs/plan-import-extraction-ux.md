# Import → Knowledge Extraction UX Plan

## The Gap

Currently, `commitImport()` saves conversations to the database but never triggers
extraction. The Temporal workflow exists (`importLibrarianJobWorkflow`) and the API
endpoint exists (`POST /api/import/extract`), but they're not wired to the import flow.

## Philosophy Alignment

Per `knowledge/users-should-feel.md`, this experience should embody:

- **Memory is relationship**: The librarian reading through conversations is Carmenta
  learning who you are, what you care about, what you've built
- **Coming Home**: "The first interaction feels like returning somewhere familiar"
- **Seen and Remembered**: Every extraction reinforces that Carmenta remembers
- **Simplicity is respect**: Minimal friction, smart defaults
- **Flow State Protected**: Never interrupt—progress happens alongside

## Proposed User Journey

### Phase 1: Import Success → Discovery Invitation

After successful import, instead of just "Done! Created X connections":

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ✓ 127 conversations imported                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  Let's see what we've been building together.       │   │
│  │                                                      │   │
│  │  We'll look for:                                     │   │
│  │  • Projects you're working on                       │   │
│  │  • People you work with                             │   │
│  │  • Preferences and patterns                         │   │
│  │  • Decisions you've made                            │   │
│  │                                                      │   │
│  │  [Begin Discovery]         [I'll explore first]     │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Language**: "we" framing throughout. Partnership, not service.

**"I'll explore first"**: Navigates to main app. Discovery can be triggered later from
settings or via a subtle prompt on next visit.

### Phase 2: Discovery in Progress

If user clicks "Begin Discovery", start the extraction workflow. The UI transitions to:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Rediscovering what we've built together...                 │
│                                                             │
│  ████████████░░░░░░░░░░░░░░░  34 of 127                    │
│                                                             │
│  Just found: You've been building an API integration       │
│  with Stripe...                                             │
│                                                             │
│  Found so far:                                              │
│  • 12 projects  • 8 people  • 23 preferences  • 5 decisions │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Feel free to explore while this runs. We'll be here.      │
│                                                             │
│  [Continue to Carmenta →]                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Non-blocking**: User can leave and come back. Progress persists via Temporal.

**Streaming discoveries**: Show specific findings as they emerge, not just counts.
Creates the "seen" feeling.

### Phase 3: Discovery Complete → Review Invitation

When extraction finishes (detected via polling or webhook), show:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  We remember now.                                           │
│                                                             │
│  48 things worth keeping:                                   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Projects (12)           People (8)                  │  │
│  │  Including Carmenta,     Alex, Sarah from design,    │  │
│  │  the API migration...    Marcus...                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Preferences (23)        Decisions (5)               │  │
│  │  How you like code       The auth approach,          │  │
│  │  reviewed...             database choice...          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Want to review what we found?                              │
│                                                             │
│  [Review findings]              [Keep everything]           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**"Keep everything"**: Clear action. Auto-approve all findings.

**Category examples**: Show 2-3 concrete examples per category so numbers feel like
actual knowledge, not database entries.

### Phase 4: Review Interface (Optional)

If user wants to review, show progressive disclosure:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Review Findings                                            │
│                                                             │
│  Here are some highlights. Look right?                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PROJECT                                             │   │
│  │                                                      │   │
│  │  "Building a heart-centered AI interface called     │   │
│  │   Carmenta that serves as a thinking partner"       │   │
│  │                                                      │   │
│  │  From: That late-night architecture session         │   │
│  │                                                      │   │
│  │  [✓ Keep]  [✎ Edit]  [✗ Skip]                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PERSON                                              │   │
│  │                                                      │   │
│  │  "Alex - co-founder, handles design and frontend"   │   │
│  │                                                      │   │
│  │  From: Team planning conversation                    │   │
│  │                                                      │   │
│  │  [✓ Keep]  [✎ Edit]  [✗ Skip]                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  These look right. Keep the rest too?                       │
│                                                             │
│  [Keep all 46 remaining]    [Show me more]                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Escape velocity**: After showing 3-5 high-confidence findings, offer "Keep all
remaining" prominently. Don't force users through 48 cards.

**Source attribution**: Use memorable conversation context, not generic "Conversation
with Claude, Dec 2024."

**Keyboard shortcuts**: j/k to navigate, a to approve, s to skip, e to edit.

**Mobile**: Swipe right to keep, swipe left to skip.

## Technical Implementation

### 1. Wire Extraction After Import

In `lib/actions/import.ts`, after successful `commitImport()`:

```typescript
// After saving all conversations, trigger extraction
if (connectionsCreated > 0) {
  // Get the connection IDs we just created
  const connectionIds = createdConnections.map((c) => c.id);

  // Return them so the UI can offer discovery
  return {
    ...result,
    connectionIds, // New field
    canStartDiscovery: true,
  };
}
```

### 2. Discovery State Machine

```
idle → starting → processing → complete → reviewing → done
         ↓           ↓            ↓
       error       error       skipped
```

State stored in:

- `extractionJobs` table (job status, progress)
- `pendingExtractions` table (individual findings)

### 3. Progress Polling

Client polls `GET /api/import/extract` every 2-3 seconds during processing:

```typescript
const { data } = await fetch("/api/import/extract");
// Returns: { stats: { total, pending, approved }, hasUnprocessedImports }
```

### 4. Component Structure

```
app/import/page.tsx (existing)
├── ImportUploader (existing)
├── ImportSuccess (new)
│   ├── DiscoveryInvitation
│   ├── DiscoveryProgress
│   └── DiscoveryComplete
└── components/discovery/
    ├── FindingCard.tsx
    ├── FindingReview.tsx
    └── CategorySummary.tsx
```

## Resolved Questions

1. **Auto-start vs. invitation?** → Invitation. Respects trust gesture of sharing
   conversations.

2. **Notification when complete?** → Toast for same-session. Subtle badge on next visit
   for longer jobs. No email interruption.

3. **What if Temporal is down?** → Graceful degradation: "Discovery temporarily
   unavailable." Store intent to run later when Temporal recovers.

4. **Batch vs. all progress?** → Overall progress. Batch-level adds complexity without
   meaning.

5. **"Maybe Later" path back?** → "I'll explore first" navigates away. Re-entry via
   settings or subtle prompt on next visit.

## Success Criteria

Per the philosophy, success means users feel:

- **Seen**: "This AI is actually learning who I am"
- **Not interrupted**: Discovery runs alongside, doesn't block
- **In control**: Can review, trust, or ignore findings
- **Partnership**: "We" discovered these together

---

_Reviewed by empathy-reviewer agent. Feedback integrated._
