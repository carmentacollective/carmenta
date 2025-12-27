# Best of Breed: What Excellence Looks Like

Research synthesis on the best Slack bots, community management patterns, and practices
that create amazing user experiences. This informs how we build Carmenta's Slack
presence.

## The Spectrum: Annoying Automation vs Helpful Team Member

| Annoying                     | Helpful                        |
| ---------------------------- | ------------------------------ |
| Spams on install             | Waits for user initiation      |
| Rigid slash commands         | Natural language understanding |
| Ignores timezones            | Respects working hours         |
| Notifications for everything | Bundles and prioritizes        |
| Requires context switching   | Lives where work happens       |
| Generic personality          | Warm but substantive voice     |
| Forces workflows             | Enables human connection       |

The best bots feel like colleagues who happen to never sleep - not automation you have
to learn to operate.

## Exemplary Bots and What They Teach Us

### HeyTaco - Constraint Creates Meaning

5 tacos per person per day for peer recognition. The limit prevents favoritism and
creates scarcity that makes recognition meaningful. 85% daily engagement - remarkably
high for workplace tools.

**Lesson**: Constraints make interactions valuable. If Carmenta can recognize everyone
for everything, recognition means nothing. Thoughtful limits create intentionality.

### Donut - Enable Connection, Then Disappear

Pairs team members for virtual coffee every 1-4 weeks. The bot is just the facilitator -
the value is human connection. Donut doesn't try to be the conversation, just the
matchmaker.

**Lesson**: Carmenta should connect people, not insert herself into every interaction.
Surface the connection, then step back.

### Geekbot - Respect Async Truly

"Wait until online" option - waits for people to appear online rather than interrupting
at inconvenient times. Per-user timezone scheduling so 9 AM is 9 AM wherever you are.

**Lesson**: Proactive doesn't mean intrusive. Carmenta should understand when presence
is welcome and when silence serves better.

### Polly - Meet People Where They Work

7-10x faster response rates than traditional surveys by keeping everything in Slack.
Question variety: polls, emoji reactions, word clouds. In-Slack visualization.

**Lesson**: Don't make people context-switch. If Carmenta needs input, gather it in
Slack with native patterns, not external links.

### Slack AI (Native) - Permission-Aware Intelligence

Channel recaps, thread summaries, search answers - all with data privacy (no customer
data shared with LLM providers). Personalized responses based on accessible context.

**Lesson**: Carmenta must understand permissions. What can she see? What can she
reference? Transparency about data handling builds trust.

## Enterprise Patterns Worth Adopting

### Salesforce Agentforce

The rebuilt Slackbot as "personalized AI companion":

- Drafts content, summarizes reports
- Schedules meetings, checks calendars
- Surfaces relevant documents ahead of calls
- Natural language questions about CRM data

**Key insight**: The best enterprise bots connect multiple systems and take actions
across them. Single-purpose bots have limited value.

### Atlassian Integration Patterns

Jira and Confluence integrations that work:

- Personal notifications via DM instead of email
- Automatic previews when links are pasted
- Emoji reactions to like or save content
- Grant access to restricted content via Slack

**Key insight**: Deep integration > superficial presence. Being able to take real
actions beats just answering questions.

### B2B Support Platforms (Thena, ClearFeed, Pylon)

Slack-native ticketing with:

- ML models predicting ticket urgency
- GPT-powered response suggestions
- SLA tracking and escalation
- Full customer context available

**Key insight**: Community support at scale needs intelligence. Carmenta should
prioritize, suggest, and escalate - not just respond.

## Community Management Best Practices

### Welcome Sequences That Work (Cosy, GreetBot)

- Not just day-one, but day-3, day-7, day-30 check-ins
- Public welcomes that help the community know new members
- Connection matching - automatically pairing new members with guides
- Resource sharing at the right moments, not all at once

**Pattern**: Onboarding is a journey, not a moment. Carmenta should nurture new members
over time.

### Moderation That Builds Rather Than Punishes

Discord leads in moderation tooling (MEE6, Carl-bot, Dyno). Slack is underserved here.

What works:

- Role-based permissions with granular control
- Automated spam detection before it spreads
- Report channels for appeals
- Warning systems before bans

**Gap opportunity**: Slack lacks good community moderation. Carmenta could fill this -
gently, with heart-centered principles.

### Engagement Without Gamification Hell

HeyTaco, Karma, Scorebot show gamification can work. But:

- Leaderboards can create unhealthy competition
- Points without meaning become noise
- Recognition must feel authentic

**Balance**: Carmenta can celebrate and recognize without turning community into a game.
Authenticity over mechanics.

