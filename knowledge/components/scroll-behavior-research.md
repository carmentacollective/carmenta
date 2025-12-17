# Scroll Behavior Research - Best-in-Class Chat UX

**Research Date**: December 2025 **Goal**: Build the best scroll experience ever for an
AI chat application

## Executive Summary

After analyzing assistant-ui, Vercel ai-chatbot, lobe-chat, and extensive web research,
we identified critical improvements for Carmenta's scroll behavior. The current
implementation has a **dual-scroll architecture problem** where two independent scroll
systems fight each other.

## Current State Analysis

### What We Have (Strengths)

1. **Solid `useChatScroll` hook** (`lib/hooks/use-chat-scroll.ts`)
   - ResizeObserver for content size changes
   - MutationObserver for DOM structure changes
   - User intent detection via scroll direction
   - 100px "at bottom" threshold
   - 150ms debounce for gesture detection
   - `scrollingBehaviorRef` for animation continuity
   - requestAnimationFrame for smooth updates

2. **Mobile optimizations**
   - `touch-pan-y` for proper mobile scrolling
   - `overscroll-contain` prevents iOS bounce jank
   - Safe area insets for notched devices

3. **Visual polish**
   - `chat-viewport-fade` masks (top/bottom gradient)
   - `scrollbar-holo` / `scrollbar-streaming` dynamic classes
   - Hidden scrollbar during streaming

### Critical Issues

#### 1. Dual-Scroll Architecture (Root Cause)

**Location**: `components/connection/holo-thread.tsx` lines 111-126

```typescript
// Force scroll to bottom during streaming
// The useChatScroll hook has complex logic that sometimes fails to scroll
// This is a simpler, more aggressive approach during active streaming
useEffect(() => {
  if (isLoading && containerRef.current) {
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "instant",
    });
  }
}, [isLoading, streamingContentLength, containerRef]);
```

**Problem**: Two independent systems scrolling simultaneously:

- `useChatScroll` hook watches ResizeObserver/MutationObserver
- Component effect watches `streamingContentLength`

**Consequences**:

- Race conditions between scroll operations
- User intent detection gets bypassed
- Scroll position thrashing possible
- Double-scrolling (both systems fire)

#### 2. MutationObserver vs Event-Driven

Our approach: Watch DOM for mutations and react assistant-ui's approach: Listen to
semantic events (`thread.run-start`, `thread.initialize`)

Event-driven is more explicit and reliable—you know exactly when to scroll vs inferring
from DOM.

#### 3. Missing Features

- **No scroll-to-bottom indicator** with unread count
- **No virtualization** for long conversations (100+ messages)
- **No ARIA live regions** for screen reader announcements
- **No keyboard navigation** (Home/End/Page Up/Down)
- **No scroll-to-message** capability

## Best Practices from Research

### 1. ChatScrollAnchor Pattern (Intersection Observer)

Place invisible anchor at bottom, use Intersection Observer to detect visibility:

```typescript
import { useInView } from 'react-intersection-observer';

const ChatScrollAnchor = ({ isAtBottom, scrollAreaRef }) => {
  const { ref: anchorRef, inView } = useInView({
    trackVisibility: true,
    delay: 100,
  });

  useEffect(() => {
    if (!inView && isAtBottom && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [inView, isAtBottom, scrollAreaRef]);

  return <div ref={anchorRef} className="h-px w-full" />;
};
```

### 2. Smart Scroll Detection (assistant-ui)

```typescript
// 1px tolerance for "at bottom" detection
const newIsAtBottom =
  Math.abs(div.scrollHeight - div.scrollTop - div.clientHeight) < 1 ||
  div.scrollHeight <= div.clientHeight;

// Ignore scroll DOWN during auto-scroll (only track scroll UP)
if (!newIsAtBottom && lastScrollTop.current < div.scrollTop) {
  // ignore scroll down
}
```

### 3. Event-Driven Scroll Triggers

