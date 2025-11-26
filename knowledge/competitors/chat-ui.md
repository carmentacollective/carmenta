# HuggingFace Chat UI

**Repo**: https://github.com/huggingface/chat-ui
**Last Active**: November 2025 (very active)

## What It Does

HuggingFace Chat UI is a production-grade web interface for conversational AI. It powers HuggingChat on huggingface.co/chat. It's a SvelteKit application designed to work with any OpenAI-compatible LLM API, making it agnostic to the underlying model provider. The architecture emphasizes streaming, real-time updates, and extensibility through MCP (Model Context Protocol) servers for tool calling.

## Features

### Core Chat Experience
- Real-time message streaming with token-by-token updates
- Conversation history with tree-based navigation (branching conversations with alternatives)
- Message editing and regeneration (retry from any message)
- Multi-model support with dynamic model switching during chat
- System prompt customization per conversation
- Share conversations with unique links (shareable read-only mode)
- Session-based persistence with MongoDB

### Content Input & Processing
- File uploads (images, documents) with automatic type validation
- Direct URL fetching for loading external content
- Clipboard paste detection and file conversion (converts large pastes >3984 chars to files)
- Multi-modal input support (images + text) for compatible models
- Drag-and-drop file upload

### Advanced Generation Features
- **Reasoning mode support**: Models that expose reasoning tokens (e.g., DeepSeek-R1) stream reasoning separately from final answer
- **ETA estimation**: Tool calls display estimated completion time with animated progress bars
- **Router/Model Selection**: "Omni" virtual model uses Arch router to dynamically select best model per turn based on context
- **Multimodal routing**: Routes image inputs to compatible models automatically
- **Tool routing**: Auto-selects models with tool-calling support when MCP tools are enabled

### MCP Integration (Model Context Protocol)
- Configure trusted MCP servers (environment-based or user-added)
- Server health checks with fallback transports (HTTP then SSE)
- Tool discovery and display with parameter introspection
- Tool execution with result streaming (text, images, structured data)
- Tool call state visualization (parameters, results, errors)
- Per-model tool calling capability overrides in settings
- Automatic MCP token forwarding to HuggingFace endpoints

### User Authentication & Session Management
- OpenID Connect (OIDC) authentication with configurable providers
- Session cookies with automatic refresh (2-week expiry)
- Per-user conversation isolation
- Email whitelisting by domain or specific addresses
- Token-based API access for programmatic chat

### Model Management
- Automatic model list fetching from OpenAI-compatible `/models` endpoint
- Model metadata: description, logo, website, dataset info, prompt examples
- Per-model parameter configuration (temperature, top_p, top_k, max_tokens, etc.)
- Tool calling capability detection per model
- Multimodal input capability override per model
- Model-specific system prompt support toggle

### Search & Discovery
- Full-text search across conversations and messages
- Conversation sidebar with pagination
- Infinite scroll for long conversations

### Analytics & Metrics
- Prometheus metrics export
- Conversation statistics (message count, token usage)
- User activity tracking
- Generation performance monitoring

### Administration
- Admin panel with user management (view, edit, delete users)
- Conversation moderation and deletion
- System-wide settings management
- API token validation and management

### Sharing & Collaboration
- Public conversation sharing with unique shareable links
- Read-only mode for shared conversations
- Conversation metadata (model used, creation date)

## AI-First SDLC

No evidence of AI-assisted development instructions detected. The repository does not include `.cursorrules`, `CLAUDE.md`, or `.github/copilot` configuration files. However, the codebase shows signs of careful architectural decisions around streaming and real-time updates, suggesting thoughtful engineering rather than AI-generated scaffolding.

## Novel/Interesting

**Message Update System**: The architecture uses a sophisticated type system for message updates with discriminated unions (MessageUpdateType enum):
- Status updates (started, error, finished, keep-alive)
- Token streaming updates
- Tool call updates with nested state (call → result/error)
- Reasoning stream updates (for o1-style models)
- Router metadata (route selection tracking)
- Final answer (with interruption flag)

This allows streaming different types of data on the same connection with strong type safety.

**Streaming State Management**: Uses async generators throughout (`async function* generate()`) to yield updates as they occur, enabling progressive rendering without polling. The client consumes these updates and applies them to a tree-structured message store.

