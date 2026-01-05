# Quo Messaging Integration

Bidirectional SMS communication between Carmenta and users. Carmenta sends proactive
notifications; users reply via SMS and continue conversations. SMS becomes another
channel where Carmenta is present.

**Status**: Research complete, ready for implementation

## Why This Exists

Carmenta currently waits for users to open the app. This is limiting. Scheduled agents
complete work while we sleep. Important signals emerge that warrant attention. Sometimes
the simplest interface is a text message.

SMS bridges the gap between proactive intelligence and user awareness. When an agent
finishes a task, Carmenta texts us. When we reply, the conversation continues. No app
required.

This is Carmenta reaching out, not just responding.

## Core Concept

Three capabilities, one integration:

1. **Carmenta → User** (Outbound): Notifications, briefings, alerts
2. **User → Carmenta** (Inbound): Replies processed as Carmenta messages
3. **Conversation Continuity**: SMS thread maintains context with web conversations

## Architecture Decisions

✅ **Carmenta Phone Number**: `+1 (737) 377-3499` - Single number for all users. Simpler
operationally, and users text "Carmenta" not "my instance."

✅ **Opt-in Model**: Users must explicitly enable SMS notifications. We don't text
anyone who hasn't asked for it. TCPA compliance and user trust.

✅ **Conversation Boundaries**: Context-first routing with time-based fallback. See
[Conversation Routing](#conversation-routing) section for full design.

✅ **Email Verification First**: Users must have verified email (via Clerk) before
adding a phone number. Prevents random claims and unauthorized associations.

✅ **Dedicated Carmenta API Key**: `QUO_NOTIFICATION_API_KEY` environment variable for
system-level sends. Separate from user's Quo API keys for their own tool calls.

## Robustness Requirements

Critical requirements identified through architecture and robustness review.

### Webhook Security

Quo uses Svix for webhook signatures. Verification is mandatory:

```typescript
import { Webhook } from "svix";

const webhook = new Webhook(env.QUO_WEBHOOK_SECRET);
const verified = webhook.verify(payload, headers);
// Reject with 401 if verification fails - fail closed
```

### Unknown Sender Protection

Prevent SMS bombing attacks from unknown numbers:

- Track unknown numbers in `unknown_sms_senders` table
- Only send "Who is this?" once per 24 hours per unknown number
- Rate limit: max 10 messages/hour from any single number
- Log suspected abuse to Sentry for monitoring

### Concurrent Webhook Handling

Race conditions when multiple webhooks arrive simultaneously:

- Use `FOR UPDATE` lock when querying context routing table
- Idempotency key: Quo's `messageId` prevents duplicate processing
- Store processing state: `{ messageId, status: 'processing' | 'completed' }`

### Outbound Failure Handling

When Quo API is unavailable:

- Queue outbound messages (Postgres-backed, not Redis dependency)
- Retry with exponential backoff: 3 retries over 15 minutes
- After exhaustion: fall back to email notification
- Track delivery status in `sms_context` for debugging

### Rate Limiting (10 req/s Quo limit)

- Token bucket rate limiter for QuoNotificationService
- Queue outbound when approaching limit
- 100ms spacing between bulk notifications
- Log when rate limiting kicks in

### TCPA Compliance

Legal requirements for SMS messaging:

- Add `sms_opt_in` boolean + `opted_in_at` timestamp to user_phone_numbers
- Handle STOP/UNSUBSCRIBE keywords → immediately update opt_in → confirm
- Block ALL outbound if `sms_opt_in = false`
- Track opt-in source for audit compliance

### Response Formatting

SMS-specific constraints:

- Target 1-2 segments (160-320 chars) for replies
- For longer responses: "More in Carmenta: [link]"
- AI prompt includes SMS brevity constraint
- Add `channel: 'sms' | 'web'` to message type for routing awareness

## Current State

We have a Quo adapter (`lib/integrations/adapters/quo.ts`) that handles:

- `send_message`: Send SMS via AI tool call
- `list_messages`: Read conversation history
- `list_conversations`: View message threads
- `list_phone_numbers`: Get available Quo numbers

This works for AI-initiated messaging when the user prompts it. What's missing:

- **Webhook infrastructure** for receiving inbound messages
- **System-level sending** (Carmenta sends, not user's AI agent)
- **Routing** inbound messages to appropriate handler
- **User association** linking phone numbers to Carmenta accounts

## What Leaders Do Today

### Proactive AI Messaging (Best-in-Class)

**Intercom** ([$99/mo Proactive Support add-on](https://www.intercom.com/))

- AI-initiated outreach based on user behavior patterns
- Tooltips, banners, and push messages triggered by conditions
- Predictive support: reaching out before problems arise

**Drift/Salesloft** ([Drift AI](https://www.salesloft.com/platform/drift))

- Real-time intent detection triggers personalized outreach
- AI Engagement Score prioritizes which users to contact
- Cross-channel coordination (chat, email, SMS)

**Pattern**: Best-in-class AI doesn't just respond—it anticipates, initiates, and
reaches out at optimal moments.

### SMS-Specific AI Patterns

**Key insight from
[TextDrip](https://textdrip.com/blog/ai-chatbots-that-convert-text-to-conversations)**:
Conversational AI over SMS works best when it:

- Sends at optimal times based on user behavior history
- Adjusts tone based on past interaction patterns
- Handles replies without requiring app context switch
- Proactively sends next steps after calls/meetings

**From
[DialMyCalls](https://www.dialmycalls.com/blog/conversational-ai-in-sms-and-calling)**:

- AI can send follow-up instructions via SMS during voice calls
- 24/7 availability: SMS bots respond instantly after hours
- Appointment confirmations, reschedule options, reminders

### Webhook Patterns (Quo-Specific)

From [Quo webhook documentation](https://www.quo.com/docs/mdx/guides/webhooks):

**Event Types**:

- `message.received` - Inbound SMS
- `message.delivered` - Delivery confirmation
- Calls, transcripts, and summaries also available

**Payload Structure** (v4 API):

```json
{
  "id": "[event_id]",
  "object": "event",
  "apiVersion": "v4",
  "createdAt": "[timestamp]",
  "type": "message.received",
  "data": {
    "object": {
      "id": "[message_id]",
      "from": "+14155551234",
      "to": ["+14155550100"],
      "direction": "incoming",
      "text": "Message content",
      "status": "delivered",
      "createdAt": "[timestamp]",
      "userId": "[quo_user_id]",
      "phoneNumberId": "[quo_phone_id]"
    }
  }
}
```

**Important**: Webhooks created via API are separate from app-created webhooks. We must
create and manage webhooks programmatically.

## Integration with Existing Architecture

### Scheduled Agents → Quo

From [scheduled-agents.md](./scheduled-agents.md):

> Notification and Delivery: How scheduled agent output reaches us:
>
> - Push notifications (PWA/mobile)
> - Email digests
> - In-app surfaces (dashboard, briefing view)
> - Proactive messages in conversation

**SMS is a natural addition.** When a scheduled agent completes, it can:

1. Generate summary for delivery
2. Route through notification system
3. Deliver via Quo if user prefers SMS

### Concierge Routing

From [concierge.md](./concierge.md):

> Before any other routing, the Concierge checks for @carmenta mentions.

**Inbound SMS messages route through Concierge.** The webhook handler:

1. Receives message from Quo
2. Looks up user by phone number
3. Creates a Carmenta message with SMS context
4. Routes through Concierge like any other message
5. Response sent back via Quo SMS

### Carmenta Interaction

From [carmenta-interaction.md](./carmenta-interaction.md):

> Mentioning @carmenta in any message triggers entity mode.

**SMS messages can include @carmenta** for entity mode, or default to LLM routing. The
interface is conversational—SMS is just another channel.

## Technical Architecture

### Outbound (Carmenta → User)

```
[Scheduled Agent completes]
        ↓
[Notification System decides channel]
        ↓
[If SMS: Quo Service sends message]
        ↓
[Message logged to conversation history]
```

**New Service: `QuoNotificationService`**

```typescript
interface QuoNotificationService {
  sendNotification(params: {
    userEmail: string;
    content: string;
    source: "scheduled_agent" | "alert" | "briefing" | "reminder";
    conversationId?: string; // Link to existing conversation
    urgency?: "low" | "normal" | "high";
  }): Promise<{ messageId: string; status: "queued" }>;
}
```

**Key difference from existing adapter**: This sends as Carmenta (system-level), not as
a user's AI agent executing a tool call.

### Inbound (User → Carmenta)

```
[Quo webhook fires]
        ↓
[API route: POST /api/webhooks/quo]
        ↓
[Verify signature, parse payload]
        ↓
[Look up user by phone number]
        ↓
[Create message in conversation]
        ↓
[Route through Concierge]
        ↓
[Generate response]
        ↓
[Send response via Quo]
```

**Webhook Handler: `/api/webhooks/quo/route.ts`**

```typescript
interface QuoWebhookPayload {
  id: string;
  object: "event";
  apiVersion: "v4";
  type: "message.received" | "message.delivered";
  createdAt: string;
  data: {
    object: {
      id: string;
      from: string;
      to: string[];
      direction: "incoming" | "outgoing";
      text: string;
      phoneNumberId: string;
    };
  };
}
```

### User Phone Number Association

**New database table: `user_phone_numbers`**

```typescript
{
  id: serial,
  userEmail: varchar(255)    // FK to users.email (matches integrations pattern)
    .references(() => users.email, { onDelete: "cascade" }),
  phoneNumber: varchar(20),  // E.164 format, validated with libphonenumber-js
  verified: boolean,         // Verification completed
  verifiedAt: timestamp,
  isPrimary: boolean,        // Primary notification number
  smsOptIn: boolean,         // TCPA: explicit opt-in for notifications
  optedInAt: timestamp,      // TCPA: audit trail
  createdAt: timestamp,
}
// Indexes: phoneNumber (webhook lookup), userEmail (user queries)
```

**Verification flow**:

1. User must be authenticated with verified email (Clerk)
2. User adds phone number (validated to E.164 format)
3. Carmenta sends 6-digit verification code via Quo (15-minute expiry)
4. Max 3 attempts per hour, lock after 5 failed attempts
5. User enters code → number verified
6. User explicitly opts in to SMS notifications (TCPA)

### Conversation Routing

SMS messages are part of the Carmenta conversation, not separate threads. The challenge:
when a user texts back, which conversation does it belong to?

**Design Principle**: "Customers don't think in channels. They think in conversations."
([Freshworks](https://www.freshworks.com/omnichannel/messaging/)) We route to the
conversation the user is mentally in, not based on arbitrary time windows.

**Routing Priority (evaluated in order)**:

1. **Notification Context** (strongest signal)

   When we send an outbound notification, we tag it with a `contextId` linking to the
   source conversation or agent run. If a reply arrives within the **context window** (4
   hours), route to that conversation.

   ```typescript
   interface OutboundSmsContext {
     messageId: string; // Quo message ID
     userEmail: string;
     conversationId: string; // Link back to Carmenta conversation
     sentAt: Date;
     contextWindowEnds: Date; // sentAt + 4 hours
   }
   ```

   This handles the common case: agent completes → notification sent → user replies
   "thanks" or asks a follow-up → goes to the right place.

2. **Recency Heuristic** (fallback when no notification context)

   If no recent outbound notification, look at the user's last SMS interaction:
   - **Within 30 minutes**: Continue the most recent SMS-active conversation
   - **After 30 minutes**: Start a new conversation

   Inspired by
   [Twilio's state timers](https://www.twilio.com/docs/conversations/states-timers) -
   conversations transition from active → inactive based on inactivity duration.

3. **Explicit New Conversation Signals** (user override)

   Certain phrases force a new conversation regardless of timing:
   - "new", "start over", "new conversation", "fresh start"
   - "hey carmenta", "hi carmenta" (greeting = new topic)

   This gives users an escape hatch when context routing gets it wrong.

4. **Semantic Routing** (future enhancement)

   If the message content clearly relates to a specific conversation (mentions something
   distinct), route there even if time windows expired. Requires NLP to match message
   content against recent conversation topics.

**Data Model for Context Tracking**:

```typescript
// New table: sms_context
{
  id: serial,
  quoMessageId: varchar(100),     // Outbound message ID from Quo (idempotency key)
  userEmail: varchar(255)
    .references(() => users.email, { onDelete: "cascade" }),
  conversationId: integer         // FK to connections.id (integer, not varchar)
    .references(() => connections.id, { onDelete: "cascade" }),
  agentRunId: varchar(100),       // Optional: if from scheduled agent
  sentAt: timestamp,
  contextWindowEnds: timestamp,   // sentAt + 4 hours
  repliedAt: timestamp,           // When user replied (null if no reply)
  deliveryStatus: enum('queued', 'sent', 'delivered', 'failed'),
  processingStatus: enum('pending', 'processing', 'completed'), // Webhook idempotency
  routingMetadata: jsonb,         // Future: semantic routing data
}
// Indexes: quoMessageId (idempotency), userEmail+contextWindowEnds (routing)
```

**Additional table: `unknown_sms_senders`** (spam protection):

```typescript
{
  id: serial,
  phoneNumber: varchar(20),       // E.164 format
  firstSeenAt: timestamp,
  lastPromptedAt: timestamp,      // When we last sent "Who is this?"
  messageCount: integer,          // For rate limiting
  blockedAt: timestamp,           // If rate limit exceeded
}
// Index: phoneNumber
```

**Timeout Configuration**:

Following
[best practices for dynamic timeouts](https://quidget.ai/blog/ai-automation/chatbot-session-timeout-settings-best-practices/):

| Context Type        | Window Duration | Rationale                                |
| ------------------- | --------------- | ---------------------------------------- |
| Notification reply  | 4 hours         | User may see notification later          |
| Active SMS exchange | 30 minutes      | Conversational back-and-forth            |
| Complex topic       | 2 hours         | Extended discussion (detected by length) |

**Edge Cases**:

- **Multiple notifications pending**: Route to most recent notification's conversation
- **User has no verified number**: Webhook logs message, sends "Who is this?" reply
- **Context window just expired**: Route to new conversation, but include context
  breadcrumb: "Starting fresh. Your last conversation was about [topic]."
- **Greeting + context**: "Hey, did that report finish?" → greeting detected but context
  keyword triggers semantic routing to report conversation

## Gap Assessment

### Achievable Now

- Webhook endpoint for `message.received`
- Phone number verification flow
- Basic outbound notifications
- Response routing through existing Concierge

### Emerging (6-12 months)

- Optimal send time prediction based on user patterns
- Tone adjustment based on conversation history
- MMS support (Quo currently SMS-only)
- Voice + SMS coordination (call summary → SMS recap)

### Aspirational

- Predictive outreach (Carmenta initiates based on detected patterns)
- Multi-user thread support (group SMS with Carmenta)
- Rich media in SMS (RCS when available)

## Implementation Milestones

### Milestone 1: Receive Messages

1. Create `/api/webhooks/quo` endpoint
2. Parse `message.received` events
3. Log inbound messages (no routing yet)
4. Verify webhook security

### Milestone 2: User Association

1. Add `user_phone_numbers` table
2. Build phone number verification flow
3. Link inbound messages to users

### Milestone 3: Route Inbound

1. Create SMS message in conversation
2. Route through Concierge
3. Generate and send response
4. Handle conversation context

### Milestone 4: Proactive Outbound

1. Create `QuoNotificationService`
2. Integrate with notification system
3. Connect to scheduled agents
4. Add user notification preferences

### Milestone 5: Refinement

1. Optimal send timing
2. Rate limiting and batching
3. Delivery status tracking
4. Analytics and observability

## Open Questions

### Product

- **Channel preferences**: Per-notification-type channel selection? (e.g., briefings via
  email, alerts via SMS)
- **Quiet hours**: Respect do-not-disturb windows? User-configurable?

### Technical

- **Rate limiting**: Quo's 10 req/s limit - batching strategy for bulk notifications?
- **Failure handling**: What happens if Quo is down when agent completes? Queue and
  retry? Fall back to email?
- **Verification security**: SMS verification is weak - acceptable for notifications?
  Consider requiring email verification first.

### Business

- **Cost model**: Quo messages cost ~$0.01/segment. Who pays? Include in subscription?
  Usage-based?
- **Compliance**: SMS marketing regulations (TCPA, etc.) - need explicit opt-in
  language, unsubscribe mechanism ("STOP" keyword handling)

## Security Considerations

1. **Webhook verification**: Verify Quo signatures on all inbound webhooks
2. **Rate limiting**: Prevent SMS bombing via API
3. **Phone number validation**: E.164 format enforcement
4. **User consent**: Track opt-in for proactive notifications
5. **Data handling**: Phone numbers are PII - encryption at rest

## Success Criteria

- Users can add and verify their phone number
- Scheduled agents can notify users via SMS
- Users can reply to SMS notifications
- Replies route correctly and generate appropriate responses
- Conversation context is preserved across channels
- Users feel Carmenta is present, not just another notification system

## Sources

### Quo API

- [Quo API Introduction](https://www.quo.com/docs/mdx/api-reference/introduction)
- [Quo Webhooks Guide](https://www.quo.com/docs/mdx/guides/webhooks)
- [Quo LLM Integration](https://www.quo.com/llm-info)

### Proactive AI Messaging

- [Intercom Proactive Support](https://www.intercom.com/blog/principles-bot-design/)
- [Drift AI Platform](https://www.salesloft.com/platform/drift)
- [eesel AI Proactive Chat Guide](https://www.eesel.ai/blog/proactive-chat)
- [TextDrip SMS AI Strategies](https://textdrip.com/blog/ai-chatbots-that-convert-text-to-conversations)
- [Conversational AI Trends 2025](https://intellias.com/7-conversational-ai-trends/)

### Conversation Routing & Session Management

- [Freshworks Omnichannel Messaging Guide](https://www.freshworks.com/omnichannel/messaging/)
- [Twilio Conversation States & Timers](https://www.twilio.com/docs/conversations/states-timers)
- [Chatbot Session Timeout Best Practices](https://quidget.ai/blog/ai-automation/chatbot-session-timeout-settings-best-practices/)
- [AI Chatbot Session Management](https://optiblack.com/insights/ai-chatbot-session-management-best-practices/)
- [Session Persistence in AI Chat](https://predictabledialogs.com/learn/ai-stack/session-persistence-ai-chat-continuity-strategies/)
