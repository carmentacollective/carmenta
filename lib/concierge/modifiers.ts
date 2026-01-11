/**
 * Modifier Parser for explicit user overrides.
 *
 * Parses #modifiers from user messages to determine explicit routing overrides.
 * These take highest priority over concierge's natural language understanding.
 *
 * Supported modifiers:
 * - Model: #opus, #sonnet, #haiku, #grok, #gemini
 * - Reasoning: #ultrathink (max depth), #quick (fast mode)
 * - Temperature: #creative (high), #precise (low)
 */

import type { ExplicitOverrides } from "./types";

/**
 * Model modifier mappings to model IDs.
 */
const MODEL_MODIFIERS: Record<string, string> = {
    opus: "anthropic/claude-opus-4.5",
    sonnet: "anthropic/claude-sonnet-4.5",
    haiku: "anthropic/claude-haiku-4.5",
    grok: "x-ai/grok-4.1-fast",
    gemini: "google/gemini-3-pro-preview",
};

/**
 * Reasoning modifier mappings.
 */
const REASONING_MODIFIERS = ["ultrathink", "quick"] as const;

/**
 * Temperature modifier mappings.
 */
const TEMPERATURE_MODIFIERS = ["creative", "precise"] as const;

/**
 * Result of parsing modifiers from a message.
 */
export interface ParsedModifiers {
    /** Model ID if a model modifier was found */
    model?: string;
    /** Raw model modifier name (e.g., "opus") */
    modelModifier?: string;
    /** Reasoning modifier */
    reasoning?: "ultrathink" | "quick";
    /** Temperature modifier */
    temperature?: "creative" | "precise";
    /** All raw modifier strings found (for stripping from message) */
    rawModifiers: string[];
}

/**
 * Parse #modifiers from a message.
 *
 * Case-insensitive matching. Returns the first valid modifier of each type
 * if multiple are present (e.g., #opus #sonnet → uses #opus).
 *
 * @param message - The user message to parse
 * @returns Parsed modifiers with model IDs and settings
 */
export function parseModifiers(message: string): ParsedModifiers {
    const result: ParsedModifiers = { rawModifiers: [] };

    // Match all hashtag words (case-insensitive)
    const hashtagRegex = /#(\w+)/gi;
    let match;

    while ((match = hashtagRegex.exec(message)) !== null) {
        const modifier = match[1].toLowerCase();
        const fullMatch = match[0]; // e.g., "#opus"

        // Check model modifiers
        if (!result.model && modifier in MODEL_MODIFIERS) {
            result.model = MODEL_MODIFIERS[modifier];
            result.modelModifier = modifier;
            result.rawModifiers.push(fullMatch);
        }

        // Check reasoning modifiers
        if (
            !result.reasoning &&
            REASONING_MODIFIERS.includes(
                modifier as (typeof REASONING_MODIFIERS)[number]
            )
        ) {
            result.reasoning = modifier as "ultrathink" | "quick";
            result.rawModifiers.push(fullMatch);
        }

        // Check temperature modifiers
        if (
            !result.temperature &&
            TEMPERATURE_MODIFIERS.includes(
                modifier as (typeof TEMPERATURE_MODIFIERS)[number]
            )
        ) {
            result.temperature = modifier as "creative" | "precise";
            result.rawModifiers.push(fullMatch);
        }
    }

    return result;
}

/**
 * Strip modifiers from a message.
 *
 * Removes the modifier hashtags but preserves the rest of the message.
 * Cleans up extra whitespace from removal.
 *
 * @param message - Original message
 * @param modifiers - Parsed modifiers to strip
 * @returns Message with modifiers removed
 */
export function stripModifiers(message: string, modifiers: ParsedModifiers): string {
    let result = message;

    for (const raw of modifiers.rawModifiers) {
        // Escape the hashtag for regex
        const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // Remove modifier and any trailing whitespace
        result = result.replace(new RegExp(`${escaped}\\s*`, "gi"), "");
    }

    // Clean up leading/trailing whitespace
    return result.trim();
}

/**
 * Build ExplicitOverrides from parsed modifiers for ConciergeResult.
 *
 * @param parsed - Parsed modifiers from the message
 * @param honored - Which overrides were actually honored (may differ if conflicts)
 * @returns ExplicitOverrides for UI feedback
 */
export function buildExplicitOverrides(
    parsed: ParsedModifiers,
    honored: { model?: string; reasoning?: boolean; temperature?: number }
): ExplicitOverrides | undefined {
    const overrides: ExplicitOverrides = {};
    let hasOverrides = false;

    if (parsed.modelModifier) {
        overrides.model = {
            requested: parsed.modelModifier,
            honored: honored.model === parsed.model,
        };
        hasOverrides = true;
    }

    if (parsed.reasoning) {
        overrides.reasoning = {
            requested: parsed.reasoning,
            honored:
                parsed.reasoning === "ultrathink"
                    ? honored.reasoning === true
                    : honored.reasoning === false,
        };
        hasOverrides = true;
    }

    if (parsed.temperature) {
        const isCreative = parsed.temperature === "creative";
        const targetRange = isCreative ? [0.7, 1.0] : [0.0, 0.3];
        const actualTemp = honored.temperature ?? 0.5;
        const tempHonored =
            actualTemp >= targetRange[0] && actualTemp <= targetRange[1];

        overrides.temperature = {
            requested: parsed.temperature,
            honored: tempHonored,
        };
        hasOverrides = true;
    }

    return hasOverrides ? overrides : undefined;
}

/**
 * Get user signals from parsed modifiers for ConciergeInput.
 *
 * Converts parsed modifiers into the userSignals format expected by the concierge.
 *
 * @param parsed - Parsed modifiers
 * @returns UserSignals object for ConciergeInput
 */
export function getUserSignalsFromModifiers(parsed: ParsedModifiers): {
    requestedModel?: string;
    requestedTemperature?: number;
    requestedReasoning?: string;
    hints?: string[];
} {
    const signals: {
        requestedModel?: string;
        requestedTemperature?: number;
        requestedReasoning?: string;
        hints?: string[];
    } = {};

    if (parsed.model) {
        signals.requestedModel = parsed.model;
    }

    if (parsed.reasoning) {
        signals.requestedReasoning = parsed.reasoning;
    }

    if (parsed.temperature) {
        // Map to actual temperature values
        signals.requestedTemperature = parsed.temperature === "creative" ? 0.85 : 0.15;
    }

    // Add raw modifiers as hints for the concierge prompt
    if (parsed.rawModifiers.length > 0) {
        signals.hints = [`User used modifiers: ${parsed.rawModifiers.join(", ")}`];
    }

    return signals;
}
