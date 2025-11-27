# Usage Metering

Track token consumption and API costs per user - the foundation for understanding costs,
identifying heavy users, and enabling usage-based billing in the future.

## Why This Exists

Every LLM request costs money. Without metering, you have no visibility into:

- Which users consume the most resources
- What types of requests cost the most
- Whether your pricing (if any) is sustainable
- How costs trend as usage grows

LibreChat got this right: token counting per message, spend tracking, balance limits.
You can't add this as an afterthought - the data model needs to support it from day one.

We're not building billing today. We're building the metering infrastructure that makes
billing possible later. Track everything, report internally, leave the door open for
usage-based pricing when the time comes.

## Core Functions

### Token Counting

Every LLM interaction gets metered:

- Input tokens (prompt, system message, context)
- Output tokens (model response)
- Model used (different models, different costs)
- Timestamp and request metadata

Token counts come from the model response itself - no estimation, actual usage.

### Cost Attribution

Map token usage to actual costs:

- Per-model cost rates (GPT-4 vs Claude vs local models)
- Per-user cost accumulation
- Per-conversation cost tracking
- Per-feature cost breakdown (which capabilities cost most)

### Usage Aggregation

Roll up usage for reporting:

- Daily/weekly/monthly user summaries
- Cost trends over time
- Heavy user identification
- Feature-level cost analysis

### Internal Reporting

Dashboards for operators:

- Total platform costs
- Cost per active user
- Cost distribution across users
- Trending and forecasting

## Relationship to Other Components

**Observability** tracks request traces for debugging. Usage Metering tracks costs for
business intelligence. They share data sources but serve different purposes:

- Observability answers "what happened in this request?"
- Usage Metering answers "how much did this user cost us?"

**Analytics** tracks user behavior and engagement. Usage Metering tracks consumption.
Both inform product decisions but measure different things:

- Analytics answers "which features are popular?"
- Usage Metering answers "which features are expensive?"

Consider whether Usage Metering data flows through the same pipeline as Observability
(since traces already capture token counts) or lives as a separate system.

## Future: Usage-Based Billing

The metering foundation enables several billing models later:

- **Free tier with limits**: Track consumption against thresholds
- **Pay-per-use**: Bill based on actual token consumption
- **Tiered plans**: Different limits for different subscription tiers
- **Enterprise chargebacks**: Department-level cost attribution

A startup mentioned at a recent conference handles per-request billing infrastructure.
Worth investigating when we're ready to implement the billing layer - keep metering
separate from billing logic.

## Integration Points

- **Concierge**: Every LLM request gets metered at the point of dispatch
- **AI Team**: Multi-agent workflows accumulate costs across agents
- **Auth**: Costs attributed to authenticated users
- **Observability**: Share trace data that includes token counts
- **Analytics**: Feed cost data into product intelligence dashboards

## Success Criteria

- Every token consumed is tracked and attributed to a user
- Operators can see per-user and total costs in real-time
- Cost data is accurate to within 1% of actual API bills
- Heavy users are easily identifiable
- Metering adds negligible latency to requests
- Data model supports future billing without migration

---

## Open Questions

### Architecture

- **Storage**: Time-series database? Append-only log? Regular Postgres with aggregation?
  What are the scale implications?
- **Pipeline**: Instrument at the Concierge layer? Tap into Observability traces?
  Separate metering middleware?
- **Aggregation strategy**: Real-time running totals? Batch aggregation jobs?
  Materialized views?
- **Multi-model pricing**: How do we handle different cost structures for different
  models? Rate tables that can update?

### Product Decisions

- **User visibility**: Do users see their own usage? Token counts? Cost estimates?
- **Alerts**: Notify users approaching limits? Notify operators about heavy users?
- **Limits enforcement**: Soft limits (warnings) vs hard limits (blocking)?
- **Billing scope**: Per-user? Per-organization? Both?

### Technical Specifications Needed

- Metering event schema (what fields captured per request)
- Aggregation intervals and retention policy
- Cost rate table structure and update mechanism
- Reporting API and dashboard requirements
- Integration points with Observability

### Research Needed

- Evaluate per-request billing infrastructure (the startup from the conference)
- Study usage-based billing patterns in AI products (OpenAI, Anthropic models)
- Research time-series storage for metering data (InfluxDB, TimescaleDB, etc.)
- Review how LibreChat implemented token economy (balance management, auto-refills)
