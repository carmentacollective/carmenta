/**
 * DCOS API Route
 *
 * Streaming endpoint for the Digital Chief of Staff.
 * Powers the universal Carmenta modal.
 */

import { currentUser } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import {
    createUIMessageStream,
    createUIMessageStreamResponse,
    type UIMessage,
} from "ai";
import { z } from "zod";

import { getOrCreateUser } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
    unauthorizedResponse,
    validationErrorResponse,
    serverErrorResponse,
} from "@/lib/api/responses";
import { executeDCOS } from "@/lib/ai-team/dcos";

/**
 * Route segment config for Vercel
 * DCOS orchestration can involve subagent calls
 */
export const maxDuration = 60;

/**
 * Request body schema
 */
const requestSchema = z.object({
    messages: z.array(z.any()).min(1, "At least one message is required"),
    /** Current page context for routing hints */
    pageContext: z.string().optional(),
    /** Channel the request originated from */
    channel: z.enum(["web", "sms", "voice"]).default("web"),
    /** Model override (optional) */
    modelOverride: z.string().optional(),
});

export async function POST(req: Request) {
    let userEmail: string | null = null;

    try {
        // Authentication
        const user = await currentUser();
        if (!user && process.env.NODE_ENV === "production") {
            return unauthorizedResponse();
        }

        userEmail = user?.emailAddresses[0]?.emailAddress ?? "dev-user@local";

        // Validate request body
        const body = await req.json();
        const parseResult = requestSchema.safeParse(body);

        if (!parseResult.success) {
            logger.warn(
                { userEmail, error: parseResult.error.flatten() },
                "Invalid DCOS request body"
            );
            return validationErrorResponse(parseResult.error.flatten());
        }

        const { messages, pageContext, channel, modelOverride } = parseResult.data as {
            messages: UIMessage[];
            pageContext?: string;
            channel: "web" | "sms" | "voice";
            modelOverride?: string;
        };

        // Get or create user in database
        const dbUser = await getOrCreateUser(user?.id ?? "dev-user-id", userEmail!, {
            firstName: user?.firstName ?? null,
            lastName: user?.lastName ?? null,
            displayName: user?.fullName ?? null,
            imageUrl: user?.imageUrl ?? null,
        });

        logger.info(
            {
                userEmail,
                userId: dbUser.id,
                messageCount: messages.length,
                channel,
                hasPageContext: !!pageContext,
            },
            "🎯 DCOS request received"
        );

        Sentry.addBreadcrumb({
            category: "dcos.request",
            message: "DCOS API request",
            level: "info",
            data: { userEmail, channel, messageCount: messages.length },
        });

        // Build channel constraints
        const channelConstraints = {
            maxResponseLength: channel === "sms" ? 160 : undefined,
            supportsMarkdown: channel === "web",
            supportsToolDisplay: channel === "web",
        };

        // Create the UI message stream
        const stream = createUIMessageStream({
            execute: async ({ writer }) => {
                // Execute DCOS with the writer for status updates
                const result = await executeDCOS({
                    userId: dbUser.id,
                    userEmail: userEmail!,
                    userName: user?.firstName ?? undefined,
                    messages,
                    writer,
                    input: {
                        message: "", // Not used directly, messages array is used
                        channel,
                        channelConstraints,
                        pageContext,
                    },
                    modelOverride,
                });

                // Merge the streamText result into our stream
                writer.merge(result.toUIMessageStream({ sendReasoning: false }));
            },
        });

        // Build response headers
        const headers = new Headers();
        headers.set("X-Channel", channel);

        return createUIMessageStreamResponse({
            stream,
            headers,
        });
    } catch (error) {
        logger.error({ error, userEmail }, "DCOS request failed");

        Sentry.captureException(error, {
            tags: { component: "dcos", route: "api" },
            extra: { userEmail },
        });

        return serverErrorResponse(error, {
            userEmail,
            route: "dcos",
        });
    }
}
