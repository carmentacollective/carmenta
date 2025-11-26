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
