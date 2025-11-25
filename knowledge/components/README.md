# Carmenta Components

This directory contains specifications for each major Carmenta component. Components are
listed roughly in build order - foundational pieces first, then layers that depend on them.

## Foundation Layer

### Interface

The web application shell and AG-UI protocol implementation. Web first, then PWA for
notifications, then Electron for desktop, then mobile. AG-UI means every response is a
purpose-built interface - restaurant queries produce pages with maps and reviews, not chat
bubbles.

### Concierge

The intelligent layer that sits between user input and AI processing. Analyzes requests,
selects models, determines response strategy, enhances queries automatically. Users see a
simple swift/balanced/deep slider; the Concierge handles everything else.

### Memory

Context and memory management system. Remembers who you are, what you're working on, what
you've decided, who you know. Provides retrieval for all other components. The AI always
has the context it needs without users explaining their situation every conversation.

### Service Connectivity

Native integrations with external services. Productivity (Notion, ClickUp, Miro, Linear),
communication (Gmail, Slack, LinkedIn, X), storage (Drive, Dropbox), media (YouTube,
Instagram, Photos, Spotify), AI/data (Limitless, Fireflies, Exa), dev (GitHub, Sentry),
finance (Monarch, CoinMarketCap), calendar/contacts. One subscription covers everything.
MCP servers remain supported for custom integrations.

## Intelligence Layer

### AI Team

The Digital Chief of Staff and additional team members. DCOS tracks commitments across
conversations, maintains knowledge base, anticipates needs, handles operational
coordination. Additional members: Researcher, Analyst, Creator, Reviewer. Each
specialized, all working from shared context.

### Scheduled Agents

Agents that run on schedules, not just on demand. Daily briefings, hourly monitoring,
weekly research digests. Combined with proactive intelligence: preparing for meetings,
watching for signals, escalating what matters. The shift from reactive to proactive.

### Voice

Voice as a first-class citizen. Talk to Carmenta, talk with Carmenta. Natural voice
experience that actually works. Deep specification comes separately - this component
covers STT, TTS, voice-first interaction patterns, and integration with the Concierge.

### Browser Automation

Browse the web as the user, with their sessions and logins. Deep research requiring
authentication, task execution across web applications. Differentiates from tools that
only access public web.

## Self-Building Layer

### Product Intelligence

How Carmenta improves itself. AI product manager that processes user feedback, analyzes
competitor capabilities, synthesizes insights into product improvements. The automated
feedback loop that compresses traditional product development timelines.

### Agent Testing

AI agents that use Carmenta as users would. Generates usage signals that product
intelligence processes. Enables finding product-market fit in hours instead of months.
AI agents test, AI PM synthesizes, AI builds, repeat.

## Supporting Components

### Onboarding

First-run experience and user profile creation. Collects goals, preferences, communication
style. Sets up initial AI team configuration. The AI Concierge guides users through setup
and demonstrates capabilities.

### Conversations

Chat management, history, organization. Separate from Memory (which handles context
retrieval) - this handles the conversation data model, threading, attachments, and UI
state.

### File Attachments

Upload processing for PDFs, images, documents. RAG for text-heavy content, direct
processing for images, format conversion as needed. Secure storage, automatic context
incorporation.
