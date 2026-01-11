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
 * Response depth/verbosity guidance.
 *
 * Separate from reasoning (which controls internal thinking depth).
 * This controls how comprehensive the visible output should be.
 *
 * - "comprehensive": Full explanations, examples, edge cases, thorough coverage
 * - "balanced": Standard response depth for most queries
 * - "concise": Brief, direct answers - get to the point quickly
 */
export type ResponseDepth = "comprehensive" | "balanced" | "concise";

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

    /**
     * Message effort and complexity signals for reasoning decisions.
     * These inform how much reasoning effort is likely expected.
     */
    querySignals?: QueryComplexitySignals;

    /**
     * Session context for reasoning decisions.
     * Helps understand the flow and timing of the conversation.
     */
    sessionContext?: SessionContext;

    /**
     * Integration context for suggesting relevant services.
     * Contains connected services and potential suggestions based on query keywords.
     */
    integrationContext?: IntegrationContext;
}

/**
 * Signals derived from the message content that indicate complexity
 * and user effort, informing reasoning level decisions.
 */
export interface QueryComplexitySignals {
    /** Character count of the user message */
    characterCount: number;

    /** Whether message has structured formatting (lists, bullets, numbered items) */
    hasStructuredFormatting: boolean;

    /** Number of distinct questions detected in the message */
    questionCount: number;

    /** Whether message contains "why", "how does", "explain" type depth indicators */
    hasDepthIndicators: boolean;

    /** Whether message contains conditional logic ("if X then Y", "but if") */
    hasConditionalLogic: boolean;

    /** Whether message references previous context ("like we discussed", "as I mentioned") */
    referencesPreviousContext: boolean;

    /** Whether message contains explicit speed signals ("quick", "just", "simply") */
    hasSpeedSignals: boolean;

    /** Whether message contains explicit depth signals ("think hard", "thorough", "ultrathink") */
    hasExplicitDepthSignals: boolean;
}

/**
 * Session context providing timing and flow information
 * for reasoning decisions.
 */
export interface SessionContext {
    /** Number of exchanges in this conversation */
    turnCount: number;

    /** Whether this is the first message in the conversation */
    isFirstMessage: boolean;

    /** Device type if known (mobile tends to prefer faster responses) */
    deviceType?: "mobile" | "desktop" | "unknown";

    /** Hour of day (0-23) in user's timezone - late night often means quick fixes */
    hourOfDay?: number;

    /** Milliseconds since last message (quick follow-up vs new thought) */
    timeSinceLastMessage?: number;
}

/**
 * Integration context for suggesting relevant unconnected services.
 *
 * Passed to the concierge so it can suggest integrations that would
 * enhance the user's query.
 */
export interface IntegrationContext {
    /** Service IDs the user has connected */
    connectedServiceIds: string[];
    /** Services that matched query keywords but aren't connected */
    potentialSuggestions: Array<{
        serviceId: string;
        serviceName: string;
        description: string;
        /** Keywords from the query that triggered this suggestion */
        matchedKeywords: string[];
    }>;
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
 * Knowledge base search configuration extracted by the Concierge.
 * Used to retrieve relevant context before the main LLM call.
 */
export interface KBSearchConfig {
    /**
     * Whether to search the knowledge base for this request.
     * False for simple queries, greetings, or when no KB context would help.
     */
    shouldSearch: boolean;

    /**
     * Search queries optimized for PostgreSQL full-text search.
     * The concierge extracts entities, topics, and synonyms from the user message.
     * Empty array when shouldSearch is false.
     *
     * @example ["google calendar integration", "oauth calendar sync"]
     */
    queries: string[];

