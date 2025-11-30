/**
 * Concierge types for model routing decisions.
 *
 * The Concierge analyzes incoming requests and determines the optimal model
 * and temperature settings before the main LLM call.
 */

/**
 * Result returned by the Concierge after analyzing a request.
 */
export interface ConciergeResult {
    /** The selected model ID (OpenRouter format: provider/model-name) */
    modelId: string;

    /** Temperature setting for the LLM call (0.0 to 1.0) */
    temperature: number;

    /** One sentence explaining why this model was chosen - displayed to the user */
    reasoning: string;
}

/**
 * Default fallback values if concierge fails.
 */
export const CONCIERGE_DEFAULTS: ConciergeResult = {
    modelId: "anthropic/claude-sonnet-4.5",
    temperature: 0.5,
    reasoning: "Using our balanced default model.",
};

/**
 * The model used to run the Concierge itself.
 * Haiku 4.5 is fast and capable enough for routing decisions.
 */
export const CONCIERGE_MODEL = "anthropic/claude-haiku-4.5";

/**
 * Whitelist of allowed models the concierge can select.
 * Prevents routing to unexpected or expensive models.
 */
export const ALLOWED_MODELS = [
    "anthropic/claude-opus-4.5",
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-haiku-4.5",
    "google/gemini-3-pro-preview",
    "x-ai/grok-4-fast",
] as const;

/**
 * Maximum length for reasoning text.
 * Prevents excessive header sizes and potential injection.
 */
export const MAX_REASONING_LENGTH = 500;
