# Carmenta Roadmap

Milestones organized by audience expansion and confidence thresholds. Each milestone
answers "who can use this now?" - not "what features are done?"

The AI-First SDLC principle: code is cheap, sequencing is about usability coherence.
We build the smallest thing that delivers value to each audience, then expand.

---

## M0: Stake in the Ground

**Audience:** The curious (GitHub followers, newsletter subscribers)
**Signal:** "We're building something different, in public"
**Test:** Does the vision resonate? Can we build in public?

### Deliverables

Landing page with:
- Vision articulation (why Carmenta, why now)
- Email capture for updates
- GitHub repo link
- "Building in public" positioning

### Components

| Component | Scope | Notes |
|-----------|-------|-------|
| **Foundation** | Full | Next.js 16, TypeScript, pnpm, tooling, linting |
| **Hosting** | Full | Render deployment, CI/CD, preview environments |
| **Testing** | Infrastructure | Vitest + Playwright setup, patterns established |

### Success Criteria

- Landing page live at carmenta.ai (or similar)
- GitHub repo public with README explaining the vision
- CI/CD deploys on push to main
- Preview environments for PRs
- Email list collecting signups

### Not Yet

- No AI functionality
- No chat interface
- No backend beyond static page

---

## M1: Soul Proven

**Audience:** You (dogfooding)
**Signal:** "The core experience works and feels like Carmenta"
**Test:** Does this feel meaningfully different from ChatGPT/Claude? Do YOU want to use it?

### What This Proves

The heart-centered "we" experience translates to actual product. Conversations feel
warm, collaborative, intelligent. The soul is there before the features.

### Components

| Component | Scope | Notes |
|-----------|-------|-------|
| **Interface** | Basic chat | Text input, streaming responses, markdown rendering |
| **Concierge** | Minimal | Request → model → response, no classification yet |
| **Data Storage** | Conversations only | Postgres for messages, no user tables yet |
| **Error Handling** | Foundation | Sentry integration, graceful error states |
| **Observability** | LLM tracing | See what prompts/responses, debug issues |

### Key Decisions to Make

- **Chat UI approach**: Build on assistant-ui? CopilotKit? Custom with AG-UI primitives?
- **Model starting point**: Default model for all requests (Claude Sonnet? GPT-4o?)
- **Personality prompting**: How do we inject heart-centered tone? System prompt structure?

### Success Criteria

- Can have a multi-turn conversation
- Responses stream with low perceived latency
- Heart-centered "we" tone is consistent
- Errors display helpfully, not as stack traces
- You actually use it for real conversations

### Not Yet

- No auth (single user, you)
- No memory (conversations ephemeral or local only)
- No voice
- No file uploads
- No model routing (one model for everything)

---

## M2: Relationship Grows

**Audience:** Friends, trusted testers (10-50 people)
**Signal:** "It remembers us. The relationship builds over time."
**Test:** Do testers come back? Does memory make conversations better?

### What This Proves

Memory creates genuine value. The "we" relationship develops across sessions. People
return because Carmenta knows them, not just because it's capable.

### Components

| Component | Scope | Notes |
|-----------|-------|-------|
| **Auth** | Core | Login/signup, sessions, profile basics |
| **Memory** | Foundation | Profile storage, conversation memory, basic retrieval |
| **Conversations** | Full | History, continue threads, search past conversations |
| **Onboarding** | MVP | Profile collection, quick capability demo |
| **Analytics** | Foundation | PostHog or similar - who uses what, retention |
| **Usage Metering** | Tracking only | Token counting, cost attribution (no billing yet) |

### Key Decisions to Make

- **Auth provider**: Clerk? Auth.js? Supabase Auth?
- **Memory architecture**: Vector DB (Pinecone)? pgvector? Memory service (Zep, Mem0)?
- **Retrieval strategy**: Semantic search? Hybrid? What context gets injected?
- **Onboarding flow**: Conversational vs. form? What's essential to collect?

### Enhancements to Existing

- **Concierge**: Now retrieves Memory context for each request
- **Interface**: Shows conversation history, profile settings

### Success Criteria

- Testers can sign up and log in without friction
- Conversations persist and can be continued
- Memory noticeably improves response relevance
- Testers return for multiple sessions
- Profile information reflects in responses