    /**
     * Explicit entity names to look up directly (path/name matching).
     * These get exact-match priority over full-text search.
     *
     * @example ["sarah", "google calendar", "auth system"]
     */
    entities: string[];
}

/**
 * A clarifying question the concierge wants to ask before proceeding.
 * Used ONLY for discrete choices where clicking is faster than typing.
 *
 * If you need open-ended input, ask conversationally instead.
 */
export interface ClarifyingQuestion {
    /** Short question - keep it warm and direct */
    question: string;
    /** 3-5 clickable options covering distinct approaches */
    options: Array<{
        label: string;
        value: string;
    }>;
}

/**
 * A suggested integration that would enhance the user's query.
 *
 * When a user asks something that would benefit from an integration
 * they haven't connected, we can proactively suggest it.
 */
export interface SuggestedIntegration {
    /** Service ID (e.g., "coinmarketcap", "spotify") */
    serviceId: string;
    /** Brief explanation of why this integration would help (shown to user) */
    reason: string;
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
     * Generated title for the connection (15-35 chars ideal).
     * Only present on first message - used to create the connection.
     */
    title?: string;

    /**
     * Knowledge base search configuration.
     * Tells the system what to search for before responding.
     */
    kbSearch?: KBSearchConfig;

    /**
     * Response depth/verbosity guidance.
     *
     * Orthogonal to reasoning (internal thinking). Examples:
     * - Deep reasoning + concise output: "Think hard but give me the bottom line"
     * - Light reasoning + comprehensive output: "Quick overview but cover everything"
     *
     * Based on query signals: speed signals → concise, depth indicators → comprehensive.
     */
    responseDepth?: ResponseDepth;

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

    /**
     * Background mode configuration.
     *
     * When enabled, the response runs via Temporal for durable execution.
     * This allows long-running work to survive browser close, deploys,
     * and connection drops. The user sees "still working" status.
     */
    backgroundMode?: {
        /** Whether to run this response in background mode */
        enabled: boolean;
        /** Reason shown to user (e.g., "Deep research - this will take a few minutes") */
        reason?: string;
    };

    /**
     * Clarifying questions to ask before proceeding.
     *
     * When the concierge detects a deep research request or ambiguity,
     * it can ask scoping questions before starting work. This helps
     * ensure the response matches user intent.
     *
     * When set, the route should return these questions to the user
     * instead of starting LLM generation. The user's answers get
     * appended to the conversation, and a new request is made.
     */
    clarifyingQuestions?: ClarifyingQuestion[];

    /**
     * Suggested integrations that would enhance this request.
     *
     * When the user's query would benefit from an integration they
     * haven't connected, we suggest it with a brief reason.
     * Light-touch, helpful, not pushy.
     */
    suggestedIntegrations?: SuggestedIntegration[];

    /**
     * Explicit overrides that were honored from user #modifiers.
     *
     * When the user includes #modifiers like #opus or #ultrathink,
     * these take highest priority. This field tracks what was overridden
     * so the UI can show "Using Opus as requested" or similar feedback.
     */
    explicitOverrides?: ExplicitOverrides;
}

/**
 * Tracks which explicit user overrides were honored.
 * Used for UI feedback: "Using Opus as requested"
 */
export interface ExplicitOverrides {
    /** Model override from #opus, #sonnet, #haiku, #grok, #gemini */
    model?: {
        requested: string;
        honored: boolean;
    };
    /** Reasoning override from #ultrathink or #quick */
    reasoning?: {
        requested: "ultrathink" | "quick";
        honored: boolean;
    };
    /** Temperature override from #creative or #precise */
    temperature?: {
        requested: "creative" | "precise";
        honored: boolean;
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
    responseDepth: "balanced",
};

/**
 * The model used to run the Concierge itself.
 * Llama 3.3 70B via Vercel AI Gateway achieves 280 t/s output speed
 * with 96.97% model selection accuracy (matching Sonnet quality).
 * See knowledge/decisions/concierge-model-selection.md for eval data.
 */
export const CONCIERGE_MODEL = "meta/llama-3.3-70b";

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
 * 40 chars keeps titles scannable in lists while allowing specificity.
 */
export const MAX_TITLE_LENGTH = 40;

/**
 * OpenRouter reasoning effort levels (excludes "none" which disables reasoning).
 */
export type OpenRouterEffort = "high" | "medium" | "low";
