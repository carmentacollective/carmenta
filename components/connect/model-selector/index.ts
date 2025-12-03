/**
 * Model Selector Variants
 *
 * UI approaches for advanced model selection.
 */

export * from "./types";

// Variant 1: Floating Action Button with popover
export { ModelSelectorFAB } from "./variant-fab";

// Variant 2: Inline Collapsible Panel
export { ModelSelectorCollapsible } from "./variant-collapsible";

// Variant 3: Bottom Drawer (Mobile-First)
export { ModelSelectorDrawer } from "./variant-drawer";

// Variant 4: Compact Pills/Chips
export { ModelSelectorPills } from "./variant-pills";

// Variant 5: Command Palette Style
export { ModelSelectorCommand } from "./variant-command";

// Variant 6: Composer Button (refined, next to send button)
export { ModelSelectorComposerButton } from "./variant-composer-button";

// New: Model Selector Popover with stepped sliders
export { ModelSelectorPopover } from "./model-selector-popover";

// Building blocks
export { SteppedSlider } from "./stepped-slider";
