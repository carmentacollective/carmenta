# CopilotKit

**Repo**: https://github.com/CopilotKit/CopilotKit
**Last Active**: November 2025 (extremely active - commits daily)
**Language**: TypeScript/JavaScript, Python
**License**: MIT
**Community**: 33+ examples, active Discord, established on Product Hunt

## What It Does

CopilotKit is a production-ready framework for building in-app AI copilots and agents that work inside user applications. It's not a chat product itself—it's an SDK that helps developers embed AI assistants into their apps with deep state integration. The framework abstracts backend agent frameworks (LangGraph, CrewAI, Mastra) through the AG-UI protocol, letting developers switch backends without UI changes. It handles the glue between frontend apps and AI agents, managing real-time state sync, tool calls, streaming, and human-in-the-loop workflows.

## Features

**Frontend Layer (React)**
- Headless chat hook (`useCopilotChat`) with full message control
- Pre-built components: `CopilotPopup`, `CopilotSidebar`, `CopilotModal` with deep customization
- Custom UI building via components from `react-ui` package
- Message streaming with progressive rendering
- Chat suggestions/auto-prompts system
- Dev console for debugging chat state and actions

**Agent Integration**
- CoAgents: Multi-agent orchestration with shared state
- LangGraph integration with intermediate state streaming (emit agent thinking)
- CrewAI integration (crews and flows)
- Mastra integration
- Support for Python (`sdk-python`) and JavaScript (`sdk-js`) agents
- Wait-for-user-input patterns (human-in-the-loop)

**Action System (Frontend ↔ Agent Communication)**
- `useCopilotAction` hook: declare functions agents can call
- `useCoAgentStateRender`: render UI based on agent state changes
- `renderAndWaitForResponse`: approval patterns (email confirmation, etc.)
- Generative UI: agents render components, not just text
- Frontend tool calls: agents request frontend actions (scroll, fill form, etc.)
- Full TypeScript support with `MappedParameterTypes` for type-safe parameters

**Backend Runtime**
- GraphQL API (`@copilotkit/runtime`)
- Service adapters: OpenAI, Anthropic, Google Gemini, Groq, Llama models
- Prompt injection protection and allowlist-based security
- Support for tool calls across multiple LLM providers
- Express integration for running agents
- Type-safe agent definitions with Zod schemas
- Telemetry integration (Scarf)

**AG-UI Protocol (Open Standard)**
- Event-based protocol for agent-UI communication
- Framework-agnostic: works with LangGraph.js, Python, CrewAI, Pydantic AI, Mastra
- Handles streaming, interrupts, tool calls, state sync
- Enables swappable backends without changing UI code

**Data Grounding & Search**
- Built examples with vector databases: Pinecone, MongoDB Atlas
- RAG patterns for "chat with your data"
- Anthropic Claude integration examples

**Documentation & Developer Experience**
- 35+ working examples (form filling, state machines, research agents, travel planning)
- Cursor rules for AI-assisted development (comprehensive .cursor/rules/ directory)
- Extensive documentation site (docs/ folder)
- CLI: `npx copilotkit@latest init` for rapid setup
- Component registry for reusable UI pieces

## AI-First SDLC

**Cursor Integration**: 8 cursor rule files committed to repo:
- `copilotkit-architecture.mdc` - System overview with file references for AI navigation
- `agent-development.mdc` - Agent patterns, setup, examples
- `development-workflow.mdc` - Monorepo structure, scripts, testing
- `frontend-development.mdc` - (likely frontend-specific patterns)
- `suggestions-development.mdc` - (likely for copilot suggestions)
- `examples-and-demos.mdc` - Example navigation
- `quick-reference.mdc` - Quick lookup for common tasks
- `working-with-rules.mdc` - How to use the rules system

**Monorepo Architecture for AI Teams**: Workspace setup designed for LLM tools:
- Clear package boundaries with function-specific docs
- Example-driven structure: 35+ examples as reference patterns
- Shared scripts, utilities, and templates in `examples/shared/`
- Docker configurations for different component types

**Development Scripts**: Automation scripts in `/scripts` for docs generation, QA, releases—infrastructure that assumes AI-assisted workflows

**No CLAUDE.md found**: Unlike Carmenta, CopilotKit doesn't embed heart-centered philosophy in CLAUDE.md, but the cursor rules are sophisticated and well-organized.

## Novel/Interesting

**1. AG-UI Protocol (Open Standard)**
- Most sophisticated thing here: invented a lightweight event-based protocol that abstracts agent frameworks
- Enables true backend flexibility—swap LangGraph for CrewAI without touching UI
- This is a bet that frameworks are interchangeable; UI is the differentiator

**2. Intermediate State Streaming**
- Agents can emit intermediate states (thinking, planning) to frontend in real-time
- Example: streaming outlines before final content, showing agent reasoning
- Most chat interfaces hide the agent's work; CopilotKit surfaces it

