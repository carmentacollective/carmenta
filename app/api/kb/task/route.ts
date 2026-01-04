/**
 * Knowledge Base Task API
 *
 * Streaming endpoint for the conversational librarian.
 * Handles direct user requests like "update Sarah's name to Julianna".
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
import {
    createConversationalTools,
    getConversationalPrompt,
} from "@/lib/ai-team/librarian/conversational";
import {
    unauthorizedResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/lib/api/responses";

/**
 * Route segment config
 * Librarian tasks should complete quickly - 30s is generous
 */
export const maxDuration = 30;

/**
 * Request body schema
 */
const requestSchema = z.object({
    message: z.string().min(1, "Message is required"),
});

export async function POST(req: Request) {
    let userEmail: string | null = null;

    try {
        // Authenticate user
        const user = await currentUser();
        if (!user) {
            return unauthorizedResponse();
        }
        userEmail = user.primaryEmailAddress?.emailAddress ?? null;

        // Get database user ID
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
            "📚 Librarian task started"
        );

        // Create tools bound to this user
        const tools = createConversationalTools(dbUser.id);

        // Get AI gateway client
        const gateway = getGatewayClient();
        const primaryModel = LIBRARIAN_FALLBACK_CHAIN[0];

        // Stream the response
        const result = streamText({
            model: gateway(translateModelId(primaryModel)),
            system: getConversationalPrompt(),
            messages: [{ role: "user", content: message }],
            tools,
            stopWhen: stepCountIs(10), // Safety limit
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
                    "📚 Librarian task complete"
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
