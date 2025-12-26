/**
 * Model Configuration - Source of truth for Carmenta's supported models.
 *
 * This module provides structured model data that can be used by:
 * - The Concierge for routing decisions
 * - The UI for displaying model options
 * - The API for validation
 *
 * SYNC REQUIREMENTS - When adding/removing models, also update:
 * - knowledge/model-rubric.md (detailed model documentation)
 * - lib/tips/tips-config.ts (multi-model tip mentions model names)
 */

export type ModelProvider = "anthropic" | "google" | "x-ai" | "openai" | "perplexity";

export type ReasoningType = "token-budget" | "effort-based" | "none";

export interface ReasoningConfig {
    type: ReasoningType;
    /** For token-budget: min/max tokens. For effort-based: effort levels */
    options?: {
        minTokens?: number;
        maxTokens?: number;
        efforts?: readonly string[];
    };
}

/** Speed vs quality positioning */
export type SpeedQuality = "fast" | "versatile" | "deep" | "specialized";

/** Capability tags shown in UI */
export type ModelTag =
    | "Deep thinking"
    | "Long docs"
    | "Live web"
    | "Video"
    | "Audio"
    | "Tools";

export interface ModelConfig {
    /** OpenRouter model ID (e.g., "anthropic/claude-sonnet-4.5") */
    id: string;
    /** Human-friendly display name */
    displayName: string;
    /** Provider identifier */
    provider: ModelProvider;
    /** User-facing description - what this model is good at */
    description: string;
    /** Speed vs quality positioning for UI */
    speedQuality: SpeedQuality;
    /** Capability tags shown in UI */
    tags: readonly ModelTag[];
    /** Maximum context window in tokens */
    contextWindow: number;
    /** Output tokens per second - critical for speed-first routing */
    tokensPerSecond: number;
    /** Cost per million input tokens (USD) - internal use */
    inputCostPerMillion: number;
    /** Cost per million output tokens (USD) - internal use */
    outputCostPerMillion: number;
    /** Supported attachment types */
    attachments: readonly string[];
    /** Whether the model supports tool/function calling */
    supportsTools: boolean;
    /** Reasoning/thinking capability */
    reasoning: ReasoningConfig;
    /** Suggested temperature range [min, max] */
    temperatureRange: readonly [number, number];
}

/**
 * All supported models with their configurations.
 * Ordered by provider preference (Anthropic first - our values).
 */
