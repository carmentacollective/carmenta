# Chatbot UI

**Repo**: https://github.com/mckaywrigley/chatbot-ui **Last Active**: August 2024 (stale
but historically significant)

## What It Does

Chatbot UI is an open-source AI chat interface that's provider-agnostic - it works with
OpenAI, Claude, Gemini, Mistral, Groq, Perplexity, and local models via Ollama. The
interface emphasizes flexibility for power users: multiple workspaces, assistants with
custom instructions, file uploads with RAG retrieval, custom tools via OpenAPI schemas,
model presets, and conversation management. Built as a modern full-stack Next.js app
with a Supabase backend, it targets self-hosters and anyone wanting escape from ChatGPT
lock-in.

## Features

### Core Chat

- **Multi-model support**: OpenAI (GPT-4, GPT-3.5), Google Gemini (including 1.5
  Pro/Flash), Anthropic Claude (2.1, 3 series, 3.5 Sonnet), Mistral, Groq (Llama3,
  Mixtral), Perplexity (online search), OpenRouter integration, local Ollama models
- **Real-time streaming**: Server-side streaming with edge runtime support
- **Message persistence**: Full chat history stored in Supabase with pagination
- **Image support**: Upload images for vision models; embedded base64 or storage URLs;
  model-specific image adaptation (Gemini Pro Vision special handling)
- **Token-aware context**: GPT tokenizer for accurate prompt fitting; configurable
  context window per model
- **Model parameters**: Temperature control, max tokens, context length settings
- **Conversation management**: Edit/delete messages including all subsequent messages
  via DB trigger

### Assistants System

- **Custom assistants**: Create assistants with custom names, descriptions, and system
  instructions
- **Avatar images**: Store custom assistant avatars in Supabase storage
- **Assistant-specific tools**: Attach OpenAPI tools to assistants
- **Assistant collections**: Link assistants to knowledge base collections
- **Workspace-scoped**: Assistants tied to workspaces for multi-team support

### File Management & RAG

- **Multi-format support**: PDF, TXT, CSV, JSON, Markdown, DOCX; chunking via LangChain
- **Dual embedding providers**: OpenAI embeddings OR local embeddings via
  Xenova/transformers (all-MiniLM-L6-v2)
- **Vector storage**: Postgres pgvector extension for semantic search
- **File collections**: Group related files into named collections
- **Retrieval in chat**: Include file items in messages with
  `<BEGIN SOURCE>...<END SOURCE>` markers
- **Chunk-based storage**: Files broken into chunks with token counts
- **Smart retrieval**: Configurable source count; retrieve most relevant chunks for
  queries

### Tools & Functions

- **OpenAPI integration**: Convert OpenAPI schemas to OpenAI function calling format
- **Tool selection**: Choose which tools to make available per chat or assistant
- **Function routing**: Route function calls to correct API endpoints with
  request/response handling
- **Tool execution**: Integrated into chat flow with error handling

### Workspace & Organization

- **Multi-workspace**: Separate isolated workspaces per user
- **Home workspace**: Default workspace auto-created
- **Workspace switching**: Quick switcher in sidebar
- **Item organization**: All items (chats, files, assistants, tools, prompts) scoped to
  workspaces
- **Folders**: Organize chats into folders within workspaces

### User Customization

- **Presets**: Named configurations with chat settings, instructions, model choice
- **Prompts**: Save and reuse system prompts; quick access in chat
- **Models**: Create custom model definitions (potentially for self-hosted endpoints)
- **Profile context**: User info included in system prompt if enabled
- **Workspace instructions**: Global instructions applied to all chats in workspace

### UX/Interaction

- **Slash commands**: `/` command palette for quick access
- **Hashtag files**: `#` to reference files in chat
- **At-mentions**: `@` to select assistants
- **Tool picker**: `~` for tool selection
- **Command palette**: cmdk-based quick navigation
- **Chat search**: Sidebar search across chats
- **File display**: Inline file previews with metadata
- **Mobile UI**: PWA support with responsive layout
- **Theme support**: Light/dark mode with next-themes
- **Internationalization**: i18n support for multiple languages

### Backend/Infrastructure

