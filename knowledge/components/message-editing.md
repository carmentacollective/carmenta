# Message Editing

The ability to edit sent messages in an AI chat interface and how that affects
conversation flow, branching, and context management.

## The Vision

### Underlying Need

**Thinking is iterative, not final.**

When we communicate, we frequently refine what we meant. We realize mid-sentence that we
should have framed the question differently. We get a response and think "that's not
what I meant." The friction of re-explaining, re-establishing context, and losing the
thread of exploration makes AI chat feel more like form-filling than conversation.

The underlying need is not "message editing" - it's **the freedom to think out loud
without penalty**. It's being able to say "let me try that again" without the cognitive
burden of reconstructing context. It's the difference between a conversation where every
word is permanent and a whiteboard where we can erase and try again.

### The Ideal

The ideal editing experience is **conversational refinement** where:

- We edit naturally - click, type, send - without ceremony or confirmation dialogs
- We choose what happens next - continue from the edit, or explore both paths
- Editing feels like refining thought, not correcting mistakes
- We can edit any message, not just the last one - mid-conversation refinements are
  common
- Attachments and context travel with the edit - we don't lose file references
- The original is available if we want it - nothing is truly lost
- Editing assistant responses makes sense too - "say it differently" is valid feedback
- The cost is transparent - we understand when edits trigger new API calls vs. just
  update display

The user feels: "I can think out loud. Carmenta helps me refine, not penalizes
imprecision."

### Core Insight

**Current interfaces treat editing as error correction. The ideal treats it as thought
refinement.**

The distinction: Error correction implies the original was wrong and should be replaced.
Thought refinement implies we're evolving understanding together - the original was a
step in the process, not a mistake.

This connects deeply to conversation branching. Editing is the primary mechanism that
creates branches. But current UIs hide this relationship - you edit a message and
suddenly there's a `< 1/2 >` picker that many users don't understand. The edit-branch
connection should be explicit: "We're exploring a different direction from here."

The reframe: Editing is forking, not fixing. Make the relationship visible and the power
becomes obvious.

---

## The Landscape

### Current State of the Art

**ChatGPT (2024-2025)**

- Edit any user message via pencil icon
- Editing deletes all subsequent messages and regenerates from that point
- September 2025: Added "Branch in new chat" option - copies context to new conversation
- No way to edit AND preserve the original path
- Limitation: Destructive by default - original thread lost unless you explicitly branch

**Claude.ai**

- Edit via pencil icon on user messages
- Creates branch with `< 1/N >` picker navigation
- Can switch between original and edited versions
- Preserves both paths
- Limitation: Branch picker UI is subtle - users often don't realize they're branching

**Gemini**

- "Modify response" feature - adjust AI's response inline
- Can regenerate responses with new parameters
- Limited user message editing
- Limitation: More focused on response modification than message editing

**Vercel AI Chatbot (Open Source)**

- MessageEditor component with inline textarea
- Deletes trailing messages on edit (`deleteTrailingMessages`)
- Updates message content, then regenerates
- Clean implementation but destructive (no branching)
- Source: `/Users/nick/src/reference/ai-chatbot/components/message-editor.tsx`

**assistant-ui (Component Library)**

- `ActionBarPrimitive.Edit` triggers edit mode
- `DefaultEditComposerRuntimeCore` manages edit state
- Edit submits as new message with same parentId (creates branch)
- Preserves non-text parts (attachments)
- Tree structure via `MessageRepository` handles branches automatically
- Most sophisticated implementation
- Sources:
  - `/Users/nick/src/reference/assistant-ui/packages/react/src/primitives/actionBar/ActionBarEdit.tsx`
  - `/Users/nick/src/reference/assistant-ui/packages/react/src/legacy-runtime/runtime-cores/composer/DefaultEditComposerRuntimeCore.tsx`
  - `/Users/nick/src/reference/assistant-ui/packages/react/src/legacy-runtime/runtime-cores/utils/MessageRepository.tsx`

### Architectural Patterns

**Edit Mode States**

Common pattern across implementations:

```typescript
type MessageMode = "view" | "edit";

// Per-message state tracking
const [mode, setMode] = useState<MessageMode>("view");
```

**Edit Triggers**

1. **Pencil icon** - Most common, appears on hover or always
2. **Double-click** - Less common, feels natural but not discoverable
3. **Keyboard shortcut** - Power user feature (e.g., 'e' on focused message)

**Edit Completion Behaviors**

Three patterns exist:

1. **Destructive edit** (Vercel, old ChatGPT): Delete trailing messages, regenerate
2. **Branching edit** (Claude, assistant-ui): Create new branch, preserve original
3. **In-place edit** (not common): Just update text, no regeneration

**Tree Data Structure**

assistant-ui's `MessageRepository` pattern (production-ready):

