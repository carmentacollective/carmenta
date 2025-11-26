# assistant-ui

**Repo**: https://github.com/assistant-ui/assistant-ui
**Last Active**: November 2025 (very active - daily commits)
**Traction**: 400k+ monthly npm downloads, backed by Y Combinator

## What It Does

assistant-ui is an open-source React component library for building production-grade AI chat interfaces. It's positioned as "The UX of ChatGPT in your React app" — providing fully composable, customizable primitives inspired by shadcn/ui and cmdk rather than monolithic components. The library handles streaming, auto-scrolling, accessibility, and real-time updates while letting developers compose and style every pixel. Works with AI SDK, LangGraph, Mastra, or custom backends.

## Features

**Core Primitives (Composable Components)**
- Thread (message list container with viewport management)
- Message (individual message container)
- MessagePart (text, images, data, files, reasoning, source)
- Composer (input area with attachments, dropzone)
- ActionBar (copy, edit, regenerate, delete actions per message)
- BranchPicker (message version switching)
- Attachment (file preview, remove, metadata)
- ThreadList (conversation threads)
- ThreadListItem (individual thread)
- AssistantModal (floating chat window)
- Error (error boundary component)

**Built-In Features**
- Streaming with auto-scroll and scroll-to-bottom detection
- Markdown rendering with syntax highlighting
- Code block highlighting (Shiki)
- File attachments with preview
- Tool rendering and human tool calls
- Frontend tool execution (LLM can trigger client-side actions)
- Human approval collection (inline approvals for tool execution)
- Keyboard shortcuts and accessibility (a11y)
- Real-time updates and state management
- Attachment dropzone support
- Message branching (alternate responses)

**Generative UI / Tool Integration**
- Map LLM tool calls to custom React components
- Render arbitrary JSON responses as components
- Frontend tool calls for safe client-side actions
- Human tool calls for approval workflows
- Tool UI customization via AssistantTool
- Tool state tracking and execution status

**State Management**
- **tap**: Custom reactive resource library (React hooks pattern outside React components)
- **store**: Tap-based state management with React Context
- Module augmentation for type-safe scopes
- Derived scopes for hierarchical state
- tapLookupResources for list management
- Provider pattern for scoped access

**Backend Integrations**
- AI SDK (Vercel AI SDK v5) with AssistantChatTransport
- LangGraph with built-in interrupt() support
- Mastra agents/workflows/RAG
- Custom backends via transport protocol
- Assistant Cloud (managed persistence + analytics)
- Support for 20+ LLM providers (OpenAI, Anthropic, Mistral, Perplexity, AWS Bedrock, Azure, Google Gemini, Hugging Face, Fireworks, Cohere, Replicate, Ollama, etc.)

**Python Support**
- assistant-stream: Streaming protocol for Python
- assistant-transport-backend: Backend implementation
- assistant-transport-backend-langgraph: LangGraph integration
- assistant-ui-sync-server-api: Sync server for persistence
- state-test: Testing utilities

**Developer Tools**
- DevTools (React component library for debugging)
- DevTools Chrome extension
- Event logging and context inspection
- Real-time state viewer

**Examples**
- AI SDK v5 integration
- LangGraph with streaming
- Assistant Transport (custom backend protocol)
- Assistant Cloud (managed backend)
- Store example (state management demo)
- Parent ID grouping (message organization)
- React Hook Form integration
- ag-ui styling demo
- FFmpeg integration
- External store pattern

## AI-First SDLC

**Evidence Found:**
- Automated Claude Code reviews on every PR with sophisticated prompt (claude-code-review.yml)
- Manual Claude Code invocation workflow for contributors (@claude mentions in comments)
- Permission gating: requires write access to trigger Claude Code
- Sticky comments with progress tracking on PRs
- Handles both internal PRs and fork PRs with different strategies
- Uses MCP tools for GitHub integration (inline comments, CI status checks)
- Comprehensive review prompt that checks:
  - Changesets for published packages
  - Documentation for API changes
  - Code quality, bugs, security, performance
  - Test coverage
- Previous comment minimization for fork PRs
- CI result integration into review context

This is sophisticated AI-assisted development — they've built workflows that let Claude Code review PRs autonomously while maintaining security and code quality standards.

## Novel/Interesting

**1. TAP (Reactive Resources) — Hooks Outside React**
The most novel architectural decision. Extracted React's hooks mental model into a zero-dependency reactive library that works anywhere (vanilla JS, servers, etc.). This is genuinely clever:
- Same useState/useEffect/useRef API developers already know
- Composable resource lifecycle management
- Works outside React components
- Enables state management without Redux/Zustand

