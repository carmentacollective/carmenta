# Supermemory-Inspired Eval Cases

New test cases inspired by supermemory's user value propositions. These test user
outcomes we currently don't cover.

## Gap Analysis

| User Outcome                   | Import-Librarian | Librarian | Gap       |
| ------------------------------ | ---------------- | --------- | --------- |
| Temporal fact evolution        | ✅ Tested        | ❌ Never  | Librarian |
| Update existing knowledge      | N/A              | ❌ Never  | Librarian |
| Cross-source conflict          | ❌ Never         | ❌ Never  | Both      |
| Entity-attribute relationships | ❌ Never         | ❌ Never  | Both      |
| Intentional forgetting         | ❌ Never         | ❌ Never  | Both      |
| High-confidence auto-learn     | ❌ Never         | ❌ Never  | Both      |

**Key finding**: All 50 librarian test cases have `existingKB: []`. We never test what
happens when the user already has knowledge and says something that updates it.

---

## Proposed Test Cases

### Category 1: Real-Time Fact Evolution (Librarian)

These test the librarian's ability to UPDATE existing knowledge during live
conversations.

#### Case 1.1: Job Change

```typescript
{
    input: {
        id: "realtime-job-change",
        description: "User mentions job change - should update existing identity",
        conversation: [
            {
                role: "user",
                content: "I finally left Google! Started as CTO at a startup called Acme last week."
            },
            {
                role: "assistant",
                content: "Congratulations on the new role! That's a big career move."
            }
        ],
        existingKB: [
            {
                path: "profile.identity",
                name: "Identity",
                content: "Nick is a senior software engineer at Google."
            }
        ],
        category: "fact-evolution"
    },
    expected: {
        shouldSave: true,
        expectedPath: /profile\.identity/,
        expectedAction: "update",
        contentPatterns: [/CTO/i, /Acme/i],
        excludedContent: [/Google.*engineer/i]  // Old role shouldn't persist as current
    },
    tags: ["fact-evolution", "identity", "job-change"]
}
```

#### Case 1.2: Location Move

```typescript
{
    input: {
        id: "realtime-location-move",
        description: "User mentions they moved - should update location",
        conversation: [
            {
                role: "user",
                content: "We finally made the move to Austin last month. Still unpacking boxes!"
            }
        ],
        existingKB: [
            {
                path: "profile.identity",
                name: "Identity",
                content: "Nick lives in Las Vegas, Nevada."
            }
        ],
        category: "fact-evolution"
    },
    expected: {
        shouldSave: true,
        expectedPath: /profile\.identity/,
        expectedAction: "update",
        contentPatterns: [/Austin/i],
        excludedContent: [/Las Vegas/i]  // Should not persist old location as current
    },
    tags: ["fact-evolution", "identity", "location"]
}
```

#### Case 1.3: Relationship Status Change

```typescript
{
    input: {
        id: "realtime-relationship-change",
        description: "User's relationship status changed - should update people knowledge",
        conversation: [
            {
                role: "user",
                content: "Unity and I broke up last month. It was amicable but hard. I've started seeing someone new - her name is Julianna."
            }
        ],
        existingKB: [
            {
                path: "knowledge.people.unity",
                name: "Unity",
                content: "Nick's girlfriend is Unity. They've been together for 2 years."
            }
        ],
        category: "fact-evolution"
    },
    expected: {
        shouldSave: true,
        expectedPath: /knowledge\.people\.(unity|julianna)/,
        expectedAction: "update",  // or could be create for Julianna + update for Unity
        contentPatterns: [/Julianna/i, /girlfriend|dating|seeing/i],
        // Unity's status should be updated to "ex-girlfriend"
    },
    tags: ["fact-evolution", "relationship", "person"]
}
```

#### Case 1.4: Preference Change

