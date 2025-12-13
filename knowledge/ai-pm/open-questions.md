# Open Questions

Gaps and unknowns that need resolution before or during implementation.

## Critical Path Questions

These must be answered to proceed with implementation.

### Where Does the AI Engineer Live?

**Question:** What infrastructure runs the AI Engineer agent?

**Options:**

| Option                  | Pros                         | Cons                        | Verdict             |
| ----------------------- | ---------------------------- | --------------------------- | ------------------- |
| GitHub Actions          | Standard infra, event-driven | Session limits, cold starts | Good for Phase 1    |
| Dedicated service       | Full control, always-on      | More infrastructure         | Good for Phase 2+   |
| Claude Code (manual)    | Already works, proven        | Not automated               | Good for validation |
| On Render with Carmenta | Single deployment            | Mixing concerns             | Not recommended     |

**Recommendation:** Start with manual Claude Code, automate via GitHub Actions, evolve
to dedicated service if needed.

**Status:** Needs decision

---

### GitHub Auth Approach

**Question:** How does the system authenticate with GitHub?

**Options:**

| Option                | Identity       | Audit Trail | Permissions |
| --------------------- | -------------- | ----------- | ----------- |
| GitHub App            | "Carmenta Bot" | Clear       | Scoped      |
| Personal Access Token | Nick's account | Muddy       | Broad       |
| OAuth via Nango       | Nick's account | Muddy       | Scoped      |

**Recommendation:** GitHub App for clear identity and proper scoping.

**Open sub-questions:**

- What should the App be named?
- Which repo permissions are needed?
- How to handle App credentials in dev vs prod?

**Status:** Needs implementation

---

### How Do Simulated Users Authenticate?

**Question:** How do AI test users log into Carmenta?

**Options:**

1. **Test accounts** — Dedicated Clerk accounts per persona
2. **Auth bypass** — Skip auth for test environment
3. **Service token** — Special token that identifies test users

**Considerations:**

- Test accounts are most realistic but need management
- Auth bypass changes test fidelity
- Service token needs implementation

**Recommendation:** Test accounts on staging environment initially.

**Status:** Needs decision

---

## Architecture Questions

### How Does PM Mode Detect Feedback vs Regular Chat?

**Question:** When should Carmenta switch to PM mode?

**Signals that might indicate feedback:**

- Explicit @carmenta mention
- Keywords like "bug", "broken", "should", "wish"
- Negative sentiment
- User frustration patterns

**Risk:** Over-triggering PM mode on normal conversation

**Options:**

1. Only explicit @mention triggers PM mode
2. @mention plus keyword detection
3. User can explicitly request "give feedback" mode

**Recommendation:** Start with explicit @mention only. Expand triggers based on data.

**Status:** Needs decision

---

### How Does Knowledge Context Get Selected?

**Question:** Which knowledge files get included in PM mode context?

**Options:**

1. **All core files** — vision, personas, boundaries always included
2. **Dynamic selection** — RAG-style retrieval based on feedback topic
3. **Hierarchical** — Core always, components based on relevance

**Trade-offs:**

- More context = better decisions, but token cost
- Less context = risk of missing relevant constraints

**Recommendation:** Core files always (vision, boundaries, personas), component files
retrieved based on topic detection.

**Status:** Needs design

---

### What Triggers Issue Creation vs Knowledge Update?

**Question:** When does PM create an issue vs just update knowledge?

**Draft heuristic:**

| Signal Type            | Primary Action     | Secondary Action                    |
| ---------------------- | ------------------ | ----------------------------------- |
| Bug report             | Create issue       | None                                |
| Feature request        | Create issue       | Update components if new capability |
| Friction report        | Create issue       | Update UX learnings                 |
| Use case discovery     | Update personas    | Maybe create issue                  |
| Competitive intel      | Update competitors | Maybe create issue                  |
| Architectural learning | Update knowledge   | Maybe create issue                  |

**Needs refinement:** These heuristics will evolve with experience.

**Status:** Draft, needs testing

---

## Simulated User Questions

### How Are Personas Defined?

**Question:** Where do simulated user personas live and what's the schema?

**Draft schema:**

```yaml
persona:
  name: Alex the Founder
  background: Technical founder building AI startup
  goals:
    - Build product quickly
    - Integrate AI into workflow
    - Reduce cognitive load
  behaviors:
    - Types quickly, expects fast responses
    - Uses shortcuts and power features
    - Abandons if stuck for >30 seconds
  pain_points:
    - Hates waiting
    - Frustrated by unclear errors
    - Impatient with onboarding
  test_scenarios:
    - Complete a multi-turn conversation
    - Use an integration
    - Export conversation
```

**Open questions:**

- Where does this config live? (repo vs database)
- How do personas evolve over time?
- Who can add/modify personas?

**Status:** Needs schema design

---

### How Do Simulated Users Generate Behavior?

**Question:** How does an AI user decide what to do next?

**Options:**

1. **Scripted flows** — Predefined sequences of actions
2. **Goal-directed LLM** — LLM given persona + goal, generates actions
3. **Hybrid** — Core flows scripted, variations LLM-generated

**Trade-offs:**

- Scripted: Predictable, but limited coverage
- LLM-driven: Creative, but unpredictable
- Hybrid: Best of both, but more complex

**Recommendation:** Hybrid approach. Critical paths scripted, exploration LLM-driven.

**Status:** Needs design

---

### How Often Do Simulated Users Run?

**Question:** What's the right frequency for simulated testing?

**Options:**

- **Continuous** — Always running, low volume
- **Scheduled** — Runs at specific times (e.g., nightly)
- **Triggered** — Runs after deployments

**Recommendation:** Continuous low-volume for production, triggered burst for staging
after deployments.

