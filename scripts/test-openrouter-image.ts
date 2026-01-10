/**
 * Test script to explore OpenRouter image generation via AI SDK provider.
 *
 * OpenRouter uses chat completions with modalities: ["image", "text"]
 * instead of a dedicated image endpoint.
 *
 * Run: pnpm tsx scripts/test-openrouter-image.ts
 */

import "dotenv/config";
import { generateText } from "ai";
import { getOpenRouterClient } from "@/lib/ai/openrouter";

const MODELS_TO_TEST = [
    "google/gemini-2.5-flash-image",
    "openai/gpt-5-image-mini",
    "bytedance-seed/seedream-4.5",
    "sourceful/riverflow-v2-fast-preview",
    "black-forest-labs/flux.2-pro",
];

async function testOpenRouterImage(modelId: string) {
    console.log(`\n--- Testing ${modelId} ---`);

    try {
        const openrouter = getOpenRouterClient();

        // Generate text with image-capable model
        const result = await generateText({
            model: openrouter(modelId),
            prompt: "A simple red apple on a white background",
        });

        console.log("Response keys:", Object.keys(result));
        console.log("Files:", result.files?.length ?? "none");
        console.log("Text:", result.text?.substring(0, 100) ?? "none");

        if (result.files?.length) {
            for (const file of result.files) {
                console.log(
                    `  File: ${file.mediaType}, ${file.base64?.substring(0, 50)}...`
                );
            }
        }

        // Check for images in response metadata
        console.log(
            "Provider metadata:",
            JSON.stringify(result.providerMetadata, null, 2)?.substring(0, 500)
        );

        return { success: true, hasImage: (result.files?.length ?? 0) > 0 };
    } catch (error) {
        console.error(`Error:`, error instanceof Error ? error.message : String(error));
        return { success: false, error: String(error) };
    }
}

async function main() {
    console.log("Testing OpenRouter image generation...\n");

    for (const model of MODELS_TO_TEST) {
        await testOpenRouterImage(model);
    }
}

main().catch(console.error);
