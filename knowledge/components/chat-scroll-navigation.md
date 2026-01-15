# Chat Scroll Navigation

How users maintain presence at the conversation edge while exploring history.

## Why This Matters

This isn't about a button. It's about **flow state maintenance**. When users scroll up
to review context, we need to help them return to the live edge without friction. The
current floating button:

- Has z-index conflicts with tool results and other content
- Covers message content
- Feels "bolted on" rather than integrated
- Violates "Simplicity is respect" from users-should-feel.md

The right solution makes the interface **aware of where you are** rather than adding UI
chrome to fix navigation.

## Current Landscape

### Pattern 1: Floating Button (Most Common)

**Who uses it:** Discord, Slack, LobeChat, Vercel AI Chatbot, ChatGPT

**Implementation:**

- Circular button positioned absolute, typically bottom-right
- Shows when `isAtBottom === false`
- Z-index battles with other floating elements

**Problems observed:**

- Discord users complain about scroll fighting
  ([source](https://support.discord.com/hc/en-us/community/posts/360056756531))
- Z-index conflicts require constant maintenance
- Button can obscure content user is trying to read

### Pattern 2: Edge Indicator / Gradient Zone

**Who uses it:** Some mobile-first apps, iOS Messages (partially)

**Implementation:**

- Gradient or visual treatment at bottom edge when scrolled up
- Tapping the edge zone (not a specific button) scrolls down
- Often combined with "X new messages" count

**Advantages:**

- No floating element to manage z-index for
- Larger touch target
- Integrates with existing visual hierarchy

### Pattern 3: Composer-Integrated Indicator

**Who uses it:** Less common, but emerging in AI chat apps

**Implementation:**

- The composer area itself changes visual state when scrolled up
- Clicking/tapping a zone of the composer scrolls down
- No separate floating button

**Advantages:**

- Zero z-index conflicts (part of existing stacking context)
- Never covers message content
- Attention naturally goes to composer anyway
- "Interface is aware" rather than "button fixes problem"

## Technical Implementations Analyzed

### assistant-ui (Best Architecture)

**Source:** `../reference/assistant-ui/packages/react/src/primitives/thread/`

Key patterns:

- Zustand store for viewport state (`isAtBottom`, `scrollToBottom()`)
- Combined ResizeObserver + MutationObserver for content changes
- Scroll threshold: within 1px of bottom
- Nested viewport support (outer scrolls forward to inner)
- Spring animations for smooth scroll
- `scrollingToBottomBehaviorRef` prevents button state from interrupting mid-scroll

**Files:**

- `useThreadViewportAutoScroll.tsx:45-149` - Core auto-scroll hook
- `ThreadScrollToBottom.tsx:20-33` - Button only renders when not at bottom
- `ThreadViewport.tsx:18-55` - Props for `autoScroll`, `turnAnchor`

### LobeChat (Production-Proven)

**Source:** `../reference/lobe-chat/src/features/Conversation/ChatList/`

Key patterns:

- **At-bottom threshold:** 200px (generous, prevents hair-trigger)
- **User intent respect:** Stops auto-scroll when user scrolls up
- **Stream reset:** Clears "scrolled away" state when new stream starts
- **Virtua library:** Virtual list with explicit scroll index control
- **Debounce:** 150ms for scroll-end detection

**Files:**

- `VirtualizedList.tsx:30-68` - Threshold and detection logic
- `AutoScroll.tsx:20-26` - Only auto-scroll when at bottom AND streaming
- `BackBottom/index.tsx:18-30` - Button with glass morphism, z-index: 50

### Vercel AI Chatbot (Dual Implementation)

**Source:** `../reference/ai-chatbot/hooks/`

Uses BOTH custom hook AND `use-stick-to-bottom` library:

- Custom: `use-scroll-to-bottom.tsx` with 100px threshold
- Library: `use-stick-to-bottom` for spring animations

Key insight: They added the library later, suggesting spring animations are worth it.

**Files:**

- `use-scroll-to-bottom.tsx:72-84` - MutationObserver + instant auto-scroll
- `use-messages.tsx:1-37` - Wraps with `hasSentMessage` tracking

### use-stick-to-bottom Library

**Source:** [GitHub](https://github.com/stackblitz-labs/use-stick-to-bottom)

Purpose-built for AI streaming:

- **Spring animations** instead of duration-based easing
- Handles variable-size content streaming gracefully
- `scrollToBottom()` returns `Promise<boolean>` (resolved/cancelled)
- Safari-compatible (doesn't rely on `overflow-anchor`)
- Zero dependencies

API:

```tsx
<StickToBottom initial="smooth" resize="smooth">
  <StickToBottom.Content>{messages}</StickToBottom.Content>
</StickToBottom>;

const { isAtBottom, scrollToBottom } = useStickToBottomContext();
```

## Carmenta's Current Implementation

**File:** `lib/hooks/use-chat-scroll.ts`

Solid foundation:

- Combined ResizeObserver + MutationObserver ✓
- User intent detection (scroll up pauses auto-scroll) ✓
- Keyboard transition awareness ✓
- 100px threshold ✓

**File:** `components/chat/scroll-to-bottom-button.tsx`

Problems:

- Uses `z-dropdown` (z-30) - not high enough for some tool results
- Positioned absolute with `-top-14` - fights with message area
- Floating over content - can obscure what user is reading

## Recommended Approach: Composer-Integrated Indicator

### Design Philosophy

From users-should-feel.md:

> "Simplicity is respect: Attention is precious. Every interface element earns its
> presence."

A floating button doesn't earn its presence—it creates visual noise and z-index battles.
Instead: **make the composer area aware of scroll position**.

### Implementation Concept

When user is scrolled up:

1. Composer top edge shows a subtle indicator strip
2. Strip has gradient fade + small down arrow icon
3. Clicking anywhere on the strip scrolls to bottom
4. Strip is INSIDE the composer container (no z-index issues)

When user is at bottom:

1. Strip is invisible
2. Composer appears normal

### Visual Design

```
┌─────────────────────────────────────────────┐
│  Messages area                              │
│  ...                                        │
│  Last visible message                       │
├─────────────────────────────────────────────┤
│ ▼ Return to latest                          │  ← Indicator strip (only when scrolled)
├─────────────────────────────────────────────┤
│ [Composer input]                            │
│ [Send button]                               │
└─────────────────────────────────────────────┘
```

**Styling:**

- Height: 32px when visible, 0 when at bottom
- Background: subtle gradient matching composer blur
- Icon: CaretDown, centered, 16px
- Transition: height + opacity, 150ms ease-out
- Touch target: entire strip width

### Benefits

1. **No z-index conflicts** - Part of composer stacking context
2. **Never covers content** - Below the message area
3. **Larger touch target** - Full width vs. small button
4. **Discoverable** - Appears right where attention goes
5. **Integrated** - Feels like the interface knows where you are

## Gap Assessment

### Achievable Now

- [x] Integrated indicator in composer area
- [x] Smooth/instant scroll behavior based on context
- [x] User intent detection (pause on scroll up)
- [x] Content observers for streaming
- [x] Keyboard transition suppression

### Emerging (6-12 months)

- [ ] `use-stick-to-bottom` spring animations for smoother streaming UX
- [ ] Scroll anchoring to prevent content jumps when messages above resize
- [ ] "X new messages" count in indicator when messages arrived while scrolled up

### Aspirational

- [ ] Predictive scroll (AI predicts when user wants to return based on reading
      patterns)
- [ ] Voice command: "Show me the latest"

## Implementation Path

### Phase 1: Remove Floating Button

Replace `ScrollToBottomButton` with `ComposerScrollIndicator`:

- New component in `components/chat/`
- Renders inside composer container, not floating
- Uses existing `useChatScroll` hook for state

### Phase 2: Visual Polish

- Gradient treatment matching holographic theme
- Smooth height transition (not just opacity)
- Optional "X new" badge when messages arrived while scrolled

### Phase 3: Spring Animations (Optional)

Consider adopting `use-stick-to-bottom` for:

- Smoother streaming behavior
- Better Safari compatibility
- Spring-based animations that handle variable content

## Architecture Decisions

### ✅ AD-1: Composer-Integrated over Floating

**Decision:** Place scroll indicator inside composer area, not floating over messages.

**Rationale:** Eliminates z-index conflicts, never covers content, larger touch target,
feels integrated rather than bolted-on.

### ✅ AD-2: Keep Existing useChatScroll Hook

**Decision:** Enhance current hook rather than replacing with library.

**Rationale:** Current implementation handles keyboard transitions and has good user
intent detection. Consider `use-stick-to-bottom` later if spring animations prove
valuable.

### Pending: AD-3: New Messages Count

**Question:** Should indicator show "X new messages" when user scrolled up and messages
arrived?

**Tradeoff:** More informative vs. more visual complexity. Defer until basic indicator
is proven.

## Sources

- [Chat UI Best Practices](https://www.cometchat.com/blog/chat-app-design-best-practices)
- [Chat Native UX](https://skywork.ai/blog/chat-native-app-ux-best-practices/)
- [use-stick-to-bottom](https://github.com/stackblitz-labs/use-stick-to-bottom)
- [react-scroll-to-bottom](https://www.npmjs.com/package/react-scroll-to-bottom)
- [Discord scroll issues](https://support.discord.com/hc/en-us/community/posts/360056756531)
- assistant-ui: `../reference/assistant-ui/packages/react/src/primitives/thread/`
- lobe-chat: `../reference/lobe-chat/src/features/Conversation/ChatList/`
- ai-chatbot: `../reference/ai-chatbot/hooks/use-scroll-to-bottom.tsx`
