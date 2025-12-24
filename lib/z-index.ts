/**
 * Z-Index Hierarchy Documentation
 *
 * This file documents our semantic z-index system. The actual values are defined
 * in tailwind.config.ts and used via Tailwind classes (z-content, z-modal, etc.).
 *
 * ## Stacking Order (bottom to top)
 *
 * | Class       | Value | Purpose                                    |
 * |-------------|-------|-------------------------------------------|
 * | z-base      | 0     | Default, background elements              |
 * | z-content   | 10    | Page content, relatively positioned items |
 * | z-sticky    | 20    | Sticky headers, sidebars                  |
 * | z-dropdown  | 30    | Dropdown menus, select options            |
 * | z-backdrop  | 40    | Modal/drawer backdrop overlays            |
 * | z-modal     | 50    | Modals, dialogs, drawers, popovers        |
 * | z-tooltip   | 50    | Tooltips (same level as modals)           |
 * | z-toast     | 60    | Toast notifications (always visible)      |
 *
 * ## Usage Guidelines
 *
 * **z-content**: Use for page wrappers and elements that need to sit above the
 * base layer but below any overlays. Most relatively positioned content uses this.
 *
 * **z-sticky**: Reserved for sticky/fixed UI elements like headers and sidebars
 * that persist during scroll but should go behind overlays.
 *
 * **z-dropdown**: For dropdown menus that appear inline with content. These sit
 * above sticky elements but below modal backdrops.
 *
 * **z-backdrop**: The semi-transparent overlay behind modals. Always pair with
 * z-modal for the content that sits on top.
 *
 * **z-modal**: Modals, dialogs, popovers, and drawers. Content that demands focus
 * and blocks interaction with the page below.
 *
 * **z-tooltip**: Tooltips use the same level as modals. For tooltips inside modals,
 * stacking context ensures they appear correctly without needing higher values.
 *
 * **z-toast**: Toast notifications always appear above everything else so users
 * see important feedback even when a modal is open.
 *
 * ## Stacking Contexts
 *
 * Remember: z-index values only compete within the same stacking context.
 * Radix primitives (Dialog, Popover, etc.) portal to <body>, creating their own
 * stacking contexts and avoiding conflicts with page content.
 *
 * ## Adding New Layers
 *
 * Before adding a new z-index value, consider:
 * 1. Does it fit an existing semantic level?
 * 2. Can stacking context isolation solve the problem?
 * 3. Is this truly a new layer in the visual hierarchy?
 *
 * The 10-value gaps between levels allow room for edge cases without restructuring.
 */

export const Z_INDEX = {
    base: 0,
    content: 10,
    sticky: 20,
    dropdown: 30,
    backdrop: 40,
    modal: 50,
    tooltip: 50,
    toast: 60,
} as const;

export type ZIndexLevel = keyof typeof Z_INDEX;
