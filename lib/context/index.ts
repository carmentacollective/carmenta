/**
 * Context Window Management
 *
 * Utilities for managing conversation context across different models.
 * Handles token estimation, context overflow detection, and model routing.
 */

export {
    estimateTokens,
    estimateConversationTokens,
    calculateContextUtilization,
    buildMessageMetadata,
    CONTEXT_WARNING_THRESHOLD,
    CONTEXT_CRITICAL_THRESHOLD,
    CONTEXT_SAFETY_BUFFER,
    type ContextUtilization,
    type MessageMetadata,
} from "./token-estimation";

export {
    applyRoutingRules,
    selectLargerContextModel,
    type RoutingRulesResult,
    type RoutingRulesInput,
} from "./routing-rules";

export { AUDIO_CAPABLE_MODEL, VIDEO_CAPABLE_MODEL } from "@/lib/model-config";
