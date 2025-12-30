# Carmenta Roadmap

Milestones organized by audience expansion and confidence thresholds. Each milestone
answers "who can use this now?" - not "what features are done?"

The AI-First SDLC principle: code is cheap, sequencing is about usability coherence. We
build the smallest thing that delivers value to each audience, then expand.

See [personas.md](./product/personas.md) for detailed persona definitions. See
[boundaries.md](./product/boundaries.md) for what we're NOT building at each stage.

---

## M0: Stake in the Ground ✅ COMPLETE

**Persona:** The Curious (see personas.md) **Signal:** "We're building something
different, in public" **Test:** Does the vision resonate? Can we build in public?

### Deliverables

Landing page with:

- Vision articulation (why Carmenta, why now)
- GitHub repo link
- "Building in public" positioning

### Components

| Component      | Status | Notes                                           |
| -------------- | ------ | ----------------------------------------------- |
| **Foundation** | ✅     | Next.js 16, TypeScript, pnpm, tooling, linting  |
| **Hosting**    | ✅     | Render deployment, CI/CD via GitHub Actions     |
| **Testing**    | ✅     | Vitest + Playwright setup, patterns established |

### Decisions Made

- **Package manager**: pnpm (fast, strict dependency resolution)
- **Hosting**: Render (simple, reliable)

---

## M0.5: First Connection ✅ COMPLETE

**Persona:** Nick (pioneer mode) **Signal:** "We can connect. The interaction feels
right." **Test:** Does the basic loop feel natural? What's clunky before we add
complexity?

### What This Proves

The fundamental interaction works before we layer on complexity. We can iterate on the
feel of connection without unrelated concerns muddying the feedback.

### Why "Connect"

We deliberately avoid "chat" - it carries baggage of message bubbles, conversation
histories, the back-and-forth paradigm of messaging apps. That's not what we're
building.

"Connect" reflects the heart-centered philosophy: you're connecting with AI, not
chatting at a tool. It works for Q&A, creation, exploration - all modes of interaction.
The page lives at `/connection` and the experience is called "connecting with Carmenta."

### Components

| Component                | Status | Notes                                                |
| ------------------------ | ------ | ---------------------------------------------------- |
| **Interface**            | ✅     | Holographic UI, text input, streaming, markdown      |
| **Concierge**            | ✅     | Model selection with explanation, OpenRouter gateway |
| **System Prompt**        | ✅     | Heart-centered "we" tone established                 |
| **Conversation Persist** | ✅     | Tab-style access, not sidebar (decision made)        |
| **Connection Chooser**   | ✅     | Header-based navigation between conversations        |

### Decisions Made

- **UI library**: Backend-first with SSE, not assistant-ui
  ([decision](./decisions/chat-architecture-backend-first.md))
- **Model gateway**: OpenRouter (300+ models, single API key)
- **Persistence**: Tab-style access pattern, JSONB for tools, LLM-generated titles
  ([decision](./decisions/conversation-persistence.md))
- **Styling**: Tailwind + shadcn + holographic glassmorphism aesthetic

### What We Learned

- assistant-ui is frontend-first; our needs are backend-first (multi-tab, background
  tasks, persistence as truth)
- SSE streaming with Vercel AI SDK is elegant and sufficient
- Tab-style conversation access beats traditional sidebar
- The "we" tone requires explicit system prompt engineering

---

## M1: Soul Proven ✅ COMPLETE

**Persona:** Nick (see personas.md) **Signal:** "The core experience works and feels
like Carmenta" **Test:** Does this feel meaningfully different from ChatGPT/Claude? Do
YOU want to use it?

### What This Proves

The heart-centered "we" experience translates to actual product. Conversations feel
warm, collaborative, intelligent. The soul is there before the features.

### Components

| Component              | Status | Notes                                              |
| ---------------------- | ------ | -------------------------------------------------- |
| **Interface**          | ✅     | Holographic thread, glassmorphism, streaming       |
| **Concierge**          | ✅     | Model selection + explanation, temperature control |
| **Data Storage**       | ✅     | Drizzle + Supabase Postgres, full message parts    |
| **Error Handling**     | ✅     | Sentry integration, graceful error states          |
| **Observability**      | ✅     | Pino structured logging, test-aware silence        |
| **Thinking Indicator** | ✅     | Glass card with shimmer, warm varied messages      |
| **Status Indicators**  | ✅     | Tool execution states (4-state badge), debug panel |
| **Delight Layer**      | ✅     | Hash-based variable reinforcement, celebrations    |

