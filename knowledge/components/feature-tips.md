# Feature Tips

Progressive feature discovery that feels like a gift, not an interruption. Tips rotate
through the connection page, introducing capabilities at the right moment, then
gracefully stepping aside once acknowledged.

## Philosophy

Tips are how we communicate with our users. When we ship a feature, a tip explains it.
When we want to surface a capability, a tip highlights it. This isn't onboarding—it's an
ongoing conversation about what's possible.

**Three tensions to balance:**

1. **Discovery vs. interruption**: Users need to learn what Carmenta can do, but
   interruptions destroy flow. Tips appear in natural pause moments, never mid-task.
2. **Persistence vs. annoyance**: Show tips enough that users see them, but not so often
   they become noise. Variable reward psychology keeps engagement without fatigue.
3. **Simplicity vs. intelligence**: Simple random selection is easy but wasteful. Smart
   selection based on user behavior is powerful but complex. Start simple, layer
   intelligence.

**Going one level deeper**: Feature tips are the bridge between building and adoption.
Every feature we ship that users don't know about is wasted effort. But tips that feel
like advertising destroy trust. The Carmenta way: tips that feel like a friend pointing
out something useful—"Hey, did you know we can do this?"

## What Leaders Do Today

### Lobe Chat

- **UserGuide flags** in user preferences: boolean flags like `moveSettingsToAvatar`,
  `uploadFileInKnowledgeBase` that show once then dismiss
- **TipGuide component**: controlled visibility via user store, explicit dismiss handler
- **Pattern**: Each guide has explicit selector (`showUploadFileInKnowledgeBaseTip`) and
  update action (`updateGuideState({ key: false })`)
- **Strength**: Clean separation of "should show" logic from component
- **Weakness**: No analytics, no frequency control

### Open WebUI

- **Changelog modal**: Version comparison triggers "What's New" display
- **Admin-configurable banners**: Backend-stored, markdown-rendered, dismissible
- **Version tracking**: `settings.version` compared to `config.version`
- **Dismissal**: localStorage for dismissible banners, sessionStorage for
  non-dismissible
- **Strength**: Admin can announce without code changes
- **Weakness**: Only changelog-based, no feature discovery

### Slack

- **Slackbot onboarding**: Conversational first-run experience
- **Empty state hints**: Contextual help appears as users explore
- **Progressive disclosure**: Features revealed as user encounters relevant sections
- **Strength**: Feels natural, not forced
- **Weakness**: Only works for initial onboarding

### Industry Patterns

- **Variable rewards**: Dopamine release is higher for unpredictable rewards than
  guaranteed ones. Apps like Asana show random celebratory creatures on task completion
- **"New" badges**: Subtle indicators on menu items draw attention without interrupting
- **Progressive disclosure**: Information revealed only when relevant, reducing
  cognitive load

**Sources:**

