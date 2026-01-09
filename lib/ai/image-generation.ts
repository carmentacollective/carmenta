/**
 * Shared image generation module.
 *
 * This module provides a unified API for image generation that abstracts over:
 * 1. Two providers: Vercel AI Gateway and OpenRouter
 * 2. Two API patterns:
 *    - generateImage(): For dedicated image models (Imagen, FLUX via Gateway)
 *    - generateText(): For multimodal LLMs that output images (Gemini, OpenRouter models)
 *
 * Used by both the frontend createImageTool and the image generation evals.
 */

import { generateImage, generateText } from "ai";
import type { ReasoningConfig } from "@/lib/concierge/types";
import { getGatewayClient } from "@/lib/ai/gateway";
import { getOpenRouterClient } from "@/lib/ai/openrouter";

/**
 * API type determines which Vercel AI SDK function to use:
 * - generateImage: Dedicated image models (Imagen, FLUX)
 * - generateText: Multimodal LLMs with image output (Gemini, OpenRouter models)
 */
export type ImageApiType = "generateImage" | "generateText";

/**
 * Provider determines which client to use:
 * - gateway: Vercel AI Gateway (default)
 * - openrouter: OpenRouter
 */
export type ImageProvider = "gateway" | "openrouter";

/**
 * Image model configuration.
 */
export interface ImageModelConfig {
    id: string;
    name: string;
    tier: ImageModelTier;
    api: ImageApiType;
    priceNote: string;
    provider?: ImageProvider; // Default: "gateway"
}

/**
 * Tiers map to reasoning levels:
 * - fast: Quick drafts, no reasoning
 * - standard: Balanced quality/cost, low reasoning
 * - quality: Maximum quality, high reasoning
 */
export type ImageModelTier = "fast" | "standard" | "quality";

/**
 * Task types for intelligent model routing.
 * Based on 195-image eval across 13 models.
 */
export type ImageTaskType =
    | "diagram"
    | "text"
    | "logo"
    | "photo"
    | "illustration"
    | "default";

/**
 * Keywords for detecting task type from prompt.
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
 * Task-based model routing from eval results.
 *
 * | Task         | Model              | Score |
 * | ------------ | ------------------ | ----- |
 * | Diagrams     | Gemini 3 Pro Image | 98%   |
 * | Text         | Gemini 3 Pro Image | 86%   |
 * | Illustrations| Gemini 3 Pro Image | 75%   |
 * | Logos        | FLUX 2 Flex        | 70%   |
 * | Photos       | Imagen 4.0 Ultra   | 70%   |
 */
const TASK_MODEL_ROUTING: Record<
    ImageTaskType,
    { modelId: string; api: ImageApiType; name: string; score: string }
> = {
    diagram: {
        modelId: "google/gemini-3-pro-image",
        api: "generateText",
        name: "Gemini 3 Pro",
        score: "98%",
    },
    text: {
        modelId: "google/gemini-3-pro-image",
        api: "generateText",
        name: "Gemini 3 Pro",
        score: "86%",
    },
    logo: {
        modelId: "bfl/flux-2-flex",
        api: "generateImage",
        name: "FLUX 2 Flex",
        score: "70%",
    },
    photo: {
        modelId: "google/imagen-4.0-ultra-generate-001",
        api: "generateImage",
        name: "Imagen 4.0 Ultra",
        score: "70%",
    },
    illustration: {
        modelId: "google/gemini-3-pro-image",
        api: "generateText",
        name: "Gemini 3 Pro",
        score: "75%",
    },
    default: {
        modelId: "google/imagen-4.0-generate-001",
        api: "generateImage",
        name: "Imagen 4.0",
        score: "51%",
    },
};

/**
 * Available image models with their configurations.
 *
 * Routing strategy (from evals):
 * - Default: Imagen 4.0 (standard) - reliable across categories
 * - Diagrams/text: Nano Banana Pro (quality) - 30+ points better than alternatives
 */
