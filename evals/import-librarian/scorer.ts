/**
 * Extraction Scorer
 *
 * Evaluates the quality of knowledge extraction:
 * - Precision: Did it avoid extracting noise?
 * - Recall: Did it find the expected facts?
 * - Category accuracy: Are categories correct?
 * - Count bounds: Not too many, not too few
 */

import type { ExtractionTestCase, ExpectedExtraction } from "./cases";

export interface ExtractedFact {
    category: string;
    content: string;
    summary: string;
    confidence: number;
}

export interface ExtractionOutput {
    facts: ExtractedFact[];
    isValid: boolean;
    error?: string;
    latencyMs: number;
}

interface ScorerArgs {
    input: ExtractionTestCase["input"];
    output: ExtractionOutput;
    expected: ExtractionTestCase["expected"];
}

interface Score {
    name: string;
    score: number;
    metadata?: Record<string, unknown>;
}

/**
 * Check if an extracted fact matches an expected extraction
 */
function factMatchesExpected(
    fact: ExtractedFact,
    expected: ExpectedExtraction
): boolean {
    // Category must match
    if (fact.category !== expected.category) {
        return false;
    }

    // Content pattern must match in content or summary
    const textToCheck = `${fact.content} ${fact.summary}`.toLowerCase();
    if (!expected.contentPattern.test(textToCheck)) {
        return false;
    }

    // Confidence threshold (if specified)
    if (expected.minConfidence && fact.confidence < expected.minConfidence) {
        return false;
    }

    return true;
}

/**
 * Main scorer for extraction quality
 */
export function ExtractionScorer({ output, expected }: ScorerArgs): Score[] {
    const scores: Score[] = [];

    // Validity check
    scores.push({
        name: "Valid Output",
        score: output.isValid ? 1 : 0,
        metadata: {
            error: output.error,
            factCount: output.facts.length,
        },
    });

    if (!output.isValid) {
        return scores;
    }

    const facts = output.facts;

    // =========================================================================
    // RECALL: Did we find the expected facts?
    // =========================================================================
    if (expected.shouldExtract.length > 0) {
        let matchedCount = 0;
        const matchDetails: Array<{ expected: string; matched: boolean }> = [];

        for (const expectedFact of expected.shouldExtract) {
            const matched = facts.some((f) => factMatchesExpected(f, expectedFact));
            if (matched) matchedCount++;
            matchDetails.push({
                expected: `${expectedFact.category}: ${expectedFact.contentPattern}`,
                matched,
            });
        }

        const recallScore = matchedCount / expected.shouldExtract.length;
        scores.push({
            name: "Recall",
            score: recallScore,
            metadata: {
                matchedCount,
                expectedCount: expected.shouldExtract.length,
                details: matchDetails,
            },
        });
    }

    // =========================================================================
    // PRECISION: Did we avoid extracting noise?
    // =========================================================================
    if (expected.shouldNotExtract && expected.shouldNotExtract.length > 0) {
        let noiseFound = 0;
        const noiseDetails: string[] = [];

        for (const noisePattern of expected.shouldNotExtract) {
            const foundNoise = facts.some((f) => {
                const text = `${f.content} ${f.summary}`.toLowerCase();
                return noisePattern.test(text);
            });
            if (foundNoise) {
                noiseFound++;
                noiseDetails.push(noisePattern.toString());
            }
        }

        const precisionScore = noiseFound === 0 ? 1 : 0;
        scores.push({
            name: "Noise Avoidance",
            score: precisionScore,
            metadata: {
                noisePatterns: expected.shouldNotExtract.map((p) => p.toString()),
                foundNoise: noiseDetails,
            },
        });
    }

    // =========================================================================
    // COUNT BOUNDS: Not too many, not too few
    // =========================================================================
    let countScore = 1;
    const countMetadata: Record<string, unknown> = { actualCount: facts.length };

    if (expected.minExtractions !== undefined) {
        countMetadata.minExpected = expected.minExtractions;
        if (facts.length < expected.minExtractions) {
            countScore = facts.length / expected.minExtractions;
        }
    }

    if (expected.maxExtractions !== undefined) {
        countMetadata.maxExpected = expected.maxExtractions;
        if (facts.length > expected.maxExtractions) {
            // Penalize over-extraction
            countScore = Math.min(countScore, expected.maxExtractions / facts.length);
        }
    }

    scores.push({
        name: "Count Bounds",
        score: countScore,
        metadata: countMetadata,
    });

    // =========================================================================
    // CATEGORY DISTRIBUTION: Are categories reasonable?
    // =========================================================================
    if (facts.length > 0) {
        const categoryCounts: Record<string, number> = {};
        for (const fact of facts) {
            categoryCounts[fact.category] = (categoryCounts[fact.category] || 0) + 1;
        }

        // Check that extracted categories match expected categories
        if (expected.shouldExtract.length > 0) {
            const expectedCategories = new Set(
                expected.shouldExtract.map((e) => e.category)
            );
            const actualCategories = new Set(facts.map((f) => f.category));

            let categoryMatchCount = 0;
            for (const cat of expectedCategories) {
                if (actualCategories.has(cat)) categoryMatchCount++;
            }

            const categoryScore =
                expectedCategories.size > 0
                    ? categoryMatchCount / expectedCategories.size
                    : 1;

            scores.push({
                name: "Category Accuracy",
                score: categoryScore,
                metadata: {
                    expectedCategories: Array.from(expectedCategories),
                    actualCategories: Array.from(actualCategories),
                    distribution: categoryCounts,
                },
            });
        }
    }

    // =========================================================================
    // CONFIDENCE SANITY: Are confidence scores reasonable?
    // =========================================================================
    if (facts.length > 0) {
        const confidences = facts.map((f) => f.confidence);
        const avgConfidence =
            confidences.reduce((a, b) => a + b, 0) / confidences.length;
        const hasReasonableConfidence = confidences.every((c) => c >= 0 && c <= 1);

        scores.push({
            name: "Confidence Sanity",
            score: hasReasonableConfidence ? 1 : 0,
            metadata: {
                avgConfidence: avgConfidence.toFixed(2),
                min: Math.min(...confidences).toFixed(2),
                max: Math.max(...confidences).toFixed(2),
            },
        });
    }

    // =========================================================================
    // LATENCY
    // =========================================================================
    const latencyScore =
        output.latencyMs < 3000
            ? 1.0
            : output.latencyMs < 6000
              ? 0.7
              : output.latencyMs < 10000
                ? 0.4
                : 0.2;

    scores.push({
        name: "Latency",
        score: latencyScore,
        metadata: {
            latencyMs: output.latencyMs,
            tier:
                output.latencyMs < 3000
                    ? "fast"
                    : output.latencyMs < 6000
                      ? "medium"
                      : output.latencyMs < 10000
                        ? "slow"
                        : "very-slow",
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
