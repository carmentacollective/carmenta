/**
 * MCP Configuration API
 *
 * Streaming endpoint for the MCP configuration agent.
 * Handles configuration tasks: parsing input, testing connections, saving servers.
 */

import { currentUser } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import {
    createUIMessageStream,
    createUIMessageStreamResponse,
    stepCountIs,
    streamText,
} from "ai";
import { z } from "zod";

import { getGatewayClient, translateModelId } from "@/lib/ai/gateway";
import { findUserByClerkId } from "@/lib/db/users";
import { LIBRARIAN_FALLBACK_CHAIN } from "@/lib/model-config";
import { logger } from "@/lib/logger";
import { createMcpConfigTools } from "@/lib/mcp/config-agent/tools";
import { getMcpConfigAgentPrompt } from "@/lib/mcp/config-agent/prompt";
import {
    unauthorizedResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/lib/api/responses";

/**
 * Route segment config
 * MCP config tasks may take longer for connection testing
 */
export const maxDuration = 60;

/**
 * Request body schema
 */
const requestSchema = z.object({
    message: z.string().min(1, "Message is required"),
});

export async function POST(req: Request) {
    try {
        // Authenticate user
        const user = await currentUser();
        if (!user) {
            return unauthorizedResponse();
        }
        const userEmail = user.primaryEmailAddress?.emailAddress ?? null;

        // Get database user for email
        const dbUser = await findUserByClerkId(user.id);
        if (!dbUser) {
            logger.warn({ clerkId: user.id }, "User not found in database");
            return unauthorizedResponse();
        }

        // Parse and validate request
        const body = await req.json();
        const parsed = requestSchema.safeParse(body);
        if (!parsed.success) {
            return validationErrorResponse(parsed.error.issues[0].message);
        }

        const { message } = parsed.data;

        logger.info(
            { userEmail, messageLength: message.length },
            "🔌 MCP config task started"
        );

        // Create tools bound to this user's email
        const tools = createMcpConfigTools(dbUser.email);

        // Get AI gateway client
        const gateway = getGatewayClient();
        const primaryModel = LIBRARIAN_FALLBACK_CHAIN[0];

        // Stream the response
        const result = streamText({
            model: gateway(translateModelId(primaryModel)),
            system: getMcpConfigAgentPrompt(),
            messages: [{ role: "user", content: message }],
            tools,
            stopWhen: stepCountIs(15), // Allow more steps for connection testing
            providerOptions: {
                gateway: {
                    models: LIBRARIAN_FALLBACK_CHAIN.map(translateModelId),
                },
            },
            onFinish: ({ text, toolCalls }) => {
                logger.info(
                    {
                        userEmail,
                        textLength: text?.length ?? 0,
                        toolCallCount: toolCalls?.length ?? 0,
                    },
                    "🔌 MCP config task complete"
                );
            },
        });

        // Return the stream as UIMessage format for useChat compatibility
        const stream = createUIMessageStream({
            execute: ({ writer }) => {
                writer.merge(result.toUIMessageStream());
            },
        });

        return createUIMessageStreamResponse({ stream });
    } catch (error) {
        // serverErrorResponse already logs and captures to Sentry
        return serverErrorResponse(error);
    }
}