### Success Criteria

- Can have a multi-turn conversation ✅
- Responses stream with low perceived latency ✅
- Heart-centered "we" tone is consistent ✅
- Errors display helpfully, not as stack traces ✅
- You actually use it for real conversations ✅

### Not Yet

- No memory (conversations persist but no cross-conversation learning)
- No voice
- No file uploads
- No dynamic model routing (user selects, not auto-routed)

---

## M2: Relationship Grows

**Persona:** Trusted Testers (see personas.md) **Signal:** "It remembers us. The
relationship builds over time." **Test:** Do testers come back? Does memory make
conversations better?

### What This Proves

Memory creates genuine value. The "we" relationship develops across sessions. People
return because Carmenta knows them, not just because it's capable.

### Components

| Component                | Status | Notes                                                                 |
| ------------------------ | ------ | --------------------------------------------------------------------- |
| **Auth**                 | ✅     | Clerk integration complete, sessions, profiles                        |
| **Memory**               | 🔨     | Phases 1-2 complete (context compilation, FTS retrieval), 3-5 pending |
| **Conversations**        | ✅     | History via Connection Chooser, search past                           |
| **Reasoning Tokens**     | ✅     | Extended thinking display in message parts, streaming support         |
| **Model Selection**      | ✅     | Concierge routing + user choice with stepped slider                   |
| **File Attachments**     | ✅     | Upload, validation, multimodal routing (built ahead)                  |
| **Service Integrations** | ✅     | 11 integrations with OAuth/API key, encrypted storage                 |
| **Generative UI**        | ✅     | Research, tables, comparisons (foundation for AG-UI)                  |
| **Onboarding**           | ⏳     | Spec complete, reactive profile seeding only, no dedicated flow       |
| **Analytics**            | ⏳     | PostHog initialized, auto-pageviews only, no custom events            |
| **Usage Metering**       | ⏳     | Token counting, cost attribution (no billing yet)                     |

### Memory Implementation Phases

Memory is the access pattern for the Knowledge Base - how we compile context, retrieve
on-demand, and compact over time. See [Memory Architecture](./components/memory.md) for
complete spec.

**Phase 1: Core Context Compilation** ✅ COMPLETE

- Two-system-message pattern (static cached + dynamic computed)
- `/profile/` folder in Knowledge Base (character, identity, preferences)
- `compileUserContext()` from profile documents with XML formatting
- Profile initialization with Clerk data seeding
- Token-aware context budgeting

**Phase 2: Retrieval Tools** ✅ COMPLETE

- `retrieveContext()` with multi-signal search (entities + FTS)
- Full-text search with snippet generation and relevance scoring
- Token budgeting respects context window limits
- Concierge extracts search queries from user messages
- Results formatted as XML with attribution metadata

**Phase 3: Session Compaction** ⏳ PENDING

- Event-structured message storage
- Two-stage compaction (prune tool results → summarize)
- Compaction triggers (token threshold, task boundary, conversation end)
- Test multi-hour conversations

**Phase 4: Knowledge Extraction** ⏳ PENDING

- Post-conversation extraction to Knowledge Base
- Librarian path determination
- Auto-update `/profile/` from learnings
- Wire up extraction triggers

**Phase 5: pgvector Semantic Search** ⏳ PENDING

- Add embedding column to documents
- Generate embeddings for profile + key documents
- Implement hybrid search (FTS + semantic)
- A/B test, tune ranking weights

### Decisions Made

- **Auth provider**: Clerk - best DX, beautiful components, already integrated
  ([infrastructure decision](./decisions/infrastructure-stack.md))
- **Model selection UX**: Stepped slider with quality/speed/cost tradeoff visualization
- **Memory architecture**: Context compilation pattern - static/dynamic system messages,
  KB `/profile/` folder, on-demand retrieval tools
  ([memory spec](./components/memory.md))
