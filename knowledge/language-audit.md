# User-Facing Language Audit

A ground-up review of every word users see. Each recommendation is measured against
Carmenta's voice: warm but substantive, "we" throughout, quiet confidence, every word
earning its place.

Core metaphor: **Connection.** We're not chatting, searching, or prompting. We're
connecting—presence meeting presence.

---

## The "Try Again" Problem

Found in 7 places. The question: is trying again _actually_ what we want?

### Analysis

"Try again" assumes:

1. The user did something wrong (they usually didn't)
2. Retrying will help (it often won't)
3. The user knows what to try differently (they don't)

When something fails, there are really only a few situations:

| Situation                            | What actually helps                   |
| ------------------------------------ | ------------------------------------- |
| Transient (network blip, rate limit) | Wait a moment, we auto-reconnect      |
| Our bug                              | We're already notified, nothing to do |
| Their message was problematic        | Tell them what to change              |

### Recommendation

Replace "try again" with honesty about what's happening:

| Current                 | Proposed                               |
| ----------------------- | -------------------------------------- |
| "Please try again"      | "We're looking into it"                |
| "Try again in a moment" | "Give it a moment and we'll reconnect" |
| "Want to try again?"    | Depends on context—see below           |

For tool failures specifically: "That didn't work. We can try a different approach."

The key shift: from asking the user to do something to acknowledging we're handling it.

---

## Error Pages

### app/error.tsx & app/global-error.tsx

**Current:**

```
We hit a snag

Something unexpected happened. We've already been notified and are looking into it.

[Try again] [Go home]
```

**Proposed:**

```
We hit a snag

Something unexpected happened. We've been notified and we're on it.

[Refresh] [Go home]
```

Changes:

- "already been notified" → "been notified" (unnecessary word)
- "looking into it" → "we're on it" (more active, confident)
- "Try again" → "Refresh" (honest about what the button does)

The button literally refreshes the page. Calling it "Try again" implies user error.

### app/not-found.tsx (404)

**Current:**

```
Page Not Found

We couldn't find what you were looking for. The page may have moved, or the link might
be outdated.

[Go Home] [Start Connecting]
```

**Proposed:**

```
Page Not Found

This page doesn't exist—it may have moved or the link is outdated.

[Go Home] [Start Connecting]
```

Changes:

- "We couldn't find what you were looking for" → "This page doesn't exist" (direct)
- "may have moved, or the link might be outdated" → "may have moved or the link is
  outdated" (remove hedge)

### app/offline/page.tsx

**Current:**

```
You're Offline

Carmenta needs an internet connection to connect with AI. We'll automatically reconnect
when your network is available.

[Try Again] [Go Home]

No connection
```

**Proposed:**

```
You're Offline

Carmenta needs an internet connection. We'll reconnect automatically when your network
returns.

[Check Again] [Go Home]

No connection
```

Changes:

- "to connect with AI" — redundant, Carmenta _is_ the AI connection
- "when your network is available" → "when your network returns" (simpler)
- "Try Again" → "Check Again" (honest—they're not trying anything, just checking)

---

## Chat Error Message

### holo-thread.tsx (inline error)

**Current:**

```
We hit a snag. Please try again in a moment.
```

**Proposed:**

```
We hit a snag. Give it a moment.
```

Changes:

- Remove "Please" — we're equals, not supplicating
- Remove "try again" — the system reconnects automatically
- "in a moment" → "Give it a moment" — active voice, warmer

---

## Input Placeholder

### holo-thread.tsx

**Current:**

```
What's on your mind?
```

**Recommendation: Keep it.**

This is perfect. It invites thought-sharing, not query-submission. Warm without being
precious. Sets the tone for connection.

---

## Greeting & Subtitle

### components/ui/greeting.tsx

**Current (logged in):**

```
Good morning, Nick
What shall we bring into focus?
```

**Current (logged out):**

```
Good morning
AI that remembers. Multi-model access. Your AI team ready to help.
```

**Proposed (logged in):**

```
Good morning, Nick
What are we creating together?
```

**Proposed (logged out):**

```
Good morning
AI that remembers you. Multi-model access. Your team.
```

Changes:

- "What shall we bring into focus?" — beautiful but ceremonial. "What are we working
  on?" is how builders actually think. Alternative: "What's calling us today?"
- "AI that remembers." → "AI that remembers you." — the "you" makes it personal
- "Your AI team ready to help." → "Your team." — punchier, removes redundant "AI"

---

## Connection Header

### connect-header.tsx

**Current (search placeholder):**

```
Search connections...
```

**Proposed:**

```
Find a connection...
```

"Search" is database energy. "Find" is warmer—you're looking for something, not querying
a system.

**Current (empty state - no connections):**

```
We haven't started any connections yet
```

**Proposed:**

```
No connections yet
```

Shorter, cleaner. The context makes "we" implicit.

**Current (empty state - no search results):**

```
We couldn't find any matching connections
```

**Proposed:**

```
No matching connections
```

Same principle. Direct.

**Current (placeholder title):**

```
New connection
```

**Recommendation: Keep it.** Clean, accurate.

---

## Thinking Indicator Messages

### lib/tools/tool-config.ts

**Current rotation:**

```
Reaching out...
Gathering thoughts...
Working on it...
One moment...
```

**Proposed rotation:**

```
Thinking...
Working through this...
One moment...
Connecting...
```

Changes:

- "Reaching out..." — too vague, sounds like we're calling someone
- "Gathering thoughts..." — cute but precious
- Keep "Working on it..." but shift to "Working through this..." (more collaborative)
- Add "Connecting..." — reinforces the core metaphor

**Current delight variants:**

```
Let me think on that...
Good question...
Hmm, interesting...
```

**Proposed delight variants:**

```
Good question...
Interesting...
Thinking on that...
```

Changes:

- "Let me think" → "Thinking on that" — removes "I/me" language
- "Hmm, interesting" → "Interesting..." — "Hmm" is filler

**Current long wait messages:**

```
Thanks for waiting...
Almost there...
Still working on it...
```

**Proposed:**

```
Still here...
Almost there...
Taking a bit longer...
```

Changes:

- "Thanks for waiting" — feels apologetic. "Still here" is reassuring without groveling
- "Still working on it" → "Taking a bit longer" — acknowledges reality without drama

---

## Reasoning Display

### lib/tools/tool-config.ts (reasoning complete messages)

**Current rotation:**

```
Considered carefully
Thought it through
Explored thoroughly
Worked through it
Pondered this one
Figured it out
Got there
Deep thinking complete
All sorted
Mind made up
Clarity achieved
```

These are mostly good. A few adjustments:

**Proposed rotation:**

```
Thought it through
Worked through it
Figured it out
Got there
All sorted
Clarity
Considered carefully
Explored this
```

Removed:

- "Pondered this one" — too precious
- "Deep thinking complete" — sounds like a computer status message
- "Mind made up" — implies finality that may not exist
- "Clarity achieved" → just "Clarity" — the verb form is clunky

### reasoning-display.tsx (default messages)

**Current:**

```
Working through this together... (streaming)
Worked through it (complete)
```

**Recommendation: Keep these.** Perfect "we" energy.

---

## Tool Status Messages

### lib/tools/tool-config.ts

**Current default:**

```
pending: "Preparing..."
running: "Working..."
completed: "Done"
error: "Something went wrong"
```

**Proposed default:**

```
pending: "Preparing..."
running: "Working..."
completed: "Done"
error: "That didn't work"
```

"Something went wrong" is passive and vague. "That didn't work" is direct and honest.

**Current comparison tool error:**

```
Comparison didn't come together
```

**Proposed:**

```
Comparison didn't work
```

"Come together" is vague. "Didn't work" is honest.

**Current search tool error:**

```
Search didn't go through
```

**Proposed:**

```
Search didn't work
```

Same principle.

**Current error wrapper (tool-config.ts getErrorMessage):**

```
We hit a snag: {errorText}. Want to try again?
{tool error message}. Want to try again?
```

**Proposed:**

```
We hit a snag: {errorText}
{tool error message}
```

Remove "Want to try again?" — it's not a real question. The user will retry if they want
to. Asking feels needy.

---

## Model Selector

### model-selector-popover.tsx

**Current (Auto option description):**

```
Carmenta analyzes your request and picks the best model
```

**Proposed:**

```
Carmenta picks the best model for your message
```

Changes:

- "analyzes your request" — too technical, implies inspection
- "request" → "message" — per our vocabulary decision
- Simpler phrasing overall

**Current (bottom button):**

```
Carmenta AI Concierge decides automagically
```

**Proposed:**

```
Let Carmenta choose
```

Changes:

- "AI Concierge" — redundant branding
- "automagically" — cute but doesn't match "quiet confidence, not loud assertion"
- The whole thing is too long for what it does

**Current (Reset button):**

```
Reset
```

**Recommendation: Keep it.** Clear, standard.

---

## CTAs

### components/ui/connect-cta.tsx

**Current (logged in):**

```
Continue
```

**Current (logged out):**

```
Start Connecting
```

**Recommendation: Keep both.** "Continue" for returning users feels like picking up
where we left off. "Start Connecting" for new users is inviting.

### Offline retry button

**Current:**

```
Try Again
```

**Proposed:**

```
Check Connection
```

This is what the button actually does—checks if the network is back.

---

## Footer

### components/footer.tsx

**Current:**

```
How We Build | Principles | Source
Built with ♥ by technick.ai
```

**Recommendation: Keep it.** Clean, appropriate personality.

---

## Summary of Core Changes

1. **Kill "try again"** — Replace with honest alternatives based on what's actually
   happening

2. **Remove "please"** — We're equals, not service providers

3. **Shorter is better** — Every word must earn its place

4. **"Message" not "query"** — Vocabulary aligned with connection metaphor

5. **"Find" not "Search"** — Warmer language for discovery

6. **Direct error messages** — "That didn't work" beats "Something went wrong"

7. **Remove questions in errors** — "Want to try again?" is not a real question

8. **Kill preciousness** — "Pondered this one" → "Thought it through"

9. **Active over passive** — "We're on it" beats "We're looking into it"

10. **Drop filler words** — "Hmm," "already," unnecessary qualifiers

---

## Files to Update

Priority order based on user visibility:

1. `app/error.tsx` — Critical error page
2. `app/global-error.tsx` — Critical error page
3. `components/connection/holo-thread.tsx` — Inline chat error
4. `lib/tools/tool-config.ts` — Thinking messages, error messages
5. `components/ui/greeting.tsx` — First thing users see
6. `app/not-found.tsx` — 404 page
7. `app/offline/page.tsx` — Offline page
8. `components/connection/connect-header.tsx` — Search, empty states
9. `components/connection/model-selector/model-selector-popover.tsx` — Model selector
   copy
10. `components/offline-retry-button.tsx` — Button text

---

## Open Questions

1. **"We hit a snag"** — Is this the right tone for errors? It's warm but colloquial.
   Alternative: "Something broke" (direct) or "We encountered an issue" (formal).

2. **Greeting subtitle** — "What are we working on?" vs "What's calling us?" vs
   something else entirely?

3. **Delight frequency** — Currently 10-15% for emoji/playful variants. Right level?
