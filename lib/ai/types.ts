/**
 * Shared types for AI providers (OpenRouter, Vercel AI Gateway).
 *
 * Provides a unified interface so consumers don't need to care which
 * provider is active. Both gateway.ts and openrouter.ts implement
 * the same patterns using these shared types.
 */

import type { LanguageModel } from "ai";

/**
 * Reasoning configuration for models that support extended thinking.
 *
 * Uses a unified format that gets translated to provider-specific
 * options internally:
 * - Anthropic: `thinking: { type: 'enabled', budgetTokens: N }`
 * - OpenAI: `reasoningEffort: 'high' | 'medium' | 'low'`
 * - xAI/Grok: `reasoningEffort: 'high' | 'medium' | 'low'`
 */
export interface ReasoningOptions {
    /** Enable extended reasoning/thinking */
    enabled: boolean;
    /** Token budget for reasoning (Anthropic models) */
    maxTokens?: number;
    /** Effort level for reasoning (OpenAI, xAI models) */
    effort?: "high" | "medium" | "low" | "none";
}

/**
 * Cache control options for prompt caching.
 *
 * Currently only Anthropic supports explicit cache control.
 * Google Gemini has automatic caching for prompts > 1024 tokens.
 */
export interface CacheControlOptions {
    /** Mark content for caching (Anthropic) */
    type: "ephemeral";
}

/**
 * Provider options that get passed through to the underlying provider.
 *
 * This unifies the different provider option formats so callers can
 * use a consistent interface regardless of which AI gateway is active.
 */
export interface UnifiedProviderOptions {
    /** Fallback models if primary fails */
    fallbackModels?: string[];
    /** Reasoning configuration */
    reasoning?: ReasoningOptions;
    /** Cache control for system/user messages */
    cacheControl?: CacheControlOptions;
}

/**
 * JSON-compatible value type for provider options.
 */
export type JSONValue =
    | string
    | number
    | boolean
    | null
    | { [key: string]: JSONValue }
    | JSONValue[];

/**
 * Result of translating unified options to provider-specific format.
 *
 * This is what actually gets passed to streamText/generateText.
 * Uses JSONValue to be compatible with AI SDK's SharedV3ProviderOptions.
 */
export type ProviderOptionsResult = Record<string, Record<string, JSONValue>>;

/**
 * AI Provider interface - implemented by both openrouter.ts and gateway.ts.
 *
 * This allows swapping providers without changing consumer code.
 */
export interface AIProvider {
    /** Get a chat model by ID */
    chat(modelId: string): LanguageModel;

    /**
     * Translate unified options to provider-specific format.
     *
     * Example usage:
     * ```ts
     * const provider = getAIProvider();
     * const providerOptions = provider.translateOptions({
     *     fallbackModels: ['google/gemini-3-pro', 'openai/gpt-5.2'],
     *     reasoning: { enabled: true, maxTokens: 8000 },
     *     cacheControl: { type: 'ephemeral' },
     * });
     *
     * await streamText({
     *     model: provider.chat('anthropic/claude-sonnet-4.5'),
     *     providerOptions,
     *     // ...
     * });
     * ```
     */
    translateOptions(
        modelId: string,
        options: UnifiedProviderOptions
    ): ProviderOptionsResult;

    /** Provider name for logging/debugging */
    readonly name: "openrouter" | "gateway";
}

/**
 * Model provider prefixes for determining provider-specific behavior.
 */
export const MODEL_PROVIDERS = {
    ANTHROPIC: "anthropic/",
    GOOGLE: "google/",
    OPENAI: "openai/",
    XAI: "x-ai/",
    PERPLEXITY: "perplexity/",
} as const;

/**
 * Check if a model ID is from a specific provider.
 */
export function isModelFromProvider(
    modelId: string,
    provider: keyof typeof MODEL_PROVIDERS
): boolean {
    return modelId.startsWith(MODEL_PROVIDERS[provider]);
}

/**
 * Get the provider name from a model ID.
 */
export function getProviderFromModelId(
    modelId: string
): keyof typeof MODEL_PROVIDERS | null {
    for (const [key, prefix] of Object.entries(MODEL_PROVIDERS)) {
        if (modelId.startsWith(prefix)) {
            return key as keyof typeof MODEL_PROVIDERS;
        }
    }
    return null;
}