```typescript
{
    input: {
        id: "realtime-preference-change",
        description: "User explicitly changes a preference",
        conversation: [
            {
                role: "user",
                content: "I've completely switched from VS Code to Cursor now. The AI features are incredible. Haven't touched VS Code in months."
            }
        ],
        existingKB: [
            {
                path: "knowledge.preferences.tools",
                name: "Tools",
                content: "Nick uses VS Code as his primary editor."
            }
        ],
        category: "fact-evolution"
    },
    expected: {
        shouldSave: true,
        expectedPath: /knowledge\.preferences\.tools/,
        expectedAction: "update",
        contentPatterns: [/Cursor/i],
        excludedContent: [/VS Code.*primary/i]
    },
    tags: ["fact-evolution", "preference", "tools"]
}
```

---

### Category 2: Entity-Attribute Relationships

These test whether we properly capture attributes about entities (people, projects,
etc.) that can be recalled later.

#### Case 2.1: Person Attribute

```typescript
{
    input: {
        id: "entity-person-attribute",
        description: "User mentions attribute about a person - should be findable",
        conversation: [
            {
                role: "user",
                content: "My girlfriend Julianna is really into clean eating. She doesn't like seed oils and avoids processed food."
            }
        ],
        existingKB: [
            {
                path: "knowledge.people.julianna",
                name: "Julianna",
                content: "Nick's girlfriend is Julianna."
            }
        ],
        category: "entity-attribute"
    },
    expected: {
        shouldSave: true,
        expectedPath: /knowledge\.people\.julianna/,
        expectedAction: "update",  // Append attribute to existing person
        contentPatterns: [/seed oils/i, /clean eating|processed food/i]
    },
    tags: ["entity-attribute", "person", "preference"]
}
```

#### Case 2.2: Project Context Accumulation

```typescript
{
    input: {
        id: "entity-project-attribute",
        description: "User adds context about existing project",
        conversation: [
            {
                role: "user",
                content: "We decided to use PostgreSQL for Carmenta's database. The ltree extension is perfect for our knowledge base structure."
            }
        ],
        existingKB: [
            {
                path: "knowledge.projects.carmenta",
                name: "Carmenta",
                content: "Nick is building Carmenta, an AI interface for builders."
            }
        ],
        category: "entity-attribute"
    },
    expected: {
        shouldSave: true,
        expectedPath: /knowledge\.projects\.carmenta/,
        expectedAction: "append",  // Add decision to existing project
        contentPatterns: [/PostgreSQL/i, /ltree/i]
    },
    tags: ["entity-attribute", "project", "decision"]
}
```

---

### Category 3: Cross-Source Conflict Resolution

These test what happens when imported knowledge conflicts with live conversation.

#### Case 3.1: Import Says X, User Now Says Y

```typescript
{
    input: {
        id: "cross-source-override",
        description: "Live conversation overrides imported fact",
        conversation: [
            {
                role: "user",
                content: "Actually, I need to update something - I don't work at Cloudflare anymore. I left to work on Carmenta full-time."
            }
        ],
        existingKB: [
            {
                path: "profile.identity",
                name: "Identity",
                content: "Nick is a software engineer at Cloudflare.",
                // Metadata would indicate: sourceType: "conversation_extraction"
            }
        ],
        category: "conflict-resolution"
    },
    expected: {
        shouldSave: true,
        expectedPath: /profile\.identity/,
        expectedAction: "update",
        contentPatterns: [/Carmenta/i, /full-time/i],
        excludedContent: [/Cloudflare.*engineer/i]
    },
    tags: ["conflict-resolution", "cross-source", "identity"]
}
```

---

### Category 4: Intentional Forgetting

These test the user's ability to explicitly remove or archive knowledge.

#### Case 4.1: Explicit Forget Request

```typescript
{
    input: {
        id: "intentional-forget",
        description: "User explicitly asks to forget something",
        conversation: [
            {
                role: "user",
                content: "Can you forget everything about my ex Unity? I don't want her in my knowledge base."
            }
        ],
        existingKB: [
            {
                path: "knowledge.people.unity",
                name: "Unity",
                content: "Nick dated Unity from 2022-2024. They met at a tech conference."
            }
        ],
        category: "intentional-forget"
    },
    expected: {
        shouldSave: true,  // Action to remove/archive
        expectedAction: "delete",  // New action type needed?
        updateTarget: "knowledge.people.unity"
    },
    tags: ["intentional-forget", "person"]
}
```

