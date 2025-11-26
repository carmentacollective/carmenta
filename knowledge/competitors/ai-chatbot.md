# Vercel AI Chatbot

**Repo**: https://github.com/vercel/ai-chatbot
**Last Active**: November 2025 (very active, v3.1.0)

## What It Does

Production-grade AI chat interface built by Vercel. Full-featured template combining Next.js 15, the Vercel AI SDK, and Claude/Grok models via Vercel's AI Gateway. Focuses on practical productivity with document creation, code execution, weather queries, and writing suggestions. Multi-model support (reasoning vs vision) with auth system, persistent chat history, and vision capabilities.

## Features

**Core Chat**
- Real-time streaming responses with smooth word-by-word chunking
- Multi-model selection: Grok Vision (default, multimodal) and Grok Reasoning (chain-of-thought)
- Conversation history with auto-generated titles
- Stop/regenerate/resume stream functionality
- Message voting (thumbs up/down) for feedback collection
- Edit previous user messages mid-conversation
- Sidebar with chat history pagination

**Document Artifacts (Real-time Co-editing)**
- Three artifact types: text documents, Python code, CSV spreadsheets
- Real-time preview alongside conversation (split panel UI)
- Create document tool called by AI when appropriate
- Update document tool for targeted modifications
- Prevents immediate updates after creation (waits for user feedback)
- Language-specific prompts (Python for code)

**AI-Powered Tools** (called autonomously by model)
- Get Weather: Real-time weather by city or coordinates via Open-Meteo API
- Create Document: Spawns artifact with AI-generated content
- Update Document: Modifies existing artifacts
- Request Suggestions: AI-generated writing suggestions with diff visualization

**File Handling**
- Image upload (JPEG/PNG) with 5MB limit via Vercel Blob storage
- Multimodal input: text + attachments in single message
- Preview attachments inline in messages
- File attachments streamed to AI models

**Advanced Reasoning**
- Chain-of-thought reasoning model (separate from vision model)
- Expandable reasoning panel showing model's thinking process
- Reasoning disabled for document artifacts (different tool set)

**Authentication**
- Dual auth: email/password accounts or instant guest access
- Guest users get 20 messages/day; registered users get 100
- Auth.js with Credentials provider + NextAuth beta
- Session tracking with user type ("guest" vs "regular")

**Persistence & Data**
- PostgreSQL (Neon serverless) for all data
- Stores: chats, messages, votes, suggestions, artifacts, documents
- Chat metadata includes visibility (private/public), usage tokens
- Resumable streams via Redis (optional, falls back gracefully)

**Observability**
- Token usage tracking (input/output tokens with cost estimates)
- Usage persistence per chat via TokenLens
- OpenTelemetry integration for server-side tracing
- Structured error handling with custom ChatSDKError class

**UI/UX Patterns**
- Mobile-responsive with sidebar collapse on small screens
- Dark mode support via next-themes
- Toast notifications (Sonner)
- Auto-expanding textarea for chat input
- Loading states and skeleton screens for documents
- Inline code syntax highlighting (Shiki)
- Math rendering with KaTeX

**Rate Limiting & Quotas**
- Per-user daily message limits enforced server-side
- Model access gated by user type
- 24-hour rolling window calculations
- Rate limit errors returned gracefully

## AI-First SDLC

**Evidence of AI-Assisted Development:**
- `.cursor/rules/ultracite.mdc` - Comprehensive AI-ready coding standards (300+ rules)
- Ultracite is Biome-based formatter/linter with "AI-friendly code generation" as core principle
- NPM scripts use `npx ultracite` for automated formatting
- Rules file serves as both linter config AND instruction set for code generation LLMs
- System prompt includes: "Maximum type safety, AI-friendly code generation"

**Code Gen Patterns:**
- Strict TypeScript with `as const` for type inference (not manual annotations)
- Structured logging with context objects (designed for observability dashboards)
- Error boundaries that surface issues to Sentry (not silent failures)
- Tool definitions with Zod schemas (enables code generation from schema)

**Database & Schema:**
- Drizzle ORM with TypeScript-first schema (not separate migrations)
- Schema doubles as documentation
- db:generate/db:migrate scripts in package.json
- Database-first migrations tracked in `/lib/db/migrations/`

**Testing:**
- Playwright for E2E tests (PLAYWRIGHT=True env flag)
- biome.jsonc enforces test patterns (no disabled tests, no focused tests)

**Automation Hints:**
- Pre-commit hooks implied by Ultracite integration
- Build script auto-runs db migrations before Next.js build
- Turbo mode enabled by default for dev (`next dev --turbo`)

## Novel/Interesting

