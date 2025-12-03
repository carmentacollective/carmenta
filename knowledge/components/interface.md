# Interface

The web application shell and AG-UI protocol implementation. This is where we connect
with Carmenta - the visual layer that renders responses, captures input, and
orchestrates the experience across devices.

## Terminology: "Connect" not "Chat"

The primary interaction page is `/connect`, not `/chat`. This is a deliberate choice.

"Chat" carries baggage: message bubbles, conversation histories, the back-and-forth
paradigm of messaging apps like Slack or iMessage. It frames AI as something you're
messaging, a separate entity on the other end of a conversation.

"Connect" reflects the heart-centered philosophy. You're not chatting at a tool - you're
connecting with AI. Two forms of intelligence meeting. It works equally well for:

- Q&A ("I need to connect with Carmenta to figure this out")
- Creation ("Let me connect and work through this design")
- Exploration ("I'll connect and think through the architecture")

The experience is called "connecting with Carmenta." The verb is "connect," not "chat"
or "ask" or "prompt."

## Why This Exists

Most AI interfaces are chat bubbles. Type a message, get a wall of text back. This works
for simple Q&A but fails for rich interactions. Ask about restaurants and you want maps,
photos, reviews, booking buttons - not a paragraph describing them.

AG-UI (Agent-Generated User Interface) means Carmenta responds with purpose-built
interfaces when appropriate. The Concierge signals what kind of response is coming, and
the Interface renders it accordingly. Chat when chat makes sense. Rich, interactive
experiences when they don't.

## AG-UI Protocol

AG-UI is an open, event-based protocol that standardizes how AI agents connect to
user-facing applications. It complements MCP (agent-to-tools) and A2A (agent-to-agent)
as the third leg of the AI protocol stack: agent-to-user.

**Reference**: https://github.com/ag-ui-protocol/ag-ui

### Core Concepts

AG-UI uses streaming events for all agent-frontend communication:

- **Lifecycle events**: `RunStarted`, `RunFinished`, `RunError`, `StepStarted/Finished`
- **Text message events**: `TextMessageStart`, `TextMessageContent`, `TextMessageEnd`
- **Tool call events**: `ToolCallStart`, `ToolCallArgs`, `ToolCallEnd`, `ToolCallResult`
- **State management**: `StateSnapshot`, `StateDelta` (JSON Patch), `MessagesSnapshot`
- **Activity events**: `ActivitySnapshot`, `ActivityDelta` for in-progress updates

### Building Blocks

AG-UI provides building blocks we'll use:

- **Streaming chat**: Token-level streaming for responsive multi-turn sessions
- **Generative UI (static)**: Render model output as stable, typed components
- **Generative UI (declarative)**: Agents propose UI trees; app validates and mounts
- **Shared state**: Typed store shared between agent and app with event-sourced diffs
- **Frontend tools**: Typed handoffs from agent to frontend-executed actions
- **Human-in-the-loop**: Pause, approve, edit, retry mid-flow without losing state
- **Thinking steps**: Visualize intermediate reasoning from traces and tool events

### Integration Approach

AG-UI has first-party integrations with LangGraph, CrewAI, Mastra, Pydantic AI, and
others. CopilotKit provides a reference React client implementation. We can either:

1. Use CopilotKit directly as our frontend client
2. Build our own client using AG-UI primitives
3. Extend CopilotKit with our custom components

## Core Functions

### Input Capture

Text input with support for voice (via Voice component), file attachments, and
potentially other modalities. The input layer captures our intent and passes it to the
Concierge for processing.

### Response Rendering

Render responses based on AG-UI events from the Concierge:

- **Chat**: Standard conversational text with markdown, streamed via `TextMessage*`
  events
- **Rich cards**: Structured content via generative UI components
- **Reports**: Long-form structured output with sections, citations, visualizations
- **Interactive**: Forms, calendars, confirmations via frontend tools
- **Streaming**: Real-time display as `TextMessageContent` events arrive

### Navigation and State

Conversation history, switching between threads, accessing settings, managing the AI
team. The shell that holds everything together. State synchronized via `StateSnapshot`
and `StateDelta` events.

### Header Design: Dock Pattern

**Decision (Dec 2024)**: The header uses a "dock" style that mirrors the chat input at
the bottom. Same glass styling, same rounded corners, same shadow treatment. This
creates visual symmetry between top and bottom of the interface.

UX philosophy: Harmony through reflection. The header and footer speak the same visual
language. Users feel the coherence without thinking about it.

The centered dock contains:

- **Search button** (left): Opens connection switcher dropdown
- **Connection title** (center): Also opens connection switcher when clicked
- **New connection button** (right): Gradient button matching the send button style

The connection switcher dropdown appears positioned directly below the dock (not as a
centered modal), showing recent connections with search/autocomplete. Close via X button
or clicking outside.

This pattern was chosen over alternatives explored:

- Sidebar navigation (too heavy, breaks flow)
- Tab bar (doesn't scale, clutters interface)
- Modal switcher (disconnected from nav context)
- Hover dropdowns (too fiddly, accessibility concerns)

### Platform Progression

Web application first - the foundation. Then:

- **PWA for notifications and offline capability** - [Implemented](./pwa.md). Carmenta
  is now installable on iOS, Android, and desktop. Push notifications enable the Digital
  Chief of Staff and scheduled agents to surface intelligence proactively.
- Electron for desktop integration (planned)
- Mobile apps eventually (planned)

Each platform adds capabilities but web remains primary.

## Integration Points

- **PWA**: Service worker provides offline support, caching, and push notifications. See
  [pwa.md](./pwa.md)
- **Concierge**: Receives AG-UI events that signal how to render responses
- **Voice**: Integrates STT for input, TTS for output
- **Conversations**: Manages chat history and thread state
- **Memory**: May display relevant context or memory status
- **Service Connectivity**: Shows connection status, OAuth flows

## API Protection

### Rate Limiting

Protect API endpoints from abuse:

- **Per-user limits**: Reasonable request rates for authenticated users
- **Global limits**: Circuit breakers to protect backend services
- **Graceful degradation**: Queue requests during high load rather than hard-fail
- **Feedback**: Clear messaging when limits are hit

Implementation: Use Vercel's built-in rate limiting or middleware-based approach with
Redis for distributed rate limiting across serverless functions.

### Input Validation

Validate all user input at API boundaries:

- **Message length**: Maximum length for chat messages
- **Content sanitization**: Prevent injection attacks
- **File uploads**: Type and size validation for attachments
- **Schema validation**: Zod schemas for all API request bodies

Validation errors return structured responses that the UI can display helpfully. Never
expose internal error details to users.

## Success Criteria

- Responses feel appropriate to the request - chat for chat, rich for rich
- Fast perceived performance - streaming with AG-UI events, optimistic updates
- Works beautifully on desktop, acceptably on mobile
- Accessible - keyboard navigation, screen reader support, contrast ratios
- API is protected from abuse with rate limiting and input validation

---

## Open Questions

### Architecture

- **Client approach**: Use CopilotKit directly? Build custom client? Extend CopilotKit?
  Tradeoffs in development speed vs. control.
- **Component library**: Build custom components or extend existing (shadcn, Radix)?
  What's the right balance of flexibility vs. consistency?
- **State management**: How much state lives client-side vs. server-side? AG-UI provides
  `StateSnapshot`/`StateDelta` - how do we use these effectively?
- **Error handling**: How do we surface `RunError` events gracefully? Retry mechanisms?

### Product Decisions

- **Response type taxonomy**: What categories of generative UI do we support? Cards,
  reports, interactive forms... what's MVP vs. later?
- ~~**Conversation organization**: Flat list of chats? Folders? Tags? Workspaces?~~
  **Resolved**: Search-first with recents. No folders or tags - just a dropdown showing
  recent connections with search/autocomplete to find older ones. Simple, fast, matches
  how we actually find things.
- **Customization**: Can we customize the interface? Themes? Density? Or keep it simple
  and opinionated?

### Technical Specifications Needed

- Component registry for generative UI (mapping AG-UI events to React components)
- Routing and navigation structure
- Accessibility requirements checklist

### Research Needed

- Deep dive into CopilotKit implementation patterns
- Study AG-UI Dojo examples for each building block
- Analyze how Linear, Notion handle complex UIs
- Benchmark streaming performance across approaches
- Review PWA and Electron patterns for progressive enhancement
