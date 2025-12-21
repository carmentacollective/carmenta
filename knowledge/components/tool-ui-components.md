# Tool UI Components

Rich, interactive UI components for AI tool results. Ported from assistant-ui/tool-ui,
adapted for Carmenta's design system.

## Why This Exists

Tool results deserve better than JSON dumps or plain text. When Carmenta executes a
tool, the result should feel native to the interface - interactive, beautiful, and
useful. These components transform tool outputs into experiences.

## Source

Ported from [tool-ui](https://github.com/assistant-ui/tool-ui) - an MIT-licensed
component library designed specifically for AI tool interfaces. Components are adapted
to Carmenta's styling (glass aesthetic, purple tints) and integrated with existing
patterns (ToolWrapper, cn() utility).

## Architecture

### Adapter Pattern

Each component uses an `_adapter.tsx` file that re-exports UI primitives. This makes
components portable - change the adapter imports to point to Carmenta's existing
shadcn/ui components.

```typescript
// components/tool-ui/plan/_adapter.tsx
export { cn } from "@/lib/utils";
export { Button } from "@/components/ui/button";
export { Card, CardHeader, CardContent } from "@/components/ui/card";
export {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
```

### Schema-Driven

Every component has a Zod schema defining what AI can generate (serializable) vs what
React handles (callbacks, className). This separation enables:

- Type-safe tool outputs
- Runtime validation
- Clear contract between AI and UI

```typescript
// Serializable: AI generates this
interface SerializablePlan {
  id: string;
  title: string;
  todos: PlanTodo[];
}

// Full props: React adds interactivity
interface PlanProps extends SerializablePlan {
  className?: string;
  onResponseAction?: (actionId: string) => void;
}
```

### Shared Utilities

Common patterns extracted to `/components/tool-ui/shared/`:

- **Action Buttons** - Unified button system with confirmation delays for destructive
  actions
- **Copy to Clipboard** - Hook with copied state management
- **Media Utilities** - Aspect ratios, fit modes, href sanitization

## Components

### Plan

Task workflow visualization with progress tracking. Shows what's happening, what's done,
what's next.

**Use Cases:**

- Multi-step tool operations (research → analyze → synthesize)
- Background job progress
- Scheduled agent task lists
- Complex workflows with status per step

**Features:**

- Progress bar with completion percentage
- Status icons: pending (circle), in_progress (spinning), completed (checkmark),
  cancelled (x)
- Expandable todo items with descriptions
- Shimmer effect on active items
- Collapsible overflow ("4 more...")
- Optional action buttons

**Schema:**

```typescript
interface PlanTodo {
  id: string;
  label: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
}

interface PlanProps {
  id: string;
  title: string;
  description?: string;
  todos: PlanTodo[];
  maxVisibleTodos?: number; // Default: 4
  showProgress?: boolean; // Default: true
  responseActions?: ActionsProp;
}
```

### Link Preview

Rich preview cards for URLs with Open Graph data. Transforms bare links into visual
cards.

**Use Cases:**

- Web search results
- fetchPage tool output
- Any URL shared in conversation
- Research citations

**Features:**

- OG image with configurable aspect ratio
- Favicon and domain display
- Title and description with line clamping
- Keyboard accessible (Enter/Space to open)
- Loading skeleton
- Sanitized href (prevents javascript: attacks)

**Schema:**

```typescript
interface LinkPreviewProps {
  id: string;
  href: string;
  title?: string;
  description?: string;
  image?: string;
  domain?: string;
  favicon?: string;
  ratio?: "16:9" | "4:3" | "1:1" | "auto";
  fit?: "cover" | "contain";
}
```

### Option List

Interactive selection UI for choices. Single or multi-select with keyboard navigation.

**Use Cases:**

- "Which calendar should we check?" (single select)
- "Select the contacts to include" (multi select)
- Any decision point in conversation
- Configuration choices

**Features:**

- Single or multi-select modes
- Keyboard navigation (arrows, space, enter)
- Max selections limit
- Disabled options
- Confirmation action buttons
- Visual selection indicators

**Schema:**

```typescript
interface OptionItem {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface OptionListProps {
  id: string;
  options: OptionItem[];
  mode: "single" | "multi";
  maxSelections?: number;
  selectedIds?: string[];
  responseActions?: ActionsProp;
  onSelectionChange?: (ids: string[]) => void;
}
```

### POI Map

Interactive map with points of interest. Location-aware experiences.

**Use Cases:**

- "Find restaurants near me"
- Travel planning with saved favorites
- Event venue selection
- Any location-based query

**Features:**

- Leaflet-based interactive map
- Category icons (restaurant, cafe, museum, park, etc.)
- Favorites with heart toggle
- Category filtering dropdown
- Multiple display modes: inline, fullscreen, carousel
- Detail modal with "Open in Google Maps"
- Follow-up message button ("Tell me more about...")
- Light/dark theme awareness

**Schema:**

```typescript
interface POI {
  id: string;
  name: string;
  description?: string;
  category:
    | "restaurant"
    | "cafe"
    | "museum"
    | "park"
    | "shopping"
    | "entertainment"
    | "landmark"
    | "transit"
    | "other";
  lat: number;
  lng: number;
  address?: string;
  rating?: number;
  imageUrl?: string;
  tags?: string[];
}

interface POIMapProps {
  id: string;
  pois: POI[];
  title?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
}
```

**Dependencies:**

- `leaflet` (~40KB)
- `react-leaflet` (~15KB)

## Integration with Carmenta

### With ToolWrapper

Components can be used inside ToolWrapper for consistent tool UI:

```typescript
<ToolWrapper toolName="planTask" status={status} ...>
  <Plan
    id={toolCallId}
    title="Research Project"
    todos={todos}
  />
</ToolWrapper>
```

### Standalone

Or standalone for non-tool contexts:

```typescript
<LinkPreview
  id="citation-1"
  href="https://example.com/article"
  title="Important Research"
  description="Key findings about..."
  image="/og-image.jpg"
/>
```

### Styling

Components inherit Carmenta's design tokens via CSS variables:

- `--background`, `--foreground` - Base colors
- `--primary`, `--muted` - Accent colors
- `--card`, `--border` - Surface colors
- `--radius` - Border radius

Glass effects applied through Carmenta's existing utilities.

## File Structure

```
/components/tool-ui/
├── shared/
│   ├── index.ts
│   ├── action-buttons.tsx
│   ├── copy-to-clipboard.ts
│   └── media.ts
├── plan/
│   ├── index.ts
│   ├── _adapter.tsx
│   ├── schema.ts
│   ├── plan.tsx
│   └── progress-bar.tsx
├── link-preview/
│   ├── index.ts
│   ├── _adapter.tsx
│   ├── schema.ts
│   └── link-preview.tsx
├── option-list/
│   ├── index.ts
│   ├── _adapter.tsx
│   ├── schema.ts
│   └── option-list.tsx
└── poi-map/
    ├── index.ts
    ├── _adapter.tsx
    ├── schema.ts
    ├── poi-map.tsx
    ├── map-view.tsx
    ├── poi-card.tsx
    ├── poi-list-inline.tsx
    ├── poi-list-sidebar.tsx
    └── use-poi-map.ts
```

## Success Criteria

- Components render correctly in both light and dark mode
- Keyboard navigation works for interactive elements
- Loading states feel native to Carmenta
- No layout shift when content loads
- Accessibility: proper ARIA labels, focus management
- TypeScript: full type safety with Zod validation

## Dependencies to Add

```json
{
  "leaflet": "^1.9.4",
  "react-leaflet": "^5.0.0",
  "@types/leaflet": "^1.9.21"
}
```

Leaflet CSS must be imported for map tiles and markers.

## Open Questions

### Product Decisions

- **POI Map sources**: Where does location data come from? Google Maps MCP? Yelp
  integration? Manual entry?
- **Option List persistence**: Should selections persist across conversation turns?
- **Link Preview OG fetching**: Server-side or edge function? Rate limiting?

### Technical Specifications

- Action button callback integration with Carmenta's message system
- POI Map state persistence across re-renders
- Link Preview caching strategy for OG data
