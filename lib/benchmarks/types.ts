/**
 * Benchmark types - shared across client and server
 */

export type BenchmarkCategory =
    | "reasoning"
    | "web-search"
    | "tool-integration"
    | "edge-cases"
    | "real-world";

export type Difficulty = "standard" | "hard" | "expert";

export interface BenchmarkQuery {
    id: string;
    query: string;
    category: BenchmarkCategory;
    difficulty: Difficulty;
    rationale: string;
    primaryDimensions: string[];
    tags: string[];
    source?: string;
    expectedTool?: string;
}

export interface ModelResponse {
    model: string;
    text: string;
    latencyMs: number;
    error?: string;
}

export interface PairwiseResult {
    competitor: string;
    winner: "carmenta" | "competitor" | "tie";
    confidence: number;
    reasoning: string;
}

export interface QueryResult {
    query: BenchmarkQuery;
    carmentaResponse: ModelResponse;
    competitorResponses: ModelResponse[];
    pairwiseResults: PairwiseResult[];
}

export interface CategoryScore {
    category: BenchmarkCategory;
    total: number;
    wins: number;
    losses: number;
    ties: number;
    winRate: number;
}

export interface CompetitorScore {
    competitor: string;
    wins: number;
    losses: number;
    ties: number;
    winRate: number;
}

export interface BenchmarkResults {
    timestamp: string;
    totalQueries: number;
    queriesRun: number;
    overall: {
        wins: number;
        losses: number;
        ties: number;
        winRate: number;
    };
    byCategory: CategoryScore[];
    byCompetitor: CompetitorScore[];
    queryResults: QueryResult[];
}
