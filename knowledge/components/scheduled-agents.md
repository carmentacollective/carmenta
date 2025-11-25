# Scheduled Agents

Agents that run on schedules, not just on demand. Daily briefings, hourly monitoring,
weekly research digests. Combined with proactive intelligence: preparing for meetings,
watching for signals, escalating what matters. The shift from reactive to proactive.

## Why This Exists

On-demand AI is powerful but limited. You have to ask. You have to remember to ask. You
have to know what to ask about.

Scheduled agents flip this. Carmenta works while you sleep, while you're in meetings,
while you're focused elsewhere. It surfaces what matters when you're ready to see it.
You wake up to a briefing, not an empty inbox you have to process.

This is the difference between an assistant you summon and a team that's always working.

## Core Functions

### Scheduled Execution

Run agents on defined schedules:
- **Time-based**: Daily at 7am, every Monday, first of the month
- **Event-triggered**: Before calendar meetings, after specific service events
- **Interval-based**: Every hour, every 4 hours

### Common Patterns

Typical scheduled agent use cases:
- **Daily briefing**: Morning summary of calendar, priorities, relevant news, overnight
  signals
- **Meeting prep**: Before each meeting, prepare context on attendees, previous
  discussions, relevant materials
- **Monitoring**: Watch for specific signals - competitor mentions, keyword alerts,
  threshold breaches
- **Research digests**: Weekly summary of topics the user tracks
- **Follow-up reminders**: Surface commitments that are coming due

### Proactive Intelligence

Beyond schedules, agents can watch and act:
- Detect patterns that warrant attention
- Escalate urgent signals outside normal schedule
- Prepare context before it's explicitly needed

### Notification and Delivery

How scheduled agent output reaches users:
- Push notifications (PWA/mobile)
- Email digests
- In-app surfaces (dashboard, briefing view)
- Proactive messages in conversation

## Integration Points

- **AI Team**: Scheduled work often involves team members
- **Memory**: Scheduled agents read and update context
- **Service Connectivity**: Monitoring external services
- **Interface**: Dedicated surfaces for scheduled agent output
- **Concierge**: Scheduled agents may queue work for on-demand processing

## Success Criteria

- Users receive valuable, timely information without asking
- Schedules are easy to set up and modify
- Noise is low - scheduled agents surface signal, not noise
- Users feel prepared, not overwhelmed
- Clear feedback on what's scheduled and when it last ran

---

## Open Questions

### Architecture

- **Execution infrastructure**: Cron jobs? Serverless functions? Queue-based? What's
  reliable and cost-effective?
- **Trigger system**: How do event-triggered agents detect their triggers? Webhooks?
  Polling? Service-specific?
- **Output routing**: How does scheduled agent output reach the user? Push vs. pull?
  Aggregation?

### Product Decisions

- **Default schedules**: Do users start with pre-configured schedules? Or build from
  scratch?
- **Schedule builder UX**: How do users define and modify schedules? Natural language?
  Visual builder? Templates?
- **Notification preferences**: How much control do users have over when/how they're
  notified? Quiet hours? Channels?
- **Signal vs. noise**: What thresholds determine if something is worth surfacing?
  User-defined? AI-determined?

### Technical Specifications Needed

- Schedule definition schema
- Agent execution environment and isolation
- Output format and delivery protocol
- Monitoring and observability for scheduled runs
- Failure handling and retry logic

### Research Needed

- Study morning briefing products (The Skimm, Morning Brew, Artifact)
- Analyze how executive assistants structure proactive support
- Research notification fatigue and optimal timing patterns
- Evaluate scheduling infrastructure options (Temporal, Inngest, cloud schedulers)
- Review meeting prep automation tools and patterns
