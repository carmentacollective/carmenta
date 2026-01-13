/**
 * MCP Gateway Tests
 *
 * Tests for the MCP gateway that exposes user-configured MCP servers as AI SDK tools.
 * Covers tool discovery, execution routing, response handling, and error recovery.
 *
 * Note: The gateway module has internal client caching that persists state.
 * We use vi.resetModules() to get fresh module instances where needed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@/lib/db/schema";
import type { Tool } from "ai";

// Track mock functions that persist across module resets
let mockCreateMCPClient: ReturnType<typeof vi.fn>;
let mockCaptureException: ReturnType<typeof vi.fn>;
let mockListEnabledMcpServers: ReturnType<typeof vi.fn>;
let mockGetMcpServerByIdentifier: ReturnType<typeof vi.fn>;
let mockGetMcpServerCredentials: ReturnType<typeof vi.fn>;
let mockUpdateMcpServer: ReturnType<typeof vi.fn>;
let mockLogMcpEvent: ReturnType<typeof vi.fn>;

// Gateway module - reimported after each reset
let getMcpGatewayTools: typeof import("@/lib/mcp/gateway").getMcpGatewayTools;
let describeMcpOperations: typeof import("@/lib/mcp/gateway").describeMcpOperations;
let executeMcpAction: typeof import("@/lib/mcp/gateway").executeMcpAction;

/**
 * Factory for creating test McpServer objects
 */
function createMockServer(overrides: Partial<McpServer> = {}): McpServer {
    return {
        id: 1,
        userEmail: "test@example.com",
        identifier: "test-server",
        accountId: "default",
        displayName: "Test Server",
        accountDisplayName: null,
        url: "https://mcp.example.com",
        transport: "http",
        authType: "none",
        encryptedCredentials: null,
        authHeaderName: null,
        isDefault: true,
        enabled: true,
        status: "connected",
        errorMessage: null,
        serverManifest: null,
        connectedAt: new Date(),
        lastConnectedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    };
}

/**
 * Factory for creating mock MCP client
 */
function createMockClient(tools: Record<string, Partial<Tool>> = {}) {
    return {
        tools: vi.fn().mockResolvedValue(tools),
        close: vi.fn().mockResolvedValue(undefined),
    };
}

