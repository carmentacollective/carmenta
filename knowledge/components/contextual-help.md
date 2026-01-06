# Contextual Help

The right information at the right moment - then getting out of the way. This covers
tooltips, help icons, progressive disclosure, and the philosophy of when explanatory UI
helps versus when it clutters.

## Philosophy

Tooltips are a symptom, not a feature. When we add a tooltip, we're admitting our
interface wasn't clear enough. The best UI needs no explanation. The second-best UI
explains itself briefly and then remembers you already know.

Three questions, in order:

1. **Can we make this obvious without help?** Better icon, clearer label, conventional
   placement. If yes, do that instead.
2. **Is this genuinely non-obvious?** Some things are inherently complex. Color swatches
   with no text. Icon-only buttons with ambiguous glyphs. New concepts users haven't
   encountered. These deserve help.
3. **Does this person still need help?** After the first or third time, they know. Stop
   showing it.

Going one level deeper: contextual help is about **reducing cognitive load during
learning without creating cognitive load after learning**. Traditional tooltips fail
this - they appear forever, creating perpetual noise for experienced users.

## The Hierarchy

Not all help is equal. Match the pattern to the need.

### 1. Obvious UI (No Help Needed)

The goal. Clear labels, conventional icons, discoverable interactions. Most of our UI
should require no explanation.

**Examples in Carmenta:**

- "Send" button with gradient styling
- Text input field
- Close (X) buttons
- Back arrows

### 2. Tooltips (Brief Labels for Icons)

For icon-only buttons where space constraints prevent labels. Keep to 2-5 words. These
are labels, not explanations.

**Good tooltip content:**

- "Copy link"
- "New connection"
- "Light mode"

**Bad tooltip content:**

- "Click here to copy the link to your clipboard" (too verbose)
- "Settings" when the button already says "Settings" (redundant)
- Long sentences with instructions (use toggletip instead)

**When to use:**

- Icon-only buttons where the icon meaning isn't universally clear
- Truncated text that needs full display on hover
- Color swatches or visual elements that need text labels

### 3. Toggletips (Click-to-Reveal Help)

For genuinely helpful explanations that users might want to read. Click to open, click
to close (or click away). Uses a small `(?)` or `(i)` icon as the trigger.

**Good toggletip content:**

- "Connections are how Carmenta integrates with your external services. Each connection
  has its own API key and settings."
- "This model excels at code generation but costs more per token. Choose Flash for
  faster, cheaper responses on simpler tasks."

**When to use:**

- Complex concepts that benefit from a paragraph of explanation
- Settings where the implications aren't obvious
- First-time encounters with novel features
- Anywhere you'd write more than 10 words of help

### 4. Progressive Onboarding (Show Once)

Help that teaches and then disappears. First-time tooltips, gentle nudges, feature
discovery. After the user has seen it N times, it never appears again.

**Examples:**

- "Try voice input - just hold the microphone button" (shows first 3 times user visits)
- "Tip: Use @carmenta to talk directly to Carmenta about settings or feedback" (shows
  once, then gone)
- Feature callouts on new releases

## Current State Audit

**Total tooltip instances: 59**

### What We're Doing Well

| Category                 | Count | Assessment                                 |
| ------------------------ | ----- | ------------------------------------------ |
| Icon-only buttons        | 19    | Appropriate - these need labels            |
| Theme/color controls     | 9     | Essential - visual-only elements need text |
| Model info rich tooltips | 1     | Useful - shows extensive model details     |
| State indicators         | 3     | Clear - explains toggle states             |

### What Needs Fixing

| Issue                                           | Location                      | Fix    |
| ----------------------------------------------- | ----------------------------- | ------ |
| Redundant: "Carmenta" tooltip on labeled button | `oracle-menu.tsx:325`         | Remove |
| Redundant: Button tooltips repeat visible text  | `app/brand/page.tsx:977-1020` | Remove |

### Architecture

We use `react-tooltip` v5.30.0 with a global provider:

- **Global tooltip ID**: `"tip"` - all elements use `data-tooltip-id="tip"`
- **Timing**: 400ms delay before showing, 100ms before hiding
- **Styling**: Glass morphism with backdrop blur
- **Attributes**: `data-tooltip-content` (text) or `data-tooltip-html` (rich)

Legacy Radix `<Tooltip>` primitives exist but aren't used in production.

## Architecture Decisions

### ✅ Tooltip vs Toggletip Distinction

**Decision**: Introduce a new `Toggletip` component for click-activated help. Keep
tooltips for hover-activated brief labels only.

**Rationale**: Radix and Carbon Design System both make this distinction. Tooltips are
for labels. Toggletips (or popovers with help styling) are for explanations.
Accessibility also differs: tooltips require hover/focus which doesn't work on touch
devices; toggletips work everywhere.

**Implementation**:

