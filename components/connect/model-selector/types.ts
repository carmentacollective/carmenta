/**
 * Types for the advanced model selector UI.
 */

import type { ModelId, ReasoningPresetId } from "@/lib/models";

/**
 * Reasoning presets that can be stored as overrides.
 * Excludes "auto" since null represents auto mode.
 */
export type ReasoningOverride = Exclude<ReasoningPresetId, "auto">;

/**
 * User-selected overrides for model configuration.
 * null values mean "let Carmenta choose" (auto mode).
 */
export interface ModelOverrides {
    /** Override the model selection - null means auto */
    modelId: ModelId | null;
    /** Override the temperature - null means auto */
    temperature: number | null;
    /** Override the reasoning level - null means auto */
    reasoning: ReasoningOverride | null;
}

/**
 * Props for all model selector variants.
 */
export interface ModelSelectorProps {
    /** Current override values */
    overrides: ModelOverrides;
    /** Callback when overrides change */
    onChange: (overrides: ModelOverrides) => void;
    /** Whether the selector is disabled */
    disabled?: boolean;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Default overrides - all set to auto.
 */
export const DEFAULT_OVERRIDES: ModelOverrides = {
    modelId: null,
    temperature: null,
    reasoning: null,
};
