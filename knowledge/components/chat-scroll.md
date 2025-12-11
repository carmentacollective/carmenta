# Chat Scroll Behavior

## What It Does

The chat scroll system provides optimal auto-scroll behavior for streaming LLM
responses. It handles the surprisingly complex UX challenge of keeping the user engaged
while content streams in token-by-token.

## Key Behaviors

**Auto-scroll during streaming**: Uses `instant` scroll behavior to keep up with rapid
token streams. Smooth scroll can't keep pace and creates visual stutter.

**Smooth scroll for intentional actions**: When user clicks the scroll-to-bottom button,
uses `smooth` behavior for a deliberate, polished feel.

**Smart user intent detection**: Pauses auto-scroll when user scrolls UP (they want to
read previous content). Resumes automatically when they scroll back to bottom.

**No scroll fighting**: The system tracks scroll direction to distinguish user scrolling
from content pushing. If content grows and pushes scroll position, that's not user
intent to leave bottom.

**Content observation**: Watches for all types of content changes via ResizeObserver
(images loading, code blocks expanding) and MutationObserver (new messages, streaming
text).

## Implementation

Lives in `lib/hooks/use-chat-scroll.ts`. The hook returns:

```tsx
const { containerRef, isAtBottom, scrollToBottom } = useChatScroll({
  isStreaming: isLoading,
});
```

**containerRef**: Attach to the scrollable container element.

**isAtBottom**: Boolean for showing/hiding scroll-to-bottom button.

**scrollToBottom(behavior)**: Function to scroll to bottom. Pass `"smooth"` for button
clicks, `"instant"` for programmatic scrolling.

## Design Decisions

**100px "at bottom" threshold**: Forgiving enough for minor variations while remaining
responsive. Matches ChatGPT/Claude behavior.

**150ms scroll debounce**: Detects when user stops scrolling. Matches natural gesture
endings.

**requestAnimationFrame for streaming scroll**: Defers scroll to next frame to avoid
React's "setState in effect" anti-pattern while maintaining smooth visuals.

**Refs for high-frequency state**: Uses refs (`isAtBottomRef`, `isUserScrollingRef`) for
values that change during scroll events to avoid re-render storms.

## Research Sources

This implementation combines patterns from:

- **assistant-ui**: 400k+ monthly npm downloads, Y Combinator backed. Uses event-driven
  scrolling with `useAssistantEvent` and sophisticated scroll behavior tracking.

- **Vercel ai-chatbot**: Production implementation. Uses MutationObserver +
  ResizeObserver with `isUserScrollingRef` debounce pattern.

- **ChatGPT/Claude**: Behavioral research confirmed the "pause on scroll up, resume on
  return to bottom" pattern as the gold standard for chat UX.

## Edge Cases Handled

- **Content fits without scroll**: `isAtBottom` returns true (user is "at bottom" by
  definition).

- **Images loading after message**: ResizeObserver on children catches these.

- **Code blocks expanding**: Same ResizeObserver pattern.

- **User scrolls during streaming**: Correctly pauses auto-scroll, doesn't fight user.

- **User returns to bottom**: Automatically resumes streaming scroll.

- **Rapid token streams**: Instant scroll keeps up without visual jank.
