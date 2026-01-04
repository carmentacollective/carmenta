/**
 * Integration Tools Factory
 *
 * Creates Vercel AI SDK tools for connected external services.
 * Each service exposes a single tool with progressive disclosure:
 *   - action='describe' returns full documentation
 *   - Other actions perform operations
 *
 * This pattern reduces token usage by ~95% vs exposing all operations as separate tools.
 */

import * as Sentry from "@sentry/nextjs";
import { tool } from "ai";
import { z } from "zod";

import { getConnectedServices, getCredentials } from "./connection-manager";
import { getServiceById, type ServiceDefinition } from "./services";
import {
    ClickUpAdapter,
    CoinMarketCapAdapter,
    DropboxAdapter,
    FirefliesAdapter,
    GmailAdapter,
    GoogleCalendarContactsAdapter,
    LimitlessAdapter,
    NotionAdapter,
    QuoAdapter,
    SlackAdapter,
    SpotifyAdapter,
    TwitterAdapter,
} from "./adapters";
import type { ServiceAdapter } from "./adapters/base";
import { logger } from "@/lib/logger";

/**
 * Adapter instance registry
 *
 * IMPORTANT: Adapters are sorted alphabetically by service ID to minimize merge conflicts
 * when multiple integrations are added concurrently. When adding a new adapter,
 * insert it in alphabetical order rather than at the end.
 */
const adapterMap: Record<string, ServiceAdapter> = {
    clickup: new ClickUpAdapter(),
    coinmarketcap: new CoinMarketCapAdapter(),
    dropbox: new DropboxAdapter(),
    fireflies: new FirefliesAdapter(),
    gmail: new GmailAdapter(),
    "google-calendar-contacts": new GoogleCalendarContactsAdapter(),
    limitless: new LimitlessAdapter(),
    notion: new NotionAdapter(),
    quo: new QuoAdapter(),
    slack: new SlackAdapter(),
    spotify: new SpotifyAdapter(),
    twitter: new TwitterAdapter(),
};

/**
 * Get the adapter instance for a service
 */
export function getAdapter(serviceId: string): ServiceAdapter | null {
    return adapterMap[serviceId] ?? null;
}

/**
 * Build a short description for the tool from service definition
 * This appears in the tool list and should be concise.
 */
function buildToolDescription(service: ServiceDefinition): string {
    const actions =
        service.capabilities?.slice(0, 4).join(", ") || "various operations";
    return `${service.description}. Actions: ${actions}. Call with action='describe' for full documentation.`;
}

/**
 * Input schema for integration tools
 * Note: z.record in Zod v4 requires both key and value schemas
 */
const integrationToolSchema = z.object({
    action: z
        .string()
        .describe(
            "Action to perform. Use 'describe' to get full documentation of available actions."
        ),
    params: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Parameters for the action (see describe for details)"),
});

/**
 * Create a tool for a connected service
 */
function createServiceTool(service: ServiceDefinition, userEmail: string) {
    const adapter = getAdapter(service.id);
    if (!adapter) {
        throw new Error(`No adapter found for service: ${service.id}`);
    }

    return tool({
        description: buildToolDescription(service),
        inputSchema: integrationToolSchema,
        execute: async ({ action, params }) => {
            logger.info(
                { service: service.id, action, userEmail },
                "Executing integration tool"
            );

            // Handle describe action - returns full documentation
            if (action === "describe") {
                const help = adapter.getHelp();
                return {
                    service: help.service,
                    description: help.description,
                    commonOperations: help.commonOperations,
                    operations: help.operations,
                    docsUrl: help.docsUrl,
                };
            }

            // Execute the actual operation
            try {
                // Extract accountId from params if present (for multi-account support)
                const { accountId, ...operationParams } =
                    (params as { accountId?: string }) ?? {};
                const response = await adapter.execute(
                    action,
                    operationParams,
                    userEmail,
                    accountId
                );

                // Return the response content
                // The adapter returns MCPToolResponse format, extract relevant parts
                if (response.isError) {
                    return {
                        error: true,
                        message: response.content
                            .filter((c) => c.type === "text")
                            .map((c) => c.text)
                            .join("\n"),
                    };
                }

                // Try to parse JSON responses
                const textContent = response.content.find((c) => c.type === "text");
                if (textContent && "text" in textContent) {
                    try {
                        return JSON.parse(textContent.text as string);
                    } catch {
                        return { result: textContent.text };
                    }
                }

                return { result: "Operation completed successfully" };
            } catch (error) {
                logger.error(
                    { error, service: service.id, action, userEmail },
                    "Integration tool execution failed"
                );
                Sentry.captureException(error, {
                    tags: { component: "integrations", service: service.id, action },
                    extra: { userEmail },
                });

                return {
                    error: true,
                    message: error instanceof Error ? error.message : "Unknown error",
                };
            }
        },
    });
}