- **Supabase**: PostgreSQL database + auth + storage
- **Server-side profiles**: User API keys stored encrypted on profile
- **Auth flow**: Email/password via Supabase; session management
- **Storage buckets**: Supabase storage for files; automatic deletion on file removal
- **Database migrations**: Version-controlled SQL migrations
- **Middleware**: Next.js middleware for auth + i18n routing

## AI-First SDLC

**None detected.** No `.cursorrules`, `CLAUDE.md`, or AI instructions files found in the
repository. The codebase shows no evidence of AI-assisted development practices like
checked-in prompts, structured AI workflows, or documented AI automation patterns.

## Novel/Interesting

- **Dual embedding provider architecture**: Clever choice to support both cloud (OpenAI)
  and local (Xenova transformers) embeddings, letting users pick their privacy
  preference
- **Server profile API keys**: Encrypting user API keys on server and serving them back;
  eliminates frontend key management but creates single point of trust
- **Message delta compression**: Streaming responses use `OpenAIStream` from `ai`
  package for efficient token delivery
- **Model adapter pattern**: Separate chat routes per provider (openai, anthropic,
  google, mistral, etc.) all implementing same interface; easy to add new providers
- **File chunking with overlap**: Intelligent document splitting with configurable chunk
  size/overlap for better context preservation
- **Gemini Vision special case**: Detects vision model and reformats conversation
  (Gemini Pro Vision has unique constraints); shows awareness of provider-specific
  quirks
- **Workspace-scoped multi-tenancy**: Entire app architecture assumes workspaces - not
  bolted on
- **OpenAPI to OpenAI functions**: Converts arbitrary REST APIs to function-calling
  schema; non-trivial transformation via `openapi-conversion.ts`
- **Context window awareness**: Prompt building works backwards from most recent
  message, fitting history into available tokens; prevents naive truncation

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript 5
- **UI Components**: Radix UI primitives + custom components (50+ components)
- **Styling**: Tailwind CSS + tailwind-merge; class variance authority
- **Forms**: React Hook Form + Zod validation
- **Backend**: Next.js App Router with edge runtime for streaming
- **Database**: Supabase (PostgreSQL) with pgvector extension
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage (file uploads)
- **LLM SDKs**: OpenAI, Anthropic, Google GenerativeAI, Mistral, Groq, Perplexity
  official clients
- **Document processing**: LangChain (text splitters, loaders), Mammoth (DOCX),
  pdf-parse, D3 (CSV parsing)
- **Embeddings**: Xenova transformers (all-MiniLM-L6-v2) or OpenAI
- **Streaming**: `ai` package for unified streaming across providers
- **Tokenization**: gpt-tokenizer for accurate token counting
- **Icons**: Tabler Icons, Lucide React
- **Markdown**: react-markdown + remark-gfm + remark-math
- **State**: React Context API (no Redux/Zustand)
- **Testing**: Jest + React Testing Library
- **Linting**: ESLint + Prettier + Tailwind plugin
- **Internationalization**: i18next + next-i18n-router
- **Analytics**: Vercel Analytics + Edge Config
- **PWA**: next-pwa

## Steal This

- **Workspace abstraction**: Everything scoped to workspaces from day one makes
  multi-user/team features easy to add later
- **Dual embedding options**: Giving users choice between cloud privacy vs local
  performance is smart UX; customers never feel locked in
- **Provider adapter pattern**: Each LLM provider gets its own route handler; trivial to
  add new providers without touching core chat logic
- **Context-aware prompt building**: Working backwards from message count with token
  limits prevents naive truncation and preserves conversation coherence
- **Workspace instructions + profile context**: Layered prompt customization (global +
  user + assistant + preset) is more flexible than single system prompt
- **Slash/hashtag/@ command palette**: Speed-focused power user UX; much faster than
  dropdown menus for frequent operations
- **OpenAPI → function calling**: Treating arbitrary REST APIs as tools is genuinely
  novel; very extensible pattern
- **Streaming response handling**: Using the `ai` package abstraction handles provider
  differences transparently
- **Supabase advantage**: Postgres + pgvector + auth + storage all in one service
  reduces deployment friction; migrations are first-class
- **File collections**: Grouping files into knowledge bases before retrieval is more
  usable than flat file lists
