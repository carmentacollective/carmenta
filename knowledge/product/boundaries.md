# Boundaries

What Carmenta is NOT. These boundaries protect focus, prevent scope creep, and help
everyone (human and AI) make consistent decisions about what to build and what to
decline.

Boundaries aren't permanent - they can change with strategic shifts. But changing a
boundary requires explicit discussion, not gradual drift.

---

## Product Boundaries

### Not a ChatGPT Wrapper

We're not building a skin on top of one model's API. Carmenta is model-agnostic,
choosing the right model for each task. The intelligence layer is ours - model providers
are interchangeable infrastructure.

**Why this matters**: Wrappers have no moat. When the underlying model improves or
pricing changes, wrappers die. Our value is in the orchestration, memory, and experience
layers that sit above any individual model.

---

### Not Developer-Only

Carmenta is for builders, not just developers. The Flow State Builder persona includes
founders, creators, consultants - people who ship things but aren't necessarily writing
code all day.

**What this means**:
- Interface should feel approachable, not technical
- No assumption of coding knowledge in core flows
- Code-related features are capabilities, not identity

**What this doesn't mean**:
- We won't have developer features (we will - MCP, integrations, etc.)
- We're dumbing things down (we're not - sophisticated users want sophisticated tools)

---

### Not Enterprise-First

We build for individuals first, then teams, then enterprises. Enterprise features (SSO,
compliance, audit logs, procurement) are post-M4 concerns.

**Why this matters**: Enterprise sales cycles are long and distort product development.
Building for enterprise buyers before having product-market fit with individuals means
building features no one actually uses.

**What we defer**:
- Team/organization structures
- Role-based access control
- SOC 2, HIPAA compliance
- Procurement integrations
- Dedicated support SLAs

---

### Not Local-First (For Now)

Data lives on our infrastructure, not user devices. We may add local options later, but
the core product assumes cloud storage.

**Why this matters**: Local-first adds enormous complexity (sync, conflict resolution,
offline behavior) that slows everything else. For our target users, cloud is fine.

**Exceptions considered**:
- Extremely sensitive use cases might warrant local option later
- Some competitors (LobeChat, LibreChat) offer this - monitor if it becomes
  differentiating

---

### Not a Platform (Yet)

We're building a product, not a platform for others to build on. No public APIs, no
third-party app store, no plugin marketplace we maintain.

**Why this matters**: Platforms require different thinking - developer experience, API
stability, backwards compatibility. These slow product iteration.

**What we do instead**:
- MCP support lets users add their own tools
- But we don't curate, maintain, or guarantee third-party MCPs

---

## Philosophical Boundaries

### Not Neutral/Sterile

Carmenta has a personality. Heart-centered. "We" language. Warm but substantive. This
isn't a feature toggle - it's core identity.

**Why this matters**: Neutral AI is everywhere. Personality creates relationship.
Relationship creates retention.

**What this means**:
- Prompts include tone guidance, not just task instructions
- We decline to add "professional mode" that strips personality
- The tone is who Carmenta is, not a preference setting

---

### Not Performative

We don't build features to check boxes or appear innovative. Every capability must
deliver real value to real users.

**Examples of what we'd decline**:
- "AI" badge on features that don't actually use AI
- Gamification that doesn't serve user goals
- Social features without clear utility
- Web3/blockchain integration for its own sake

---

### Not Maximally Extractive

We optimize for user value, not engagement metrics. If a feature keeps users in the app
longer without making their lives better, we don't build it.

**What this means**:
- No dark patterns
- No artificial friction to create "stickiness"
- No notification spam
- Transparent about costs and usage
- Easy to export your data, easy to leave

---

## Technical Boundaries

### Not Mobile-Native (Initially)

Web first, then PWA, then desktop, then mobile apps. Native iOS/Android apps are post-M4.

**Why this matters**: Mobile development is expensive and fragments focus. A good
responsive web experience serves mobile users without native development costs.

**Progression**:
- M0-M3: Responsive web, works on mobile browsers
- M3: PWA for push notifications
- M4: Electron for desktop (better voice integration)
- Post-M4: Native mobile if usage patterns demand it

---

### Not Self-Hostable

We don't support on-premise deployment. Carmenta runs on our infrastructure.

**Why this matters**: Self-hosting support is a massive maintenance burden. Security
patches, compatibility testing, upgrade paths - all multiplied across unknown
environments.

**What we lose**: Some privacy-conscious users, some enterprises. We accept this
trade-off.

---

### Not Offline-Capable

Carmenta requires internet connection. No offline mode, no local inference, no
sync-when-connected.

**Why this matters**: Offline adds complexity everywhere. Our target users are connected
professionals.

---

## Scope Boundaries by Milestone

Some things are "not yet" rather than "not ever." This section clarifies timing.

### M0: Stake in Ground
- No AI functionality
- No chat interface
- No backend beyond static page
- No user accounts

### M1: Soul Proven
- No auth (single user mode)
- No persistent memory
- No voice
- No file uploads
- No model selection (one model)

### M2: Relationship Grows
- No voice
- No file uploads
- No smart model routing
- No service integrations
- No AI team

### M3: Flow State
- No service integrations
- No AI team
- No scheduled agents
- No billing

### M4: Public Launch
- All core features available
- Billing enabled
- Still no: enterprise features, native mobile, self-hosting, platform/API

---

## Boundary Review Process

Boundaries should be reviewed when:
- User research reveals a boundary is costing us important users
- Competitive landscape shifts significantly
- Technical constraints that motivated a boundary change
- Strategic direction evolves

Changing a boundary requires:
1. Documenting why the current boundary exists
2. Articulating what changed to warrant reconsideration
3. Assessing impact on roadmap and resources
4. Explicit decision to change (not gradual drift)
