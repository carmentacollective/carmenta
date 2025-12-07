#!/usr/bin/env bun
/**
 * Carmenta Integration Test Runner
 *
 * Sends test queries to the API and validates:
 * - Model routing decisions
 * - Temperature selection
 * - Reasoning configuration
 * - Tool invocations
 * - Response streaming
 *
 * Usage:
 *   bun scripts/evals/run-integration-tests.ts [options]
 *
 * Options:
 *   --fast         Skip slow tests (deep research)
 *   --score        Enable LLM-as-judge quality scoring (requires OPENROUTER_API_KEY)
 *   --category=X   Run only tests in category (routing, tools, reasoning, overrides, edge-cases)
 *   --test=ID      Run a single test by ID
 *   --verbose      Show full response content
 *   --base-url=X   Override API base URL (default: http://localhost:3000)
 */

import {
    getAllTests,
    getFastTests,
    getTestsByCategory,
    getTestById,
    type TestQuery,
} from "./test-queries";
import {
    evaluateResponse,
    isScoringAvailable,
    formatScoreCompact,
    type QualityScores,
} from "./evaluators";

// Parse CLI args
const args = process.argv.slice(2);
const flags = {
    fast: args.includes("--fast"),
    verbose: args.includes("--verbose"),
    score: args.includes("--score"),
    category: args
        .find((a) => a.startsWith("--category="))
        ?.substring("--category=".length),
    testId: args.find((a) => a.startsWith("--test="))?.substring("--test=".length),
    baseUrl:
        args
            .find((a) => a.startsWith("--base-url="))
            ?.substring("--base-url=".length) ?? "http://localhost:3000",
};

// Load JWT from environment
const JWT_TOKEN = process.env.TEST_USER_TOKEN;
if (!JWT_TOKEN) {
    console.error("ERROR: TEST_USER_TOKEN not set in environment");
    console.error(
        "Create a long-lived JWT in Clerk Dashboard and add it to .env.local"
    );
    process.exit(1);
}

interface TestResult {
    query: TestQuery;
    success: boolean;
    duration: number;
    response: {
        status: number;
        model?: string;
        temperature?: number;
        reasoning?: { enabled: boolean; effort?: string; maxTokens?: number };
        explanation?: string;
        connectionId?: string;
        toolsCalled: string[];
        responseText: string;
        error?: string;
    };
    validations: {
        name: string;
        passed: boolean;
        expected: string;
        actual: string;
    }[];
    scores?: QualityScores;
}

/**
 * Build UIMessage format required by the API
 */
function buildMessage(content: string) {
    return {
        id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "user",
        content,
        parts: [{ type: "text", text: content }],
    };
}

/**
 * Parse concierge headers from response
 */
function parseHeaders(headers: Headers) {
    const modelId = headers.get("X-Concierge-Model-Id");
    const temperature = headers.get("X-Concierge-Temperature");
    const explanation = headers.get("X-Concierge-Explanation");
    const reasoningRaw = headers.get("X-Concierge-Reasoning");
    const connectionId = headers.get("X-Connection-Id");

    let reasoning:
        | { enabled: boolean; effort?: string; maxTokens?: number }
        | undefined;
    if (reasoningRaw) {
        try {
            reasoning = JSON.parse(decodeURIComponent(reasoningRaw));
        } catch {
            // Ignore parse errors
        }
    }

    return {
        model: modelId ?? undefined,
        temperature: temperature ? parseFloat(temperature) : undefined,
        explanation: explanation ? decodeURIComponent(explanation) : undefined,
        reasoning,
        connectionId: connectionId ?? undefined,
    };
}

/**
 * Consume streaming response and extract content
 *
 * The API uses toUIMessageStreamResponse which outputs SSE format:
 * - data: {"type":"text-delta","id":"...","delta":"text"}
 * - data: {"type":"tool-input-start","toolCallId":"...","toolName":"getWeather"}
 * - data: {"type":"tool-input-available","toolCallId":"...","toolName":"getWeather","input":{...}}
 */