**3. Generative UI Pattern**
- Agents don't just send text—they send React components
- Example: agent calls `appendToSpreadsheet` action which renders a Spreadsheet component live
- Moves beyond text responses to interactive, rendered agent outputs

**4. Type-Safe Action Parameters**
- Uses TypeScript generics (`MappedParameterTypes<T>`) to map parameter definitions to actual types
- Agents and frontend share the same type contracts
- Prevents parameter mismatches between agent calls and handlers

**5. Human-in-the-Loop as First-Class**
- `renderAndWaitForResponse` pattern treats approval workflows as primitive
- Agents pause, frontend renders confirmation UI, user approves, agent resumes
- Not bolted on; deeply integrated into the action system

**6. Structured State Sync**
- Shared state between agent and UI, kept in sync via AG-UI events
- Agents can read/write app state; UI updates automatically
- Goes beyond message history to actual application state integration

**7. Multi-Agent Routing**
- Examples show agents coordinating with each other (routing patterns)
- Not just single agent per chat; supports agent teams
- State management for multi-agent flows with shared context

**8. Component Registry**
- `/registry` folder with reusable chat components, quickstarts
- Building blocks philosophy—compose components, don't start from scratch
- Some components in registry are community-contributed

**9. Development Patterns**
- `/examples/shared/` has templates: `requirements-template.txt`, `pyproject-template.toml`
- New agent projects copy templates, not scaffolded—more flexible
- Shows maturity: they've optimized for "what do developers actually copy?"

## Tech Stack

**Frontend**: React 18+, Next.js, TypeScript, Tailwind CSS
**Streaming/Real-time**: GraphQL Yoga (with defer-stream plugin), RxJS, WebSockets
**State Management**: React Context (minimal, intentional)
**UI Components**: Built in plain React + Tailwind, no third-party UI library dependency
**Backend**: Express.js, GraphQL, Type-GraphQL, class-validator
**LLMs**: OpenAI, Anthropic, Google Gemini, Groq, Llama (via service adapters)
**Agent Frameworks**: LangGraph, CrewAI, Mastra, Pydantic AI (AG-UI protocol)
**Python SDK**: FastAPI-ready, decorator-based action definitions
**Database Options**: Pinecone, MongoDB Atlas (examples), any vector DB
**Testing**: Jest, Playwright (e2e), Testing Library
**Build**: Turbo monorepo, tsup, pnpm workspaces
**Deployment**: AWS CDK (in `/infra`), Kubernetes (helmfile examples), Docker

**Key Libraries**:
- `class-transformer`, `class-validator` - Decorator-based validation
- `partial-json` - Handle incomplete JSON from streaming LLMs
- `zod` + `zod-to-json-schema` - Type-safe schemas and JSON schema generation
- `untruncate-json` - Fix truncated JSON from token limits
- `pino` - Structured logging (production-ready)
- `@segment/analytics-node` - Usage tracking
- `@ag-ui/*` - AG-UI protocol packages

## Steal This

**For Carmenta**:

1. **AG-UI Protocol Concept**: The idea of a backend-agnostic protocol is powerful. If Carmenta is voice-first, consider whether you need a similar abstraction for voice agent backends vs. chat backends.

2. **Intermediate State Streaming**: Surface agent reasoning in real-time. Don't hide thinking—make it part of the experience. Shows the AI is working, builds trust.

3. **Generative UI Pattern**: Move beyond text responses. Let the AI render actual UI components. This bridges the gap between chat and app control.

4. **Type-Safe Parameters**: Use TypeScript generics to enforce contracts between frontend and backend. Catch mismatches at compile time, not runtime.

5. **Human-in-the-Loop as Primitive**: Approval workflows shouldn't be special-cased. Make pause/render/resume a standard part of agent execution.

6. **Monorepo + Cursor Rules**: Their approach to organizing for AI tools is sophisticated. Well-structured rules with file references help LLMs navigate. Consider similar for Carmenta's spec-driven approach.

7. **Component Registry Philosophy**: Instead of one-size-fits-all components, provide building blocks. Let developers compose, not customize endlessly.

8. **Shared State Over Message History**: Sync actual app state with agents, not just chat messages. This enables agents to truly understand app context.

9. **Template Over Scaffold**: Provide copyable templates for common patterns (agent setup, action definitions). More flexible than generated code.

10. **Example-Driven Development**: 35+ examples is their real documentation. Each shows a pattern. For Carmenta's voice-first interface, consider voice-specific examples early.

11. **Open Standard Play**: AG-UI is becoming an open standard. If Carmenta builds proprietary, consider whether an open protocol layer would increase adoption.

12. **Multi-Agent Coordination**: Examples show agent routing and teams. Voice interface could route requests between multiple AI agents transparently.
