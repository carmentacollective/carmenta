/**
 * Braintrust Integration
 *
 * Shared Braintrust utilities for evals and production tracing.
 *
 * Set BRAINTRUST_API_KEY in .env.local to enable Braintrust features.
 */

import * as Sentry from "@sentry/nextjs";
import { initLogger, type Logger } from "braintrust";

import { env } from "@/lib/env";
import { logger as pino } from "@/lib/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let braintrustLogger: Logger<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let initializationPromise: Promise<Logger<any> | null> | null = null;

/**
 * Check if Braintrust is configured and available
 */
export function isBraintrustEnabled(): boolean {
    return !!env.BRAINTRUST_API_KEY;
}

/**
 * Get the initialized Braintrust logger instance
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getBraintrustLogger(): Logger<any> | null {
    return braintrustLogger;
}

/**
 * Initialize Braintrust logger for production tracing
 * Call once at server startup to set up the logger
 * Uses a promise to ensure only one initialization happens
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function initBraintrustLogger(): Promise<Logger<any> | null> {
    if (!isBraintrustEnabled()) {
        return null;
    }

    // Return existing logger if already initialized
    if (braintrustLogger) {
        return braintrustLogger;
    }

    // Return existing promise if initialization is in progress
    if (initializationPromise) {
        return initializationPromise;
    }

    // Create initialization promise
    initializationPromise = (async () => {
        try {
            braintrustLogger = await initLogger({
                projectName: "carmenta-production",
                apiKey: env.BRAINTRUST_API_KEY,
            });
            pino.info("✅ Braintrust logger initialized for production tracing");
            return braintrustLogger;
        } catch (error) {
            pino.error({ error }, "❌ Failed to initialize Braintrust logger");
            Sentry.captureException(error, {
                level: "warning",
                tags: { component: "braintrust", action: "init" },
            });
            braintrustLogger = null;
            return null;
        }
    })();

    return initializationPromise;
}

/**
 * Log a production trace to Braintrust
 * Records input, metadata, output, and metrics for production observability
 */
export async function logTraceData(traceData: {
    input: {
        messageCount: number;
        lastMessagePreview: string;
    };
    metadata: {
        model: string;
        temperature: number;
        reasoningEnabled: boolean;
        reasoningEffort?: string;
        explanation: string;
        userEmail: string;
    };
    output: {
        text: string;
        toolsCalled: string[];
    };
    metrics: {
        inputTokens?: number;
        outputTokens?: number;
        cachedInputTokens?: number;
    };
}): Promise<void> {
    try {
        const logger = getBraintrustLogger();
        if (!logger) {
            pino.debug("Braintrust logger not available, skipping trace logging");
            return;
        }

        // Log the trace event to Braintrust
        // The logger will handle sending to Braintrust's API
        await logger.log({
            input: traceData.input,
            metadata: traceData.metadata,
            output: traceData.output,
            metrics: traceData.metrics,
        });

        pino.debug("✅ Production trace logged to Braintrust");
    } catch (error) {
        // Log error but don't fail the request - tracing is secondary to core functionality
        pino.error(
            { error },
            "Failed to log trace data to Braintrust - continuing normally"
        );
    }
}