```tsx
// Tooltip - hover/focus, brief label, non-interactive
<button data-tooltip-id="tip" data-tooltip-content="Copy link">
  <CopyIcon />
</button>

// Toggletip - click-activated, longer explanation, dismissible
<Toggletip>
  <ToggletipTrigger>
    <HelpCircle className="w-3 h-3" />
  </ToggletipTrigger>
  <ToggletipContent>
    <p>Connections are how Carmenta integrates with your services...</p>
  </ToggletipContent>
</Toggletip>
```

### ✅ Progressive Disclosure via User-Scoped Storage

**Decision**: Store "seen" state in the database, not localStorage.

**Rationale**: localStorage is per-browser, not per-user. A user on multiple devices
sees the same onboarding repeatedly. Per-user database storage ensures onboarding state
follows the account.

**Schema**:

```sql
CREATE TABLE user_hints (
  user_id       TEXT NOT NULL REFERENCES users(id),
  hint_key      TEXT NOT NULL,
  seen_count    INTEGER DEFAULT 1,
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_seen_at  TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, hint_key)
);
```

**API**:

```ts
// Check if hint should be shown
const shouldShow = await hasSeenHint(userId, "voice-input-intro", { maxShows: 3 });

// Record that hint was shown
await recordHintSeen(userId, "voice-input-intro");
```

### ✅ No Tooltips on Touch-Only Devices

**Decision**: Hide hover-only tooltips on touch devices. Use toggletips for essential
help.

**Rationale**: Hover doesn't exist on mobile. Showing tooltips on touch-hold is
non-standard and confusing. If the information is essential, use a toggletip (click to
reveal). If it's just a label, ensure the icon is obvious or add text.

### ✅ Help Icon Design

**Decision**: Use `QuestionIcon` from Phosphor Icons, 12-14px, 30-40% opacity until
hover.

**Rationale**: Help icons should be present but not prominent. They're for users who
need them, invisible to those who don't. The subtle treatment keeps the UI clean while
making help discoverable.

```tsx
<QuestionIcon
  size={12}
  weight="bold"
  className="opacity-30 transition-opacity hover:opacity-70"
/>
```

## Implementation Path

### Phase 1: Cleanup (Now)

1. Remove redundant tooltips identified in audit
2. Add `aria-label` to all icon-only buttons as accessibility backup
3. Document tooltip usage guidelines in code

### Phase 2: Toggletip Component (Next)

1. Build `Toggletip` component using Radix Popover primitives
2. Design help icon treatment (subtle presence, clear affordance)
3. Add to one complex setting as proof of concept

### Phase 3: Progressive Disclosure (Later)

1. Implement `user_hints` table and API
2. Build `<OnboardingHint>` wrapper component
3. Identify key first-time experiences to enhance
4. Add analytics to measure hint effectiveness

## UX Guidelines

### Content Rules

**Tooltips** (hover labels):

- 2-5 words maximum
- Verb + noun format: "Copy link", "New connection", "Remove file"
- Never duplicate visible text
- Never include instructions requiring action

**Toggletips** (click explanations):

- 1-3 sentences maximum
- Explain the "why", not just the "what"
- Can include links to documentation
- Should answer "What is this?" or "Why would I use this?"

**Onboarding hints** (progressive):

- One concept per hint
- Action-oriented: "Try..." not "This is..."
- Dismissible with clear affordance
- Never block critical UI

### When to Add Help

Ask:

1. Is this a novel concept? (Yes = consider toggletip)
2. Is this an icon-only button? (Yes = add tooltip label)
3. Will users wonder "what does this do"? (Yes = add help)
4. Is the answer obvious from context? (Yes = no help needed)

### When to Remove Help

- Tooltip duplicates visible text
- Tooltip states the obvious ("Close" on X button)
- Help explains something that should just be designed better
- Feature has been live long enough that users know it

## Gap Assessment

### Achievable Now

- Remove redundant tooltips
- Add toggletip component using Radix primitives
- Document usage guidelines
- Style help icons consistently

### Emerging (6-12 months)

- User-scoped progressive disclosure with database storage
- Analytics on help engagement (which hints get clicked, which get dismissed)
- A/B testing hint content and timing
- Cross-device hint state sync

### Aspirational

- AI-powered contextual help that adapts to user proficiency
- Natural language help queries within the UI
- Predictive help surfacing based on user behavior patterns

## Sources

- [NN/g Tooltip Guidelines](https://www.nngroup.com/articles/tooltip-guidelines/)
- [NN/g Onboarding Tutorials vs Contextual Help](https://www.nngroup.com/articles/onboarding-tutorials/)
- [Radix Tooltip Primitives](https://www.radix-ui.com/primitives/docs/components/tooltip)
- [Carbon Design System Toggletip](https://carbondesignsystem.com/components/tooltip/usage/)
- [Frigade: Stop Storing Impressions in localStorage](https://frigade.com/blog/stop-storing-impressions-in-local-storage)
- [Figma Tooltip Component Guide](https://help.figma.com/hc/en-us/articles/22690735962263-Create-a-tooltip-component-set)
