/**
 * Theme Selector Schema
 *
 * Type definitions for the inline theme selector component
 * used during onboarding.
 */

import type { ThemeVariant } from "@/lib/theme/theme-context";

export interface ThemeOption {
    value: ThemeVariant;
    label: string;
    description: string;
}

export interface ThemeSelectorProps {
    /** Unique identifier for this component instance */
    id: string;
    /** Currently selected theme (controlled) */
    value?: ThemeVariant;
    /** Default theme if uncontrolled */
    defaultValue?: ThemeVariant;
    /** The confirmed/final selection (shows receipt mode) */
    confirmed?: ThemeVariant | null;
    /** Called when selection changes */
    onChange?: (theme: ThemeVariant) => void;
    /** Called when user confirms selection */
    onConfirm?: (theme: ThemeVariant) => Promise<void>;
    /** Additional class names */
    className?: string;
}
