# Conversation Branching

The ability to fork conversations, explore alternative paths, and manage conversation
trees. Move beyond linear chat into multi-dimensional dialogue.

## The Vision

### Underlying Need

**Thinking is not linear.**

When we explore complex problems, we naturally branch: "What if we tried it this way
instead?" We consider alternatives, backtrack, pursue tangents, and compare approaches.
Linear chat forces our non-linear thinking into a single thread, losing the richness of
divergent exploration.

The underlying need is not "conversation history management" - it's **thinking in
parallel without losing threads**. It's being able to say "let me explore both paths"
without starting over, without losing context, without the cognitive load of tracking
where each exploration came from.

### The Ideal

The ideal conversation interface is a **thinking canvas** where:

- We branch naturally - "let's try another approach" creates a fork without ceremony
- We see where we are in the conversation tree - not lost in linear scroll
- We compare branches side by side - not switching back and forth mentally
- We merge insights from different paths - cherry-picking the best from each exploration
- We rewind to any point - continuing from exactly that context, as if the later
  messages never existed
- The structure is invisible until we need it - no cognitive overhead for simple linear
  chats
- Branches feel like "thinking in public" - the tree IS the thought process, not a
  history management feature

The user feels: "I can think the way I naturally think. Carmenta keeps track of where
I've been."

### Core Insight

**Current interfaces treat branching as history management. The ideal treats it as
thought exploration.**

The distinction: History management is about going back to fix mistakes or try again.
Thought exploration is about expanding the space of possibilities without commitment.

Git solved this for code: branches aren't about undoing mistakes, they're about parallel
development. Conversation branching should feel the same way - not "let me try that
prompt again" but "let me explore both directions simultaneously."

The reframe: Conversations are trees, not timelines. The UI should reflect thinking
topology, not message chronology.

---

## The Landscape

### Current State of the Art

**ChatGPT (September 2025 - branching feature)**

- "Branch in new chat" action from any message
- Creates a copy of context up to that point in a new conversation
- No visual tree - branches become separate top-level conversations
- No merge capability
- No side-by-side comparison
- Limitation: Branches are organizationally disconnected from parent

**assistant-ui (Open Source Component Library)**

- `BranchPickerPrimitive` component for navigating branches
- `MessageRepository` class manages tree structure with parent/child relationships
- Branches created automatically when user edits message or reloads assistant response
- Navigation: "< 1/3 >" style picker between branches at each fork point
- Export/import of entire tree structure
- Limitation: UI is linear with branch navigation; no visual tree view

**LobeChat (Open Source Platform)**

- Sophisticated `conversation-flow` package with tree transformation
- `BranchResolver` determines active branch from metadata or inference
- `ContextTreeBuilder` transforms tree into linear display
- Compare mode: Side-by-side responses from different models
- Branch metadata: `activeBranchIndex` tracks which fork is current
- Limitation: Still fundamentally linear display with branch switching

**TalkTree (Dedicated Product)**

- Each message is a clickable node in visual tree
- Visual tree display alongside conversation
- "Rewind & Resume" - jump to any message and continue
- Labels and favorites for branch organization
- Limitation: Niche product, less polished than major platforms

**aiTree (Chrome Extension)**

- Chrome extension for ChatGPT
- "Semantic branching" - auto-creates branch on topic shift
- Visual tree overlay on ChatGPT interface
- Limitation: External tool, not native integration

**tldraw Branching Chat (Starter Kit)**

- Infinite canvas with chat nodes
- Visual connections between messages
- Context-aware message handling across connections
- Built on tldraw's drawing canvas
- Limitation: More for conversation design than actual AI chat

### Architectural Patterns

**Tree Data Structures**

assistant-ui's `MessageRepository` (most production-ready):

- Messages stored in Map with parent/child pointers
- `RepositoryMessage`: `{ prev, current, next, children, level }`
- Methods: `addOrUpdateMessage`, `getBranches`, `switchToBranch`, `resetHead`
- Tracks active branch via `next` pointer at each node
- Export format: `{ headId, messages: [{ message, parentId }] }`

LobeChat's approach:

- Messages stored flat with `parentId` relationship
- `BranchResolver` determines active path from metadata
- `ContextTreeBuilder` transforms tree to linear array for rendering
- Supports "compare mode" for side-by-side responses

**Branch Creation Triggers**

Common patterns across implementations:

