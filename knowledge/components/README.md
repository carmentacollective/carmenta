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

## Foundation

### [Foundation](foundation.md)

The technology stack and development environment. Next.js, React, TypeScript, Node.js,
bun, and the toolchain that makes development fast and reliable. Everything else is
built on this.

### [Hosting](hosting.md)

Where Carmenta runs. Render for web services, background workers, cron jobs, and managed
databases. Chosen for long-running LLM requests, unlimited scheduled agents, and
predictable costs.

### [Testing](testing.md)

Comprehensive testing infrastructure. Vitest for unit and integration tests, Playwright
for end-to-end. Built for confidence to move fast.

### [Vercel AI SDK](vercel-ai-sdk.md)

The foundational layer for AI model interactions. Streaming, message management, and
transport abstractions that power all chat experiences. AI SDK v5 patterns for the
`useChat` hook, server-side streaming, and message formats.

## Core Layer

### [Carmenta Presence](carmenta-presence.md)

The presence behind the interface. Three phases: pre-query (understand needs, assemble
context, route), post-response (format output, add enhancements), self-improvement
(evaluate quality, detect patterns).

### [Concierge](concierge.md)

Operates before and after every model call. Pre-query: infers complexity, assembles
context, selects model. Post-response: formats output, adds follow-ups. Users see a
simple interface while Concierge handles complexity.

### [Interface](interface.md)

Web application shell and AG-UI protocol. Purpose-built responses - chat when chat makes
sense, rich interactive experiences when they don't. Web first, then PWA, Electron,
mobile.

### [Memory](memory.md)

Context and memory management. Remembers who you are, what you're working on, what
you've decided, who you know. The AI always has context without re-explanation.

### [Service Connectivity](service-connectivity.md)

Native integrations with external services. Connect once, use everywhere - Gmail,
Calendar, Notion, GitHub, and more. One subscription covers full connectivity.

### [External Tools](external-tools.md)

MCP-based tool connections - Carmenta reaching into the world. Featured tools with
one-click setup, community tools with ratings, custom MCP servers for technical users.
The complexity of MCP abstracted into human terms.

## Intelligence Layer

### [Model Intelligence](model-intelligence.md)

The routing rubric for model selection. Built from external benchmarks, our own
validation, and production signals. The Concierge consults this for every request -
which model for which task.

### [Prompt Testing](prompt-testing.md)

Prompts are code. Versioned, evaluated across models, iterated to measurable targets.
Verifies our prompts work correctly across the models we route to.

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

Browse the web as the user with their sessions. Deep research behind authentication,
task execution in web apps without APIs. Access what matters, not just what's public.

## Self-Building Layer

### [Concierge Improvement Loop](concierge-improvement-loop.md)

Watches every live query and response. Evaluates quality, detects patterns, drives
improvement. Progresses through autonomy levels from observation to autonomous fixes.

### [Product Intelligence](product-intelligence.md)

AI product manager that processes feedback, analyzes competitors, synthesizes insights.
The structural advantage - Carmenta improves itself. Feedback loops compressed from
quarters to days.

### [Agent Testing](agent-testing.md)

AI agents that use Carmenta as users would. Synthetic users at scale generate signals
for Product Intelligence. The self-improvement loop: test, synthesize, build, repeat.

## Supporting Components

### [Onboarding](onboarding.md)

First-run experience. Profile collection, capability demonstration, service connection,
AI team introduction. Conversational onboarding through the Concierge.

### [Conversations](conversations.md)

Chat management, history, organization. The actual message history and UI state,
distinct from Memory. Find, continue, organize, search conversation history.

### [Conversation Sync](conversation-sync.md)

Sync conversations from other AI platforms into Carmenta. Your ChatGPT history, Claude
conversations - unified in one place. Reduces switching cost, preserves accumulated
context.

### [Artifacts](artifacts.md)

Persistent storage for AI-generated content. Code, documents, diagrams, reports, and
AG-UI interfaces - created once, accessed anywhere, versioned over time. Where AG-UI
outputs live after generation.

### [File Attachments](file-attachments.md)

Upload processing for PDFs, images, documents. RAG for text, vision for images. Files
become conversation context automatically.

### [Auth](auth.md)

User authentication and accounts. Login methods, session management, user lifecycle.
Foundation for personalization - without identity, no persistent memory or preferences.

## Infrastructure Layer

### [Observability](observability.md)

LLM and agent tracing. Capture prompts, responses, costs, and multi-step agent
workflows. Debug issues, understand behavior, track quality over time.

### [Analytics](analytics.md)

Product analytics. Understand how users actually use Carmenta - feature usage,
retention, funnels. Data-informed product decisions feeding into Product Intelligence.

### [Usage Metering](usage-metering.md)

Track token consumption and API costs per user. Foundation for understanding costs,
identifying heavy users, and enabling usage-based billing.

### [Error Handling](error-handling.md)

Error tracking, reporting, and recovery. Catch problems, alert the team, recover
gracefully. We see helpful messages, not stack traces.

### [Data Storage](data-storage.md)

Database infrastructure - PostgreSQL for relational data, Redis for caching and
real-time. Hosting options, ORM choices, vector storage considerations.