- **Storage unified**: Knowledge Base (documents table) is storage, Memory is access
  pattern - no separate memory tables
- **Profile document structure**: Three documents in `/profile/` - character (AI
  personality), identity (user info from Clerk), preferences (collaboration style)

### Decisions To Make

- **Compaction triggers**: Token threshold (100K?), task boundary detection, manual
  trigger in UI?
- **Knowledge extraction**: When to extract? End of conversation? Significant insights?
- **Onboarding flow**: Conversational vs. form? What's essential to collect?

### Enhancements to Existing

- **Concierge**: Retrieves Memory context for each request, determines reasoning level
- **Interface**: Reasoning display component shows extended thinking transparently
- **System Prompt**: Maintains "we" framing even in reasoning tokens (never "the user")

### Success Criteria

- Testers can sign up and log in without friction ✅
- Conversations persist and can be continued ✅
- Memory noticeably improves response relevance
- Testers return for multiple sessions
- Profile information reflects in responses
- Reasoning transparency builds trust

### Not Yet

- No voice (M3)
- No AI team (M4)
- No scheduled agents (M4)
- Service integrations are read-only (two-way sync in M4)

### Built Ahead of Schedule

Features originally planned for later milestones that are already working:

- **File Attachments** (M3 → M2)
  - Upload handling (lib/storage/upload.ts)
  - File validation and processing (lib/storage/file-validator.ts, image-processor.ts)
  - Model routing for vision and documents (lib/storage/model-routing.ts)
  - UI components (file-picker-button.tsx, file-preview.tsx, upload-progress.tsx)

- **Service Integrations** (M4 → M2)
  - 11 working integrations (ClickUp, Notion, Gmail, Slack, etc.)
  - OAuth and API key authentication
  - Encrypted credential storage (AES-256-GCM)
  - Integration lifecycle management
  - Generative UI components for each service

- **Generative UI** (M3/M4 → M2)
  - Research reports with citations
  - Data table comparisons
  - Web search result displays
  - Foundation for full AG-UI protocol

---

## M3: Flow State

**Persona:** Flow State Builder (see personas.md) **Signal:** "This is my primary AI
interface now" **Test:** Are people switching from ChatGPT/Claude? What's daily
retention?

### What This Proves

