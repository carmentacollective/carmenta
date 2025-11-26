# Open WebUI

**Repo**: https://github.com/open-webui/open-webui
**Last Active**: November 2025 (extremely active - 19,462+ PRs, daily commits)

## What It Does

Open WebUI is a self-hosted, extensible AI chat interface that acts as a unified platform for interacting with multiple LLM backends (Ollama, OpenAI-compatible APIs, proprietary models). It's designed for enterprises and self-hosted deployments, offering offline-capable chat with RAG, knowledge management, collaborative channels, and extensive customization. Positioned as an alternative to ChatGPT but self-hosted with total data control.

## Features

**Core Chat & Messaging**
- Multi-model conversations (run queries against multiple models simultaneously)
- Chat history with full search and tagging
- Chat import/export functionality
- Persistent chat threads with message persistence
- Real-time typing indicators and presence awareness
- Markdown and LaTeX rendering support
- Code syntax highlighting with 50+ languages

**Voice & Audio**
- Real-time voice input (Speech-to-Text: Local Whisper, OpenAI, Deepgram, Azure)
- Text-to-Speech output (Azure, ElevenLabs, OpenAI, Transformers, WebAPI)
- Voice call functionality integrated directly into chat
- Audio file upload and transcription

**Knowledge & RAG (Retrieval Augmented Generation)**
- Local RAG with 9 vector database options (ChromaDB, PGVector, Qdrant, Milvus, Elasticsearch, OpenSearch, Pinecone, S3Vector, Oracle 23ai, Weaviate)
- Document upload to knowledge base with multi-format support
- Direct document reference in chat via `#` command
- Web search integration with 15+ providers (SearXNG, Google PSE, Brave, Kagi, Tavily, Perplexity, DuckDuckGo, Bing, Jina, Exa, Sougou, SearchApi, SerpApi, SerpStack, Azure AI Search)
- Web browsing capability via URL import with `#` command
- Multiple document loaders (Tika, Docling, Document Intelligence, Mistral OCR, external loaders)
- Support for PDFs, Word, Excel, PowerPoint, images (OCR), code, CSV, JSON, YAML, markdown
- BM25 hybrid search combining vector and keyword search
- Document chunking with configurable strategies (token-based, markdown header-aware)

**Image Generation & Editing**
- Multiple image generation engines: OpenAI DALL-E, Google Gemini, ComfyUI (local), AUTOMATIC1111 (local)
- Prompt-based image editing
- Image upload and analysis in conversations

**Model Management**
- Model builder for creating Ollama models with custom characters/agents
- System prompts and persona customization
- Model parameter adjustment (temperature, top_p, etc.)
- Model availability control per user/group
- Import models from Open WebUI Community registry
- Multiple backend support (Ollama, OpenAI, Anthropic, Google Genai, local inference)

**Functions & Tools**
- Native Python function calling with built-in code editor
- Custom function import from GitHub URLs with function discovery
- Function composition and chaining
- Restricted Python execution environment
- Tool servers via OpenAPI specs and MCP (Model Context Protocol)
- Tool versioning and access control

**Collaboration & Team Features**
- Real-time collaborative channels with mentions (@username)
- Team workspaces with shared access to models, knowledge, tools
- Granular permissions: create models, pull models, manage tools, etc.
- User groups with role-based access control (RBAC)
- Channel management with public/private access
- Admin chat access (optional) to view user conversations
- User activity tracking and presence indicators

**Data & Storage**
- Persistent artifact storage (key-value API) for apps, journals, trackers, leaderboards
- Multiple database backends: SQLite (with optional encryption), PostgreSQL, MongoDB
- Cloud storage: S3, Google Cloud Storage, Azure Blob Storage
- Document library with persistent document references
- Chat export and import with full history
- Data backup and restore capabilities

**Enterprise & Security**
- OAuth2 integration with multiple providers (OpenID Connect compliant)
- LDAP/Active Directory authentication
- SCIM 2.0 automated user provisioning (Okta, Azure AD, Google Workspace)
- SSO via trusted headers
- Granular permission system (user, admin, guest roles)
- Admin user management and impersonation
- API key management for programmatic access
- SQLite encryption support for sensitive deployments
- Database connection pooling and optimization

