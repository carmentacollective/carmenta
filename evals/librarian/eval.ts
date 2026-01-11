/**
 * Knowledge Librarian Evaluation
 *
 * Tests extraction quality, path selection, and action decisions.
 *
 * Usage:
 *   # Local mode (no Braintrust, console output only)
 *   npx tsx evals/librarian/eval.ts
 *
 *   # Braintrust mode (logs to dashboard)
 *   pnpm braintrust eval evals/librarian/eval.ts
 *
 *   # Compare all model candidates
 *   LIBRARIAN_COMPARE_ALL=true npx tsx evals/librarian/eval.ts
 *
 *   # Test a specific model
 *   LIBRARIAN_MODEL=x-ai/grok-4.1-fast npx tsx evals/librarian/eval.ts
 *
 * Requirements:
 *   - OPENROUTER_API_KEY in .env.local
 *   - BRAINTRUST_API_KEY in .env.local (only for Braintrust mode)
 */

import "dotenv/config";

import { LibrarianScorer, type LibrarianOutput } from "./scorer";
import { librarianTestData, type LibrarianTestInput } from "./cases";
import {
    runLibrarianEval,
    LIBRARIAN_MODEL_CANDIDATES,
    type LibrarianModelCandidate,
} from "./runner";

// Production librarian model (from lib/model-config.ts LIBRARIAN_FALLBACK_CHAIN)
const PRODUCTION_MODEL = LIBRARIAN_MODEL_CANDIDATES[0]; // Claude Haiku 4.5

// Configuration
const isBraintrustMode = process.argv[1]?.includes("braintrust");

if (!process.env.OPENROUTER_API_KEY) {
    console.error("Missing OPENROUTER_API_KEY environment variable");
    process.exit(1);
}
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Determine which model(s) to test
const specifiedModel = process.env.LIBRARIAN_MODEL;
const compareAll = process.env.LIBRARIAN_COMPARE_ALL === "true";
const filterTags = process.env.LIBRARIAN_TAGS?.split(",").map((t) => t.trim());

let modelsToTest: LibrarianModelCandidate[];

if (specifiedModel) {
    const found = LIBRARIAN_MODEL_CANDIDATES.filter((m) => m.id === specifiedModel);
    if (found.length === 0) {
        console.error(`Unknown model: ${specifiedModel}`);
        console.error("\nAvailable models:");
        for (const m of LIBRARIAN_MODEL_CANDIDATES) {
            console.error(`   - ${m.id} (${m.name})`);
        }
        process.exit(1);
    }
    modelsToTest = found;
} else if (compareAll) {
    modelsToTest = [...LIBRARIAN_MODEL_CANDIDATES];
} else {
    modelsToTest = [PRODUCTION_MODEL];
}

console.log(`\nTesting ${modelsToTest.length} Librarian model(s):`);
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
    const quickMode = process.env.LIBRARIAN_QUICK === "true";
    const concurrency = 10;

    // Filter by tags if specified
    const filteredCases = filterTags
        ? librarianTestData.filter((t) =>
              t.tags?.some((tag) => filterTags.includes(tag))
          )
        : librarianTestData;

    if (filterTags) {
        console.log(
            `Tag filter: [${filterTags.join(", ")}] → ${filteredCases.length} cases`
        );
    }

    // In quick mode, sample 10 diverse test cases
    const testCases = quickMode
        ? filteredCases.filter((_, i) => i % 5 === 0).slice(0, 10)
        : filteredCases;

    if (quickMode) {
        console.log(`Quick mode: testing ${testCases.length} cases (10% sample)`);
    }

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
            testCases,
            async (testCase) => {
                try {
                    const output = await runLibrarianEval(testCase.input, {
                        librarianModel: model.id,
                        apiKey: OPENROUTER_API_KEY,
                    });
                    completed++;
                    process.stdout.write(`\r  ${completed}/${testCases.length}...`);
                    return { testCase, output, error: null };
                } catch (error) {
                    completed++;
                    return { testCase, output: null, error };
                }
            },
            concurrency
        );

        const debugMode = process.env.LIBRARIAN_DEBUG === "true";

        for (const { testCase, output, error } of outputs) {
            if (error || !output) {
                errors++;
                continue;
            }

            totalLatency += output.latencyMs;
            successfulRuns++;

            const caseScores = LibrarianScorer({
                input: testCase.input,
                output,
                expected: testCase.expected,
            });

            for (const score of caseScores) {
                if (!scores[score.name]) scores[score.name] = { total: 0, count: 0 };
                scores[score.name].total += score.score;
                scores[score.name].count += 1;

                // Debug: show failures
                if (debugMode && score.score < 1) {
                    const createCall = output.toolCalls.find(
                        (c) => c.tool === "createDocument"
                    );
                    const path = createCall?.args?.path || "(no path)";
                    console.log(`\n  FAIL [${score.name}]: ${testCase.input.id}`);
                    console.log(`    Expected: ${testCase.expected.expectedPath}`);
                    console.log(`    Got: ${path}`);
                }
            }

            if (!output.isValid) errors++;
        }

        console.log(`\r  Done: ${testCases.length} cases      `);

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
            `  Latency: ${results[results.length - 1].avgLatency.toFixed(0)}ms`
        );
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
        Eval(`Knowledge Librarian - ${model.name}`, {
            data: () =>
                librarianTestData.map((t) => ({
                    input: t.input,
                    expected: t.expected,
                    tags: t.tags,
                    metadata: {
                        id: t.input.id,
                        category: t.input.category,
                        description: t.input.description,
                    },
                })),

            task: async (input: LibrarianTestInput): Promise<LibrarianOutput> => {
                return runLibrarianEval(input, {
                    librarianModel: model.id,
                    apiKey: OPENROUTER_API_KEY,
                });
            },

            scores: [LibrarianScorer],

            metadata: {
                librarianModel: model.id,
                librarianModelName: model.name,
                costPer1M: model.costPer1M,
                commit: process.env.COMMIT_SHA ?? "local",
                environment: process.env.NODE_ENV ?? "development",
                testCount: librarianTestData.length,
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
