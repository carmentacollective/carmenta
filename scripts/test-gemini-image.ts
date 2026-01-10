/**
 * Quick test script for Gemini image generation models
 * Run with: pnpm tsx scripts/test-gemini-image.ts
 */
import { config } from "dotenv";
// Load .env.local BEFORE any other imports that use env vars
config({ path: ".env.local" });

import { generateImage, generateText } from "ai";
import { createGateway } from "@ai-sdk/gateway";

async function testImageModel(modelId: string) {
    const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY! });

    console.log(`\n🧪 Testing ${modelId} via generateImage()...`);
    try {
        const { image } = await generateImage({
            model: gateway.imageModel(modelId),
            prompt: "A simple red circle on white background",
            aspectRatio: "1:1",
        });
        console.log(`✅ ${modelId}: Success! Image size: ${image.base64.length} bytes`);
        return true;
    } catch (error) {
        const err = error as { message?: string; cause?: { message?: string } };
        const msg =
            err.message ?? err.cause?.message ?? JSON.stringify(error).slice(0, 150);
        console.log(`❌ ${modelId}: Failed -`, msg);
        return false;
    }
}

async function testTextModel(modelId: string) {
    const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY! });

    console.log(`\n🧪 Testing ${modelId} via generateText()...`);
    try {
        const result = await generateText({
            model: gateway(modelId),
            prompt: "Generate an image of a simple red circle on white background",
        });
        const images =
            result.files?.filter((f) => f.mediaType?.startsWith("image/")) ?? [];
        if (images.length > 0) {
            console.log(`✅ ${modelId}: Success! Generated ${images.length} image(s)`);
            return true;
        } else {
            console.log(
                `⚠️ ${modelId}: Returned no images (files: ${result.files?.length ?? 0})`
            );
            return false;
        }
    } catch (error) {
        const err = error as { message?: string; cause?: { message?: string } };
        const msg =
            err.message ?? err.cause?.message ?? JSON.stringify(error).slice(0, 150);
        console.log(`❌ ${modelId}: Failed -`, msg);
        return false;
    }
}

async function main() {
    console.log("=== Testing Gemini/Google Image Generation Models ===");

    // Models to test via generateImage (Imagen-style)
    const imageModels = [
        "google/gemini-3-pro-image",
        "google/gemini-2.5-flash-image-preview",
        "google/imagen-4.0-generate-001",
        "google/imagen-4.0-fast-generate-001",
    ];

    // Models to test via generateText (Gemini native)
    const textModels = [
        "google/gemini-2.5-flash-preview-05-20",
        "google/gemini-2.5-flash",
    ];

    console.log("\n--- Testing via generateImage() ---");
    for (const model of imageModels) {
        await testImageModel(model);
    }

    console.log("\n--- Testing via generateText() (native Gemini) ---");
    for (const model of textModels) {
        await testTextModel(model);
    }

    console.log("\n=== Done ===");
}

main();
