# Carmenta Roadmap

Milestones organized by audience expansion and confidence thresholds. Each milestone
answers "who can use this now?" - not "what features are done?"

The AI-First SDLC principle: code is cheap, sequencing is about usability coherence. We
build the smallest thing that delivers value to each audience, then expand.

See [personas.md](./product/personas.md) for detailed persona definitions. See
[boundaries.md](./product/boundaries.md) for what we're NOT building at each stage.

---

## M0: Stake in the Ground

**Persona:** The Curious (see personas.md) **Signal:** "We're building something
different, in public" **Test:** Does the vision resonate? Can we build in public?

### Deliverables

Landing page with:

- Vision articulation (why Carmenta, why now)
- GitHub repo link
- "Building in public" positioning

### Components

| Component      | Scope          | Notes                                           |
| -------------- | -------------- | ----------------------------------------------- |
| **Foundation** | Full           | Next.js 16, TypeScript, pnpm, tooling, linting  |
| **Hosting**    | Full           | Render deployment, CI/CD                        |
| **Testing**    | Infrastructure | Vitest + Playwright setup, patterns established |

### Success Criteria

- Landing page live at carmenta.ai (or similar)
- GitHub repo public with README explaining the vision
- CI/CD deploys on push to main

### Not Yet

- No AI functionality
- No chat interface
- No backend beyond static page

---

## M1: Soul Proven

**Persona:** Nick (see personas.md) **Signal:** "The core experience works and feels
like Carmenta" **Test:** Does this feel meaningfully different from ChatGPT/Claude? Do
YOU want to use it?

### What This Proves

The heart-centered "we" experience translates to actual product. Conversations feel
warm, collaborative, intelligent. The soul is there before the features.

### Components

| Component          | Scope              | Notes                                               |
| ------------------ | ------------------ | --------------------------------------------------- |
| **Interface**      | Basic chat         | Text input, streaming responses, markdown rendering |
| **Concierge**      | Minimal            | Request → model → response, no classification yet   |
| **Data Storage**   | Conversations only | Postgres for messages, no user tables yet           |
| **Error Handling** | Foundation         | Sentry integration, graceful error states           |
| **Observability**  | LLM tracing        | See what prompts/responses, debug issues            |

### Key Decisions to Make

- **Chat UI approach**: Build on assistant-ui? CopilotKit? Custom with AG-UI primitives?

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

**Persona:** Trusted Testers (see personas.md) **Signal:** "It remembers us. The
relationship builds over time." **Test:** Do testers come back? Does memory make
conversations better?

### What This Proves

Memory creates genuine value. The "we" relationship develops across sessions. People
return because Carmenta knows them, not just because it's capable.

### Components

| Component           | Scope         | Notes                                                  |
| ------------------- | ------------- | ------------------------------------------------------ |
| **Auth**            | Core          | Login/signup, sessions, profile basics                 |
| **Memory**          | Foundation    | Profile storage, conversation memory, basic retrieval  |
| **Conversations**   | Full          | History, continue threads, search past conversations   |
| **Onboarding**      | MVP           | Profile collection, quick capability demo              |
| **Analytics**       | Foundation    | PostHog or similar - who uses what, retention          |
| **Usage Metering**  | Tracking only | Token counting, cost attribution (no billing yet)      |
| **Model Selection** | Basic         | User can choose model per conversation, basic defaults |

### Key Decisions to Make

- **Auth provider**: Clerk? Auth.js? Supabase Auth?
- **Memory architecture**: Vector DB (Pinecone)? pgvector? Memory service (Zep, Mem0)?
- **Retrieval strategy**: Semantic search? Hybrid? What context gets injected?
- **Onboarding flow**: Conversational vs. form? What's essential to collect?
- **Model selection UX**: Dropdown? Per-conversation? Default preferences?

### Enhancements to Existing

- **Concierge**: Now retrieves Memory context for each request, supports basic model
  selection
- **Interface**: Shows conversation history, profile settings, model selector

### Success Criteria

- Testers can sign up and log in without friction
- Conversations persist and can be continued
- Memory noticeably improves response relevance
- Testers return for multiple sessions
- Profile information reflects in responses

### Not Yet

- No voice
- No file uploads
- No dynamic/automatic model routing (M3)
- No service integrations
- No AI team

---

## M3: Flow State

**Persona:** Flow State Builder (see personas.md) **Signal:** "This is my primary AI
interface now" **Test:** Are people switching from ChatGPT/Claude? What's daily
retention?

