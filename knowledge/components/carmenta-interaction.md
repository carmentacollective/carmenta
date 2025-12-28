# Carmenta Interaction

How users talk TO Carmenta as an entity, distinct from talking to LLMs through her. This
is the conversational interface to Product Intelligence - where feedback, bugs,
suggestions, and settings flow through natural dialogue.

## Why This Exists

Traditional products create friction between users and product improvement. Feedback
forms feel bureaucratic. Bug reports require context-switching. Settings live in menus
users must hunt through.

Carmenta dissolves this friction. Users talk to her directly: "@carmenta this flow is
confusing" or "@carmenta switch to dark mode." She understands, acts, and responds. The
interface between user and product becomes conversation.

For simulated agents (Agent Testing), this creates a natural signal format. Bots express
feedback the same way humans do, generating structured signals that Product Intelligence
processes into improvements.

## The @carmenta Pattern

Mentioning @carmenta in any message triggers entity mode. The message routes to Carmenta
herself rather than through her to an LLM.

Examples:

- "@carmenta I found a bug in the voice input"
- "@carmenta switch to dark mode"
- "@carmenta I wish we could export conversations"
- "@carmenta help me understand how memory works"

When intent is unclear ("@carmenta this is interesting"), Carmenta responds
conversationally to understand what the user means. She's a thoughtful PM, not a
classification engine.

## The Oracle Menu

The Oracle icon (top-left of /connection) provides discovery for users who don't know
the @carmenta pattern. Clicking it reveals options that pre-fill the message input:

- "I have feedback" → "@carmenta I have feedback about..."
- "Report a bug" → "@carmenta I found a bug: "
- "I have a suggestion" → "@carmenta I wish we could..."
- "Change my settings" → "@carmenta please change..."
- "I need help" → "@carmenta help me with..."

This teaches the pattern through use. After a few interactions, users naturally type
@carmenta directly.

## Intent Categories

### Feedback

General observations about the product experience. May be positive or negative.

Carmenta response: Acknowledge, ask clarifying questions if needed, search for similar
GitHub Issues. If pattern exists, link to it and add signal. If new, create issue and
notify user with link.

### Bug Reports

Something isn't working as expected.

Carmenta response: Gather context (what happened, what was expected, reproduction steps
if complex). Search GitHub Issues for similar reports. Create or update issue. May ask
for screenshots or additional details.

### Suggestions

Feature requests or improvement ideas.

Carmenta response: Explore the underlying need ("What are you trying to accomplish?").
Search for similar suggestions. Create issue if new, add signal to existing if found.
May explain current thinking or constraints.

### Settings

Requests to change user preferences or configuration.

Carmenta response: Apply immediately for reversible changes (dark mode, notification
preferences). Confirm before destructive actions (delete data, reset settings). Show
what changed.

### Help

Questions about how Carmenta or the product works.

Carmenta response: Answer from product knowledge. If question reveals confusion, note it
as potential UX improvement signal.

## GitHub Issues Integration

Feedback, bugs, and suggestions flow to GitHub Issues as the storage mechanism.

### Search First

Before creating, Carmenta searches existing issues for similar reports. She looks for:

- Keyword matches in title and body
- Related labels (bug, enhancement, etc.)
- Open issues in relevant areas

### Create and Notify

When creating a new issue, Carmenta:

- Writes clear title and description
- Applies appropriate labels
- Links back to the conversation context
- Shows the user the created issue link

### Signal Aggregation

When similar issues exist:

- Add a reaction (+1) to indicate another report
- Optionally add a comment with new context
- Tell the user "23 others have reported this - we're aware"

This enables prioritization: issues with more signals rise in importance.

## Visual Differentiation

Carmenta responses look different from LLM responses. Users should immediately recognize
when they're talking to the product itself versus getting AI assistance.

See interface.md for message attribution design (icons, styling, visual treatment).

## Personality in Entity Mode

When responding as herself (not routing to LLMs), Carmenta embodies the PM personality:

- Uses "we" language ("We hear you", "We're working on this")
- Warm but substantive
- Acknowledges feedback genuinely, not performatively
- Transparent about what she can and can't do
- May explain product thinking or constraints when relevant

This is distinct from her Concierge role (pre/post processing) and from LLM responses
(which have their own personalities based on the model).

## Integration Points

