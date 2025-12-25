# PWA Mobile Enhancements

Native mobile gestures and features that make Carmenta's PWA feel like a first-class
mobile app. These enhancements bridge the gap between "web page in browser" and "app on
your phone."

## Why Mobile-First PWA Matters

Web applications run everywhere, but mobile is where PWA capabilities truly shine. These
enhancements transform Carmenta from a responsive website into something that feels
genuinely native—the gestures users expect, the smoothness they demand, the integration
they deserve.

### Strategic Alignment

**For M1 (Dogfooding)**: Nick uses Carmenta on iPhone throughout the day. Mobile
gestures remove friction—pull to refresh instead of finding reload, swipe back instead
of hunting for navigation, screen stays awake during long AI responses.

**For M3 (Flow State Builder)**: Mobile is where flow happens on-the-go. These
enhancements protect flow state: refresh without leaving context, navigate without
breaking immersion, install without friction.

**For M4 (Leverage Seeker)**: Mobile is the primary interface for the Digital Chief of
Staff. Push notifications only work on installed PWAs, making installation critical.
These enhancements make installation desirable by creating a native experience worth
installing.

## Capabilities Implemented

### Pull-to-Refresh

Native iOS/Android gesture for refreshing conversation state. Overscroll at the top
triggers refresh with haptic feedback.

**Why it matters**: Standard mobile behavior. Users expect it. Its absence feels broken.

### Custom Install Prompt

Beautiful, on-brand prompt encouraging PWA installation at the right moment. Dismissible
with smart snooze logic.

**Why it matters**: Browser install prompts are ugly and hidden. Ours is gorgeous and
intentional. More installs means more push notification capability.

### Swipe Navigation

Edge swipe from left screen edge navigates back, mimicking native iOS behavior.

**Why it matters**: Standard mobile navigation. Reaching for a back button breaks flow.
Edge swipe is muscle memory.

### Wake Lock

Keeps screen awake during active conversation, preventing auto-lock during long AI
responses.

**Why it matters**: Nothing worse than screen dimming mid-response. Active conversation
should feel attended.

### Scroll-Aware Header

Hides header when scrolling down to maximize content space. Shows immediately on scroll
up.

**Why it matters**: Every pixel counts on mobile. Dynamic header gives content room to
breathe while keeping navigation instantly accessible.

## Implementation Details

### Hooks Architecture

All mobile features are implemented as composable React hooks following the project's
TypeScript coding standards. Each hook is self-contained, thoroughly documented, and
handles its own lifecycle.

#### use-pull-to-refresh.ts

**Location**: `/Users/nick/src/carmenta-mobile/lib/hooks/use-pull-to-refresh.ts`

Provides native pull-to-refresh gesture support with progressive feedback.

**Features**:

- Touch-based overscroll detection at scroll container top
- Resistance curve for natural feel (pull distance scales with resistance)
- Haptic feedback when crossing trigger threshold
- Progress tracking (0 to 1) for visual indicators
- Configurable threshold and max pull distance
- Works with custom scroll containers via ref

**Integration pattern**:

```typescript
const { pullDistance, isRefreshing, isPulling, progress } = usePullToRefresh({
  onRefresh: async () => {
    await refetchConversation();
  },
  threshold: 80, // pixels to trigger
  maxPull: 150, // maximum pull distance
  containerRef: scrollContainerRef,
});
```

**Browser support**: All touch-enabled browsers (iOS Safari, Chrome Android, etc.)

**No permissions required**: Uses standard touch events.

#### use-install-prompt.ts

**Location**: `/Users/nick/src/carmenta-mobile/lib/hooks/use-install-prompt.ts`

Captures and controls the native PWA install prompt for optimal timing and branding.

**Features**:

- Captures `beforeinstallprompt` event automatically
- Detects if app is already installed (standalone mode)
- Provides controlled trigger for native prompt
- Tracks install outcome for analytics
- Handles iOS-specific detection (`window.navigator.standalone`)

**Integration pattern**:

```typescript
const { canInstall, isInstalled, promptInstall, hasPrompted } = useInstallPrompt();

const handleInstall = async () => {
  const outcome = await promptInstall();
  // outcome: "accepted" | "dismissed" | "unavailable"
};
```

**Critical detail**: iOS only supports push notifications for installed PWAs. This hook
enables the installation flow that unlocks push capabilities.

**Browser support**:

- Chrome/Edge: Full support for `beforeinstallprompt`
- Safari iOS 16.4+: Uses `window.navigator.standalone` detection
- Firefox: Limited (prompt not available but detection works)

**No permissions required**: Standard browser APIs.

#### use-swipe-navigation.ts

**Location**: `/Users/nick/src/carmenta-mobile/lib/hooks/use-swipe-navigation.ts`

