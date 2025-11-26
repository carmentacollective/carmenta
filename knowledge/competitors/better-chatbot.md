# Better Chatbot

**Repo**: https://github.com/cgoinglove/better-chatbot
**Last Active**: November 2025 (actively maintained with weekly releases)

## What It Does

Better Chatbot is an open-source AI chat interface template built with Next.js and Vercel's AI SDK. It's positioned as an alternative to ChatGPT/Claude with a focus on multi-AI integration, tool orchestration via MCP (Model Context Protocol), and workflow automation. Targets individual users and small teams who want to self-host an AI assistant with extensive customization, multi-provider support, and visual workflow building.

## Features

**Core Chat Experience**
- Multi-AI provider support: OpenAI, Anthropic (Claude), Google Gemini, xAI Grok, Ollama, Groq, OpenRouter, Azure OpenAI
- Dynamic model selection with provider validation (shows only providers with active API keys)
- Realtime voice chat with OpenAI Realtime API (with full MCP tool integration)
- `@mention` system for quick tool/agent/workflow invocation during conversation
- Tool choice modes: Auto (LLM decides), Manual (ask permission), None (disabled)
- Temporary chat windows for quick side questions
- Chat history with export functionality
- Chat threading with auto-generated titles

**MCP Tool Integration**
- Full Model Context Protocol support for extensible tool ecosystem
- Multiple transport types: stdio (local), SSE, StreamableHTTP (remote)
- Dynamic MCP server management (add/remove without restarting)
- Pre-built tools: web search (Exa AI), JS/Python execution, HTTP requests, data visualization
- Tool testing interface outside of chat
- File-based or database-based MCP configuration
- MCP OAuth flow support for authentication in tool calls
- Custom instructions per MCP server or individual tool

**Visual Workflows & Automation**
- Node-based workflow builder using @xyflow (visual DAG editor)
- Workflow node types: Input, Output, LLM, Condition, Tool, HTTP, Template, Code (planned)
- Conditional branching with dynamic evaluation
- Data flow between nodes via schema references
- Workflows become callable tools in chat (`@workflow_name`)
- Cycle detection to prevent invalid workflows
- Example workflows included (weather queries, research tasks)

**Custom Agents**
- Create specialized AI agents with custom instructions and tool access
- Agent sharing across workspace
- Agents invoked via `@agent_name` in chat
- System prompt generation from user requirements
- Agent archiving and organization

**Data & File Handling**
- File upload support (Vercel Blob default, S3 coming soon)
- Image generation and editing (OpenAI, Gemini Nano Banana)
- Interactive data visualization: tables with sorting, filtering, search, export (CSV/Excel), pagination
- Chart generation (bar, line, pie)
- CSV ingestion with semantic understanding
- Image input support for models that enable it (GPT-4V, Claude, Gemini, Grok)

**User Customization**
- Multi-layered system prompts: base → user preferences → project context → MCP customizations
- User preferences: bot name, role/profession, response style
- Tool presets for rapid tool switching by task
- Custom instructions for MCP servers and individual tools
- User role/profession context for tailored responses
- Persistent preferences stored per user

**Authentication & Multi-User**
- Better Auth integration with social login (Google, GitHub, Microsoft OAuth)
- Admin role and role-based access control
- Optional sign-up disabling
- User account management

**Advanced Features**
- Sequential thinking tool (extended reasoning)
- LaTeX/TeX math equation rendering
- Markdown support with syntax highlighting, code blocks, math
- Mermaid diagram support
- Real-world API integrations: Exa AI search, image generation providers
- Multi-language UI support (i18n)
- Dark/Light theme toggle

## AI-First SDLC

**Evidence of AI Development Practices:**
- AGENTS.md file exists documenting agent architecture
- Comprehensive contributing guide emphasizing pull request descriptions and visual documentation
- Test infrastructure: 48 end-to-end Playwright tests covering core functionality
- Vitest for unit testing with test files co-located next to source
- Biome for formatting/linting with automated fixes
- Release Please automation for semantic versioning and changelog generation (Conventional Commits required in PR titles)
- Husky pre-commit hooks for code quality gates
- GitHub Actions for CI/CD (inferred from playwright.config.ts and test setup)
- Prompt engineering embedded throughout: system prompts are carefully constructed for agent generation, chat behavior, and tool instruction binding
- No explicit `.cursorrules` or custom Cursor configuration found, but prompt quality suggests AI-assisted development

**Development Velocity:**
- Extremely rapid iteration: v1.26.0 released November 2025, averaging 2-3 releases per month
- Large feature additions shipped consistently (workflows, agents, voice, MCP OAuth, image generation)
- Community-driven contributions with clear guidelines for PRs

## Novel/Interesting

**Visual Workflow Execution Engine**
The workflow system using @xyflow is genuinely clever—it's a full DAG executor that:
- Validates acyclic constraints before execution
- Extracts node dependencies automatically
- Pipes schema-referenced data between arbitrary node types
- Supports conditional branching with runtime evaluation
- Works within the chat interface (workflows become tools)
This is far more sophisticated than typical "chatbot" features and suggests deeper automation thinking.

