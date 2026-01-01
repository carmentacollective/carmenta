/**
 * Scorers for Title Generation Evaluation
 *
 * Evaluates title quality across multiple dimensions:
 * - Topic capture (does the title reflect the message content?)
 * - Anti-patterns (avoids generic/low-quality titles)
 * - Length compliance
 * - Emoji conventions (for code context)
 */

import type { TitleTestInput, TitleExpectations } from "./cases";
import type { TitleOutput } from "./runner";

/** Maximum title length (matches production) */
const TITLE_MAX_LENGTH = 40;

/**
 * Check if text starts with an emoji (gitmoji pattern).
 * Uses character code ranges for ES2020 compatibility.
 */
function hasGitmoji(text: string): boolean {
    if (!text || text.length === 0) return false;
    const firstChar = text.codePointAt(0) ?? 0;
    // Common emoji ranges used in gitmoji
    return (
        (firstChar >= 0x1f300 && firstChar <= 0x1f9ff) || // Misc symbols/pictographs
        (firstChar >= 0x2600 && firstChar <= 0x26ff) || // Misc symbols
        (firstChar >= 0x2700 && firstChar <= 0x27bf) || // Dingbats
        (firstChar >= 0x1f600 && firstChar <= 0x1f64f) // Emoticons
    );
}

/**
 * Extended generic patterns to check beyond the test case.
 */
const ALWAYS_AVOID_PATTERNS = [
    /^(help|question|request|inquiry|assistance)/i,
    /^(new|untitled|general|misc)/i,
    /^(user|message|chat|conversation)\s/i,
    /^(about|regarding)\s/i,
    /^\s*$/, // Empty or whitespace only
];

interface ScorerArgs {
    input: TitleTestInput;
    output: TitleOutput;
    expected: TitleExpectations;
}

interface Score {
    name: string;
    score: number;
    metadata?: Record<string, unknown>;
}

/**
 * Main title scorer - evaluates overall title quality.
 * Returns an array of scores for different dimensions.
 */
export function TitleScorer({ input, output, expected }: ScorerArgs): Score[] {
    const scores: Score[] = [];
    const title = output.title;

    // Success score
    scores.push({
        name: "Success",
        score: output.success ? 1 : 0,
        metadata: {
            error: output.error,
        },
    });

    if (!output.success) {
        return scores;
    }

    // Length compliance
    const maxLength = expected?.maxLength ?? TITLE_MAX_LENGTH;
    const titleLength = [...title].length;
    const lengthOk = titleLength <= maxLength && titleLength >= 2;
    scores.push({
        name: "Length",
        score: lengthOk ? 1 : 0,
        metadata: {
            length: titleLength,
            maxLength,
        },
    });

    // Topic capture
    if (expected?.shouldMatch) {
        const topicMatch = expected.shouldMatch.test(title);
        scores.push({
            name: "Topic Capture",
            score: topicMatch ? 1 : 0,
            metadata: {
                pattern: expected.shouldMatch.toString(),
                title,
            },
        });
    }

    // Anti-pattern check
    const patternsToAvoid = [
        ...ALWAYS_AVOID_PATTERNS,
        ...(expected?.shouldNotMatch ?? []),
    ];
    const matchesAntiPattern = patternsToAvoid.some((p) => p.test(title));
    scores.push({
        name: "Not Generic",
        score: matchesAntiPattern ? 0 : 1,
        metadata: {
            title,
            isGeneric: matchesAntiPattern,
        },
    });

    // Emoji for code context
    if (input.context === "code") {
        const hasEmoji = hasGitmoji(title);
        if (expected?.expectEmoji === true) {
            scores.push({
                name: "Gitmoji",
                score: hasEmoji ? 1 : 0,
                metadata: {
                    title,
                    hasEmoji,
                    expected: true,
                },
            });
        } else {
            // Emoji is optional for code - give partial credit if missing
            scores.push({
                name: "Gitmoji",
                score: hasEmoji ? 1 : 0.7,
                metadata: {
                    title,
                    hasEmoji,
                    expected: false,
                },
            });
        }
    }

    // Latency score
    const latency = output.latencyMs;
    let latencyScore: number;
    if (latency < 300) {
        latencyScore = 1.0;
    } else if (latency < 500) {
        latencyScore = 0.9;
    } else if (latency < 1000) {
        latencyScore = 0.7;
    } else if (latency < 2000) {
        latencyScore = 0.5;
    } else {
        latencyScore = 0.3;
    }
    scores.push({
        name: "Latency",
        score: latencyScore,
        metadata: {
            latencyMs: latency,
            tier:
                latency < 300
                    ? "fast"
                    : latency < 500
                      ? "good"
                      : latency < 1000
                        ? "medium"
                        : "slow",
        },
    });

    // Ideal length range (10-30 chars)
    let idealLengthScore: number;
    if (titleLength >= 10 && titleLength <= 30) {
        idealLengthScore = 1;
    } else if (titleLength >= 5 && titleLength <= 35) {
        idealLengthScore = 0.8;
    } else {
        idealLengthScore = 0.5;
    }
    scores.push({
        name: "Ideal Length",
        score: idealLengthScore,
        metadata: {
            length: titleLength,
            idealRange: "10-30",
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