/**
 * Type for the return value of createServiceTool
 */
type IntegrationTool = ReturnType<typeof createServiceTool>;

/**
 * Get all integration tools for a user's connected services
 *
 * Returns a Record of tool name → tool that can be spread into streamText's tools option.
 *
 * @param userEmail - User's email address (NOT userId UUID - database queries use email)
 *
 * @example
 * ```ts
 * const integrationTools = await getIntegrationTools(userEmail);
 * const result = await streamText({
 *     model: openrouter.chat(modelId),
 *     tools: { ...builtInTools, ...integrationTools },
 *     // ...
 * });
 * ```
 */
export async function getIntegrationTools(
    userEmail: string
): Promise<Record<string, IntegrationTool>> {
    const tools: Record<string, IntegrationTool> = {};

    try {
        // Get user's connected services
        const connectedServiceIds = await getConnectedServices(userEmail);

        if (connectedServiceIds.length === 0) {
            return tools;
        }

        // Create tools for each connected service
        for (const serviceId of connectedServiceIds) {
            const service = getServiceById(serviceId);
            if (!service) {
                logger.warn({ serviceId }, "Unknown connected service");
                continue;
            }

            // Skip services without adapters
            const adapter = getAdapter(serviceId);
            if (!adapter) {
                logger.warn({ serviceId }, "No adapter for connected service");
                continue;
            }

            // Verify credentials exist and are valid
            try {
                await getCredentials(userEmail, serviceId);
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);

                // Distinguish config errors (missing env vars) from user connection issues.
                // Config errors are serious - surface them loudly so they get fixed.
                const isConfigError =
                    errorMessage.includes("environment variable") ||
                    errorMessage.includes("ENCRYPTION_KEY") ||
                    errorMessage.includes("encryption key") || // Matches actual error from decryptCredentials
                    errorMessage.includes("data is corrupted");

                if (isConfigError) {
                    logger.error(
                        { serviceId, error: errorMessage, userEmail },
                        "🚨 Configuration error loading integration - check environment variables"
                    );
                    Sentry.captureException(error, {
                        level: "error",
                        tags: {
                            component: "integrations",
                            service: serviceId,
                            errorType: "config",
                        },
                        extra: { userEmail },
                    });
                } else {
                    // User connection issues (expired token, disconnected, etc.) - warn level
                    logger.warn(
                        { serviceId, error: errorMessage, userEmail },
                        "Skipping service due to credential error"
                    );
                }
                continue;
            }

            // Create the tool
            tools[serviceId] = createServiceTool(service, userEmail);
        }

        // Log success with both attempted and loaded counts for debugging
        const loadedCount = Object.keys(tools).length;
        const attemptedCount = connectedServiceIds.length;

        if (loadedCount < attemptedCount) {
            logger.warn(
                {
                    userEmail,
                    loadedTools: Object.keys(tools),
                    attemptedServices: connectedServiceIds,
                    skippedCount: attemptedCount - loadedCount,
                },
                `⚠️ Integration tools partially loaded (${loadedCount}/${attemptedCount})`
            );
        } else {
            logger.info(
                { userEmail, tools: Object.keys(tools) },
                `Integration tools loaded (${loadedCount})`
            );
        }
    } catch (error) {
        logger.error({ error, userEmail }, "Failed to load integration tools");
        Sentry.captureException(error, {
            tags: { component: "integrations", operation: "load_tools" },
            extra: { userEmail },
        });
    }

    return tools;
}
