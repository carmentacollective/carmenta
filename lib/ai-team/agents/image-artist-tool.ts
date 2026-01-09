/**
 * Image Artist Tool for DCOS
 *
 * Wraps the Image Artist agent as a tool callable by the main conversation.
 * Uses progressive disclosure pattern - action='describe' returns full docs.
 *
 * Actions:
 * - describe: Returns full operation documentation
 * - generate: Run the full image generation agent
 */

import { tool } from "ai";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { logger } from "@/lib/logger";
import {
    createImageArtistAgent,
    type ImageArtistResult,
} from "@/lib/ai-team/image-artist";
import {
    type SubagentResult,
    type SubagentDescription,
    type SubagentContext,
    successResult,
    errorResult,
    degradedResult,
} from "@/lib/ai-team/dcos/types";
import { safeInvoke, detectStepExhaustion } from "@/lib/ai-team/dcos/utils";

/**
 * Image Artist subagent ID
 */
const IMAGE_ARTIST_ID = "image-artist";

/**
 * Maximum steps for generation agent
 */
const MAX_GENERATION_STEPS = 6;

/**
 * Describe image artist operations for progressive disclosure
 */
function describeOperations(): SubagentDescription {
    return {
        id: IMAGE_ARTIST_ID,
        name: "Image Artist",
        summary:
            "Generate high-quality images from prompts. Automatically expands prompts, routes to optimal models, and produces professional results.",
        operations: [
            {
                name: "generate",
                description:
                    "Generate an image from a natural language prompt. The agent will expand the prompt, select the best model, and generate the image.",
                params: [
                    {
                        name: "prompt",
                        type: "string",
                        description:
                            "Natural language description of the desired image",
                        required: true,
                    },
                    {
                        name: "style",
                        type: "string",
                        description:
                            "Optional style hints (e.g., 'professional', 'playful', 'minimalist')",
                        required: false,
                    },
                    {
                        name: "aspectRatio",
                        type: "string",
                        description:
                            "Aspect ratio: '1:1' (square), '16:9' (landscape), '9:16' (portrait), '4:3', '3:4'",
                        required: false,
                    },
                ],
            },
        ],
    };
}

/**
 * Execute generation action
 */
