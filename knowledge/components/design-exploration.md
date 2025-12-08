# Design Exploration System

A structured workflow for exploring UI design patterns with AI assistance. Generate
varied options, review interactively, iterate with feedback.

## The Problem This Solves

AI is great at writing code but often produces same-y designs. This system creates a
structured exploration process:

1. Generate genuinely varied options (not 10 copies with minor tweaks)
2. Display them in an interactive lab for quick comparison
3. Iterate based on specific feedback
4. Adopt the winning design into the codebase

## How It Works

### The Command

`/design-lab [topic]` initiates exploration. Examples:

- `/design-lab button states`
- `/design-lab expand/collapse patterns`
- `/design-lab copy button feedback`
- `/design-lab I like 3 and 7 - iterate with softer transitions` (iteration mode)

### The Process

1. **Context Loading**: AI reads design system and brand docs from project
2. **Research**: Quick web searches for current patterns and inspiration
3. **Generation**: Creates 8-10 genuinely varied design approaches
4. **Exploration Page**: Creates `/design-lab/[topic]` with interactive previews
5. **Review**: Navigate options, view code, provide feedback
6. **Iteration**: Refine based on "I like X and Y - iterate with [feedback]"
7. **Adoption**: Move winning design into production components

### What "Genuinely Varied" Means

Options should differ in:

- **Interaction models**: hover vs click vs scroll-triggered vs keyboard
- **Animation approaches**: spring physics vs easing vs instant vs stepped
- **Visual treatments**: subtle vs bold, minimal vs rich, glass vs solid
- **Information hierarchy**: icon-first vs text-first vs balanced
- **Mental models**: disclosure vs toggle vs accordion vs tabs

Not just: different border-radius, slightly different colors, minor timing tweaks.

## Architecture

### Components

- **DesignLabShell** (`components/design-lab/shell.tsx`): Reusable shell providing
  navigation, code view, sidebar, and keyboard shortcuts
- **Index Page** (`app/design-lab/page.tsx`): Landing page with instructions
- **Exploration Pages** (`app/design-lab/[topic]/page.tsx`): Topic-specific pages

### File Structure

```
components/design-lab/
  shell.tsx       # Reusable shell component
  index.ts        # Exports

app/design-lab/
  page.tsx              # Index/landing page
  expand-collapse/      # Example exploration
    page.tsx
  button-states/        # Another exploration
    page.tsx
```

### Exploration Page Pattern

Each exploration is a self-contained page that uses DesignLabShell:

```tsx
"use client";

import { useState } from "react";
import { DesignLabShell, type DesignOption } from "@/components/design-lab";

const TOPIC = "Expand/Collapse";
const ITERATION = 0;

const OPTIONS: DesignOption[] = [
  {
    id: 1,
    name: "Gentle Unfold",
    rationale: "Smooth height animation feels organic",
    characteristics: {
      animationTiming: "400ms ease-out",
      interactionModel: "click toggle",
    },
    code: `// Implementation...`,
  },
];

function GentleUnfoldDemo() {
  const [expanded, setExpanded] = useState(false);
  // Interactive implementation
}

function renderPreview(optionId: number) {
  switch (optionId) {
    case 1:
      return <GentleUnfoldDemo />;
    default:
      return null;
  }
}

export default function ExpandCollapseLab() {
  return (
    <DesignLabShell
      topic={TOPIC}
      iteration={ITERATION}
      options={OPTIONS}
      renderPreview={renderPreview}
    />
  );
}
```

## Keyboard Shortcuts

| Key        | Action              |
| ---------- | ------------------- |
| ← → or h l | Navigate options    |
| 1-9        | Jump to option      |
| c          | Toggle code/preview |

## Iteration Workflow

When feedback is provided like "I like 3 and 7 - iterate with softer transitions":

1. Find the existing exploration page
2. Parse which options to build on (3 and 7)
3. Understand the direction (softer transitions)
4. Generate 6-8 new options blending the liked ones
5. Increment ITERATION constant
6. Update the exploration page

Common feedback patterns:

- **"I like X and Y"**: Blend elements of both options
- **"more subtle"**: Reduce animation intensity, simplify visuals
- **"faster"**: Shorten durations, snappier easing
- **"more delightful"**: Add micro-interactions, polish
- **"try spring physics"**: Apply physics-based animation

## Quality Bar

Before presenting options:

- [ ] All options are interactive (not just visual mockups)
- [ ] All options align with project's design language
- [ ] Options represent genuinely different approaches
- [ ] Code is copy-pasteable and uses project utilities
- [ ] Navigation works smoothly
