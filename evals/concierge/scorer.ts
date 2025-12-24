/**
 * Concierge Scorer
 *
 * Evaluates the quality of concierge routing decisions:
 * - Model selection accuracy
 * - Temperature appropriateness
 * - Reasoning enablement correctness
 * - Title quality (descriptive, concise, relevant)
 * - Auto-switch correctness for attachments
 */

import type { ConciergeResult } from "@/lib/concierge";

export interface ConciergeExpectations {
    /** Expected model substring(s) - pipe-delimited for alternatives e.g. "opus|sonnet" */
    model?: string | null;
    /** Expected temperature range [min, max] */
    temperatureRange?: [number, number] | null;
    /** Expected reasoning enabled state */
    reasoningEnabled?: boolean | null;
    /** Expected auto-switched state (for attachments) */
    autoSwitched?: boolean | null;
    /** Regex pattern the title should match */
    titlePattern?: RegExp | null;
    /** Maximum allowed title length */
    titleMaxLength?: number | null;
}

export interface ConciergeOutput extends ConciergeResult {
    /** Time taken to run the concierge in milliseconds */
    latencyMs: number;
    /** Whether the concierge produced valid output */
    isValid: boolean;
    /** Error message if concierge failed */
    error?: string;
}

interface ScorerArgs {
    input: unknown;
    output: ConciergeOutput;
    expected: ConciergeExpectations;
}

interface Score {
    name: string;
    score: number;
    metadata?: Record<string, unknown>;
}

/**
 * Model family mappings for flexible matching.
 * Allows "haiku" to match "anthropic/claude-haiku-4.5"
 */
const MODEL_ALIASES: Record<string, string[]> = {
    haiku: ["anthropic/claude-haiku-4.5", "haiku"],
    sonnet: ["anthropic/claude-sonnet-4.5", "sonnet"],
    opus: ["anthropic/claude-opus-4.5", "opus"],
    claude: [
        "anthropic/claude-opus-4.5",
        "anthropic/claude-sonnet-4.5",
        "anthropic/claude-haiku-4.5",
        "claude",
    ],
    gemini: ["google/gemini-3-pro-preview", "gemini"],
    gpt: ["openai/gpt-5.2", "gpt"],
    grok: ["x-ai/grok-4.1-fast", "grok"],
};

/**
 * Check if a model ID matches an expected pattern.
 * Supports aliases like "haiku" → "anthropic/claude-haiku-4.5"
 */
function modelMatches(actual: string, expectedPattern: string): boolean {
    const patterns = expectedPattern.split("|");
    const normalizedActual = actual.toLowerCase();

    return patterns.some((pattern) => {
        const normalizedPattern = pattern.trim().toLowerCase();

        // Direct substring match
        if (normalizedActual.includes(normalizedPattern)) {
            return true;
        }

        // Check aliases
        const aliases = MODEL_ALIASES[normalizedPattern];
        if (aliases) {
            return aliases.some((alias) =>
                normalizedActual.includes(alias.toLowerCase())
            );
        }

        return false;
    });
}

/**
 * Concierge scorer that validates routing decisions.
 * Returns an array of scores, one for each expectation that was specified.
 */
