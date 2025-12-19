# Integrations

Carmenta connects to the services you use every day. This extends what Carmenta can do
beyond conversation into real action.

## Architecture

<how-integrations-work>
Integrations use OAuth to connect your accounts securely. When you authorize Carmenta to access a service:

1. You grant specific permissions (read messages, create tasks, etc.)
2. Carmenta stores encrypted credentials
3. The AI can then interact with that service on your behalf

Each integration has defined capabilities. Carmenta knows what it can and cannot do with
each connected service. </how-integrations-work>

## Available Integrations

<productivity>
Notion: Access your notes, databases, and documentation. Search across workspaces. Create and update pages. Query databases.

ClickUp: Manage tasks and projects. Create tasks from conversations. Check status.
Update assignments and priorities.

Linear: Issue tracking for engineering teams. Create issues, update status, query
backlogs. </productivity>

<communication>
Slack: Send and receive messages. Search channels. Stay connected with your team.

Gmail: Read and search email. Draft responses. Access your inbox context.
</communication>

<storage>
Google Drive: Access documents, spreadsheets, presentations. Search across your files.
</storage>

<ai-and-data>
Limitless: Sync wearable audio transcripts. Your conversations become searchable context.

Fireflies: Meeting transcripts and notes. Automatic sync of meeting content.
</ai-and-data>

<development>
GitHub: Access repositories, issues, pull requests. Code context for development conversations.
</development>

<calendar-contacts>
Google Calendar: View and manage your schedule. Create events. Check availability.

Google Contacts: Access your contact information. Know who's who. </calendar-contacts>

## Using Integrations

<natural-language>
Once connected, you interact with integrations through natural conversation:

"Find my Notion doc about the Q4 roadmap" "Create a ClickUp task for the bug we just
discussed" "What meetings do I have tomorrow?" "Search my Slack for messages about the
product launch" "Check if there are any open PRs on the carmenta repo"

Carmenta determines which integration to use based on your request. </natural-language>

## Integration Philosophy

<design-principles>
Read-heavy by default: Carmenta prioritizes reading and searching over writing. This is safer and more useful for context gathering.

User confirmation for actions: When Carmenta will take an action (create a task, send a
message), it confirms with you first unless you've explicitly authorized autonomous
action.

Credentials stay encrypted: Your OAuth tokens are encrypted at rest. Only decrypted when
actively used for API calls.

One subscription: All integrations are included. No per-integration fees.
</design-principles>

## What Integrations Enable

<10x-enablement> Integrations are essential for 10x capability:

Without integrations, Carmenta is limited to conversation. With integrations, Carmenta
becomes an execution partner that can:

- Check your calendar before suggesting meeting times
- Create tasks as you discuss work
- Search your documents for relevant context
- Monitor channels for important updates
- Track commitments across systems

The AI team concept requires integrations. A chief of staff needs access to your systems
to coordinate effectively. </10x-enablement>

## MCP Support

<mcp-servers>
Carmenta supports MCP (Model Context Protocol) servers for custom integrations not covered by native connections.

If you have a specialized tool or internal system, you can connect it via MCP. The
protocol provides a standardized way for AI to interact with external services.

Native integrations are preferred when available (better reliability, faster, more
features). MCP fills the gaps for custom needs. </mcp-servers>