1. **Message edit** - Editing user message creates branch
2. **Response regenerate** - Reloading assistant response creates sibling branch
3. **Explicit action** - "Fork" or "Branch" button
4. **Topic shift** (aiTree only) - Automatic semantic detection

**Navigation UI Patterns**

1. **Branch picker** (ChatGPT, assistant-ui): `< 1/3 >` controls on each message
2. **Tree visualization** (TalkTree, aiTree): Visual tree alongside or overlaid
3. **Compare columns** (LobeChat): Side-by-side response comparison
4. **Canvas nodes** (tldraw): Free-form visual connection

### What's Missing in Current Solutions

1. **No visual tree in mainstream products** - All major platforms (ChatGPT, Claude,
   Gemini) use linear display with branch pickers, not visual trees

2. **No merge capability anywhere** - Git's killer feature (merge branches) doesn't
   exist in any AI chat interface

3. **No cross-branch insights** - Can't easily say "take the best parts from branch A
   and B"

4. **Branches are isolated** - Once branched, conversations feel like separate threads
   rather than related explorations

5. **No collaborative branching** - Multi-user branch exploration doesn't exist

6. **No semantic understanding of branches** - Systems don't understand WHY a branch
   exists (alternative approach vs. tangent vs. correction)

---

## Gap Assessment

### Achievable Now

**Core branching infrastructure**:

