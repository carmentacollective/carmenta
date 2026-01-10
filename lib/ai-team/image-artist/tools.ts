/**
 * Image Artist Tools
 *
 * These tools provide the agent with capabilities to:
 * - Detect task type for model routing
 * - Expand prompts into detailed specifications
 * - Generate images using the optimal model
 * - Signal completion with results
 */

import { tool } from "ai";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { logger } from "@/lib/logger";
import {
    generateImageFromModel,
    detectTaskType,
    type ImageApiType,
    type ImageProvider,
} from "@/lib/ai/image-generation";
import type { ImageTaskType, GeneratedImage, ImageArtistResult } from "./types";

/**
 * Temporary storage for generated images.
 *
 * The generateImage tool stores the actual base64 data here instead of returning
 * it in the tool result. This prevents context overflow - the agent only sees
 * a small reference, not 2MB+ of base64 data.
 *
 * The completeGeneration tool retrieves the image when building the final result.
 *
 * TTL cleanup runs on each request to prevent memory leaks from failed/abandoned generations.
 */
interface PendingImageEntry {
    image: GeneratedImage;
    timestamp: number;
}

const pendingImages: Map<string, PendingImageEntry> = new Map();
const IMAGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Clean up expired images from pending storage.
 * Called on each request to prevent memory leaks from failed agents.
 */
function cleanupExpiredImages(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [ref, entry] of pendingImages.entries()) {
        if (now - entry.timestamp > IMAGE_TTL_MS) {
            expired.push(ref);
        }
    }

    for (const ref of expired) {
        pendingImages.delete(ref);
    }

    if (expired.length > 0) {
        logger.info(
            { count: expired.length, remaining: pendingImages.size },
            "Cleaned up expired pending images"
        );
    }
}

// Task detection now uses shared logic from lib/ai/image-generation.ts
// with priority ordering (logo before text, etc.)

/**
 * Model routing based on task type (from eval results)
 */
const TASK_MODEL_ROUTING: Record<
    ImageTaskType,
    { modelId: string; api: ImageApiType; provider?: ImageProvider }
> = {
    diagram: {
        modelId: "google/gemini-3-pro-image",
        api: "generateText",
    },
    text: {
        modelId: "google/gemini-3-pro-image",
        api: "generateText",
    },
    logo: {
        modelId: "bfl/flux-2-flex",
        api: "generateImage",
    },
    photo: {
        modelId: "google/imagen-4.0-ultra-generate-001",
        api: "generateImage",
    },
    illustration: {
        modelId: "google/gemini-3-pro-image",
        api: "generateText",
    },
    default: {
        modelId: "google/imagen-4.0-generate-001",
        api: "generateImage",
    },
};

/**
 * Detect task type from prompt
 */
export const detectTaskTypeTool = tool({
    description:
        "Analyze the user's prompt to determine the image task type (diagram, text, logo, photo, illustration). This determines which model to use.",
    inputSchema: z.object({
        prompt: z.string().describe("The user's image request"),
    }),
    execute: async ({
        prompt,
    }): Promise<{ taskType: ImageTaskType; confidence: string }> => {
        // Use shared detection logic with priority ordering
        const { taskType, matchedKeyword } = detectTaskType(prompt);

        if (matchedKeyword) {
            logger.info(
                { taskType, keyword: matchedKeyword, prompt: prompt.slice(0, 50) },
                "🎨 Detected task type"
            );
            return {
                taskType,
                confidence: "high",
            };
        }

        logger.info(
            { taskType: "default", prompt: prompt.slice(0, 50) },
            "🎨 Using default task type"
        );
        return { taskType: "default", confidence: "low" };
    },
});

/**
 * Expand a brief prompt into a detailed specification
 */
export const expandPromptTool = tool({
    description:
        "Expand the user's brief prompt into a detailed image specification. Add style, lighting, composition, and quality details while preserving intent.",
    inputSchema: z.object({
        originalPrompt: z.string().describe("The user's original prompt"),
        taskType: z
            .enum(["diagram", "text", "logo", "photo", "illustration", "default"])
            .describe("The detected task type"),
        style: z.string().optional().describe("Optional style hints from conversation"),
    }),
    execute: async ({
        originalPrompt,
        taskType,
        style,
    }): Promise<{ expandedPrompt: string; additions: string[] }> => {
        // The agent will actually do the expansion - this tool just structures it
        // The agent has the full prompt engineering knowledge from its system prompt
        const additions: string[] = [];

        // Default additions based on task type
        switch (taskType) {
            case "diagram":
                additions.push("clean lines", "clear labels", "professional");
                break;
            case "text":
                additions.push("legible text", "balanced composition", "high contrast");
                break;
            case "logo":
                additions.push(
                    "vector style",
                    "clean design",
                    "suitable for various sizes"
                );
                break;
            case "photo":
                additions.push("photorealistic", "natural lighting", "high resolution");
                break;
            case "illustration":
                additions.push("detailed", "artistic style", "cohesive composition");
                break;
            default:
                additions.push("high quality", "detailed");
        }

        if (style) {
            additions.push(style);
        }

        // The expanded prompt will be generated by the agent using these hints
        // This tool provides structure; the agent provides intelligence
        return {
            expandedPrompt: originalPrompt, // Agent will enhance this
            additions,
        };
    },
});

