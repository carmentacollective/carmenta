/**
 * Carmenta Concierge Model Evaluation
 *
 * Braintrust-native evaluation for comparing concierge model candidates.
 * Tests classification quality, title generation, and performance across
 * different models to determine the optimal concierge.
 *
 * Usage:
 *   # Run with all model candidates:
 *   pnpm braintrust eval evals/concierge/eval.ts
 *
 *   # Run with specific model:
 *   CONCIERGE_MODEL=openai/gpt-5-nano pnpm braintrust eval evals/concierge/eval.ts
 *
 * Requirements:
 *   - BRAINTRUST_API_KEY in .env.local
 *   - OPENROUTER_API_KEY in .env.local
 *
 * What this evaluates:
 *   - Model selection accuracy (routes to appropriate model)
 *   - Temperature selection (matches query type)
 *   - Reasoning enablement (when deep thinking is needed)
 *   - Title generation quality (concise, descriptive, not generic)
 *   - Latency (how fast is the concierge)
 */

import "dotenv/config";
import { Eval } from "braintrust";

import { ConciergeScorer, type ConciergeOutput } from "./scorer";
import { TitleQualityScorer } from "./title-scorer";
import { conciergeTestData, type ConciergeTestInput } from "./cases";
import {
    runConciergeEval,
    CONCIERGE_MODEL_CANDIDATES,
    type ConciergeModelCandidate,
} from "./runner";

// LLM-as-judge scoring is expensive - enable with env var
const ENABLE_LLM_JUDGE = process.env.ENABLE_LLM_JUDGE === "true";

// Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
    console.error("❌ Missing OPENROUTER_API_KEY environment variable");
    console.error("\n📋 Setup required:");
    console.error("   1. Get an API key from https://openrouter.ai");
    console.error("   2. Add to .env.local: OPENROUTER_API_KEY=<your_key>");
    console.error("\n▶️  Then run: pnpm braintrust eval evals/concierge.eval.ts");
    process.exit(1);
}

// Determine which model(s) to test
const specifiedModel = process.env.CONCIERGE_MODEL;
const modelsToTest: ConciergeModelCandidate[] = specifiedModel
    ? CONCIERGE_MODEL_CANDIDATES.filter((m) => m.id === specifiedModel)
    : [...CONCIERGE_MODEL_CANDIDATES];

if (specifiedModel && modelsToTest.length === 0) {
    console.error(`❌ Unknown model: ${specifiedModel}`);
    console.error("\n📋 Available models:");
    for (const m of CONCIERGE_MODEL_CANDIDATES) {
        console.error(`   - ${m.id} (${m.name})`);
    }
    process.exit(1);
}

console.log(`\n🔬 Testing ${modelsToTest.length} concierge model(s):`);
for (const model of modelsToTest) {
    console.log(`   - ${model.name} (${model.id})`);
}
if (ENABLE_LLM_JUDGE) {
    console.log(`\n📊 LLM-as-judge scoring enabled (ENABLE_LLM_JUDGE=true)`);
}
console.log("");

/**
 * Create an eval for each model candidate.
 * This allows side-by-side comparison in Braintrust dashboard.
 */
for (const model of modelsToTest) {
    Eval(`Carmenta Concierge - ${model.name}`, {
        data: () =>
            conciergeTestData.map((t) => ({
                input: t.input,
                expected: t.expected,
                tags: t.tags,
                metadata: {
                    id: t.input.id,
                    category: t.input.category,
                    description: t.input.description,
                },
            })),

        task: async (input: ConciergeTestInput): Promise<ConciergeOutput> => {
            return runConciergeEval(input, {
                conciergeModel: model.id,
                apiKey: OPENROUTER_API_KEY,
            });
        },

        scores: ENABLE_LLM_JUDGE
            ? [ConciergeScorer, TitleQualityScorer]
            : [ConciergeScorer],

        metadata: {
            conciergeModel: model.id,
            conciergeModelName: model.name,
            costPer1M: model.costPer1M,
            tokensPerSecond: model.tokensPerSecond,
            commit: process.env.COMMIT_SHA ?? "local",
            environment: process.env.NODE_ENV ?? "development",
            testCount: conciergeTestData.length,
        },
    });
}