M3 achieves the
[1x baseline](./context/100x-framework.md#efficiency-achieving-1x-your-100-baseline):
flow state, presence, zone of genius. Voice-first removes the translation layer between
thought and expression. Speed and polish create the foundation where your best work
emerges naturally. This is operating at 100% of natural capability - the prerequisite
for [10x](./context/100x-framework.md#capacity-achieving-10x-your-ai-team) (AI team) and
[100x](./context/100x-framework.md#creativity-achieving-100x-vision-execution-partner)
(vision execution).

Carmenta becomes worth switching to because it enables you to work at your full human
capability, not just because it has more features.

### Components

| Component                 | Status | Notes                                                           |
| ------------------------- | ------ | --------------------------------------------------------------- |
| **Voice**                 | ⏳     | STT, TTS, natural conversation, push-to-talk                    |
| **Model Intelligence**    | ✅     | Routing rubric working, concierge selects model/temp/reasoning  |
| **Concierge (Full)**      | ✅     | Query classification, context assembly, intelligent routing     |
| **Interface (Polished)**  | 🔨     | Responsive and accessible done, voice UI pending                |
| **Concierge Improvement** | ⏳     | Live query evaluation, pattern detection, self-improvement loop |

### Architecture: Model Intelligence

The routing system ([spec](./components/model-intelligence.md)) aggregates external
benchmarks (LMSYS, Artificial Analysis) rather than running our own. The rubric maps
task signals to model recommendations:

- **Task signals**: complexity, domain, tools_needed, quality_sensitivity
- **Priorities per task type**: quality vs speed vs cost weighting
- **Model profiles**: capabilities, pricing, status
- **Automatic updates**: `/update-model-rubric` command for maintenance

The Concierge reads the rubric at runtime - updating recommendations doesn't require
code changes.

### Architecture: Concierge Phases

The full Concierge ([spec](./components/concierge.md)) operates in three phases:

1. **Pre-Query**: Understand needs, assemble context, select model, determine reasoning
   level
2. **Post-Response**: Format output, add enhancements, maintain personality
3. **Self-Improvement**: Evaluate quality, detect patterns, drive product evolution

### Decisions to Make

- **Voice providers**: STT (Whisper? Deepgram?), TTS (ElevenLabs? OpenAI?)
- **Voice UX**: Wake word? Push-to-talk? Both? Latency targets?
- **Model routing approach**: Fast LLM classification? RouteLLM? OpenRouter auto-router?

### Enhancements to Existing

- **Memory**: Fast retrieval (< 100ms), doesn't slow down responses
- **Concierge**: Signal-based classification, reasoning level determination
- **File Attachments**: Advanced RAG for documents, enhanced vision routing
- **Interface**: Voice button, mobile-responsive, polished interactions
- **Delight**: Context-aware celebrations, milestone recognition

### Success Criteria

- Voice conversations feel natural, not robotic
- Total latency supports flow (voice → response feels conversational)
- Model selection feels right (quick questions fast, deep analysis thorough)
- Users report switching from other AI tools
- Daily retention among active users
- Users report sustained presence and flow state - the
  [1x foundation](./context/100x-framework.md#efficiency-achieving-1x-your-100-baseline)
  is achieved

### Not Yet

- No AI team (M4)
- No scheduled agents (M4)
- No billing (M4)

---

## M4: Ready for Everyone

**Persona:** Leverage Seeker (see personas.md) + all prior personas **Signal:** "Come
use Carmenta. It's ready." **Test:** Will people pay? Does it grow?

### What This Proves

The [10x layer](./context/100x-framework.md#capacity-achieving-10x-your-ai-team) works:
AI team multiplies the
[1x foundation](./context/100x-framework.md#efficiency-achieving-1x-your-100-baseline).
Service integrations enable the team to actually do things. One person operating at 100%
baseline (1x) becomes a team of ten (10x). The Digital Chief of Staff demonstrably
reduces cognitive load and protects flow state while expanding capacity.

This validates the full value proposition: foundation (1x) enables multiplication (10x),
and people pay for genuine leverage.

### Components

| Component                | Status | Notes                                                      |
| ------------------------ | ------ | ---------------------------------------------------------- |
| **Service Connectivity** | 🔨     | 11 integrations working (read-only), two-way sync pending  |
| **External Tools**       | ⏳     | MCP marketplace - featured, community, custom tools        |
| **AI Team**              | ⏳     | Digital Chief of Staff, Researcher, Analyst                |
| **Scheduled Agents**     | ⏳     | Daily briefings, meeting prep, monitoring                  |
| **Usage Metering**       | ⏳     | Pricing tiers, Stripe payment processing                   |
| **Onboarding (Full)**    | ⏳     | Service connection working, AI team intro and demo pending |

### Infrastructure Ready

The infrastructure stack ([decision](./decisions/infrastructure-stack.md)) is designed
for M4:

- **Nango**: OAuth flows for 200+ services, token refresh, API proxying
- **Supabase Storage**: File uploads, CDN delivery, image transformations
- **Clerk Organizations**: Ready when team features needed

### Decisions to Make

- **Pricing model**: Subscription tiers? Usage-based? Hybrid?
- **Service prioritization**: Which integrations matter most for target users?
- **AI team composition**: DCOS + which specialists? Customizable?
- **Scheduled agent patterns**: What runs by default? User-configured?

### Enhancements to Existing

- **Concierge**: Routes to AI team members, orchestrates tools
- **Memory**: Team members read/write shared context
- **Interface**: Service connections, AI team visibility, scheduled agent output

### Success Criteria

- Public signup works smoothly
- Onboarding converts visitors to active users
- At least 3 high-value service integrations work
- AI team demonstrably reduces cognitive load and multiplies capacity
- Users report feeling like they have a team, not just a tool
- The 10x multiplication is measurable: work that took days now takes hours
- Paying users exist and renew
- Growth metrics trending positive

---

## Future Horizons (Post-GTM)

Components and capabilities that come after initial public launch:

### Self-Building Layer

- **Product Intelligence** - AI PM processing feedback, competitor analysis
- **Agent Testing** - Synthetic users exercising the product
- The flywheel: test → synthesize → build → repeat

### Advanced Capabilities

- **Browser Automation** - Browse as user with their sessions
- **Conversation Sync** - Import ChatGPT/Claude history
- **Artifacts** - Persistent AG-UI outputs, versioned content

### Platform Expansion

- PWA for notifications
- Electron for desktop
- Mobile apps
- Enterprise features (SSO, teams, compliance)

---

## God Mode Development (Parallel Track)

**Persona:** Nick (pioneer mode, dogfooding) **Signal:** "I build Carmenta in Carmenta"
**Test:** Is Carmenta the primary development interface for building Carmenta?

This is a **parallel track** to the main product milestones - Nick's personal
infrastructure that runs alongside public Carmenta. It's the convergence of
[Dev Mode](./components/dev-mode.md) and [God Mode](./components/god-mode.md): full
agentic coding through the web interface on dedicated always-on infrastructure.

### What This Proves

The ultimate dogfood. If Carmenta can build Carmenta, it validates the entire vision of
AI-first development. Every friction point discovered becomes a product improvement.

### Why Parallel Track

God Mode Development is infrastructure for Nick, not a product milestone. It doesn't
block M2-M4 progress. It accelerates it by making development itself faster. Build it
incrementally while shipping the main product.

### Phases

| Phase | Status | Deliverable                                               |
| ----- | ------ | --------------------------------------------------------- |
| G1    | ⏳     | **Foundation**: SDK integration, streaming, one workspace |
| G2    | ⏳     | **Multi-Workspace**: Repo switching, worktree awareness   |
| G3    | ⏳     | **Background Execution**: Tasks survive browser close     |
| G4    | ⏳     | **Always-On**: Scheduled agents, event triggers           |
| G5    | ⏳     | **Visual Polish**: Diff viewer, terminal, file tree       |

### Components

| Component                 | Status | Notes                                            |
| ------------------------- | ------ | ------------------------------------------------ |
| **Agent SDK Integration** | ⏳     | Direct `@anthropic-ai/claude-agent-sdk` usage    |
| **Workspace Manager**     | ⏳     | Multi-repo, session persistence, context caching |
| **Streaming UI**          | ⏳     | NDJSON streaming with abort capability           |
| **Background Tasks**      | ⏳     | Queue, persistence, replay                       |
| **Scheduled Agents**      | ⏳     | Cron-style recurring tasks                       |
| **GitHub Integration**    | ⏳     | PR creation, issue management, webhooks          |

### Infrastructure

- **Hosting**: Dedicated server (cloud VM or Mac Mini)
- **Domain**: god.carmenta.com (Nick access only)
- **Security**: Tailscale or Cloudflare Access
- **Filesystem**: Full access to /Users/nick/src/

### Success Criteria

- Nick uses Carmenta as primary development interface
- Terminal usage drops to near-zero for Carmenta work
- Context survives across sessions/days
- Background agents complete work while Nick sleeps

See [Code Mode Vision](./code-mode/vision.md) for full details.

---

## Dependency Graph

```
MAIN PRODUCT TRACK
══════════════════
M0: Foundation → Hosting → Testing                               ✅ COMPLETE
         ↓
M0.5: Interface → Concierge (stub) → Persistence → Chooser       ✅ COMPLETE
         ↓
M1: Data Storage → Error Handling → Observability                ✅ COMPLETE
    Status Indicators → Delight Layer                            ✅ COMPLETE
         ↓
M2: Auth ✅ → Memory (Phase 1-2 ✅, 3-5 ⏳) → Reasoning ✅ → Onboarding ⏳ → Analytics ⏳
         ↓
M3: Voice → Model Intelligence ✅ → Concierge (full) ✅ → Improvement Loop
         ↓
M4: Service Connectivity 🔨 → External Tools → AI Team → Agents → Billing


GOD MODE DEVELOPMENT (Parallel Track - Nick's Infrastructure)
═════════════════════════════════════════════════════════════
G1: Agent SDK → Streaming UI → Single Workspace                  ⏳ NEXT
         ↓
G2: Multi-Workspace → Worktree Awareness → Context Caching       ⏳
         ↓
G3: Background Tasks → Event Persistence → Replay                ⏳
         ↓
G4: Scheduled Agents → GitHub Webhooks → Daily Digest            ⏳
         ↓
G5: Diff Viewer → Terminal Panel → File Tree → Polish            ⏳

Note: God Mode accelerates main track by dogfooding. Build incrementally.
```

Within each milestone, components can often be built in parallel. Across milestones,
earlier components are prerequisites for later ones.

---

## Key Decisions Made

Decisions that shaped the architecture - these are settled, not open questions:

- **Backend-first architecture**: Database as source of truth, SSE streaming, not
  assistant-ui ([decision](./decisions/chat-architecture-backend-first.md))
- **Infrastructure stack**: Clerk + Supabase + Nango
  ([decision](./decisions/infrastructure-stack.md))
- **Conversation access**: Tab-style with recency, not sidebar
  ([decision](./decisions/conversation-persistence.md))
- **Model gateway**: OpenRouter for 300+ models via single API
- **"We" framing**: Extends to reasoning tokens - never "the user"

---

## Open Questions

### Current Focus (M2)

- **Session compaction UX**: How do we surface compaction to users? Silent background
  process or visible context management?
- **Knowledge extraction triggers**: End of conversation? Significant insight detection?
  Manual "remember this" command?
- **Onboarding experience**: Conversational AI flow vs structured UI? What's the minimum
  viable profile for personalization?

### Sequencing Rationale

- **Voice before AI team (M3 before M4)**: Voice enables the 1x foundation (flow state,
  presence). You can't multiply what isn't working at 100%.
- **AI team after voice (M4)**: The AI Team requires the 1x foundation to deliver value.
  Adding team capacity before achieving flow state creates complexity, not leverage.
- **Service integrations built ahead**: Originally M4, now working in M2. Enables richer
  context and demonstrates platform capability early.

### Scope Philosophy

- Each milestone should be shippable. If scope grows, push features to next milestone
  rather than delaying the current one.
- "Good enough" beats "perfect." M1 chat doesn't need polish - it needs to prove the
  soul works.
- Status: ✅ = complete, 🔨 = in progress, ⏳ = planned

### Timeline Philosophy

No time estimates. This is about sequence, not schedule. Build each milestone until it's
done, then move to the next. The AI-First SDLC means code is fast; understanding what to
build is the bottleneck.

---

## Component Specifications

Detailed specifications live in `knowledge/components/`. Key specs by milestone:

### M1 Components

- [Concierge](./components/concierge.md) - Pre/post query processing, model selection
- [Status Indicators](./components/status-indicators.md) - Thinking, reasoning, tool
  states
- [Delight and Joy](./components/delight-and-joy.md) - Variable reinforcement,
  celebrations

### M2 Components

- [Reasoning Tokens](./components/reasoning-tokens.md) - Extended thinking, display,
  storage
- [Context Retrieval](./components/memory.md) - Profile injection, KB retrieval patterns
- [Analytics](./components/analytics.md) - Usage tracking, retention metrics

### M3 Components

- [Model Intelligence](./components/model-intelligence.md) - Routing rubric, task
  classification
- [Voice](./components/voice.md) - STT, TTS, push-to-talk, latency targets
- [File Attachments](./components/file-attachments.md) - PDF, images, documents
- [Concierge Improvement Loop](./components/concierge-improvement-loop.md) -
  Self-improvement

### M4 Components

- [Service Connectivity](./components/service-connectivity.md) - OAuth, Nango
  integration
- [AI Team](./components/ai-team.md) - DCOS, specialists, coordination
- [Scheduled Agents](./components/scheduled-agents.md) - Daily briefings, monitoring

### Cross-Cutting Specs

- [System Prompt Architecture](./components/system-prompt-architecture.md) - "We"
  framing, tool patterns
- [Carmenta Presence](./components/carmenta-presence.md) - Three-phase interaction model
- [Connection Chooser](./components/connection-chooser.md) - Navigation, state
  management

### Code Mode (Parallel Track)

- [Code Mode](./code-mode/) - Full spec for agentic coding interface
- [Dev Mode](./components/dev-mode.md) - Original dev mode concept (foundation)
- [God Mode](./components/god-mode.md) - Always-on infrastructure concept (foundation)