/**
 * Generate an image using the appropriate model.
 *
 * IMPORTANT: Returns only metadata, NOT the actual base64 image data.
 * The image is stored in pendingImages map and retrieved by completeGeneration.
 * This prevents context overflow - images can be 2MB+ which would exceed Sonnet's context.
 */
export const generateImageTool = tool({
    description:
        "Generate an image using the specified model. Returns success status and reference ID.",
    inputSchema: z.object({
        prompt: z.string().describe("The expanded prompt to generate"),
        taskType: z
            .enum(["diagram", "text", "logo", "photo", "illustration", "default"])
            .describe("Task type for model routing"),
        aspectRatio: z
            .enum(["1:1", "16:9", "9:16", "4:3", "3:4"])
            .default("1:1")
            .describe("Aspect ratio for the image"),
    }),
    execute: async ({
        prompt,
        taskType,
        aspectRatio,
    }): Promise<{
        success: boolean;
        imageRef?: string;
        imageSizeBytes?: number;
        model: string;
        error?: string;
        durationMs: number;
    }> => {
        const startTime = Date.now();
        const routing = TASK_MODEL_ROUTING[taskType];

        try {
            logger.info(
                {
                    taskType,
                    modelId: routing.modelId,
                    promptLength: prompt.length,
                    aspectRatio,
                },
                "🎨 Generating image"
            );

            const image = await generateImageFromModel({
                modelId: routing.modelId,
                api: routing.api,
                prompt,
                aspectRatio,
                provider: routing.provider,
            });

            const durationMs = Date.now() - startTime;

            // Clean up expired images before storing new one
            cleanupExpiredImages();

            // Store image in pending map, return only reference
            // Use timestamp + random suffix for uniqueness
            const imageRef = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            pendingImages.set(imageRef, {
                image,
                timestamp: Date.now(),
            });

            logger.info(
                {
                    modelId: routing.modelId,
                    durationMs,
                    imageSize: image.base64.length,
                    imageRef,
                },
                "✅ Image generated and stored"
            );

            return {
                success: true,
                imageRef,
                imageSizeBytes: image.base64.length,
                model: routing.modelId,
                durationMs,
            };
        } catch (error) {
            const durationMs = Date.now() - startTime;

            logger.error(
                { error, modelId: routing.modelId, taskType },
                "❌ Image generation failed"
            );

            Sentry.captureException(error, {
                tags: {
                    component: "ai-team",
                    agent: "image-artist",
                    tool: "generateImage",
                },
                extra: {
                    modelId: routing.modelId,
                    taskType,
                    promptLength: prompt.length,
                },
            });

            return {
                success: false,
                model: routing.modelId,
                error: error instanceof Error ? error.message : "Unknown error",
                durationMs,
            };
        }
    },
});

/**
 * Signal generation is complete and return results.
 *
 * Accepts imageRefs from generateImage and retrieves the actual base64 data
 * from pendingImages map. This avoids passing large base64 strings through
 * the agent's context window.
 */
export const completeGenerationTool = tool({
    description:
        "Signal that image generation is complete. Pass the imageRef from generateImage to include the image.",
    inputSchema: z.object({
        generated: z.boolean().describe("Whether images were successfully generated"),
        imageRefs: z
            .array(z.string())
            .describe("Image reference IDs from generateImage tool"),
        expandedPrompt: z.string().describe("The expanded prompt that was used"),
        originalPrompt: z.string().describe("The original user prompt"),
        model: z.string().describe("Model used for generation"),
        taskType: z
            .enum(["diagram", "text", "logo", "photo", "illustration", "default"])
            .describe("Task type that was detected"),
        aspectRatio: z.string().describe("Aspect ratio used"),
        durationMs: z.number().describe("Total generation duration in ms"),
        suggestions: z
            .string()
            .optional()
            .describe("Suggestions for improving the image in next iteration"),
    }),
    execute: async (result): Promise<ImageArtistResult> => {
        // Retrieve actual images from pending storage
        const images: GeneratedImage[] = [];
        for (const ref of result.imageRefs) {
            const entry = pendingImages.get(ref);
            if (entry) {
                images.push(entry.image);
                // Clean up after retrieval
                pendingImages.delete(ref);
            } else {
                logger.warn(
                    { imageRef: ref },
                    "Image reference not found in pending storage"
                );
            }
        }

        logger.info(
            {
                generated: result.generated,
                model: result.model,
                taskType: result.taskType,
                durationMs: result.durationMs,
                imageCount: images.length,
                requestedRefs: result.imageRefs.length,
            },
            result.generated ? "✅ Generation complete" : "⏭️ Generation failed"
        );

        return {
            generated: result.generated,
            images,
            expandedPrompt: result.expandedPrompt,
            originalPrompt: result.originalPrompt,
            model: result.model,
            taskType: result.taskType,
            aspectRatio: result.aspectRatio,
            durationMs: result.durationMs,
            suggestions: result.suggestions,
        };
    },
});