export const MODELS: readonly ModelConfig[] = [
    {
        id: "anthropic/claude-sonnet-4.5",
        displayName: "Claude Sonnet",
        provider: "anthropic",
        description: "Versatile powerhouse for code, analysis, and creative work",
        speedQuality: "versatile",
        tags: ["Deep thinking", "Long docs"],
        contextWindow: 1_000_000,
        tokensPerSecond: 60,
        inputCostPerMillion: 3,
        outputCostPerMillion: 15,
        attachments: ["image", "pdf"],
        supportsTools: true,
        reasoning: {
            type: "token-budget",
            options: { minTokens: 1024, maxTokens: 32000 },
        },
        temperatureRange: [0.3, 0.9],
    },
    {
        id: "anthropic/claude-opus-4.5",
        displayName: "Claude Opus",
        provider: "anthropic",
        description: "Maximum capability for complex research and deep thinking",
        speedQuality: "deep",
        tags: ["Deep thinking"],
        contextWindow: 200_000,
        tokensPerSecond: 40,
        inputCostPerMillion: 5,
        outputCostPerMillion: 25,
        attachments: ["image", "pdf"],
        supportsTools: true,
        reasoning: {
            type: "token-budget",
            options: { minTokens: 1024, maxTokens: 32000 },
        },
        temperatureRange: [0.4, 0.7],
    },
    {
        id: "anthropic/claude-haiku-4.5",
        displayName: "Claude Haiku",
        provider: "anthropic",
        description: "Fast & efficient for quick questions and rapid responses",
        speedQuality: "fast",
        tags: ["Deep thinking"],
        contextWindow: 200_000,
        tokensPerSecond: 100,
        inputCostPerMillion: 1,
        outputCostPerMillion: 5,
        attachments: ["image", "pdf"],
        supportsTools: true,
        reasoning: {
            type: "token-budget",
            options: { minTokens: 1024, maxTokens: 32000 },
        },
        temperatureRange: [0.2, 0.5],
    },
    {
        id: "google/gemini-3-pro-preview",
        displayName: "Gemini Pro",
        provider: "google",
        description: "Multimodal understanding for video, audio, and images",
        speedQuality: "versatile",
        tags: ["Video", "Audio", "Long docs"],
        contextWindow: 1_000_000,
        tokensPerSecond: 124,
        inputCostPerMillion: 2,
        outputCostPerMillion: 12,
        attachments: ["image", "pdf", "audio", "video"],
        supportsTools: true,
        reasoning: { type: "none" },
        temperatureRange: [0.5, 0.7],
    },
    {
        id: "x-ai/grok-4.1-fast",
        displayName: "Grok",
        provider: "x-ai",
        description: "Massive 2M token context for extreme-length scenarios",
        speedQuality: "fast",
        tags: ["Deep thinking", "Long docs"],
        contextWindow: 2_000_000,
        tokensPerSecond: 151,
        inputCostPerMillion: 0.2,
        outputCostPerMillion: 0.5,
        attachments: ["image", "pdf"],
        supportsTools: true,
        reasoning: {
            type: "effort-based",
            options: { efforts: ["high", "medium", "low", "minimal", "none"] },
        },
        temperatureRange: [0.4, 0.6],
    },
    {
        id: "openai/gpt-5.2",
        displayName: "ChatGPT",
        provider: "openai",
        description: "Frontier model for professional work with adaptive reasoning",
        speedQuality: "versatile",
        tags: ["Deep thinking", "Tools", "Long docs"],
        contextWindow: 400_000,
        tokensPerSecond: 95,
        inputCostPerMillion: 1.75,
        outputCostPerMillion: 14,
        attachments: ["image", "pdf"],
        supportsTools: true,
        reasoning: {
            type: "effort-based",
            options: { efforts: ["high", "medium", "low", "minimal", "none"] },
        },
        temperatureRange: [0.5, 0.7],
    },
    {
        id: "perplexity/sonar-pro",
        displayName: "Perplexity",
        provider: "perplexity",
        description: "Real-time web search with cited sources",
        speedQuality: "specialized",
        tags: ["Live web"],
        contextWindow: 128_000,
        tokensPerSecond: 80,
        inputCostPerMillion: 3,
        outputCostPerMillion: 15,
        attachments: ["image"],
        supportsTools: false,
        reasoning: { type: "none" },
        temperatureRange: [0.2, 0.5],
    },
] as const;

/**
 * Model IDs as a union type for type safety.
 */
export type ModelId = (typeof MODELS)[number]["id"];

/**
 * List of all allowed model IDs (for validation).
 */
export const ALLOWED_MODEL_IDS = MODELS.map((m) => m.id) as readonly ModelId[];

/**
 * Default model configuration.
 */
export const DEFAULT_MODEL = MODELS[0]; // Claude Sonnet

/**
 * Get a model config by ID.
 */
export function getModel(id: string): ModelConfig | undefined {
    return MODELS.find((m) => m.id === id);
}

/**
 * Get all models for a specific provider.
 */
export function getModelsByProvider(provider: ModelProvider): ModelConfig[] {
    return MODELS.filter((m) => m.provider === provider);
}

/**
 * Check if a model ID is valid/allowed.
 */
export function isValidModelId(id: string): id is ModelId {
    return ALLOWED_MODEL_IDS.includes(id as ModelId);
}

/**
 * Provider display information for UI.
 */
export const PROVIDERS: Record<
    ModelProvider,
    { displayName: string; description: string }
