/**
 * Hard-coded routing rules for model selection.
 *
 * These rules apply AFTER the Concierge makes its decision, overriding
 * when technical requirements demand specific models. These are not
 * quality judgments - they're technical necessities:
 *
 * 1. Attachment requirements (audio/video → Gemini)
 * 2. Context overflow (conversation too long → larger context model)
 * 3. Known bugs (Anthropic reasoning+tools → GPT-5.2)
 * 4. User override (always wins)
 */

import { logger } from "@/lib/logger";
import {
    AUDIO_CAPABLE_MODEL,
    getModel,
    MODELS,
    type ModelId,
    VIDEO_CAPABLE_MODEL,
} from "@/lib/model-config";

import {
    calculateContextUtilization,
    type ContextUtilization,
} from "./token-estimation";
import type { UIMessage } from "ai";

/**
 * Result from applying hard-coded routing rules.
 */
export interface RoutingRulesResult {
    /** Final model ID after applying rules */
    modelId: ModelId;
    /** Whether the model was changed from the original selection */
    wasChanged: boolean;
    /** Reason for the change, if any */
    reason?: string;
    /** Context utilization metrics */
    contextUtilization?: ContextUtilization;
    /** Original model before any changes */
    originalModelId: ModelId;
}

export interface RoutingRulesInput {
    /** Model selected by Concierge or user */
    selectedModelId: ModelId;
    /** User's explicit model override (sacred - always wins) */
    userOverride?: ModelId;
    /** Attachment types present in the conversation */
    attachmentTypes: string[];
    /** Whether reasoning is enabled for this request */
    reasoningEnabled: boolean;
    /** Whether tools are enabled for this request */
    toolsEnabled: boolean;
    /** Full messages for context utilization calculation */
    messages: UIMessage[];
}

/**
 * Applies hard-coded routing rules in priority order.
 *
 * Priority (highest to lowest):
 * 1. User override - if user explicitly selected a model, respect it
 * 2. Attachment requirements - audio/video force specific models
 * 3. Known bugs - avoid broken configurations
 * 4. Context overflow - upgrade to larger context model if needed
 */
export function applyRoutingRules(input: RoutingRulesInput): RoutingRulesResult {
    const {
        selectedModelId,
        userOverride,
        attachmentTypes,
        reasoningEnabled,
        toolsEnabled,
        messages,
    } = input;

    let currentModelId = selectedModelId;
    let wasChanged = false;
    let reason: string | undefined;

    // Rule 0: User override is SACRED - always wins
    if (userOverride) {
        logger.debug(
            { userOverride },
            "User override active - bypassing all routing rules"
        );
        return {
            modelId: userOverride,
            wasChanged: userOverride !== selectedModelId,
            reason:
                userOverride !== selectedModelId ? "User selected model" : undefined,
            originalModelId: selectedModelId,
        };
    }

    // Rule 1: Audio attachments → Gemini (ONLY model with native audio)
    if (attachmentTypes.includes("audio")) {
        if (currentModelId !== AUDIO_CAPABLE_MODEL) {
            logger.info(
                { from: currentModelId, to: AUDIO_CAPABLE_MODEL },
                "Audio attachment detected - forcing audio-capable model"
            );
            currentModelId = AUDIO_CAPABLE_MODEL;
            wasChanged = true;
            reason =
                "Audio file detected - routing to audio-capable model for native audio processing";
        }
    }

    // Rule 2: Video attachments → Gemini (ONLY model with native video)
    if (attachmentTypes.includes("video")) {
        const geminiId = VIDEO_CAPABLE_MODEL;
        if (currentModelId !== geminiId) {
            logger.info(
                { from: currentModelId, to: geminiId },
                "Video attachment detected - forcing Gemini"
            );
            currentModelId = geminiId;
            wasChanged = true;
            reason =
                "Video file detected - routing to Gemini for native video processing";
        }
    }

    // Rule 3: Anthropic reasoning + tools = broken combination
    // See: https://github.com/vercel/ai/issues/9631
    // Thinking blocks in step 1 responses cause API rejection on step 2+
    const modelConfig = getModel(currentModelId);
    const isAnthropicModel = modelConfig?.provider === "anthropic";

    if (isAnthropicModel && reasoningEnabled && toolsEnabled) {
        const fallbackId = "openai/gpt-5.2" as ModelId;
        logger.info(
            { from: currentModelId, to: fallbackId },
            "Anthropic + reasoning + tools is broken - falling back to GPT-5.2"
        );
        currentModelId = fallbackId;
        wasChanged = true;
        reason =
            "Complex reasoning with tools - routing to GPT-5.2 for full capability";
    }

    // Rule 4: Context overflow - upgrade to larger model if needed
    const contextResult = handleContextOverflow(currentModelId, messages);
    if (contextResult.wasChanged) {
        currentModelId = contextResult.modelId;
        wasChanged = true;
        reason = contextResult.reason;
    }

    return {
        modelId: currentModelId,
        wasChanged,
        reason,
        contextUtilization: contextResult.contextUtilization,
        originalModelId: selectedModelId,
    };
}

