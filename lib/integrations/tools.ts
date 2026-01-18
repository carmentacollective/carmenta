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
    AsanaAdapter,
    ClickUpAdapter,
    CoinMarketCapAdapter,
    DropboxAdapter,
    FirefliesAdapter,
    GmailAdapter,
    GoogleCalendarContactsAdapter,
    GoogleDriveAdapter,
    GoogleWorkspaceFilesAdapter,
    LimitlessAdapter,
    LinkedInAdapter,
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
    asana: new AsanaAdapter(),
    clickup: new ClickUpAdapter(),
    coinmarketcap: new CoinMarketCapAdapter(),
    dropbox: new DropboxAdapter(),
    fireflies: new FirefliesAdapter(),
    gmail: new GmailAdapter(),
    "google-calendar-contacts": new GoogleCalendarContactsAdapter(),
    googleDrive: new GoogleDriveAdapter(),
    "google-workspace-files": new GoogleWorkspaceFilesAdapter(),
    limitless: new LimitlessAdapter(),
    linkedin: new LinkedInAdapter(),
    notion: new NotionAdapter(),
    quo: new QuoAdapter(),
    slack: new SlackAdapter(),
    spotify: new SpotifyAdapter(),
    twitter: new TwitterAdapter(),
};

/**
 * Virtual Services Configuration
 *
 * Maps OAuth services to virtual tool adapter IDs.
 * When a user connects the parent service, all virtual tools become available.
 * Tool descriptions come from the adapter's getHelp() - no duplication needed.
 *
 * Pattern: Parent OAuth → Multiple focused LLM tools
 * Example: google-internal → ["gmail", "googleDrive"]
 */
const VIRTUAL_SERVICES: Record<string, string[]> = {
    "google-internal": ["gmail", "googleDrive"],
};

/**
 * Get the adapter instance for a service
 */
export function getAdapter(serviceId: string): ServiceAdapter | null {
    return adapterMap[serviceId] ?? null;
}

/**
 * Build a short description for the tool from service definition.
 * This appears in the tool list and should be concise.
 * The "describe" pattern is documented in the system prompt, not repeated here.
 */
function buildToolDescription(service: ServiceDefinition): string {
    const actions =
        service.capabilities?.slice(0, 4).join(", ") || "various operations";
    const remaining = (service.capabilities?.length ?? 0) - 4;
    const moreText = remaining > 0 ? ` +${remaining} more` : "";
    return `${service.description}. Top operations: ${actions}${moreText}`;
}

/**
 * Input schema for integration tools
 * Note: z.record in Zod v4 requires both key and value schemas
 */
const integrationToolSchema = z.object({
    action: z
        .string()
        .describe(
            "Action to perform. Use 'describe' for all operations, or 'describe' with params.operation for one."
        ),
    params: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
            "Parameters for the action. For describe: {operation: 'name'} for single operation details."
        ),
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

            // Handle describe action - returns documentation
            if (action === "describe") {
                const help = adapter.getHelp();
                const operationName = params?.operation as string | undefined;

                // Targeted describe: return just one operation
                if (operationName) {
                    const operation = help.operations.find(
                        (op) => op.name === operationName
                    );
                    if (operation) {
                        return {
                            service: help.service,
                            operation,
                        };
                    }
                    return {
                        error: `Operation '${operationName}' not found. Use action='describe' to see available operations.`,
                    };
                }

                // Full describe: return all operations
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
                        error: response.content
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
                    error: error instanceof Error ? error.message : "Unknown error",
                };
            }
        },
    });
}

/**
 * Create a tool directly from an adapter (for virtual services)
 */
function createAdapterTool(adapterId: string, userEmail: string) {
    const adapter = getAdapter(adapterId);
    if (!adapter) {
        throw new Error(`No adapter found: ${adapterId}`);
    }

    const help = adapter.getHelp();
    // Use commonOperations if non-empty, otherwise fall back to operations
    const hasCommonOps = (help.commonOperations?.length ?? 0) > 0;
    const topOps = hasCommonOps
        ? help.commonOperations!.slice(0, 4)
        : help.operations.slice(0, 4).map((o) => o.name);
    // Always calculate remaining from total operations count
    const remaining = help.operations.length - topOps.length;
    const moreText = remaining > 0 ? ` +${remaining} more` : "";
    const description = `${help.description || help.service}. Top operations: ${topOps.join(", ")}${moreText}`;

    return tool({
        description,
        inputSchema: integrationToolSchema,
        execute: async ({ action, params }) => {
            logger.info({ service: adapterId, action, userEmail }, "Executing tool");

            if (action === "describe") {
                const operationName = params?.operation as string | undefined;

                // Targeted describe: return just one operation
                if (operationName) {
                    const operation = help.operations.find(
                        (op) => op.name === operationName
                    );
                    if (operation) {
                        return {
                            service: help.service,
                            operation,
                        };
                    }
                    return {
                        error: `Operation '${operationName}' not found. Use action='describe' to see available operations.`,
                    };
                }

                // Full describe: return all operations
                return {
                    service: help.service,
                    description: help.description,
                    commonOperations: help.commonOperations,
                    operations: help.operations,
                    docsUrl: help.docsUrl,
                };
            }

            try {
                const { accountId, ...operationParams } =
                    (params as { accountId?: string }) ?? {};
                const response = await adapter.execute(
                    action,
                    operationParams,
                    userEmail,
                    accountId
                );

                if (response.isError) {
                    return {
                        error: response.content
                            .filter((c) => c.type === "text")
                            .map((c) => c.text)
                            .join("\n"),
                    };
                }

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
                    { error, service: adapterId, action, userEmail },
                    "Tool execution failed"
                );
                Sentry.captureException(error, {
                    tags: { component: "integrations", service: adapterId, action },
                    extra: { userEmail },
                });
                return {
                    error: error instanceof Error ? error.message : "Unknown error",
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
                    errorMessage.includes("CLIENT_ID") || // OAuth client credentials
                    errorMessage.includes("CLIENT_SECRET") ||
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

            // Check if this service exposes virtual tools
            const virtualAdapterIds = VIRTUAL_SERVICES[serviceId];
            if (virtualAdapterIds) {
                // Parent service that exposes virtual tools - don't create tool for parent itself
                for (const adapterId of virtualAdapterIds) {
                    if (!getAdapter(adapterId)) {
                        logger.warn(
                            { adapterId, parentService: serviceId },
                            "No adapter for virtual service"
                        );
                        continue;
                    }
                    tools[adapterId] = createAdapterTool(adapterId, userEmail);
                }
            } else {
                // Regular service - create tool directly
                tools[serviceId] = createServiceTool(service, userEmail);
            }
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
