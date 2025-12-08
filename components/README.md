# Carmenta Components

React components organized by feature area. This directory contains all UI components
for the Carmenta interface.

## Directory Structure

### Core Connection Experience

- **`connection/`** - Connection (chat) interface components
  - `holo-thread.tsx` - Main holographic message thread
  - `connection-chooser.tsx` - Header navigation between connections
  - `connection-context.tsx` - Shared connection state management
  - `concierge-display.tsx` - Concierge explanations and model selection UI
  - `reasoning-display.tsx` - Extended thinking (reasoning tokens) display
  - `thinking-indicator.tsx` - Animated thinking/processing states
  - `chat.tsx` - Message input and submission
  - `file-attachment-context.tsx` - File upload state management
  - `file-picker-button.tsx` - File selection button
  - `file-preview.tsx` - File preview cards
  - `upload-progress.tsx` - File upload progress indicators
  - `model-selector/` - Model selection slider and UI
  - `optional-user-button.tsx` - Clerk user authentication button
  - `connect-layout.tsx` - Connection page layout wrapper
  - `connect-runtime-provider.tsx` - Runtime configuration for connections

### Shared UI Primitives

- **`ui/`** - Reusable UI components (shadcn/ui patterns)
  - Base components: buttons, inputs, cards, dialogs, dropdowns
  - `holographic-background.tsx` - Animated holographic background
  - Layout and typography primitives

### Feature Areas

- **`brand/`** - Brand showcase components
  - `color-swatch.tsx` - Color palette display
  - `oracle-showcase.tsx` - Oracle state demonstrations
  - `social-preview.tsx` - Social media preview generator

- **`design-lab/`** - Design exploration system
  - `shell.tsx` - Interactive design option navigation

- **`generative-ui/`** - AG-UI protocol components
  - Dynamic, purpose-built response interfaces
  - Context-specific interactive components

- **`seo/`** - SEO and metadata components
  - Structured data, meta tags, social cards

- **`icons/`** - Custom SVG icons

### Site-Wide Components

- `site-header.tsx` - Main site header with navigation
- `footer.tsx` - Site footer
- `offline-retry-button.tsx` - PWA offline retry UI
- `pwa-registration.tsx` - Progressive Web App registration handler

## Component Patterns

### State Management

- Use React Context for shared state within feature areas
- Lift state to nearest common ancestor
- Prefer composition over prop drilling

### Styling

- Tailwind CSS utility classes
- `cn()` helper for conditional class names (from `@/lib/utils`)
- Glass card pattern: `glass-card` class for glassmorphism effect
- Holographic accents: Use primary color (`text-primary`, `bg-primary`)

### Accessibility

- Use Radix UI primitives for accessible interactive components
- Semantic HTML elements
- ARIA labels where needed
- Keyboard navigation support

### File Organization

- Co-locate related components in feature directories
- Export barrel files (`index.ts`) for clean imports
- Keep components focused and composable

## Adding New Components

1. Choose appropriate directory based on feature area
2. Follow existing naming conventions (kebab-case files, PascalCase components)
3. Use TypeScript with explicit prop types
4. Include JSDoc comments for complex components
5. Export from `index.ts` if part of a feature group

## Related Documentation

- [knowledge/components/interface.md](../knowledge/components/interface.md) - Interface
  architecture
- [knowledge/design-principles.md](../knowledge/design-principles.md) - Design
  principles
- [knowledge/design-system.md](../knowledge/design-system.md) - Design system guidelines
