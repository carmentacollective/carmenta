# Analytics

Product analytics - understanding how users actually use Carmenta. What features get
used, where users struggle, what drives engagement and retention. The foundation for
data-informed product decisions.

## Why This Exists

Building without analytics is building blind. You think you know how users behave, but
you don't. Analytics reveals the truth: which features matter, where users drop off,
what correlates with retention, how behavior changes over time.

For an AI product, analytics is especially important. User satisfaction isn't just
about clicks - it's about whether the AI actually helped. Did they complete their task?
Did they come back? Did they engage deeper or bounce? These signals inform both product
decisions and the Product Intelligence component's feedback loop.

## Core Functions

### Event Tracking

Capture user actions throughout the product:
- Feature usage (which capabilities get used, how often)
- Conversation patterns (length, depth, topics)
- UI interactions (clicks, navigation, settings changes)
- Service connections (which integrations, how used)

### User Analytics

Understand user segments and behavior:
- Activation and onboarding completion
- Retention and engagement over time
- Feature adoption curves
- Power user identification

### Funnel Analysis

Track conversion through key flows:
- Signup to activation
- Free to paid (if applicable)
- Feature discovery and adoption
- Churn indicators

### Product Metrics

Track the metrics that matter:
- Daily/weekly/monthly active users
- Session duration and frequency
- Feature engagement rates
- NPS or satisfaction signals

## Integration Points

- **Interface**: Track UI interactions and navigation
- **Concierge**: Track request types and response strategies
- **Onboarding**: Track funnel progression and drop-off
- **Product Intelligence**: Feed usage signals into product improvement loop
- **Service Connectivity**: Track integration adoption and usage

## Success Criteria

- Clear visibility into how users actually use the product
- Can answer "is this feature working?" with data
- Retention and engagement trends are visible and actionable
- Analytics implementation doesn't slow down the product
- Privacy-respecting by default

---

## Open Questions

### Architecture

- **Platform choice**: PostHog, Amplitude, Mixpanel, or custom? Self-hosted vs. cloud?
  What are the tradeoffs?
- **Event schema**: What's our event taxonomy? How do we ensure consistency across
  components?
- **Data warehouse**: Do we need a separate warehouse for analysis? Integration with
  analytics platform?
- **Real-time vs. batch**: Which metrics need real-time visibility?

### Product Decisions

- **Privacy stance**: What data do we collect? What do we explicitly not collect? How
  transparent are we with users?
- **User controls**: Can users opt out of analytics? What's mandatory vs. optional?
- **Metrics hierarchy**: What are our north star metrics? What do we optimize for?

### Technical Specifications Needed

- Event taxonomy and naming conventions
- User identification and session tracking approach
- Integration points for each component
- Data retention and privacy compliance
- Dashboard and reporting requirements

### Research Needed

- Evaluate analytics platforms (PostHog, Amplitude, Mixpanel, Heap)
- Study privacy-first analytics approaches
- Research AI product metrics and benchmarks
- Review GDPR/CCPA implications for analytics
