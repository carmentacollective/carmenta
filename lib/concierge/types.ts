/**
 * Concierge types for model routing decisions.
 *
 * The Concierge analyzes incoming requests and determines the optimal model,
 * temperature, and reasoning configuration before the main LLM call.
 */

/**
 * Reasoning effort levels for effort-based models (Grok, OpenAI o-series).
 * Maps to percentage of tokens allocated to internal reasoning.
 */
export type ReasoningEffort = "high" | "medium" | "low" | "none";

/**
 * Lightweight input for the Concierge.
 *
 * Instead of passing the full message array, we extract metadata
 * to reduce token usage and improve routing speed.
 */
export interface ConciergeInput {
    /** Current user message content */
    currentMessage: {
        content: string;
        role: "user";
    };

    /** Recent conversation context for continuity (e.g., "tell me more") */
    recentContext: {
        /** Number of messages in the conversation */
        messageCount: number;
        /** Last assistant message text (truncated) for context */
        lastAssistantMessage?: string;
        /** Last user message text (truncated) for context */
        lastUserMessage?: string;
        /** How many exchanges have occurred */
        conversationDepth: number;
    };

    /** Attachment metadata (type, size, name - NOT content) */
    attachments: Array<{
        type: "image" | "pdf" | "audio" | "video" | "file";
        size?: number;
        name?: string;
        mimeType: string;
    }>;

    /** Context window utilization info */
    contextMetadata: {
        /** Estimated tokens in the conversation */
        estimatedCurrentTokens: number;
        /** Current model being considered */
        currentModel?: string;
        /** Model's context window limit */
        modelContextLimit?: number;
        /** Utilization as a percentage (0-1) */
        utilizationPercent?: number;
    };

    /** User signals/overrides */
    userSignals?: {
        /** User explicitly requested this model */
        requestedModel?: string;
        /** User explicitly requested this temperature */
        requestedTemperature?: number;
        /** User explicitly requested this reasoning level */
        requestedReasoning?: string;
        /** Additional hints from user input */
        hints?: string[];
    };
}

/**
 * Configuration for extended reasoning/thinking.
 *
 * Different models use different mechanisms:
 * - Anthropic Claude: Token budget (1K-32K tokens via maxTokens)
 * - Grok, OpenAI: Effort level (high/medium/low/none)
 *
 * The Concierge determines which config to use based on model selection.
 */
export interface ReasoningConfig {
    /** Whether to enable extended reasoning for this request */
    enabled: boolean;

    /**
     * Effort level for effort-based models (Grok, OpenAI).
     * - high: ~80% of max_tokens for reasoning
     * - medium: ~50% of max_tokens for reasoning
     * - low: ~20% of max_tokens for reasoning
     * - none: disable reasoning
     */
    effort?: ReasoningEffort;

    /**
     * Token budget for token-budget models (Anthropic Claude).
     * Range: 1024-32000 tokens.
     * Higher = deeper reasoning, more cost.
     */
    maxTokens?: number;
}

/**
 * Result returned by the Concierge after analyzing a request.
 */
export interface ConciergeResult {
    /** The selected model ID (OpenRouter format: provider/model-name) */
    modelId: string;

    /** Temperature setting for the LLM call (0.0 to 1.0) */
    temperature: number;

    /** One sentence explaining the model choice - shown to the user */
    explanation: string;

    /** Extended reasoning configuration for this request */
    reasoning: ReasoningConfig;

    /**
     * Generated title for the connection (max 50 chars).
     * Only present on first message - used to create the connection.
     */
    title?: string;

    /**
     * Whether the model was auto-switched due to technical requirements.
     * True when attachments or context overflow force a specific model.
     */
    autoSwitched?: boolean;

    /**
     * Reason for auto-switching, shown to user.
     * Examples:
     * - "Audio file detected - routing to Gemini for native audio processing"
     * - "Conversation exceeds 200K context - switched to GPT-5.2"
     */
    autoSwitchReason?: string;

    /**
     * Context utilization metrics at time of routing.
     * Useful for UI indicators and debugging.
     */
    contextUtilization?: {
        estimatedTokens: number;
        contextLimit: number;
        utilizationPercent: number;
        isWarning: boolean;
        isCritical: boolean;
    };
}

/**
 * Token budget presets for Anthropic models.
 * Maps effort levels to token counts.
 */
export const REASONING_TOKEN_BUDGETS: Record<ReasoningEffort, number> = {
    high: 16000,
    medium: 8000,
    low: 4000,
    none: 0,
};

/**
 * Default fallback values if concierge fails.
 */
export const CONCIERGE_DEFAULTS: ConciergeResult = {
    modelId: "anthropic/claude-sonnet-4.5",
    temperature: 0.5,
    explanation: "Using our balanced default model.",
    reasoning: {
        enabled: false,
    },
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
    "openai/gpt-5.2",
    "x-ai/grok-4.1-fast",
] as const;

/**
 * Models that support extended reasoning with visible reasoning tokens.
 */
export const REASONING_CAPABLE_MODELS = [
    "anthropic/claude-opus-4.5",
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-haiku-4.5",
    "openai/gpt-5.2",
    "x-ai/grok-4.1-fast",
] as const;

/**
 * Models that use token-budget reasoning (Anthropic).
 */
export const TOKEN_BUDGET_MODELS = [
    "anthropic/claude-opus-4.5",
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-haiku-4.5",
] as const;

/**
 * Models that use effort-based reasoning (Grok, OpenAI).
 */
export const EFFORT_BASED_MODELS = ["openai/gpt-5.2", "x-ai/grok-4.1-fast"] as const;

/**
 * Maximum length for explanation text.
 * Prevents excessive header sizes and potential injection.
 */
export const MAX_EXPLANATION_LENGTH = 500;

/**
 * Maximum length for generated titles.
 * Short enough for clean URLs, long enough to be descriptive.
 */
export const MAX_TITLE_LENGTH = 50;

/**
 * OpenRouter reasoning effort levels (excludes "none" which disables reasoning).
 */
export type OpenRouterEffort = "high" | "medium" | "low";
