/**
 * Knowledge Extraction Evaluation
 *
 * Tests extraction quality from imported conversations.
 *
 * Usage:
 *   # Local mode (no Braintrust, console output only)
 *   npx tsx evals/extraction/eval.ts
 *
 *   # Braintrust mode (logs to dashboard)
 *   pnpm braintrust eval evals/extraction/eval.ts
 *
 *   # Compare all model candidates
 *   EXTRACTION_COMPARE_ALL=true npx tsx evals/extraction/eval.ts
 *
 *   # Test a specific model
 *   EXTRACTION_MODEL=anthropic/claude-haiku-4-5-20250514 npx tsx evals/extraction/eval.ts
 *
 *   # Debug mode - show failures
 *   EXTRACTION_DEBUG=true npx tsx evals/extraction/eval.ts
 *
 * Requirements:
 *   - OPENROUTER_API_KEY in .env.local
 *   - BRAINTRUST_API_KEY in .env.local (only for Braintrust mode)
 */

import "dotenv/config";

import { ExtractionScorer, type ExtractionOutput } from "./scorer";
import { extractionTestData, type ExtractionTestCase } from "./cases";
import {
    runExtractionEval,
    EXTRACTION_MODEL_CANDIDATES,
    type ExtractionModelCandidate,
} from "./runner";

// Production model
const PRODUCTION_MODEL = EXTRACTION_MODEL_CANDIDATES[0]; // Claude Sonnet 4.5

// Configuration
const isBraintrustMode = process.argv[1]?.includes("braintrust");

if (!process.env.OPENROUTER_API_KEY) {
    console.error("Missing OPENROUTER_API_KEY environment variable");
    process.exit(1);
}
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Determine which model(s) to test
const specifiedModel = process.env.EXTRACTION_MODEL;
const compareAll = process.env.EXTRACTION_COMPARE_ALL === "true";

let modelsToTest: ExtractionModelCandidate[];

if (specifiedModel) {
    const found = EXTRACTION_MODEL_CANDIDATES.filter((m) => m.id === specifiedModel);
    if (found.length === 0) {
        console.error(`Unknown model: ${specifiedModel}`);
        console.error("\nAvailable models:");
        for (const m of EXTRACTION_MODEL_CANDIDATES) {
            console.error(`   - ${m.id} (${m.name})`);
        }
        process.exit(1);
    }
    modelsToTest = found;
} else if (compareAll) {
    modelsToTest = [...EXTRACTION_MODEL_CANDIDATES];
} else {
    modelsToTest = [PRODUCTION_MODEL];
}

console.log(`\nTesting ${modelsToTest.length} Extraction model(s):`);
for (const model of modelsToTest) {
    console.log(`   - ${model.name} (${model.id})`);
}
console.log("");

// Parallel execution helper
async function runWithConcurrency<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    concurrency: number
): Promise<R[]> {
    const results: R[] = [];
    let index = 0;

    async function worker() {
        while (index < items.length) {
            const i = index++;
            results[i] = await fn(items[i]);
        }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));
    return results;
}

/**
 * Local mode: run evals and print results to console
 */
