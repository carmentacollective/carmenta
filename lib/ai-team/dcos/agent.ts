/**
 * DCOS Agent
 *
 * The Digital Chief of Staff - orchestrates specialized subagents through
 * an agents-as-tools pattern. Users talk to Carmenta; DCOS delegates invisibly.
 *
 * Uses Vercel AI SDK v6 streamText with tool calling.
 */

import {
    streamText,
    stepCountIs,
    convertToModelMessages,
    type UIMessage,
    type UIMessageStreamWriter,
} from "ai";
import * as Sentry from "@sentry/nextjs";

import { logger } from "@/lib/logger";
import { getGatewayClient, translateModelId, translateOptions } from "@/lib/ai/gateway";
import { getFallbackChain } from "@/lib/model-config";
import { getIntegrationTools } from "@/lib/integrations/tools";
import { createSearchKnowledgeTool } from "@/lib/tools/built-in";
import { writeStatus } from "@/lib/streaming";

import { buildDCOSPrompt } from "./prompt";
import { type SubagentContext, type DCOSInput } from "./types";
import { createLibrarianTool } from "../agents/librarian-tool";
import { createMcpConfigTool } from "../agents/mcp-config-tool";

/**
 * Default model for DCOS
 * Sonnet for balanced capability/cost on orchestration tasks
 */
const DCOS_DEFAULT_MODEL = "anthropic/claude-sonnet-4";

/**
 * Maximum orchestration steps
 * DCOS typically needs 1-3 steps (delegate → synthesize)
 * Higher limit allows complex multi-tool workflows
 */
const DCOS_MAX_STEPS = 15;

/**
 * Fallback chain for DCOS
 */
const DCOS_FALLBACK_CHAIN = [
    "anthropic/claude-sonnet-4",
    "google/gemini-2.5-pro",
    "openai/gpt-4.1",
];

/**
 * Input for DCOS execution
 */
export interface DCOSExecutionInput {
    /** User ID for permissions and KB access */
    userId: string;
    /** User email for integrations */
    userEmail: string;
    /** User's display name */
    userName?: string;
    /** Conversation messages */
    messages: UIMessage[];
    /** Stream writer for status updates */
    writer: UIMessageStreamWriter;
    /** Input context (channel, page) */
    input?: DCOSInput;
    /** Model override (optional) */
    modelOverride?: string;
    /** Abort signal for cancellation (optional) */
    abortSignal?: AbortSignal;
}

/**
 * Get user-friendly status message for subagent delegation
 */
function getSubagentStatusMessage(toolName: string, action?: string): string {
    const actionSuffix = action ? ` (${action})` : "";

    switch (toolName) {
        case "librarian":
            if (action === "search") return "Searching knowledge...";
            if (action === "extract") return "Analyzing conversation...";
            if (action === "retrieve") return "Retrieving document...";
            return `Working with Librarian${actionSuffix}`;
        case "mcpConfig":
            if (action === "list") return "Listing integrations...";
            if (action === "test") return "Testing connection...";
            if (action === "guide") return "Getting setup guide...";
            return "Configuring integrations...";
        case "researcher":
            return "Researching...";
        case "searchKnowledge":
            return "Searching knowledge...";
        default:
            // Integration tools
            return `Using ${toolName}...`;
    }
}

/**
 * Execute DCOS agent with streaming
 *
 * Returns a streamText result that can be merged into a UIMessageStream.
 */
export async function executeDCOS(input: DCOSExecutionInput) {
    const {
        userId,
        userEmail,
        userName,
        messages,
        writer,
        input: dcosInput,
        modelOverride,
        abortSignal,
    } = input;

    const modelId = modelOverride ?? DCOS_DEFAULT_MODEL;

    // Build subagent context
    const subagentContext: SubagentContext = {
        userId,
        userEmail,
        writer,
        abortSignal,
    };

    // Create subagent tools
    const librarianTool = createLibrarianTool(subagentContext);
    const mcpConfigTool = createMcpConfigTool(subagentContext);

    // Load integration tools for connected services
    const integrationTools = await getIntegrationTools(userEmail);

    // Create searchKnowledge tool (direct KB search without agent)
    const searchKnowledgeTool = createSearchKnowledgeTool(userId);

    // Combine all tools
    const allTools = {
        librarian: librarianTool,
        mcpConfig: mcpConfigTool,
        searchKnowledge: searchKnowledgeTool,
        ...integrationTools,
        // Future: researcher, quoHandler
    };

    // Build system prompt with context
    const systemPrompt = buildDCOSPrompt({
        userName,
        pageContext: dcosInput?.pageContext,
    });

    // Build provider options with fallback
    const providerOptions = translateOptions(modelId, {
        fallbackModels: getFallbackChain(modelId) ?? DCOS_FALLBACK_CHAIN,
    });

    logger.info(
        {
            userId,
            userEmail,
            model: modelId,
            messageCount: messages.length,
            tools: Object.keys(allTools),
            pageContext: dcosInput?.pageContext?.slice(0, 50),
        },
        "🎯 Starting DCOS execution"
    );

    Sentry.addBreadcrumb({
        category: "dcos.execute",
        message: "Starting DCOS orchestration",
        level: "info",
        data: { userId, model: modelId, messageCount: messages.length },
    });

    const gateway = getGatewayClient();

    // Convert UI messages to model messages
    const modelMessages = await convertToModelMessages(messages);

    // Execute with streaming
    const result = streamText({
        model: gateway(translateModelId(modelId)),
        system: systemPrompt,
        messages: modelMessages,
        tools: allTools,
        stopWhen: stepCountIs(DCOS_MAX_STEPS),
        abortSignal,
        providerOptions,
        onChunk: ({ chunk }) => {
            // Emit status when a tool call starts
            if (chunk.type === "tool-call") {
                // Extract action from tool input if available
                const input = chunk.input as { action?: string } | undefined;
                const action = input?.action;
                const message = getSubagentStatusMessage(chunk.toolName, action);

                writeStatus(writer, `tool-${chunk.toolCallId}`, message, "🔧");
            }

            // Clear status when tool result arrives
            if (chunk.type === "tool-result") {
                writeStatus(writer, `tool-${chunk.toolCallId}`, "");
            }
        },
        onFinish: async ({ text, toolCalls, usage }) => {
            logger.info(
                {
                    userId,
                    textLength: text?.length ?? 0,
                    toolCallCount: toolCalls.length,
                    inputTokens: usage?.inputTokens,
                    outputTokens: usage?.outputTokens,
                },
                "✅ DCOS execution completed"
            );
        },
        experimental_telemetry: {
            isEnabled: true,
            functionId: "dcos",
            recordInputs: true,
            recordOutputs: true,
            metadata: {
                userEmail,
                model: modelId,
                channel: dcosInput?.channel ?? "web",
            },
        },
    });

    return result;
}
