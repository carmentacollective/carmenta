# LobeChat

**Repo**: https://github.com/lobehub/lobe-chat **Last Active**: November 2025 (very
active, production-grade)

## What It Does

LobeChat is a comprehensive, open-source AI chat framework built for multiple platforms
(web, desktop, mobile). It's a feature-rich ChatGPT/LLM UI that prioritizes
extensibility, self-hosting, and multi-model provider support. Positioned as a modern
design system for AIGC applications with deep integrations for voice, vision, artifacts,
and plugin ecosystems.

## Features

**Core Chat & Conversations**

- Branching conversations with continuation/standalone modes
- Chain of thought visualization for reasoning transparency
- Markdown rendering with code highlighting, LaTeX formulas, Mermaid flowcharts
- Document mode vs chat bubble mode toggle
- Smooth streaming responses

**AI Capabilities**

- Multi-model service provider support (OpenAI, Claude, Gemini, Groq, Ollama, DeepSeek,
  etc.)
- Vision/image recognition (gpt-4-vision compatible)
- Text-to-speech (TTS) with multiple voice options (OpenAI Audio, Microsoft Edge Speech)
- Speech-to-text (STT) voice conversation
- Text-to-image generation (DALL-E 3, Midjourney, Pollinations)
- Local LLM support via Ollama

**Knowledge & Files**

- File upload and knowledge base creation
- Support for documents, images, audio, video
- File and knowledge base usage during conversations
- Knowledge-aware Q&A with context handling

**Extensibility**

- MCP (Model Context Protocol) plugin system with one-click installation
- MCP marketplace with curated integrations
- Function calling/plugin system (42+ available plugins)
- Plugin ecosystem for web search, data fetching, third-party services
- Agent marketplace (505+ pre-built agents/GPTs)

**Platform Support**

- Web desktop and mobile responsive design
- Desktop Electron app with native performance
- Progressive Web App (PWA) support
- Mobile device adaptation
- Custom themes (light/dark/color customization)

**Data & Sync**

- Local database (CRDT-based multi-device sync via PGLite)
- Server-side database (PostgreSQL)
- Multi-user management with next-auth and Clerk support
- Cross-device synchronization

**Advanced Features**

- Artifacts support (Claude-style inline document creation)
- Smart internet search with real-time data
- Desktop window management and menu configuration
- Compression for conversation storage
- Activity logging

## AI-First SDLC

Exceptional implementation of AI-assisted development practices checked into repo:

**Cursor Rules Foundation** (.cursor/rules/)

- Comprehensive cursor rules for every aspect: react components, TypeScript, zustand
  patterns, desktop features, testing, i18n
- Domain-specific guides: `add-provider-doc.mdc`, `add-setting-env.mdc`,
  `db-migrations.mdc`, `desktop-local-tools-implement.mdc`
- Testing-specific rules with environment configuration details
- React component pattern guide with antd-style and lobe-ui usage
- Zustand state management patterns with optimistic update examples

**CLAUDE.md Files at Package Level**

- Root `CLAUDE.md` with tech stack references, git workflow, testing commands, i18n
  strategy
- Package-specific `CLAUDE.md` files (model-runtime, prompts) for specialized knowledge
- References @rules format for composable rule loading

**Prompt as Code Discipline** (packages/prompts/)

- Entire prompt engineering package with TypeScript-based prompts
- Promptfoo integration for evaluating prompt quality across multiple models
- Structured prompt testing with eval.yaml, prompt.ts, tests/basic-case.ts pattern
- 7 production prompt chains: emoji-picker, translate, knowledge-qa, summary-title,
  language-detection, abstract-chunk, supervisor
- Test cases written as TypeScript with multi-language coverage, edge cases, assertions

**Prompt Testing Pattern**

```
promptfoo/{prompt-name}/
├── eval.yaml              # Config: providers, prompt refs, test refs
├── prompt.ts              # TypeScript prompt wrapper
└── tests/
    └── basic-case.ts      # TypeScript test cases (multilingual, edge cases)
```

**Production Prompt Examples**

- Emoji selection with topic-based prioritization and cultural awareness
- Knowledge Q&A with context relevance detection
- Title generation with character/word limits
- Language detection
- Translation with technical term preservation
- Chain implementations exported from main package and reused in tests

**Git Workflow in CLAUDE.md**

- Release branch is 'next' (v2.0 development)
- Gitmoji prefix convention for commits
- Branch naming: `author/type/feature-name`
- Pull request template usage
- Monorepo with pnpm
- Comprehensive testing commands with file-path filtering

**Model Runtime Documentation**

- Test coverage documentation with testing strategies
- Provider implementation guides

## Novel/Interesting

**Prompt Testing as First-Class Concern**

- Built entire package around prompt evaluation (promptfoo)
- Tests prompts across multiple models simultaneously (GPT, Claude, Gemini, DeepSeek)
- TypeScript-based test cases with assertions: llm-rubric, contains, javascript, regex
- Multilingual test coverage built into every prompt
- Optimizing prompts for "5-10% improvement per iteration" methodology
- Actual chain implementations in src/chains/ that are wrapped and tested separately

