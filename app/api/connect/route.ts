import { currentUser } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { assertEnv, env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { SYSTEM_PROMPT } from "@/lib/prompts/system";

const MODEL_ID = "anthropic/claude-sonnet-4.5";

export async function POST(req: Request) {
    let userEmail: string | null = null;

    try {
        // Require authentication for connect API
        const user = await currentUser();
        if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Email is guaranteed by Clerk - it's required for all auth methods we support
        userEmail = user.emailAddresses[0]?.emailAddress ?? null;

        assertEnv(env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY");

        const openrouter = createOpenRouter({
            apiKey: env.OPENROUTER_API_KEY,
        });

        const { messages } = (await req.json()) as { messages: UIMessage[] };

        logger.info(
            { userEmail, messageCount: messages?.length ?? 0, model: MODEL_ID },
            "Starting connection stream"
        );

        // Add breadcrumb for Sentry tracing
        Sentry.addBreadcrumb({
            category: "ai.connect",
            message: "Starting LLM request",
            level: "info",
            data: {
                userEmail,
                model: MODEL_ID,
                messageCount: messages?.length ?? 0,
            },
        });

        const result = await streamText({
            model: openrouter.chat(MODEL_ID),
            system: SYSTEM_PROMPT,
            messages: convertToModelMessages(messages),
            // Enable Sentry LLM tracing via Vercel AI SDK telemetry
            experimental_telemetry: {
                isEnabled: true,
                functionId: "connect",
                // Record inputs/outputs for debugging (be mindful of PII)
                recordInputs: true,
                recordOutputs: true,
                metadata: {
                    userEmail,
                    model: MODEL_ID,
                },
            },
        });

        logger.debug(
            { messageCount: messages?.length ?? 0 },
            "Connection stream initiated"
        );

        return result.toUIMessageStreamResponse({
            originalMessages: messages,
        });
    } catch (error) {
        // Log and report error with user context when available
        logger.error({ error, userEmail }, "Connection request failed");
        Sentry.captureException(error, {
            tags: {
                component: "api",
                route: "connect",
            },
            extra: {
                userEmail,
            },
        });

        // Return user-friendly error response
        return new Response(
            JSON.stringify({
                error: "Failed to process request. Please try again.",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}
