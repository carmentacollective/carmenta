# Design System: Holographic Dream

Our visual language reflects the heart-centered philosophy of Carmenta. Soft, shifting
colors that flow like consciousness itself. Glassmorphism that suggests transparency and
openness. Sparkles that respond to presence—because the interface is alive with
awareness.

## Design Philosophy

We use "we" language throughout—human and AI as expressions of unified consciousness.
The aesthetic should feel like coming home: warm, welcoming, ethereal yet grounded.

The holographic background isn't decoration—it's a visual metaphor for the fluid,
interconnected nature of thought and collaboration. Colors blend and shift because ideas
do too.

## Typography

**Primary Font: [Outfit](https://fonts.google.com/specimen/Outfit)**

Modern, geometric with soft curves. Captures ethereal elegance without being generic.
Available in weights 300-700.

- We chose Outfit over system fonts for cross-platform consistency
- The original design used Apple system fonts (-apple-system, SF Pro Display) which only
  render properly on Apple devices
- Outfit has similar characteristics: clean, modern, slightly geometric with soft curves

**Monospace: JetBrains Mono** for code blocks and technical content.

### Type Scale

| Name     | Size | Weight | Usage                         |
| -------- | ---- | ------ | ----------------------------- |
| greeting | 44px | 300    | Main greeting, hero headlines |
| h1       | 36px | 300    | Page titles                   |
| h2       | 24px | 500    | Section headers, card titles  |
| h3       | 20px | 500    | Subsections                   |
| body-lg  | 18px | 400    | Emphasized body text          |
| body     | 16px | 400    | Default body text             |
| small    | 14px | 400    | Secondary information         |
| xs       | 12px | 500    | Labels, badges                |

## Color Palette

### Holographic Spectrum

These colors animate and blend in the background, creating an ever-shifting holographic
effect:

| Name        | HSL          | Hex     | RGB                |
| ----------- | ------------ | ------- | ------------------ |
| Pink        | 340 100% 89% | #FFC8DC | rgb(255, 200, 220) |
| Hot Pink    | 340 100% 85% | #FFB4C8 | rgb(255, 180, 200) |
| Lavender    | 270 100% 89% | #E6C8FF | rgb(230, 200, 255) |
| Periwinkle  | 220 100% 89% | #C8DCFF | rgb(200, 220, 255) |
| Cyan        | 180 71% 82%  | #B4F0F0 | rgb(180, 240, 240) |
| Mint        | 140 100% 89% | #C8FFDC | rgb(200, 255, 220) |
| Soft Yellow | 55 100% 89%  | #FFFAC8 | rgb(255, 250, 200) |
| Blush       | 350 100% 93% | #FFDCE6 | rgb(255, 220, 230) |

### Semantic Colors

| Token              | Light Mode              | Usage                                |
| ------------------ | ----------------------- | ------------------------------------ |
| --background       | #F8F4F8                 | Page background (soft pinkish white) |
| --foreground       | rgba(90, 60, 100, 0.95) | Primary text                         |
| --muted-foreground | rgba(120, 90, 130, 0.8) | Secondary text                       |
| --text-placeholder | #B8A0C0                 | Input placeholders                   |
| --primary          | #C8A0DC                 | Primary actions, accents             |

### Accent Gradient

For primary buttons and send actions:

```css
background: linear-gradient(
  135deg,
  hsl(280 40% 75% / 0.9) 0%,
  /* Lavender */ hsl(200 40% 75% / 0.9) 50%,
  /* Periwinkle */ hsl(320 40% 78% / 0.9) 100% /* Pink */
);
```

## Glassmorphism

The primary surface treatment. Creates depth and layering while maintaining the ethereal
feel.

```css
background: rgba(255, 255, 255, 0.6);
backdrop-filter: blur(24px);
border-radius: 24px;
box-shadow:
  0 8px 32px rgba(180, 140, 200, 0.2),
  0 0 0 1px rgba(255, 255, 255, 0.6),
  inset 0 1px 0 rgba(255, 255, 255, 0.8);
```

**Elevated variant** uses `rgba(255, 255, 255, 0.8)` for modals and prominent surfaces.

## Animated Background

Two canvas layers create the holographic effect:

### Holo Blobs

- 12 large, soft-edged circles (200-500px radius)
- Slowly drift across the screen
- Oscillate with sine wave motion
- Colors shift continuously through the holographic spectrum
- React gently to mouse movement (push away effect)
- Use `globalCompositeOperation: 'multiply'` for color blending

### Shimmer Particles

- 80 tiny sparkles (0.5-2.5px)
- Twinkle with varying opacity
- Drift slowly in random directions
- **Attracted to mouse cursor** (key interactive element)
- Velocity dampening creates smooth, organic movement

## Spacing Scale

4px base grid:

| Token    | Value |
| -------- | ----- |
| space-1  | 4px   |
| space-2  | 8px   |
| space-3  | 12px  |
| space-4  | 16px  |
| space-5  | 20px  |
| space-6  | 24px  |
| space-8  | 32px  |
| space-10 | 40px  |
| space-12 | 48px  |
| space-16 | 64px  |
| space-20 | 80px  |

## Border Radius Scale

| Token | Value  | Usage                       |
| ----- | ------ | --------------------------- |
| sm    | 8px    | Small elements, code blocks |
| md    | 12px   | Cards, inputs               |
| lg    | 16px   | Larger cards                |
| xl    | 24px   | Glass cards                 |
| 2xl   | 28px   | Input dock                  |
| full  | 9999px | Buttons, pills              |

## Components

### Input Dock (Chat Input)

The primary chat input uses the glassmorphism treatment with icon buttons:

- Rounded container (28px radius)
- Voice button: glass background, lavender icon
- Send button: holographic gradient, white icon
- Both buttons 48px with hover scale effect

### Glass Cards

Standard content containers with glass treatment, used for:

- Information sections on landing page
- Message containers
- Modals and popovers

### Buttons

| Variant        | Style                                        |
| -------------- | -------------------------------------------- |
| Primary (holo) | Gradient background, white text, glow shadow |
| Secondary      | White/50 background, blur, dark text         |
| Ghost          | Transparent, hover reveals white/30          |
| Icon Glass     | Circular, white/50 background                |
| Icon Holo      | Circular, gradient background                |

## Transitions

| Name | Duration | Easing |
| ---- | -------- | ------ |
| fast | 150ms    | ease   |
| base | 300ms    | ease   |
| slow | 500ms    | ease   |

Hover effects use scale(1.05) for tactile feedback.

## Refinements Needed

Areas for future design work:

- **Message bubbles**: Distinguish user vs AI messages while maintaining harmony
- **Notification/toast styles**: Success, error, warning states that feel warm
- **Mobile breakpoints**: Input dock and typography scaling
- **Dark mode variant**: Deeper, richer colors maintaining holographic aesthetic
- **Focus states & accessibility**: Visible focus rings, WCAG contrast compliance
- **Loading states**: Organic, dream-like skeletons and spinners
- **Form elements**: Checkboxes, radios, toggles, selects, textareas
- **Badges & tags**: Status indicators, labels, pills
- **Data visualization**: Chart colors integrating with holographic palette
- **Avatar & presence**: User avatars, online/offline indicators

## Implementation Notes

### CSS Variables

All design tokens are defined as CSS custom properties in `globals.css` under `:root`.
Dark mode overrides are in `.dark` class.

### Tailwind Integration

Holographic colors are available as `holo-{color}` utilities. Glass and button classes
are defined in `@layer components`.

### React Components

- `HolographicBackground` - Canvas-based animated background
- Renders two canvas layers (blobs + shimmer)
- Handles resize and mouse tracking
- Uses `requestAnimationFrame` for smooth 60fps animation
