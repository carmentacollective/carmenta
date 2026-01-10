/**
 * Image Artist Agent
 *
 * The Image Artist transforms user image requests into high-quality generated
 * images by:
 * - Detecting task type for model routing
 * - Expanding prompts with engineering patterns
 * - Routing to the optimal model
 * - Generating images
 *
 * This agent uses the Vercel AI SDK ToolLoopAgent framework.
 */

import { ToolLoopAgent, stepCountIs, hasToolCall } from "ai";
import { logger } from "@/lib/logger";
import { assertEnv, env } from "@/lib/env";
import { getGatewayClient, translateModelId } from "@/lib/ai/gateway";
import { imageArtistSystemPrompt } from "./prompt";
import {
    detectTaskTypeTool,
    expandPromptTool,
    generateImageTool,
    completeGenerationTool,
} from "./tools";

/**
 * Model for the Image Artist agent
 * Using Sonnet for capable automation
 */
const IMAGE_ARTIST_MODEL = "anthropic/claude-sonnet-4.5";

/**
 * Fallback chain for the agent
 */
const IMAGE_ARTIST_FALLBACK_CHAIN = [
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-sonnet-4",
    "google/gemini-3-flash",
];

/**
 * Safety limit for maximum agentic steps
 *
 * The image artist typically needs:
 * - 1 step to detect task type
 * - 1 step to expand prompt
 * - 1 step to generate image
 * - 1 step to call completeGeneration
 *
 * 6 steps is a reasonable safety limit.
 */
const MAX_STEPS = 6;

/**
 * Create the Image Artist agent
 */
export function createImageArtistAgent() {
    assertEnv(env.AI_GATEWAY_API_KEY, "AI_GATEWAY_API_KEY");

    const gateway = getGatewayClient();

    const agent = new ToolLoopAgent({
        model: gateway(translateModelId(IMAGE_ARTIST_MODEL)),
        instructions: imageArtistSystemPrompt,
        tools: {
            detectTaskType: detectTaskTypeTool,
            expandPrompt: expandPromptTool,
            generateImage: generateImageTool,
            completeGeneration: completeGenerationTool,
        },
        // Stop when agent signals completion, or hit safety limit
        stopWhen: [hasToolCall("completeGeneration"), stepCountIs(MAX_STEPS)],
        providerOptions: {
            gateway: {
                models: IMAGE_ARTIST_FALLBACK_CHAIN.map(translateModelId),
            },
        },
    });

    logger.info(
        {
            model: IMAGE_ARTIST_MODEL,
            fallbacks: IMAGE_ARTIST_FALLBACK_CHAIN,
            maxSteps: MAX_STEPS,
        },
        "🎨 Created Image Artist agent"
    );

    return agent;
}

/**
 * Re-export types for consumers
 */
export type * from "./types";
