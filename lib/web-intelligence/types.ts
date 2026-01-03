/**
 * Web Intelligence Types
 *
 * Defines the vendor-agnostic interfaces for web search, content extraction,
 * and deep research capabilities.
 */

// Search types
export interface SearchOptions {
    maxResults?: number;
    freshness?: "day" | "week" | "month" | "any";
    domains?: string[];
    excludeDomains?: string[];
}

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    publishedDate?: string;
}

export interface SearchResponse {
    results: SearchResult[];
    query: string;
    provider: string;
    latencyMs: number;
}

// Extract types
export interface ExtractOptions {
    maxLength?: number;
}

export interface ExtractResponse {
    title: string;
    content: string;
    url: string;
    provider: string;
    latencyMs: number;
    /**
     * Optional warning when extraction completed but with issues.
     * Examples: content too short, page blocked, JavaScript-heavy site.
     */
    warning?: string;
}

// Research types
/**
 * Research depth levels mapped to Parallel.ai processors.
 *
 * User-facing labels (Carmenta voice):
 * | Internal     | User Label          | Processor | Latency   | Cost/1K |
 * |--------------|---------------------|-----------|-----------|---------|
 * | instant      | From what we know   | (none)    | instant   | $0      |
 * | light        | Quick look          | lite-fast | ~15s      | $5      |
 * | standard     | Proper search       | base-fast | ~30s      | $10     |
 * | deep         | Deep dive           | core-fast | ~2min     | $25     |
 * | comprehensive| Taking our time     | pro       | ~5min     | $100    |
 * | full         | The full picture    | ultra     | ~15min    | $300    |
 *
 * Note: "quick" is deprecated, alias for "light".
 */
export type ResearchDepth =
    | "instant" // No external research - answer from what we know
    | "quick" // deprecated, alias for "light"
    | "light" // Quick look (~15s)
    | "standard" // Proper search (~30s)
    | "deep" // Deep dive (~2min)
    | "comprehensive" // Taking our time (~5min)
    | "full"; // The full picture (~15min)

export interface ResearchOptions {
    depth?: ResearchDepth;
    maxSources?: number;
    focusAreas?: string[];
}

export interface ResearchFinding {
    insight: string;
    sources: string[];
    confidence: "high" | "medium" | "low";
}

export interface ResearchSource {
    url: string;
    title: string;
    relevance: string;
}

export interface ResearchResponse {
    summary: string;
    findings: ResearchFinding[];
    sources: ResearchSource[];
    objective: string;
    provider: string;
    latencyMs: number;
}

/**
 * Web Intelligence Provider Interface
 *
 * Abstracts vendor-specific implementations behind a common interface.
 * Implementations can be swapped without changing calling code.
 */
export interface WebIntelligenceProvider {
    readonly name: string;

    /**
     * Quick search for current information.
     * Returns concise results with snippets.
     */
    search(query: string, options?: SearchOptions): Promise<SearchResponse | null>;

    /**
     * Extract content from a specific URL.
     * Returns clean markdown without ads or navigation.
     */
    extract(url: string, options?: ExtractOptions): Promise<ExtractResponse | null>;

    /**
     * Deep multi-step research on a topic.
     * Searches multiple sources and synthesizes findings.
     */
    research(
        objective: string,
        options?: ResearchOptions
    ): Promise<ResearchResponse | null>;
}