**MCP Tool Mention Filtering**
The `@mention` system doesn't just invoke tools—it filters which tools are sent to the LLM in that specific response. This is a clever token optimization: "Since only the mentioned tools are sent to the LLM, this saves tokens and can improve speed and accuracy." Different from always-available tools.

**Dual Tool Selection Strategies**
Explicitly offers two different mental models: "Tool Selection" (tools always available across chats, consistent context) vs "@mentions" (temporary, token-efficient). Users can combine both, suggesting deep thinking about tool interaction patterns.

**Multi-Layered System Prompt Architecture**
The prompt system elegantly layers: base behavior → user preferences → project context → tool-specific instructions. Only relevant context activates when needed. This is more sophisticated than typical "system prompt" handling.

**Custom Model Provider Abstraction**
The models.ts file elegantly handles multiple SDK versions (Vercel AI SDK providers, OpenRouter, Azure, Ollama, etc.) with a unified interface. File mime-type support is registered per-model with intelligent fallbacks. Shows thoughtful platform abstraction.

**File-Based or DB-Based MCP Configuration**
Can switch between database and file-based MCP configs at runtime (FILE_BASED_MCP_CONFIG env toggle). Enables local development workflows without database setup.

## Tech Stack

**Frontend**
- Next.js 16 (App Router)
- React 19
- TypeScript with strict typing
- Tailwind CSS 4.1 + Radix UI (comprehensive component library)
- TipTap for rich text editing with mention support
- @xyflow for workflow visualization
- Framer Motion for animations
- React Markdown with syntax highlighting (Shiki)
- SWR for data fetching

**Backend & Infrastructure**
- Next.js API Routes
- PostgreSQL (Drizzle ORM for type-safe queries)
- Redis (ioredis, optional)
- Vercel Blob for file storage (with S3 coming)
- Better Auth for authentication
- Vercel deployment (but Docker support included)

**AI & Integration**
- Vercel AI SDK v5.0+ (core abstraction layer)
- Multiple provider SDKs: OpenAI, Anthropic, Google, xAI, Groq, OpenRouter
- Model Context Protocol (@modelcontextprotocol/sdk)
- OpenAI Realtime API for voice chat
- Exa AI for semantic web search

**Code Quality**
- Biome 1.9.4 for formatting and linting
- Vitest for unit testing
- Playwright for end-to-end testing (48 tests)
- Husky + lint-staged for pre-commit hooks
- ESLint with Next.js config
- TypeScript strict mode

## Steal This

**1. MCP Tool Mention Filtering**
The ability to scope which tools are sent to the LLM in a single response is clever. Implement `@mention`-triggered tool filtering in Carmenta to reduce token usage and improve response accuracy for tool-heavy chats.

**2. Visual Workflow Builder with DAG Execution**
Carmenta should seriously consider a visual workflow feature using @xyflow. This enables power users to create reusable automation sequences without code. The workflow-as-tool pattern (making workflows callable in chat) is particularly valuable.

**3. Schema-Based Data Flow Between Nodes**
The workflow system uses output schema validation and path-based references to connect nodes. Adopt this pattern for any node/step system Carmenta builds—it's more flexible than string-based connections.

**4. Multi-Layered, Context-Aware System Prompts**
Better Chatbot's approach of layering prompts (base → user → project → tool-specific) is more elegant than single system prompts. Carmenta's "memory-aware" positioning should lean into this: different system prompt contexts per conversation type.

**5. Dual Tool Strategy (Always Available vs Mentioned)**
Don't force one mental model. Offer both "Tool Selection" (tools always available) and "@mentions" (temporary binding). Users will naturally prefer different models for different workflows.

**6. Reusable Model Provider Abstraction**
The models.ts file elegantly handles provider variation without messy conditional logic. Carmenta's multi-AI support should use similar abstraction—register capabilities per model (file types, tool support, etc.) as metadata rather than scattered conditionals.

**7. Environment-Based Configuration Flexibility**
FILE_BASED_MCP_CONFIG toggle showing how to swap storage backends without code changes. Carmenta's configuration should be similarly flexible for different deployment scenarios.

**8. Comprehensive Test Infrastructure for AI Features**
Better Chatbot's E2E test suite validates agent behavior, model selection, multi-user scenarios, and tool execution. Carmenta should prioritize similar test coverage as core features ship—this is non-negotiable for "builds with AI teams" positioning.

**9. Community-First Development Cadence**
The weekly release cycle with Conventional Commits and automated Release Please is how to keep momentum. Carmenta's AI-First SDLC should document this pattern as part of project DNA.

**10. Voice Chat with MCP Integration**
The OpenAI Realtime API voice assistant that can invoke MCP tools is a differentiation point. If Carmenta emphasizes "voice-first," this is the implementation model to study.