/**
 * Handles context overflow by upgrading to a larger context model.
 * Climbs the context ladder until we find a model that fits.
 */
function handleContextOverflow(
    currentModelId: ModelId,
    messages: UIMessage[]
): RoutingRulesResult {
    const modelConfig = getModel(currentModelId);
    if (!modelConfig) {
        logger.error({ modelId: currentModelId }, "Unknown model ID in routing rules");
        return {
            modelId: currentModelId,
            wasChanged: false,
            originalModelId: currentModelId,
        };
    }

    const utilization = calculateContextUtilization(
        messages,
        modelConfig.contextWindow,
        modelConfig.provider
    );

    // If we're not critical, no need to switch
    if (!utilization.isCritical) {
        return {
            modelId: currentModelId,
            wasChanged: false,
            contextUtilization: utilization,
            originalModelId: currentModelId,
        };
    }

    // Find a larger model
    const largerModel = selectLargerContextModel(
        currentModelId,
        utilization.estimatedTokens
    );

    if (largerModel && largerModel !== currentModelId) {
        const newModelConfig = getModel(largerModel);
        logger.info(
            {
                from: currentModelId,
                to: largerModel,
                estimatedTokens: utilization.estimatedTokens,
                oldLimit: modelConfig.contextWindow,
                newLimit: newModelConfig?.contextWindow,
            },
            "Context overflow - upgrading to larger model"
        );

        // Recalculate utilization with new model
        const newUtilization = calculateContextUtilization(
            messages,
            newModelConfig?.contextWindow ?? modelConfig.contextWindow,
            newModelConfig?.provider ?? modelConfig.provider
        );

        return {
            modelId: largerModel,
            wasChanged: true,
            reason: `Conversation exceeds ${formatTokens(modelConfig.contextWindow)} context - switched to ${newModelConfig?.displayName ?? largerModel}`,
            contextUtilization: newUtilization,
            originalModelId: currentModelId,
        };
    }

    // No larger model available - we're at the top of the ladder
    logger.warn(
        {
            modelId: currentModelId,
            estimatedTokens: utilization.estimatedTokens,
            contextLimit: modelConfig.contextWindow,
        },
        "Context overflow but no larger model available"
    );

    return {
        modelId: currentModelId,
        wasChanged: false,
        contextUtilization: utilization,
        originalModelId: currentModelId,
    };
}

/**
 * Selects the next larger model from the context ladder.
 * Returns undefined if no larger model is available.
 */
export function selectLargerContextModel(
    currentModelId: ModelId,
    requiredTokens: number
): ModelId | undefined {
    // Find models with enough context, sorted by context size ascending
    const viableModels = MODELS.filter(
        (m) => m.contextWindow > requiredTokens * 1.1 // 10% buffer
    ).sort((a, b) => a.contextWindow - b.contextWindow);

    if (viableModels.length === 0) {
        return undefined;
    }

    // Try to stay in the same family if possible
    const currentConfig = getModel(currentModelId);
    if (currentConfig) {
        const sameProvider = viableModels.find(
            (m) => m.provider === currentConfig.provider
        );
        if (sameProvider) {
            return sameProvider.id as ModelId;
        }
    }

    // Otherwise, return the smallest model that fits
    return viableModels[0].id as ModelId;
}

/**
 * Formats token count for human display.
 */
function formatTokens(tokens: number): string {
    if (tokens >= 1_000_000) {
        return `${(tokens / 1_000_000).toFixed(1)}M`;
    }
    if (tokens >= 1_000) {
        return `${(tokens / 1_000).toFixed(0)}K`;
    }
    return String(tokens);
}
