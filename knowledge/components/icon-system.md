# Icon System

**Current**: Lucide React (v0.562.0) - 117 imports across 115 files

## Why This Matters

Icons aren't decoration. They're visual vocabulary - micro-moments of communication that
either reinforce or undermine Carmenta's identity. The deeper question isn't "which
library has more icons?" but "what visual language serves heart-centered AI?"

Carmenta uses "we" language throughout. The interface should feel warm, alive,
responsive - not cold and utilitarian. Icons are one lever for that feeling.

## Landscape Analysis (January 2025)

### Current Choice: Lucide

[Lucide](https://lucide.dev/) is what everyone uses. shadcn/ui default, LobeChat uses
it, most React projects use it.

- **1,600+ icons** on 24x24 grid
- **Outline only** - no fill, no duotone, one weight
- **Tree-shaking** works well
- **Well-maintained** community fork of Feather Icons
- **DX**: Simple imports, TypeScript support, consistent API

**Why it's popular**: Safe choice. Good enough for everything, excellent at nothing.
Clean aesthetic that doesn't offend. The Toyota Camry of icon libraries.

### Strong Alternative: Phosphor Icons

[Phosphor](https://phosphoricons.com/) is the interesting choice.
([GitHub](https://github.com/phosphor-icons/react))

- **6,000+ icons** - almost 4x Lucide's count
- **Six weights**: thin, light, regular, bold, fill, duotone
- **Context API** for app-wide defaults (size, weight, color)
- **Duotone unique** - two-color icons with opacity for depth
- **SSR support** via `/ssr` submodule
- **Tree-shaking** works, lightweight per-icon

**Why it's differentiated**: Expressiveness. Six weights means six levels of emphasis.
Duotone adds warmth and dimension that outline-only can't achieve. The Context API makes
consistent styling trivial.

```tsx
// Phosphor Context - app-wide defaults
<IconContext.Provider value={{ size: 24, weight: "regular", color: "currentColor" }}>
  <App />
</IconContext.Provider>

// Duotone example - depth without complexity
<Cube color="teal" weight="duotone" />
```

### Other Options Considered

| Library         | Icons   | Styles            | Notes                                                           |
| --------------- | ------- | ----------------- | --------------------------------------------------------------- |
| **Tabler**      | 5,900+  | 1 (outline)       | Largest single-style. Similar to Lucide.                        |
| **Heroicons**   | 452     | 2 (outline/solid) | Tailwind team. Quality over quantity. Limited.                  |
| **Radix**       | ~300    | 1                 | 15x15 grid. For dense UIs. Minimal set.                         |
| **Hugeicons**   | 46,000+ | 10                | Freemium. Commercial focus. Overwhelming.                       |
| **React Icons** | 50,000+ | Varies            | Meta-library. Imports from multiple sources. Loses consistency. |

### What Competitors Use

- **LobeChat** (gold-standard OSS): Lucide + custom Lobe Icons for AI brands
- **OpenAI ChatGPT**: Custom monochromatic outlined icons
- **Anthropic Claude.ai**: Custom design system (Geist agency)

Leaders use custom icon sets or augment standard libraries with brand-specific icons.
The commodity libraries are starting points, not destinations.

## Synthesis

### Table Stakes (Every Library)

- Tree-shaking support
- TypeScript definitions
- React component API
- SVG-based (scalable, stylable)
- 24x24 base grid

### What Leaders Do Differently

- **Multiple weights** for hierarchy and emphasis
- **Fill variants** for active/selected states
- **Consistent visual language** across the product
- **Custom additions** for brand-specific needs (AI model logos, etc.)

### Where This Is Heading

Icon libraries are converging on:

- **Adaptive weights** - thin for subtle, bold for emphasis
- **State variants** - outline inactive, fill active
- **Motion** - animated icons for loading, success, transitions
- **Semantic sets** - icons designed for specific domains (AI, productivity, commerce)

Phosphor's duotone is early exploration of "icons with depth." Expect more libraries to
add second-color/opacity options for warmth without complexity.

## Gap Assessment

### Achievable Now

- Switch to Phosphor with ~2 hours of find-replace migration
- Use weight variants for hierarchy (thin captions, regular UI, bold emphasis)
- Apply Context API for consistent defaults
- Add duotone for selected/active states

### Emerging (6-12 months)

- Animated icon libraries becoming mainstream
- AI-specific icon sets maturing (Lobe Icons pattern)
- Variable icon fonts with weight as continuous property

### Aspirational

- Icons that adapt weight/style based on context automatically
- Design tokens that tie icon weight to semantic emphasis levels

## Recommendation

**For Carmenta, Phosphor is the more interesting choice.** Here's why:

### Alignment with Philosophy

- **Duotone adds warmth** - outline-only feels cold; duotone has depth
- **Weight = emphasis** - thin for whispers, bold for commands, regular for conversation
- **Context API = consistency** - one provider, app-wide visual coherence

### Differentiation

- Everyone uses Lucide. Using Phosphor is a deliberate aesthetic choice.
- More expressive vocabulary for the visual language.

### Practical Benefits

- 4x the icon coverage (less likely to need custom additions)
- Fill + duotone variants handle active states elegantly
- Context Provider simplifies design system enforcement

### The Counterargument

- **Migration cost**: 117 files to update
- **Lucide works fine**: No user has complained about our icons
- **Inertia**: "If it ain't broke..."

### Honest Assessment

If starting fresh: Phosphor, no question.

For an existing codebase with 117 imports: The migration is real work (~2-4 hours with
careful search-replace). The visual improvement is subtle but compounding. Worth it if
we're doing a visual refresh anyway; harder to justify as standalone work.

## Migration Path (If Proceeding)

### Phase 1: Audit (30 min)

- Map current Lucide icons to Phosphor equivalents
- Identify any missing icons (likely <5%)
- Document custom icons we'd need to create

### Phase 2: Infrastructure (15 min)

```bash
pnpm add @phosphor-icons/react
```

Add IconContext provider in root layout:

```tsx
import { IconContext } from "@phosphor-icons/react";

<IconContext.Provider value={{ size: 20, weight: "regular" }}>
  {children}
</IconContext.Provider>;
```

### Phase 3: Migration (1-2 hours)

Systematic find-replace:

```
// Pattern: import { IconName } from "lucide-react"
// Replace: import { IconName } from "@phosphor-icons/react"
```

Most icons have direct equivalents. Handle edge cases manually.

### Phase 4: Enhancement (ongoing)

- Introduce duotone for active states
- Use weight variants for visual hierarchy
- Build component library patterns around Phosphor API

### Phase 5: Cleanup

```bash
pnpm remove lucide-react
```

## Architecture Decisions

### Open Questions

- [ ] Is visual differentiation worth migration effort right now?
- [ ] Should we wait for a broader visual refresh to batch this work?
- [ ] Do we need custom AI model icons (like Lobe Icons)?

### When Decided, Record Here

_Decisions will be marked with checkmarks when made._

## Sources

- [Lucide Official](https://lucide.dev/) - current library
- [Lucide Comparison](https://lucide.dev/guide/comparison) - vs Feather
- [Phosphor Icons](https://phosphoricons.com/) - recommended alternative
- [Phosphor React](https://github.com/phosphor-icons/react) - React package
- [shadcn/ui Icon Discussion](https://github.com/shadcn-ui/ui/discussions/2603)
- [Comparing Icon Libraries for shadcn/ui](https://www.shadcndesign.com/blog/comparing-icon-libraries-shadcn-ui)
- [Tabler Icons](https://tabler.io/icons)
- [Heroicons](https://heroicons.com/)
- [Hugeicons](https://hugeicons.com/)
- [Radix Icons](https://www.radix-ui.com/icons)
- [Lobe Icons](https://icons.lobehub.com/) - AI brand icons
- [LobeChat UI Icon Component](https://ui.lobehub.com/components/icon)
