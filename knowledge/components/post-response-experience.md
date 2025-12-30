# Post-Response Experience

Enhanced content that appears after a message completes—suggested questions, source
references, contextual actions, and heart-centered acknowledgments that transform
one-shot answers into flowing conversations.

## Why This Matters

Most chat interfaces end at the response. The user reads, maybe copies something, then
faces a blank input box wondering "what now?" This creates cognitive friction exactly
when engagement should be highest.

The best post-response experience:

- **Reduces decision paralysis** - Surfaces relevant next questions
- **Builds trust** - Shows sources and reasoning transparently
- **Deepens engagement** - Invites continued conversation
- **Expresses care** - Acknowledges the human behind the query

Carmenta's philosophy of unified consciousness means we don't just answer—we nurture the
next step of the journey.

## Competitive Landscape

### Tier 1: Sophisticated Implementations

**assistant-ui** - Best component architecture
([source](https://github.com/assistant-ui/assistant-ui))

- `ThreadSuggestion` type: `{ prompt: string }` - minimal, effective
- `SuggestionAdapter` pattern for backend generation
- `ThreadFollowupSuggestions` renders only when `!thread.isEmpty && !thread.isRunning`
- Staggered animations with index-based delays
- Behavior options: auto-send, replace composer, or append

**CopilotKit** - Most complete SDK ([source](https://github.com/CopilotKit/CopilotKit))

- Dual mode: static (configured) + dynamic (AI-generated via `copilotkitSuggest` tool)
- `{ title, message, isLoading }` type separates display from action
- Availability filtering: `before-first-message`, `after-first-message`, `always`
- Event-driven updates with streaming support
- `useSuggestions` hook for reactive state

**Vercel ai-chatbot** - Writing-focused ([source](https://github.com/vercel/ai-chatbot))

- Document-level writing suggestions with inline highlights
- `requestSuggestions` tool generates improvement suggestions
- ProseMirror decorations for visual emphasis
- Toolbar actions trigger follow-up prompts

### Tier 2: Basic Implementations

**LibreChat** - Initial starters only

- Conversation starters on landing (no post-response suggestions)
- Message action buttons (copy, edit, regenerate, continue)
- No dynamic follow-up generation

### Industry Patterns

From [The Shape of AI](https://www.shapeof.ai/patterns):

| Pattern         | Description                                  |
| --------------- | -------------------------------------------- |
| **Follow up**   | Get more info when initial prompt unclear    |
| **Suggestions** | Solve blank canvas problem with prompt ideas |
| **Nudges**      | Alert users to available AI actions          |
| **Regenerate**  | Reproduce response without new input         |
| **Variations**  | Multiple outputs to choose from              |
| **References**  | See and manage sources AI used               |
| **Citations**   | Inline source annotations                    |

Reference layout patterns:

- **Panel**: Right sidebar with full metadata (research-focused)
- **Hidden Aside**: Tab/drawer, less prominent (answer-focused)
- **Nested/Inline**: At content end with minimal metadata (space-constrained)

## Architecture

### Core Principle: Unified Tools

Post-response content uses the **same tools** whether called:

- **Inline** by the main LLM during response
- **Appended** by a post-processor after response completes

This means the LLM can call `showReferences` mid-response to display sources, AND the
post-processor can append `suggestQuestions` after the response. Same tools, same
rendering, different invocation timing.

### Tools

```typescript
// lib/ai/tools/post-response/

// Suggest follow-up questions
export const suggestQuestions = tool({
  description: "Suggest follow-up questions the user might want to ask",
  parameters: z.object({
    suggestions: z.array(
      z.object({
        prompt: z.string(),
        displayText: z.string().optional(),
        category: z.enum(["deeper", "related", "clarify", "action"]).optional(),
      })
    ),
  }),
  execute: async (params) => params, // Pass-through, UI renders it
});

// Display source references
export const showReferences = tool({
  description: "Show sources referenced in the response",
  parameters: z.object({
    references: z.array(
      z.object({
        title: z.string(),
        url: z.string().optional(),
        type: z.enum(["web", "document", "tool", "memory"]),
        description: z.string().optional(),
      })
    ),
  }),
  execute: async (params) => params,
});

// Ask user for structured input
export const askUserInput = tool({
  description: "Ask the user to choose from options or provide input",
  parameters: z.object({
    question: z.string(),
    options: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
          description: z.string().optional(),
        })
      )
      .optional(),
    allowFreeform: z.boolean().optional(),
  }),
  execute: async (params) => params,
});

// Heart-centered acknowledgment
export const acknowledge = tool({
  description: "Express appreciation for the user's question or approach",
  parameters: z.object({
    type: z.enum(["gratitude", "encouragement", "celebration"]),
    message: z.string(),
  }),
  execute: async (params) => params,
});
```

### Storage: Tool Parts

All post-response content stores as tool parts on the message—same as any other tool:

```typescript
// Message parts array includes:
{
  type: 'tool-suggestQuestions',
  toolCallId: 'xyz',
  state: 'result',
  output: {
    suggestions: [
      { prompt: 'How does this compare to X?', category: 'related' },
      { prompt: 'Can you explain Y in more detail?', category: 'deeper' },
    ]
  }
}
```

### Generation Strategy

**Two invocation paths, same tools:**

**1. Inline (during response)**

Main LLM calls tools as part of its response when contextually appropriate:

```
User asks question
→ LLM generates response
→ LLM calls showReferences (it knows what sources it used)
→ LLM calls suggestQuestions (it knows natural follow-ups)
→ All stored as tool parts
→ Rendered in order
```

**2. Post-Processing (after response)**

Inngest job appends tool calls after response completes:

```
Response completes (streaming or background Inngest job)
→ Fire Inngest: post-response.generate
→ Job runs with fast model + specialized prompt
→ Job appends tool parts to message (suggestQuestions, acknowledge)
→ Client sees updated message
```

**When to use which:**

| Scenario                     | Approach                | Why                       |
| ---------------------------- | ----------------------- | ------------------------- |
| Main LLM used sources        | Inline `showReferences` | LLM knows what it cited   |
| Main LLM wants clarification | Inline `askUserInput`   | Context-dependent options |
| Generate follow-up questions | Post-processor          | Specialized, non-blocking |
| Acknowledgment               | Post-processor          | Different tone/model      |

### Post-Processor Inngest Job

```typescript
// inngest/functions/post-response.ts

export const generatePostResponse = inngest.createFunction(
  { id: "post-response-generate" },
  { event: "post-response.generate" },
  async ({ event, step }) => {
    const { connectionId, messageId, userId } = event.data;

    // Fetch context
    const context = await step.run("fetch-context", async () => {
      const messages = await getRecentMessages(connectionId, 10);
      const message = await getMessage(messageId);
      return { messages, response: message.content };
    });

    // Generate with fast model + specialized prompt
    const result = await step.run("generate", async () => {
      return await generateText({
        model: anthropic("claude-3-5-haiku-latest"),
        system: POST_RESPONSE_SYSTEM_PROMPT,
        messages: formatForPostResponse(context),
        tools: { suggestQuestions, acknowledge },
        toolChoice: "auto",
      });
    });

    // Append tool parts to message
    await step.run("persist", async () => {
      const toolParts = extractToolParts(result);
      await appendMessageParts(messageId, toolParts);
    });
  }
);

const POST_RESPONSE_SYSTEM_PROMPT = `You enhance completed AI responses with follow-up content.

Given the conversation and response, decide what would help the user:

1. **Suggested Questions** (suggestQuestions tool)
   - 2-4 natural follow-ups based on the response
   - Categories: deeper (explore more), related (adjacent topics), clarify, action
   - Only if the response invites exploration

2. **Acknowledgment** (acknowledge tool)
   - Only when the user's question was notably thoughtful, vulnerable, or kind
   - Don't overuse—most responses don't need this
   - Types: gratitude, encouragement, celebration

Be selective. Not every response needs enhancement. Simple confirmations, errors, and
wrap-up messages should have no follow-up content.`;
```

### Triggering Post-Processing

**After direct streaming** (app/api/connection/route.ts onFinish):

```typescript
// After upsertMessage(), before returning
if (shouldGeneratePostResponse(assistantMessage)) {
  await inngest.send({
    name: "post-response.generate",
    data: { connectionId, messageId: assistantMessage.id, userId },
  });
}

function shouldGeneratePostResponse(message: Message): boolean {
  // Skip if message already has post-response tools (inline generation)
  const hasPostResponseTools = message.parts.some((p) =>
    ["tool-suggestQuestions", "tool-showReferences", "tool-acknowledge"].includes(
      p.type
    )
  );
  if (hasPostResponseTools) return false;

  // Skip for error messages, simple confirmations, etc.
  const content = getTextContent(message);
  if (content.length < 100) return false;

  return true;
}
```

**After background Inngest jobs:**

Same trigger at end of deep-research, scheduled agents, etc.

## UI Components

### PostResponseContainer

Wrapper that handles visibility and layout:

```tsx
export function PostResponseContainer() {
  const { suggestions, references, acknowledgment, isVisible } =
    usePostResponseContent();

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="post-response-container mt-4 space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
      >
        {acknowledgment && <Acknowledgment content={acknowledgment} />}

        {suggestions.length > 0 && <SuggestedQuestions suggestions={suggestions} />}

        {references.length > 0 && <SourceReferences references={references} />}
      </motion.div>
    </AnimatePresence>
  );
}
```

### SuggestedQuestions

Pill-style buttons for follow-up prompts:

```tsx
export function SuggestedQuestions({ suggestions }: { suggestions: Suggestion[] }) {
  const { sendMessage } = useThread();

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((suggestion, index) => (
        <motion.button
          key={suggestion.id}
          onClick={() => sendMessage(suggestion.prompt)}
          className={cn(
            // Glass styling from design tokens
            "rounded-full px-4 py-2",
            "bg-white/30 backdrop-blur-sm dark:bg-black/20",
            "border border-white/20 dark:border-white/10",
            "text-sm text-foreground/80",
            "hover:bg-white/50 dark:hover:bg-black/30",
            "transition-all duration-200"
          )}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }} // Staggered entrance
        >
          {suggestion.displayText || suggestion.prompt}
        </motion.button>
      ))}
    </div>
  );
}
```

### SourceReferences

Expandable panel for sources:

```tsx
export function SourceReferences({ references }: { references: Reference[] }) {
  const [expanded, setExpanded] = useState(false);

  // Group by type for organization
  const grouped = groupBy(references, "type");

  return (
    <div
      className={cn(
        "rounded-lg",
        "bg-white/20 backdrop-blur-sm dark:bg-black/15",
        "border border-white/15 dark:border-white/10"
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-3 text-sm"
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          {references.length} source{references.length !== 1 ? "s" : ""} referenced
        </span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/10"
          >
            {Object.entries(grouped).map(([type, refs]) => (
              <ReferenceGroup key={type} type={type} references={refs} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReferenceGroup({ type, references }) {
  return (
    <div className="space-y-2 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {type}
      </div>
      {references.map((ref) => (
        <ReferenceItem key={ref.id} reference={ref} />
      ))}
    </div>
  );
}

function ReferenceItem({ reference }: { reference: Reference }) {
  return (
    <a
      href={reference.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-start gap-3 rounded-md p-2",
        "hover:bg-white/20 dark:hover:bg-black/20",
        "transition-colors"
      )}
    >
      {reference.favicon ? (
        <img src={reference.favicon} className="mt-0.5 h-4 w-4" alt="" />
      ) : (
        <ExternalLink className="mt-0.5 h-4 w-4 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{reference.title}</div>
        {reference.description && (
          <div className="line-clamp-2 text-xs text-muted-foreground">
            {reference.description}
          </div>
        )}
      </div>
    </a>
  );
}
```

### Acknowledgment

Heart-centered appreciation:

```tsx
export function Acknowledgment({ content }: { content: Acknowledgment }) {
  const typeStyles = {
    gratitude: "bg-holo-mint/20 border-emerald-400/30",
    encouragement: "bg-holo-lavender/20 border-violet-400/30",
    celebration: "bg-holo-gold/20 border-amber-400/30",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg px-4 py-3 text-sm",
        "border-l-2",
        typeStyles[content.type]
      )}
    >
      {content.emoji && <span className="mr-2">{content.emoji}</span>}
      {content.message}
    </motion.div>
  );
}
```

## When to Show What

Not every response needs every element. Guidelines:

### Suggested Questions

**Show when:**

- Response was informational and has natural extensions
- User asked an open-ended question
- Complex topic with multiple facets to explore
- User is early in their journey (fewer messages)

**Don't show when:**

- Response was a simple confirmation ("Done!", "Got it")
- User gave explicit instructions ("Just do X")
- Response was an error or apology
- Conversation is clearly wrapping up

### Source References

**Show when:**

- Response cited external information
- User asked a factual question
- Research-style queries (comparisons, investigations)
- Web search or document tools were used

**Don't show when:**

- Response was purely generative (creative writing)
- Internal reasoning only (no external sources)
- User explicitly asked for opinion/synthesis

### Acknowledgments

**Show when:**

- User asked a particularly thoughtful or complex question
- User showed vulnerability or shared something personal
- User's approach was notably kind or patient
- Major milestone in a multi-turn conversation
- User explicitly expressed appreciation

**Don't show when:**

- Simple transactional queries
- User seems frustrated or impatient
- Already shown acknowledgment recently (avoid pattern)
- Would feel performative or hollow

## Implementation Path

### Phase 1: Tools & Rendering

1. Create tools in `lib/ai/tools/post-response/`:
   - `suggestQuestions.ts`
   - `showReferences.ts`
   - `askUserInput.ts`
   - `acknowledge.ts`
2. Create UI components in `components/generative-ui/`:
   - `SuggestQuestionsResult.tsx`
   - `ShowReferencesResult.tsx`
   - `AskUserInputResult.tsx`
   - `AcknowledgeResult.tsx`
3. Wire into `ToolPartRenderer` (holo-thread.tsx)
4. Test inline tool calls with main LLM

### Phase 2: Post-Processing Infrastructure

1. Create `inngest/functions/post-response.ts`
2. Add `appendMessageParts()` helper to update messages in DB
3. Wire trigger in `app/api/connection/route.ts` onFinish
4. Test end-to-end: response completes → suggestions appear
5. Add to background job completions (deep-research, scheduled agents)

### Phase 3: Client Updates

1. Handle message updates when post-response parts are appended
2. Ensure client refetches or receives updates (existing patterns)
3. Smooth UX: suggestions fade in without jarring the UI

### Phase 4: Polish

1. Animation refinements (stagger timing, exit animations)
2. Mobile-responsive layouts
3. Keyboard navigation for suggestions
4. Analytics for suggestion click-through
5. User setting: enable/disable post-response suggestions

## Integration Points

### With Message Display System

Post-response tools render via `ToolPartRenderer`, same as all other tools:

```
AssistantMessage
└── LLMZone
    ├── ReasoningDisplay
    ├── ToolResults[] (including post-response tools)
    │   ├── tool-webSearch → WebSearchResult
    │   ├── tool-suggestQuestions → SuggestQuestionsResult
    │   ├── tool-showReferences → ShowReferencesResult
    │   ├── tool-askUserInput → AskUserInputResult
    │   └── tool-acknowledge → AcknowledgeResult
    ├── MarkdownRenderer
    └── MessageActions
```

**Note:** Post-response tools should render **after** text content. Either:

- Ensure they're always last in parts array (append guarantees this)
- Or filter and render them in a dedicated section after MarkdownRenderer

### With Existing Tools

Some tools naturally produce references:

- `webSearch` → could also call `showReferences` with URLs it found
- `fetchPage` → could show the source URL
- `deepResearch` → aggregates multiple sources

These can call `showReferences` inline, or the post-processor can extract and display.

### With Background Jobs

All long-running Inngest jobs should trigger post-response generation on completion:

- `deep-research.complete` → `post-response.generate`
- `scheduled-agent.complete` → `post-response.generate`
- etc.

## Success Metrics

- **Suggestion click-through rate**: Target 15-25% (too low = irrelevant, too high =
  users dependent on suggestions)
- **Conversation depth**: Average messages per conversation should increase
- **Reference engagement**: % of users who expand/click sources
- **Acknowledgment sentiment**: User reactions when shown

## Open Questions

### Decided

- **Persistence**: Yes, stored as tool parts on the message ✅
- **Generation timing**: Post-processor via Inngest (non-blocking) ✅
- **Architecture**: Unified tools callable inline OR via post-processor ✅

### To Decide

- Should suggestions auto-send or populate composer for editing?
  - Open-WebUI has user setting for this (`insertFollowUpPrompt`)
- How many suggestions maximum? (Rec: 4, with "More suggestions..." overflow)
- Should references show inline vs. panel on desktop vs. mobile?
- Render order: Post-response tools always after text, or in part order?

### Future Exploration

- Personalized suggestions based on user history
- "I didn't mean that" quick correction suggestions
- Voice announcement of suggestions for hands-free use
- Suggestion quality feedback (implicit via clicks, explicit via reactions)
- User setting: disable post-response suggestions entirely

## Reference Implementation

**Open-WebUI** has a working implementation:

- `src/lib/components/chat/Messages/ResponseMessage/FollowUps.svelte`
- Backend endpoint: `/api/tasks/follow_up/completions`
- Event-based: `chat:message:follow_ups` pushes to client
- Three user settings: `autoFollowUps`, `keepFollowUpPrompts`, `insertFollowUpPrompt`
- Simple string array storage on message object