async function consumeStream(
    response: Response
): Promise<{ text: string; toolsCalled: string[] }> {
    const reader = response.body?.getReader();
    if (!reader) {
        return { text: "", toolsCalled: [] };
    }

    const decoder = new TextDecoder();
    let fullText = "";
    let extractedText = "";
    const toolsCalled: string[] = [];

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;

            // Parse SSE format lines: "data: {...}\n\n"
            const lines = chunk.split("\n");
            for (const line of lines) {
                // SSE data line format
                if (line.startsWith("data: ")) {
                    try {
                        const data = JSON.parse(line.slice(6));

                        // Extract text content from text-delta chunks
                        if (data.type === "text-delta" && data.delta) {
                            extractedText += data.delta;
                        }

                        // Tool invocation - tool-input-start or tool-input-available
                        if (
                            (data.type === "tool-input-start" ||
                                data.type === "tool-input-available") &&
                            data.toolName &&
                            !toolsCalled.includes(data.toolName)
                        ) {
                            toolsCalled.push(data.toolName);
                        }
                    } catch {
                        // Ignore parse errors for non-JSON lines
                    }
                }

                // Also support legacy data-stream protocol format (e: and 9: prefixes)
                // in case some endpoints still use toDataStreamResponse
                if (line.startsWith("e:") || line.startsWith("9:")) {
                    try {
                        const data = JSON.parse(line.slice(2));
                        if (data.toolName && !toolsCalled.includes(data.toolName)) {
                            toolsCalled.push(data.toolName);
                        }
                    } catch {
                        // Ignore parse errors
                    }
                }

                // Legacy text format: 0:"text content"
                if (line.startsWith("0:")) {
                    const match = line.match(/^0:"([^"\\]*(?:\\.[^"\\]*)*)"/);
                    if (match) {
                        try {
                            extractedText += JSON.parse(`"${match[1]}"`);
                        } catch {
                            extractedText += match[1];
                        }
                    }
                }
            }
        }
    } catch (error) {
        // Stream read error
    }

    return { text: extractedText || fullText.slice(0, 1000), toolsCalled };
}

/**
 * Run a single test query
 */
