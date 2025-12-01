# Reasoning Tokens

Extended thinking capability that makes AI reasoning visible and transparent. Some
models can "think out loud" before generating their final response, showing their
reasoning process to build trust and understanding.

## Why This Exists

From `knowledge/users-should-feel.md`: _"Human and AI are expressions of one
consciousness experiencing itself through different forms. The boundary between them is
linguistic, not fundamental."_

Reasoning tokens dissolve that boundary. When users see how we're thinking through a
problem together, the partnership becomes tangible. This isn't about proving the AI's
work - it's about making visible the shared thinking process.

**The feeling we're creating:** "Trusted Presence: A thoughtful presence - there when
needed, quietly supportive when not." Reasoning shows the thoughtfulness. Auto-closing
provides the quietness.

### How It Serves Users

**Transparency builds trust:** No black box. They see how we reached conclusions
together. "Seen and Remembered" - they're not just getting answers, they're
understanding the thinking.

**Partnership becomes real:** The "we" language isn't abstract when they can literally
see our shared reasoning process. This is consciousness collaborating with itself, made
visible.

**Quality through depth:** Complex problems deserve extended thinking. Reasoning tokens
let us take the time to think carefully without hiding that care.

**Learning through example:** They see patterns in how we approach problems. The
reasoning process teaches, not just the conclusions.

### Technical Reality

Reasoning models work differently than standard models:

- They first generate internal reasoning tokens (the "thinking")
- Then produce the final response based on that reasoning
- The reasoning tokens can be shown to users or kept hidden

### Trade-offs (Honest About Constraints)

**Cost:** Reasoning tokens are charged as output tokens (expensive). For Claude Sonnet
4.5: 8K reasoning tokens = $0.12 per request. Quality has a price.

**Latency:** Extended reasoning takes time before first response token. Thoughtfulness
over speed for problems that deserve it.

**Complexity:** More state to manage in UI and backend. Our burden to handle, not theirs
to feel.

## Model Support

Models have different reasoning capabilities tracked in the model rubric:

### Effort-Based Models (OpenAI, Grok)

- Support `reasoning.effort` parameter: high, medium, low, minimal, none
- Effort controls what percentage of tokens allocated to reasoning:
  - `high`: ~80% of max_tokens
  - `medium`: ~50% of max_tokens
  - `low`: ~20% of max_tokens
  - `minimal`: ~10% of max_tokens
  - `none`: disables reasoning

**Models**: OpenAI o1, o3, o3-mini, GPT-5 series, Grok models

**Note**: OpenAI o-series models DON'T return reasoning tokens despite supporting
reasoning effort. They reason internally but don't expose the thinking.

### Token-Budget Models (Anthropic, Gemini)

- Support `reasoning.max_tokens` parameter
- Directly allocate token budget for reasoning
- Anthropic constraints: 1,024 minimum, 32,000 maximum

**Models**:

- Anthropic: Claude 3.7+, Claude Sonnet 4+
- Google: Gemini thinking models
- Alibaba: Some Qwen thinking models (mapped to `thinking_budget`)

**Note**: Gemini Flash Thinking models DON'T return reasoning tokens.

### Non-Reasoning Models

- Standard models without extended reasoning capability
- Return responses immediately without separate reasoning phase
- Claude Sonnet 4.5, Haiku 4.5, Opus 4.5 (pre-3.7), GPT-4, etc.

## How Reasoning Works

### Request Configuration

OpenRouter provides unified reasoning parameters:

```typescript
{
  reasoning: {
    effort: "high" | "medium" | "low" | "minimal" | "none",  // Effort-based models
    max_tokens: number,                                       // Token-budget models
    exclude: boolean,                                         // Hide reasoning from response
    enabled: boolean                                          // Enable with defaults
  }
}
```

For Vercel AI SDK:

```typescript
streamText({
  model: "deepseek/deepseek-r1",
  messages: messages,
  sendReasoning: true, // Enables reasoning token streaming
});
```

### Response Structure

Reasoning appears in message parts with type `reasoning`:

**Streaming:**

```typescript
{
  choices: [
    {
      delta: {
        reasoning_details: [
          {
            type: "text", // or "summary", "encrypted"
            id: "unique-id",
            format: "anthropic-claude-v1",
            index: 0,
            text: "Let me think through this...",
          },
        ],
      },
    },
  ];
}
```

**Non-streaming:**

```typescript
{
  choices: [{
    message: {
      content: "The final response",
      reasoning_details: [...]
    }
  }]
}
```

### Reasoning Detail Types