**Workspace & Customization**
- Custom workspace for organizing tools, models, knowledge bases, prompts, functions
- Prompt templates library with tagging
- Model builder UI with parameter tuning
- Theme customization (dark/light modes)
- Internationalization (i18n) support with 20+ languages
- Custom branding and logo upload
- Favicon customization

**Monitoring & Observability**
- OpenTelemetry support for traces, metrics, logs
- Structured logging with Loguru
- Production-grade deployment options (Kubernetes, Docker, Docker Compose)
- Health check endpoints
- Admin dashboard with user statistics
- Activity logging and audit trails

**Progressive Web App (PWA)**
- Mobile-responsive design (desktop, laptop, mobile)
- Offline access on localhost
- Native app-like experience on mobile

**API & Integration**
- Full REST API for programmatic access
- WebSocket support for real-time features
- Redis-backed session management for horizontal scaling
- Multi-worker and multi-node deployment support
- Pipelines plugin framework for custom logic injection
- Webhook support for custom integrations
- MCP (Model Context Protocol) server integration

**Advanced Features**
- Evaluation system for model comparison
- Prompt injection filtering
- Toxic message filtering
- User rate limiting via pipelines
- Live translation via pipelines
- Usage monitoring integration (Langfuse)
- Note-taking with persistent storage
- Task management system
- Feedback collection system

## AI-First SDLC

**Evidence of AI-assisted development patterns:**

1. **Pipelines Plugin Framework** - Built-in extensibility specifically designed for injecting AI logic (rate limiting, filtering, translation) into chat flow
2. **RestrictedPython Integration** - Allows safe execution of Python code (including LLM-generated code) with restricted globals
3. **Function Calling System** - Native support for LLMs to call custom Python functions, enabling tool use at scale
4. **Model Context Protocol (MCP)** - Full integration with MCP servers, indicating design for AI tool composition
5. **Prompt Templates Library** - First-class citizen for storing and versioning prompts
6. **Multi-Model Concurrent Support** - Architecture supports running multiple LLM providers simultaneously, suggesting LLM evaluation workflows
7. **Tool Server Abstraction** - OpenAPI-based tool discovery and integration suggests programmatic tool composition

No explicit `.cursorrules` or `CLAUDE.md` files found in repo, but the architecture demonstrates thoughtful design for AI integration without strict AI-first SDLCs.

## Novel/Interesting

**Architectural Highlights:**

1. **Yjs-based Real-time Collaboration** - Uses `pycrdt` (Python implementation of CRDTs from Yjs) for conflict-free collaborative editing in notes/channels, enabling true multi-user editing without server bottleneck
   
2. **Pipeline Middleware System** - Inlet/outlet filters that intercept requests/responses at model level before and after execution - elegant pattern for cross-cutting concerns (validation, monitoring, transformation)

3. **Redis-Backed Socket.IO with Sentinel Support** - Horizontal scalability built-in from ground up with Redis Sentinel support for HA, not added later

4. **Vector DB Factory Pattern** - Single unified interface supporting 11+ vector database backends (including exotic ones like Oracle 23ai, Pinecone), allowing users to swap implementations without code changes

5. **MCP Integration** - Full Model Context Protocol support allowing connection to AI servers following Anthropic's standard, not a custom protocol

6. **Restricted Python Execution** - Uses `RestrictedPython` library to safely execute user-defined Python functions within LLM tool calling contexts with controlled globals

7. **Artifact Storage API** - Key-value storage system specifically designed for LLM-generated artifacts (apps, components, trackers) with personal/shared scope separation

8. **SCIM 2.0 Provisioning** - Not just LDAP - full SCIM 2.0 implementation for enterprise user lifecycle management, ahead of typical SaaS implementations

9. **Hybrid Search (BM25 + Vector)** - RAG system uses both semantic (vector) and lexical (BM25) search, combining strengths of both approaches

10. **Presence & Typing Indicators via Socket.IO** - Real-time feature for multi-user channels built on scalable WebSocket infrastructure

