# Carmenta App Directory

Next.js 16 app router structure. Routes, layouts, and page components.

## Directory Structure

### Routes (User-Facing)

#### Core Experience

- **`/`** (`page.tsx`) - Landing page
  - Vision, capabilities, GitHub link
  - Entry point for new users

- **`/connection/`** - Connection (chat) interface
  - `/connection` - New connection interface (or `/connection?new` to force fresh state)
  - `/connection/[slug]/[id]` - Active connection by slug and ID
  - Core interaction experience

#### Authentication (Clerk)

- **`/sign-in/[[...sign-in]]/`** - Clerk sign-in page
- **`/sign-up/[[...sign-up]]/`** - Clerk sign-up page
- Catch-all routes handle all Clerk auth flows

#### Internal/Development

- **`/design-lab/`** - Interactive design exploration system
  - Generate 8-10 design variations for UI patterns
  - Navigate options, view code, iterate
  - Used with `/design-lab` slash command
  - See
    [knowledge/components/design-exploration.md](../knowledge/components/design-exploration.md)

- **`/brand/`** - Brand guidelines showcase
  - Philosophy, voice, colors, typography
  - Button states, animations, logos
  - Social preview generator
  - Living style guide for development
  - See knowledge/brand-essence.md and knowledge/design-system.md

- **`/ai-first-development/`** - AI-first development documentation page
  - Showcases the AI-first development philosophy
  - Explains knowledge/ folder as spec

#### Utility Pages

- **`/offline/`** - PWA offline fallback page
  - Displayed when app is offline in PWA mode
  - Retry button to attempt reconnection

### Special Files

- **`layout.tsx`** - Root layout
  - Theme provider, Clerk provider
  - Global fonts, styles
  - Site-wide header/navigation

- **`error.tsx`** - Error boundary for route errors
  - Catches React errors in routes
  - Displays user-friendly error UI

- **`global-error.tsx`** - Global error boundary
  - Last resort error handler
  - Catches errors in root layout

- **`not-found.tsx`** - 404 page
  - Custom 404 experience
  - Navigation back to home

### API Routes

- **`/api/connection/`** (`route.ts`) - Connection CRUD operations
  - Create, read, update connections
  - Backend for connection management

- **`/api/webhooks/clerk/`** (`route.ts`) - Clerk webhooks
  - User lifecycle events (created, updated, deleted)
  - Syncs Clerk user data to our database

### Metadata & SEO

- **`manifest.ts`** - PWA web app manifest
  - App name, icons, theme colors
  - Installation configuration

- **`robots.ts`** - Dynamic robots.txt generation

- **`sitemap.ts`** - Dynamic sitemap generation

- **`opengraph-image.png`** - Social preview image (1200x630)

- **`apple-icon.png`** - Apple touch icon (180x180)

- **`icon.png`** - App icon (used as favicon)

### Styling

- **`globals.css`** - Global styles
  - Tailwind directives
  - CSS custom properties
  - Holographic theme variables
  - Glass card styles

## Route Patterns

### File-Based Routing

Next.js app router uses file system for routing:

- `page.tsx` - Route component
- `layout.tsx` - Shared layout
- `route.ts` - API route
- `[param]` - Dynamic segment
- `[[...param]]` - Optional catch-all

### Data Fetching

Use Server Components for data fetching by default:

```typescript
export default async function ConnectionPage({ params }: { params: { slug: string } }) {
  const connection = await getConnection(params.slug);
  return <ConnectionView connection={connection} />;
}
```

Use Client Components (`'use client'`) for interactivity:

```typescript
"use client";
import { useState } from "react";

export default function InteractiveComponent() {
  const [state, setState] = useState();
  // ...
}
```

### Metadata

Export metadata object for SEO:

```typescript
export const metadata = {
  title: "Page Title",
  description: "Page description",
  openGraph: {
    title: "OG Title",
    description: "OG Description",
  },
};
```

### Error Handling

- `error.tsx` - Catches errors in route tree
- `global-error.tsx` - Catches errors in root layout
- Both auto-wrapped in error boundary by Next.js

## Adding New Routes

1. Create directory with route name
2. Add `page.tsx` for the route component
3. Optionally add `layout.tsx` for route-specific layout
4. Add metadata for SEO
5. Update site navigation if needed

## Related Documentation

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [knowledge/components/interface.md](../knowledge/components/interface.md) - Interface
  architecture
- [knowledge/tech-architecture.md](../knowledge/tech-architecture.md) - Tech decisions