**State Management Architecture**

- Zustand store slices with clear action stratification: public actions, internal
  actions, dispatch methods
- Optimistic updates pattern: immediate state update, backend call, consistency refresh
- Zustand slice organization guide with specific patterns for complex scenarios
- Action loading states managed per-entity with temporary IDs

**Data Persistence Abstraction**

- Elegant client/server split: services/domain/client.ts vs services/domain/server.ts
- Cross-platform data flow architecture documented (web+clientDB, web+serverDB, desktop
  with/without cloud)
- PGLite in browser (WASM) with fallback to PostgreSQL
- CRDT technology for offline-first sync

**Monorepo with Workspace Packages**

- Semantic package naming: @lobechat/ui, @lobechat/prompts, @lobechat/database,
  @lobechat/model-runtime
- Shared types, utilities, components exposed as packages
- Database layer isolated as package with schemas, models, repositories (BFF queries)
- Model runtime abstraction for provider implementations

**Desktop Architecture**

- Electron client/server IPC packages (electron-client-ipc, electron-server-ipc)
- Desktop-specific Cursor rules for window management, menu configuration, local tool
  implementation
- Desktop controller tests patterns
- Desktop app as first-class platform alongside web

**Comprehensive Testing Story**

- 3000+ test cases with performance awareness
- Dual environment setup: DOM (client) and Node (server database tests)
- PGLite for browser testing, real PostgreSQL for server tests
- Vitest with per-file filtering to avoid 10-minute full runs
- Test repair principles documented: context collection, test-first fixes, single
  problem focus

**i18n as Architecture**

- Namespace-based localization (locales/default/namespace.ts)
- Auto-sync CI workflow for agent translations to multiple languages
- i18n cursor rule with strategy for handling translation edge cases

**Provider Abstraction**

- Modular provider implementation with specific cursor rules for adding new providers
- Model runtime package with provider abstraction pattern
- Environment-based provider configuration (env.example lists 40+ provider options)

## Tech Stack

**Frontend Framework**

- Next.js 15 with React 19
- TypeScript with strict mode
- antd-style for CSS-in-JS with token system
- Ant Design Pro Components
- @lobehub/ui custom component library

**State & Data**

- Zustand for state management
- TanStack SWR for data fetching
- nuqs for search params management
- TRPC for type-safe RPC
- PGLite (browser WASM) + Drizzle ORM

**UI & UX**

- Flexbox layouts (react-layout-kit)
- Lucide React + Ant Design Icons
- React i18next for multilingual support
- @khmyznikov/pwa-install for PWA

**AI/LLM Integration**

- @anthropic-ai/sdk (Claude)
- @google/genai (Gemini)
- @huggingface/inference
- @langchain/community
- @fal-ai/client
- Custom agent-runtime package

**Testing & Quality**

- Vitest for unit/integration tests
- Promptfoo for prompt evaluation
- @cfworker/json-schema for validation
- e2e tests with custom config

**DevOps & Infrastructure**

- Docker deployment support
- Vercel, Zeabur, Sealos, Alibaba Cloud ready
- AWS S3 support (@aws-sdk/client-s3)
- Azure AI integration

**Developer Experience**

- pnpm monorepo
- Husky for git hooks
- Commitlint with gitmoji convention
- Comprehensive Cursor rules (24 rule files)

## Steal This

1. **Prompt Testing Framework**: Build prompts as code with automated evaluation across
   models. This is your competitive advantage for quality assurance at scale.

2. **Cursor Rules as Architecture Decision Record**: Use cursor rules not just for
   style, but to encode architectural patterns, data flow, state management strategies.
   Your CLAUDE.md can reference @rules for composable knowledge.

3. **Action Stratification Pattern**: Public (UI-facing) vs Internal (service-calling)
   vs Dispatch (state-changing) actions. Eliminates confusion about where logic lives.

4. **Dual Database Architecture**: Give users choice between local-first (browser WASM)
   and server (PostgreSQL). This is table stakes for modern AI apps.

5. **Monorepo Package Boundaries**: Extract abstract concepts into workspace packages
   (@lobechat/model-runtime, @lobechat/prompts). Makes testing, reuse, and documentation
   easier.

6. **Provider Abstraction**: Don't hardcode AI providers. LobeChat's provider
   architecture lets users swap Claude→GPT→Gemini. Document patterns for adding new
   ones.

7. **Prompt Engineering as Package**: Check prompts into version control as first-class
   code. Test them. Iterate. Document in CLAUDE.md alongside tests.

8. **MCP Integration**: Model Context Protocol is the new standard for AI app
   extensibility. Study their implementation for inspiration.

9. **Desktop as Co-Equal Platform**: Not an afterthought. LobeChat has desktop-specific
   rules, IPC abstractions, window management patterns. Plan for this.

10. **Performance-Aware Testing**: 3000 tests shouldn't require 10-minute runs. Build
    filtering, use test naming conventions, document in CLAUDE.md so developers don't
    run the full suite by accident.