Edge swipe gesture for back navigation, mimicking native iOS behavior.

**Features**:

- Edge detection zone (default 20px from left edge)
- Velocity-based threshold (fast swipes need less distance)
- Progressive visual feedback during swipe
- Cancels on vertical scroll (doesn't interfere with page scrolling)
- Haptic feedback on trigger
- Custom back handler or default `router.back()`

**Integration pattern**:

```typescript
const { swipeDistance, isSwiping, progress } = useSwipeNavigation({
  edgeWidth: 20, // edge detection zone
  threshold: 100, // distance to trigger
  velocityThreshold: 0.5, // fast swipe threshold (px/ms)
  onBack: () => router.back(),
});
```

**Browser support**: All touch-enabled browsers.

**No permissions required**: Uses standard touch events.

#### use-wake-lock.ts

**Location**: `/Users/nick/src/carmenta-mobile/lib/hooks/use-wake-lock.ts`

Prevents screen from dimming/locking during active use.

**Features**:

- Acquires screen wake lock on request
- Auto-releases on component unmount
- Re-acquires when tab becomes visible again
- Graceful fallback when not supported
- No permission prompts (auto-granted for user-initiated actions)

**Integration pattern**:

```typescript
const { isLocked, isSupported, requestWakeLock, releaseWakeLock } = useWakeLock({
  enabled: isConversationActive,
});

// Or control manually:
await requestWakeLock();
await releaseWakeLock();
```

**Browser support**:

- Chrome 84+ (desktop & Android)
- Edge 84+
- Safari 16.4+ (iOS & macOS)

**No permissions required**: Wake Lock API auto-grants for user gestures.

**Use case**: Enable during active AI streaming, disable when conversation idle.

#### use-scroll-header.ts

**Location**: `/Users/nick/src/carmenta-mobile/lib/hooks/use-scroll-header.ts`

Shows/hides header based on scroll direction for maximum content space.

**Features**:

- Hides header on scroll down (with threshold to prevent jitter)
- Shows header on scroll up (more sensitive for quick access)
- Always shows when at top of page
- Performance optimized with `requestAnimationFrame`
- Works with custom scroll containers

**Integration pattern**:

```typescript
const { isVisible, scrollY, isAtTop } = useScrollHeader({
  threshold: 10,  // minimum scroll delta to trigger
  containerRef: scrollContainerRef,
});

// Apply to header:
<header className={isVisible ? 'translate-y-0' : '-translate-y-full'}>
```

**Browser support**: All browsers with scroll support.

**No permissions required**: Standard scroll events.

### Components

#### InstallPrompt

**Location**: `/Users/nick/src/carmenta-mobile/components/pwa/install-prompt.tsx`

Beautiful, on-brand UI for encouraging PWA installation.

**Features**:

- Dismissible with 7-day snooze (localStorage)
- Gradient button matching Carmenta aesthetic
- Framer Motion animations
- Only shows when installation available
- 3-second delay to avoid interrupting page load
- Tracks install outcome with structured logging

**Visual design**:

- Glass card with backdrop blur
- Gradient icon background (indigo to purple)
- Smartphone icon
- Clear value proposition copy
- Gradient CTA button
- Subtle dismiss button (top right)

**Snooze strategy**: Stores dismiss timestamp in localStorage. Respects user choice for
configured days (default 7). Reappears after snooze expires if app still not installed.

**Integration**: Add to root layout, hook auto-manages visibility.

#### PullToRefreshIndicator

**Location**:
`/Users/nick/src/carmenta-mobile/components/pwa/pull-to-refresh-indicator.tsx`

Visual feedback for pull-to-refresh gesture.

**Features**:

- Spinner that fills as user pulls
- Progress ring showing distance to threshold
- Icon rotates with pull progress
- Changes color when triggered
- Smooth transitions with Framer Motion
- Follows pull distance with spring physics

**Visual states**:

- Idle: Hidden
- Pulling (< threshold): Gray background, partial ring, icon opacity scales
- Triggered (>= threshold): Indigo background, full ring, white icon
- Refreshing: Spinning loader

**Integration**: Render at top of scroll container, feed state from `usePullToRefresh`
hook.

#### SwipeBackIndicator

**Location**: `/Users/nick/src/carmenta-mobile/components/pwa/swipe-back-indicator.tsx`

Visual feedback for edge swipe navigation.

**Features**:

- Chevron appears from left edge during swipe
- Follows swipe distance with spring physics
- Changes color when triggered
- Opacity scales with progress
- Rounded-right pill shape

**Visual states**:

- Not swiping: Hidden
- Swiping (< threshold): Gray background, left edge
- Triggered (>= threshold): Indigo background, scaled chevron

**Integration**: Render globally, feed state from `useSwipeNavigation` hook.

### Other Enhancements

#### App Shell Loading State

**Location**: `/Users/nick/src/carmenta-mobile/app/loading.tsx`

Root loading state that appears during transitions and hydration.

**Why it exists**: Prevents blank white screen during initial load and route
transitions. Creates perceived performance improvement—users see Carmenta branding
immediately instead of nothing.

**Implementation**:

- Pure CSS (no JS dependency)
- Centered Carmenta icon with pulse animation
- Holographic gradient background
- Shimmer loading bar
- Minimal, on-brand copy

**Appears during**:

- Initial app hydration
- Client-side navigation between routes
- React Server Component streaming

**Performance impact**: Instant display (no JS parsing required).

#### ScrollProvider Context

**Location**: `/Users/nick/src/carmenta-mobile/lib/contexts/scroll-context.tsx`

Shared scroll state between components for coordinated behavior.

**Why it exists**: Multiple components need to react to scroll (header visibility,
pull-to-refresh, etc.). Context prevents prop drilling and allows any component to
report or consume scroll state.

**Features**:

- Reports scroll position from any container
- Tracks scroll direction (up/down)
- Determines when at top
- Calculates whether header should be visible
- Configurable threshold to prevent jitter

**Integration pattern**:

```typescript
// In scroll container:
const { reportScroll } = useScrollState();

useEffect(() => {
  const handleScroll = () => {
    reportScroll(containerRef.current.scrollTop);
  };
  container.addEventListener("scroll", handleScroll);
}, []);

// In header:
const { shouldShowHeader } = useScrollState();
```

**Provides sensible defaults** when used outside provider (prevents crashes).

## Browser Support Considerations

### iOS Safari

**Full support**:

- Pull-to-refresh gestures (touch events)
- Edge swipe navigation (touch events)
- Install prompt detection (`window.navigator.standalone`)
- Wake Lock API (iOS 16.4+)
- Service worker with offline support

**Limitations**:

- No `beforeinstallprompt` event (use standalone detection instead)
- Push notifications ONLY work for installed PWAs (not web)
- Wake Lock requires iOS 16.4+ (graceful fallback for older)

**Critical**: iOS is the most restrictive platform. Test thoroughly on actual devices.

### Chrome Android

**Full support**:

- All touch gestures
- `beforeinstallprompt` event
- Wake Lock API
- Push notifications (installed and web)
- Service worker

**Best experience**: Chrome Android provides the most complete PWA implementation.

### Desktop Browsers

**Support varies**:

- Touch gestures: Only on touchscreen devices
- Install prompt: Chrome/Edge have `beforeinstallprompt`
- Wake Lock: Supported in Chrome/Edge/Safari 16.4+
- Scroll behaviors: Universal

**Graceful degradation**: All features check for support and fall back cleanly.

## Success Criteria

### User Experience

**Gestures feel native**:

- Pull-to-refresh triggers at expected threshold (80px)
- Edge swipe responds immediately, no lag
- Haptic feedback confirms actions
- Visual indicators provide clear feedback
- No janky animations or stutters

**Installation flow is smooth**:

- Install prompt appears at right moment (not on page load)
- Snooze respects user choice
- Native install experience launches correctly
- Installed app feels distinct from browser

**Mobile performance is excellent**:

- No scroll lag with header hiding
- Wake lock prevents screen dimming during use
- Loading states prevent blank screens
- Transitions are smooth (60fps)

### Technical Metrics

- Pull-to-refresh gesture response time: < 50ms
- Header hide/show animation: smooth 60fps
- Wake lock acquisition: < 100ms
- Install prompt appearance: 3s after page load
- All hooks handle cleanup properly (no memory leaks)

### Adoption Targets

**M1 (Dogfooding)**:

- Nick uses pull-to-refresh daily
- Swipe navigation feels natural
- Screen never dims during AI responses
- Install prompt converts Nick to installed PWA

**M3 (Flow State Builder)**:

- 60%+ of mobile users install PWA
- Pull-to-refresh is primary refresh method
- Zero user complaints about missing native features

**M4 (Leverage Seeker)**:

- 80%+ install rate on mobile (push notification prerequisite)
- Mobile gestures cited as "feels like real app" in feedback

## Future Enhancements

These features are documented in GitHub issues and represent natural evolution of the
mobile PWA experience.

### Share Target API (#424)

**What**: Let users share content FROM other apps TO Carmenta.

**Why**: When Carmenta appears in the native share sheet, it becomes part of the user's
workflow. See an article? Share to Carmenta for analysis.

**Implementation**:

- Add `share_target` to manifest
- Create `/api/share` route to handle incoming shares
- Support text, URLs, and files
- Open new conversation with shared content pre-filled

**Browser support**: Chrome Android, Safari iOS 16.4+

**Acceptance criteria**:

- Carmenta in system share sheet (iOS & Android)
- Shared text starts new conversation
- Shared URLs can be fetched
- Shared images attach to conversation
- Works offline (queues for when online)

### Offline-First Data (#425)

**What**: Cache conversation history for offline reading.

**Why**: Connectivity isn't guaranteed. Users on flights, subways, or poor signal areas
should access conversation history.

**Implementation**:

- IndexedDB for full message history
- Service Worker with stale-while-revalidate
- Selective sync (recent conversations only)
- Cache size management

**Acceptance criteria**:

- Recent conversations viewable offline
- Smooth online/offline transitions
- Clear offline indicators in UI
- Configurable cache limits
- Graceful cache miss handling

### Voice Input (#426)

**What**: Speak prompts instead of typing using Web Speech API.

**Why**: Voice is natural and fast. Speaking thoughts is often more efficient than
typing on mobile.

**Implementation**:

- Web Speech API integration
- Microphone button in composer
- Real-time interim transcription
- Pulsing recording indicator
- Haptic feedback on start/stop

**Browser support**: Chrome (full), Safari iOS 14.5+ (full), Firefox (limited)

**Acceptance criteria**:

- Microphone button in composer
- Real-time transcription display
- Haptic feedback on start/stop
- Graceful permission handling
- Works on iOS Safari and Chrome Android
- Fallback for unsupported browsers

## Integration Points

### PWA Foundation

All mobile enhancements build on the PWA foundation documented in [pwa.md](./pwa.md).

**Dependencies**:

- Service Worker for offline support
- Web App Manifest for installation
- HTTPS for secure context (required for many APIs)

### Concierge Integration

Mobile gestures enhance the conversation experience:

**Pull-to-refresh**: Refreshes conversation state, fetches new messages from server
**Wake Lock**: Enabled during active AI streaming from Concierge **Voice Input**
(future): Feeds transcribed audio to Concierge as text input

### Interface Integration

Mobile enhancements are part of the core interface:

**Header**: Uses `useScrollHeader` for auto-hide behavior **Install flow**: Part of
onboarding and retention strategy **Loading states**: Provide feedback during all async
operations

## Open Questions

### Product

**Gesture conflicts**: How do we handle pull-to-refresh when user is selecting text at
top of page? Edge case but could be annoying.

**Install prompt timing**: 3 seconds feels right for engaged users, but should we wait
longer for first-time visitors? A/B test?

**Wake Lock strategy**: Should it auto-enable during AI streaming or require manual
toggle? Balance between convenience and battery.

**Snooze duration**: 7 days for install prompt—too aggressive? Too passive? Need usage
data.

### Technical

**Performance monitoring**: How do we track gesture performance (frame rates, response
times) in production?

**Analytics**: Should we track gesture usage? Install prompt conversion? How without
compromising privacy?

**Cache strategy**: For offline-first data, what's the right cache size? 50
conversations? 100? User-configurable?

**Battery impact**: Wake Lock keeps screen on—what's the battery cost? Should we warn
users or auto-disable after threshold?

### Research Needed

**Gesture customization**: Should power users be able to configure thresholds, disable
features, or remap gestures?

**Platform-specific optimizations**: Are there iOS-specific or Android-specific
enhancements we're missing?

**A11y considerations**: How do these gestures work with screen readers? VoiceOver?
TalkBack?

**Competitive analysis**: What mobile PWA gestures do Linear, Notion, or other
best-in-class apps implement?

## References

### Documentation

- [MDN: Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)
- [MDN: Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
- [web.dev: Building a PWA](https://web.dev/explore/progressive-web-apps)
- [MDN: BeforeInstallPromptEvent](https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent)

### Best Practices

- [iOS PWA Guidelines](https://webkit.org/blog/8042/progressive-web-apps-on-ios/)
- [Chrome PWA Best Practices](https://developer.chrome.com/docs/lighthouse/pwa/)
- [Framer Motion: Gestures](https://www.framer.com/motion/gestures/)

### Research Sources

- [Share Target API](https://developer.mozilla.org/en-US/docs/Web/Manifest/share_target)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Service Worker: Offline First](https://web.dev/articles/offline-cookbook)

---

## Implementation Notes

All mobile enhancements follow TypeScript coding standards defined in project cursor
rules. Hooks use Pino logger for structured logging. Components use Framer Motion for
animations.

These features were implemented iteratively based on mobile usage feedback. Each
enhancement makes the PWA feel more native, more responsive, more delightful.

The goal: Make users forget they're using a web app.