describe("MCP Gateway", () => {
    beforeEach(async () => {
        // Reset all modules to get fresh state (clears client cache)
        vi.resetModules();

        // Create fresh mock functions
        mockCreateMCPClient = vi.fn();
        mockCaptureException = vi.fn();
        mockListEnabledMcpServers = vi.fn();
        mockGetMcpServerByIdentifier = vi.fn();
        mockGetMcpServerCredentials = vi.fn();
        mockUpdateMcpServer = vi.fn().mockResolvedValue(undefined);
        mockLogMcpEvent = vi.fn().mockResolvedValue(undefined);

        // Set up mocks before importing the module
        vi.doMock("@ai-sdk/mcp", () => ({
            createMCPClient: mockCreateMCPClient,
        }));

        vi.doMock("@sentry/nextjs", () => ({
            captureException: mockCaptureException,
        }));

        vi.doMock("@/lib/db/mcp-servers", () => ({
            listEnabledMcpServers: mockListEnabledMcpServers,
            getMcpServerByIdentifier: mockGetMcpServerByIdentifier,
            getMcpServerCredentials: mockGetMcpServerCredentials,
            updateMcpServer: mockUpdateMcpServer,
            logMcpEvent: mockLogMcpEvent,
        }));

        vi.doMock("@/lib/logger", () => ({
            logger: {
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
                debug: vi.fn(),
                child: vi.fn(() => ({
                    info: vi.fn(),
                    warn: vi.fn(),
                    error: vi.fn(),
                    debug: vi.fn(),
                })),
            },
        }));

        // Import the module with fresh mocks
        const gateway = await import("@/lib/mcp/gateway");
        getMcpGatewayTools = gateway.getMcpGatewayTools;
        describeMcpOperations = gateway.describeMcpOperations;
        executeMcpAction = gateway.executeMcpAction;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ========================================================================
    // getMcpGatewayTools - Tool Discovery and Registration
    // ========================================================================
    describe("getMcpGatewayTools", () => {
        it("returns empty tools when no servers are enabled", async () => {
            mockListEnabledMcpServers.mockResolvedValue([]);

            const tools = await getMcpGatewayTools("test@example.com");

            expect(tools).toEqual({});
            expect(mockListEnabledMcpServers).toHaveBeenCalledWith("test@example.com");
        });

        it("creates tools for each enabled server", async () => {
            const servers = [
                createMockServer({
                    id: 1,
                    identifier: "notion",
                    displayName: "Notion",
                }),
                createMockServer({ id: 2, identifier: "slack", displayName: "Slack" }),
            ];
            mockListEnabledMcpServers.mockResolvedValue(servers);

            const tools = await getMcpGatewayTools("test@example.com");

            expect(Object.keys(tools)).toHaveLength(2);
            expect(tools).toHaveProperty("mcp_notion");
            expect(tools).toHaveProperty("mcp_slack");
        });

        it("includes accountId in tool name for non-default accounts", async () => {
            const servers = [
                createMockServer({
                    id: 1,
                    identifier: "slack",
                    accountId: "workspace-abc",
                }),
            ];
            mockListEnabledMcpServers.mockResolvedValue(servers);

            const tools = await getMcpGatewayTools("test@example.com");

            expect(tools).toHaveProperty("mcp_slack_workspace-abc");
        });

        it("skips duplicate tool names and logs warning", async () => {
            const servers = [
                createMockServer({ id: 1, identifier: "notion" }),
                createMockServer({ id: 2, identifier: "notion" }), // Duplicate
            ];
            mockListEnabledMcpServers.mockResolvedValue(servers);

            const tools = await getMcpGatewayTools("test@example.com");

            // Only one tool should be created
            expect(Object.keys(tools)).toHaveLength(1);
        });

        it("handles listEnabledMcpServers errors gracefully", async () => {
            mockListEnabledMcpServers.mockRejectedValue(new Error("Database error"));

            const tools = await getMcpGatewayTools("test@example.com");

            expect(tools).toEqual({});
            expect(mockCaptureException).toHaveBeenCalled();
        });

        it("builds tool description from server manifest", async () => {
            const servers = [
                createMockServer({
                    identifier: "notion",
                    displayName: "Notion",
                    serverManifest: {
                        name: "Notion",
                        toolCount: 12,
                        tools: ["search", "get_page", "create_page", "query_database"],
                    },
                }),
            ];
            mockListEnabledMcpServers.mockResolvedValue(servers);

            const tools = await getMcpGatewayTools("test@example.com");

            // Tool should exist and have a description with top tools
            expect(tools.mcp_notion).toBeDefined();
            expect(tools.mcp_notion.description).toContain("Notion");
            expect(tools.mcp_notion.description).toContain("search");
        });

        it("uses single tool description for gateway-pattern servers", async () => {
            const servers = [
                createMockServer({
                    identifier: "math",
                    displayName: "Math Calculator",
                    serverManifest: {
                        name: "Math",
                        toolCount: 1,
                        tools: ["calculate"],
                        description:
                            "Perform calculations, unit conversions, and statistical analysis",
                    },
                }),
            ];
            mockListEnabledMcpServers.mockResolvedValue(servers);

            const tools = await getMcpGatewayTools("test@example.com");

            expect(tools.mcp_math.description).toBe(
                "Perform calculations, unit conversions, and statistical analysis"
            );
        });
    });

    // ========================================================================
    // describeMcpOperations - Tool Discovery
    // ========================================================================
    describe("describeMcpOperations", () => {
        it("returns not found message when server does not exist", async () => {
            mockGetMcpServerByIdentifier.mockResolvedValue(undefined);

            const result = await describeMcpOperations(
                "unknown-server",
                "test@example.com"
            );

            expect(result.server).toBe("unknown-server");
            expect(result.description).toContain("not found");
            expect(result.tools).toEqual([]);
        });

        it("returns disabled message when server is disabled", async () => {
            mockGetMcpServerByIdentifier.mockResolvedValue(
                createMockServer({ enabled: false })
            );

            const result = await describeMcpOperations(
                "test-server",
                "test@example.com"
            );

            expect(result.description).toContain("disabled");
            expect(result.tools).toEqual([]);
        });

        it("fetches and returns tools from MCP server", async () => {
            const server = createMockServer();
            const mockClient = createMockClient({
                search: { description: "Search documents" },
                get_page: { description: "Get a page by ID" },
            });

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            const result = await describeMcpOperations(
                "test-server",
                "test@example.com"
            );

            expect(result.tools).toHaveLength(2);
            expect(result.tools).toContainEqual({
                name: "search",
                description: "Search documents",
            });
            expect(result.tools).toContainEqual({
                name: "get_page",
                description: "Get a page by ID",
            });
            expect(result.description).toContain("Available operations (2)");
        });

        it("updates server manifest after successful tool fetch", async () => {
            const server = createMockServer({ id: 42 });
            const mockClient = createMockClient({
                calculate: { description: "Perform calculations" },
            });

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            await describeMcpOperations("test-server", "test@example.com");

            expect(mockUpdateMcpServer).toHaveBeenCalledWith(
                42,
                expect.objectContaining({
                    serverManifest: expect.objectContaining({
                        toolCount: 1,
                        tools: ["calculate"],
                    }),
                    status: "connected",
                })
            );
        });

        it("stores single-tool description for gateway pattern servers", async () => {
            const server = createMockServer({ id: 99 });
            const mockClient = createMockClient({
                gateway: { description: "Access all features through this gateway" },
            });

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            await describeMcpOperations("test-server", "test@example.com");

            expect(mockUpdateMcpServer).toHaveBeenCalledWith(
                99,
                expect.objectContaining({
                    serverManifest: expect.objectContaining({
                        description: "Access all features through this gateway",
                    }),
                })
            );
        });

        it("handles connection errors and updates server status", async () => {
            const server = createMockServer({ id: 77 });
            const mockClient = createMockClient();
            mockClient.tools.mockRejectedValue(new Error("Connection refused"));

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            const result = await describeMcpOperations(
                "test-server",
                "test@example.com"
            );

            expect(result.description).toContain("Failed to connect");
            expect(result.description).toContain("Connection refused");
            expect(result.tools).toEqual([]);
            expect(mockUpdateMcpServer).toHaveBeenCalledWith(
                77,
                expect.objectContaining({
                    status: "error",
                    errorMessage: "Connection refused",
                })
            );
            expect(mockLogMcpEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: "connection_error",
                })
            );
        });
    });

    // ========================================================================
    // executeMcpAction - Tool Execution Routing
    // ========================================================================
    describe("executeMcpAction", () => {
        it("delegates describe action to describeMcpOperations", async () => {
            const server = createMockServer();
            const mockClient = createMockClient({
                test_tool: { description: "Test tool" },
            });

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            const result = await executeMcpAction(
                "test-server",
                "describe",
                undefined,
                "test@example.com"
            );

            expect(result.success).toBe(true);
            expect(result.result).toHaveProperty("tools");
        });

        it("returns error when server not found", async () => {
            mockGetMcpServerByIdentifier.mockResolvedValue(undefined);

            const result = await executeMcpAction(
                "unknown-server",
                "search",
                { query: "test" },
                "test@example.com"
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain("not found");
        });

        it("returns error when server is disabled", async () => {
            mockGetMcpServerByIdentifier.mockResolvedValue(
                createMockServer({ enabled: false })
            );

            const result = await executeMcpAction(
                "test-server",
                "search",
                { query: "test" },
                "test@example.com"
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain("disabled");
        });

        it("routes action to correct tool in multi-tool server", async () => {
            const server = createMockServer();
            const mockExecute = vi.fn().mockResolvedValue({ data: "result" });
            const mockClient = createMockClient({
                search: { description: "Search", execute: mockExecute },
                get_page: { description: "Get page", execute: vi.fn() },
            });

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            const result = await executeMcpAction(
                "test-server",
                "search",
                { query: "hello" },
                "test@example.com"
            );

            expect(result.success).toBe(true);
            expect(result.result).toEqual({ data: "result" });
            expect(mockExecute).toHaveBeenCalledWith(
                { query: "hello" },
                expect.objectContaining({ toolCallId: expect.any(String) })
            );
        });

        it("routes action through gateway tool for single-tool servers", async () => {
            const server = createMockServer();
            const mockExecute = vi.fn().mockResolvedValue({ result: "calculated" });
            const mockClient = createMockClient({
                gateway: { description: "Gateway tool", execute: mockExecute },
            });

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            const result = await executeMcpAction(
                "test-server",
                "calculate",
                { expression: "2+2" },
                "test@example.com"
            );

            expect(result.success).toBe(true);
            // Gateway pattern: action and params passed to the single tool
            expect(mockExecute).toHaveBeenCalledWith(
                { action: "calculate", params: { expression: "2+2" } },
                expect.objectContaining({ toolCallId: expect.any(String) })
            );
        });

        it("returns error when tool not found in multi-tool server", async () => {
            const server = createMockServer();
            const mockClient = createMockClient({
                search: { description: "Search", execute: vi.fn() },
                other: { description: "Other", execute: vi.fn() },
            });

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            const result = await executeMcpAction(
                "test-server",
                "nonexistent_tool",
                {},
                "test@example.com"
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain("not found");
        });

        it("returns error when gateway tool is not executable", async () => {
            const server = createMockServer();
            const mockClient = createMockClient({
                gateway: { description: "Gateway tool" }, // No execute function
            });

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            const result = await executeMcpAction(
                "test-server",
                "any_action",
                {},
                "test@example.com"
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain("not executable");
        });

        it("updates server status on successful execution", async () => {
            const server = createMockServer({ id: 55 });
            const mockClient = createMockClient({
                search: {
                    description: "Search",
                    execute: vi.fn().mockResolvedValue({}),
                },
                other: { description: "Other", execute: vi.fn() },
            });

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            await executeMcpAction(
                "test-server",
                "search",
                { query: "test" },
                "test@example.com"
            );

            expect(mockUpdateMcpServer).toHaveBeenCalledWith(
                55,
                expect.objectContaining({ status: "connected" })
            );
        });

        it("captures exception and updates status on execution failure", async () => {
            const server = createMockServer({ id: 66 });
            const mockClient = createMockClient();
            mockClient.tools.mockRejectedValue(new Error("Network timeout"));

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            const result = await executeMcpAction(
                "test-server",
                "search",
                { query: "test" },
                "test@example.com"
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain("Network timeout");
            expect(mockCaptureException).toHaveBeenCalled();
            expect(mockUpdateMcpServer).toHaveBeenCalledWith(
                66,
                expect.objectContaining({
                    status: "error",
                    errorMessage: "Network timeout",
                })
            );
            expect(mockLogMcpEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: "connection_error",
                })
            );
        });
    });

    // ========================================================================
    // Response Handling
    // ========================================================================
    describe("response handling", () => {
        it("parses JSON string results", async () => {
            const server = createMockServer();
            const mockClient = createMockClient({
                search: {
                    description: "Search",
                    execute: vi.fn().mockResolvedValue('{"items": [1, 2, 3]}'),
                },
                other: { description: "Other", execute: vi.fn() },
            });

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            const result = await executeMcpAction(
                "test-server",
                "search",
                {},
                "test@example.com"
            );

            expect(result.success).toBe(true);
            expect(result.result).toEqual({ items: [1, 2, 3] });
        });

        it("returns non-JSON strings as-is", async () => {
            const server = createMockServer();
            const mockClient = createMockClient({
                echo: {
                    description: "Echo",
                    execute: vi.fn().mockResolvedValue("Hello, world!"),
                },
                other: { description: "Other", execute: vi.fn() },
            });

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            const result = await executeMcpAction(
                "test-server",
                "echo",
                {},
                "test@example.com"
            );

            expect(result.success).toBe(true);
            expect(result.result).toBe("Hello, world!");
        });

        it("returns Success for null/undefined results", async () => {
            const server = createMockServer();
            const mockClient = createMockClient({
                delete: {
                    description: "Delete",
                    execute: vi.fn().mockResolvedValue(null),
                },
                other: { description: "Other", execute: vi.fn() },
            });

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            const result = await executeMcpAction(
                "test-server",
                "delete",
                {},
                "test@example.com"
            );

            expect(result.success).toBe(true);
            expect(result.result).toBe("Success");
        });

        it("handles MCP tool-level errors with isError flag", async () => {
            const server = createMockServer();
            const mockClient = createMockClient({
                failing_tool: {
                    description: "Fails",
                    execute: vi.fn().mockResolvedValue({
                        isError: true,
                        content: [{ type: "text", text: "Rate limit exceeded" }],
                    }),
                },
                other: { description: "Other", execute: vi.fn() },
            });

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            const result = await executeMcpAction(
                "test-server",
                "failing_tool",
                {},
                "test@example.com"
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe("Rate limit exceeded");
        });

        it("handles MCP errors without content gracefully", async () => {
            const server = createMockServer();
            const mockClient = createMockClient({
                failing_tool: {
                    description: "Fails",
                    // When isError is true but no content array, fallback is String(result)
                    execute: vi.fn().mockResolvedValue({
                        isError: true,
                        content: [], // Empty content array results in fallback message
                    }),
                },
                other: { description: "Other", execute: vi.fn() },
            });

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            const result = await executeMcpAction(
                "test-server",
                "failing_tool",
                {},
                "test@example.com"
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe("Tool execution failed");
        });
    });

    // ========================================================================
    // Authentication
    // ========================================================================
    describe("authentication", () => {
        it("creates client without auth headers for authType none", async () => {
            const server = createMockServer({ authType: "none" });
            const mockClient = createMockClient({
                tool: { description: "Tool", execute: vi.fn().mockResolvedValue({}) },
                other: { description: "Other", execute: vi.fn() },
            });

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            await executeMcpAction("test-server", "tool", {}, "test@example.com");

            expect(mockCreateMCPClient).toHaveBeenCalledWith(
                expect.objectContaining({
                    transport: expect.objectContaining({
                        type: "http",
                        url: "https://mcp.example.com",
                    }),
                })
            );
            // Verify no headers were passed
            const callArgs = mockCreateMCPClient.mock.calls[0][0];
            expect(callArgs.transport.headers).toBeUndefined();
        });

        it("adds Bearer auth header for authType bearer", async () => {
            const server = createMockServer({ authType: "bearer" });
            const mockClient = createMockClient({
                tool: { description: "Tool", execute: vi.fn().mockResolvedValue({}) },
                other: { description: "Other", execute: vi.fn() },
            });

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockGetMcpServerCredentials.mockResolvedValue({ token: "secret-token" });
            mockCreateMCPClient.mockResolvedValue(mockClient);

            await executeMcpAction("test-server", "tool", {}, "test@example.com");

            expect(mockCreateMCPClient).toHaveBeenCalledWith(
                expect.objectContaining({
                    transport: expect.objectContaining({
                        headers: { Authorization: "Bearer secret-token" },
                    }),
                })
            );
        });

        it("adds custom header for authType header", async () => {
            const server = createMockServer({
                authType: "header",
                authHeaderName: "X-API-Key",
            });
            const mockClient = createMockClient({
                tool: { description: "Tool", execute: vi.fn().mockResolvedValue({}) },
                other: { description: "Other", execute: vi.fn() },
            });

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockGetMcpServerCredentials.mockResolvedValue({ token: "api-key-123" });
            mockCreateMCPClient.mockResolvedValue(mockClient);

            await executeMcpAction("test-server", "tool", {}, "test@example.com");

            expect(mockCreateMCPClient).toHaveBeenCalledWith(
                expect.objectContaining({
                    transport: expect.objectContaining({
                        headers: { "X-API-Key": "api-key-123" },
                    }),
                })
            );
        });

        it("returns error when credentials are missing for authenticated server", async () => {
            const server = createMockServer({ authType: "bearer" });

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockGetMcpServerCredentials.mockResolvedValue(null);

            const result = await executeMcpAction(
                "test-server",
                "tool",
                {},
                "test@example.com"
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain("credentials are missing");
        });
    });

    // ========================================================================
    // Client Caching
    // ========================================================================
    describe("client caching", () => {
        it("reuses cached client for subsequent calls", async () => {
            const server = createMockServer();
            const mockClient = createMockClient({
                tool: { description: "Tool", execute: vi.fn().mockResolvedValue({}) },
                other: { description: "Other", execute: vi.fn() },
            });

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            // First call
            await executeMcpAction("test-server", "tool", {}, "test@example.com");
            // Second call
            await executeMcpAction("test-server", "tool", {}, "test@example.com");

            // Client should only be created once (cached after first successful use)
            expect(mockCreateMCPClient).toHaveBeenCalledTimes(1);
        });

        it("clears cache and closes client on connection error", async () => {
            const server = createMockServer();
            const mockClient = createMockClient();
            mockClient.tools.mockRejectedValue(new Error("Connection lost"));

            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            await executeMcpAction("test-server", "tool", {}, "test@example.com");

            // Client should be closed on error
            expect(mockClient.close).toHaveBeenCalled();
        });
    });

    // ========================================================================
    // Tool Execution via Gateway Tool
    // ========================================================================
    describe("tool execution through gateway", () => {
        it("executes tool through createMcpServerTool wrapper", async () => {
            const server = createMockServer({
                identifier: "notion",
                serverManifest: {
                    name: "Notion",
                    toolCount: 5,
                    tools: ["search", "get_page"],
                },
            });
            mockListEnabledMcpServers.mockResolvedValue([server]);

            const mockClient = createMockClient({
                search: {
                    description: "Search",
                    execute: vi.fn().mockResolvedValue({ results: [] }),
                },
                other: { description: "Other", execute: vi.fn() },
            });
            mockGetMcpServerByIdentifier.mockResolvedValue(server);
            mockCreateMCPClient.mockResolvedValue(mockClient);

            const tools = await getMcpGatewayTools("test@example.com");

            // Execute the tool
            const result = await tools.mcp_notion.execute!(
                { action: "search", params: { query: "test" } },
                { toolCallId: "test-call", messages: [] }
            );

            expect(result).toEqual({ results: [] });
        });

        it("returns error object when tool execution fails", async () => {
            const server = createMockServer({
                identifier: "broken",
                serverManifest: { name: "Broken", toolCount: 1, tools: ["fail"] },
            });
            mockListEnabledMcpServers.mockResolvedValue([server]);
            mockGetMcpServerByIdentifier.mockResolvedValue(undefined); // Simulate not found

            const tools = await getMcpGatewayTools("test@example.com");

            const result = await tools.mcp_broken.execute!(
                { action: "fail", params: {} },
                { toolCallId: "test-call", messages: [] }
            );

            expect(result).toEqual({
                error: true,
                message: expect.stringContaining("not found"),
            });
        });
    });
});