Instead of watching DOM mutations, trigger scrolls on semantic events:

- `onMessageSend` → scroll to bottom
- `onStreamStart` → scroll to bottom (instant)
- `onStreamChunk` → maintain scroll position
- `onThreadSwitch` → scroll to bottom (instant)

### 4. Essential CSS

```css
.chat-container {
  overflow-y: auto;
  scroll-behavior: smooth; /* Smooth programmatic scrolls */
  overscroll-behavior: contain; /* Prevent scroll chaining */
  -webkit-overflow-scrolling: touch; /* iOS momentum */
}
```

### 5. Accessibility (ARIA)

```tsx
<div role="log" aria-live="polite" aria-relevant="additions" className="chat-messages">
  {messages.map((msg) => (
    <Message key={msg.id} {...msg} />
  ))}
</div>
```

### 6. Virtual Scrolling for Performance

Use TanStack Virtual for conversations with 100+ messages:

```typescript
import { useVirtualizer } from "@tanstack/react-virtual";

const virtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 80, // Estimate message height
  overscan: 5,
});
```

## Implementation Plan

### Phase 1: Fix the Foundation (High Priority)

**Goal**: Single source of truth for scroll behavior

1. **Remove the force-scroll workaround** from `holo-thread.tsx` (lines 111-126)
2. **Fix `useChatScroll` hook** to be reliable:
   - Add event callbacks (`onStreamStart`, `onStreamEnd`)
   - Tighten bottom detection threshold (100px → 50px or adaptive)
   - Add explicit scroll trigger for message send
3. **Add ChatScrollAnchor** as backup detection method

### Phase 2: Enhanced UX (Medium Priority)

1. **Scroll-to-bottom indicator** with unread message count
2. **Keyboard navigation** (Home/End/Page Up/Page Down)
3. **Scroll position restoration** when switching threads
4. **"New messages" badge** when scrolled up during streaming

### Phase 3: Accessibility (Medium Priority)

1. **ARIA live regions** for new messages
2. **role="log"** on message container
3. **Reduced motion support** (instant scroll when `prefers-reduced-motion`)

### Phase 4: Performance (Lower Priority)

1. **TanStack Virtual** for conversations > 100 messages
2. **Performance monitoring** (scroll latency, frame drops)
3. **Lazy loading** for message attachments

## Architecture Decision: Event-Driven vs DOM-Watching

**Recommendation**: Hybrid approach

Keep MutationObserver/ResizeObserver for content changes (images loading, code blocks
expanding), but add explicit event triggers for semantic actions:

```typescript
interface ChatScrollEvents {
  onMessageSend: () => void; // User sends message
  onStreamStart: () => void; // AI starts responding
  onThreadSwitch: () => void; // Switch to different thread
}

// In useChatScroll:
useEffect(() => {
  if (events.onStreamStart) {
    scrollingBehaviorRef.current = "instant";
    scrollToBottom("instant");
  }
}, [events.onStreamStart]);
```

This gives us the best of both worlds:

- Explicit control for known events
- Fallback DOM watching for edge cases

## Key Metrics to Track

1. **Scroll latency** - Time from content change to scroll completion
2. **User scroll interruption rate** - How often users scroll up during streaming
3. **Frame drops during scroll** - Performance indicator
4. **Auto-scroll failure rate** - How often content grows without scroll following

## Reference Implementations

- **assistant-ui**:
  `packages/react/src/primitives/thread/useThreadViewportAutoScroll.tsx`
- **Vercel ai-chatbot**: `components/messages.tsx`
- **Web standard**: `react-intersection-observer` for ChatScrollAnchor pattern

## Summary

**Do This Now**:

1. Remove the dual-scroll workaround
2. Fix the hook to be reliable (or add event triggers)
3. Add scroll-to-bottom indicator

**Do This Next**:

1. Add accessibility (ARIA live regions)
2. Add keyboard navigation
3. Consider virtualization for long conversations
