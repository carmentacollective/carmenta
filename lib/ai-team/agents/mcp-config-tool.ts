/**
 * MCP Configuration Tool for DCOS
 *
 * Wraps integration management as a tool callable by DCOS.
 * Uses progressive disclosure pattern - action='describe' returns full docs.
 *
 * Actions:
 * - describe: Returns full operation documentation
 * - list: List connected integrations and their status
 * - test: Test a specific integration's connectivity
 * - guide: Get guidance on setting up a new integration
 * - create: Add a new MCP server configuration
 * - update: Update an existing MCP server configuration
 * - delete: Remove an MCP server configuration
 */

import { tool } from "ai";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { getConnectedServices } from "@/lib/integrations/connection-manager";
import { parseAuthHeaders } from "@/lib/mcp/auth-helpers";
import { getServicesWithStatus } from "@/lib/actions/integrations";
import {
    type SubagentResult,
    type SubagentDescription,
    type SubagentContext,
    successResult,
    errorResult,
} from "@/lib/ai-team/dcos/types";
import { safeInvoke } from "@/lib/ai-team/dcos/utils";

/**
 * MCP Config subagent ID
 */
const MCP_CONFIG_ID = "mcp-config";

/**
 * Describe MCP config operations for progressive disclosure
 */
function describeOperations(): SubagentDescription {
    return {
        id: MCP_CONFIG_ID,
        name: "Integration Configuration",
        summary:
            "Manages external service integrations - lists connected services, tests connections, and guides users through setup.",
        operations: [
            {
                name: "list",
                description:
                    "List all integrations - both connected and available. Shows status and account details for connected services.",
                params: [],
            },
            {
                name: "test",
                description:
                    "Test connectivity for a specific integration. Returns success or error details.",
                params: [
                    {
                        name: "serviceId",
                        type: "string",
                        description:
                            "Service identifier (e.g., 'notion', 'slack', 'google-calendar-contacts')",
                        required: true,
                    },
                    {
                        name: "accountId",
                        type: "string",
                        description:
                            "Specific account ID if user has multiple accounts",
                        required: false,
                    },
                ],
            },
            {
                name: "guide",
                description:
                    "Get setup guidance for a specific service. Explains authentication method and steps.",
                params: [
                    {
                        name: "serviceId",
                        type: "string",
                        description: "Service to get setup guidance for",
                        required: true,
                    },
                ],
            },
            {
                name: "create",
                description:
                    "Add a new MCP server configuration. Use this when the user provides MCP server details (URL, headers, etc.).",
                params: [
                    {
                        name: "identifier",
                        type: "string",
                        description:
                            "Unique identifier for the server (e.g., 'machina', 'my-custom-server')",
                        required: true,
                    },
                    {
                        name: "displayName",
                        type: "string",
                        description:
                            "Human-readable name for display (defaults to identifier if not provided)",
                        required: false,
                    },
                    {
                        name: "url",
                        type: "string",
                        description: "MCP server endpoint URL",
                        required: true,
                    },
                    {
                        name: "headers",
                        type: "object",
                        description:
                            "HTTP headers for authentication (e.g., {'Authorization': 'Bearer <token>'} or {'X-API-Key': '<key>'})",
                        required: false,
                    },
                ],
            },
            {
                name: "update",
                description:
                    "Update an existing MCP server configuration. Use this when the user wants to change URL, headers, or display name of an existing server.",
                params: [
                    {
                        name: "identifier",
                        type: "string",
                        description:
                            "Identifier of the server to update (e.g., 'machina')",
                        required: true,
                    },
                    {
                        name: "displayName",
                        type: "string",
                        description: "New human-readable name for display",
                        required: false,
                    },
                    {
                        name: "url",
                        type: "string",
                        description: "New MCP server endpoint URL",
                        required: false,
                    },
                    {
                        name: "headers",
                        type: "object",
                        description:
                            "New HTTP headers for authentication (replaces existing headers)",
                        required: false,
                    },
                ],
            },
            {
                name: "delete",
                description:
                    "Remove an MCP server configuration. Use this when the user wants to disconnect or remove an MCP server.",
                params: [
                    {
                        name: "identifier",
                        type: "string",
                        description:
                            "Identifier of the server to delete (e.g., 'machina')",
                        required: true,
                    },
                ],
            },
        ],
    };
}

