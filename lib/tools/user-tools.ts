/**
 * User Tools Factory
 *
 * Single source of truth for assembling tools available to a user.
 * Prevents tool drift across different agent contexts by centralizing
 * the tool loading logic.
 *
 * Usage:
 * ```ts
 * const tools = await getUserTools({ userId, userEmail });
 * // or with options:
 * const tools = await getUserTools({ userId, userEmail }, { include: ['builtIn', 'mcp'] });
 * ```
 */

import type { Tool } from "ai";

import { builtInTools, createSearchKnowledgeTool } from "@/lib/tools/built-in";
import { getIntegrationTools } from "@/lib/integrations/tools";
import { getMcpGatewayTools } from "@/lib/mcp/gateway";
import { postResponseTools } from "@/lib/tools/post-response";
import { createImageArtistTool } from "@/lib/ai-team/agents/image-artist-tool";
import { createLibrarianTool } from "@/lib/ai-team/agents/librarian-tool";
import { createMcpConfigTool } from "@/lib/ai-team/agents/mcp-config-tool";
import { createSmsUserTool } from "@/lib/ai-team/agents/sms-user-tool";
import { createPushNotificationTool } from "@/lib/ai-team/agents/push-notification-tool";
import { createDcosTool } from "@/lib/ai-team/agents/dcos-tool";
import type { SubagentContext } from "@/lib/ai-team/dcos/types";
import { logger } from "@/lib/logger";

/**
 * Tool categories that can be included/excluded
 */
export type ToolCategory =
    | "builtIn" // webSearch, deepResearch, fetchPage
    | "integrations" // Gmail, Slack, etc. from connected services
    | "mcp" // User-configured MCP servers
    | "searchKnowledge" // Direct KB search
    | "imageArtist" // Image generation
    | "librarian" // KB extraction and retrieval
    | "mcpConfig" // MCP server configuration
    | "smsUser" // SMS notifications to user
    | "pushNotification" // Push notifications
    | "postResponse" // Post-response tools (continue, etc.)
    | "dcos"; // AI Team management (automations)

/**
 * Preset configurations for common contexts
 */
export const TOOL_PRESETS = {
    /**
     * Main chat interface - full capabilities
     */
    chat: [
        "builtIn",
        "integrations",
        "mcp",
        "searchKnowledge",
        "imageArtist",
        "librarian",
        "mcpConfig",
        "smsUser",
        "pushNotification",
        "postResponse",
    ] as ToolCategory[],

    /**
     * Orchestrator/Sidecar - DCOS-style orchestration
     * Named 'orchestrator' to avoid confusion with 'dcos' tool category
     */
    orchestrator: [
        "integrations",
        "mcp",
        "searchKnowledge",
        "librarian",
        "mcpConfig",
        "smsUser",
        "pushNotification",
        "dcos",
    ] as ToolCategory[],

    /**
     * AI Team member - background job execution
     */
    aiTeamMember: ["builtIn", "integrations", "mcp"] as ToolCategory[],
} as const;

/**
 * User context required for tool loading
 */
export interface UserToolsContext {
    userId: string;
    userEmail: string;
    /**
     * Optional subagent context for tools that need stream writer
     * Required for: dcos, librarian, mcpConfig (when used as subagents)
     */
    subagentContext?: SubagentContext;
}

/**
 * Options for tool loading
 */
export interface UserToolsOptions {
    /**
     * Preset to use (chat, dcos, aiTeamMember)
     * If not specified, defaults to 'chat'
     */
    preset?: keyof typeof TOOL_PRESETS;

    /**
     * Explicit list of categories to include (overrides preset)
     */
    include?: ToolCategory[];

    /**
     * Categories to exclude from the preset
     */
    exclude?: ToolCategory[];

    /**
     * Additional custom tools to merge in
     */
    customTools?: Record<string, Tool>;
}

/**
 * Get all tools available to a user
 *
 * This is the single source of truth for tool assembly.
 * All agent contexts should use this function.
 *
 * @param context - User context (userId, userEmail)
 * @param options - Tool loading options (preset, include/exclude)
 * @returns Record of tool name to tool definition
 */
export async function getUserTools(
    context: UserToolsContext,
    options: UserToolsOptions = {}
): Promise<Record<string, Tool>> {
    const { userId, userEmail, subagentContext } = context;
    const { preset = "chat", include, exclude = [], customTools = {} } = options;

    // Determine which categories to load
    const categories = new Set<ToolCategory>(include ?? TOOL_PRESETS[preset]);
    for (const cat of exclude) {
        categories.delete(cat);
    }

    const tools: Record<string, Tool> = {};

    // Load async tools in parallel, then merge in deterministic order
    // This ensures consistent behavior regardless of which request completes first
    const [integrationTools, mcpTools] = await Promise.all([
        categories.has("integrations")
            ? getIntegrationTools(userEmail).catch((error) => {
                  logger.warn(
                      { error, userEmail },
                      "Failed to load integration tools - continuing without them"
                  );
                  return {};
              })
            : Promise.resolve({}),
        categories.has("mcp")
            ? getMcpGatewayTools(userEmail).catch((error) => {
                  logger.warn(
                      { error, userEmail },
                      "Failed to load MCP tools - continuing without them"
                  );
                  return {};
              })
            : Promise.resolve({}),
    ]);

    // Merge in deterministic order: builtIn < integrations < mcp
    // Later sources override earlier ones if names collide
    if (categories.has("builtIn")) {
        Object.assign(tools, builtInTools);
    }
    Object.assign(tools, integrationTools);
    Object.assign(tools, mcpTools);

    // Warn on potential collisions between integrations and MCP
    const integrationKeys = new Set(Object.keys(integrationTools));
    for (const mcpKey of Object.keys(mcpTools)) {
        if (integrationKeys.has(mcpKey)) {
            logger.warn(
                { toolName: mcpKey, userEmail },
                "MCP tool name collides with integration tool - MCP takes precedence"
            );
        }
    }

    // Sync tools that need context
    if (categories.has("searchKnowledge")) {
        tools.searchKnowledge = createSearchKnowledgeTool(userId);
    }

    if (categories.has("imageArtist")) {
        tools.imageArtist = createImageArtistTool({
            userId,
            userEmail,
            timeoutMs: 300_000, // 5 min for slow image generation
        });
    }

    if (categories.has("smsUser")) {
        tools.smsUser = createSmsUserTool(subagentContext ?? { userId, userEmail });
    }

    if (categories.has("pushNotification")) {
        tools.pushNotification = createPushNotificationTool(
            subagentContext ?? { userId, userEmail }
        );
    }

    if (categories.has("postResponse")) {
        Object.assign(tools, postResponseTools);
    }

    // Subagent tools (require subagentContext for proper writer integration)
    if (categories.has("librarian")) {
        tools.librarian = createLibrarianTool(subagentContext ?? { userId, userEmail });
    }

    if (categories.has("mcpConfig")) {
        tools.mcpConfig = createMcpConfigTool(subagentContext ?? { userId, userEmail });
    }

    if (categories.has("dcos")) {
        if (!subagentContext) {
            logger.warn(
                { userId },
                "DCOS tool requested without subagentContext - tool may not work properly"
            );
        }
        tools.dcos = createDcosTool(subagentContext ?? { userId, userEmail });
    }

    // Merge custom tools last (allows overrides)
    Object.assign(tools, customTools);

    logger.debug(
        {
            userId,
            preset,
            categories: Array.from(categories),
            toolCount: Object.keys(tools).length,
            toolNames: Object.keys(tools),
        },
        "Loaded user tools"
    );

    return tools;
}