## Voice and Tone Guidelines (From Slack Official)

**Do:**

- Use contractions: "You'll be able to" not "You will"
- Be brief and human
- Use empathy and inclusive language
- Gender-neutral pronouns
- Read scripts out loud to catch unnatural phrasing

**Don't:**

- Add jokes just to add them - "a little goes a long way"
- Construct personality requiring excessive sentences
- Use puns that distract from meaning
- Be chatty - in-channel posts are long-lived

**Feedback patterns:**

- Use "is typing" indicator for short operations
- For longer operations, use emoji reactions or status messages
- Acknowledge every user message - never leave people wondering

## Anti-Patterns to Avoid

### The Cardinal Sins (Slack Official Guidance)

1. **Never spam on install**: Don't DM every user when installed
2. **Never self-add to channels**: Ask permission before joining
3. **Never over-notify**: Make opt-out easy and obvious
4. **Never violate timing**: Respect timezones and do-not-disturb

### Message Discipline

- In-channel posts are **long-lived** - only post what matters to the whole team
- Use ephemeral messages for individual-only information
- A chatty app is not a good thing
- Batch updates: don't send 10 messages when 1 would do

### Personality Pitfalls

- Repetitive responses emphasize "technological nature"
- Limited understanding of social context restricts perceived humanness
- Over-automation feels mechanical
- Generic responses break the illusion of presence

## What Discord Does Better (and We Should Learn)

### Built-in Features Slack Lacks

- **Leveling/XP systems**: Engagement gamification (Tatsu, MEE6)
- **Advanced moderation**: Autoban, raid protection, content filtering
- **Event management**: Built-in event creation and RSVPs
- **Voice channels**: Real-time collaboration spaces

### Community Revival Patterns

Dead Chat Reviver detects quiet channels and posts prompts. Nightmode prevents spam
during off-hours. Analytics show which prompts spark engagement.

**Opportunity**: Carmenta could notice when the community is quiet and thoughtfully
re-engage - not with random prompts, but with relevant context.

## Release and Changelog Patterns

### What Works

- **Branch pattern matching**: Different notification rules for different branches
- **Draft → Edit → Approve → Post workflow**: Multi-step for quality control
- **Summary posting**: After distribution, summarize where announcements went

### From Slack's Success Bot

- Batch updates: Bundle related updates instead of messaging every few days
- 22% click-through rate achieved through relevant, well-timed messages
- 200 hours/month saved through smart automation

## The Proactive Bot Formula

Research shows proactive bots work when they:

1. **Notice patterns before users ask**: "I see you've been asking about X..."
2. **Respect timing religiously**: Only surface during appropriate hours
3. **Bundle intelligently**: Combine related updates
4. **Reference past context**: "Like we discussed last week..."
5. **Escalate appropriately**: Know when human attention is needed
6. **Get out of the way**: Enable connection, don't dominate it

## Platform Considerations

### Rate Limits (Critical for Proactive Behavior)

- Events API: 30,000 events/workspace/app/hour
- May 2025: Non-marketplace apps get 1 request/minute for conversations.history
- Marketplace approval becoming essential for high-volume access

### Socket Mode vs Events API

- **Socket Mode**: No public endpoint, lower latency, simpler - but can't list in
  Marketplace
- **Events API**: Requires HTTPS endpoint, but enables distribution

For community bot: Start with Socket Mode for development, plan for Events API for
scale.

### AI Agent Framework

Slack's "Agents & Assistants" framework provides:

- BYOLLM (Bring Your Own LLM) support
- Persistent split-view window
- Context-aware dynamic prompts
- Required scopes: `assistant:write`

## Success Metrics from the Best

| Metric                    | Benchmark                     |
| ------------------------- | ----------------------------- |
| Daily engagement          | 85% (HeyTaco)                 |
| Response rate improvement | 7-10x (Polly vs email)        |
| Click-through rate        | 22% (Slack Success Bot)       |
| Time saved                | 200 hours/month (Success Bot) |
| Response time             | 43% faster with Slack Connect |

## Synthesis: What Best-of-Breed Means for Carmenta

1. **Presence over commands**: Natural conversation, not slash commands
2. **Connection over content**: Help people find each other
3. **Timing is everything**: Respect async, bundle updates, never spam
4. **Deep integration**: Take actions across systems, not just answer questions
5. **Authentic personality**: Warm but not performative
6. **Intelligent escalation**: Know when humans are needed
7. **Privacy first**: Clear about what's seen and how it's used
8. **Proactive with purpose**: Surface value, not noise