> = {
    anthropic: {
        displayName: "Anthropic",
        description: "AI built with care for safety and human flourishing",
    },
    google: {
        displayName: "Google",
        description: "Gemini models with broad multimodal capabilities",
    },
    "x-ai": {
        displayName: "xAI",
        description: "Grok models with massive context windows",
    },
    openai: {
        displayName: "OpenAI",
        description: "ChatGPT models with strong general capabilities",
    },
    perplexity: {
        displayName: "Perplexity",
        description: "Search-augmented AI with real-time web access",
    },
};

/**
 * Temperature (Creativity) presets for UI.
 * 4 levels from precise to expressive.
 */
export const TEMPERATURE_PRESETS = [
    { value: 0.1, label: "Precise", description: "Factual, deterministic" },
    { value: 0.4, label: "Balanced", description: "Default, versatile" },
    { value: 0.7, label: "Creative", description: "More variety" },
    { value: 1.0, label: "Expressive", description: "Maximum creativity" },
] as const;

/**
 * Reasoning level presets for UI.
 *
 * Reasoning is an OPTIONAL enhancement - the default is "none" (no extra reasoning).
 * Higher levels give the AI more time to deliberate, trading speed for quality.
 * 4 levels matching OpenRouter's effort parameter: none, low, medium, high.
 */
export const REASONING_PRESETS = [
    {
        id: "auto",
        label: "Auto",
        description: "Carmenta decides based on complexity",
        tokenBudget: undefined,
        effort: undefined,
    },
    {
        id: "none",
        label: "Quick",
        description: "Fast, direct response",
        tokenBudget: 0,
        effort: "none",
    },
    {
        id: "low",
        label: "Thoughtful",
        description: "A moment's consideration",
        tokenBudget: 2048,
        effort: "low",
    },
    {
        id: "medium",
        label: "Thorough",
        description: "Careful, considered response",
        tokenBudget: 8000,
        effort: "medium",
    },
    {
        id: "high",
        label: "Deep",
        description: "Full deliberation, slower",
        tokenBudget: 16000,
        effort: "high",
    },
] as const;

export type ReasoningPresetId = (typeof REASONING_PRESETS)[number]["id"];

/**
 * Get models sorted by speed (fastest first).
 * Use this for speed-first routing when user wants quick answers.
 */
export function getModelsBySpeed(): ModelConfig[] {
    return [...MODELS].sort((a, b) => b.tokensPerSecond - a.tokensPerSecond);
}

/**
 * Get the fastest model that supports the required capabilities.
 * Returns undefined if no model matches the requirements.
 */
export function getFastestModel(options?: {
    requiresTools?: boolean;
    attachmentType?: string;
}): ModelConfig | undefined {
    const sorted = getModelsBySpeed();

    return sorted.find((model) => {
        if (options?.requiresTools && !model.supportsTools) return false;
        if (
            options?.attachmentType &&
            !model.attachments.includes(options.attachmentType)
        )
            return false;
        return true;
    });
}

/**
 * Speed tier classification for routing decisions.
 * Fast: 100+ t/s - ideal for quick answers
 * Moderate: 60-99 t/s - balanced speed/quality
 * Deliberate: <60 t/s - prioritizes quality over speed
 */
export function getSpeedTier(model: ModelConfig): "fast" | "moderate" | "deliberate" {
    if (model.tokensPerSecond >= 100) return "fast";
    if (model.tokensPerSecond >= 60) return "moderate";
    return "deliberate";
}

/**
 * Fallback model chains for OpenRouter automatic failover.
 *
 * Strategy: Each chain intentionally uses different providers for maximum reliability.
 * If a provider has an outage, rate limit, or returns an error, OpenRouter automatically
 * tries the next model in the chain.
 *
 * Design principles:
 * 1. Primary model first in array
 * 2. First fallback: different provider, similar capabilities
 * 3. Second fallback: another provider for additional redundancy
 * 4. Consider model rubric guidance on strengths
 *
 * OpenRouter will bill based on whichever model actually succeeds.
 */
