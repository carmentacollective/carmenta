# Integrations - User-Connected External Services

**These are the user's OWN accounts, not Carmenta's system-level capabilities.**

## What This Directory Does

The integrations system allows users to connect their external accounts (Gmail, Slack,
Notion, Quo, etc.) so Carmenta can interact with those services on their behalf.

- Users provide their own credentials (OAuth or API key)
- Tools only appear when the user has connected the service
- Carmenta acts as the user, with their permissions

## Two Quo Systems - Critical Distinction

Carmenta has TWO separate SMS/Quo capabilities:

| System                   | Directory                                 | Purpose                                  | Credentials                           |
| ------------------------ | ----------------------------------------- | ---------------------------------------- | ------------------------------------- |
| **Integration Adapter**  | `lib/integrations/adapters/quo.ts` (here) | Users send SMS via their own Quo account | User's API key                        |
| **Notification Service** | `lib/sms/`                                | Carmenta texts users proactively         | Carmenta's `QUO_NOTIFICATION_API_KEY` |

### The Quo Adapter (This Directory)

When a user connects their Quo account:

- They provide their own Quo API key
- Carmenta can send SMS from **their** phone number
- Messages come from the user's business phone, not Carmenta

### Carmenta's Notification Service (lib/sms/)

When Carmenta needs to proactively text a user:

- Uses Carmenta's own Quo credentials (`QUO_NOTIFICATION_API_KEY`)
- Messages come from Carmenta's phone number
- Requires user to have a verified phone number on file

## Key Files

- `services.ts` - Service registry (available integrations)
- `connection-manager.ts` - OAuth/API key storage and retrieval
- `tools.ts` - Creates Vercel AI SDK tools for connected services
- `adapters/` - Service-specific implementations

## How Tools Get Exposed

`getIntegrationTools(userEmail)` returns tools only for services the user has connected.
Called from:

- Main chat route (`app/api/connection/route.ts`)
- DCOS agent (`lib/ai-team/dcos/agent.ts`)

If a service isn't showing up for a user, they likely haven't connected it yet.