### What This Proves

M3 achieves the 1x baseline: flow state, presence, zone of genius. Voice-first removes
the translation layer between thought and expression. Speed and polish create the
foundation where your best work emerges naturally. This is operating at 100% of natural
capability - the prerequisite for 10x (AI team) and 100x (vision execution).

Carmenta becomes worth switching to because it enables you to work at your full human
capability, not just because it has more features.

### Components

| Component              | Scope    | Notes                                                                       |
| ---------------------- | -------- | --------------------------------------------------------------------------- |
| **Voice**              | Full     | STT, TTS, natural conversation, push-to-talk                                |
| **Model Intelligence** | Full     | Dynamic routing, benchmark aggregation, model profiles, automatic selection |
| **Concierge**          | Full     | Classification, query enhancement, intelligent model routing                |
| **File Attachments**   | Full     | PDF, images, documents into conversation context                            |
| **Interface**          | Polished | Responsive, accessible, voice UI, file upload                               |

### Key Decisions to Make

- **Voice providers**: STT (Whisper? Deepgram?), TTS (ElevenLabs? OpenAI?)
- **Voice UX**: Wake word? Push-to-talk? Both? Latency targets?
- **File processing**: RAG strategy, chunking approach, vision routing
- **Model routing**: Classification model? Self-routing? Latency budget?

### Enhancements to Existing

- **Memory**: Fast retrieval, doesn't slow down responses
- **Concierge**: Dynamic model selection based on query type, latency, and context
- **Interface**: Voice button, file drag-drop, mobile-responsive

### Success Criteria

- Voice conversations feel natural, not robotic
- Total latency supports flow (voice → response feels conversational)
- File uploads work seamlessly for common formats
- Model selection feels right (quick questions fast, deep analysis thorough)
- Users report switching from other AI tools
- Daily retention among active users
- Users report sustained presence and flow state - the 1x foundation is achieved

### Not Yet

- No service integrations
- No AI team
- No scheduled agents
- No billing

---

## M4: Ready for Everyone

**Persona:** Leverage Seeker (see personas.md) + all prior personas **Signal:** "Come
use Carmenta. It's ready." **Test:** Will people pay? Does it grow?

### What This Proves

The 10x layer works: AI team multiplies the 1x foundation. Service integrations enable
the team to actually do things. One person operating at 100% baseline (1x) becomes a
team of ten (10x). The Digital Chief of Staff demonstrably reduces cognitive load and
protects flow state while expanding capacity.

This validates the full value proposition: foundation (1x) enables multiplication (10x),
and people pay for genuine leverage.

### Components

| Component                | Scope              | Notes                                         |
| ------------------------ | ------------------ | --------------------------------------------- |
| **Service Connectivity** | Priority services  | Gmail, Calendar, Notion, GitHub, etc.         |
| **External Tools**       | MCP marketplace    | Featured tools, community tools, custom       |
| **AI Team**              | DCOS + specialists | Digital Chief of Staff, Researcher, Analyst   |
| **Scheduled Agents**     | Core patterns      | Daily briefings, meeting prep, monitoring     |
| **Usage Metering**       | Billing            | Pricing tiers, payment processing             |
| **Onboarding**           | Full               | Service connection, AI team intro, value demo |

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

## Dependency Graph

```
M0: Foundation → Hosting → Testing
         ↓
M1: Interface → Concierge (min) → Data Storage → Error Handling → Observability
         ↓
M2: Auth → Memory → Conversations → Onboarding → Analytics → Usage Metering → Model Selection
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

- Voice vs. integrations priority: M3 prioritizes voice because it's the 1x foundation
  (flow state, presence, zone of genius). M4 prioritizes integrations because they
  enable the AI team (10x capacity multiplication). This sequence is deliberate: you
  can't multiply what isn't working at 100%.

- AI team timing: Currently M4. The AI Team requires the 1x foundation (M3) to deliver
  value. Adding team capacity before achieving flow state would create more complexity,
  not more leverage.

- File attachments: Currently M3. Files support the flow state by enabling seamless
  context switching without breaking presence.

### Scope Management

- Each milestone should be shippable. If scope grows, push features to next milestone
  rather than delaying the current one.

- "Good enough" beats "perfect." M1 chat doesn't need to be polished - it needs to prove
  the soul works.

### Timeline Philosophy

No time estimates. This is about sequence, not schedule. Build each milestone until it's
done, then move to the next. The AI-First SDLC means code is fast; understanding what to
build is the bottleneck.
