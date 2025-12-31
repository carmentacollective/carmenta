/**
 * Carmenta Title Generation Evaluation
 *
 * Braintrust-native evaluation for comparing title generation model candidates.
 * Tests title quality, conciseness, and convention adherence across different
 * models to determine the optimal title generator.
 *
 * Usage:
 *   # Run with all model candidates:
 *   pnpm braintrust eval evals/title/eval.ts
 *
 *   # Run with specific model:
 *   TITLE_MODEL=openai/gpt-4o-mini pnpm braintrust eval evals/title/eval.ts
 *
 *   # Filter by category:
 *   TITLE_CATEGORY=code pnpm braintrust eval evals/title/eval.ts
 *
 * Requirements:
 *   - BRAINTRUST_API_KEY in .env.local
 *   - OPENROUTER_API_KEY in .env.local
 *
 * What this evaluates:
 *   - Topic capture (does the title reflect message content?)
 *   - Anti-patterns (avoids generic "Help with..." titles)
 *   - Length compliance (max 40 chars)
 *   - Emoji conventions (gitmoji for code context)
 *   - Latency (fast generation is important for UX)
 */

import "dotenv/config";
import { Eval } from "braintrust";

import { TitleScorer } from "./scorer";
import { titleTestData, type TitleTestInput, type TitleExpectations } from "./cases";
import {
    runTitleEval,
    TITLE_MODEL_CANDIDATES,
    type TitleModelCandidate,
    type TitleOutput,
} from "./runner";

// Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
    console.error("❌ Missing OPENROUTER_API_KEY environment variable");
    console.error("\n📋 Setup required:");
    console.error("   1. Get an API key from https://openrouter.ai");
    console.error("   2. Add to .env.local: OPENROUTER_API_KEY=<your_key>");
    console.error("\n▶️  Then run: pnpm braintrust eval evals/title/eval.ts");
    process.exit(1);
}

// Determine which model(s) to test
const specifiedModel = process.env.TITLE_MODEL;
const modelsToTest: TitleModelCandidate[] = specifiedModel
    ? TITLE_MODEL_CANDIDATES.filter((m) => m.id === specifiedModel)
    : [...TITLE_MODEL_CANDIDATES];

if (specifiedModel && modelsToTest.length === 0) {
    console.error(`❌ Unknown model: ${specifiedModel}`);
    console.error("\n📋 Available models:");
    for (const m of TITLE_MODEL_CANDIDATES) {
        console.error(`   - ${m.id} (${m.name})`);
    }
    process.exit(1);
}

// Filter by category if specified
const categoryFilter = process.env.TITLE_CATEGORY;
const filteredTestData = categoryFilter
    ? titleTestData.filter((t) => t.input.category === categoryFilter)
    : titleTestData;

if (categoryFilter && filteredTestData.length === 0) {
    console.error(`❌ No test cases match category: ${categoryFilter}`);
    console.error("\n📋 Available categories:");
    const categories = Array.from(new Set(titleTestData.map((t) => t.input.category)));
    for (const cat of categories) {
        console.error(`   - ${cat}`);
    }
    process.exit(1);
}

console.log(`\n🏷️  Title Generation Eval`);
console.log(`   Testing ${modelsToTest.length} model(s):`);
for (const model of modelsToTest) {
    console.log(`   - ${model.name} (${model.id})`);
}
console.log(`   Running ${filteredTestData.length} test cases`);
if (categoryFilter) {
    console.log(`   Category filter: ${categoryFilter}`);
}
console.log("");

/**
 * Create an eval for each model candidate.
 * This allows side-by-side comparison in Braintrust dashboard.
 */
for (const model of modelsToTest) {
    Eval<TitleTestInput, TitleOutput, TitleExpectations>(
        `Carmenta Title - ${model.name}`,
        {
            data: () =>
                filteredTestData.map((t) => ({
                    input: t.input,
                    expected: t.expected,
                    tags: t.tags,
                    metadata: {
                        id: t.input.id,
                        category: t.input.category,
                        description: t.input.description,
                        context: t.input.context,
                    },
                })),

            task: async (input: TitleTestInput): Promise<TitleOutput> => {
                return runTitleEval(input, {
                    model: model.id,
                    apiKey: OPENROUTER_API_KEY,
                });
            },

            scores: [TitleScorer],

            metadata: {
                titleModel: model.id,
                titleModelName: model.name,
                costPer1M: model.costPer1M,
                tokensPerSecond: model.tokensPerSecond,
                commit: process.env.COMMIT_SHA ?? "local",
                environment: process.env.NODE_ENV ?? "development",
                testCount: filteredTestData.length,
                categoryFilter: categoryFilter ?? "all",
            },
        }
    );
}
