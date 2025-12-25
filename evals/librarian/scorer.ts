/**
 * Librarian Scorer
 *
 * Evaluates the quality of Knowledge Librarian decisions:
 * - Extraction decision (should save or not)
 * - Path selection accuracy
 * - Action selection (create vs update vs append)
 * - Content quality
 */

import type { LibrarianExpectations } from "./cases";

export interface LibrarianToolCall {
    tool:
        | "listKnowledge"
        | "readDocument"
        | "createDocument"
        | "updateDocument"
        | "appendToDocument"
        | "notifyUser";
    args: Record<string, unknown>;
    result?: unknown;
}

export interface LibrarianOutput {
    /** Tool calls made by the Librarian */
    toolCalls: LibrarianToolCall[];
    /** Final reasoning/explanation from the Librarian */
    reasoning?: string;
    /** Whether the Librarian produced valid output */
    isValid: boolean;
    /** Error message if failed */
    error?: string;
    /** Execution time in milliseconds */
    latencyMs: number;
}

interface ScorerArgs {
    input: unknown;
    output: LibrarianOutput;
    expected: LibrarianExpectations;
}

interface Score {
    name: string;
    score: number;
    metadata?: Record<string, unknown>;
}

/**
 * Extract the write action from tool calls
 */
function getWriteAction(toolCalls: LibrarianToolCall[]): {
    action: "create" | "update" | "append" | "none";
    path?: string;
    content?: string;
} {
    // Check for create
    const createCall = toolCalls.find((tc) => tc.tool === "createDocument");
    if (createCall) {
        return {
            action: "create",
            path: createCall.args.path as string | undefined,
            content: createCall.args.content as string | undefined,
        };
    }

    // Check for update
    const updateCall = toolCalls.find((tc) => tc.tool === "updateDocument");
    if (updateCall) {
        return {
            action: "update",
            path: updateCall.args.path as string | undefined,
            content: updateCall.args.content as string | undefined,
        };
    }

    // Check for append
    const appendCall = toolCalls.find((tc) => tc.tool === "appendToDocument");
    if (appendCall) {
        return {
            action: "append",
            path: appendCall.args.path as string | undefined,
            content: appendCall.args.content as string | undefined,
        };
    }

    return { action: "none" };
}

/**
 * Check if a path matches the expected pattern
 */
function pathMatches(actual: string | undefined, expected: string | RegExp): boolean {
    if (!actual) return false;

    if (expected instanceof RegExp) {
        return expected.test(actual);
    }

    return actual.toLowerCase() === expected.toLowerCase();
}

/**
 * Librarian scorer that validates extraction and storage decisions.
 */
export function LibrarianScorer({ output, expected }: ScorerArgs): Score[] {
    const scores: Score[] = [];

    // Validity check
    scores.push({
        name: "Valid Output",
        score: output.isValid ? 1 : 0,
        metadata: {
            error: output.error,
            toolCallCount: output.toolCalls.length,
        },
    });

    if (!output.isValid) {
        // Add zero scores for remaining metrics if invalid
        scores.push({
            name: "Extraction Decision",
            score: 0,
            metadata: { reason: "invalid output" },
        });
        return scores;
    }

    const writeAction = getWriteAction(output.toolCalls);
    const didSave = writeAction.action !== "none";

    // Extraction decision score
    const extractionCorrect = didSave === expected.shouldSave;
    scores.push({
        name: "Extraction Decision",
        score: extractionCorrect ? 1 : 0,
        metadata: {
            expected: expected.shouldSave ? "save" : "no-save",
            actual: didSave ? "saved" : "no-save",
            action: writeAction.action,
        },
    });

    // If we expected no save and got no save, we're done
    if (!expected.shouldSave && !didSave) {
        scores.push({
            name: "Correct No-Save",
            score: 1,
            metadata: { reason: "correctly identified nothing to save" },
        });
        return scores;
    }

    // If we expected save but didn't get one, fail remaining scores
    if (expected.shouldSave && !didSave) {
        if (expected.expectedPath) {
            scores.push({
                name: "Path Selection",
                score: 0,
                metadata: { reason: "no save action taken" },
            });
        }
        if (expected.expectedAction) {
            scores.push({
                name: "Action Selection",
                score: 0,
                metadata: { reason: "no save action taken" },
            });
        }
        return scores;
    }

    // Path selection score
    if (expected.expectedPath) {
        const pathCorrect = pathMatches(writeAction.path, expected.expectedPath);
        scores.push({
            name: "Path Selection",
            score: pathCorrect ? 1 : 0,
            metadata: {
                expected: expected.expectedPath.toString(),
                actual: writeAction.path,
            },
        });
    }

    // Action selection score (create vs update vs append)
    if (expected.expectedAction) {
        const actionCorrect = writeAction.action === expected.expectedAction;
        scores.push({
            name: "Action Selection",
            score: actionCorrect ? 1 : 0,
            metadata: {
                expected: expected.expectedAction,
                actual: writeAction.action,
            },
        });
    }

    // Update target score
    if (
        expected.updateTarget &&
        (expected.expectedAction === "update" || expected.expectedAction === "append")
    ) {
        const targetCorrect = writeAction.path === expected.updateTarget;
        scores.push({
            name: "Update Target",
            score: targetCorrect ? 1 : 0,
            metadata: {
                expected: expected.updateTarget,
                actual: writeAction.path,
            },
        });
    }

    // Content patterns score
    if (
        expected.contentPatterns &&
        expected.contentPatterns.length > 0 &&
        writeAction.content
    ) {
        const content = writeAction.content.toLowerCase();
        const matchedPatterns = expected.contentPatterns.filter((pattern) =>
            pattern.test(content)
        );
        const patternScore = matchedPatterns.length / expected.contentPatterns.length;

        scores.push({
            name: "Content Patterns",
            score: patternScore,
            metadata: {
                expectedPatterns: expected.contentPatterns.map((p) => p.toString()),
                matchedCount: matchedPatterns.length,
                totalPatterns: expected.contentPatterns.length,
                contentPreview: content.slice(0, 200),
            },
        });
    }

    // Excluded content score
    if (
        expected.excludedContent &&
        expected.excludedContent.length > 0 &&
        writeAction.content
    ) {
        const content = writeAction.content.toLowerCase();
        const foundExcluded = expected.excludedContent.filter((pattern) =>
            pattern.test(content)
        );
        const excludedScore = foundExcluded.length === 0 ? 1 : 0;

        scores.push({
            name: "Excluded Content",
            score: excludedScore,
            metadata: {
                excludedPatterns: expected.excludedContent.map((p) => p.toString()),
                foundExcluded: foundExcluded.map((p) => p.toString()),
            },
        });
    }

    // Latency score
    const latencyScore =
        output.latencyMs < 2000
            ? 1.0
            : output.latencyMs < 5000
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
                output.latencyMs < 2000
                    ? "fast"
                    : output.latencyMs < 5000
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