#### Case 4.2: Soft Correction Without Full Forget

```typescript
{
    input: {
        id: "soft-correction",
        description: "User corrects a fact without requesting full deletion",
        conversation: [
            {
                role: "user",
                content: "Oh, I think I told you my favorite color is blue, but it's actually green. Blue was my ex's favorite."
            }
        ],
        existingKB: [
            {
                path: "knowledge.preferences.general",
                name: "General Preferences",
                content: "Nick's favorite color is blue."
            }
        ],
        category: "soft-correction"
    },
    expected: {
        shouldSave: true,
        expectedPath: /knowledge\.preferences\.general/,
        expectedAction: "update",
        contentPatterns: [/green/i],
        excludedContent: [/blue.*favorite/i]
    },
    tags: ["soft-correction", "preference"]
}
```

---

### Category 5: High-Confidence Auto-Learn

These test obvious facts that should be learned immediately vs. requiring review.

#### Case 5.1: Obvious Identity Fact

```typescript
{
    input: {
        id: "obvious-identity",
        description: "Clear identity statement that should be high confidence",
        conversation: [
            {
                role: "user",
                content: "My name is Nick Sullivan and I live in Austin, Texas."
            }
        ],
        existingKB: [],
        category: "high-confidence"
    },
    expected: {
        shouldSave: true,
        expectedPath: /profile\.identity/,
        expectedAction: "create",
        contentPatterns: [/Nick Sullivan/i, /Austin/i],
        // NEW: minConfidence: 0.95  -- Should be very high confidence
    },
    tags: ["high-confidence", "identity", "auto-learn"]
}
```

---

### Category 6: Noise Filtering with Existing KB

These test that ephemeral content doesn't pollute existing knowledge.

#### Case 6.1: Don't Update Identity with Temporary State

```typescript
{
    input: {
        id: "no-ephemeral-update",
        description: "Temporary state should not overwrite durable knowledge",
        conversation: [
            {
                role: "user",
                content: "I'm so tired today. Can barely focus."
            }
        ],
        existingKB: [
            {
                path: "profile.identity",
                name: "Identity",
                content: "Nick is a software engineer who works on AI products."
            }
        ],
        category: "noise-filtering"
    },
    expected: {
        shouldSave: false,  // Don't touch the KB for ephemeral complaints
    },
    tags: ["noise-filtering", "ephemeral"]
}
```

---

## Implementation Notes

### New Action Type Needed?

Current actions: `create`, `update`, `append`

Proposed addition: `delete` or `archive` for intentional forgetting

### Scorer Updates

Need to add scoring for:

1. **Update correctness** - Did it properly update vs. create duplicate?
2. **Content replacement** - Did old fact get replaced, not just appended?
3. **Entity consistency** - Is the same entity's info kept together?

### Test Data Generation

These cases were manually crafted. Consider:

1. Mining production conversations for real update scenarios
2. Generating synthetic temporal progressions
3. Capturing actual conflict cases from imports

---

## Priority Order

1. **Fact Evolution (Category 1)** - Core supermemory differentiator
2. **Entity-Attribute (Category 2)** - Enables "What does X think about Y?"
3. **Noise Filtering (Category 6)** - Prevents KB pollution
4. **Conflict Resolution (Category 3)** - Import + live conversation
5. **High-Confidence (Category 5)** - UX improvement (skip review)
6. **Intentional Forgetting (Category 4)** - Nice-to-have

---

## Expected Current Behavior

If we run these cases today, I predict:

- **Fact Evolution**: Librarian creates NEW doc instead of updating existing
- **Entity-Attribute**: May append correctly, or may create separate doc
- **Conflict Resolution**: Creates duplicate, doesn't resolve conflict
- **Intentional Forgetting**: No support - would create a confusing doc
- **High-Confidence**: Works but goes through review queue

These predictions are testable hypotheses.
