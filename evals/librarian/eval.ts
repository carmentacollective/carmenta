/**
 * Knowledge Librarian Evaluation
 *
 * Braintrust-native evaluation for comparing Librarian model candidates.
 * Tests extraction quality, path selection, and action decisions across
 * different models to determine the optimal Librarian.
 *
 * Usage:
 *   # Run with all model candidates:
 *   pnpm braintrust eval evals/librarian/eval.ts
 *
 *   # Run with specific model:
 *   LIBRARIAN_MODEL=anthropic/claude-sonnet-4.5 pnpm braintrust eval evals/librarian/eval.ts
 *
 * Requirements:
 *   - BRAINTRUST_API_KEY in .env.local
 *   - OPENROUTER_API_KEY in .env.local
 *
 * What this evaluates:
 *   - Extraction decision accuracy (should save vs no-save)
 *   - Path selection (correct location in KB)
 *   - Action selection (create vs update vs append)
 *   - Content quality (captured the right information)
 *   - Latency (how fast is the Librarian)
 */

import "dotenv/config";
import { Eval } from "braintrust";

import { LibrarianScorer, type LibrarianOutput } from "./scorer";
import { librarianTestData, type LibrarianTestInput } from "./cases";
import {
    runLibrarianEval,
    LIBRARIAN_MODEL_CANDIDATES,
    type LibrarianModelCandidate,
} from "./runner";

// Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
    console.error("Missing OPENROUTER_API_KEY environment variable");
    console.error("\nSetup required:");
    console.error("   1. Get an API key from https://openrouter.ai");
    console.error("   2. Add to .env.local: OPENROUTER_API_KEY=<your_key>");
    console.error("\nThen run: pnpm braintrust eval evals/librarian/eval.ts");
    process.exit(1);
}

// Determine which model(s) to test
const specifiedModel = process.env.LIBRARIAN_MODEL;
const modelsToTest: LibrarianModelCandidate[] = specifiedModel
    ? LIBRARIAN_MODEL_CANDIDATES.filter((m) => m.id === specifiedModel)
    : [...LIBRARIAN_MODEL_CANDIDATES];

if (specifiedModel && modelsToTest.length === 0) {
    console.error(`Unknown model: ${specifiedModel}`);
    console.error("\nAvailable models:");
    for (const m of LIBRARIAN_MODEL_CANDIDATES) {
        console.error(`   - ${m.id} (${m.name})`);
    }
    process.exit(1);
}

console.log(`\nTesting ${modelsToTest.length} Librarian model(s):`);
for (const model of modelsToTest) {
    console.log(`   - ${model.name} (${model.id})`);
}
console.log("");

/**
 * Create an eval for each model candidate.
 * This allows side-by-side comparison in Braintrust dashboard.
 */
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