export const MODEL_FALLBACKS: Record<ModelId, readonly ModelId[]> = {
    // Sonnet → Gemini (versatile multimodal) → GPT (versatile frontier)
    "anthropic/claude-sonnet-4.5": [
        "anthropic/claude-sonnet-4.5",
        "google/gemini-3-pro-preview",
        "openai/gpt-5.2",
    ],

    // Opus → GPT (frontier professional) → Sonnet (same provider, still capable)
    "anthropic/claude-opus-4.5": [
        "anthropic/claude-opus-4.5",
        "openai/gpt-5.2",
        "anthropic/claude-sonnet-4.5",
    ],

    // Haiku → Grok (fastest) → Gemini (fast multimodal)
    "anthropic/claude-haiku-4.5": [
        "anthropic/claude-haiku-4.5",
        "x-ai/grok-4.1-fast",
        "google/gemini-3-pro-preview",
    ],

    // Gemini → Sonnet (versatile) → GPT (versatile)
    "google/gemini-3-pro-preview": [
        "google/gemini-3-pro-preview",
        "anthropic/claude-sonnet-4.5",
        "openai/gpt-5.2",
    ],

    // Grok → Gemini (fast, different provider) → Haiku (fast Anthropic)
    "x-ai/grok-4.1-fast": [
        "x-ai/grok-4.1-fast",
        "google/gemini-3-pro-preview",
        "anthropic/claude-haiku-4.5",
    ],

    // GPT → Sonnet (capable, Anthropic values) → Gemini (versatile multimodal)
    "openai/gpt-5.2": [
        "openai/gpt-5.2",
        "anthropic/claude-sonnet-4.5",
        "google/gemini-3-pro-preview",
    ],

    // Perplexity → Sonnet (can't do live web, but capable) → Gemini (versatile)
    "perplexity/sonar-pro": [
        "perplexity/sonar-pro",
        "anthropic/claude-sonnet-4.5",
        "google/gemini-3-pro-preview",
    ],
} as const;

/**
 * Get the fallback chain for a given model ID.
 * Returns the model array for OpenRouter's `models` parameter.
 */
export function getFallbackChain(modelId: string): string[] {
    // If model is in our config, return its fallback chain (spread to make mutable)
    if (isValidModelId(modelId)) {
        return [...MODEL_FALLBACKS[modelId as ModelId]];
    }

    // Unknown model - return just that model (no fallbacks)
    return [modelId];
}

/**
 * Concierge model fallback chain.
 * Based on knowledge/decisions/concierge-model-selection.md evaluation.
 *
 * Priority order:
 * 1. Gemini 3 Flash - 218 t/s, auto prompt caching (primary - fastest with caching)
 * 2. Grok 4.1 Fast - 150 t/s, no caching (fallback - still fast)
 * 3. Claude Sonnet 4.5 - Safe fallback if both fail
 */
export const CONCIERGE_FALLBACK_CHAIN: readonly ModelId[] = [
    "google/gemini-3-flash-preview",
    "x-ai/grok-4.1-fast",
    "anthropic/claude-sonnet-4.5",
] as const;

/**
 * Model with native audio support.
 * Currently only Gemini 3 Pro supports audio file processing.
 */
export const AUDIO_CAPABLE_MODEL: ModelId = "google/gemini-3-pro-preview";

/**
 * Model with native video support.
 * Currently only Gemini 3 Pro supports video file processing.
 */
export const VIDEO_CAPABLE_MODEL: ModelId = "google/gemini-3-pro-preview";

/**
 * Librarian model fallback chain.
 * Based on evals/librarian eval performance data.
 *
 * The Librarian runs after conversations to extract worth-preserving knowledge.
 * Priority: Haiku for speed/cost (this runs on every conversation), with
 * Sonnet fallback for reliability.
 *
 * Run evals to validate: pnpm braintrust eval evals/librarian/eval.ts
 */
export const LIBRARIAN_FALLBACK_CHAIN: readonly ModelId[] = [
    "anthropic/claude-haiku-4.5",
    "anthropic/claude-sonnet-4.5",
] as const;
