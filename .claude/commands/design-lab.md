---
description: Interactive design exploration with varied options and iteration support
---

# Design Lab

Generate varied design options for a UI pattern, display them in an interactive lab,
iterate based on feedback.

<objective>
Create genuinely different design approaches for the specified UI pattern. Generate an
exploration page using the DesignLabShell component. Open the browser for review.
</objective>

<arguments>
$ARGUMENTS contains either:
- A design topic: "expand/collapse patterns", "button states", "copy button feedback"
- Iteration feedback: "I like 3 and 7 - iterate with softer transitions"
</arguments>

<context>
Before generating, look for and read any design-related documentation in the project.
All options should align with the project's existing design language.
</context>

<what-varied-means>
Options should differ in fundamental ways:

- Interaction model: hover vs click vs scroll-triggered vs keyboard
- Animation approach: spring physics vs easing vs instant vs stepped
- Visual treatment: subtle vs bold, minimal vs rich, glass vs solid
- Information hierarchy: icon-first vs text-first vs balanced
- Mental model: disclosure vs toggle vs accordion vs drawer

Not: 10 copies with different border-radius or slightly adjusted timing.
</what-varied-means>

<file-structure>
Create a new exploration page at `app/design-lab/[topic-slug]/page.tsx` where topic-slug
is kebab-case (e.g., "expand-collapse", "button-states").

The page uses the DesignLabShell component from `@/components/design-lab`:

```tsx
"use client";

import { useState } from "react";
import { DesignLabShell, type DesignOption } from "@/components/design-lab";

const TOPIC = "Expand/Collapse Patterns";
const ITERATION = 0;

const OPTIONS: DesignOption[] = [
  {
    id: 1,
    name: "Gentle Unfold",
    rationale: "Smooth height animation with content fade-in feels organic",
    characteristics: {
      animationTiming: "400ms ease-out",
      interactionModel: "click toggle",
      visualStyle: "minimal chrome",
    },
    code: `// Implementation code...`,
  },
  // ... more options
];

function GentleUnfoldDemo() {
  const [expanded, setExpanded] = useState(false);
  return <div className="w-full max-w-md">{/* Interactive implementation */}</div>;
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

Each option needs a corresponding demo component that renders a working interactive
preview. Demo components should be self-contained with their own state.
</file-structure>

<iteration-mode>
When $ARGUMENTS contains "I like", "iterate", or "more like":

1. Find the existing exploration page for the topic
2. Parse which options to build on (the numbers mentioned)
3. Parse the direction (the feedback)
4. Generate 6-8 new options blending the liked ones with the feedback
5. Increment ITERATION constant
6. Update the existing page </iteration-mode>

<research>
Before generating, do 2-3 quick web searches for current patterns and inspiration.
Gather ideas, then generate.
</research>

<output>
After creating or updating the exploration page, start the dev server if needed and open
the browser to the exploration. Report how many options were generated.
</output>

<example-options>
For "expand/collapse patterns":

Option 1 - "Gentle Unfold": Smooth height animation with content fade-in. 400ms
ease-out, click toggle, minimal chrome.

Option 2 - "Crisp Toggle": Instant state change, no animation. 0ms, click toggle, clear
chevron rotation.

Option 3 - "Springy Reveal": Playful spring physics. spring(1, 80, 10), click toggle,
bouncy overshoot.

Option 4 - "Hover Peek": Content previews on hover, expands on click. Two-stage
interaction, progressive disclosure.

Option 5 - "Slide Drawer": Horizontal slide from edge. 300ms ease-in-out, panel
aesthetic, shadow depth.

Option 6 - "Accordion Stack": Only one section open at a time. Mutex behavior, vertical
rhythm maintained.

Option 7 - "Blur Reveal": Content starts blurred, sharpens as it expands. 500ms,
ethereal feel.

Option 8 - "Scale Pop": Content scales from 0.9 to 1 with opacity. Quick 200ms, punchy
feel. </example-options>
