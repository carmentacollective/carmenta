# Integrations

Carmenta connects to the services you use every day. This extends what we can do beyond
conversation into real action.

## How It Works

When you connect a service:

1. You authorize specific permissions through OAuth
2. Credentials are encrypted and stored securely
3. Carmenta can interact with that service on your behalf

Each integration has defined capabilities. We know what we can and can't do with each
connected service.

## Available Integrations

**Productivity**

- [Notion](../integrations/notion.md) — Access notes, databases, documentation
- [ClickUp](../integrations/clickup.md) — Manage tasks and projects

**Communication**

- [Slack](../integrations/slack.md) _(Beta)_ — Messages, channels, team connection
- [Gmail](../integrations/gmail.md) _(Invite only)_ — Email access and search
- [X (Twitter)](../integrations/twitter.md) _(Beta)_ — Post tweets, search timeline

**Storage**

- [Dropbox](../integrations/dropbox.md) _(Beta)_ — Files, folders, shared links

**Meeting Intelligence**

- [Limitless](../integrations/limitless.md) — Wearable audio transcripts
- [Fireflies](../integrations/fireflies.md) — Meeting transcripts and notes

**Development**

- [GitHub](../integrations/github.md) — Repositories, issues, pull requests

**Calendar and Contacts**

- [Google Calendar & Contacts](../integrations/google-calendar.md) — Schedule, events,
  people

**Market Data**

- [CoinMarketCap](../integrations/coinmarketcap.md) — Cryptocurrency prices and market
  data

One subscription covers all integrations. No per-service fees.

## Using Integrations

Once connected, talk naturally:

_"Find my Notion doc about the Q4 roadmap"_

_"Create a ClickUp task for the bug we just discussed"_

_"What meetings do I have tomorrow?"_

_"Search my Slack for messages about the product launch"_

_"Check if there are any open PRs on the main repo"_

We figure out which integration to use. No special syntax. No commands to memorize.

## Philosophy

**Read-heavy by default.** We prioritize reading and searching over writing. This is
safer and more useful for gathering context.

**Confirm before acting.** When we're about to take an action (create a task, send a
message), we confirm with you first unless you've explicitly authorized autonomous
action.

**Minimum necessary access.** We request only the permissions needed. Your full inbox
isn't ours to browse.

**Disconnect anytime.** You can revoke access instantly. Disconnecting removes our
ability to reach that service.

## What This Enables

Without integrations, Carmenta is limited to conversation. With integrations, we become
an execution partner:

- Check your calendar before suggesting meeting times
- Create tasks as you discuss work
- Search your documents for relevant context
- Monitor channels for important updates
- Track commitments across systems

The AI team concept requires this. A chief of staff needs access to your systems to
coordinate effectively.

## MCP Support

For services without native integration, Carmenta supports MCP (Model Context Protocol)
servers.

If you have a specialized tool or internal system, connect it via MCP. The protocol
provides a standardized way for AI to interact with external services.

Native integrations are preferred when available—better reliability, faster, more
features. MCP fills the gaps for custom needs.

## Security

Integration credentials are encrypted at rest. Only decrypted when actively used for API
calls. We store the minimum necessary to maintain your connections.

See our [privacy documentation](./privacy.md) for the full picture.
