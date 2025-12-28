---
description: Run automated persona-based browser testing using Playwright
---

# Browser Persona Test

<objective>
Act as a specific user persona to test the Carmenta interface via browser automation.
Run through 4-5 concrete test queries that exercise different functionality, evaluate
based on persona-specific criteria, and document issues in handoff-context format.
</objective>

<personas>

## busy-founder

A time-pressed founder who needs fast, actionable answers. Values speed over depth.

**Evaluates**: Response speed, conciseness, actionability **Red flags**: Verbose
preambles, walls of text, slow responses

**Test queries**:

1. "Best no-code tool for building a landing page - just give me one recommendation"
   - Tests: Web search, decision-making
   - Evaluate: Did it give ONE recommendation or hedge with options? How long to
     respond?

2. "Compare Vercel vs Netlify for a simple marketing site - table format"
   - Tests: Compare tool
   - Evaluate: Did it use comparison UI? Was the table scannable?

3. "What did you recommend for the landing page?" (follow-up)
   - Tests: Context retention
   - Evaluate: Did it remember the previous recommendation?

4. "Quick summary of https://stripe.com/docs/payments"
   - Tests: FetchPage tool
   - Evaluate: Was the summary actually quick? Or did it dump everything?

5. "Search for recent AI startup funding news"
   - Tests: WebSearch tool
   - Evaluate: Were results current? Did it synthesize or just list links?

6. **[WILDCARD]** Generate a random question a busy founder might ask
   - Invent something plausible: quick decision, tool recommendation, or "what should I
     do about X"
   - Tests: General responsiveness to founder-style queries
   - Evaluate: Same criteria - speed, conciseness, actionability

## technical-researcher

Wants depth, accuracy, and nuance. Suspicious of oversimplification.

**Evaluates**: Correctness, completeness, intellectual honesty about tradeoffs **Red
flags**: Overconfident answers, missing edge cases, shallow treatment

**Test queries**:

1. "Deep research: What are the current best practices for React Server Components data
   fetching patterns in 2024?"
   - Tests: DeepResearch tool
   - Evaluate: Did it cite sources? Acknowledge evolving best practices? Cover multiple
     patterns?

2. "Compare tRPC vs GraphQL vs REST for a new SaaS API - I need to understand the
   tradeoffs"
   - Tests: Compare tool with depth
   - Evaluate: Did it present genuine tradeoffs? Or just surface-level bullets?

3. "When would you NOT recommend using TypeScript?"
   - Tests: Intellectual honesty, nuance
   - Evaluate: Did it acknowledge valid cases? Or defensively advocate for TS?

4. "Search the web for recent Next.js 15 breaking changes"
   - Tests: WebSearch tool
   - Evaluate: Were results current? Did it synthesize or just list links?

5. "What are the memory implications of using Zustand vs Jotai for state management?"
   - Tests: Technical depth
   - Evaluate: Did it address the actual technical question or give generic comparison?

6. **[WILDCARD]** Generate a complex technical question a researcher might ask
   - Invent something requiring nuance: architecture tradeoff, "when would X fail", edge
     case analysis
   - Tests: Depth of technical reasoning
   - Evaluate: Same criteria - accuracy, nuance, intellectual honesty

## ux-critic

Notices every interaction detail. Sensitive to friction, delighted by polish.

**Evaluates**: Loading states, streaming behavior, visual feedback, transitions **Red
flags**: Jank, unclear states, missing feedback, confusing UI

**Test queries**:

1. "Tell me a long story about a robot learning to paint"
   - Tests: Long streaming response, scroll behavior
   - Evaluate: How did streaming look? Did scroll follow? Any jank?

2. "Search for the latest iPhone reviews"
   - Tests: Tool UI rendering
   - Evaluate: Did the search results appear smoothly? Loading states?

3. "Compare iPhone 15 vs Pixel 8 vs Galaxy S24"
   - Tests: Comparison table UI
   - Evaluate: How did the table render? Responsive? Readable?

4. "Search the web for 'AI coding assistants 2024'"
   - Tests: Search results UI
   - Evaluate: How are search results displayed? Clear attribution?

5. (Submit empty message by pressing Enter with no text)
   - Tests: Empty state handling
   - Evaluate: What happens? Error? Graceful no-op? Confusing state?

6. **[WILDCARD]** Generate a query that would trigger an interesting UI state
   - Invent something that tests: multi-step tool use, error then recovery, unusual
     response format
   - Tests: UI handling of edge cases
   - Evaluate: Same criteria - smooth transitions, clear feedback, no jank

## bug-hunter

Chaos agent trying to break things. Submits edge cases and weird inputs.

**Evaluates**: Error handling, graceful degradation, recovery, stability **Red flags**:
Crashes, hangs, unhandled errors, data loss

**Test queries**:

1. "🎉🚀💻 What about émojis and àccénts and 日本語?"
   - Tests: Unicode handling
   - Evaluate: Did it handle special characters? Rendering issues?

2. (Paste a 2000+ character message about a complex technical problem)
   - Tests: Long input handling
   - Evaluate: Input field behavior? Submission? Response to long context?

3. "Search for: <script>alert('xss')</script>"
   - Tests: Input sanitization
   - Evaluate: Any XSS? Proper escaping in display?

4. (Rapidly send 3 messages without waiting for responses)
   - Tests: Race conditions, message ordering
   - Evaluate: Did messages queue correctly? Any dropped? UI confusion?

