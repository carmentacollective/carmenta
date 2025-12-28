# Progressive Web App (PWA)

Progressive Web App implementation that makes Carmenta installable, work offline, and
support push notifications. This is the bridge between web application and native app
experience, enabling the platform progression outlined in vision.md.

## Why PWA Matters for Carmenta

The vision states: "Web application first, then PWA for notifications, then Electron for
desktop, then mobile." PWA is the first step toward platform ubiquity.

### Strategic Alignment

**For M1 (Nick)**: PWA enables notifications for proactive intelligence without
requiring Electron. Test the notification paradigm before committing to desktop builds.

**For M3 (Flow State Builder)**: Installable app creates psychological shift from
"website I visit" to "tool I use." Removes browser chrome, increases perceived
legitimacy.

**For M4 (Leverage Seeker)**: Push notifications are **essential** for the Digital Chief
of Staff and scheduled agents. Without notifications, proactive intelligence is limited
to when the app is open. With notifications, Carmenta can surface what matters when it
matters.

### Capabilities Unlocked

- **Push Notifications**: Digital Chief of Staff can notify about commitments, meeting
  prep, escalations
- **Scheduled Agents**: Daily briefings, research digests surface via notifications
- **Offline Support**: Graceful degradation when network unavailable
- **App-like Feel**: Standalone window, splash screen, home screen icon
- **Background Sync**: Queue actions when offline, execute when connection returns

## Implementation Approach

Based on 2025 best practices research, we're using Next.js 15's native PWA support
rather than third-party packages like `next-pwa`.

### Architecture Decision: Library-Free

**Why no `next-pwa`**: Next.js now provides built-in manifest support
(`app/manifest.ts`) and service worker capabilities. Using native features gives us:

- Smaller bundle size
- Better alignment with Next.js updates
- Full control over service worker behavior
- No dependency maintenance burden

**Service Worker Strategy**: Custom service worker in `public/sw.js` with:

- Network-first caching for dynamic content
- Cache-first for static assets
- Offline fallback page
- Push notification handlers
- Background sync hooks (for future)

### Web App Manifest

Created programmatically at `app/manifest.ts` following Next.js App Router patterns.

**Configuration Decisions**:

- `display: "standalone"` - Removes browser chrome, feels like native app
- `background_color: "#0a0a0a"` - Matches Carmenta dark theme
- `theme_color: "#6366f1"` - Indigo from design system, holographic aesthetic
- `orientation: "portrait-primary"` - Mobile-first but allows landscape
- Categories: `["productivity", "business", "utilities"]` for app store discoverability

**Icon Requirements** (2025 standards):

- 192×192 px (minimum, Android homescreen)
- 512×512 px (splash screens, high-res displays)
- Both `any` and `maskable` purposes for Android adaptive icons
- iOS requires separate `apple-touch-icon` (180×180) via metadata

**Shortcuts**: "New Conversation" shortcut directly to `/connection` - reduces friction
for primary action.

### Service Worker Implementation

**Caching Strategy**:

- **Network-first** for API routes and dynamic content - always try network, fall back
  to cache
- **Cache-first** for static assets (JS, CSS, images) - serve from cache, update in
  background
- **Offline fallback** - show `/offline` page when both network and cache fail

**Push Notification Handling**:

Service worker listens for `push` events and displays notifications using the
Notification API. Payload structure:

```json
{
  "title": "Carmenta Notification",
  "body": "Message content",
  "icon": "/logos/icon-transparent-192.png",
  "badge": "/logos/icon-transparent-192.png",
  "data": {
    "url": "/connection",
    "conversationId": "123",
    "type": "briefing"
  },
  "actions": [
    { "action": "view", "title": "View" },
    { "action": "dismiss", "title": "Dismiss" }
  ]
}
```

**Notification Click Behavior**:

- If Carmenta is already open, focus that window and navigate to relevant URL
- If Carmenta is closed, open new window at relevant URL
- Supports deep linking to specific conversations or briefings

### VAPID Keys and Web Push

**What are VAPID Keys**: Voluntary Application Server Identification - cryptographic
keypair that authenticates push messages from our server to browsers.

**Security Model**:

- Public key shared with client browsers for subscription
- Private key stays server-side, signs all push messages
- Prevents unauthorized parties from sending notifications to our users

**Implementation Plan**:

