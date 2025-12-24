/**
 * Shared OpenRouter client instance.
 *
 * Single source of truth for OpenRouter configuration. Avoids creating
 * multiple client instances in route handlers and concierge.
 */

import { createOpenRouter, type OpenRouterProvider } from "@openrouter/ai-sdk-provider";

import { assertEnv, env } from "@/lib/env";

let cachedClient: OpenRouterProvider | null = null;

/**
 * Get the shared OpenRouter client instance.
 *
 * Lazily initialized on first call. Subsequent calls return the cached instance.
 * Throws if OPENROUTER_API_KEY is not configured.
 */
export function getOpenRouterClient(): OpenRouterProvider {
    if (cachedClient) {
        return cachedClient;
    }

    assertEnv(env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY");

    cachedClient = createOpenRouter({
        apiKey: env.OPENROUTER_API_KEY,
    });

    return cachedClient;
}

/**
 * Clear the cached client. Useful for testing.
 */
export function clearOpenRouterClient(): void {
    cachedClient = null;
}