11. **Document Format Pipeline** - Multiple extraction engines (Tika, Docling, Document Intelligence, Mistral OCR) with intelligent fallback, not single approach

12. **Channel Mentions with Resolution** - Sophisticated @mention system that resolves mentions to user IDs, stores them structured, and broadcasts to mentioned users

## Tech Stack

**Frontend:**
- Svelte 5 (most modern Svelte version) with SvelteKit 2.5
- Vite 5 for bundling
- Tailwind CSS 4 with container queries
- CodeMirror 6 for syntax-highlighted code editing
- Tiptap 3 for rich text editing with ProseMirror under the hood
- Socket.IO client for real-time communication
- Yjs for collaborative editing
- Leaflet for maps, Mermaid for diagrams, Vega for data visualization
- PDFJS for PDF rendering
- Chart.js for analytics
- i18next for internationalization
- MediaPipe for vision tasks (client-side)
- Pyodide for running Python in browser

**Backend:**
- FastAPI 0.118 (latest) with Uvicorn
- SQLAlchemy 2.0 with Alembic migrations
- Pydantic 2.11 for validation
- Python-SocketIO 5.14 for WebSocket support
- AuthLib for OAuth integration
- LangChain and LangChain Community for LLM orchestration
- Sentence Transformers for embeddings
- Faster-Whisper for local speech-to-text
- OpenCV and Pillow for image processing
- PyCRDT for collaborative editing
- Redis for caching and session management
- Multiple vector DB drivers: ChromaDB, Qdrant, Milvus, Elasticsearch, OpenSearch, Pinecone, Weaviate, PGVector, S3Vector, Oracle
- Transformers library for local embeddings
- APScheduler for background tasks
- PyArrow for data handling

**Infrastructure:**
- Docker/Docker Compose for deployment
- Kubernetes ready (Kustomize, Helm charts provided)
- PostgreSQL as primary production DB
- Redis for session management and WebSocket coordination
- Support for multiple cloud storage backends (S3, GCS, Azure)

## Steal This

**For Carmenta:**

1. **Hybrid Search Approach** - Don't rely only on vector similarity. Implement BM25 keyword search alongside vectors for RAG to catch exact term matches that vectors might miss.

2. **Pipeline Middleware Pattern** - Use inlet/outlet filters for cross-cutting concerns (user validation, rate limiting, logging) rather than repeating logic in handlers. Elegant and composable.

3. **MCP-First Tool Integration** - Instead of building custom tool interface, adopt Model Context Protocol early. It's becoming standard for LLM tool servers (Anthropic, others adopting it).

4. **Redis-Based Real-time Scaling** - If building real-time features (collaborative editing, presence), use Redis-backed Socket.IO from day one with Sentinel support rather than retrofitting later. Cost of switching later is high.

5. **Artifact Storage for AI-Generated Content** - Build persistent storage specifically for LLM-generated outputs (not just chat history) - enable use cases like leaderboards, trackers, journaling that transcend conversation.

6. **SCIM 2.0 + LDAP from Start** - Enterprise needs both. Don't treat enterprise auth as afterthought. SCIM 2.0 is increasingly standard for IAM.

7. **Document Ingestion Pipeline** - Multiple extraction engines with intelligent fallback (Tika, Docling, OCR) beats single approach. Users have diverse document types.

8. **Restricted Python for Tool Execution** - Use RestrictedPython for safe execution of user-defined Python functions rather than building custom sandbox.

9. **Voice as First-Class Feature** - Open WebUI treats voice/audio as equal to text. If Carmenta is "voice-first," architect from ground up with Whisper, TTS, and streaming audio support baked in.

10. **Presence Awareness** - Real-time typing indicators and presence status are high-value signals for collaborative products. Build this infrastructure early.

11. **Version Your APIs Carefully** - With 27 routers and constant evolution, careful API versioning prevents breaking changes for integrations. Consider route versioning from start.

12. **Workspace Organization** - Don't throw tools, models, knowledge bases into flat list. Organize by "workspace" concept - users appreciate mental models where related things live together.