- Tree data structure (follow assistant-ui's `MessageRepository` pattern)
- Branch on edit/regenerate/explicit action
- Branch picker navigation (`< 1/3 >` controls)
- Persist branches with parent/child relationships
- Switch between branches maintaining context

**Compare mode**:

- Side-by-side responses for same prompt with different models/settings
- Manual selection of "active" branch to continue

**Rewind capability**:

- "Continue from here" on any message
- Clear descendants when rewinding (or create branch)

**Visual tree (basic)**:

- Collapsible tree view in sidebar
- Click to navigate to any point
- Highlight current path

### Emerging (6-12 months)

**Smart branch suggestions**:

- Detect when user might want to branch ("alternatively..." "or maybe...")
- Suggest branching when response seems off-track
- Auto-label branches by topic/intent

**Compare and contrast tool**:

- AI-generated comparison of branch outcomes
- "What's different between these approaches?"
- Synthesis across branches

**Branch annotations**:

- Labels and notes on branches
- Success/failure markers
- "This worked" / "Dead end" indicators

### Aspirational

**Merge branches**:

- Cherry-pick insights from multiple branches
- Synthesize learnings into new starting point
- True git-like merge with conflict resolution

**Collaborative branching**:

- Multiple people exploring different branches
- Real-time visibility of others' explorations
- Merge insights from team exploration

**Semantic branch understanding**:

- Carmenta understands the relationship between branches
- "This branch is trying a different approach"
- "This branch is a refinement of that one"
- Navigate by intent, not just by tree position

**Thought topology visualization**:

- Not just tree structure but concept relationships
- Visual density indicates exploration depth
- Paths light up based on relevance to current question

---

## Implementation Path

### Table Stakes

What we must have to ship:

1. **Data model**: Messages store `parentId`, tree built from relationships
2. **Branch creation**: Edit user message or regenerate response creates branch
3. **Branch navigation**: Simple `< 1/3 >` picker at fork points
4. **Active path tracking**: Know which branch is "current"
5. **Persistence**: Branches survive page refresh, sync across devices
6. **API context**: When generating, include only messages on active path

### Leader

What differentiates us:

1. **Visual tree sidebar**: See conversation structure at a glance
2. **Compare mode**: Side-by-side responses for same prompt
3. **Rewind to any point**: "Continue from here" creates clean break
4. **Branch labels**: Name branches for organization
5. **Quick switch**: Keyboard shortcuts for branch navigation
6. **Export branches**: Share specific exploration paths

### Vision

What makes users say "exactly what I wanted":

1. **Invisible until needed**: Linear chats feel linear; branches appear when relevant
2. **Natural language branching**: "Let's try a different approach" creates branch
3. **Compare and synthesize**: AI helps merge insights across branches
4. **Thought canvas**: Visual exploration that mirrors mental model
5. **Branch as first-class context**: "Remember what we learned in the other branch"

---

## Architecture Decisions

### Data Model

Follow assistant-ui pattern with enhancements:

```typescript
// Core message structure
interface Message {
  id: string;
  parentId: string | null; // null for root messages
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  metadata: {
    activeBranchIndex?: number; // Which child branch is active (for user messages)
    branchLabel?: string; // Optional human-readable name
    branchIntent?: string; // Why this branch exists
  };
  createdAt: Date;
  updatedAt: Date;
}

// Conversation tracks current head
interface Conversation {
  id: string;
  headId: string | null; // Current position in tree
  title: string;
  // ... other metadata
}
```

### Tree Operations

```typescript
// Repository manages tree structure
class ConversationTree {
  // Core operations
  addMessage(parentId: string | null, message: Message): void;
  editMessage(messageId: string, newContent: string): string; // Returns new branch message ID
  regenerateResponse(messageId: string): string; // Creates sibling branch

  // Navigation
  getBranches(messageId: string): string[]; // Sibling message IDs
  switchToBranch(messageId: string): void; // Updates active path
  getActivePath(): Message[]; // Messages from root to head

  // Rewinding
  rewindTo(messageId: string, mode: "branch" | "delete"): void;

  // Comparison
  getBranchesForComparison(messageId: string): Message[][]; // Parallel paths
}
```

### UI Components

```typescript
// Branch picker on each message
<BranchPicker messageId={id} />
// Renders: < 1/3 > when branches exist

// Tree view in sidebar
<ConversationTree conversationId={id} />
// Renders: Collapsible tree with current path highlighted

// Compare mode
<BranchCompare parentId={id} />
// Renders: Side-by-side branch content
```

### Context Compilation

When generating responses, include only active path:

```typescript
async function compileContext(conversation: Conversation): Promise<Message[]> {
  const tree = new ConversationTree(conversation);
  const activePath = tree.getActivePath();

  // Only messages on the active path go to the LLM
  return activePath.map((msg) => ({
    role: msg.role,
    content: msg.content,
    // ... tool calls, etc.
  }));
}
```

---

## Integration Points

- **Conversations**: Branching is core to conversation data model
- **Memory**: Branches may contain learnings worth extracting
- **Interface**: Tree view component, branch picker, compare mode
- **Concierge**: Must understand which branch is active for context
- **Sharing**: May want to share specific branches, not entire tree

---

## Success Criteria

**Functional**:

- Branch creation feels instant and natural
- Navigation between branches is intuitive
- Context is correct for whichever branch we're on
- Tree structure persists reliably

**Quality**:

- No cognitive overhead for simple linear conversations
- Visual tree helps rather than overwhelms
- Comparing branches yields useful insights
- Branching feels like "exploring" not "organizing"

**Scale**:

- Deep trees (50+ branches) remain performant
- Wide trees (many siblings) are navigable
- Large conversations don't degrade branch switching

---

## Research Sources

### Competitor Analysis

- [ChatGPT Branching Feature](https://dev.to/alifar/chatgpt-branch-conversations-nonlinear-prompting-for-developers-1an9) -
  Implementation details (September 2025)
- [Shape of AI: Branches Pattern](https://www.shapeof.ai/patterns/branches) - UX design
  patterns
- [assistant-ui Branching Guide](https://www.assistant-ui.com/docs/guides/Branching) -
  Component API
- [LobeChat Branching Docs](https://lobehub.com/it/docs/usage/features/branching-conversations) -
  Feature overview

### Implementations Analyzed

- `assistant-ui/packages/react/src/legacy-runtime/runtime-cores/utils/MessageRepository.tsx` -
  Tree data structure
- `lobe-chat/packages/conversation-flow/src/transformation/BranchResolver.ts` - Branch
  resolution logic
- `lobe-chat/packages/conversation-flow/src/transformation/ContextTreeBuilder.ts` - Tree
  to linear transformation
- [tldraw Branching Chat Starter Kit](https://tldraw.dev/starter-kits/branching-chat) -
  Visual canvas approach

### Products

- [TalkTree](https://www.talktree.ai/features) - Dedicated branching chat product
- [aiTree Chrome Extension](https://aitree.app/) - ChatGPT tree visualization overlay
- [ChatTree GitHub](https://github.com/cuizhenzhi/ChatTree) - Open source tree
  visualization

---

**Status**: Researched, ready for implementation planning

**Core Insight**: Branching is not history management - it's thought exploration. The
tree structure should feel like thinking out loud, not organizing files.