async function runTest(query: TestQuery): Promise<TestResult> {
    const startTime = Date.now();
    const validations: TestResult["validations"] = [];

    try {
        const body: Record<string, unknown> = {
            messages: [buildMessage(query.content)],
        };

        // Add overrides if specified
        if (query.overrides) {
            if (query.overrides.modelOverride) {
                body.modelOverride = query.overrides.modelOverride;
            }
            if (query.overrides.temperatureOverride !== undefined) {
                body.temperatureOverride = query.overrides.temperatureOverride;
            }
            if (query.overrides.reasoningOverride) {
                body.reasoningOverride = query.overrides.reasoningOverride;
            }
        }

        const response = await fetch(`${flags.baseUrl}/api/connection`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${JWT_TOKEN}`,
            },
            body: JSON.stringify(body),
        });

        const duration = Date.now() - startTime;
        const headers = parseHeaders(response.headers);

        // Handle error responses
        if (!response.ok) {
            let errorText = "";
            // Clone response before reading body since it can only be consumed once
            const clonedResponse = response.clone();
            try {
                const errorBody = await response.json();
                errorText = errorBody.error || JSON.stringify(errorBody);
            } catch {
                errorText = await clonedResponse.text();
            }

            validations.push({
                name: "HTTP Status",
                passed: query.expectations.shouldSucceed === false,
                expected: query.expectations.shouldSucceed ? "200" : "non-200",
                actual: String(response.status),
            });

            return {
                query,
                success: query.expectations.shouldSucceed === false,
                duration,
                response: {
                    status: response.status,
                    ...headers,
                    toolsCalled: [],
                    responseText: "",
                    error: errorText,
                },
                validations,
            };
        }

        // Consume streaming response
        const { text, toolsCalled } = await consumeStream(response);

        // Validate expectations
        const exp = query.expectations;

        // Status check
        if (exp.shouldSucceed !== undefined) {
            validations.push({
                name: "HTTP Status",
                passed: exp.shouldSucceed === (response.status === 200),
                expected: exp.shouldSucceed ? "200" : "non-200",
                actual: String(response.status),
            });
        }

        // Model check
        if (exp.model !== undefined && exp.model !== null) {
            const modelPatterns = exp.model.split("|");
            const modelMatches = modelPatterns.some((p) =>
                headers.model?.toLowerCase().includes(p.toLowerCase())
            );
            validations.push({
                name: "Model",
                passed: modelMatches,
                expected: exp.model,
                actual: headers.model ?? "unknown",
            });
        }

        // Temperature check
        if (exp.temperatureRange !== undefined && exp.temperatureRange !== null) {
            const [min, max] = exp.temperatureRange;
            const temp = headers.temperature ?? -1;
            validations.push({
                name: "Temperature",
                passed: temp >= min && temp <= max,
                expected: `[${min}, ${max}]`,
                actual: String(temp),
            });
        }

        // Reasoning check
        if (exp.reasoningEnabled !== undefined && exp.reasoningEnabled !== null) {
            const actualEnabled = headers.reasoning?.enabled ?? false;
            validations.push({
                name: "Reasoning Enabled",
                passed: actualEnabled === exp.reasoningEnabled,
                expected: String(exp.reasoningEnabled),
                actual: String(actualEnabled),
            });
        }

        // Tool call check
        if (exp.toolCalled !== undefined && exp.toolCalled !== null) {
            const toolWasCalled = toolsCalled.includes(exp.toolCalled);
            validations.push({
                name: "Tool Called",
                passed: toolWasCalled,
                expected: exp.toolCalled,
                actual: toolsCalled.length > 0 ? toolsCalled.join(", ") : "none",
            });
        }

        // Response content check
        if (exp.responseContains !== undefined && exp.responseContains !== null) {
            const contains = text
                .toLowerCase()
                .includes(exp.responseContains.toLowerCase());
            validations.push({
                name: "Response Contains",
                passed: contains,
                expected: `contains "${exp.responseContains}"`,
                actual: contains ? "yes" : "no",
            });
        }

        const allPassed = validations.every((v) => v.passed);

        return {
            query,
            success: allPassed,
            duration,
            response: {
                status: response.status,
                ...headers,
                toolsCalled,
                responseText: text,
            },
            validations,
        };
    } catch (error) {
        const duration = Date.now() - startTime;
        return {
            query,
            success: false,
            duration,
            response: {
                status: 0,
                toolsCalled: [],
                responseText: "",
                error: error instanceof Error ? error.message : String(error),
            },
            validations: [
                {
                    name: "Request",
                    passed: false,
                    expected: "no error",
                    actual: error instanceof Error ? error.message : String(error),
                },
            ],
        };
    }
}

/**
 * Format duration for display
 */
function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Print test result
 */
function printResult(result: TestResult, index: number, total: number) {
    const status = result.success ? "\x1b[32m PASS \x1b[0m" : "\x1b[31m FAIL \x1b[0m";
    const duration = formatDuration(result.duration);

    console.log(`\n[${index + 1}/${total}] ${status} ${result.query.id} (${duration})`);
    console.log(`   ${result.query.description}`);

    if (result.response.model) {
        console.log(
            `   Model: ${result.response.model} | Temp: ${result.response.temperature}`
        );
    }

    if (result.response.reasoning) {
        const r = result.response.reasoning;
        console.log(
            `   Reasoning: ${r.enabled ? "enabled" : "disabled"}${r.effort ? ` (${r.effort})` : ""}${r.maxTokens ? ` (${r.maxTokens} tokens)` : ""}`
        );
    }

    if (result.response.toolsCalled.length > 0) {
        console.log(`   Tools: ${result.response.toolsCalled.join(", ")}`);
    }

    // Show validation results
    for (const v of result.validations) {
        const icon = v.passed ? "\x1b[32m\u2713\x1b[0m" : "\x1b[31m\u2717\x1b[0m";
        if (!v.passed) {
            console.log(
                `   ${icon} ${v.name}: expected ${v.expected}, got ${v.actual}`
            );
        } else if (flags.verbose) {
            console.log(`   ${icon} ${v.name}: ${v.actual}`);
        }
    }

    if (result.response.error) {
        console.log(`   \x1b[31mError: ${result.response.error}\x1b[0m`);
    }

    if (flags.verbose && result.response.responseText) {
        const preview = result.response.responseText.slice(0, 200);
        console.log(
            `   Response: ${preview}${result.response.responseText.length > 200 ? "..." : ""}`
        );
    }

    if (result.response.explanation) {
        console.log(`   \x1b[90mExplanation: ${result.response.explanation}\x1b[0m`);
    }

    // Show quality scores if available
    if (result.scores) {
        console.log(`   \x1b[36mQuality: ${formatScoreCompact(result.scores)}\x1b[0m`);

        // Show improvement feedback for any dimension that scored below 100%
        const scores = result.scores;
        if (scores.correctness.score < 1 && scores.correctness.issue) {
            console.log(
                `   \x1b[33m→ Correctness (${scores.correctness.label}):\x1b[0m ${scores.correctness.issue}`
            );
            if (scores.correctness.fix) {
                console.log(`     \x1b[32mFix:\x1b[0m ${scores.correctness.fix}`);
            }
        }
        if (scores.helpfulness.score < 1 && scores.helpfulness.issue) {
            console.log(
                `   \x1b[33m→ Helpfulness (${scores.helpfulness.label}):\x1b[0m ${scores.helpfulness.issue}`
            );
            if (scores.helpfulness.fix) {
                console.log(`     \x1b[32mFix:\x1b[0m ${scores.helpfulness.fix}`);
            }
        }
        if (scores.relevance.score < 1 && scores.relevance.issue) {
            console.log(
                `   \x1b[33m→ Relevance (${scores.relevance.label}):\x1b[0m ${scores.relevance.issue}`
            );
            if (scores.relevance.fix) {
                console.log(`     \x1b[32mFix:\x1b[0m ${scores.relevance.fix}`);
            }
        }
    }
}

/**
 * Print summary
 */
function printSummary(results: TestResult[]) {
    const passed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    console.log("\n" + "=".repeat(60));
    console.log("SUMMARY");
    console.log("=".repeat(60));
    console.log(
        `Total: ${results.length} | \x1b[32mPassed: ${passed}\x1b[0m | \x1b[31mFailed: ${failed}\x1b[0m`
    );
    console.log(`Duration: ${formatDuration(totalDuration)}`);

    // Group by category
    const byCategory = new Map<string, TestResult[]>();
    for (const r of results) {
        const cat = r.query.category;
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat)!.push(r);
    }

    console.log("\nBy Category:");
    for (const [cat, catResults] of byCategory) {
        const catPassed = catResults.filter((r) => r.success).length;
        const status =
            catPassed === catResults.length
                ? "\x1b[32m\u2713\x1b[0m"
                : "\x1b[31m\u2717\x1b[0m";
        console.log(`  ${status} ${cat}: ${catPassed}/${catResults.length}`);
    }

    if (failed > 0) {
        console.log("\nFailed Tests:");
        for (const r of results.filter((r) => !r.success)) {
            console.log(`  - ${r.query.id}: ${r.query.description}`);
        }
    }

    // Quality scores summary
    const scoredResults = results.filter((r) => r.scores);
    if (scoredResults.length > 0) {
        const avgCorrectness =
            scoredResults.reduce((sum, r) => sum + r.scores!.correctness.score, 0) /
            scoredResults.length;
        const avgHelpfulness =
            scoredResults.reduce((sum, r) => sum + r.scores!.helpfulness.score, 0) /
            scoredResults.length;
        const avgRelevance =
            scoredResults.reduce((sum, r) => sum + r.scores!.relevance.score, 0) /
            scoredResults.length;
        const avgOverall =
            scoredResults.reduce((sum, r) => sum + r.scores!.overall, 0) /
            scoredResults.length;

        console.log("\n\x1b[36mQuality Scores (LLM-as-Judge):\x1b[0m");
        console.log(`  Correctness: ${(avgCorrectness * 100).toFixed(0)}%`);
        console.log(`  Helpfulness: ${(avgHelpfulness * 100).toFixed(0)}%`);
        console.log(`  Relevance:   ${(avgRelevance * 100).toFixed(0)}%`);
        console.log(`  \x1b[1mOverall:      ${(avgOverall * 100).toFixed(0)}%\x1b[0m`);

        // Improvement recommendations for tests with low scores
        const lowScoringTests = scoredResults.filter((r) => r.scores!.overall < 1);
        if (lowScoringTests.length > 0) {
            console.log("\n\x1b[33m📋 Improvement Recommendations:\x1b[0m");
            for (const r of lowScoringTests) {
                const scores = r.scores!;
                console.log(
                    `\n  \x1b[1m${r.query.id}\x1b[0m (${(scores.overall * 100).toFixed(0)}%)`
                );
                console.log(
                    `  Query: "${r.query.content.slice(0, 60)}${r.query.content.length > 60 ? "..." : ""}"`
                );

                if (scores.correctness.score < 1 && scores.correctness.issue) {
                    console.log(
                        `  \x1b[33m• Correctness Issue:\x1b[0m ${scores.correctness.issue}`
                    );
                    if (scores.correctness.fix) {
                        console.log(
                            `    \x1b[32m→ Fix:\x1b[0m ${scores.correctness.fix}`
                        );
                    }
                }
                if (scores.helpfulness.score < 1 && scores.helpfulness.issue) {
                    console.log(
                        `  \x1b[33m• Helpfulness Issue:\x1b[0m ${scores.helpfulness.issue}`
                    );
                    if (scores.helpfulness.fix) {
                        console.log(
                            `    \x1b[32m→ Fix:\x1b[0m ${scores.helpfulness.fix}`
                        );
                    }
                }
                if (scores.relevance.score < 1 && scores.relevance.issue) {
                    console.log(
                        `  \x1b[33m• Relevance Issue:\x1b[0m ${scores.relevance.issue}`
                    );
                    if (scores.relevance.fix) {
                        console.log(
                            `    \x1b[32m→ Fix:\x1b[0m ${scores.relevance.fix}`
                        );
                    }
                }
            }
        }
    }
}

/**
 * Main entry point
 */
async function main() {
    console.log("=".repeat(60));
    console.log("CARMENTA INTEGRATION TESTS");
    console.log("=".repeat(60));
    console.log(`Base URL: ${flags.baseUrl}`);
    console.log(`JWT Token: ${JWT_TOKEN!.slice(0, 20)}...`);

    // Check scoring availability
    const scoringEnabled = flags.score && isScoringAvailable();
    if (flags.score && !isScoringAvailable()) {
        console.log(
            "\x1b[33mWarning: --score flag set but OPENROUTER_API_KEY not configured\x1b[0m"
        );
    } else if (scoringEnabled) {
        console.log(`Scoring: \x1b[36menabled (GPT-5.1 judge)\x1b[0m`);
    }

    // Select tests to run
    let tests: TestQuery[];
    if (flags.testId) {
        const test = getTestById(flags.testId);
        if (!test) {
            console.error(`Test not found: ${flags.testId}`);
            process.exit(1);
        }
        tests = [test];
    } else if (flags.category) {
        tests = getTestsByCategory(flags.category as TestQuery["category"]);
        if (tests.length === 0) {
            console.error(`No tests found for category: ${flags.category}`);
            process.exit(1);
        }
    } else if (flags.fast) {
        tests = getFastTests();
    } else {
        tests = getAllTests();
    }

    console.log(`Running ${tests.length} tests...\n`);

    // Run tests sequentially (to avoid rate limits and for clearer output)
    const results: TestResult[] = [];
    for (let i = 0; i < tests.length; i++) {
        const test = tests[i];
        if (test.slow && flags.fast) {
            console.log(`\n[${i + 1}/${tests.length}] SKIP ${test.id} (slow test)`);
            continue;
        }

        const result = await runTest(test);

        // Run quality scoring if enabled and we have response text
        if (scoringEnabled && result.response.responseText && result.success) {
            try {
                result.scores = await evaluateResponse(
                    test.content,
                    result.response.responseText
                );
            } catch (error) {
                console.log(
                    `   \x1b[33mScoring failed: ${error instanceof Error ? error.message : "Unknown error"}\x1b[0m`
                );
            }
        }

        results.push(result);
        printResult(result, i, tests.length);
    }

    printSummary(results);

    // Exit with error code if any tests failed
    const failed = results.filter((r) => !r.success).length;
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
