/**
 * Design Tokens for Carmenta Message Display System
 *
 * Unified styling foundation for glass effects, borders, spacing, and status colors.
 * Import these tokens instead of hardcoding Tailwind classes for consistency.
 */

/**
 * Glass effect hierarchy - three levels of backdrop blur and opacity.
 *
 * Usage:
 * - subtle: Tool containers, secondary surfaces
 * - standard: Cards, interactive elements
 * - prominent: Primary containers, LLM zone
 */
export const glass = {
    subtle: "bg-white/30 dark:bg-black/20 backdrop-blur-sm",
    standard: "bg-white/50 dark:bg-black/30 backdrop-blur-md",
    prominent: "bg-white/60 dark:bg-black/40 backdrop-blur-xl",
} as const;

/**
 * Border treatments for different contexts.
 *
 * Usage:
 * - container: Tool wrappers, cards (all sides)
 * - accent: LLM zone left border, highlights
 * - subtle: Internal dividers between sections
 * - interactive: Hover states on clickable elements
 */
export const border = {
    container: "border border-white/20 dark:border-white/10",
    accent: "border-l-[3px] border-l-cyan-400",
    subtle: "border-t border-foreground/5",
    interactive: "border-border/60",
} as const;

/**
 * Spacing tokens for consistent vertical rhythm.
 *
 * Usage:
 * - toolContent: Inside tool result containers
 * - toolHeader: Tool wrapper headers
 * - inlineResult: Single-line status results
 * - messageContent: Message bubble content
 * - sectionGap: Between sections in LLM zone
 */
export const spacing = {
    toolContent: "p-4",
    toolHeader: "p-3",
    inlineResult: "py-2",
    messageContent: "px-4 py-3",
    sectionGap: "space-y-3",
} as const;

/**
 * Status-specific styling for tool states.
 *
 * Each status has:
 * - bg: Background color for containers
 * - text: Text/icon color
 * - animation: Optional animation class
 *
 * @reserved Currently used by ToolStatusBadge. Will be adopted by more
 * components as the design system matures.
 */
export const status = {
    pending: {
        bg: "bg-muted/50",
        text: "text-muted-foreground",
        animation: "",
    },
    running: {
        bg: "bg-holo-lavender/30",
        text: "text-primary",
        animation: "animate-pulse",
    },
    completed: {
        bg: "bg-holo-mint/30",
        text: "text-emerald-500",
        animation: "",
    },
    error: {
        bg: "bg-holo-blush/50",
        text: "text-destructive",
        animation: "",
    },
} as const;

/**
 * Combined glass + border presets for common patterns.
 *
 * @reserved Convenience presets combining glass + border tokens.
 * Use these for new components to ensure consistent surface styling.
 */
export const surface = {
    /** Tool wrapper container */
    toolContainer: `${glass.subtle} ${border.container} rounded-lg`,

    /** Prominent card (Plan, comparison tables) */
    card: `${glass.standard} ${border.container} rounded-xl`,

    /** Primary content zone (LLM responses) */
    primary: `${glass.prominent} ${border.container} ${border.accent} rounded-2xl rounded-bl-md`,

    /** Inline result (no border, minimal styling) */
    inline: `${glass.subtle} rounded-md`,
} as const;

/**
 * Animation presets for consistent motion.
 *
 * @reserved Standard animations for enter/exit transitions.
 * Adopt these in components using animate-in/animate-out patterns.
 */
export const animation = {
    /** Enter from top with fade */
    enterFromTop: "animate-in fade-in slide-in-from-top-2 duration-200",

    /** Exit to top with fade */
    exitToTop: "animate-out fade-out slide-out-to-top-2 duration-150",

    /** Subtle pulse for loading states */
    pulse: "animate-pulse",

    /** Slow spin for thinking indicators */
    slowSpin: "animate-spin",
} as const;

export type GlassLevel = keyof typeof glass;
export type BorderType = keyof typeof border;
export type SpacingToken = keyof typeof spacing;
export type StatusType = keyof typeof status;
export type SurfacePreset = keyof typeof surface;