### Not Yet

- No voice
- No file uploads
- No smart model routing
- No service integrations
- No AI team

---

## M3: Flow State

**Audience:** Power users, early adopters (100-500 people)
**Signal:** "This is my primary AI interface now"
**Test:** Are people switching from ChatGPT/Claude? What's daily retention?

### What This Proves

Voice-first is actually better for builders. Speed + polish create flow state.
Carmenta is worth switching to, not just trying.

### Components

| Component | Scope | Notes |
|-----------|-------|-------|
| **Voice** | Full | STT, TTS, natural conversation, push-to-talk |
| **Model Intelligence** | Full | Routing rubric, benchmark aggregation, model profiles |
| **Concierge** | Full | Classification, query enhancement, model selection |
| **File Attachments** | Full | PDF, images, documents into conversation context |
| **Interface** | Polished | Responsive, accessible, voice UI, file upload |

### Key Decisions to Make

- **Voice providers**: STT (Whisper? Deepgram?), TTS (ElevenLabs? OpenAI?)
- **Voice UX**: Wake word? Push-to-talk? Both? Latency targets?
- **File processing**: RAG strategy, chunking approach, vision routing
- **Model routing**: Classification model? Self-routing? Latency budget?

### Enhancements to Existing

- **Memory**: Fast retrieval, doesn't slow down responses
- **Concierge**: Smart model selection invisible to user
- **Interface**: Voice button, file drag-drop, mobile-responsive

### Success Criteria

- Voice conversations feel natural, not robotic
- Total latency supports flow (voice → response feels conversational)
- File uploads work seamlessly for common formats
- Model selection feels right (quick questions fast, deep analysis thorough)
- Users report switching from other AI tools
- Daily retention among active users

### Not Yet

- No service integrations
- No AI team
- No scheduled agents
- No billing

---

## M4: Ready for Everyone

**Audience:** Public
**Signal:** "Come use Carmenta. It's ready."
**Test:** Will people pay? Does it grow?

### What This Proves

The full vision delivers value people pay for. Service integrations multiply
capability. AI team provides leverage beyond conversation.

### Components

| Component | Scope | Notes |
|-----------|-------|-------|
| **Service Connectivity** | Priority services | Gmail, Calendar, Notion, GitHub, etc. |
| **External Tools** | MCP marketplace | Featured tools, community tools, custom |
| **AI Team** | DCOS + specialists | Digital Chief of Staff, Researcher, Analyst |
| **Scheduled Agents** | Core patterns | Daily briefings, meeting prep, monitoring |
| **Usage Metering** | Billing | Pricing tiers, payment processing |
| **Onboarding** | Full | Service connection, AI team intro, value demo |

### Key Decisions to Make

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
- AI team demonstrably reduces cognitive load
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

## Dependency Graph

```
M0: Foundation → Hosting → Testing
         ↓
M1: Interface → Concierge (min) → Data Storage → Error Handling → Observability
         ↓
M2: Auth → Memory → Conversations → Onboarding → Analytics → Usage Metering
         ↓
M3: Voice → Model Intelligence → Concierge (full) → File Attachments
         ↓
M4: Service Connectivity → External Tools → AI Team → Scheduled Agents → Billing
```

Within each milestone, components can often be built in parallel. Across milestones,
earlier components are prerequisites for later ones.

---

## Open Questions

### Sequencing Decisions

- **Voice vs. integrations priority**: M3 prioritizes voice, M4 prioritizes integrations.
  Could swap if user research shows integrations are higher value earlier.

- **AI team timing**: Currently M4. Could pull DCOS into M3 if it proves essential to
  the "switching" value prop.

- **File attachments**: Currently M3. Could be M2 if testers need it for real use.

### Scope Management

- Each milestone should be shippable. If scope grows, push features to next milestone
  rather than delaying the current one.

- "Good enough" beats "perfect." M1 chat doesn't need to be polished - it needs to
  prove the soul works.

### Timeline Philosophy

No time estimates. This is about sequence, not schedule. Build each milestone until
it's done, then move to the next. The AI-First SDLC means code is fast; understanding
what to build is the bottleneck.
