import { currentUser } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import OpenAI from "openai";
import {
    CopilotRuntime,
    OpenAIAdapter,
    copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";

import { assertEnv, env } from "@/lib/env";
import { backendActions } from "@/lib/copilotkit/actions";
import { logger } from "@/lib/logger";

const MODEL_ID = "anthropic/claude-sonnet-4.5";

// Create the service adapter for OpenRouter (OpenAI-compatible)
const createServiceAdapter = () => {
    assertEnv(env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY");

    const openai = new OpenAI({
        apiKey: env.OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
    });

    // Type assertion needed due to OpenAI version mismatch between our version and CopilotKit's
    return new OpenAIAdapter({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        openai: openai as any,
        model: MODEL_ID,
    });
};

// Create the CopilotKit runtime with backend actions
const createRuntime = () => {
    return new CopilotRuntime({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        actions: backendActions as any,
    });
};

export const POST = async (req: Request) => {
    let userEmail: string | null = null;

    try {
        // Require authentication for CopilotKit API
        const user = await currentUser();
        if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        userEmail = user.emailAddresses[0]?.emailAddress ?? null;

        logger.info({ userEmail, model: MODEL_ID }, "CopilotKit request started");

        Sentry.addBreadcrumb({
            category: "ai.copilotkit",
            message: "Starting CopilotKit request",
            level: "info",
            data: { userEmail, model: MODEL_ID },
        });

        const serviceAdapter = createServiceAdapter();
        const runtime = createRuntime();

        const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
            runtime,
            serviceAdapter,
            endpoint: "/api/copilotkit",
        });

        return handleRequest(req);
    } catch (error) {
        logger.error({ error, userEmail }, "CopilotKit request failed");
        Sentry.captureException(error, {
            tags: { component: "api", route: "copilotkit" },
            extra: { userEmail },
        });

        return new Response(
            JSON.stringify({ error: "Failed to process request. Please try again." }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
};