1. Generate VAPID keypair using `web-push` library
2. Store in environment variables (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`)
3. Public key exposed to client via API endpoint
4. Service worker subscribes to push notifications with public key
5. Backend API accepts subscriptions, stores in database
6. Backend sends push messages signed with private key

**Subscription Flow**:

```
User clicks "Enable Notifications"
  → Request permission via Notification API
  → If granted, register service worker
  → Subscribe to push manager with VAPID public key
  → Send subscription object to backend API
  → Backend stores subscription for user
  → Can now send notifications to this device
```

### Offline Support

**Offline Fallback Page**: Simple, graceful page at `/offline` that:

- Explains network is unavailable
- Shows cached conversations if available
- Provides retry button
- Maintains Carmenta aesthetic

**Progressive Enhancement**: Core functionality works offline where possible:

- Reading cached conversations
- Composing messages (queued for sending when online)
- Viewing knowledge base (if cached)
- Settings and preferences (local storage)

**Not Supported Offline**: Anything requiring real-time AI:

- New AI responses
- Service connectivity actions
- Knowledge base updates
- Model selection changes

## Integration Points

### Concierge Integration

Digital Chief of Staff uses push notifications for:

- **Commitment reminders**: "Meeting with Alice at 2pm"
- **Briefing delivery**: "Your daily briefing is ready"
- **Escalations**: "Project deadline approaching, 3 tasks pending"
- **Context updates**: "New information about Tesla earnings"

### Scheduled Agents Integration

Push notifications enable:

- Daily briefings delivered at preferred time
- Hourly monitoring alerts
- Weekly research digests
- Custom schedule-based intelligence

### Voice Integration

Service worker can handle background audio for:

- Voice note transcription (queue when offline)
- TTS playback continuation
- Voice-triggered actions from notifications

## Technical Specifications

### Browser Support

**Desktop**:

- Chrome/Edge 90+ (full support)
- Safari 16.4+ (PWA install, push notifications on macOS 13.1+)
- Firefox 120+ (full support)

**Mobile**:

- Chrome Android 90+ (full support)
- Safari iOS 16.4+ (full support including push notifications)
- Samsung Internet 15+ (full support)

**Critical Note**: iOS push notifications **only work for installed PWAs**. Users must
"Add to Home Screen" first. This is an iOS requirement, not a limitation of our
implementation.

### Performance Targets

- Service worker registration: < 100ms
- Cache hit latency: < 50ms
- Offline page load: < 200ms
- Push notification display: < 500ms from server send

### Security Considerations

**HTTPS Required**: PWA features require secure context (HTTPS or localhost).

**Permission Management**: Follow 2025 best practices for notification permission:

- Never request on page load
- Request in response to user action (button click)
- Explain value before requesting
- Respect denial - don't ask repeatedly

**Content Security Policy**: Service worker must comply with CSP headers defined in
`next.config.ts`.

**Data Privacy**: Subscriptions stored with user consent, can be revoked anytime.

## Rollout Plan

### Phase 1: Core PWA (Current)

- Web app manifest
- Service worker with offline support
- Installability on all platforms
- Basic caching strategy

### Phase 2: Push Notifications

- VAPID key generation and management
- Subscription flow UI
- Backend API for managing subscriptions
- Test notifications from Digital Chief of Staff

### Phase 3: Advanced Features

- Background sync for queued actions
- Periodic background sync for briefings
- Notification action buttons
- Rich notification content (images, progress bars)

### Phase 4: Optimization

- Sophisticated caching strategies
- Precaching critical routes
- Cache versioning and cleanup
- Performance monitoring

## Success Criteria

**M1 (Dogfooding)**:

- Nick can install Carmenta on macOS and iPhone
- Push notifications work for test briefings
- Offline mode shows graceful fallback
- App feels distinct from "website in browser"

**M3 (Flow State Builder)**:

- 60%+ of active users install PWA
- Daily briefing notifications have 80%+ open rate
- Zero complaints about notification spam
- Offline support prevents flow state breaks

**M4 (Leverage Seeker)**:

- Push notifications are **primary value driver** for Digital Chief of Staff
- Users report notifications saved them from missing commitments
- Scheduled agents leverage notifications for proactive intelligence

## Open Questions

### Product

- **Notification frequency**: What's the right balance? Daily briefings + high-priority
  escalations? Hourly digests available but opt-in?
- **Notification channels**: Should users configure separate channels (briefings,
  commitments, escalations) with different delivery preferences?
- **Rich notifications**: Should we use notification images, progress indicators, or
  keep minimal?

### Technical

- **Service worker updates**: How do we handle service worker updates without disrupting
  active sessions? Skip waiting vs. prompt user?
- **Cache size limits**: What's reasonable to cache offline? Full conversation history
  or just recent?
- **Subscription management**: How do users manage multiple device subscriptions? Sync
  across devices?
- **Analytics**: How do we track PWA install rate, notification engagement without
  compromising privacy?

### Research Needed

- Study notification engagement patterns from similar apps (Slack, Linear)
- Benchmark service worker performance across devices
- Test iOS PWA behavior thoroughly (most restrictive platform)
- Investigate background sync patterns for queued actions

## References

### Research Sources (2025)

- [Next.js PWA Documentation](https://nextjs.org/docs/app/guides/progressive-web-apps) -
  Official guide
- [PWA Push Notifications Guide](https://www.magicbell.com/blog/using-push-notifications-in-pwas) -
  Best practices
- [Web Push Protocol](https://web.dev/articles/push-notifications-web-push-protocol) -
  Technical spec
- [PWA Icon Requirements](https://web.dev/learn/pwa/web-app-manifest) -
  Platform-specific requirements
- [VAPID Keys Explained](https://stackoverflow.com/questions/40392257/what-is-vapid-and-why-is-it-useful) -
  Authentication approach

### Technical Standards

- [Web App Manifest Spec](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)

---

## Implementation Notes

This component is being implemented in feature branch `feature/pwa-implementation`
following the git-worktree-task workflow. All code follows TypeScript coding standards
and Next.js 15 patterns defined in project cursor rules.

Service worker intentionally kept simple and maintainable - no complex libraries like
Workbox runtime (though using `workbox-build` for generation during development if
needed). Custom implementation gives full control and minimal bundle size.
