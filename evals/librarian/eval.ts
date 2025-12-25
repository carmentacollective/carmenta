/**
 * Knowledge Librarian Evaluation
 *
 * Braintrust-native evaluation for the Librarian agent.
 * Tests extraction quality, path selection, and action decisions.
 *
 * Usage:
 *   # Nightly/default: test production model only
 *   pnpm braintrust eval evals/librarian/eval.ts
 *
 *   # Compare all model candidates (when evaluating new models)
 *   LIBRARIAN_COMPARE_ALL=true pnpm braintrust eval evals/librarian/eval.ts
 *
 *   # Test a specific model
 *   LIBRARIAN_MODEL=x-ai/grok-4.1-fast pnpm braintrust eval evals/librarian/eval.ts
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

// Production librarian model (from lib/model-config.ts LIBRARIAN_FALLBACK_CHAIN)
const PRODUCTION_MODEL = LIBRARIAN_MODEL_CANDIDATES[0]; // Claude Haiku 4.5

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
const compareAll = process.env.LIBRARIAN_COMPARE_ALL === "true";

let modelsToTest: LibrarianModelCandidate[];

if (specifiedModel) {
    // Test a specific model
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
    // Compare all candidates (for model selection)
    modelsToTest = [...LIBRARIAN_MODEL_CANDIDATES];
} else {
    // Default: production model only (for nightly)
    modelsToTest = [PRODUCTION_MODEL];
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