export function ConciergeScorer({ output, expected }: ScorerArgs): Score[] {
    const scores: Score[] = [];

    // Validity check - did the concierge produce output at all?
    scores.push({
        name: "Valid Output",
        score: output.isValid ? 1 : 0,
        metadata: {
            error: output.error,
            hasModelId: Boolean(output.modelId),
            hasTemperature: output.temperature !== undefined,
        },
    });

    // If output is invalid, remaining scores are 0
    if (!output.isValid) {
        if (expected.model !== undefined && expected.model !== null) {
            scores.push({
                name: "Model Selection",
                score: 0,
                metadata: {
                    expected: expected.model,
                    actual: null,
                    reason: "invalid output",
                },
            });
        }
        if (
            expected.temperatureRange !== undefined &&
            expected.temperatureRange !== null
        ) {
            scores.push({
                name: "Temperature",
                score: 0,
                metadata: {
                    expected: expected.temperatureRange,
                    actual: null,
                    reason: "invalid output",
                },
            });
        }
        if (
            expected.reasoningEnabled !== undefined &&
            expected.reasoningEnabled !== null
        ) {
            scores.push({
                name: "Reasoning",
                score: 0,
                metadata: {
                    expected: expected.reasoningEnabled,
                    actual: null,
                    reason: "invalid output",
                },
            });
        }
        return scores;
    }

    // Model selection score
    if (expected.model !== undefined && expected.model !== null) {
        const match = modelMatches(output.modelId, expected.model);
        scores.push({
            name: "Model Selection",
            score: match ? 1 : 0,
            metadata: {
                expected: expected.model,
                actual: output.modelId,
            },
        });
    }

    // Temperature score
    if (expected.temperatureRange !== undefined && expected.temperatureRange !== null) {
        const [min, max] = expected.temperatureRange;
        const temp = output.temperature;

        if (temp === undefined) {
            // Temperature not set - fail the score
            scores.push({
                name: "Temperature",
                score: 0,
                metadata: {
                    expected: `[${min}, ${max}]`,
                    actual: "undefined",
                    reason: "temperature not returned by concierge",
                },
            });
        } else {
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
    }

    // Reasoning score
    if (expected.reasoningEnabled !== undefined && expected.reasoningEnabled !== null) {
        const actualReasoning = output.reasoning?.enabled ?? false;
        const reasoningMatch = actualReasoning === expected.reasoningEnabled;
        scores.push({
            name: "Reasoning",
            score: reasoningMatch ? 1 : 0,
            metadata: {
                expected: expected.reasoningEnabled,
                actual: actualReasoning,
                effort: output.reasoning?.effort,
            },
        });
    }

    // Auto-switch score (for attachments)
    if (expected.autoSwitched !== undefined && expected.autoSwitched !== null) {
        const actualAutoSwitched = output.autoSwitched ?? false;
        const match = actualAutoSwitched === expected.autoSwitched;
        scores.push({
            name: "Auto Switch",
            score: match ? 1 : 0,
            metadata: {
                expected: expected.autoSwitched,
                actual: actualAutoSwitched,
                reason: output.autoSwitchReason,
            },
        });
    }

    // Title pattern score
    if (expected.titlePattern !== undefined && expected.titlePattern !== null) {
        const title = output.title ?? "";
        const patternMatch = expected.titlePattern.test(title);
        scores.push({
            name: "Title Pattern",
            score: patternMatch ? 1 : 0,
            metadata: {
                pattern: expected.titlePattern.toString(),
                actual: title,
            },
        });
    }

    // Title length score
    if (expected.titleMaxLength !== undefined && expected.titleMaxLength !== null) {
        const title = output.title ?? "";
        const lengthOk = title.length > 0 && title.length <= expected.titleMaxLength;
        scores.push({
            name: "Title Length",
            score: lengthOk ? 1 : 0,
            metadata: {
                maxLength: expected.titleMaxLength,
                actualLength: title.length,
                title: title,
            },
        });
    }

    // Latency score (bonus scoring for speed)
    // Fast: < 500ms = 1.0, Medium: 500-1000ms = 0.7, Slow: 1000-2000ms = 0.4, Very slow: > 2000ms = 0.2
    const latencyScore =
        output.latencyMs < 500
            ? 1.0
            : output.latencyMs < 1000
              ? 0.7
              : output.latencyMs < 2000
                ? 0.4
                : 0.2;
    scores.push({
        name: "Latency",
        score: latencyScore,
        metadata: {
            latencyMs: output.latencyMs,
            tier:
                output.latencyMs < 500
                    ? "fast"
                    : output.latencyMs < 1000
                      ? "medium"
                      : output.latencyMs < 2000
                        ? "slow"
                        : "very-slow",
        },
    });

    // Title presence score (should always generate a title)
    const hasTitle = Boolean(output.title && output.title.trim().length > 0);
    scores.push({
        name: "Title Generated",
        score: hasTitle ? 1 : 0,
        metadata: {
            title: output.title,
            length: output.title?.length ?? 0,
        },
    });

    // Title quality heuristic (not generic like "New Chat" or "Untitled")
    const genericTitles = [
        "new chat",
        "untitled",
        "conversation",
        "chat",
        "question",
        "help",
        "request",
    ];
    const titleLower = (output.title ?? "").toLowerCase().trim();
    const isGeneric = genericTitles.some(
        (g) => titleLower === g || titleLower.startsWith(g + " ")
    );
    scores.push({
        name: "Title Not Generic",
        score: hasTitle && !isGeneric ? 1 : 0,
        metadata: {
            title: output.title,
            isGeneric,
        },
    });

    return scores;
}

/**
 * Aggregates multiple scorer results into summary metrics.
 */
export function aggregateScores(
    allScores: Score[][]
): Record<string, { mean: number; count: number }> {
    const byName: Record<string, number[]> = {};

    for (const scores of allScores) {
        for (const score of scores) {
            if (!byName[score.name]) {
                byName[score.name] = [];
            }
            byName[score.name].push(score.score);
        }
    }

    const summary: Record<string, { mean: number; count: number }> = {};
    for (const [name, values] of Object.entries(byName)) {
        summary[name] = {
            mean: values.reduce((a, b) => a + b, 0) / values.length,
            count: values.length,
        };
    }

    return summary;
}
