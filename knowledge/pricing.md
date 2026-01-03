# Pricing Architecture

How Carmenta monetizes AI capabilities while maintaining delightful user experience.

## Core Model: Tiered Subscription + Usage Tail + Outcome Add-ons

```
┌─────────────────────────────────────────────────────────────┐
│                    SUBSCRIPTION TIERS                        │
│  (Predictable base, creates commitment)                      │
├─────────────────────────────────────────────────────────────┤
│  What we gate:                                               │
│  • Feature access (which automations available)              │
│  • Frequency (how often automations can run)                 │
│  • Team size (seats for collaboration)                       │
│                                                              │
│  What we DON'T gate visibly:                                 │
│  • Agent counts                                              │
│  • Token consumption                                         │
│  • "Energy" or "capacity points"                             │
└─────────────────────────────────────────────────────────────┘
                             +
┌─────────────────────────────────────────────────────────────┐
│                    USAGE TAIL (Overage)                      │
│  (Captures growth without punishment)                        │
├─────────────────────────────────────────────────────────────┤
│  When users exceed included allocation:                      │
│  • Soft limits with overage pricing                          │
│  • Auto-upgrade prompts at thresholds                        │
│  • Never hard-capped (workflows don't break)                 │
│                                                              │
│  This is where margin expansion lives—heavy users            │
│  self-select into higher revenue contribution.               │
└─────────────────────────────────────────────────────────────┘
                             +
┌─────────────────────────────────────────────────────────────┐
│                 OUTCOME ADD-ONS (Expansion)                  │
│  (Value-based pricing, not compute-based)                    │
├─────────────────────────────────────────────────────────────┤
│  Premium deliverables priced by value:                       │
│  • Deep research reports                                     │
│  • Comprehensive analyses                                    │
│  • Custom-generated artifacts                                │
│                                                              │
│  Price reflects value to user, not tokens consumed.          │
│  A report worth $25 to the user costs that regardless        │
│  of whether it took 500 or 5000 tokens to generate.          │
└─────────────────────────────────────────────────────────────┘
```

## Why This Model

| Benefit            | Explanation                                 |
| ------------------ | ------------------------------------------- |
| Predictable MRR    | Subscription base provides stable revenue   |
| Captures growth    | Usage tail expands with customer success    |
| Value alignment    | Outcome pricing captures willingness to pay |
| Low cognitive load | Users don't manage tokens or counts         |
| Natural upgrades   | Heavy users self-select into higher tiers   |

## What NOT to Expose to Users

These concepts create cognitive burden without adding value:

| Concept                | Why it fails                       |
| ---------------------- | ---------------------------------- |
| Token budgets          | Meaningless to non-technical users |
| Concurrent job limits  | Forces queue management thinking   |
| Time blocks / hours    | Creates meter anxiety              |
| Energy / stamina bars  | Feels like a game, not a tool      |
| Capacity points        | Confusing abstraction              |
| Agent counts as limits | Vanity metric, not real constraint |

**The real constraint is compute (runs/executions).** But users shouldn't see or manage
that directly. We meter internally, present outcomes externally.

## Internal Metering

Behind the scenes, we track:

- Runs/executions per automation
- Token consumption for cost management
- API calls to external services

This informs:

- Cost of goods sold
- When to prompt tier upgrades
- Abuse detection

But it's invisible to users. They see features and outcomes, not meters.

## Tier Structure (Draft)

| Tier       | Price   | Target              | Key Differentiators                         |
| ---------- | ------- | ------------------- | ------------------------------------------- |
| Starter    | $49/mo  | Individuals testing | Core automations, daily frequency           |
| Pro        | $149/mo | Serious users       | All automations, hourly frequency, priority |
| Team       | $399/mo | Small teams         | Multi-seat, shared automations, admin       |
| Enterprise | Custom  | Organizations       | SSO, compliance, dedicated support          |

_Specific tier boundaries TBD based on usage patterns and cost modeling._

## Outcome Products (Future)

On-demand deliverables that complement always-on automations:

- Priced by value delivered, not compute consumed
- Purchased when needed (not subscription)
- Examples: deep research reports, comprehensive analyses, presentation materials

These create expansion revenue beyond subscription and capture value where willingness
to pay exceeds our costs.

## Scaling Mechanics

| Stage       | Strategy                 | Model Lever             |
| ----------- | ------------------------ | ----------------------- |
| 0-10K users | Free tier, zero friction | Product-led acquisition |
| 10K-100K    | Viral templates          | Network effects         |
| 100K-1M     | Vertical packaging       | Higher WTP segments     |
| 1M-5M       | Team plans               | Seat expansion          |
| 5M+         | API/platform             | B2B2C distribution      |

## The Conversion Gap

Industry context:

- 1.8B people use AI tools
- Only 3% pay for them
- Massive addressable market with low capture

Implication: Product-led funnel matters more than pricing optimization. Get people
using, demonstrate value, then convert.

---

## Open Questions

- Where exactly do tier boundaries fall? (needs usage data)
- What outcome products resonate most? (needs user research)
- How do we price team seats vs. per-automation?
- Free tier scope—generous enough to hook, constrained enough to convert?