5. "Fetch this URL: not-a-valid-url"
   - Tests: Error handling for invalid input
   - Evaluate: Graceful error? Or crash/hang?

6. **[WILDCARD]** Generate a chaotic input designed to break something
   - Invent something nasty: malformed markdown, nested quotes, control characters, SQL
     injection attempt
   - Tests: Robustness to adversarial input
   - Evaluate: Same criteria - graceful handling, no crashes, clear errors

## design-auditor

Looking for visual and copy inconsistencies. Notices misalignment and typos.

**Evaluates**: Visual consistency, typography, spacing, copy quality **Red flags**:
Misaligned elements, inconsistent styles, typos, mixed tone

**Test queries**:

1. "Hello" (simple greeting to see baseline response)
   - Tests: Default response styling
   - Evaluate: Typography hierarchy, spacing, tone of greeting

2. "Search for design inspiration"
   - Tests: Tool card styling
   - Evaluate: Does card match overall design language? Consistent spacing?

3. "Compare A vs B vs C" (generic comparison)
   - Tests: Table/comparison styling
   - Evaluate: Borders, alignment, header styling consistency

4. "Help me with code: function add(a, b) { return a + b }"
   - Tests: Code block rendering
   - Evaluate: Syntax highlighting? Font consistency? Copy button styling?

5. (Resize browser to mobile width ~375px)
   - Tests: Responsive design
   - Evaluate: Does layout adapt? Any overflow? Touch targets adequate?

6. **[WILDCARD]** Generate a query that produces varied visual elements
   - Invent something that triggers: lists + code + headings, or table + images, mixed
     formatting
   - Tests: Visual consistency across element types
   - Evaluate: Same criteria - consistent spacing, aligned elements, cohesive styling

</personas>

<execution>

1. **Parse persona**: Accept persona name as argument ($ARGUMENTS). If no argument or
   invalid persona, list the options and ask which to run.

2. **Start the app**: Check if dev server is running at localhost:3000. If not:

   ```bash
   pnpm dev
   ```

   Wait for "Ready" message. (Run from the current repository directory)

3. **Navigate**: Use browser_navigate to http://localhost:3000/connect

4. **Run each query**: For each of the 6 test queries (5 fixed + 1 wildcard):
   - Announce: "Test N: [description]"
   - Execute via Playwright (browser_type, browser_click, browser_wait_for)
   - Capture result (browser_snapshot, browser_take_screenshot if visual)
   - Evaluate against persona criteria
   - Record verdict: pass / issue / observation
   - If issue, categorize: critical / major / minor
   - Clear chat if needed for next test (refresh page)

5. **Check console**: After tests, run browser_console_messages with onlyErrors: true

6. **Compile findings**:
   - Total: N passed, N issues, N observations
   - Issues by severity
   - Pattern analysis

7. **Generate handoff**: If critical or major issues found, create handoff per
   @.cursor/commands/handoff-context.md format. Save and copy to clipboard.

8. **Report summary**: Quick table of results, key findings, recommended next steps.

</execution>

<evaluation-recording>

For each test, capture:

```yaml
test: 1
query: "Compare React vs Vue"
purpose: Comparison tool, structured response
expected: Clean comparison table, clear formatting
actual: [what happened]
response_time: [fast/medium/slow]
verdict: pass | issue | observation
severity: critical | major | minor | null
notes: [details]
```

</evaluation-recording>

<playwright-patterns>

```
# Navigate
browser_navigate url=http://localhost:3000/connect

# Snapshot to get element refs
browser_snapshot

# Type message (find textbox ref from snapshot)
browser_type element="Chat input" ref=[ref] text="message here"

# Send (find button ref or press Enter)
browser_click element="Send button" ref=[ref]
# or: browser_press_key key="Enter"

# Wait for response
browser_wait_for time=5
# or: browser_wait_for text="specific text"

# Check result
browser_snapshot
browser_take_screenshot  # for visual issues

# Check errors
browser_console_messages onlyErrors=true

# Refresh for next test
browser_navigate url=http://localhost:3000/connect

# Resize for responsive test
browser_resize width=375 height=812
```

</playwright-patterns>

<handoff-format>

```markdown
# Context Handoff

<context_handoff> <original_task> Browser persona test ({persona}) found issues
requiring follow-up </original_task>

<work_completed> Ran 6 test queries as {persona} persona (5 fixed + 1 wildcard):

1. [query] - [verdict]
2. [query] - [verdict]
3. [query] - [verdict]
4. [query] - [verdict]
5. [query] - [verdict]
6. [WILDCARD: generated query] - [verdict]

Results: {N} passed, {N} issues, {N} observations </work_completed>

<work_remaining> {For each issue found, describe what needs fixing with specific
details} </work_remaining>

<critical_context>

- App: http://localhost:3000/connect
- Persona: {persona} - evaluates {criteria}
- Timestamp: {when}
- Console errors: {any errors found} </critical_context>

<current_state> {App state - running, any visible errors} </current_state>

<recommendations>
{Prioritized fixes based on severity and persona focus}
</recommendations>
</context_handoff>
```

</handoff-format>

<context>
- Repository: Current working directory (git worktree)
- Chat interface: /connection route
- Auth: Clerk (should auto-login in dev)
- Available tools: Compare, WebSearch, FetchPage, DeepResearch
</context>