```typescript
type RepositoryMessage = {
  prev: RepositoryMessage | null; // Parent message
  current: ThreadMessage; // Message content
  next: RepositoryMessage | null; // Active child
  children: string[]; // All child message IDs
  level: number; // Depth in tree
};

// Edit creates sibling: new message with same parentId
// Branches are children of same parent
```

**Edit Composer Pattern**

assistant-ui approach - separate composer for edit mode:

```typescript
class DefaultEditComposerRuntimeCore extends BaseComposerRuntimeCore {
  constructor(
    private runtime: ThreadRuntimeCore,
    private endEditCallback: () => void,
    { parentId, message }: { parentId: string | null; message: ThreadMessage }
  ) {
    this._parentId = parentId;
    this._sourceId = message.id;
    this._previousText = getThreadMessageText(message);
    this.setText(this._previousText);
    // Preserve non-text parts (attachments)
    this._nonTextParts = message.content.filter((part) => part.type !== "text");
  }

  async handleSend(message: Omit<AppendMessage, "parentId" | "sourceId">) {
    if (text !== this._previousText) {
      // Only create new message if content changed
      this.runtime.append({
        ...message,
        content: [...message.content, ...this._nonTextParts],
        parentId: this._parentId,
        sourceId: this._sourceId,
      });
    }
    this.handleCancel();
  }
}
```

### What's Missing in Current Solutions

1. **No clarity on edit-branch relationship** - Users don't understand that editing
   creates branches

2. **No choice on edit behavior** - Can't choose between "replace" and "branch" in the
   moment

3. **No assistant message editing** - Can't ask the AI to rephrase its response in-place

4. **No partial edits** - Can't edit a portion of a message, only full replacement

5. **No edit previews** - Can't see what regeneration will look like before committing

6. **No edit history** - Can't see how a message evolved through edits

7. **No collaborative editing** - In multi-user scenarios, who can edit whose messages?

---

## Gap Assessment

### Achievable Now

**Core editing infrastructure**:

- Edit mode toggle per message (view/edit)
- Inline textarea replacing message content
- Cancel and submit actions
- Preserve attachments through edit
- Create branch on edit (new message with same parentId)

**Edit-branch relationship**:

- Visual indication that editing creates a branch
- Branch picker immediately visible after edit
- "You're exploring a new direction" language

**User choice on edit behavior**:

- "Edit and replace" (delete trailing, regenerate)
- "Edit and branch" (preserve original, create parallel path)
- Preference remembered but overridable per-edit

**Keyboard shortcuts**:

- 'e' to edit focused message
- Escape to cancel
- Cmd+Enter to submit

### Emerging (6-12 months)

**Assistant message editing**:

- "Rephrase this" action on assistant messages
- Edits as feedback that improves future responses
- Inline style/tone adjustments ("shorter", "more technical")

**Smart edit suggestions**:

- Detect when response seems off ("this isn't what you meant?")
- Suggest edits based on clarification patterns
- Auto-complete common refinements

**Edit preview**:

- Before committing edit, see predicted response direction
- "If you send this, we'll likely discuss X"
- Lightweight intent prediction

### Aspirational

**Partial message editing**:

- Select portion of message to edit
- Keep surrounding context, refine specific section
- Merge edited portion back into message

**Edit as conversation**:

- Natural language editing: "Actually, make that about TypeScript instead"
- Carmenta understands edit intent without formal edit mode
- Seamless transition between conversation and refinement

**Edit synthesis**:

- After multiple edits, synthesize a better first message
- "Based on this exploration, we could have started with..."
- Learning from edit patterns to improve initial prompts

**Collaborative editing**:

- Multiple users can edit shared conversation
- Edit attribution and conflict resolution
- Real-time edit visibility

---

## Implementation Path

### Table Stakes

What we must have to ship:

1. **Edit action**: Pencil icon on user messages, triggers edit mode
2. **Inline editor**: Textarea with current message content, auto-focus, auto-height
3. **Cancel/Submit**: Clear actions to discard or apply edit
4. **Branching behavior**: Edit creates branch, original preserved
5. **Branch visibility**: Branch picker appears immediately after edit
6. **Attachment preservation**: Non-text parts carry through edit
7. **Keyboard support**: Escape to cancel, Cmd+Enter to submit

### Leader

What differentiates us:

1. **Edit behavior choice**: Toggle or per-edit choice between replace/branch
2. **Clear edit-branch language**: "Exploring a new direction" not just `< 1/2 >`
3. **Regenerate without edit**: Separate action to just try again with same message
4. **Edit any message**: Not just last user message, any in the conversation
5. **Quick edit patterns**: Common refinements as quick actions ("be more specific",
   "add context about...")
6. **Edit indicators**: Visual distinction for edited messages

### Vision

What makes users say "exactly what I wanted":

1. **Conversational editing**: "Actually, I meant..." is understood as edit intent
2. **Edit synthesis**: After exploration, offer refined starting point
3. **Style preservation**: Editing maintains our conversational tone and context
4. **Seamless branching**: Editing and branching feel like the same natural action
5. **Learning from edits**: Common edit patterns inform how we ask clarifying questions

