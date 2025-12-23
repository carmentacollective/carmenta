/**
 * Carmenta Motion Design System
 *
 * Standardized animation presets following the "speed of thought" philosophy.
 * Animations should feel instant, provide feedback, guide attention, and respect user intent.
 *
 * Philosophy:
 * - < 100ms: Feels instant (button press, toggle)
 * - 100-300ms: Feels responsive (transitions, fades)
 * - 300-500ms: Feels deliberate (modals, major state changes)
 * - > 500ms: Feels slow (avoid unless critical)
 */

import type { Variants } from "framer-motion";

/**
 * Standard durations in seconds
 */
export const duration = {
    instant: 0,
    quick: 0.15,
    standard: 0.2,
    slow: 0.3,
    deliberate: 0.5,
} as const;

/**
 * Easing functions
 *
 * expo: Professional, modern feel - use for most UI transitions
 * cubic: Smooth, natural - use for background animations
 */
export const ease = {
    expo: [0.16, 1, 0.3, 1] as const,
    cubic: [0.4, 0, 0.2, 1] as const,
} as const;

/**
 * Spring physics configurations
 *
 * snappy: Quick, responsive (300-400 stiffness, 20-30 damping)
 * natural: Smooth with slight bounce (damping: 25, stiffness: 300)
 * gentle: Soft, flowing (100-200 stiffness, 30-40 damping)
 */
export const spring = {
    snappy: { type: "spring" as const, stiffness: 400, damping: 30 },
    natural: { type: "spring" as const, stiffness: 300, damping: 25 },
    gentle: { type: "spring" as const, stiffness: 200, damping: 40 },
} as const;

/**
 * Standard transitions
 */
export const transitions = {
    instant: { duration: duration.instant },
    quick: { duration: duration.quick, ease: ease.expo },
    standard: { duration: duration.standard, ease: ease.expo },
    slow: { duration: duration.slow, ease: ease.expo },
    spring: spring.natural,
    snappy: spring.snappy,
    gentle: spring.gentle,
} as const;

/**
 * Reusable animation variants for common patterns
 */
export const variants = {
    /**
     * Simple fade in/out
     * Usage: Message reveals, notifications
     */
    fadeIn: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
    } satisfies Variants,

    /**
     * Slide up with fade (entrance from below)
     * Usage: Toasts, success messages
     */
    slideUp: {
        initial: { y: 20, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: -20, opacity: 0 },
    } satisfies Variants,

    /**
     * Slide down with fade (entrance from above)
     * Usage: Dropdown menus, tooltips
     */
    slideDown: {
        initial: { y: -20, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: 20, opacity: 0 },
    } satisfies Variants,

    /**
     * Slide from left (drawer entrance)
     * Usage: Sidebars, navigation drawers
     */
    slideFromLeft: {
        initial: { x: "-100%", opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: "-100%", opacity: 0 },
    } satisfies Variants,

    /**
     * Slide from right (drawer entrance)
     * Usage: Side panels, detail views
     */
    slideFromRight: {
        initial: { x: "100%", opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: "100%", opacity: 0 },
    } satisfies Variants,

    /**
     * Scale with fade (modal entrance)
     * Usage: Modals, dialogs, command palette
     */
    scaleIn: {
        initial: { scale: 0.95, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        exit: { scale: 0.95, opacity: 0 },
    } satisfies Variants,

    /**
     * Expand/collapse (height animation optimized)
     * Usage: Accordions, expandable sections
     *
     * Note: Uses max-height instead of height: auto to avoid layout thrashing
     * Set a generous max-height on the element (e.g., 1000px)
     */
    expandCollapse: {
        initial: { maxHeight: 0, opacity: 0 },
        animate: { maxHeight: 1000, opacity: 1 },
        exit: { maxHeight: 0, opacity: 0 },
    } satisfies Variants,

    /**
     * Rotate chevron/arrow (expand indicator)
     * Usage: Expandable sections, dropdowns
     */
    rotateChevron: {
        collapsed: { rotate: 0 },
        expanded: { rotate: 90 },
    } satisfies Variants,

    /**
     * Button press (micro-interaction)
     * Usage: Buttons, clickable cards
     */
    buttonPress: {
        rest: { scale: 1 },
        hover: { scale: 1.02 },
        tap: { scale: 0.98 },
    } satisfies Variants,

    /**
     * Breathing/pulsing effect
     * Usage: Loading states, attention indicators
     */
    breathe: {
        animate: {
            scale: [1, 1.05, 1],
            opacity: [1, 0.8, 1],
        },
    } satisfies Variants,
} as const;

/**
 * Stagger children animations
 *
 * Usage with AnimatePresence:
 * ```tsx
 * <motion.ul variants={staggerContainer} initial="initial" animate="animate">
 *   <motion.li variants={staggerItem}>Item 1</motion.li>
 *   <motion.li variants={staggerItem}>Item 2</motion.li>
 * </motion.ul>
 * ```
 */
export const stagger = {
    container: {
        initial: {},
        animate: {
            transition: {
                staggerChildren: 0.05,
            },
        },
    } satisfies Variants,
    item: {
        initial: { y: 10, opacity: 0 },
        animate: { y: 0, opacity: 1 },
    } satisfies Variants,
} as const;