- [Variable Rewards and Product Adoption](https://userpilot.com/blog/variable-rewards/)
- [LobeChat Onboarding](https://github.com/lobehub/lobe-chat/blob/main/src/store/user/slices/preference/selectors/preference.ts)
- [Open WebUI Changelog](https://github.com/open-webui/open-webui/blob/main/src/lib/components/ChangelogModal.svelte)

## Architecture Decisions

### ✅ Server-Side Persistence for Cross-Device Sync

**Decision**: Store tip view/dismiss state in the database, not localStorage.

**Rationale**: Users access Carmenta from multiple devices (desktop, mobile, tablet).
localStorage is per-browser—the same user would see onboarding tips repeatedly on each
device. Database storage ensures tip state follows the user account.

**Schema** (extends `contextual-help.md` design):

```sql
CREATE TABLE feature_tip_views (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_id    TEXT NOT NULL,          -- matches Feature.id from catalog
  view_count    INTEGER DEFAULT 1,
  dismissed     BOOLEAN DEFAULT FALSE,  -- explicit "don't show again"
  cta_clicked   BOOLEAN DEFAULT FALSE,  -- did they engage?
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_seen_at  TIMESTAMP DEFAULT NOW(),
  dismissed_at  TIMESTAMP,

  UNIQUE(user_id, feature_id)
);

-- Index for efficient queries
CREATE INDEX idx_feature_tip_views_user ON feature_tip_views(user_id);
```

### ✅ Variable Frequency Schedule

**Decision**: Show tips with decreasing probability based on session count.

**Rationale**: New users need more guidance; experienced users need less. But never
completely stop—occasional tips remind users of features they may have forgotten or
never used.

**Implementation**:

```typescript
// Sessions 1-3: 100% - New users should always see tips
// Sessions 4-10: 75% - Still building familiarity
// Sessions 11-25: 40% - Occasional reminders
// Sessions 26+: 15% - Rare but not gone
function shouldShowTip(sessionCount: number): boolean {
  if (sessionCount <= 3) return true;
  if (sessionCount <= 10) return Math.random() < 0.75;
  if (sessionCount <= 25) return Math.random() < 0.4;
  return Math.random() < 0.15;
}
```

**Note**: Session count stored in user record, incremented on new connection page visit.

### ✅ Weighted Selection with Recency Penalty

**Decision**: Select tips based on priority weight, penalized by recent views.

**Rationale**: High-priority features (new releases, core capabilities) should appear
more often, but no tip should dominate. If a user saw "Multi-model" yesterday, they
shouldn't see it again for a while.

**Algorithm**:

```typescript
function selectTip(features: Feature[], viewHistory: TipView[]): Feature {
  const now = Date.now();

  const weighted = features.map((f) => {
    const view = viewHistory.find((v) => v.featureId === f.id);

    // Base weight from priority (1-10)
    let weight = f.priority;

    // Heavy penalty for recently seen (decays over 7 days)
    if (view) {
      const daysSinceSeen = (now - view.lastSeenAt) / (1000 * 60 * 60 * 24);
      const recencyPenalty = Math.max(0, 1 - daysSinceSeen / 7);
      weight *= 1 - recencyPenalty * 0.8; // Up to 80% reduction

      // Additional penalty for high view counts
      weight *= Math.max(0.2, 1 - view.viewCount * 0.1);
    }

    // Bonus for never-seen tips
    if (!view) {
      weight *= 1.5;
    }

    // Skip dismissed tips entirely
    if (view?.dismissed) {
      weight = 0;
    }

    return { feature: f, weight };
  });

  // Weighted random selection
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let random = Math.random() * totalWeight;

  for (const { feature, weight } of weighted) {
    random -= weight;
    if (random <= 0) return feature;
  }

  // Fallback
  return features[0];
}
```

### ✅ Analytics Events for Product Intelligence

**Decision**: Track tip impressions, dismissals, and CTA clicks.

**Rationale**: Understanding which tips resonate helps prioritize features and improve
copy. Analytics also enables future A/B testing of tip content.

**Events**:

| Event              | Properties                                    | Purpose                      |
| ------------------ | --------------------------------------------- | ---------------------------- |
| `tip_shown`        | `feature_id`, `session_count`, `view_number`  | Track impressions            |
| `tip_dismissed`    | `feature_id`, `time_visible_ms`               | Measure interest vs. fatigue |
| `tip_cta_clicked`  | `feature_id`, `cta_action`, `cta_href`        | Track engagement             |
| `tip_auto_rotated` | `feature_id`, `next_feature_id`, `after_time` | If we add auto-rotation      |

### ✅ Dismiss Means Dismiss (But Not Forever)

**Decision**: Dismiss removes a tip for 30 days, not permanently.

**Rationale**: Users might dismiss a tip about a feature they don't need today but would
benefit from later. Hard-dismissal forever prevents rediscovery. 30-day timeout allows
re-emergence without being annoying.

**Implementation**: `dismissed` flag is reset after 30 days via `dismissed_at` timestamp
check.

### ❓ Auto-Rotation vs. Single Tip Per Session

**Open Question**: Should tips auto-rotate through multiple features in a session?

**Option A: Single tip per session**

- Simpler implementation
- Less cognitive load
- User might miss features

**Option B: Auto-rotate every 30 seconds**

- More features exposed per session
- Risk of feeling like ads
- More complex state management

**Recommendation**: Start with single tip per session. Monitor analytics. If users
aren't seeing enough features, add subtle "Next tip" button rather than auto-rotation.

### ❓ Placement on Connection Page

**Open Question**: Where should tips appear?

**Options explored in Design Lab:**

1. **Below greeting, above sparks** - Natural reading flow, but takes prime real estate
2. **Above composer** - Close to action, but might feel intrusive
3. **Floating bottom-right** - Out of the way, but might be missed
4. **Inline with sparks** - Blends with UI, but competes visually
5. **Collapsible header banner** - Persistent but dismissible

See Design Lab for visual explorations: `/app/design-lab/feature-tip-placement/page.tsx`

## Data Model

### TypeScript Types

```typescript
// Extends existing Feature from feature-catalog.ts
interface FeatureTipView {
  id: string;
  userId: string;
  featureId: string;
  viewCount: number;
  dismissed: boolean;
  ctaClicked: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date;
  dismissedAt: Date | null;
}

interface TipSelection {
  feature: Feature;
  isFirstView: boolean;
  totalViewCount: number;
}
```

### API Endpoints

```typescript
// Get tip to show (handles selection logic server-side)
GET /api/tips/next
Response: { tip: Feature | null, isFirstView: boolean }

// Record tip view
POST /api/tips/view
Body: { featureId: string }

// Dismiss tip
POST /api/tips/dismiss
Body: { featureId: string }

// Record CTA click
POST /api/tips/cta-click
Body: { featureId: string }
```

## Component API

### FeatureTip (Enhanced)

```tsx
interface FeatureTipProps {
  className?: string;
  placement?: "below-greeting" | "above-composer" | "floating" | "banner";
}

// Usage
<FeatureTip placement="below-greeting" />;
```

### useFeatureTip Hook

```typescript
interface UseFeatureTipResult {
  tip: Feature | null;
  isLoading: boolean;
  isFirstView: boolean;
  dismiss: () => void;
  recordCtaClick: () => void;
}

function useFeatureTip(): UseFeatureTipResult;
```

## Implementation Path

### Phase 1: Database Foundation

1. Create `feature_tip_views` table with Drizzle schema
2. Add session count tracking to user record
3. Implement `/api/tips/next` with basic random selection
4. Migrate `FeatureTip` component to use API instead of client-side selection

### Phase 2: Smart Selection

1. Implement weighted selection algorithm
2. Add recency penalty logic
3. Implement variable frequency schedule
4. Add 30-day dismiss timeout

### Phase 3: Analytics

1. Add tip events to analytics pipeline
2. Create tip effectiveness dashboard (future)
3. Enable A/B testing of tip copy (future)

### Phase 4: Polish

1. Finalize placement based on Design Lab feedback
2. Add animation refinements
3. Consider "New feature!" badge for recent releases
4. Consider "Pro tip" variant for power-user features

## Gap Assessment

### Achievable Now

- Database schema and API endpoints
- Basic server-side tip selection
- Cross-device sync of view/dismiss state
- Analytics event tracking

### Emerging (6-12 months)

- ML-based tip personalization (show tips relevant to user's usage patterns)
- A/B testing framework for tip content
- In-product changelog tied to tips ("This feature was added X days ago")
- Admin dashboard for tip performance

### Aspirational

- Proactive tips based on detected user struggles ("Having trouble? Try...")
- AI-generated tip content based on user's specific context
- Tips that teach by doing (interactive walkthroughs)

## Content Guidelines

### Tip Title (tipTitle)

- 5-8 words maximum
- Benefit-focused, not feature-focused
- Use "we" language: "We Remember You" not "Your data is saved"
- Active voice: "Switch Models Mid-Thought" not "Models Can Be Switched"

### Tip Description (tipDescription)

- 1-2 sentences maximum
- Explain what it does AND why it matters
- End with what the user gains, not what the feature does
- Never use jargon; assume no technical knowledge

### CTA Label

- 2-3 words
- Action verb + object: "Connect services", "View knowledge"
- Never "Click here" or "Learn more"

## Sync Points

- Feature catalog: `lib/features/feature-catalog.ts`
- Contextual help philosophy: `knowledge/components/contextual-help.md`
- Delight patterns: `knowledge/components/delight-and-joy.md`
- Analytics events: `lib/analytics/` (when implemented)

## Sources

- [Lobe Chat User Guide Pattern](https://github.com/lobehub/lobe-chat/blob/main/packages/types/src/user/preference.ts)
- [Open WebUI Changelog Modal](https://github.com/open-webui/open-webui/blob/main/src/lib/components/ChangelogModal.svelte)
- [Assistant-UI Onboarding Modal](https://github.com/assistant-ui/assistant-ui/blob/main/packages/chatgpt-app-studio/templates/starter/components/workbench/onboarding-modal.tsx)
- [Frigade: Stop Storing Impressions in localStorage](https://frigade.com/blog/stop-storing-impressions-in-local-storage)
- [Variable Rewards for User Engagement](https://userpilot.com/blog/variable-rewards/)
- [Feature Adoption Best Practices 2025](https://whatfix.com/blog/feature-adoption/)
