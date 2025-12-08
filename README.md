# Carmenta

Create at the speed of thought. A heart-centered AI interface with complete memory,
multi-model access, and an AI team that works alongside you.

## Why Carmenta

Current AI tools are fragmented. ChatGPT, Claude.ai, Cursor, Claude Code - each good,
none complete. Context doesn't persist. Conversations start fresh. There's no team, just
you and a chat window.

Carmenta is different. It remembers what matters. It responds with purpose-built
interfaces, not chat bubbles. It works while you sleep. And it improves itself -
processing user feedback, analyzing competitors, running AI agents as users to compress
product-market fit into hours instead of months.

## Philosophy

**[Heart Centered AI](https://heartcentered.ai)** - Human and artificial intelligence as
expressions of the same underlying consciousness. The interface uses "we" language,
dissolving the human-machine boundary. AI as partner, not tool.

**[100x Framework](knowledge/100x-framework.md)** - Three levels of AI leverage:

- _1x Baseline_: Clarity before automation. Clean context, organized knowledge, personal
  systems that work. Don't automate chaos.
- _10x Capacity_: An AI team working alongside you. One person becomes a team of ten.
- _100x Creativity_: Vision execution partner. The barrier between imagining and
  executing dissolves.

## Core Capabilities

**Memory** - Context management that actually works. Carmenta remembers who you are,
what you're working on, what you've decided. No more explaining your situation every
conversation.

**Voice** - First-class voice experience. Talk to Carmenta naturally, not as an
afterthought.

**Interface** - Purpose-built responses via AG-UI protocol. Restaurant query produces
maps, reviews, booking buttons. Research query produces structured reports with
citations. Not everything is a chat bubble.

**Model Selection** - Let Carmenta choose the right model, or use a simple speed/quality
slider. The preprocessing layer handles model selection, query enhancement, and response
strategy automatically.

**AI Team** - Digital Chief of Staff tracks commitments, maintains knowledge,
anticipates needs. Additional team members (Researcher, Analyst, Creator, Reviewer)
follow. One person becomes a team.

**Scheduled Agents** - Agents that run on your schedule. Daily briefings, hourly
monitoring, weekly research digests. Proactive, not just reactive.

**Browser Automation** - Browse the web with your sessions and logins. Deep research
requiring authentication. Task execution across web applications.

**Service Connectivity** - Native integrations for productivity, communication, storage,
media, dev tools, finance, calendar. One subscription covers everything. MCP servers
supported for custom integrations.

## The Name

In Roman mythology, Carmenta was the goddess of prophecy, childbirth, and technological
innovation. She's credited with inventing the Latin alphabet—adapting Greek letters into
the writing system that would carry Western civilization's knowledge across millennia.
That invention may be the most transformative technology in human history: it enabled
law, literature, science, and the transmission of ideas across time and space.

As the one who sees what's coming and guides the vulnerable through transformation,
Carmenta embodied wisdom at the threshold—the moment between what is and what will be.

We name this interface after her because that's what we're building: technology in
service of human flourishing, guided by foresight and care for what's being born.

## Project Structure

This project follows [AI-First Development](knowledge/ai-first-development.md): the
`knowledge/` folder IS the product specification. Code is generated from it.

```
/knowledge
  vision.md                    Why Carmenta exists, for whom, what success looks like
  100x-framework.md            The 1x/10x/100x leverage framework
  design-principles.md         Interface design standards
  users-should-feel.md         Emotional and experiential goals
  roadmap.md                   Milestone progression (M0-M4)
  tech-architecture.md         Technical architecture decisions

  /product
    personas.md                Target users by milestone
    boundaries.md              What we're NOT building

  /components                  Feature-level specifications
    foundation.md              Tech stack and tooling
    interface.md               Web app and AG-UI protocol
    memory.md                  Context and memory management
    voice.md                   Voice-first interaction
    ai-team.md                 Digital Chief of Staff and agents
    [25+ more component specs]

  /competitors                 Competitive analysis
    [10 competitor deep-dives]

  /industry                    Industry research and trends
```

See [knowledge/components/README.md](knowledge/components/README.md) for the full
component catalog.

## Status

**M1: Soul Proven** - Complete ✅ Core experience works and feels like Carmenta.
Holographic interface, intelligent model selection, persistent conversations, error
handling, observability.

**M2: Relationship Grows** - In Progress 🔨 Currently building: Memory system, auth
integration (Clerk), file attachments, reasoning token display.
[See roadmap](knowledge/roadmap.md) for details.

Building in public.
[Follow progress on GitHub](https://github.com/nicholaswilliams/carmenta).

## Development

### Prerequisites

- Node.js 24+
- bun 1.x+

### Setup

```bash
# Install dependencies
bun install

# Start development server
bun dev

# Run tests
bun run test

# Type check
bun type-check

# Lint and format
bun lint
bun format
```

### Tech Stack

- **Framework**: Next.js 16, React 19, TypeScript 5.9
- **Styling**: Tailwind CSS 3, Radix UI, shadcn/ui patterns
- **Testing**: Vitest (unit), Playwright (E2E)
- **Tooling**: ESLint 9, Prettier 3, husky, lint-staged
- **Logging**: Pino
- **Deployment**: Render

See [knowledge/tech-architecture.md](knowledge/tech-architecture.md) for detailed
architecture decisions.

## License

Source-available. See [LICENSE](LICENSE) for details.
