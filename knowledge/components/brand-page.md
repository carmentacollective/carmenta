# Brand Guidelines Showcase

Living style guide and brand documentation displayed at `/brand`. Internal development
tool for maintaining visual and philosophical consistency.

## Why This Exists

Brand guidelines scattered across PDFs and Figma files don't serve AI-first development.
We need a living, interactive reference that:

1. **Lives in the codebase** - Single source of truth alongside the code it guides
2. **Shows real components** - Actual button states, animations, colors from the system
3. **Demonstrates philosophy** - Heart-centered voice, "we" language, unity
   consciousness
4. **Generates assets** - Social previews, OG images, downloadable logos
5. **Guides AI** - Clear examples AI can reference when building features

## What It Contains

### Brand Story & Philosophy

- **The Goddess** - Carmenta mythology and naming rationale
- **Unity Consciousness** - The philosophical foundation
- **The "We" That Creates Reality** - Why language choice matters
- **Carmenta Vocabulary** - Message, Connection, Connecting (not chat, prompt, query)
- **How Users Should Feel** - Coming Home, Seen, Flow State, Belonging
- **North Star Feeling** - "I can finally work at the speed I think"

### Voice & Personality

- **Direct & Precise** - Every word earns its place
- **Protect Flow State** - Keep pace with thought
- **Anticipate** - Surface patterns before requested
- **Own Mistakes Directly** - No hedging
- **Delight in the Work** - Genuine appreciation
- **Not Performative** - Warmth is presence, not exclamation points

### Visual Design System

- **Color Palette** - Interactive swatches with hex, HSL, usage
  - Background, Foreground, Primary, Muted, Border, Glass Overlay

- **Typography** - Live specimens
  - Outfit (primary) - Modern geometric with soft curves
  - JetBrains Mono (code) - Technical content

- **Logos & Icons**
  - Icon (transparent PNG)
  - Lockup (icon + wordmark)
  - Favicon variants (32x32, 180x180, 512x512, 1024x1024)

- **Button Interaction States** - Live demos
  - Click (ripple + depth shift)
  - Loading (holographic spinner)
  - Hover (icon prominence)
  - Focus (thick ring)
  - Disabled (grayscale)
  - Success (green)
  - Error (red)

- **Animation Library** - Entry and exit animations
  - Entry: Gentle Arrival, Recognition, Coming Home, Warm Welcome, etc.
  - Exit: Gentle Fade, Quiet Release, Completion, Dissolve, etc.
  - Each with live demo and replay button
  - Names reflect brand values (Belonging, Unity, Partnership)

- **Oracle States** - AI persona visual states
  - Thinking, listening, responding
  - See components/brand/oracle-showcase.tsx

- **Social Media Preview** - Interactive OG image generator
  - 1200x630 with holographic background
  - Screenshot guide for exact dimensions

### Design Principles

- **Memory Is Relationship** - Remembering shows we care
- **Voice Is Intimacy** - Speaking is more personal than typing
- **Proactivity Is Care** - Anticipating needs demonstrates attention
- **Simplicity Is Respect** - Attention is precious
- **Partnership Is Real** - AI team isn't metaphor
- **Not Cold, Not Cutesy** - Professional warmth

### Usage Guidelines

Do's and Don'ts for logo usage, language, tone, design application.

## Architecture

### Route & Component Structure

```
app/brand/
  page.tsx              # Main brand showcase page
  og-image/
    page.tsx           # Social preview generator

components/brand/
  color-swatch.tsx     # Color display component
  oracle-showcase.tsx  # Oracle state demonstrations
  social-preview.tsx   # OG image preview component
```

### Page Implementation

`app/brand/page.tsx` is a client component using:

- `HolographicBackground` for brand-consistent backdrop
- `SiteHeader` with theme switcher disabled (brand page shows both themes)
- `framer-motion` for interactive animations
- Embedded demos for button states, animations
- Live color swatches reading from CSS custom properties

### Integration with Knowledge Base

The brand page visualizes concepts from:

- `knowledge/brand-essence.md` - Core brand philosophy
- `knowledge/design-system.md` - Design system specifications
- `knowledge/design-principles.md` - Interaction design principles
- `knowledge/users-should-feel.md` - Experiential goals
- `.cursor/rules/personalities/carmenta.mdc` - Voice and personality

## Use Cases

### For Developers

- Reference colors, typography, spacing when building features
- Copy button state code snippets directly from examples
- Understand brand voice when writing UI text
- See animation patterns for consistent motion design

### For AI

- Clear examples of brand voice and language patterns
- Visual design system with concrete specifications
- Philosophy grounding for decision-making about UI/UX
- Animation names that reflect brand values (not generic "fadeIn")

### For Designers

- Living spec that updates with the product
- Interactive animations to evaluate timing and feel
- Color swatches showing actual in-use colors
- Typography specimens rendered with real fonts

## Maintenance

### Keeping It Current

When design system changes:

1. Update CSS custom properties in `app/globals.css`
2. Color swatches read from CSS, update automatically
3. Add new button states or animations to brand page demos
4. Regenerate social previews if branding evolves

### Philosophy Evolution

When brand philosophy evolves:

1. Update knowledge base docs (brand-essence.md, design-principles.md)
2. Update brand page content to reflect
3. Ensure examples demonstrate new philosophy

## Success Criteria

- Developers can build features without asking "what color?" or "what font?"
- AI references brand page when generating UI code
- New team members understand voice and philosophy from one page
- Social previews look consistent and on-brand
- No drift between "documented" and "actual" design system

## Open Questions

- Should this page be public or internal-only?
- How to version design system changes (track iterations)?
- Generate downloadable brand kit (ZIP with logos, colors, fonts)?
- Add code playground for testing components against brand guidelines?

## Related Components

- [design-exploration.md](./design-exploration.md) - Design exploration workflow
- [delight-and-joy.md](./delight-and-joy.md) - Delight layer specifications
- [status-indicators.md](./status-indicators.md) - Thinking and loading states