async function executeGenerate(
    params: { prompt: string; style?: string; aspectRatio?: string },
    context: SubagentContext
): Promise<SubagentResult<ImageArtistResult>> {
    const { prompt, style, aspectRatio } = params;

    try {
        const agent = createImageArtistAgent();

        // Build the generation prompt with context
        const styleContext = style ? `\nStyle preference: ${style}` : "";
        const aspectContext = aspectRatio ? `\nAspect ratio: ${aspectRatio}` : "";

        const result = await agent.generate({
            prompt: `Generate an image for this request:

<user-request>${prompt}</user-request>${styleContext}${aspectContext}

Process:
1. Detect the task type (diagram, text, logo, photo, illustration)
2. Expand the prompt with appropriate details
3. Generate the image using the optimal model
4. Call completeGeneration with the results`,
            abortSignal: context.abortSignal,
        });

        const stepsUsed = result.steps.length;

        // Check for explicit completion
        const completeCall = result.steps
            .flatMap((step) => step.toolCalls ?? [])
            .find((call) => call.toolName === "completeGeneration");

        const completedExplicitly = !!completeCall;

        // Detect step exhaustion
        const exhaustion = detectStepExhaustion(
            stepsUsed,
            MAX_GENERATION_STEPS,
            completedExplicitly
        );

        if (exhaustion.exhausted) {
            logger.warn(
                { userId: context.userId, stepsUsed },
                "🎨 Image Artist hit step limit without completing"
            );

            Sentry.captureMessage("Image Artist exhausted steps", {
                level: "warning",
                tags: {
                    component: "image-artist",
                    action: "generate",
                    quality: "degraded",
                },
                extra: {
                    userId: context.userId,
                    stepsUsed,
                    maxSteps: MAX_GENERATION_STEPS,
                },
            });

            return degradedResult<ImageArtistResult>(
                {
                    generated: false,
                    images: [],
                    expandedPrompt: prompt,
                    originalPrompt: prompt,
                    model: "unknown",
                    taskType: "default",
                    aspectRatio: aspectRatio ?? "1:1",
                    durationMs: 0,
                },
                exhaustion.message ?? "Step limit reached",
                { stepsUsed }
            );
        }

        // Extract result from completion call with runtime validation
        const generationResult: ImageArtistResult = {
            generated: false,
            images: [],
            expandedPrompt: prompt,
            originalPrompt: prompt,
            model: "unknown",
            taskType: "default",
            aspectRatio: aspectRatio ?? "1:1",
            durationMs: 0,
        };

        if (
            completeCall &&
            typeof completeCall === "object" &&
            "args" in completeCall
        ) {
            const args = completeCall.args;
            if (typeof args === "object" && args !== null) {
                // Validate each field at runtime before assignment
                if ("generated" in args && typeof args.generated === "boolean") {
                    generationResult.generated = args.generated;
                }
                if ("images" in args && Array.isArray(args.images)) {
                    generationResult.images = args.images;
                }
                if (
                    "expandedPrompt" in args &&
                    typeof args.expandedPrompt === "string"
                ) {
                    generationResult.expandedPrompt = args.expandedPrompt;
                }
                if (
                    "originalPrompt" in args &&
                    typeof args.originalPrompt === "string"
                ) {
                    generationResult.originalPrompt = args.originalPrompt;
                }
                if ("model" in args && typeof args.model === "string") {
                    generationResult.model = args.model;
                }
                if ("taskType" in args && typeof args.taskType === "string") {
                    generationResult.taskType =
                        args.taskType as ImageArtistResult["taskType"];
                }
                if ("aspectRatio" in args && typeof args.aspectRatio === "string") {
                    generationResult.aspectRatio = args.aspectRatio;
                }
                if ("durationMs" in args && typeof args.durationMs === "number") {
                    generationResult.durationMs = args.durationMs;
                }
                if ("suggestions" in args && typeof args.suggestions === "string") {
                    generationResult.suggestions = args.suggestions;
                }
            }
        }

        logger.info(
            {
                userId: context.userId,
                generated: generationResult.generated,
                model: generationResult.model,
                stepsUsed,
            },
            generationResult.generated
                ? "✅ Image generation complete"
                : "⏭️ Image generation failed"
        );

        return successResult(generationResult, { stepsUsed });
    } catch (error) {
        logger.error(
            {
                error,
                userId: context.userId,
                promptLength: prompt.length,
            },
            "🎨 Image Artist failed"
        );

        Sentry.captureException(error, {
            tags: { component: "image-artist", action: "generate" },
            extra: {
                userId: context.userId,
                promptLength: prompt.length,
            },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "Generation failed"
        );
    }
}

/**
 * Image Artist action parameter schema
 */
const imageArtistActionSchema = z.object({
    action: z
        .enum(["describe", "generate"])
        .describe(
            "Operation to perform. Use 'describe' to see all available operations."
        ),
    prompt: z
        .string()
        .optional()
        .describe("Natural language description of the desired image (for 'generate')"),
    style: z.string().optional().describe("Style hints (for 'generate')"),
    aspectRatio: z
        .enum(["1:1", "16:9", "9:16", "4:3", "3:4"])
        .optional()
        .describe("Aspect ratio (for 'generate')"),
});

type ImageArtistAction = z.infer<typeof imageArtistActionSchema>;

/**
 * Validate required fields for each action
 */
function validateParams(
    params: ImageArtistAction
): { valid: true } | { valid: false; error: string } {
    switch (params.action) {
        case "describe":
            return { valid: true };
        case "generate":
            if (!params.prompt)
                return { valid: false, error: "prompt is required for generate" };
            return { valid: true };
        default:
            return { valid: false, error: `Unknown action: ${params.action}` };
    }
}

/**
 * Create the image artist tool for DCOS
 *
 * Short description for tool list - use action='describe' for full docs.
 */
export function createImageArtistTool(context: SubagentContext) {
    return tool({
        description:
            "Generate high-quality images with prompt engineering and model routing. Use action='describe' for operations.",
        inputSchema: imageArtistActionSchema,
        execute: async (params: ImageArtistAction) => {
            if (params.action === "describe") {
                return describeOperations();
            }

            // Validate required params for this action
            const validation = validateParams(params);
            if (!validation.valid) {
                return errorResult("VALIDATION", validation.error);
            }

            // Wrap execution with safety utilities
            const result = await safeInvoke(
                IMAGE_ARTIST_ID,
                params.action,
                async (ctx) => {
                    switch (params.action) {
                        case "generate":
                            return executeGenerate(
                                {
                                    prompt: params.prompt!,
                                    style: params.style,
                                    aspectRatio: params.aspectRatio,
                                },
                                ctx
                            );
                        default:
                            return errorResult(
                                "VALIDATION",
                                `Unknown action: ${(params as { action: string }).action}`
                            );
                    }
                },
                context
            );

            return result;
        },
    });
}
