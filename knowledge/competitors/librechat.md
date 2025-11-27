# LibreChat

**Repo**: https://github.com/danny-avila/LibreChat **Last Active**: November 25, 2025
(extremely active, multiple commits daily)

## What It Does

LibreChat is a comprehensive open-source AI chat interface that acts as a unified
gateway to multiple LLM providers. It's a ChatGPT alternative that lets users access
Claude, GPT-4, Gemini, and dozens of other models through a single UI. Built for
enterprises and self-hosters who want control over their AI infrastructure, it includes
voice, code execution, image generation, web search, and a powerful agent framework.

## Features

**Core Chat Interface**

- Multi-model support with seamless switching: OpenAI, Claude (Anthropic), Google
  Gemini, Azure OpenAI, AWS Bedrock, Ollama, and 30+ other providers
- Custom endpoints for any OpenAI-compatible API
- Conversation branching and message editing with resubmit
- Context management with forking (fork messages and conversations for branching
  context)

**AI Model Capabilities**

- Vision/image understanding across GPT-4, Claude 3, Llama-Vision, Gemini
- File chat and RAG across multiple endpoints
- Support for reasoning models (DeepSeek-R1, o1, o3) with dedicated reasoning UI
- Extended thinking/reasoning model support

**Code & Execution**

- Code interpreter API: Secure, sandboxed execution in Python, Node.js, Go, C/C++, Java,
  PHP, Rust, Fortran
- File handling: Upload, process, download files directly in conversations
- File persistence between sessions

**Agents & Tools System**

- Full agent framework with no-code custom assistants builder
- Agent marketplace for community sharing
- MCP (Model Context Protocol) server support for extensible tools
- Structured tools: Image generation (DALL-E, Stable Diffusion, Flux, OpenAI Image
  Tools), web search (Google, Tavily, Traversaal), weather, math (Wolfram), YouTube API,
  browser automation
- Multi-agent patterns with agent-aware conversation history
- Tool access control and permissions per agent

**Agentic Features**

- Agent chains (Mixture-of-Agents pattern)
- MCP support for non-agent endpoints
- Multi-user MCP connections
- OAuth integration for MCP servers
- Agent memory system
- Conversation sharing and collaborative permissions

**Generative UI**

- Code artifacts: React, HTML, Mermaid diagrams rendered in-line
- Dynamic rendering of generated interfaces

**Media & Interaction**

- Speech-to-text and text-to-speech (OpenAI, Azure, ElevenLabs)
- Audio streaming with autoplay
- Image generation and editing
- Image upload and analysis

**Content & Organization**

- Import/export conversations (from LibreChat, ChatGPT, Chatbot UI)
- Export as screenshots, markdown, text, JSON
- Conversation search and message search
- Preset/prompt templates with sharing
- Special variables for prompts and agents

**User & Admin**

- Multi-user with OAuth2, LDAP, email authentication
- Token spend tracking and limits
- Moderation tools
- Balance management and automatic refills
- Role-based permissions
- User statistics and activity logging

**Internationalization**

- 24+ languages (English, Chinese, Arabic, German, Spanish, French, Italian, Portuguese,
  Russian, Japanese, Swedish, Korean, Vietnamese, Turkish, Dutch, Hebrew, Catalan,
  Czech, Danish, Estonian, Persian, Finnish, Hungarian, Thai, Uyghur, Georgian, Latvian)

**Infrastructure**

- Self-hosted Docker deployment
- Cloud deployment options (Railway, Zeabur, Sealos)
- MongoDB for persistence
- Redis for caching and sessions
- S3 and Azure Blob Storage integration
- Helm charts for Kubernetes

## AI-First SDLC

**No AI-specific configuration detected** in the form of cursor rules, CLAUDE.md, or
LLM-focused instructions. However, significant architectural evidence suggests heavy AI
involvement:

- Monorepo structure with packages: `@librechat/agents`, `@librechat/api`,
  `@librechat/data-schemas` suggests careful modularization for AI extensibility
- Comprehensive type definitions in `packages/data-schemas` - 40+ packages with strict
  TypeScript
- LangChain integration throughout (`@langchain/core`, `@langchain/google-genai`,
  etc.) - these libraries are heavily used in AI-native development
