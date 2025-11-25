# Carmenta Components

This directory contains specifications for each major Carmenta component. Components are
listed roughly in build order - foundational pieces first, then layers that depend on
them.

Each component spec includes:
- **Why it exists** - the problem it solves
- **Core functions** - what it does
- **Integration points** - how it connects to other components
- **Success criteria** - how we know it's working
- **Open questions** - architecture, product decisions, specs needed, and research

## Foundation Layer

### [Concierge](concierge.md)

The intelligent layer between user input and AI processing. Classifies requests, selects
models, determines response strategy, enhances queries. Users see a simple interface; the
Concierge handles complexity invisibly.

### [Interface](interface.md)

Web application shell and AG-UI protocol. Purpose-built responses - chat when chat makes
sense, rich interactive experiences when they don't. Web first, then PWA, Electron,
mobile.

### [Memory](memory.md)

Context and memory management. Remembers who you are, what you're working on, what you've
decided, who you know. The AI always has context without re-explanation.

### [Service Connectivity](service-connectivity.md)

Native integrations with external services. Connect once, use everywhere - Gmail,
Calendar, Notion, GitHub, and more. One subscription covers full connectivity. MCP
servers for custom integrations.

## Intelligence Layer

### [AI Team](ai-team.md)

Digital Chief of Staff and specialized agents. DCOS tracks commitments, maintains
knowledge, anticipates needs. Additional team members: Researcher, Analyst, Creator,
Reviewer. One person becomes a team.

### [Scheduled Agents](scheduled-agents.md)

Agents that run on schedules. Daily briefings, meeting prep, monitoring, research
digests. Carmenta works while you sleep and surfaces what matters when you're ready.

### [Voice](voice.md)

First-class voice interaction. STT, TTS, natural conversation. Talk to Carmenta while
driving, cooking, or thinking out loud. Not an afterthought - a core modality.

### [Browser Automation](browser-automation.md)

Browse the web as the user with their sessions. Deep research behind authentication, task
execution in web apps without APIs. Access what matters, not just what's public.

## Self-Building Layer

### [Product Intelligence](product-intelligence.md)

AI product manager that processes feedback, analyzes competitors, synthesizes insights.
The structural advantage - Carmenta improves itself. Feedback loops compressed from
quarters to days.

### [Agent Testing](agent-testing.md)

AI agents that use Carmenta as users would. Synthetic users at scale generate signals for
Product Intelligence. The self-improvement loop: test, synthesize, build, repeat.

## Supporting Components

### [Onboarding](onboarding.md)

First-run experience. Profile collection, capability demonstration, service connection,
AI team introduction. Conversational onboarding through the Concierge.

### [Conversations](conversations.md)

Chat management, history, organization. The actual message history and UI state, distinct
from Memory. Find, continue, organize, search conversation history.

### [File Attachments](file-attachments.md)

Upload processing for PDFs, images, documents. RAG for text, vision for images. Files
become conversation context automatically.

### [Auth](auth.md)

User authentication and accounts. Login methods, session management, user lifecycle.
Foundation for personalization - without identity, no persistent memory or preferences.

## Infrastructure Layer

### [Observability](observability.md)

LLM and agent tracing. Capture prompts, responses, costs, and multi-step agent workflows.
Debug issues, understand behavior, track quality over time.

### [Analytics](analytics.md)

Product analytics. Understand how users actually use Carmenta - feature usage, retention,
funnels. Data-informed product decisions feeding into Product Intelligence.

### [Error Handling](error-handling.md)

Error tracking, reporting, and recovery. Catch problems, alert the team, recover
gracefully. We see helpful messages, not stack traces.

### [Data Storage](data-storage.md)

Database infrastructure - PostgreSQL for relational data, Redis for caching and
real-time. Hosting options, ORM choices, vector storage considerations.
