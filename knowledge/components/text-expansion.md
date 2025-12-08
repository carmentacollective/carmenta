# Text Expansion / Collapse

A standard drawer pattern for expanding and collapsing long user messages with visual
indication that more content exists.

## The Problem This Solves

When users paste very long text in chat messages, we need to:

1. Prevent overwhelming the viewport with a wall of text
2. Clearly indicate there's more content to read
3. Provide an intuitive way to expand and collapse the full text
4. Avoid interfering with text selection (users often need to copy portions)

## Design Decision

After exploring 8 visual indicator patterns and 8 animation behavior variations, we're
using a **standard drawer pattern**:

- **Visual**: Framed text with chevron button centered below
- **Indicator**: Blur gradient mask on truncated text (matching chat viewport fade
  pattern)
- **Animation**: Smooth height transition (300ms ease-out)
- **Interaction**: Separate button to avoid text selection conflicts

### Why This Approach

**Familiar and predictable**: Standard expand/collapse pattern users recognize
immediately

**Visual clarity**: Blur gradient (not abrupt cut-off or ellipsis) signals more content
naturally

**Respects existing patterns**: Mirrors the chat viewport fade we already use

**No interaction conflicts**: Button is separate from text, so clicking to copy text
works perfectly

## Research Findings

### Competitor Analysis

Analyzed 4 production chat applications for expand/collapse patterns:

**LobeChat**

- Uses max-height with smooth transition
- Shows "Show more" / "Show less" text buttons
- 200ms cubic-bezier(0.4, 0, 0.2, 1) easing
- No visual indicator on truncated text

**Vercel AI Chatbot**

- No built-in expand/collapse (messages display full content)
- Relies on viewport scrolling
- Insight: Simple approach works for shorter messages

**LibreChat**

- Grid-based animation: `gridTemplateRows: expanded ? '1fr' : '0fr'`
- Transition: `grid-template-rows 0.3s ease-out`
- Chevron rotation: 180° to show state
- Elegant approach, smooth natural flow without measuring heights

**assistant-ui**

- Provides hooks for custom expand/collapse but no default UI
- Focus on accessibility: aria-expanded, keyboard navigation
- Message components are fully customizable

### Web Best Practices

**Animation timing**: Consensus around 200-400ms for height transitions. Too fast feels
jarring, too slow feels sluggish.

**Easing curves**: `ease-out` or `cubic-bezier(0.4, 0, 0.2, 1)` for natural deceleration

**Accessibility requirements**:

- `aria-expanded` on button (true/false)
- Keyboard navigation (Enter/Space to toggle)
- Screen reader announces state changes
- Focus management (button stays focusable when collapsed)

**Visual indicators for truncation**:

- Gradient fade masks (CSS `mask-image` with `linear-gradient`)
- Ellipsis with "..." (simple but less elegant)
- Shadow/blur at truncation point (our chosen approach)

**Mobile considerations**:

- 44px minimum tap target for touch
- Avoid hover-only interactions
- Clear visual feedback on tap

## Design Specifications

### Visual Treatment

**Truncation threshold**: Show expand button when content exceeds 4 lines (approximately
120px at 1.5 line-height). Prefer semantic boundaries (paragraph breaks) over fixed
character counts.

**Blur gradient mask**: Use CSS `mask-image` with 56px fade distance to match our
existing `--chat-fade-bottom` variable from the chat viewport fade. Gradient should fade
from full opacity to transparent over the bottom 56px of truncated content.

**Ellipsis indicator**: Display "..." centered below truncated text when collapsed
(purple-300 color, text-xl size).

### Animation Behavior

**Transition approach**: Smooth height transition over 300ms with ease-out easing curve
(cubic-bezier(0.4, 0, 0.2, 1)).

**Alternative considered**: Grid-based animation (grid-template-rows 0fr → 1fr) inspired
by LibreChat. Elegant and avoids height measurement, but max-height approach is more
widely understood.

**Motion feel**: Content should expand downward with smooth deceleration, no overshoot
or bounce. Collapse should feel instant but smooth.

### Button Design

**Position**: Centered horizontally below the text frame, offset 16px down from frame
bottom

**Size**: 32px diameter circular button

**Background**: Holographic gradient (purple-300 → pink-300 at 90° angle with 90%
opacity)

**Icon**: Chevron pointing down when collapsed (indicating more content below), rotating
180° to point up when expanded (indicating collapse direction). Rotation should animate
over 300ms.

**Interaction states**:

- Hover: Scale to 110% with enhanced shadow
- Active: Slight vertical translate on click
- Focus: Visible focus ring with primary color

### Frame Aesthetic

**Border**: 2px dashed border using purple-300 at 40% opacity

**Spacing**: 16px padding around all content

**Corner radius**: 8px rounded corners

**Structure**: Frame contains the content area and positions the button absolutely

### State Behavior

**Default state**: Always start collapsed for consistency across all messages

**State persistence**: Component uses local ephemeral state. Expand/collapse doesn't
persist across page refreshes or navigation—users rarely expect this to persist.

**Single expansion**: When triggered, expand the entire message content at once (no
partial or progressive expansion).

### Accessibility Requirements

**ARIA attributes**:

- Button requires `aria-expanded` (true when expanded, false when collapsed)
- Button requires descriptive `aria-label` ("Expand message" / "Collapse message")

**Keyboard interaction**:

- Button must be keyboard accessible via Tab navigation
- Enter and Space keys toggle expansion state
- Button remains focusable in both expanded and collapsed states

**Screen reader behavior**: State changes should be announced automatically via
aria-expanded updates

### Mobile Considerations

**Touch targets**: 32px button size meets minimum tap target when accounting for shadow
and visual hit area extension

**Touch feedback**: Provide visual feedback on tap (scale animation) since hover states
don't exist on touch devices

**No hover dependencies**: All functionality must work via click/tap—no critical
features hidden behind hover-only interactions

## Application Context

### Where to Use

**User messages only**: Apply to long pasted text in user messages. Assistant messages
are naturally chunked and don't need this treatment.

**Threshold detection**: Trigger when message content exceeds 4 lines or approximately
500 characters.

**Markdown compatibility**: Must work seamlessly with ReactMarkdown rendered content.

## Testing Priorities

**Cross-browser rendering**: Blur gradient must work in Safari (requires
`-webkit-mask-image` prefix)

**Interaction clarity**: Button placement must not interfere with text selection

**Accessibility validation**: Screen reader state announcements (test with NVDA,
VoiceOver)

**Mobile devices**: Actual device testing for tap accuracy and animation performance

**Edge cases to validate**:

- Very short text (should not show expand button)
- Content with embedded images (may affect height calculations)
- Rapid consecutive toggles (animation should remain smooth)

## Design Exploration

Explored 24 total variations across 3 iterations:

- **Iteration 1**: 8 visual indicator patterns (button positions, visual treatments)
- **Iteration 2**: 8 collapse behavior patterns (button interactions, icon treatments)
- **Iteration 3**: 8 animation behavior patterns (motion, timing, easing)

Interactive examples: `app/design-lab/expand-collapse/page.tsx`

## Related Patterns

**Chat viewport fade**: Uses same 56px blur gradient for bottom edge
(`app/globals.css:445-459`, CSS variable `--chat-fade-bottom`)

**LibreChat inspiration**: Grid-based animation approach
(`grid-template-rows: 0fr → 1fr`)

**Accessibility guidance**: WCAG 2.1 patterns for expandable/collapsible content
