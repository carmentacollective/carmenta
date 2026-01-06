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
 */

import { tool } from "ai";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { getConnectedServices } from "@/lib/integrations/connection-manager";
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
 * MCP Config action parameter schema
 *
 * Flat object schema because discriminatedUnion produces oneOf which
 * AWS Bedrock doesn't support. Validation happens in execute.
 */
const mcpConfigActionSchema = z.object({
    action: z
        .enum(["describe", "list", "test", "guide"])
        .describe(
            "Operation to perform. Use 'describe' to see all available operations."
        ),
    serviceId: z.string().optional().describe("Service ID (for 'test' and 'guide')"),
    accountId: z.string().optional().describe("Specific account ID (for 'test')"),
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
            "Integration management - list services, test connections, setup guidance. Use action='describe' for operations.",
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