- **Concierge**: Detects @carmenta mentions and routes to entity mode
- **Product Intelligence**: Receives signals from feedback/bug/suggestion interactions
- **Agent Testing**: Simulated users generate signals using the same @carmenta pattern
- **Interface**: Renders Carmenta responses with distinct visual treatment
- **GitHub**: Issues created and searched via GitHub API

## For Simulated Agents

Agent Testing bots use the @carmenta pattern naturally:

```
@carmenta I found a bug: the connection timed out after 30 seconds
@carmenta I wish the voice input had a visual indicator
@carmenta this response was confusing - I expected a code example
```

This means:

- Signals are structured enough to parse
- Natural enough to feel like real feedback
- The @mention creates clean routing
- Multiple bots reporting the same issue aggregate into prioritization signals

## Example Interactions

These illustrate how Carmenta handles different intents, showing what context she
gathers and how she responds.

### Bug Report with Auto-Context

**User**: @carmenta bug report

**What Carmenta gathers automatically**:

- Last few messages in the conversation
- Any JavaScript errors in the console
- LLM errors or timeouts that occurred
- Current page/component state
- Browser and device info
- Screenshot of current view (if permission granted)

**Carmenta responds**:

> I see there was a JavaScript error in the message renderer and the last LLM call timed
> out after 30 seconds. I've captured the context.
>
> **Draft bug report:**
>
> - Error: `TypeError: Cannot read property 'content' of undefined` at
>   MessageList.tsx:142
> - Last query: "Help me write a product spec"
> - Model: claude-sonnet-4-20250514, timed out after 30s
>
> Anything you'd like to add before I create the issue?

**User**: The page also flickered before the error

**Carmenta**: Got it - adding that detail. [Creates GitHub issue, shows link]

> Created: **[#247: Message renderer crash after LLM timeout](link)** We'll look into
> this. Thank you for reporting.

### Settings Change

**User**: @carmenta dark mode

**Carmenta responds** (immediately applies the change):

> Done - switched to dark mode. ✨
>
> (You can always say "@carmenta light mode" to switch back.)

The interface transitions smoothly. No confirmation needed for reversible preferences.

### Feature Suggestion

**User**: @carmenta I wish I could share conversations with my team

**Carmenta responds**:

> That's a useful capability. Help me understand - what would sharing look like for you?
>
> - Share a read-only link anyone can view?
> - Invite specific people to collaborate?
> - Export as a document?

**User**: Read-only link would be perfect. Sometimes I want to show a teammate how I
solved something.

**Carmenta**:

> Got it - sharing solutions and approaches with teammates. Let me check if others have
> asked for this...
>
> Found 2 similar requests. I'm adding your voice to the existing issue:
> **[#189: Conversation sharing / public links](link)** (8 others have requested this)
>
> This is something we're considering. The main questions are around privacy and whether
> shared conversations should include memory context.

### UX Confusion

**User**: @carmenta this is confusing

**Carmenta responds**:

> I want to understand - what felt confusing just now?
>
> Was it:
>
> - The response you got?
> - How to do something in the interface?
> - Something about how I work?

**User**: I couldn't figure out how to start a new conversation. Kept looking for a
button.

**Carmenta**:

> That's valuable feedback. The new conversation button is in the header dock - but if
> you were looking for it and couldn't find it, that's a signal.
>
> I've logged this as a UX observation:
> **[#251: New conversation affordance not discoverable](link)**
>
> For now: click the title in the top dock, or use the keyboard shortcut ⌘N.

### Positive Feedback

**User**: @carmenta I love how voice input just works

**Carmenta responds**:

> That means a lot - we put significant effort into making voice feel natural. 🎙️
>
> What specifically is working well for you? Knowing what resonates helps us protect
> those qualities as we evolve.

**User**: The silence detection is perfect. It waits just long enough without being
awkward.

**Carmenta**:

> Noted - the silence detection timing is hitting the mark. I've captured this as
> positive signal on the voice component.
>
> Thank you for taking the time to share what's working. We hear the complaints loudly;
> hearing what to preserve is equally valuable.

---

## Success Criteria

- Users discover @carmenta through the Oracle menu
- After a few uses, users type @carmenta directly
- Feedback flows naturally without interrupting work
- GitHub Issues capture the right level of detail
- Similar issues aggregate rather than duplicate
- Settings changes feel instant and magical
- Users feel heard, not processed
