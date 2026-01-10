/**
 * Test GPT-5 Image models specifically to see response format
 */

import "dotenv/config";
import { generateText } from "ai";
import { getOpenRouterClient } from "@/lib/ai/openrouter";

async function testGPT5Image() {
    const openrouter = getOpenRouterClient();

    console.log("Testing openai/gpt-5-image...\n");

    const result = await generateText({
        model: openrouter("openai/gpt-5-image"),
        prompt: "Generate an image of a simple red apple on a white background",
    });

    console.log("Response structure:");
    console.log("  keys:", Object.keys(result));
    console.log("  text length:", result.text?.length ?? 0);
    console.log("  files:", result.files?.length ?? 0);
    console.log("  steps:", result.steps?.length ?? 0);

    // Log the full first step to see structure
    if (result.steps?.[0]) {
        const step = result.steps[0] as Record<string, unknown>;
        console.log("\nFirst step keys:", Object.keys(step));
        if (step.response) {
            console.log(
                "  response keys:",
                Object.keys(step.response as Record<string, unknown>)
            );
        }
    }

    // Check provider metadata for images
    console.log(
        "\nProvider metadata:",
        JSON.stringify(result.providerMetadata, null, 2)
    );

    // Check if there's response or other fields
    const resultAny = result as unknown as Record<string, unknown>;
    if (resultAny.response) {
        console.log(
            "\nResponse:",
            JSON.stringify(resultAny.response, null, 2)?.substring(0, 1000)
        );
    }
}

testGPT5Image().catch(console.error);