**Status:** Needs decision

---

## Feedback Loop Questions

### How Does the System Learn from Rejected PRs?

**Question:** When a human rejects a PR, how does the system improve?

**Options:**

1. **Manual feedback** — Human explains why rejected
2. **Pattern detection** — System analyzes rejected PRs for patterns
3. **Explicit training** — Rejection triggers learning loop

**Key insight:** Rejected PRs are valuable training data. Capture the reason.

**Status:** Needs design

---

### How Does PM Learn Better Judgment?

**Question:** How does PM improve its decisions over time?

**Possible approaches:**

- Track which issues get implemented vs closed-as-wont-fix
- Track which knowledge updates get reverted
- Track human overrides of PM decisions

**Open question:** How to close the feedback loop without manual labeling?

**Status:** Needs design

---

### What Metrics Indicate Loop Health?

**Question:** How do we know the autonomous loop is working well?

**Draft metrics:**

| Metric                      | Healthy Range | Alarm Threshold |
| --------------------------- | ------------- | --------------- |
| Signal → Issue time         | < 1 hour      | > 4 hours       |
| Issue → PR time             | < 24 hours    | > 72 hours      |
| PR approval rate            | > 80%         | < 60%           |
| Auto-merge success rate     | > 95%         | < 90%           |
| Simulated user success rate | > 90%         | < 80%           |
| Human intervention rate     | < 20%         | > 40%           |

**Status:** Draft, needs validation

---

## Risk Questions

### What Prevents Runaway Automation?

**Question:** What stops the system from creating endless issues or PRs?

**Safeguards to implement:**

- Rate limits on issue creation
- Human approval required for certain change types
- Circuit breaker if error rate exceeds threshold
- Daily summary of all automated actions

**Status:** Needs implementation plan

---

### How Do We Handle Conflicting Signals?

**Question:** What if real users and simulated users give opposite feedback?

**Draft approach:**

1. Weight real user feedback higher
2. Flag conflicts for human review
3. Investigate why simulated users missed this

**Status:** Needs policy decision

---

### What If Simulated Users Create Echo Chamber?

**Question:** How do we ensure simulated users don't just reinforce existing patterns?

**Mitigation strategies:**

- Adversarial personas designed to break things creatively
- Regular persona refresh based on real user patterns
- Explicit "exploration mode" for simulated users
- Metrics tracking signal diversity

**Status:** Needs design

---

## Technical Implementation Questions

### How to Handle Long-Running Engineer Tasks?

**Question:** What if implementation takes longer than CI timeout?

**Options:**

- Chunked implementation (multiple PRs)
- Extended timeout for engineer jobs
- Local execution with state persistence

**Status:** Needs investigation

---

### How to Test the AI PM System Itself?

**Question:** How do we validate PM judgment without shipping bad changes?

**Options:**

- Shadow mode: PM runs but doesn't create real issues
- Staging environment with full loop
- A/B comparison of PM decisions vs human baseline

**Status:** Needs test strategy

---

### How Does State Sync Between PM and Engineer?

**Question:** If PM creates an issue, how does Engineer know when to pick it up?

**Options:**

1. **Label-based** — Engineer watches for specific label
2. **Webhook** — GitHub webhook triggers Engineer
3. **Polling** — Engineer polls for new issues periodically

**Recommendation:** Label-based with webhook trigger. Polling as fallback.

**Status:** Needs implementation

---

## 2027 Vision Questions

### What Does "Full Autonomy" Actually Mean?

**Question:** In the 2027 vision, what does human approval look like?

**Spectrum of autonomy:**

| Level       | Human Role                       | System Role                     |
| ----------- | -------------------------------- | ------------------------------- |
| Today       | Review every PR                  | Create PRs                      |
| Near-term   | Review features, auto-merge bugs | Validate bugs before auto-merge |
| Medium-term | Review novel/risky changes       | Handle routine improvements     |
| 2027        | Strategic direction only         | Everything else                 |

**Key question:** How do we safely progress through these levels?

**Status:** Needs roadmap

---

### How Does the System Propose Its Own Boundaries?

**Question:** Can the system suggest expanding its own autonomy?

**Draft approach:**

- System tracks its success rate per change type
- When success rate exceeds threshold, proposes autonomy expansion
- Human approves or denies the expansion
- Expansion is gradual and reversible

**Status:** Needs design

---

### What Happens When Human Is Unavailable?

**Question:** What if Nick is on vacation and PRs pile up?

**Options:**

- Queue PRs, wait for return
- Trusted paths auto-merge, others queue
- Escalation to backup reviewer
- Pause signal processing

**Status:** Needs policy decision

---

## Questions Requiring External Input

### Browseros vs Playwright vs Other

**Question:** Which browser automation to use for simulated users?

**To investigate:**

- Browseros capabilities and pricing
- Self-hosted Playwright option
- Headless Chrome directly

**Status:** Needs research

---

### Claude Agent SDK vs Custom Agent

**Question:** Should Engineer use Claude Agent SDK or custom implementation?

**To investigate:**

- Agent SDK capabilities and limitations
- Custom implementation effort
- Integration with GitHub Actions

**Status:** Needs research

---

## Decision Log

Track resolved questions here for reference.

| Question | Decision | Date | Rationale |
| -------- | -------- | ---- | --------- |
| -        | -        | -    | -         |

## Next Actions

1. **Decide: GitHub auth approach** — Block for M2
2. **Decide: @mention vs broader PM triggers** — Block for M1
3. **Research: Browseros capabilities** — Inform M5 design
4. **Design: Persona schema** — Enable M5 implementation
5. **Design: Knowledge context selection** — Enable M4 implementation