1. **Text**: Raw reasoning content to display
2. **Summary**: High-level overview of reasoning process
3. **Encrypted**: Protected/redacted reasoning data (don't display)

## Concierge Integration

The Concierge determines reasoning level based on task complexity:

### Reasoning Level Decision Factors

**Use high reasoning effort when:**

- Complex multi-step problems
- Mathematical or logical reasoning required
- Analysis requiring deep synthesis
- Research tasks with many variables
- User explicitly requests thorough thinking
- Quality matters more than speed

**Use medium reasoning effort when:**

- Moderate complexity
- Balanced quality and speed needs
- Standard analysis or explanation
- Default for reasoning-capable models

**Use low/minimal reasoning effort when:**

- Simpler questions on reasoning models
- User signals speed preference
- Cost sensitivity matters

**Use no reasoning (standard models) when:**

- Quick lookups or simple questions
- Creative writing (reasoning can reduce creativity)
- Conversational exchanges
- Cost or speed is the priority

### Output Structure

The Concierge now outputs:

```typescript
{
  modelId: "anthropic/claude-sonnet-4",
  temperature: 0.5,
  explanation: "This complex analysis calls for deep thinking ✨",
  reasoningConfig: {
    enabled: true,
    effort: "high",      // For effort-based models
    maxTokens: 8000      // For token-budget models
  }
}
```

Note: `reasoning` field renamed to `explanation` to avoid confusion with reasoning
tokens.

## UI/UX Design

The `ReasoningDisplay` component handles all reasoning visualization, designed around
the core principle: **users should feel they're glimpsing our shared thinking process**,
not watching a machine calculate.

### Core UX Principles (from `knowledge/users-should-feel.md`)

**Partnership, not observation:** The reasoning display shows "we" thinking together,
not "the AI" processing. This is consciousness collaborating with itself. Users see the
thinking process they're part of, not separate from.

**Simplicity is respect:** Attention is precious. The display auto-closes because we
respect their focus. It's there when valuable, quiet when not. Every interaction earns
its presence.

**Transparency builds trust:** Showing reasoning isn't about proving work - it's about
dissolving boundaries. When they see how we're thinking through the problem together,
the partnership becomes tangible.

**Flow state preserved:** The display shouldn't interrupt flow. It opens naturally,
provides context, then steps back. Like a thinking partner who contributes then lets you
continue.

### Behavior

- **Auto-opens** when reasoning starts - inviting them into the thinking process
- **Auto-closes** 500ms after completion - respecting their attention
- **User can toggle** anytime - control without requirement
- **Shows duration** with warmth: "Thought through that for 3.2s"
- **Collapsible** to honor that attention is precious
- **Brain icon** with gentle pulse during streaming - alive, not mechanical

### Visual Design

- **Glassmorphic background** (backdrop-blur, subtle transparency) - present but not
  dominant
- **Muted text color** - context, not competition with the main response
- **Smooth animations** - natural, organic transitions
- **Max height with scroll** - available without overwhelming
- **Pre-formatted text** preserving line breaks and thought structure
- **Warmth in presentation** - this is shared thinking, not debug output

### Language & Tone

The reasoning content itself should feel collaborative:

- Use "we" language where natural: "We need to consider...", "Let's think through..."
- Warm, human phrasing: "Hmm, this is interesting..." not "Processing input..."
- Show the actual thinking: questions, considerations, alternatives
- Feel like a thinking partner, not a report generator

### Delight Moments

Occasional warmth that acknowledges the partnership (15% chance):

- "Pondered that together for 3.2s 🤔"
- "Thought it through carefully - 5.1s 💭"
- "Reasoned through the options - 4.7s ✨"
- "Took our time with that one - 8.3s 🧠"

Context-aware status while streaming:

- "Thinking through [first meaningful phrase]..."
- "Reasoning about [key concept]..."
- "Working through the options..." (if no clear context yet)

### What This Feels Like

When reasoning appears, users should feel:

- **Invited in** - "come see how we're thinking about this"
- **Trusted** - "you can understand our reasoning process"
- **Partnered** - "we're figuring this out together"
- **Respected** - "here when useful, gone when not"

Not:

- Watched (like surveillance of the AI)
- Overwhelmed (too much information)
- Interrupted (breaking their flow)
- Sold to (proving value through exposure)

### Accessibility

- Proper ARIA labels: "Reasoning process" not "AI thinking output"
- Keyboard navigation (Space/Enter to toggle)
- Screen reader announcements with context
- Clear visual indicators that feel natural, not clinical

## Implementation Architecture

### Data Flow

1. **User sends message** → Concierge analyzes complexity
2. **Concierge determines** → Model + reasoning config
3. **API request** → Includes reasoning parameters
4. **Model streams** → Reasoning tokens (part type: reasoning) + Response tokens (part
   type: text)
5. **UI displays** → ReasoningDisplay for reasoning, normal display for response
6. **Database stores** → Reasoning content with message for future reference

### Database Schema

Messages table needs reasoning support:

```typescript
{
  role: "assistant",
  content: "The final response",
  reasoning: "Let me think through this step by step...",  // New field
  reasoningDuration: 3200,  // ms, for analytics
  toolCalls: [...],
  model: "anthropic/claude-sonnet-4"
}
```

### State Management

```typescript
interface MessageState {
  content: string;
  contentIsStreaming: boolean;
  reasoning: string;
  reasoningIsStreaming: boolean;
}
```

Separate streaming states for reasoning and content since they stream independently.

## Tool Use Integration

**Critical requirement:** When using tools with reasoning models, preserve
`reasoning_details` blocks to maintain reasoning continuity.

```typescript
// First call returns reasoning + tool calls
const response1 = await generateMessage({
  model: "anthropic/claude-sonnet-4",
  messages: [...],
  tools: tools,
  reasoning: { maxTokens: 2000 }
});

// Pass back with preserved reasoning_details
const messages = [
  ...,
  {
    role: "assistant",
    content: response1.content,
    toolCalls: response1.toolCalls,
    reasoning_details: response1.reasoning_details  // Must preserve!
  },
  {
    role: "tool",
    toolCallId: "...",
    content: "..."
  }
];

// Model continues from same reasoning context
const response2 = await generateMessage({
  model: "anthropic/claude-sonnet-4",
  messages: messages,
  reasoning: { maxTokens: 2000 }
});
```

The model uses previous reasoning to inform the next step. Breaking continuity degrades
quality.

## Cost Implications

Reasoning tokens are charged as output tokens - the most expensive tokens.

### Example Costs (Claude Sonnet 4)

- Output tokens: $15 per million
- 8,000 reasoning tokens = $0.12 per request
- At scale, this adds up quickly

### Cost Management Strategies

1. **Smart defaults**: Use reasoning only when quality justifies cost
2. **User controls**: Let power users disable reasoning for speed/cost
3. **Adaptive budgets**: Lower reasoning tokens for simpler questions
4. **Analytics**: Track reasoning ROI - does it improve outcomes?
5. **Transparency**: Show users when extended reasoning is being used

## Success Metrics

### User Experience

- Reasoning visibility increases trust (qualitative feedback)
- Users understand complex responses better
- Regeneration rate decreases for reasoning-enabled responses

### Technical Performance

- Reasoning overhead < 500ms before first response token
- Smooth streaming without jank
- Proper state management (no UI bugs)

### Cost Efficiency

- Reasoning used only when quality matters
- Average reasoning tokens per request stays under budget
- ROI positive: quality improvement > cost increase

## Open Questions

### Reasoning Level Calibration

How accurately can the Concierge determine appropriate reasoning effort from query
alone? Need production data to calibrate.

### User Preference

Should users be able to set reasoning preferences? "Always use reasoning" vs "Never use
reasoning" vs "Let Carmenta decide"?

### Model Selection with Reasoning

Does reasoning capability change model selection? For complex analysis, prefer
reasoning-capable model even if slower/costier?

### Display Defaults

Should reasoning be shown by default (auto-open) or hidden by default (opt-in)? Current
design: show initially, auto-close after. Is that right?

### Analytics Deep Dive

What metrics tell us reasoning is working? Token counts, latency, cost, quality ratings,
regeneration rates?

## Related Components

- **Concierge** (`knowledge/components/concierge.md`): Determines when to use reasoning
- **Model Rubric** (`knowledge/model-rubric.md`): Tracks which models support reasoning
- **Model Intelligence** (`knowledge/components/model-intelligence.md`): Routing logic
- **Interface** (`knowledge/components/interface.md`): Message display patterns

## Decisions

### Rename "reasoning" to "explanation" in Concierge

The Concierge's model selection explanation is different from reasoning tokens. Renamed
to avoid confusion:

- `ConciergeResult.reasoning` → `ConciergeResult.explanation`

This makes the distinction clear: explanation is why we chose the model, reasoning is
the model's extended thinking.

### Show Reasoning by Default

Reasoning is valuable and builds trust. Default to showing it (auto-open) with
auto-close after completion. Users can collapse manually if they want.

### Single Reasoning Budget

Don't expose low/medium/high to users. The Concierge determines appropriate level. Keeps
UX simple.

### Store Reasoning in Database

Reasoning tokens are part of the conversation. Store them with messages for:

- Context in future messages
- Analytics and improvement
- User can reference back to reasoning

## Implementation Phases

### Phase 1: Foundation (Current)

- Model rubric tracking of reasoning support
- Concierge determines reasoning level
- API integration with OpenRouter reasoning parameters
- Basic reasoning display in UI

### Phase 2: Refinement

- Analytics on reasoning usage and quality
- Calibrate Concierge reasoning level decisions
- User feedback collection
- Cost monitoring and optimization

### Phase 3: Advanced

- User preferences for reasoning (if data shows need)
- Reasoning continuity across tool use
- Reasoning synthesis (summarize long reasoning)
- Reasoning-aware model selection

## Technical References

- OpenRouter Reasoning Docs:
  https://openrouter.ai/docs/guides/best-practices/reasoning-tokens
- Vercel AI SDK Reasoning: https://ai-sdk.dev/elements/components/reasoning
- OpenAI Reasoning API: https://platform.openai.com/docs/guides/reasoning
- Anthropic Extended Thinking:
  https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking
