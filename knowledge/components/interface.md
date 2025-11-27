# Interface

The web application shell and AG-UI protocol implementation. This is where we interact
with Carmenta - the visual layer that renders responses, captures input, and
orchestrates the experience across devices.

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

### Platform Progression

Web application first - the foundation. Then:

- PWA for notifications and offline capability
- Electron for desktop integration
- Mobile apps eventually

Each platform adds capabilities but web remains primary.

## Integration Points

- **Concierge**: Receives AG-UI events that signal how to render responses
- **Voice**: Integrates STT for input, TTS for output
- **Conversations**: Manages chat history and thread state
- **Memory**: May display relevant context or memory status
- **Service Connectivity**: Shows connection status, OAuth flows

## Success Criteria

- Responses feel appropriate to the request - chat for chat, rich for rich
- Fast perceived performance - streaming with AG-UI events, optimistic updates
- Works beautifully on desktop, acceptably on mobile
- Accessible - keyboard navigation, screen reader support, contrast ratios

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
- **Conversation organization**: Flat list of chats? Folders? Tags? Workspaces?
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
