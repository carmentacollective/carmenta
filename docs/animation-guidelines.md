# Carmenta Animation Guidelines

## Philosophy

Carmenta is about "speed of thought" - animations should feel instant, provide feedback,
guide attention, and respect user intent.

### Animation Timing

- **< 100ms**: Feels instant (button press, toggle)
- **100-300ms**: Feels responsive (transitions, fades) ← Most common
- **300-500ms**: Feels deliberate (modals, major state changes)
- **> 500ms**: Feels slow (avoid unless critical)

## Motion Design System

We have a standardized motion design system at `/lib/motion/presets.ts` with reusable
transitions, variants, and utilities.

### Standard Durations

```typescript
import { duration } from "@/lib/motion/presets";

duration.instant; // 0ms - no animation
duration.quick; // 150ms - micro-interactions
duration.standard; // 200ms - most UI transitions
duration.slow; // 300ms - deliberate actions
duration.deliberate; // 500ms - major state changes
```

### Easing Functions

```typescript
import { ease } from "@/lib/motion/presets";

ease.expo; // [0.16, 1, 0.3, 1] - Professional, modern feel (use for most UI)
ease.cubic; // [0.4, 0, 0.2, 1] - Smooth, natural (use for background animations)
```

### Spring Physics

```typescript
import { spring } from "@/lib/motion/presets";

spring.snappy; // Quick, responsive (stiffness: 400, damping: 30)
spring.natural; // Smooth with slight bounce (stiffness: 300, damping: 25)
spring.gentle; // Soft, flowing (stiffness: 200, damping: 40)
```

### Reusable Variants

```typescript
import { variants } from "@/lib/motion/presets";

// Common patterns:
variants.fadeIn; // Simple opacity transition
variants.slideUp; // Slide from below with fade
variants.slideDown; // Slide from above with fade
variants.slideFromLeft; // Drawer entrance from left
variants.slideFromRight; // Drawer entrance from right
variants.scaleIn; // Modal/dialog entrance
variants.expandCollapse; // Accordion animation (uses max-height for performance)
variants.rotateChevron; // Expand indicator rotation
variants.buttonPress; // Button micro-interaction
variants.breathe; // Pulsing effect for loading states
```

## Accessibility: Reduced Motion

**CRITICAL**: All animations MUST respect `prefers-reduced-motion`.

### Using the Hook

```typescript
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion"
import { transitions } from "@/lib/motion/presets"

function Component() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      animate={{ x: 100 }}
      transition={shouldReduceMotion ? transitions.instant : transitions.standard}
    />
  )
}
```

### Helper Functions

```typescript
import { getTransition, reduceMotion } from "@/lib/motion/presets"

// For transitions:
transition={getTransition(transitions.standard, shouldReduceMotion)}

// For variants:
variants={shouldReduceMotion ? reduceMotion(variants.slideUp) : variants.slideUp}
```

## Performance Best Practices

### GPU-Accelerated Properties

✅ **Animate these** (GPU-accelerated):

- `x`, `y` (transforms)
- `scale`
- `rotate`
- `opacity`

❌ **Avoid animating**:

- `width`, `height` (causes layout thrashing)
- `top`, `left`, `right`, `bottom` (use `x`/`y` instead)
- `padding`, `margin` (use scale/transform instead)

### Expand/Collapse Pattern

**❌ Bad** (causes layout thrashing):

```typescript
<motion.div
  initial={{ height: 0 }}
  animate={{ height: "auto" }}
/>
```

**✅ Good** (uses max-height):

```typescript
import { variants } from "@/lib/motion/presets"

<motion.div
  variants={variants.expandCollapse}
  initial="initial"
  animate="animate"
  exit="exit"
/>
```

### Infinite Animations

For animations with `repeat: Infinity`, consider pausing when off-screen:

```typescript
// TODO: Add Intersection Observer example when implemented
```

## Common Patterns

### Button Micro-Interactions

```typescript
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={transitions.quick}
>
  Click me
</motion.button>
```

### Modal/Dialog Entrance

```typescript
import { AnimatePresence } from "framer-motion"
import { variants, transitions } from "@/lib/motion/presets"

<AnimatePresence>
  {isOpen && (
    <motion.div
      variants={variants.scaleIn}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transitions.standard}
    >
      Modal content
    </motion.div>
  )}
</AnimatePresence>
```

### Staggered List Items

```typescript
import { stagger } from "@/lib/motion/presets"

<motion.ul
  variants={stagger.container}
  initial="initial"
  animate="animate"
>
  {items.map(item => (
    <motion.li
      key={item.id}
      variants={stagger.item}
    >
      {item.content}
    </motion.li>
  ))}
</motion.ul>
```

### Toast Notifications

```typescript
import { variants } from "@/lib/motion/presets"

<AnimatePresence>
  {showToast && (
    <motion.div
      variants={variants.slideUp}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      Toast message
    </motion.div>
  )}
</AnimatePresence>
```

## Examples in the Codebase

### Copy Button (`components/ui/copy-button.tsx`)

- Uses `useReducedMotion` hook
- Applies `transitions.quick` for feedback animation
- Respects accessibility preferences

### KB Sidebar (`components/knowledge-viewer/kb-sidebar.tsx`)

- Uses `variants.rotateChevron` for expand indicator
- Fixed height animation to use `max-height` (no layout thrashing)
- Proper reduced motion support

## Testing

### Visual Testing

- Test all animations at 60fps (use browser DevTools Performance tab)
- Verify no jank or layout shifts during animations

### Accessibility Testing

1. Enable "Reduce motion" in system preferences:
   - **macOS**: System Preferences → Accessibility → Display → Reduce motion
   - **Windows**: Settings → Ease of Access → Display → Show animations
   - **Browser DevTools**: Rendering → Emulate CSS media feature
     `prefers-reduced-motion`
2. Verify all animations become instant (no movement)
3. Ensure functionality still works without animations

### Performance Testing

```bash
# Run Lighthouse audit
npm run lighthouse

# Check for layout thrashing in DevTools
# Performance tab → Look for purple "Recalculate Style" bars
```

## Migration Checklist

When updating existing animations:

- [ ] Import `useReducedMotion` hook
- [ ] Add `shouldReduceMotion` check
- [ ] Use `transitions.*` from presets
- [ ] Use `variants.*` for common patterns
- [ ] Replace `height: auto` with `maxHeight: 1000`
- [ ] Ensure only GPU-accelerated properties are animated
- [ ] Test with reduced motion enabled

## Questions?

See `/lib/motion/presets.ts` for the full API and examples.
