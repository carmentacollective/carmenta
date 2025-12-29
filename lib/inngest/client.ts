/**
 * Inngest client for Carmenta.
 *
 * Provides durable execution for long-running tasks like deep research,
 * complex analysis, and background work. Events contain only IDs for security.
 */

import { Inngest, EventSchemas } from "inngest";

/**
 * Event types for Inngest functions.
 * Payloads contain only IDs - functions fetch content from database.
 */
type Events = {
    /**
     * Triggered when a connection response should run in background mode.
     * The function loads messages from DB and writes to the resumable stream.
     */
    "connection/background": {
        data: {
            /** Database ID of the connection */
            connectionId: number;
            /** User ID (UUID) */
            userId: string;
            /** Stream ID for resumable stream (nanoid) */
            streamId: string;
            /** Model ID selected by concierge */
            modelId: string;
            /** Temperature selected by concierge */
            temperature: number;
            /** Reasoning config from concierge */
            reasoning: {
                enabled: boolean;
                effort?: "high" | "medium" | "low" | "none";
                maxTokens?: number;
            };
        };
    };
};

/**
 * Inngest client singleton.
 * Used across all Inngest functions in the application.
 */
export const inngest = new Inngest({
    id: "carmenta",
    schemas: new EventSchemas().fromRecord<Events>(),
});