- MCP (Model Context Protocol) as first-class architecture feature, not an afterthought
- Token counting built into message system (`getTokenCountForMessage`)
- Agent memory management as core infrastructure
- Message formatting utilities (`formatMessage`, `formatAgentMessages`,
  `labelContentByAgent`) show thoughtful message handling

This looks like a team that evolved their system around AI requirements, but hasn't yet
documented it with explicit LLM configuration files.

## Novel/Interesting

**Multi-Agent Conversation History Labeling** The system prevents identity confusion in
multi-agent scenarios by labeling content parts by their originating agent. This is
clever: when multiple agents collaborate, you need to know which agent said what.
(`labelContentByAgent` and `createMetadataAggregator` utilities)

**Agent Chain (Mixture-of-Agents)** Implemented mixture-of-agents pattern - allows
multiple agents to work together in orchestrated flows. This is beyond simple
tool-calling.

**MCP as First-Class** Model Context Protocol isn't bolted on - it's deeply integrated:

- `MCPManager` and `MCPConnectionFactory` handle lifecycle
- User-specific MCP connections (multi-user isolation)
- OAuth support for MCP servers
- Connection cleanup and recovery
- Available to both agent and non-agent endpoints

**Flexible Artifact System** Generative UI with Code Artifacts that render React, HTML,
and Mermaid inline. Users can ask the AI to build UIs that execute in the chat.

**Provider Fallback for Media** Recent refactor (Nov 2025) adds provider fallback for
media encoding - pragmatic engineering that acknowledges no single provider is 100%
reliable.

**Conversation Forking** Not just branching - full fork semantics where you can copy a
conversation at a point and explore alternative paths. Good UX for exploration.

**Token Economy** Real token counting per message, spend tracking, balance management.
Takes the economic reality of LLM APIs seriously.

## Tech Stack

**Frontend**

- React with Vite (fast dev experience)
- Recoil for state management
- React Router for navigation
- React Query (@tanstack/react-query) for server state
- React DnD for drag-and-drop
- Tailwind CSS with custom theme system
- Radix UI for accessible components
- PWA support (Workbox, VitePWA)
- i18n with Locize (42 language keys)

**Backend**

- Node.js/Express
- MongoDB with Mongoose
- Redis (ioredis, connect-redis for sessions)
- LangChain integration (core piece of agent architecture)
- Passport.js for authentication (OAuth2, LDAP, SAML, Apple, Google, Discord)
- Multer for file uploads
- MCP SDK (model context protocol)

**Infrastructure**

- Docker and Docker Compose
- Helm charts for Kubernetes
- AWS S3, Azure Blob Storage
- GitHub Actions (extensive CI/CD)
- Playwright for e2e testing
- ESLint + Prettier (strict code quality)
- Husky for git hooks

**Notable Dependencies**

- `@librechat/agents` - custom agents package
- `@librechat/data-schemas` - shared types and validation
- `librechat-data-provider` - abstracted data layer
- OpenAI SDK, Anthropic SDK, Google GenAI SDK
- Ollama SDK for local models
- Meilisearch for full-text search

## Steal This

1. **Multi-user MCP is genuinely useful** - Don't just support MCP; support per-user
   connections with OAuth. Users need their own credentials for third-party tools.

2. **Agent memory as infrastructure** - LibreChat treats memory as a first-class system,
   not a hack. Token counting, memory retrieval, context formatting. Build this early.

3. **Message labeling for multi-agent** - When you support agents working together, tag
   content by source. One extra field prevents confusion later.

4. **Conversation forking, not just branching** - Let users explore alternative branches
   by copying conversations at decision points. Better UX than linear threading.

5. **Token economy from the start** - Track tokens per message, support balance limits,
   automatic refills. Don't add this as an afterthought.

6. **Modular provider architecture** - Separate concerns: endpoints (where to send),
   tools (what models can call), models (specs and capabilities). Don't hard-code
   provider logic.

7. **Service-oriented code interpreter** - Containerized code execution that persists
   files between sessions. Proper isolation, not string-based eval.

8. **Reasoning UI as separate display** - DeepSeek-R1 and o-series models need a
   different UI (showing chain-of-thought). Don't force them into normal chat.

9. **LangChain integration patterns** - The way they've integrated LangChain
   (DynamicStructuredTool, message formatting, token counting) provides a solid
   reference for how AI frameworks compose.

10. **Artifact rendering in-chat** - Users asking AI to build React components and
    seeing them render instantly is delightful. Worth the complexity.
