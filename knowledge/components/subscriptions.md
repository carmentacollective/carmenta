# Subscriptions

Turn usage into revenue - the business model that sustains Carmenta and aligns
value delivered with value captured.

## Why This Exists

Carmenta costs money to run. Every LLM request, every voice transcription, every
service connection has real costs. A sustainable business requires capturing value
proportional to value delivered.

But subscriptions aren't just about revenue. They're about:
- **Alignment**: Users who pay attention to value received
- **Signal**: Willingness to pay validates product-market fit
- **Sustainability**: Revenue enables continued development and operation
- **Prioritization**: Paying customers shape the roadmap

This component turns the metering foundation (Usage Metering) into actual business
operations: pricing tiers, payment processing, plan management, and the UX around
all of it.

## Relationship to Usage Metering

**Usage Metering** tracks consumption. **Subscriptions** monetizes it.

Usage Metering provides:
- Token counts and cost attribution per user
- Consumption trends and heavy user identification
- The data foundation for billing decisions

Subscriptions provides:
- Pricing tiers and plan definitions
- Payment processing and invoicing
- Plan enforcement (limits, upgrades, downgrades)
- Customer-facing billing UX

Think of it this way: Usage Metering is the meter on the wall. Subscriptions is the
utility company that sends the bill.

## Core Functions

### Pricing Model

Define how value translates to price. Several patterns to consider:

**Subscription Tiers** (classic SaaS):
- Free tier: Limited usage, basic features
- Pro tier: Higher limits, all features
- Enterprise: Custom pricing, team features

**Usage-Based** (like OpenAI API):
- Pay per token consumed
- Pay per minute of voice
- Pay per agent execution

**Hybrid** (most AI products):
- Base subscription with included usage
- Overage pricing for heavy users
- Committed-use discounts

The right model depends on who our users are and how they use Carmenta. Research
needed.

### Plan Management

The mechanics of subscription lifecycle:

- **Signup**: Free → paid conversion, trial periods
- **Upgrades**: Moving between tiers, immediate vs. prorated
- **Downgrades**: Handling when users want less
- **Cancellation**: Retention flows, data handling
- **Reactivation**: Win-back for churned users

### Payment Processing

Money movement infrastructure:

- Credit card processing
- Invoicing for enterprise
- Refund handling
- Failed payment recovery (dunning)
- Tax calculation and compliance

### Limit Enforcement

When users hit boundaries:

- **Soft limits**: Warnings, usage alerts
- **Hard limits**: Blocking further requests
- **Graceful degradation**: Reduced quality vs. full stop
- **Upgrade prompts**: Contextual upsell moments

The UX here matters enormously. Heavy-handed blocking frustrates users. Too soft
means unlimited free usage.

### Billing Portal

Self-service account management:

- Current plan and usage visibility
- Payment method management
- Invoice history and downloads
- Plan changes (upgrade/downgrade)
- Cancellation flow

## Integration Points

- **Usage Metering**: Consumption data drives billing
- **Auth**: Subscription status tied to user account
- **Interface**: Upgrade prompts, usage displays, billing portal
- **Concierge**: May route differently based on plan (premium models?)
- **AI Team**: Team member availability per tier?
- **Service Connectivity**: Connection limits per tier?
- **Onboarding**: Trial setup, first payment capture

## Success Criteria

- Users can subscribe without friction
- Payments process reliably (>99% success rate)
- Usage limits enforced without breaking experience
- Billing portal provides full self-service
- Failed payments recovered without manual intervention
- Revenue covers operational costs with healthy margin

---

## Open Questions

### Business Model

These are the fundamental questions that shape everything else:

- **Primary model**: Subscription tiers? Usage-based? Hybrid?
- **Free tier**: How generous? What's the conversion trigger?
- **Price points**: What do target users pay for similar tools? What's the
  value-based price vs. cost-based floor?
- **Enterprise**: Team accounts from the start? Custom pricing?
- **Annual vs. monthly**: Discount for annual? Encourage which?

### Feature Gating

What varies by tier? Options include:

- **Usage limits**: Messages, tokens, voice minutes
- **Model access**: Premium models only for paid tiers
- **Features**: AI team, scheduled agents, service integrations
- **Support**: Response time, channel access
- **Storage**: Memory, file attachments, conversation history retention

### Technical Decisions

- **Payment processor**: Stripe (standard), Paddle (merchant of record),
  LemonSqueezy, or others?
- **Subscription management**: Stripe Billing? Third party like Chargebee?
- **Tax compliance**: Handle ourselves or use merchant of record?
- **Invoicing**: Built-in or separate system?

### UX Considerations

- **Upgrade friction**: When to show upgrade prompts? How aggressive?
- **Usage visibility**: Real-time display? Daily summary?
- **Limit approach**: Hard stop vs. grace period vs. degraded service?
- **Trial design**: Duration? Credit card required? Feature limits?

### Research Needed

- **Competitive pricing**: What do ChatGPT Plus, Claude Pro, Perplexity Pro charge?
  What features at each tier?
- **Usage-based benchmarks**: How do Cursor, Replit, other AI dev tools price?
- **Payment processors**: Stripe vs. Paddle vs. LemonSqueezy - feature comparison,
  pricing, tax handling
- **AI product billing patterns**: How do others handle overage? What's working?
- **Willingness to pay**: Survey target users on price sensitivity

### Edge Cases to Consider

- **Multi-currency**: Support international users
- **Refunds**: Policy and implementation
- **Abuse**: Free tier exploitation, account farming
- **Team billing**: Shared limits? Per-seat pricing?
- **Grandfathering**: When pricing changes, what happens to existing users?

---

## Learnings

(Space for insights as we research and implement)

## Decisions Made

(Space for recording choices and rationale)