export const IMAGE_MODELS: Record<ImageModelTier, ImageModelConfig> = {
    fast: {
        id: "google/imagen-4.0-fast-generate-001",
        name: "Imagen 4.0 Fast",
        tier: "fast",
        api: "generateImage",
        priceNote: "$0.02/img",
    },
    standard: {
        id: "google/imagen-4.0-generate-001",
        name: "Imagen 4.0",
        tier: "standard",
        api: "generateImage",
        priceNote: "$0.04/img",
    },
    quality: {
        id: "google/gemini-3-pro-image",
        name: "Nano Banana Pro",
        tier: "quality",
        api: "generateText", // LLM-based - uses generateText, not generateImage
        priceNote: "~$0.02/img (token-based)",
    },
};

/**
 * Full catalog of image models for evals.
 * Includes models beyond the routing tiers for comprehensive testing.
 */
export const IMAGE_MODEL_CATALOG: ImageModelConfig[] = [
    // Google Imagen family
    IMAGE_MODELS.fast,
    IMAGE_MODELS.standard,
    {
        id: "google/imagen-4.0-ultra-generate-001",
        name: "Imagen 4.0 Ultra",
        tier: "quality",
        api: "generateImage",
        priceNote: "~$0.08/img",
    },

    // Google Gemini (LLM-based image generation)
    IMAGE_MODELS.quality,

    // Black Forest Labs FLUX family
    {
        id: "bfl/flux-2-pro",
        name: "FLUX 2 Pro",
        tier: "quality",
        api: "generateImage",
        priceNote: "$0.03/MP",
    },
    {
        id: "bfl/flux-pro-1.1",
        name: "FLUX 1.1 Pro",
        tier: "standard",
        api: "generateImage",
        priceNote: "$0.04/img",
    },
    {
        id: "bfl/flux-pro-1.1-ultra",
        name: "FLUX 1.1 Pro Ultra",
        tier: "quality",
        api: "generateImage",
        priceNote: "Higher",
    },
    {
        id: "bfl/flux-kontext-pro",
        name: "FLUX Kontext Pro",
        tier: "quality",
        api: "generateImage",
        priceNote: "Variable",
    },
    {
        id: "bfl/flux-2-flex",
        name: "FLUX 2 Flex",
        tier: "quality",
        api: "generateImage",
        priceNote: "$0.06/MP",
    },

    // OpenRouter models (use generateText with files[] response)
    {
        id: "openai/gpt-5-image",
        name: "GPT-5 Image",
        tier: "quality",
        api: "generateText",
        priceNote: "$5/1M tokens",
        provider: "openrouter",
    },
    {
        id: "bytedance-seed/seedream-4.5",
        name: "Seedream 4.5",
        tier: "standard",
        api: "generateText",
        priceNote: "$0.009/img",
        provider: "openrouter",
    },
    {
        id: "sourceful/riverflow-v2-fast-preview",
        name: "Riverflow v2 Fast",
        tier: "fast",
        api: "generateText",
        priceNote: "$0.003/img",
        provider: "openrouter",
    },
    {
        id: "black-forest-labs/flux.2-pro",
        name: "FLUX 2 Pro (OR)",
        tier: "quality",
        api: "generateText",
        priceNote: "$0.05/img",
        provider: "openrouter",
    },
];

/**
 * Select image model based on reasoning configuration.
 * Higher reasoning effort = higher quality image model.
 */
export function selectImageModel(reasoning?: ReasoningConfig): ImageModelConfig {
    // No reasoning or disabled = fast model
    if (!reasoning?.enabled) {
        return IMAGE_MODELS.fast;
    }

    // Effort-based models (OpenAI, xAI)
    if (reasoning.effort === "high") {
        return IMAGE_MODELS.quality;
    }
    if (reasoning.effort === "low" || reasoning.effort === "none") {
        return IMAGE_MODELS.fast;
    }

    // Token-budget models (Anthropic)
    if (reasoning.maxTokens !== undefined) {
        if (reasoning.maxTokens >= 16000) {
            return IMAGE_MODELS.quality;
        }
        if (reasoning.maxTokens < 4000) {
            return IMAGE_MODELS.fast;
        }
    }

    // Default: standard quality
    return IMAGE_MODELS.standard;
}