**2. Scope-Based State with Module Augmentation**
Type-safe scope definition via TypeScript module augmentation in the store package. Developers define custom scopes by extending interfaces — this provides both type safety and composability without runtime overhead.

**3. Composable Primitives Philosophy**
Unlike competitors (Vercel's built-in chat, Claude.ai clones), they chose Radix/shadcn-style primitives over a monolithic component. Each primitive composes (Thread > Message > MessagePart), letting developers customize at any level while inheriting defaults.

**4. Transport Protocol Abstraction**
Created a pluggable "assistant-transport" protocol that lets any backend (AI SDK, LangGraph, custom) work uniformly. Backends implement the same interface, so switching providers is config-level, not code-level.

**5. Tool Rendering as First-Class Feature**
Not bolted-on, but deeply integrated. Tools appear in messagePart, have their own UI registration system (AssistantTool), support frontend execution and human approvals. The model-context/toolbox system is well-architected.

**6. DevTools as Reusable Components**
Built the Chrome DevTools extension by consuming reusable React components from react-devtools package. The extension isn't separate — it's just a host consuming the same component library.

**7. Cloud Backend as Optional Enhancement**
Instead of locking users into a backend, they built Assistant Cloud as an optional layer (single env var). Developers can use AI SDK + their own backend, or layer on managed persistence/analytics. Clean architecture.

**8. Monorepo with Coherent Package Design**
22 focused packages with clear boundaries:
- Core: react, store, tap
- Integrations: react-ai-sdk, react-langgraph
- Rendering: react-markdown, react-syntax-highlighter
- Utilities: react-hook-form, react-data-stream
- Tools: react-devtools, cli, mcp-docs-server
- Styling: styles, tw-shimmer, react-ag-ui

No bloat — each package does one thing.

**9. Stream Protocol Decoupling**
assistant-stream (Python) is a separate implementation of the streaming protocol, not a Python SDK wrapper. Lets backend devs implement streaming independently.

## Tech Stack

**Core**
- TypeScript 5.9, React 19
- Tailwind CSS v4, shadcn/ui patterns
- pnpm workspaces, Turbo monorepo

**State Management**
- Custom: tap (reactive resources), store (scope-based)
- No Redux/Zustand dependency

**Rendering**
- Shiki (syntax highlighting)
- Custom Markdown rendering (not remark/MDX)
- Radix UI for primitives philosophy (not actual Radix, but inspired)

**Testing**
- Vitest for unit tests
- Stryker for mutation testing

**Backend Integrations**
- Vercel AI SDK (official integration)
- LangChain/LangGraph
- Mastra
- Custom protocol support

**Python**
- FastAPI assumed (transport backend examples)
- LangGraph integration

**DevOps**
- GitHub Actions for CI
- Changeset for release management
- Claude Code for automated PR reviews
- Prettier + ESLint

## Steal This

**For Carmenta:**

1. **Composable Primitives Over Monoliths**: Their architecture (primitives that compose) beats locked-in components. Memory-aware voice-first can follow this: Voice primitives (voice input, audio playback), memory primitives (recent context, long-term), rather than one "AI assistant" component.

2. **TAP as State Solution**: If Carmenta builds custom backends, TAP's resource model is lighter than traditional state management. The "hooks everywhere" model resonates with their React-first approach.

3. **Transport Protocol Abstraction**: Carmenta needs to support "any backend" as a founding principle. Learning from assistant-ui's transport protocol (unified interface, pluggable backends) is valuable. Makes switching from Claude to GPT to local models frictionless.

4. **TypeScript Module Augmentation for Extensions**: Using TS module augmentation for type-safe plugin systems (they do this with scopes) is elegant. Carmenta could use this for memory backends, voice providers, integrations.

5. **AI-Assisted Development Workflows**: Their Claude Code automation (PR reviews, issue handling) is production-ready. If Carmenta adopts similar workflows, standardize early.

6. **DevTools as Components**: Building debugging/devtools as consumable React components (not just extensions) enables embedding them in the app. Useful for Carmenta's "working at the speed of thought" — real-time visibility into memory/context.

7. **Scope-Based Architecture**: Memory contexts (thread, user, org, model-specific) could be scopes. Type-safe, composable, inheritable. Clean mental model.

8. **Provider Pattern for Hierarchy**: Their provider pattern for scoped access (thread-level, message-level) maps naturally to Carmenta's nested memory/context hierarchy.

9. **Optional Managed Backend**: Just as they offer Assistant Cloud as optional enhancement, Carmenta could offer a managed backend while supporting self-hosted alternatives. Doesn't lock users in.

10. **Monorepo with Coherent Boundaries**: 22 focused packages. If Carmenta grows, similar discipline (voice, memory, reasoning, core UI, etc. as separate packages) prevents monolith sprawl.