async function runLocal() {
    const concurrency = 5;
    const debugMode = process.env.EXTRACTION_DEBUG === "true";

    interface ModelResult {
        model: string;
        scores: Record<string, { total: number; count: number }>;
        errors: number;
        avgLatency: number;
    }

    const results: ModelResult[] = [];

    for (const model of modelsToTest) {
        console.log(`\n${"=".repeat(60)}`);
        console.log(`Testing: ${model.name}`);
        console.log(`${"=".repeat(60)}`);

        const scores: Record<string, { total: number; count: number }> = {};
        let errors = 0;
        let totalLatency = 0;
        let successfulRuns = 0;
        let completed = 0;

        const outputs = await runWithConcurrency(
            extractionTestData,
            async (testCase) => {
                try {
                    const output = await runExtractionEval(testCase.input, {
                        extractionModel: model.id,
                        apiKey: OPENROUTER_API_KEY,
                    });
                    completed++;
                    process.stdout.write(
                        `\r  ${completed}/${extractionTestData.length}...`
                    );
                    return { testCase, output, error: null };
                } catch (error) {
                    completed++;
                    return { testCase, output: null, error };
                }
            },
            concurrency
        );

        for (const { testCase, output, error } of outputs) {
            if (error || !output) {
                errors++;
                continue;
            }

            totalLatency += output.latencyMs;
            successfulRuns++;

            const caseScores = ExtractionScorer({
                input: testCase.input,
                output,
                expected: testCase.expected,
            });

            for (const score of caseScores) {
                if (!scores[score.name]) scores[score.name] = { total: 0, count: 0 };
                scores[score.name].total += score.score;
                scores[score.name].count += 1;

                // Debug: show failures
                if (debugMode && score.score < 1 && score.name !== "Latency") {
                    console.log(`\n  FAIL [${score.name}]: ${testCase.input.id}`);
                    console.log(`    Score: ${score.score.toFixed(2)}`);
                    if (score.metadata) {
                        console.log(`    Metadata: ${JSON.stringify(score.metadata)}`);
                    }
                }
            }

            if (!output.isValid) errors++;
        }

        console.log(`\r  Done: ${extractionTestData.length} cases      `);

        results.push({
            model: model.name,
            scores,
            errors,
            avgLatency: successfulRuns > 0 ? totalLatency / successfulRuns : 0,
        });

        // Print results for this model
        for (const [name, data] of Object.entries(scores)) {
            const pct = ((data.total / data.count) * 100).toFixed(1);
            console.log(`  ${name}: ${pct}%`);
        }
        console.log(
            `  Avg Latency: ${results[results.length - 1].avgLatency.toFixed(0)}ms`
        );
        if (errors > 0) {
            console.log(`  Errors: ${errors}`);
        }
    }

    // Summary table
    if (results.length > 1) {
        console.log(`\n\n${"=".repeat(80)}`);
        console.log("SUMMARY");
        console.log(`${"=".repeat(80)}\n`);

        const scoreNames = Object.keys(results[0].scores);
        console.log(
            ["Model", ...scoreNames, "Latency"].map((h) => h.padEnd(18)).join(" | ")
        );
        console.log("-".repeat(80));

        for (const r of results) {
            const row = [r.model.substring(0, 18)];
            for (const name of scoreNames) {
                const data = r.scores[name];
                row.push(
                    data ? `${((data.total / data.count) * 100).toFixed(1)}%` : "-"
                );
            }
            row.push(`${r.avgLatency.toFixed(0)}ms`);
            console.log(row.map((c) => c.padEnd(18)).join(" | "));
        }
    }
}

/**
 * Braintrust mode: use Braintrust Eval for dashboard
 */
async function runBraintrust() {
    const { Eval } = await import("braintrust");

    for (const model of modelsToTest) {
        Eval(`Knowledge Extraction - ${model.name}`, {
            data: () =>
                extractionTestData.map((t) => ({
                    input: t.input,
                    expected: t.expected,
                    tags: t.tags,
                    metadata: {
                        id: t.input.id,
                        description: t.input.description,
                    },
                })),

            task: async (
                input: ExtractionTestCase["input"]
            ): Promise<ExtractionOutput> => {
                return runExtractionEval(input, {
                    extractionModel: model.id,
                    apiKey: OPENROUTER_API_KEY,
                });
            },

            scores: [ExtractionScorer],

            metadata: {
                extractionModel: model.id,
                extractionModelName: model.name,
                costPer1M: model.costPer1M,
                commit: process.env.COMMIT_SHA ?? "local",
                environment: process.env.NODE_ENV ?? "development",
                testCount: extractionTestData.length,
            },
        });
    }
}

// Run appropriate mode
if (isBraintrustMode) {
    runBraintrust();
} else {
    runLocal().catch(console.error);
}
