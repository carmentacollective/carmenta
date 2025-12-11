/**
 * Routing Scorer
 *
 * Validates that the Concierge made correct routing decisions:
 * - Model selection (haiku, sonnet, opus, gemini)
 * - Temperature selection (within expected range)
 * - Reasoning enabled/disabled
 * - Tool invocation (webSearch, compareOptions, etc.)
 */

export interface RoutingExpectations {
    /** Expected model substring(s) - pipe-delimited for alternatives e.g. "opus|sonnet" */
    model?: string | null;
    /** Expected temperature range [min, max] */
    temperatureRange?: [number, number] | null;
    /** Expected reasoning enabled state */
    reasoningEnabled?: boolean | null;
    /** Expected tool to be called */
    toolCalled?: string | null;
    /** Response should contain this text (case-insensitive) */
    responseContains?: string | null;
    /** Should return 200 status */
    shouldSucceed?: boolean;
}

export interface RoutingOutput {
    /** Response text from the model */
    text: string;
    /** Model ID from X-Concierge-Model-Id header */
    model?: string;
    /** Temperature from X-Concierge-Temperature header */
    temperature?: number;
    /** Reasoning config from X-Concierge-Reasoning header */
    reasoning?: { enabled: boolean; effort?: string; maxTokens?: number };
    /** Tools that were called during the response */
    toolsCalled: string[];
    /** HTTP status code */
    status: number;
}

interface ScorerArgs {
    input: unknown;
    output: RoutingOutput;
    expected: RoutingExpectations;
}

interface Score {
    name: string;
    score: number;
    metadata?: Record<string, unknown>;
}

/**
 * Routing scorer that validates Concierge routing decisions.
 * Returns an array of scores, one for each expectation that was specified.
 */
export function RoutingScorer({ output, expected }: ScorerArgs): Score[] {
    const scores: Score[] = [];

    // Model selection score
    if (expected.model !== undefined && expected.model !== null) {
        const modelPatterns = expected.model.split("|");
        const modelMatch = modelPatterns.some((p) =>
            output.model?.toLowerCase().includes(p.toLowerCase())
        );
        scores.push({
            name: "Model Selection",
            score: modelMatch ? 1 : 0,
            metadata: { expected: expected.model, actual: output.model },
        });
    }

    // Temperature score
    if (expected.temperatureRange !== undefined && expected.temperatureRange !== null) {
        const [min, max] = expected.temperatureRange;
        const temp = output.temperature ?? 0;
        const tempMatch = temp >= min && temp <= max;
        scores.push({
            name: "Temperature",
            score: tempMatch ? 1 : 0,
            metadata: {
                expected: `[${min}, ${max}]`,
                actual: temp,
            },
        });
    }

    // Reasoning score
    if (expected.reasoningEnabled !== undefined && expected.reasoningEnabled !== null) {
        const reasoningMatch = output.reasoning?.enabled === expected.reasoningEnabled;
        scores.push({
            name: "Reasoning",
            score: reasoningMatch ? 1 : 0,
            metadata: {
                expected: expected.reasoningEnabled,
                actual: output.reasoning?.enabled ?? false,
            },
        });
    }

    // Tool invocation score
    if (expected.toolCalled !== undefined && expected.toolCalled !== null) {
        const toolMatch = output.toolsCalled.includes(expected.toolCalled);
        scores.push({
            name: "Tool Invocation",
            score: toolMatch ? 1 : 0,
            metadata: {
                expected: expected.toolCalled,
                actual: output.toolsCalled,
            },
        });
    }

    // Response content score
    if (expected.responseContains !== undefined && expected.responseContains !== null) {
        const responseMatch = output.text
            .toLowerCase()
            .includes(expected.responseContains.toLowerCase());
        scores.push({
            name: "Response Content",
            score: responseMatch ? 1 : 0,
            metadata: {
                expected: `contains "${expected.responseContains}"`,
                actual: output.text.slice(0, 200),
            },
        });
    }

    // Success score (HTTP status)
    if (expected.shouldSucceed !== undefined) {
        const successMatch = expected.shouldSucceed
            ? output.status >= 200 && output.status < 300
            : output.status >= 400;
        scores.push({
            name: "HTTP Success",
            score: successMatch ? 1 : 0,
            metadata: {
                expected: expected.shouldSucceed ? "2xx" : "4xx/5xx",
                actual: output.status,
            },
        });
    }

    return scores;
}
