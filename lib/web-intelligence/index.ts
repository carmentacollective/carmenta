/**
 * Web Intelligence Module
 *
 * Provides web search, content extraction, and deep research capabilities.
 * Uses a vendor-agnostic interface that can be swapped between providers.
 *
 * Current provider: Parallel Web Systems
 */

export * from "./types";
export { ParallelProvider } from "./parallel";

import { env, assertEnv } from "@/lib/env";

import { ParallelProvider } from "./parallel";
import type { WebIntelligenceProvider } from "./types";

let providerInstance: WebIntelligenceProvider | null = null;

/**
 * Get the configured web intelligence provider.
 * Currently uses Parallel, but the interface supports swapping providers.
 */
export function getWebIntelligenceProvider(): WebIntelligenceProvider {
    if (!providerInstance) {
        assertEnv(env.PARALLEL_API_KEY, "PARALLEL_API_KEY");
        providerInstance = new ParallelProvider(env.PARALLEL_API_KEY);
    }
    return providerInstance;
}
