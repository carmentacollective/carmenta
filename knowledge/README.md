# Carmenta Knowledge

The product kernel for the best interface to AI.

This folder IS the product specification. Code is generated from it. New team members
(human or AI) bootstrap from it. The specification is the IP.

See [AGENTS.md](./AGENTS.md) for principles on maintaining this folder.

---

## Start Here

**First time?** Read in this order:

1. [Vision](./product/vision.md) - Why Carmenta exists, what we're building
2. [Personas](./product/personas.md) - Who we're building for
3. [Boundaries](./product/boundaries.md) - What we're NOT building
4. [Roadmap](./roadmap.md) - Milestones and sequencing

**Building a feature?** Check these:

1. [Components README](./components/README.md) - Feature specs organized by layer
2. The specific component spec in `components/`
3. Related [decisions](./decisions/) for architectural context

**Understanding the philosophy?** Read:

1. [Heart-Centered AI](./context/heartcentered-ai.md) - Unity consciousness foundation
2. [100x Framework](./context/100x-framework.md) - 1x → 10x → 100x leverage progression

---

## Directory Map

```
knowledge/
├── product/                   Core identity
│   ├── vision.md              Why Carmenta exists, what success looks like
│   ├── personas.md            M0-M4 user personas with switching triggers
│   └── boundaries.md          What we're NOT building
│
├── components/                Feature specifications (73+ files)
│   ├── README.md              Index organized by layer
│   ├── concierge.md           Pre/post query processing, model selection
│   ├── memory.md              Context retrieval and compilation
│   ├── voice.md               STT, TTS, natural conversation
│   └── ...                    One file per capability
│
├── decisions/                 Cross-cutting architectural decisions
│   ├── infrastructure-stack.md
│   ├── chat-architecture-backend-first.md
│   └── ...                    Major technical choices and rationale
│
├── competitors/               Competitive analysis (11 files)
│   ├── README.md              Positioning summary
│   └── [competitor].md        One file per competitor
│
├── context/                   Foundational philosophy
│   ├── heartcentered-ai.md    Unity consciousness, "we" language
│   └── 100x-framework.md      1x baseline → 10x team → 100x vision
│
├── ai-pm/                     Autonomous Product Manager system
│   ├── README.md              System overview
│   ├── architecture.md        Data flows and actors
│   └── milestones.md          M1-M8 implementation phases
│
├── code-mode/                 Claude Code SDK integration
│   ├── README.md              Overview and current state
│   ├── message-threading.md   Text/tool interleaving architecture
│   ├── tool-display.md        Tool widget patterns
│   └── infrastructure.md      Multi-user hosting options
│
├── research/                  Research notes and findings
│   └── 2025-12-22-knowledge-ingestion-design.md
├── incidents/                 Operational learnings
│
├── roadmap.md                 Product milestones and sequencing
├── AGENTS.md                  Instructions for AI maintaining this folder
│
└── [design + development specs at root level]
    ├── design-principles.md   Web UI/UX standards
    ├── design-system.md       Components, colors, typography
    ├── brand-essence.md       Brand philosophy for design decisions
    ├── language-audit.md      Tone and voice guidelines
    ├── users-should-feel.md   Emotional design targets
    ├── tech-architecture.md   Technology stack decisions
    ├── ai-first-development.md   Development paradigm
    ├── optimal-development-workflow.md   /autotask pattern
    └── model-rubric.md        Model selection criteria
```

---

## Key Files by Purpose

| If you need to...                   | Read this                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Understand what we're building      | [product/vision.md](./product/vision.md)                                                               |
| Know who we're building for         | [product/personas.md](./product/personas.md)                                                           |
| Check if something is in scope      | [product/boundaries.md](./product/boundaries.md)                                                       |
| See what's next                     | [roadmap.md](./roadmap.md)                                                                             |
| Build a specific feature            | [components/](./components/)                                                                           |
| Understand an architecture decision | [decisions/](./decisions/)                                                                             |
| Analyze a competitor                | [competitors/](./competitors/)                                                                         |
| Design UI                           | [design-principles.md](./design-principles.md), [design-system.md](./design-system.md)                 |
| Write copy                          | [language-audit.md](./language-audit.md), [brand-essence.md](./brand-essence.md)                       |
| Choose a model                      | [model-rubric.md](./model-rubric.md)                                                                   |
| Build code mode features            | [code-mode/](./code-mode/)                                                                             |
| Understand knowledge ingestion      | [components/knowledge-ingestion-engine.md](./components/knowledge-ingestion-engine.md)                 |
| Understand knowledge organization   | [decisions/knowledge-organization-architecture.md](./decisions/knowledge-organization-architecture.md) |

---

## Current State

**Milestone:** M2 (Relationship Grows) - Memory implementation in progress

**Recent completions:** M0, M0.5, M1 (Soul Proven)

**Active work:**

- Memory architecture (5-phase implementation)
- Knowledge ingestion engine design (complete - ready for implementation)
- Reasoning tokens display

See [roadmap.md](./roadmap.md) for full status and dependency graph.
