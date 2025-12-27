# Slackbot Architecture

Technical implementation details for Carmenta's Slack presence. How it connects to
existing infrastructure, handles events, and integrates with the broader system.

## Relationship to Existing Slack Integration

The codebase already has a mature Slack integration in
`lib/integrations/adapters/slack.ts` (1432 lines). This adapter:

- Uses OAuth user tokens (xoxp-) to act AS authenticated users
- Provides 14 operations: channels, messages, reactions, file uploads
- Handles rate limiting, error recovery, and MCP tool annotations
- Integrates with existing credential management

The Slackbot is DIFFERENT:

- Uses bot tokens (xoxb-) to act AS Carmenta
- Responds to events (messages, mentions, joins)
- Maintains its own presence and identity
- Operates in Carmenta's community workspace, not user workspaces

**Key decision**: The Slackbot does NOT reuse the existing adapter. It's a separate
application with different tokens, scopes, and patterns. The existing adapter is for
users connecting THEIR Slack; the Slackbot is Carmenta's own presence.

## Framework: Bolt

Slack's official Bolt framework (TypeScript) is the foundation:

- Handles event parsing, signature verification, and response formatting
- Provides clean listener patterns for events, commands, and interactions
- Supports both Socket Mode and Events API
- Well-maintained, well-documented, production-ready

```typescript
import { App } from "@slack/bolt";

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true, // Start with Socket Mode
  appToken: process.env.SLACK_APP_TOKEN,
});
```

## Event Handling Architecture

### Event Sources

1. **App mentions**: `@Carmenta can you help with...`
2. **Direct messages**: DMs to the Carmenta bot
3. **Message events**: Messages in channels Carmenta monitors
4. **Member joins**: New members joining the workspace
5. **Reactions**: Emoji reactions that trigger actions
6. **Scheduled triggers**: Cron-based proactive actions

### The 3-Second Challenge

Slack requires acknowledgment within 3 seconds or assumes the API is down. For LLM
responses that take longer:

**Pattern: Immediate Ack + Streaming Update**

```typescript
app.event("app_mention", async ({ event, say, client }) => {
  // Immediately acknowledge with typing indicator
  await client.reactions.add({
    channel: event.channel,
    timestamp: event.ts,
    name: "eyes", // Show we're processing
  });

  // Post placeholder message
  const response = await say({
    text: "Thinking...",
    thread_ts: event.thread_ts || event.ts,
  });

  // Stream LLM response, updating the message
  await streamResponse(event.text, response.ts, event.channel, client);
});
```

### Socket Mode vs Events API

**Socket Mode** requires a persistent WebSocket connection - incompatible with Vercel's
serverless model.

**Events API** is the path forward:

- Works with serverless (Vercel)
- Required for Slack Marketplace listing
- Stateless, scales automatically
- Combined with Inngest for durable background processing

## Integration with Carmenta Core

### Concierge Integration

The Slackbot uses the same Concierge for quality responses:

```typescript
import { processQuery } from "@/lib/concierge";

async function handleSlackMessage(message: string, context: SlackContext) {
  const response = await processQuery({
    query: message,
    conversationType: "slack-community",
    userContext: await getSlackUserContext(context.userId),
    systemContext: getSlackSystemContext(context.channel),
  });

  return response;
}
```

### Memory Access

Carmenta can access community-level memory:

- Community patterns and recurring topics
- Individual member context (if they're also Carmenta users)
- Historical question/answer pairs
- Resolved issues and their solutions

### Knowledge Base

Access to product documentation for accurate help:

- Feature documentation
- Troubleshooting guides
- Release notes and changelogs
- Integration guides

## State Management

### Thread Context

Maintain conversation context within threads:

```typescript
interface ThreadContext {
  threadTs: string;
  channelId: string;
  participants: string[];
  messageHistory: Message[];
  topic: string;
  resolved: boolean;
}
```

Store in Redis for fast access, persist to PostgreSQL for durability.

### Member Relationships

Track community relationships:

```typescript
interface MemberRelationship {
  memberA: string;
  memberB: string;
  interactionCount: number;
  helpGiven: number; // A helped B
  helpReceived: number; // B helped A
  lastInteraction: Date;
}
```

### Community Patterns

Aggregate patterns for product intelligence:

```typescript
interface CommunityPattern {
  patternType: "question" | "frustration" | "feature-request" | "praise";
  topic: string;
  frequency: number;
  exampleMessages: string[];
  firstSeen: Date;
  lastSeen: Date;
}
```

## Proactive Behavior System

### Trigger Types

1. **Time-based**: Daily/weekly scheduled actions
2. **Event-based**: Respond to workspace events
3. **Pattern-based**: When community patterns are detected
4. **Threshold-based**: When metrics cross thresholds

### Proactive Actions

```typescript
interface ProactiveAction {
  type: "welcome" | "check-in" | "celebrate" | "connect" | "announce";
  trigger: TriggerCondition;
  cooldown: Duration; // Avoid over-messaging
  targetChannel: string | null; // null = DM
  template: MessageTemplate;
}
```

### Timing Intelligence

Respect async and timezones:

```typescript
function shouldAct(action: ProactiveAction, member: Member): boolean {
  // Check timezone-appropriate hours
  if (!isWorkingHours(member.timezone)) return false;

  // Check DND status
  if (member.dndActive) return false;

  // Check cooldown
  if (withinCooldown(action, member)) return false;

  // Check daily message limit
  if (exceededDailyLimit(member)) return false;

  return true;
}
```

## Deployment Architecture: Vercel + Inngest

Carmenta runs on Vercel. Slack bots need to handle long-running LLM calls, which don't
fit Vercel's serverless timeout model. **Inngest** solves this by providing durable
background execution while keeping all code in the same repo.

### How Inngest Works

Inngest does NOT run your code on their servers. Your code runs in Vercel. Inngest is
the orchestrator that calls your endpoints at the right times.

```
┌─────────────────────────────────────────────────────────────┐
│                     INNGEST CLOUD                           │
│  (Event queue, scheduling, retries, state management)       │
│                                                             │
│  "Hey Vercel, run step 2 of function X with this state"     │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP POST
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     VERCEL (carmenta)                       │
│                                                             │
│   /api/inngest  ← Single endpoint handles all Inngest calls │
│        │                                                    │
│        ▼                                                    │
│   Your function code executes here, in your environment     │
│   with your env vars, your database connections, etc.       │
└─────────────────────────────────────────────────────────────┘
```

**No Docker. No separate runtime. No deploying code to Inngest.**

### The Slack → Inngest Flow

```
Slack Event ──► /api/slack/events (Vercel) ──► Ack immediately (<3s)
                        │
                        ▼
                inngest.send({ event })
                        │
                        ▼
              Inngest queues the work
                        │
                        ▼
              Calls /api/inngest with step instructions
                        │
                        ▼
              Vercel executes step (call Concierge, etc.)
                        │
                        ▼
              Posts response back to Slack via API
```

### Implementation

**1. Inngest Client**

```typescript
// lib/inngest/client.ts
import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "carmenta" });
```

**2. Slack Event Handler (immediate ack)**

```typescript
// app/api/slack/events/route.ts
import { inngest } from "@/lib/inngest/client";

export async function POST(req: Request) {
  const body = await req.json();

  // Slack URL verification challenge
  if (body.challenge) {
    return Response.json({ challenge: body.challenge });
  }

  // Handle events by type
  if (body.event?.type === "app_mention") {
    await inngest.send({
      name: "slack/app.mention",
      data: body.event,
    });
  }

  if (body.event?.type === "member_joined_channel") {
    await inngest.send({
      name: "slack/member.joined",
      data: body.event,
    });
  }

  // Respond to Slack immediately (required within 3s)
  return new Response("OK", { status: 200 });
}
```

**3. Inngest Functions (durable background work)**

```typescript
// lib/inngest/functions/slack-mention.ts
import { inngest } from "../client";
import { processWithConcierge } from "@/lib/concierge";

export const handleSlackMention = inngest.createFunction(
  { id: "slack-mention-handler" },
  { event: "slack/app.mention" },

  async ({ event, step }) => {
    // Step 1: Add eyes reaction to show we're processing
    await step.run("acknowledge", async () => {
      await fetch("https://slack.com/api/reactions.add", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: event.data.channel,
          timestamp: event.data.ts,
          name: "eyes",
        }),
      });
    });

    // Step 2: Process with Concierge (can take 30+ seconds)
    const response = await step.run("process-message", async () => {
      return await processWithConcierge({
        message: event.data.text,
        userId: event.data.user,
        channel: event.data.channel,
      });
    });

    // Step 3: Post response to Slack
    await step.run("post-response", async () => {
      await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: event.data.channel,
          thread_ts: event.data.thread_ts || event.data.ts,
          text: response,
        }),
      });
    });
  }
);
```

**4. Inngest Serve Endpoint**

```typescript
// app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { handleSlackMention } from "@/lib/inngest/functions/slack-mention";
import { handleMemberJoined } from "@/lib/inngest/functions/member-joined";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    handleSlackMention,
    handleMemberJoined,
    // Add more functions here
  ],
});
```

### Why Inngest

| Benefit                | How                                                 |
| ---------------------- | --------------------------------------------------- |
| **Durable execution**  | Steps are cached; retries resume from failure point |
| **No infrastructure**  | Just npm install and add one env var                |
| **Stays in this repo** | Code lives alongside Carmenta, shares types/utils   |
| **Free tier**          | 100K executions/month covers a community bot        |
| **Observability**      | Dashboard shows all runs, failures, retries         |

### Inngest Pricing

| Plan | Cost | Executions/mo |
| ---- | ---- | ------------- |
| Free | $0   | 100K          |
| Pro  | $75  | 1M            |

### Required Services

- **Vercel**: Hosts the app and Inngest endpoints
- **Inngest**: Event queue, step orchestration, state management
- **Redis**: Thread context, rate limiting, caching (Upstash)
- **PostgreSQL**: Member relationships, community patterns (Neon/Supabase)

## Security Considerations

### Token Management

- Bot tokens stored in environment variables, never logged
- Signing secret validates incoming requests
- App token for Socket Mode (development only)

### Permission Model

Carmenta needs:

- `app_mentions:read` - See mentions
- `channels:history` - Read channel messages
- `channels:read` - List channels
- `chat:write` - Send messages
- `reactions:read` - See reactions
- `reactions:write` - Add reactions
- `users:read` - Read user info
- `im:history` - DM history
- `im:write` - Send DMs

### Data Handling

- Community messages processed for responses, not stored long-term
- Patterns aggregated and anonymized
- Individual member context only for active community members
- Clear data retention policy

## Rate Limiting Strategy

### Slack's Limits

- Events API: 30,000 events/workspace/app/hour
- Web API: Varies by method, check headers
- Posting: ~1 message/second sustained

### Our Approach

- Queue outgoing messages with rate limiting
- Batch proactive actions to avoid bursts
- Monitor rate limit headers, back off when needed
- Prioritize interactive responses over proactive

## Observability

### Metrics to Track

- Response latency (time to first response)
- Resolution rate (questions answered successfully)
- Engagement rate (responses that spark further conversation)
- Proactive action effectiveness (do check-ins get responses?)
- Error rates by action type

### Logging

Use existing Pino logger with Slack-specific context:

```typescript
const logger = baseLogger.child({
  service: "slackbot",
  channel: context.channelId,
  thread: context.threadTs,
  user: context.userId,
});

logger.info({ action: "mention-received" }, "Processing mention");
```

### Sentry Integration

Capture errors with rich context:

```typescript
Sentry.captureException(error, {
  tags: {
    component: "slackbot",
    action: action.type,
    channel: context.channelId,
  },
  extra: {
    messageText: context.text,
    threadTs: context.threadTs,
  },
});
```

## Implementation Phases

### Phase 1: Foundation

- Bolt app setup with Socket Mode
- Basic mention handling with Concierge integration
- Welcome messages for new members
- Logging and observability

### Phase 2: Intelligence

- Thread context management
- Knowledge base integration
- Pattern detection
- Proactive check-ins

### Phase 3: Community Features

- Member relationship mapping
- Connection suggestions
- Release announcements
- Community health metrics

### Phase 4: Scale

- Events API migration (for Marketplace if desired)
- Advanced proactive behaviors
- Canvas integration
- Cross-channel intelligence

## Open Technical Questions

- **State**: How much state in Redis vs PostgreSQL?
- **Identity**: Same database user records, or separate Slack-only identity?
- **Multi-workspace**: Single codebase for multiple community workspaces?
- **Proactive scheduling**: Use Inngest scheduled functions or Vercel Cron?

## Dependencies

- `inngest` - Durable workflow execution
- `@slack/web-api` - Slack API client
- Existing Carmenta infrastructure: Concierge, Memory, Knowledge Base
- Pino logger, Sentry for observability
- Redis for caching (Upstash), PostgreSQL for persistence (Neon/Supabase)
