/**
 * Test portrait image generation to debug failures.
 *
 * Run with: pnpm tsx scripts/test-portrait-generation.ts
 */
import { config } from "dotenv";
// Load .env.local BEFORE any other imports that use env vars
config({ path: ".env.local" });

import { generateImage, generateText } from "ai";
import { createGateway } from "@ai-sdk/gateway";

const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY! });

/**
 * Task type detection keywords (copy from image-generation.ts)
 */
const TASK_KEYWORDS: Record<string, string[]> = {
    diagram: [
        "flowchart",
        "architecture",
        "process",
        "diagram",
        "infographic",
        "steps",
        "workflow",
        "system",
        "chart",
    ],
    text: [
        "poster",
        "sign",
        "label",
        "title",
        "headline",
        "banner",
        "caption",
        "text",
        "typography",
        "lettering",
    ],
    logo: ["logo", "wordmark", "brand", "icon", "emblem", "badge", "symbol", "mark"],
    photo: [
        "photo",
        "realistic",
        "portrait",
        "landscape",
        "product",
        "shot",
        "photograph",
        "headshot",
    ],
    illustration: [
        "illustration",
        "cartoon",
        "character",
        "scene",
        "fantasy",
        "drawing",
        "art",
        "artistic",
    ],
};

function detectTaskType(prompt: string): { taskType: string; matchedKeyword?: string } {
    const promptLower = prompt.toLowerCase();
    for (const [taskType, keywords] of Object.entries(TASK_KEYWORDS)) {
        for (const keyword of keywords) {
            if (promptLower.includes(keyword)) {
                return { taskType, matchedKeyword: keyword };
            }
        }
    }
    return { taskType: "default" };
}

/**
 * Model routing based on task type
 */
const TASK_MODEL_ROUTING: Record<
    string,
    { modelId: string; api: "generateImage" | "generateText" }
> = {
    diagram: { modelId: "google/gemini-3-pro-image", api: "generateText" },
    text: { modelId: "google/gemini-3-pro-image", api: "generateText" },
    logo: { modelId: "bfl/flux-2-flex", api: "generateImage" },
    photo: { modelId: "google/imagen-4.0-ultra-generate-001", api: "generateImage" },
    illustration: { modelId: "google/gemini-3-pro-image", api: "generateText" },
    default: { modelId: "google/imagen-4.0-generate-001", api: "generateImage" },
};

const PROMPTS_TO_TEST = [
    "Portrait of an Austin goddess: A sophisticated woman with warm dark brown hair catching sun-kissed caramel highlights",
    "Portrait of a sophisticated woman with warm dark brown hair featuring sun-kissed caramel highlights",
    "A simple portrait of a woman",
    "A red circle on white background",
];

async function testPrompt(prompt: string) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Testing: "${prompt.slice(0, 60)}..."`);
    console.log("=".repeat(60));

    // Detect task type
    const { taskType, matchedKeyword } = detectTaskType(prompt);
    console.log(`Task type: ${taskType} (keyword: ${matchedKeyword ?? "none"})`);

    const routing = TASK_MODEL_ROUTING[taskType];
    console.log(`Model: ${routing.modelId} (API: ${routing.api})`);

    try {
        console.log("Generating image...");
        const startTime = Date.now();

        if (routing.api === "generateImage") {
            const { image } = await generateImage({
                model: gateway.imageModel(routing.modelId),
                prompt,
                aspectRatio: "1:1",
            });

            const duration = Date.now() - startTime;
            console.log(`✅ Success! Duration: ${duration}ms`);
            console.log(`   Image size: ${image.base64.length} bytes`);
            console.log(`   MIME type: ${image.mediaType}`);
        } else {
            const result = await generateText({
                model: gateway(routing.modelId),
                prompt,
            });

            const imageFile = result.files?.find((f) =>
                f.mediaType?.startsWith("image/")
            );

            if (!imageFile?.base64) {
                console.log(
                    `❌ No image in response (files: ${result.files?.length ?? 0})`
                );
                return;
            }

            const duration = Date.now() - startTime;
            console.log(`✅ Success! Duration: ${duration}ms`);
            console.log(`   Image size: ${imageFile.base64.length} bytes`);
            console.log(`   MIME type: ${imageFile.mediaType}`);
        }
    } catch (error) {
        console.log(`❌ FAILED`);
        console.log(`   Error type: ${error?.constructor?.name}`);
        console.log(
            `   Message: ${error instanceof Error ? error.message : String(error)}`
        );

        if (error instanceof Error && error.cause) {
            console.log(`   Cause: ${JSON.stringify(error.cause, null, 2)}`);
        }

        // Check for API-specific error details
        if (error && typeof error === "object") {
            const errorObj = error as Record<string, unknown>;
            if (errorObj.response) {
                console.log(
                    `   Response: ${JSON.stringify(errorObj.response, null, 2)}`
                );
            }
            if (errorObj.data) {
                console.log(`   Data: ${JSON.stringify(errorObj.data, null, 2)}`);
            }
        }
    }
}

async function main() {
    console.log("Testing Image Generation - Portrait Prompts\n");
    console.log(
        `AI_GATEWAY_API_KEY: ${process.env.AI_GATEWAY_API_KEY ? "✓ Set" : "✗ Missing"}`
    );

    for (const prompt of PROMPTS_TO_TEST) {
        await testPrompt(prompt);
    }

    console.log("\n\nDone!");
}

main().catch(console.error);