/**
 * Task detection priority order.
 * Higher priority tasks are checked first to avoid misrouting.
 * E.g., "logo for Morning Brew" should detect "logo" not "text".
 */
const TASK_PRIORITY: ImageTaskType[] = [
    "logo", // Check logo first - brand names often contain text
    "diagram", // Diagrams are explicit
    "photo", // Photo/realistic are explicit
    "illustration", // Illustration keywords are explicit
    "text", // Text is broad - check last among specific types
];

/**
 * Detect task type from prompt using keyword matching.
 * Uses priority order to avoid misrouting (logo before text).
 */
export function detectTaskType(prompt: string): {
    taskType: ImageTaskType;
    matchedKeyword?: string;
} {
    const promptLower = prompt.toLowerCase();

    // Check tasks in priority order
    for (const taskType of TASK_PRIORITY) {
        const keywords = TASK_KEYWORDS[taskType];
        for (const keyword of keywords) {
            if (promptLower.includes(keyword)) {
                return {
                    taskType,
                    matchedKeyword: keyword,
                };
            }
        }
    }

    return { taskType: "default" };
}

/**
 * Result from task-based model selection.
 */
export interface TaskBasedModelSelection {
    modelId: string;
    api: ImageApiType;
    taskType: ImageTaskType;
    modelName: string;
    score: string;
    reason: string;
}

/**
 * Select image model based on task type detected from prompt.
 * Uses eval results to route to the best model for each task.
 */
export function selectImageModelByTask(prompt: string): TaskBasedModelSelection {
    const { taskType, matchedKeyword } = detectTaskType(prompt);
    const routing = TASK_MODEL_ROUTING[taskType];

    // Build explanation for why this model was chosen
    let reason: string;
    if (taskType === "default") {
        reason = "General purpose image generation";
    } else {
        reason = `Best for ${taskType}s (${routing.score} in evals)`;
        if (matchedKeyword) {
            reason = `Detected "${matchedKeyword}" → ${reason}`;
        }
    }

    return {
        modelId: routing.modelId,
        api: routing.api,
        taskType,
        modelName: routing.name,
        score: routing.score,
        reason,
    };
}

/**
 * Result from image generation.
 */
export interface GeneratedImage {
    base64: string;
    mimeType: string;
}

/**
 * Options for image generation.
 */
export interface GenerateImageOptions {
    modelId: string;
    api: ImageApiType;
    prompt: string;
    aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
    provider?: ImageProvider;
}

/**
 * Generate an image using the appropriate API for the model.
 *
 * This abstracts over:
 * - Two providers: Vercel AI Gateway and OpenRouter
 * - Two API patterns:
 *   - generateImage(): For Imagen, FLUX (dedicated image models via Gateway)
 *   - generateText(): For multimodal LLMs (Gemini, OpenRouter models)
 *
 * @throws Error if generation fails or response is empty
 */
export async function generateImageFromModel(
    options: GenerateImageOptions
): Promise<GeneratedImage> {
    const { modelId, api, prompt, aspectRatio = "1:1", provider = "gateway" } = options;

    if (api === "generateText") {
        // Multimodal LLMs use generateText with images in files[] response
        const client =
            provider === "openrouter" ? getOpenRouterClient() : getGatewayClient();

        const result = await generateText({
            model: client(modelId),
            prompt,
        });

        // Extract image from files array
        const imageFile = result.files?.find((f) => f.mediaType?.startsWith("image/"));

        if (!imageFile?.base64) {
            throw new Error(
                `No image in response (files: ${result.files?.length ?? 0})`
            );
        }

        return {
            base64: imageFile.base64,
            mimeType: imageFile.mediaType ?? "image/png",
        };
    }

    // Dedicated image models use generateImage API (Gateway only)
    const gateway = getGatewayClient();
    const { image } = await generateImage({
        model: gateway.imageModel(modelId),
        prompt,
        aspectRatio,
    });

    if (!image?.base64 || image.base64.length < 100) {
        throw new Error("Generated image data is empty or invalid");
    }

    return {
        base64: image.base64,
        mimeType: image.mediaType ?? "image/png",
    };
}
