# Interface

The web application shell and AG-UI protocol implementation. This is where users
interact with Carmenta - the visual layer that renders responses, captures input, and
orchestrates the experience across devices.

## Why This Exists

Most AI interfaces are chat bubbles. Type a message, get a wall of text back. This works
for simple Q&A but fails for rich interactions. Ask about restaurants and you want maps,
photos, reviews, booking buttons - not a paragraph describing them.

AG-UI (Agent-Generated User Interface) means Carmenta responds with purpose-built
interfaces when appropriate. The Concierge signals what kind of response is coming, and
the Interface renders it accordingly. Chat when chat makes sense. Rich, interactive
experiences when they don't.

## Core Functions

### Input Capture

Text input with support for voice (via Voice component), file attachments, and
potentially other modalities. The input layer captures user intent and passes it to the
Concierge for processing.

### Response Rendering

Render responses based on signals from the Concierge:
- **Chat**: Standard conversational text with markdown support
- **Rich cards**: Structured content like restaurant listings, product comparisons, event details
- **Reports**: Long-form structured output with sections, citations, visualizations
- **Interactive**: Forms, calendars, confirmations for task execution
- **Streaming**: Real-time display as responses generate

### Navigation and State

Conversation history, switching between threads, accessing settings, managing the AI
team. The shell that holds everything together.

### Platform Progression

Web application first - the foundation. Then:
- PWA for notifications and offline capability
- Electron for desktop integration
- Mobile apps eventually

Each platform adds capabilities but web remains primary.

## Integration Points

- **Concierge**: Receives rendering instructions alongside content
- **Voice**: Integrates STT for input, TTS for output
- **Conversations**: Manages chat history and thread state
- **Memory**: May display relevant context or memory status
- **Service Connectivity**: Shows connection status, OAuth flows

## Success Criteria

- Responses feel appropriate to the request - chat for chat, rich for rich
- Fast perceived performance - streaming, optimistic updates
- Works beautifully on desktop, acceptably on mobile
- Accessible - keyboard navigation, screen reader support, contrast ratios

---

## Open Questions

### Architecture

- **AG-UI protocol definition**: How does the Concierge signal response type? Structured
  metadata? Component identifiers? How extensible does this need to be?
- **Component library**: Build custom components or extend existing libraries (shadcn,
  Radix)? What's the right balance of flexibility vs. consistency?
- **State management**: How much state lives client-side vs. server-side? Real-time sync
  requirements?

### Product Decisions

- **Response type taxonomy**: What categories of rich responses do we support? Cards,
  reports, interactive forms... what else? What's MVP vs. later?
- **Conversation organization**: Flat list of chats? Folders? Tags? Workspaces? How do
  users organize their history?
- **Customization**: Do users customize the interface? Themes? Density? Or keep it
  simple and opinionated?

### Technical Specifications Needed

- AG-UI message format and component registry
- Component specifications for each response type
- Routing and navigation structure
- Real-time streaming protocol
- Accessibility requirements checklist

### Research Needed

- Study AG-UI implementations (CopilotKit, Vercel AI SDK RSC, etc.)
- Analyze how Linear, Notion, and other design-forward apps handle complex UIs
- Benchmark streaming performance across different approaches
- Review PWA and Electron patterns for progressive enhancement