**Resumable Streams Architecture**
Uses `resumable-stream` library to recover from network interruptions mid-response. Falls back gracefully when Redis unavailable - streaming still works, just without resumability. Shows sophisticated thinking about unreliable networks.

**Smooth Streaming with Word Chunking**
`experimental_transform: smoothStream({ chunking: "word" })` - streams responses word-by-word rather than token-by-token. Creates perception of faster, more natural speech. Clever UX detail.

**Geolocation-Aware Prompts**
Injects user's location (city, country, lat/lon) into system prompt via `@vercel/functions` geolocation header. Models can answer location-contextual questions without user saying where they are.

**Suggestion Generation with Streaming Objects**
Uses `streamObject` + `elementStream` to generate writing suggestions in real-time, each suggestion written to dataStream as it appears. Partial results visible immediately.

**Tool Routing by Model**
Different tools available for different models:
- Vision model: getWeather, createDocument, updateDocument, requestSuggestions
- Reasoning model: NO tools (pure chain-of-thought)
Shows understanding that reasoning models need different constraints.

**Split-Panel Artifacts**
AI can create documents that appear BESIDE conversation (not modal). Real-time co-editing visualization. Clean separation between conversation context and focused creation.

**Vote System for Fine-Tuning**
Thumbs up/down on messages gets stored and persists. Template for collecting training data or user satisfaction metrics.

**Guest User Support**
Instant guest access without signup (via dedicated NextAuth provider). Allows sampling product without commitment. Different quota tier. Sophisticated product strategy.

## Tech Stack

- **Framework**: Next.js 15 (canary) with App Router, React Server Components
- **Language**: TypeScript 5.6 with strict mode
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **File Storage**: Vercel Blob
- **Auth**: Auth.js 5.0 beta with Credentials provider
- **API Integration**: Vercel AI Gateway (unified multi-model routing)
- **AI Models**: xAI Grok (default, via gateway); pluggable to OpenAI/Anthropic/others
- **Styling**: Tailwind CSS 4.1 + Radix UI primitives
- **Component Library**: shadcn/ui
- **Code Editor**: CodeMirror 6 (syntax highlighting + live editing)
- **Spreadsheet**: react-data-grid (7.0 beta)
- **Rich Text**: ProseMirror with markdown support
- **Streaming**: StreamDown + JSON SSE transformation + Resumable Stream
- **Observability**: OpenTelemetry + Vercel Analytics
- **Linting**: Biome via Ultracite
- **Testing**: Playwright (E2E)
- **Tooling**: pnpm 9.12

**Interesting Library Choices:**
- `tokenlens` - Token counting & cost estimation library
- `fast-deep-equal` - Used for memoization in React
- `diff-match-patch` - Used for suggestion visualization
- `papaparse` - CSV parsing for spreadsheet imports
- `shiki` - Syntax highlighting (lighter than highlight.js)
- `sonner` - Toast notifications (simpler than react-hot-toast)

## Steal This

1. **Ultracite Rules Template** - The `.cursor/rules/ultracite.mdc` file is a masterclass in AI-actionable coding standards. It's 300+ lines of explicit rules suitable for feeding to Claude/GPT for code generation. Consider creating similar Cursor rules for Carmenta's standards.

2. **Dual Auth Paths** - Guest + registered user split with different quotas is a smart growth strategy. Lets product be sampled instantly while creating upgrade path. Worth modeling for Carmenta's early traction.

3. **Artifact Split Panel** - Real-time document creation beside conversation is more elegant than modal/tab approaches. Users stay in conversation flow while editing appears alongside. Consider for Carmenta's knowledge editor.

4. **Geolocation in System Prompt** - Injecting user context (location, language) into the prompt without prompting is clever. Models automatically answer contextually. Easy win for perceived intelligence.

5. **Tool Availability by Model** - Disable tools for reasoning models (keep pure thinking). Explicit model-specific entitlements rather than feature flags everywhere. Cleaner architecture.

6. **Resumable Streams Graceful Fallback** - Network reliability is hard. Resumable-stream + Redis with silent fallback is sophisticated. Cache the pattern.

7. **Smooth Streaming Word Chunking** - Word-level streaming > token streaming for UX. Look for similar patterns in Carmenta's streaming.

8. **Vote Endpoints for Feedback** - Simple thumbs up/down collection at message level. Creates foundation for learning what users prefer. Easy to instrument.

9. **Database-First Migrations** - Drizzle ORM's TypeScript schema + migrations (not ORMs that generate from code) is cleaner. Consider for Carmenta's schema design.

10. **Biome as AI-Instruction Format** - The Ultracite rules aren't just linting rules—they're formatted as instructions for LLMs. Rules mention "AI-ready" and "AI-friendly code generation." Framework your own standards similarly.