**Browser Web Fetch API for URLs**: Instead of server-side scraping, the UI can fetch URLs directly and display HTML previews in modals, reducing server load.

**Reasoning Token Extraction**: Sophisticated handling of models that emit reasoning tokens separately (DeepSeek-R1 style). Supports regex extraction, summarization of reasoning, and token-based boundary detection for removing reasoning from final answer.

**MCP Transport Fallback**: Attempts HTTP connection first, falls back to Server-Sent Events (SSE), with detailed error reporting. This handles providers with different protocol support.

**Tree-based Conversation Navigation**: Messages form a tree structure with `ancestors` and `children` arrays, enabling branching conversations where users can explore alternative paths. UI renders the current path and displays alternatives at branch points.

**Omni Router**: Virtual model that calls an Arch router to classify each turn (casual_conversation, coding_help, creative_writing, etc.) and routes to the best model, with special handling for multimodal and tool-calling turns.

## Tech Stack

- **Framework**: SvelteKit 5 (node adapter for deployment)
- **Language**: TypeScript 5.5 with strict mode
- **UI Components**: Bits UI (accessible component library)
- **Icons**: Unplugin Icons with Carbon icon set
- **Styling**: Tailwind CSS 3.4 with custom scrollbar plugin
- **Database**: MongoDB 5.8 (collections for conversations, users, settings)
- **LLM Integration**: OpenAI SDK (4.44.0) - handles all OpenAI-compatible APIs
- **Streaming/Real-time**: Native Web Streams API, Server-Sent Events (SSE)
- **API Protocol**: Model Context Protocol (@modelcontextprotocol/sdk 1.21.1)
- **Auth**: OpenID Client (5.4.2) for OIDC flow
- **Markdown**: Marked (12.0.1) with KaTeX (0.16.21) for math
- **Code Highlighting**: Highlight.js (11.7.0)
- **Date Utils**: date-fns (2.29.3)
- **Validation**: Zod (3.22.3) for runtime type checking
- **Logging**: Pino (9.0.0) with pino-pretty for dev formatting
- **Image Generation**: Satori (HTML to SVG for OG images)
- **AWS Integration**: AWS SDK (credential providers and aws4 signing)
- **Testing**: Vitest 3.1.4, Playwright (browser testing)
- **Dev Server**: Vite 6.3.5
- **Code Quality**: ESLint, Prettier with Svelte/Tailwind plugins
- **Git Hooks**: Husky + lint-staged

## Steal This

1. **Message Update System**: Implement typed streaming updates (status, token, tool_call, reasoning, router_metadata) with discriminated unions instead of a single blob. This enables rich, structured streaming without parsing overhead.

2. **Async Generators for Streaming**: Use `async function* generate()` to yield updates progressively. This is cleaner than promise-based streaming and works naturally with for-await loops on the client.

3. **Tree-based Conversation History**: Store messages with `ancestors` and `children` references to enable branching. Allows exploring alternatives without duplicating entire conversation trees.

4. **MCP/Tool Integration Pattern**: Encapsulate tool management in stores with health checks, fallback transports, and clear state visualization. The ToolUpdate component shows exactly how to display tool progress (parameters → result/error with nested state).

5. **Router/Smart Model Selection**: Implement a virtual "Omni" model that uses a classification endpoint to route requests to specialized models per context. This pattern is more scalable than hard-coded model chains.

6. **Environment-driven Configuration**: All features are toggled via environment variables (MCP_SERVERS, LLM_ROUTER_*, MODELS). Makes deployment flexible without code changes.

7. **Reasoning Token Extraction**: If building with reasoning models, implement regex-based or token-boundary-based extraction to separate reasoning from final answer, with fallback summarization support.

8. **Progressive Loading with Infinite Scroll**: Use Svelte's reactive statements ($derived, $derived.by) to compute derived state efficiently. The conversation path calculation shows clean reactive programming without mutation.

9. **Markdown Rendering with Safety**: Use DOMPurify and isomorphic implementations to safely render markdown with math, code highlighting, and HTML preview modals.

10. **Metrics & Observability**: Use Prometheus client for real-time metrics, structured logging with Pino (context per request), and include version/commit SHA in responses for production debugging.
