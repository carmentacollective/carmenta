/**
 * Vercel AI Gateway provider.
 *
 * Model IDs use format: "provider/model-name" (e.g., "anthropic/claude-sonnet-4.5")
 * Full model list: https://ai-gateway.vercel.sh/v1/models
 *
 * @see https://vercel.com/docs/ai-gateway
 * @see https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway
 */

import { createGateway, type GatewayProvider } from "@ai-sdk/gateway";
import type { LanguageModel } from "ai";

import { assertEnv, env } from "@/lib/env";
import {
    getProviderFromModelId,
    type AIProvider,
    type JSONValue,
    type ProviderOptionsResult,
    type UnifiedProviderOptions,
} from "./types";

let cachedClient: GatewayProvider | null = null;

/**
 * Get the shared Vercel AI Gateway client instance.
 *
 * Lazily initialized on first call. Subsequent calls return the cached instance.
 * Throws if AI_GATEWAY_API_KEY is not configured.
 */
export function getGatewayClient(): GatewayProvider {
    if (cachedClient) {
        return cachedClient;
    }

    assertEnv(env.AI_GATEWAY_API_KEY, "AI_GATEWAY_API_KEY");

    cachedClient = createGateway({
        apiKey: env.AI_GATEWAY_API_KEY,
    });

    return cachedClient;
}

/**
 * Clear the cached client. Useful for testing.
 */
export function clearGatewayClient(): void {
    cachedClient = null;
}

/**
 * Translate unified reasoning options to provider-specific format.
 *
 * The AI Gateway requires provider-specific options for reasoning:
 * - Anthropic: { thinking: { type: 'enabled', budgetTokens: N } }
 * - OpenAI: { reasoningEffort: 'high' | 'medium' | 'low' }
 * - xAI: { reasoningEffort: 'high' | 'medium' | 'low' }
 */
function translateReasoningOptions(
    modelId: string,
    options: UnifiedProviderOptions
): Record<string, Record<string, JSONValue>> {
    const result: Record<string, Record<string, JSONValue>> = {};

    if (!options.reasoning?.enabled) {
        return result;
    }

    const provider = getProviderFromModelId(modelId);

    switch (provider) {
        case "ANTHROPIC":
            // Anthropic uses thinking with token budget
            if (options.reasoning.maxTokens) {
                result.anthropic = {
                    thinking: {
                        type: "enabled",
                        budgetTokens: options.reasoning.maxTokens,
                    },
                };
            }
            break;

        case "OPENAI":
        case "XAI":
            // OpenAI and xAI use effort-based reasoning
            if (options.reasoning.effort && options.reasoning.effort !== "none") {
                const providerKey = provider === "OPENAI" ? "openai" : "xai";
                result[providerKey] = {
                    reasoningEffort: options.reasoning.effort,
                };
            }
            break;

        // Google and Perplexity don't support explicit reasoning config
        default:
            break;
    }

    return result;
}

/**
 * Translate unified cache control options to provider-specific format.
 *
 * Currently only Anthropic supports explicit cache control.
 * Google Gemini has automatic caching for prompts > 1024 tokens.
 */
function translateCacheControlOptions(
    modelId: string,
    options: UnifiedProviderOptions
): Record<string, Record<string, JSONValue>> {
    const result: Record<string, Record<string, JSONValue>> = {};

    if (!options.cacheControl) {
        return result;
    }

    const provider = getProviderFromModelId(modelId);

    if (provider === "ANTHROPIC") {
        result.anthropic = {
            ...((result.anthropic as Record<string, JSONValue>) ?? {}),
            cacheControl: options.cacheControl as unknown as JSONValue,
        };
    }

    return result;
}

/**
 * Translate unified fallback options to gateway format.
 */
function translateFallbackOptions(
    options: UnifiedProviderOptions
): Record<string, Record<string, JSONValue>> {
    const result: Record<string, Record<string, JSONValue>> = {};

    if (options.fallbackModels && options.fallbackModels.length > 0) {
        result.gateway = {
            models: options.fallbackModels.map(translateModelId),
        };
    }

    return result;
}

/**
 * Merge provider options objects deeply.
 * Handles nested objects like { anthropic: { thinking: {...}, cacheControl: {...} } }
 */
function mergeProviderOptions(
    ...sources: Record<string, Record<string, JSONValue>>[]
): Record<string, Record<string, JSONValue>> {
    const result: Record<string, Record<string, JSONValue>> = {};

    for (const source of sources) {
        for (const [key, value] of Object.entries(source)) {
            result[key] = {
                ...((result[key] as Record<string, JSONValue>) ?? {}),
                ...(value as Record<string, JSONValue>),
            };
        }
    }

    return result;
}

/**
 * Translate unified provider options to gateway-specific format.
 *
 * This is the main translation function that converts our unified
 * interface to what the AI Gateway expects.
 */
export function translateOptions(
    modelId: string,
    options: UnifiedProviderOptions
): ProviderOptionsResult {
    return mergeProviderOptions(
        translateFallbackOptions(options),
        translateReasoningOptions(modelId, options),
        translateCacheControlOptions(modelId, options)
    );
}

/**
 * Gateway provider implementing the AIProvider interface.
 *
 * Usage:
 * ```ts
 * const model = gatewayProvider.chat('anthropic/claude-sonnet-4.5');
 * const providerOptions = gatewayProvider.translateOptions(modelId, {
 *     fallbackModels: ['google/gemini-3-pro', 'openai/gpt-5.2'],
 *     reasoning: { enabled: true, maxTokens: 8000 },
 * });
 * ```
 */
export const gatewayProvider: AIProvider = {
    name: "gateway",

    chat(modelId: string): LanguageModel {
        const client = getGatewayClient();
        return client(translateModelId(modelId));
    },

    translateOptions(
        modelId: string,
        options: UnifiedProviderOptions
    ): ProviderOptionsResult {
        return translateOptions(modelId, options);
    },
};

/**
 * Model ID mapping from internal format to Vercel AI Gateway format.
 *
 * Gateway model IDs fetched from: https://ai-gateway.vercel.sh/v1/models
 * Only add mappings where our internal ID differs from Gateway's ID.
 */
export const MODEL_ID_MAPPINGS: Record<string, string> = {
    // xAI uses different provider prefix in Gateway
    // Internal: "x-ai/grok-4.1-fast"
    // Gateway: "xai/grok-4.1-fast-non-reasoning" (reasoning mode explicit)
    "x-ai/grok-4.1-fast": "xai/grok-4.1-fast-non-reasoning",
};

/**
 * Translate internal model ID to Vercel AI Gateway format.
 * Returns the original ID if no mapping exists.
 */
export function translateModelId(internalId: string): string {
    return MODEL_ID_MAPPINGS[internalId] ?? internalId;
}