---

## Architecture Decisions

### Edit Mode State Management

Per-message state, not global:

```typescript
interface MessageState {
  mode: "view" | "edit";
  editContent: string;
}

// Zustand store per message, or React state in MessageProvider
// Edit mode is local to each message - multiple edits could theoretically be open
```

### Edit Completion Behavior

Default to branching (Claude pattern), with option:

```typescript
type EditBehavior = "branch" | "replace";

// User preference stored, overridable per-edit
// "branch" creates new message with same parentId
// "replace" deletes trailing messages, updates in-place
```

### Data Model Integration

Leverage conversation branching infrastructure:

```typescript
// Edit is just a special case of append with parentId
async function handleEditSubmit(
  originalMessage: Message,
  newContent: string,
  behavior: EditBehavior
) {
  if (behavior === "branch") {
    // Create sibling message
    await appendMessage({
      parentId: originalMessage.parentId,
      content: newContent,
      attachments: originalMessage.attachments,
    });
    // Switch active branch to new message
  } else {
    // Delete trailing messages
    await deleteMessagesAfter(originalMessage.id);
    // Update message content
    await updateMessage(originalMessage.id, { content: newContent });
    // Regenerate
    await regenerate();
  }
}
```

### UI Components

```typescript
// Edit button in message actions
<MessageActions>
  <EditButton onClick={() => setMode("edit")} />
</MessageActions>

// Inline editor replaces message content
{
  mode === "edit" ? (
    <MessageEditor
      initialContent={message.content}
      onCancel={() => setMode("view")}
      onSubmit={handleEditSubmit}
      attachments={message.attachments}
    />
  ) : (
    <MessageContent content={message.content} />
  );
}
```

---

## Integration Points

- **Conversation Branching**: Editing is the primary branch creation mechanism
- **Message Display**: Edit mode UI replaces message content view
- **Attachments**: Non-text parts preserved through edit
- **Context Management**: Edit behavior affects what context goes to LLM
- **Memory**: Edit patterns may inform memory about user preferences
- **Sharing**: Shared conversations may have edit restrictions

---

## Success Criteria

**Functional**:

- Edit action is discoverable and fast
- Edited content is accurately preserved
- Branching behavior is predictable
- Attachments survive editing
- Keyboard navigation works

**Quality**:

- Edit mode transition feels instant
- No confusion about edit vs. new message
- Branch relationship is clear after edit
- Cancel discards completely, no partial state

**User Experience**:

- Editing feels like refining thought, not correcting error
- Users understand the branch implications
- Power users can edit efficiently (keyboard)
- Novice users can edit safely (clear cancel/submit)

---

## Research Sources

### UX Patterns

- [NNGroup: Prompt Controls in GenAI Chatbots](https://www.nngroup.com/articles/prompt-controls-genai/) -
  Best practices for edit/regenerate
- [Shape of AI: Inline Action Pattern](https://www.shapeof.ai/patterns/inline-action) -
  Inline editing UX patterns

### Implementations Analyzed

- Vercel AI Chatbot:
  `/Users/nick/src/reference/ai-chatbot/components/message-editor.tsx`
- assistant-ui:
  `/Users/nick/src/reference/assistant-ui/packages/react/src/primitives/actionBar/ActionBarEdit.tsx`
- assistant-ui:
  `/Users/nick/src/reference/assistant-ui/packages/react/src/legacy-runtime/runtime-cores/composer/DefaultEditComposerRuntimeCore.tsx`
- assistant-ui:
  `/Users/nick/src/reference/assistant-ui/packages/react/src/legacy-runtime/runtime-cores/utils/MessageRepository.tsx`

### Articles

- [The Hidden Fork: How Editing Messages in ChatGPT Lets You Branch Conversations](https://corner.buka.sh/the-hidden-fork-how-editing-messages-in-chatgpt-lets-you-branch-conversations/) -
  Explaining edit-branch relationship
- [Conversation Branching: The AI Feature Most Executives Don't Know About](https://www.smithstephen.com/p/conversation-branching-the-ai-feature) -
  Business value of branching

---

## Relationship to Conversation Branching

This component is closely related to
[Conversation Branching](./conversation-branching.md). Message editing is the primary
mechanism that creates branches - when a user edits a message, they're forking the
conversation tree.

Key connections:

- **Data model**: Editing uses the same tree structure (parentId relationships)
- **UI**: Branch picker appears after edit
- **Behavior**: Edit behavior choice (branch vs. replace) directly impacts tree
  structure
- **Mental model**: Users should understand that editing = exploring alternative paths

Consider these components together when implementing conversation tree functionality.

---

**Status**: Researched, ready for implementation planning

**Core Insight**: Editing is forking, not fixing. Make the relationship visible and the
power becomes obvious. The goal is thought refinement, not error correction.
