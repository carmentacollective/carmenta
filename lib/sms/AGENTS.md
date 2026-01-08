# SMS - Carmenta's System-Level Messaging

**This is Carmenta sending messages TO users, not users sending messages via their own
accounts.**

## Two SMS Systems in Carmenta

Carmenta has TWO separate SMS capabilities. They serve different purposes:

| System                   | Directory                          | Purpose                                  | Credentials                           |
| ------------------------ | ---------------------------------- | ---------------------------------------- | ------------------------------------- |
| **Notification Service** | `lib/sms/` (here)                  | Carmenta texts users proactively         | Carmenta's `QUO_NOTIFICATION_API_KEY` |
| **Integration Adapter**  | `lib/integrations/adapters/quo.ts` | Users send SMS via their own Quo account | User's API key                        |

## This Directory: Notification Service

The notification service enables Carmenta to proactively reach users via SMS:

- **Scheduled agent results** - Background tasks completing
- **Alerts** - Important events or changes
- **Briefings** - Daily/weekly summaries
- **Reminders** - Time-based notifications

### Key Files

- `quo-notification-service.ts` - Send notifications, track delivery, handle retries
- `index.ts` - Module exports

### How It's Exposed to the Model

The `smsUser` tool in `lib/ai-team/agents/sms-user-tool.ts` wraps this service. It's
included in:

- Main chat route (`app/api/connection/route.ts`)
- DCOS agent (`lib/ai-team/dcos/agent.ts`)

### Requirements

For Carmenta to send SMS:

1. `QUO_NOTIFICATION_API_KEY` env var must be set (Carmenta's API key)
2. `QUO_PHONE_NUMBER` env var must be set (Carmenta's phone number)
3. User must have a **verified, opted-in** phone number in their profile

### The Other System

If you're looking for **users sending SMS via their own Quo account**, see
`lib/integrations/adapters/quo.ts`. That's the integration adapter - a completely
separate system where users connect their own Quo credentials.