/**
 * List services result
 */
interface ListData {
    connected: Array<{
        serviceId: string;
        serviceName: string;
        status: string;
        accountId: string;
        accountDisplayName: string | null;
        isDefault: boolean;
    }>;
    available: Array<{
        id: string;
        name: string;
        description: string;
        authMethod: "oauth" | "api_key";
    }>;
}

/**
 * Execute list action
 */
async function executeList(
    context: SubagentContext
): Promise<SubagentResult<ListData>> {
    try {
        // Pass explicit userEmail - don't rely on Clerk session in agent context
        const services = await getServicesWithStatus(context.userEmail);

        const data: ListData = {
            connected: services.connected.map((s) => ({
                serviceId: s.service.id,
                serviceName: s.service.name,
                status: s.status,
                accountId: s.accountId,
                accountDisplayName: s.accountDisplayName,
                isDefault: s.isDefault,
            })),
            available: services.available.map((s) => ({
                id: s.id,
                name: s.name,
                description: s.description,
                authMethod: s.authMethod,
            })),
        };

        logger.info(
            {
                userEmail: context.userEmail,
                connectedCount: data.connected.length,
                availableCount: data.available.length,
            },
            "🔧 Listed integrations"
        );

        return successResult(data);
    } catch (error) {
        logger.error(
            { error, userEmail: context.userEmail },
            "🔧 Failed to list integrations"
        );

        Sentry.captureException(error, {
            tags: { component: "mcp-config", action: "list" },
            extra: { userEmail: context.userEmail },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "Failed to list integrations"
        );
    }
}

/**
 * Test result
 */
interface TestData {
    success: boolean;
    serviceId: string;
    accountId?: string;
    error?: string;
}

/**
 * Execute test action
 */
async function executeTest(
    params: { serviceId: string; accountId?: string },
    context: SubagentContext
): Promise<SubagentResult<TestData>> {
    const { serviceId, accountId } = params;

    try {
        // Check if service is connected
        const connected = await getConnectedServices(context.userEmail);

        if (!connected.includes(serviceId)) {
            logger.warn(
                { userEmail: context.userEmail, serviceId },
                "🔧 Service not connected for test"
            );

            return successResult<TestData>({
                success: false,
                serviceId,
                accountId,
                error: `Service '${serviceId}' is not connected. Use the integrations page to connect it first.`,
            });
        }

        // Dynamic import to avoid circular deps
        const { testIntegration } = await import("@/lib/actions/integrations");
        const result = await testIntegration(serviceId, accountId);

        logger.info(
            {
                userEmail: context.userEmail,
                serviceId,
                accountId,
                success: result.success,
            },
            result.success ? "✅ Integration test passed" : "❌ Integration test failed"
        );

        return successResult<TestData>({
            success: result.success,
            serviceId,
            accountId,
            error: result.error,
        });
    } catch (error) {
        logger.error(
            { error, userEmail: context.userEmail, serviceId, accountId },
            "🔧 Integration test failed with exception"
        );

        Sentry.captureException(error, {
            tags: { component: "mcp-config", action: "test" },
            extra: { userEmail: context.userEmail, serviceId, accountId },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "Test failed"
        );
    }
}

/**
 * Guide result
 */
interface GuideData {
    serviceId: string;
    name: string;
    authMethod: "oauth" | "api_key";
    setupUrl: string;
    instructions: string;
}

/**
 * Execute guide action
 */
async function executeGuide(
    params: { serviceId: string },
    context: SubagentContext
): Promise<SubagentResult<GuideData>> {
    const { serviceId } = params;

    try {
        // Get service definition
        const { getServiceById } = await import("@/lib/integrations/services");
        const service = getServiceById(serviceId);

        if (!service) {
            logger.warn(
                { userEmail: context.userEmail, serviceId },
                "🔧 Unknown service requested for guide"
            );

            return errorResult(
                "VALIDATION",
                `Unknown service: '${serviceId}'. Use action='list' to see available services.`
            );
        }

        const isOAuth = service.authMethod === "oauth";

        const instructions = isOAuth
            ? `To connect ${service.name}:
1. Navigate to the integrations page
2. Click on ${service.name}
3. We'll redirect you to ${service.name} to authorize access
4. Grant the requested permissions
5. You'll be redirected back once connected`
            : `To connect ${service.name}:
1. Navigate to the integrations page
2. Click on ${service.name}
3. Enter your API key (find this in your ${service.name} account settings)
4. Click Connect
5. We'll test the connection automatically`;

        logger.info(
            {
                userEmail: context.userEmail,
                serviceId,
            },
            "📖 Generated setup guide"
        );

        return successResult<GuideData>({
            serviceId,
            name: service.name,
            authMethod: service.authMethod,
            setupUrl: `/integrations`,
            instructions,
        });
    } catch (error) {
        logger.error(
            { error, userEmail: context.userEmail, serviceId },
            "🔧 Failed to generate setup guide"
        );

        Sentry.captureException(error, {
            tags: { component: "mcp-config", action: "guide" },
            extra: { userEmail: context.userEmail, serviceId },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "Failed to generate guide"
        );
    }
}

/**
 * Create MCP server result
 */
interface CreateData {
    success: boolean;
    server: {
        id: number;
        identifier: string;
        displayName: string;
        url: string;
        status: string;
    };
}

/**
 * Execute create action - adds a new MCP server configuration
 */
async function executeCreate(
    params: {
        identifier: string;
        displayName?: string;
        url: string;
        headers?: Record<string, string>;
    },
    context: SubagentContext
): Promise<SubagentResult<CreateData>> {
    const { identifier, displayName, url, headers } = params;

    try {
        // Import the db function
        const { createMcpServer } = await import("@/lib/db/mcp-servers");

        // Parse auth configuration from headers
        const { authType, token, authHeaderName } = parseAuthHeaders(headers);

        // Create the server
        const server = await createMcpServer({
            userEmail: context.userEmail,
            identifier,
            displayName: displayName || identifier,
            url,
            transport: "sse",
            authType,
            credentials: token ? { token } : undefined,
            authHeaderName,
        });

        logger.info(
            {
                userEmail: context.userEmail,
                serverId: server.id,
                identifier,
                url,
            },
            "🔧 Created MCP server configuration"
        );

        return successResult<CreateData>({
            success: true,
            server: {
                id: server.id,
                identifier: server.identifier,
                displayName: server.displayName,
                url: server.url,
                status: server.status,
            },
        });
    } catch (error) {
        logger.error(
            { error, userEmail: context.userEmail, identifier, url },
            "🔧 Failed to create MCP server"
        );

        Sentry.captureException(error, {
            tags: { component: "mcp-config", action: "create" },
            extra: { userEmail: context.userEmail, identifier, url },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "Failed to create MCP server"
        );
    }
}

/**
 * Update MCP server result
 */
interface UpdateData {
    success: boolean;
    server: {
        id: number;
        identifier: string;
        displayName: string;
        url: string;
        status: string;
    };
}

/**
 * Execute update action - updates an existing MCP server configuration
 */
async function executeUpdate(
    params: {
        identifier: string;
        displayName?: string;
        url?: string;
        headers?: Record<string, string>;
    },
    context: SubagentContext
): Promise<SubagentResult<UpdateData>> {
    const { identifier, displayName, url, headers } = params;

    try {
        // Import the db functions
        const { getMcpServerByIdentifier, updateMcpServer } =
            await import("@/lib/db/mcp-servers");

        // Find the existing server
        const existing = await getMcpServerByIdentifier(context.userEmail, identifier);
        if (!existing) {
            return errorResult(
                "VALIDATION",
                `MCP server '${identifier}' not found. Use action='list' to see available servers, or action='create' to add a new one.`
            );
        }

        // Build update data
        const updateData: {
            displayName?: string;
            url?: string;
            authType?: "none" | "bearer" | "header";
            credentials?: { token: string };
            authHeaderName?: string;
        } = {};

        if (displayName) updateData.displayName = displayName;
        if (url) updateData.url = url;

        // Parse auth configuration from headers if provided
        if (headers) {
            const { authType, token, authHeaderName } = parseAuthHeaders(headers);
            updateData.authType = authType;
            if (token) updateData.credentials = { token };
            if (authHeaderName) updateData.authHeaderName = authHeaderName;
        }

        // Update the server
        const server = await updateMcpServer(existing.id, updateData);

        if (!server) {
            return errorResult("PERMANENT", "Failed to update MCP server");
        }

        logger.info(
            {
                userEmail: context.userEmail,
                serverId: server.id,
                identifier,
                url: url || server.url,
            },
            "🔧 Updated MCP server configuration"
        );

        return successResult<UpdateData>({
            success: true,
            server: {
                id: server.id,
                identifier: server.identifier,
                displayName: server.displayName,
                url: server.url,
                status: server.status,
            },
        });
    } catch (error) {
        logger.error(
            { error, userEmail: context.userEmail, identifier, url },
            "🔧 Failed to update MCP server"
        );

        Sentry.captureException(error, {
            tags: { component: "mcp-config", action: "update" },
            extra: { userEmail: context.userEmail, identifier, url },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "Failed to update MCP server"
        );
    }
}

/**
 * Delete MCP server result
 */
interface DeleteData {
    success: boolean;
    identifier: string;
}

/**
 * Execute delete action - removes an MCP server configuration
 */
async function executeDelete(
    params: { identifier: string },
    context: SubagentContext
): Promise<SubagentResult<DeleteData>> {
    const { identifier } = params;

    try {
        // Import the db functions
        const { getMcpServerByIdentifier, deleteMcpServer } =
            await import("@/lib/db/mcp-servers");

        // Find the existing server
        const existing = await getMcpServerByIdentifier(context.userEmail, identifier);
        if (!existing) {
            return errorResult(
                "VALIDATION",
                `MCP server '${identifier}' not found. Use action='list' to see available servers.`
            );
        }

        // Delete the server
        const deleted = await deleteMcpServer(existing.id);

        if (!deleted) {
            return errorResult("PERMANENT", "Failed to delete MCP server");
        }

        logger.info(
            {
                userEmail: context.userEmail,
                identifier,
            },
            "🔧 Deleted MCP server configuration"
        );

        return successResult<DeleteData>({
            success: true,
            identifier,
        });
    } catch (error) {
        logger.error(
            { error, userEmail: context.userEmail, identifier },
            "🔧 Failed to delete MCP server"
        );

        Sentry.captureException(error, {
            tags: { component: "mcp-config", action: "delete" },
            extra: { userEmail: context.userEmail, identifier },
        });

        return errorResult(
            "PERMANENT",
            error instanceof Error ? error.message : "Failed to delete MCP server"
        );
    }
}

/**
 * MCP Config action parameter schema
 *
 * Flat object schema because discriminatedUnion produces oneOf which
 * AWS Bedrock doesn't support. Validation happens in execute.
 */
const mcpConfigActionSchema = z.object({
    action: z
        .enum(["describe", "list", "test", "guide", "create", "update", "delete"])
        .describe(
            "Operation to perform. Use 'describe' to see all available operations."
        ),
    serviceId: z.string().optional().describe("Service ID (for 'test' and 'guide')"),
    accountId: z.string().optional().describe("Specific account ID (for 'test')"),
    identifier: z
        .string()
        .optional()
        .describe("Server identifier (for 'create', 'update', 'delete')"),
    displayName: z
        .string()
        .optional()
        .describe("Human-readable display name (for 'create', 'update')"),
    url: z
        .string()
        .optional()
        .describe("MCP server endpoint URL (for 'create', 'update')"),
    headers: z
        .record(z.string(), z.string())
        .optional()
        .describe("HTTP headers for auth (for 'create', 'update')"),
});

type McpConfigAction = z.infer<typeof mcpConfigActionSchema>;

/**
 * Validate required fields for each action
 */
function validateMcpParams(
    params: McpConfigAction
): { valid: true } | { valid: false; error: string } {
    switch (params.action) {
        case "describe":
        case "list":
            return { valid: true };
        case "test":
        case "guide":
            if (!params.serviceId)
                return { valid: false, error: "serviceId is required" };
            return { valid: true };
        case "create":
            if (!params.identifier)
                return { valid: false, error: "identifier is required" };
            // Validate identifier format (must match API schema)
            if (!/^[a-z0-9][a-z0-9-_.]*$/i.test(params.identifier)) {
                return {
                    valid: false,
                    error: "identifier must start with alphanumeric and contain only letters, numbers, hyphens, underscores, and dots",
                };
            }
            if (!params.url) return { valid: false, error: "url is required" };
            // Validate URL format and protocol
            try {
                const parsedUrl = new URL(params.url);
                // Require HTTPS in production for security
                if (
                    parsedUrl.protocol !== "https:" &&
                    process.env.NODE_ENV === "production"
                ) {
                    return {
                        valid: false,
                        error: "MCP servers must use HTTPS in production",
                    };
                }
            } catch {
                return { valid: false, error: "url must be a valid URL" };
            }
            return { valid: true };
        case "update":
            if (!params.identifier)
                return { valid: false, error: "identifier is required" };
            // At least one field to update must be provided
            if (!params.displayName && !params.url && !params.headers) {
                return {
                    valid: false,
                    error: "At least one of displayName, url, or headers is required for update",
                };
            }
            // Validate URL format if provided
            if (params.url) {
                try {
                    const parsedUrl = new URL(params.url);
                    if (
                        parsedUrl.protocol !== "https:" &&
                        process.env.NODE_ENV === "production"
                    ) {
                        return {
                            valid: false,
                            error: "MCP servers must use HTTPS in production",
                        };
                    }
                } catch {
                    return { valid: false, error: "url must be a valid URL" };
                }
            }
            return { valid: true };
        case "delete":
            if (!params.identifier)
                return { valid: false, error: "identifier is required" };
            return { valid: true };
        default:
            return { valid: false, error: `Unknown action: ${params.action}` };
    }
}

/**
 * Create the MCP config tool for DCOS
 *
 * Short description for tool list - use action='describe' for full docs.
 */
export function createMcpConfigTool(context: SubagentContext) {
    return tool({
        description:
            "Integration and MCP server management - list services, test connections, add MCP servers. Use action='describe' for operations.",
        inputSchema: mcpConfigActionSchema,
        execute: async (params: McpConfigAction) => {
            if (params.action === "describe") {
                return describeOperations();
            }

            // Validate required params for this action
            const validation = validateMcpParams(params);
            if (!validation.valid) {
                return errorResult("VALIDATION", validation.error);
            }

            // Wrap all executions with safety utilities
            // The ctx parameter includes abortSignal for cancellation
            const result = await safeInvoke(
                MCP_CONFIG_ID,
                params.action,
                async (ctx) => {
                    switch (params.action) {
                        case "list":
                            return executeList(ctx);
                        case "test":
                            return executeTest(
                                {
                                    serviceId: params.serviceId!,
                                    accountId: params.accountId,
                                },
                                ctx
                            );
                        case "guide":
                            return executeGuide({ serviceId: params.serviceId! }, ctx);
                        case "create":
                            return executeCreate(
                                {
                                    identifier: params.identifier!,
                                    displayName: params.displayName,
                                    url: params.url!,
                                    headers: params.headers,
                                },
                                ctx
                            );
                        case "update":
                            return executeUpdate(
                                {
                                    identifier: params.identifier!,
                                    displayName: params.displayName,
                                    url: params.url,
                                    headers: params.headers,
                                },
                                ctx
                            );
                        case "delete":
                            return executeDelete(
                                { identifier: params.identifier! },
                                ctx
                            );
                        default:
                            return errorResult(
                                "VALIDATION",
                                `Unknown action: ${(params as { action: string }).action}`
                            );
                    }
                },
                context
            );

            return result;
        },
    });
}
