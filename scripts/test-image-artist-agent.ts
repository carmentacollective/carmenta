/**
 * Test the full Image Artist agent flow to debug failures.
 *
 * Run with: pnpm tsx scripts/test-image-artist-agent.ts
 */
import { config } from "dotenv";
// Load .env.local BEFORE any other imports that use env vars
config({ path: ".env.local" });

import { createImageArtistAgent } from "@/lib/ai-team/image-artist";

const PROMPTS_TO_TEST = [
    "Portrait of an Austin goddess: A sophisticated woman with warm dark brown hair catching sun-kissed caramel highlights",
    "A simple red circle on white background",
];

async function testAgentPrompt(prompt: string) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`Testing Agent: "${prompt.slice(0, 50)}..."`);
    console.log("=".repeat(70));

    try {
        const agent = createImageArtistAgent();

        console.log("Running Image Artist agent...");
        const startTime = Date.now();

        const result = await agent.generate({
            prompt: `Generate an image for this request:

<user-request>${prompt}</user-request>

Process:
1. Detect the task type (diagram, text, logo, photo, illustration)
2. Expand the prompt with appropriate details
3. Generate the image using the optimal model
4. Call completeGeneration with the results`,
        });

        const duration = Date.now() - startTime;
        console.log(`✅ Agent completed! Duration: ${duration}ms`);
        console.log(`   Steps: ${result.steps.length}`);

        // Log each step
        for (let i = 0; i < result.steps.length; i++) {
            const step = result.steps[i];
            const toolCalls = step.toolCalls ?? [];
            console.log(
                `   Step ${i + 1}: ${toolCalls.map((tc) => tc.toolName).join(", ") || "text response"}`
            );

            for (const tc of toolCalls) {
                if (tc.toolName === "completeGeneration" && "input" in tc) {
                    const input = tc.input as {
                        generated?: boolean;
                        model?: string;
                        imageRefs?: string[];
                    };
                    console.log(`      generated: ${input.generated}`);
                    console.log(`      model: ${input.model}`);
                    console.log(`      imageRefs: ${JSON.stringify(input.imageRefs)}`);
                }
            }
        }
    } catch (error) {
        console.log(`❌ Agent FAILED`);
        console.log(`   Error type: ${error?.constructor?.name}`);
        console.log(
            `   Message: ${error instanceof Error ? error.message : String(error)}`
        );

        if (error instanceof Error) {
            console.log(`   Stack: ${error.stack?.split("\n").slice(0, 5).join("\n")}`);
        }

        if (error instanceof Error && error.cause) {
            console.log(`   Cause: ${JSON.stringify(error.cause, null, 2)}`);
        }
    }
}

async function main() {
    console.log("Testing Image Artist Agent Flow\n");
    console.log(
        `AI_GATEWAY_API_KEY: ${process.env.AI_GATEWAY_API_KEY ? "✓ Set" : "✗ Missing"}`
    );

    for (const prompt of PROMPTS_TO_TEST) {
        await testAgentPrompt(prompt);
    }

    console.log("\n\nDone!");
}

main().catch(console.error);
