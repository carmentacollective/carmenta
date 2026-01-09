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
    type ImageApiType,
    type ImageProvider,
} from "@/lib/ai/image-generation";
import type { ImageTaskType, GeneratedImage, ImageArtistResult } from "./types";

/**
 * Task type detection keywords
 */
const TASK_KEYWORDS: Record<ImageTaskType, string[]> = {
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
    default: [],
};

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
        const promptLower = prompt.toLowerCase();

        for (const [taskType, keywords] of Object.entries(TASK_KEYWORDS)) {
            if (taskType === "default") continue;

            for (const keyword of keywords) {
                if (promptLower.includes(keyword)) {
                    logger.info(
                        { taskType, keyword, prompt: prompt.slice(0, 50) },
                        "🎨 Detected task type"
                    );
                    return {
                        taskType: taskType as ImageTaskType,
                        confidence: "high",
                    };
                }
            }
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
 * Generate an image using the appropriate model
 */
export const generateImageTool = tool({
    description:
        "Generate an image using the specified model. Returns base64 image data.",
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
        image?: GeneratedImage;
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

            logger.info(
                {
                    modelId: routing.modelId,
                    durationMs,
                    imageSize: image.base64.length,
                },
                "✅ Image generated"
            );

            return {
                success: true,
                image,
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
 * Signal generation is complete and return results
 */
export const completeGenerationTool = tool({
    description:
        "Signal that image generation is complete. Call this with the final results to end the generation process.",
    inputSchema: z.object({
        generated: z.boolean().describe("Whether images were successfully generated"),
        images: z
            .array(
                z.object({
                    base64: z.string(),
                    mimeType: z.string(),
                })
            )
            .describe("Generated images"),
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
        logger.info(
            {
                generated: result.generated,
                model: result.model,
                taskType: result.taskType,
                durationMs: result.durationMs,
            },
            result.generated ? "✅ Generation complete" : "⏭️ Generation failed"
        );

        return {
            generated: result.generated,
            images: result.images,
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
