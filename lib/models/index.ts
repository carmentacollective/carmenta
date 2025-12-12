/**
 * Model Configuration - Source of truth for Carmenta's supported models.
 *
 * This module provides structured model data that can be used by:
 * - The Concierge for routing decisions
 * - The UI for displaying model options
 * - The API for validation
 *
 * Keep in sync with knowledge/model-rubric.md
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
export type SpeedQuality = "fast" | "balanced" | "deep" | "specialized";

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
        description: "Everyday powerhouse for code, writing, and analysis.",
        speedQuality: "balanced",
        tags: ["Deep thinking", "Long docs"],
        contextWindow: 1_000_000,
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
        description: "Maximum depth for complex research and nuanced problems.",
        speedQuality: "deep",
        tags: ["Deep thinking"],
        contextWindow: 200_000,
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
        description: "Snappy responses for simple questions and quick tasks.",
        speedQuality: "fast",
        tags: ["Deep thinking"],
        contextWindow: 200_000,
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
        description: "Understands video, audio, and images natively.",
        speedQuality: "balanced",
        tags: ["Video", "Audio", "Long docs"],
        contextWindow: 1_000_000,
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
        description: "Best agentic tool calling. Reads entire codebases at once.",
        speedQuality: "fast",
        tags: ["Deep thinking", "Long docs", "Tools"],
        contextWindow: 2_000_000,
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
        description: "SOTA tool calling with adaptive reasoning.",
        speedQuality: "balanced",
        tags: ["Deep thinking", "Tools"],
        contextWindow: 400_000,
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
        description: "Searches the web in real-time with cited sources.",
        speedQuality: "specialized",
        tags: ["Live web"],
        contextWindow: 128_000,
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
        label: "None",
        description: "Fast, direct response",
        tokenBudget: 0,
        effort: "none",
    },
    {
        id: "low",
        label: "Quick",
        description: "A moment's thought",
        tokenBudget: 2048,
        effort: "low",
    },
    {
        id: "medium",
        label: "Balanced",
        description: "Considered response",
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
