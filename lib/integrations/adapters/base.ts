/**
 * Base Service Adapter
 *
 * All service adapters extend this base class to provide consistent
 * error handling, validation, and help documentation.
 */

import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * MCP Tool Annotations (MCP 2025-03-26 spec)
 *
 * Hints for agent auto-approval and risk assessment. Enables smart defaults
 * in agents like Goose and Claude Code.
 *
 * Usage:
 * - Read-only (search, list, get): { readOnlyHint: true }
 * - Create: { readOnlyHint: false, destructiveHint: false }
 * - Update: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
 * - Delete: { readOnlyHint: false, destructiveHint: true }
 * - raw_api: omit annotations (requires approval)
 */
export interface ToolAnnotations {
    /** If true, tool does not modify state - safe to auto-approve */
    readOnlyHint?: boolean;
    /** If true, tool may delete/destroy. Only meaningful when readOnlyHint=false */
    destructiveHint?: boolean;
    /** If true, safe to retry. Only meaningful when readOnlyHint=false */
    idempotentHint?: boolean;
}

export interface HelpOperation {
    name: string;
    description: string;
    parameters: Array<{
        name: string;
        type: string;
        required: boolean;
        description: string;
        example?: string;
    }>;
    returns: string;
    example?: string;
    /** MCP tool annotations for agent auto-approval and risk assessment */
    annotations?: ToolAnnotations;
}

export interface HelpResponse {
    service: string;
    description?: string; // Optional service-level description with notes about capabilities/limitations
    operations: HelpOperation[];
    commonOperations?: string[]; // Optional: Explicitly define 2-3 most-used operation names (e.g., ["search", "create_playlist", "play"])
    docsUrl?: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * MCP Tool Response - MCP 2025-06-18 Compliant
 *
 * Supports structured content and metadata as per the latest MCP specification.
 * Both structuredContent and _meta are optional for backward compatibility.
 */
export interface MCPToolResponse {
    content: Array<{
        type: "text" | "image" | "resource";
        text?: string;
        data?: string | Record<string, unknown>; // Allow structured data (content-block level)
        mimeType?: string;
    }>;
    isError: boolean;
    /**
     * Structured content (MCP 2025-06-18)
     * Machine-readable JSON object that conforms to tool's output schema.
     * For backward compatibility, SHOULD also include serialized JSON in content[].text
     */
    structuredContent?: Record<string, unknown>;
    /**
     * Metadata (MCP 2025-06-18)
     * Extensible field for server-specific metadata like request tracking,
     * performance metrics, version information, etc.
     */
    _meta?: Record<string, unknown>;
}

/**
 * Parameters for raw API requests
 */
export interface RawAPIParams {
    endpoint: string;
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    headers?: Record<string, string>;
}

/**
 * Base class for all service adapters
 */
export abstract class ServiceAdapter {
    abstract serviceName: string;
    abstract serviceDisplayName: string;

    /**
     * Log error message with optional context data
     * Uses pino logger for structured logging with automatic test silencing
     */
    protected logError(...args: unknown[]) {
        // First arg is typically the message, rest is context
        const message = typeof args[0] === "string" ? args[0] : "Error";
        const contextData = args.length > 1 ? { data: args.slice(1) } : {};
        logger.error(contextData, message);
    }

    /**
     * Log info message with optional context data
     * Uses pino logger for structured logging with automatic test silencing
     */
    protected logInfo(...args: unknown[]) {
        // First arg is typically the message, rest is context
        const message = typeof args[0] === "string" ? args[0] : "Info";
        const contextData = args.length > 1 ? { data: args.slice(1) } : {};
        logger.info(contextData, message);
    }

    /**
     * Capture an error to Sentry for monitoring
     *
     * Use this in catch blocks when handling adapter errors to ensure
     * errors are tracked in Sentry for alerting and monitoring.
     *
     * @param error The error to capture
     * @param context Additional context about the error
     */
    protected captureError(
        error: unknown,
        context?: {
            action?: string;
            params?: Record<string, unknown>;
            userId?: string;
        }
    ) {
        // Don't capture in test environments
        if (process.env.NODE_ENV === "test") {
            return;
        }

        Sentry.captureException(error, {
            tags: {
                component: "adapter",
                service: this.serviceName,
                action: context?.action,
            },
            extra: {
                serviceDisplayName: this.serviceDisplayName,
                userId: context?.userId,
                params: context?.params,
            },
        });
    }

    /**
     * Return help documentation for this service
     */
    abstract getHelp(): HelpResponse;

    /**
     * Get documentation for a specific operation (tool)
     * Returns detailed docs for one operation instead of all operations
     * This dramatically reduces token usage for targeted describe calls
     *
     * @param toolName - The operation name to get docs for
     * @returns Help for the specific operation, or error if not found
     */
    getOperationHelp(toolName: string): HelpOperation | { error: string } {
        const help = this.getHelp();
        const operation = help.operations.find((op) => op.name === toolName);

        if (!operation) {
            const availableOps = help.operations.map((op) => op.name).join(", ");
            return {
                error: `Unknown operation '${toolName}' for ${this.serviceDisplayName}. Available operations: ${availableOps}`,
            };
        }

        return operation;
    }

    /**
     * Test connection with the provided credentials
     *
     * API key services should implement this to validate credentials during the
     * connection flow. OAuth services should implement this to verify tokens are
     * still valid by making a live API request.
     *
     * @param credentialOrConnectionId - API key for API key services, OAuth connection ID for OAuth services
     * @param userId - Optional user ID for logging (OAuth services)
     * @returns Promise that resolves with success/error result
     */
    async testConnection(
        credentialOrConnectionId: string,
        userId?: string
    ): Promise<{ success: boolean; error?: string }> {
        // Default implementation - services can override
        return {
            success: false,
            error: `Connection testing not implemented for ${this.serviceDisplayName}`,
        };
    }

    /**
     * Helper for testing API keys with a simple HTTP request
     * Provides standard error parsing for common HTTP status codes
     *
     * @param apiKey - The API key to test
     * @param testUrl - Full URL to test against
     * @param headerName - Header name for the API key (default: 'Authorization')
     * @param headerValue - Function to format the header value (default: Bearer token)
     * @returns Promise with success/error result
     */
    protected async testApiKeyWithEndpoint(
        apiKey: string,
        testUrl: string,
        headerName: string = "Authorization",
        headerValue: (key: string) => string = (k) => `Bearer ${k}`
    ): Promise<{ success: boolean; error?: string }> {
        const { httpClient } = await import("@/lib/http-client");

        try {
            await httpClient
                .get(testUrl, {
                    headers: { [headerName]: headerValue(apiKey) },
                })
                .json();
            return { success: true };
        } catch (error) {
            return this.parseTestConnectionError(error);
        }
    }

    /**
     * Parse common test connection errors into user-friendly messages
     *
     * @param error - The error from the test connection attempt
     * @returns Structured error result
     */
    protected parseTestConnectionError(error: unknown): {
        success: false;
        error: string;
    } {
        const msg = error instanceof Error ? error.message : String(error);

        if (msg.includes("401") || msg.includes("Unauthorized")) {
            return {
                success: false,
                error: "That API key isn't valid. Please check your key.",
            };
        }

        if (msg.includes("403") || msg.includes("Forbidden")) {
            return {
                success: false,
                error: "That API key doesn't have permission. Check your subscription plan.",
            };
        }

        if (msg.includes("429")) {
            return {
                success: false,
                error: `${this.serviceDisplayName} rate limit hit. Please wait a moment.`,
            };
        }

        return {
            success: false,
            error: `We couldn't test that connection. The monitoring caught it. 🤖`,
        };
    }

    /**
     * Get API key credentials for execution
     * Consolidates the repeated credential retrieval pattern from all adapters
     *
     * @param userId - User's email address
     * @returns API key string or error response if credentials invalid/missing
     */
    protected async getApiKeyForExecution(
        userId: string
    ): Promise<{ apiKey: string } | MCPToolResponse> {
        const { getCredentials } =
            await import("@/lib/integrations/connection-manager");
        const { isApiKeyCredentials } = await import("@/lib/integrations/encryption");
        const { ValidationError } = await import("@/lib/errors");

        try {
            const connectionCreds = await getCredentials(userId, this.serviceName);

            if (connectionCreds.type !== "api_key" || !connectionCreds.credentials) {
                return this.createErrorResponse(
                    `Invalid credentials type for ${this.serviceDisplayName} service`
                );
            }

            if (!isApiKeyCredentials(connectionCreds.credentials)) {
                return this.createErrorResponse(
                    `Invalid credential format for ${this.serviceDisplayName} service`
                );
            }

            return { apiKey: connectionCreds.credentials.apiKey };
        } catch (error) {
            if (error instanceof ValidationError) {
                return this.createErrorResponse(this.createNotConnectedError());
            }
            throw error;
        }
    }

    /**
     * Get OAuth access token for execution
     * Consolidates the repeated OAuth credential retrieval pattern from all adapters
     *
     * @param userId - User's email address
     * @param accountId - Optional account ID for multi-account services
     * @returns Access token string or error response if credentials invalid/missing
     */
    protected async getOAuthAccessToken(
        userId: string,
        accountId?: string
    ): Promise<{ accessToken: string } | MCPToolResponse> {
        const { getCredentials } =
            await import("@/lib/integrations/connection-manager");
        const { ValidationError } = await import("@/lib/errors");

        try {
            const credentials = await getCredentials(
                userId,
                this.serviceName,
                accountId
            );
            if (!credentials.accessToken) {
                return this.createErrorResponse(
                    `No access token found for ${this.serviceDisplayName}. ` +
                        `Please reconnect at: ${this.getIntegrationUrl()}`
                );
            }
            return { accessToken: credentials.accessToken };
        } catch (error) {
            if (error instanceof ValidationError) {
                return this.createErrorResponse(error.message);
            }
            throw error;
        }
    }

    /**
     * Combined logging and Sentry capture for operation errors
     * Use this in catch blocks to reduce repetition
     *
     * @param error - The error that occurred
     * @param context - Context about the operation
     */
    protected captureAndLogError(
        error: unknown,
        context: {
            action: string;
            params?: Record<string, unknown>;
            userId?: string;
            redactedFields?: Record<string, string>;
        }
    ): void {
        this.logError(
            `[${this.serviceName.toUpperCase()} ADAPTER] Failed to execute ${context.action}`,
            {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                params: context.params,
                ...context.redactedFields,
            }
        );

        this.captureError(error, {
            action: context.action,
            params: context.params,
            userId: context.userId,
        });
    }

    /**
     * Handle common operation errors with logging, Sentry capture, and user-friendly messages
     * Use this at the top level of execute() to reduce repetition
     *
     * @param error - The error that occurred
     * @param action - The action that failed
     * @param params - Parameters passed to the action
     * @param userId - User's email address
     * @returns MCPToolResponse with user-friendly error message
     */
    protected handleOperationError(
        error: unknown,
        action: string,
        params?: Record<string, unknown>,
        userId?: string
    ): MCPToolResponse {
        // Log and capture in one call
        this.captureAndLogError(error, { action, params, userId });

        // Generate user-friendly message using existing helper
        const message = this.handleCommonAPIError(error, action);

        return this.createErrorResponse(message);
    }

    /**
     * Execute an operation
     *
     * @param action - The operation to execute
     * @param params - Parameters for the operation
     * @param userEmail - User's email address
     * @param accountId - Optional account ID for multi-account services
     */
    abstract execute(
        action: string,
        params: unknown,
        userEmail: string,
        accountId?: string
    ): Promise<MCPToolResponse>;

    /**
     * Execute a raw API request (optional, can be overridden)
     * This provides an escape hatch for LLMs to make direct API calls
     *
     * @param _params - Raw API request parameters
     * @param _userEmail - User's email address
     * @param _accountId - Optional account ID for multi-account services
     */
    async executeRawAPI(
        _params: RawAPIParams,
        _userEmail: string,
        _accountId?: string
    ): Promise<MCPToolResponse> {
        return this.createErrorResponse(
            `Raw API access not implemented for ${this.serviceDisplayName}. ` +
                `Please use the standard operations. Use action='describe' to see available operations.`
        );
    }

    /**
     * Validate parameters for an operation
     */
    validate(action: string, params: unknown): ValidationResult {
        const operations = this.getHelp().operations;
        const operation = operations.find((op) => op.name === action);

        if (!operation) {
            return {
                valid: false,
                errors: [
                    `We don't recognize "${action}". Use action='describe' to see available operations.`,
                ],
            };
        }

        const errors: string[] = [];

        // Ensure params is actually an object before using 'in' operator
        if (typeof params !== "object" || params === null || Array.isArray(params)) {
            return {
                valid: false,
                errors: [
                    'We need parameters as an object (e.g., { query: "search term" })',
                ],
            };
        }

        const paramsObj = params as Record<string, unknown>;

        for (const param of operation.parameters) {
            if (param.required && !(param.name in paramsObj)) {
                // Carmenta-copy friendly: warm but helpful for both LLM retry and user display
                const exampleHint = param.example ? ` (e.g., "${param.example}")` : "";
                errors.push(`We need the ${param.name} parameter${exampleHint}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Format help text for LLM consumption (all operations)
     */
    formatHelpText(): string {
        const help = this.getHelp();
        let text = `Available ${help.service} operations:\n\n`;

        for (const op of help.operations) {
            text += this.formatOperationHelp(op);
            text += `\n`;
        }

        if (help.docsUrl) {
            text += `\nDocumentation: ${help.docsUrl}`;
        }

        return text;
    }

    /**
     * Format help text for a single operation
     * Used for targeted describe calls to reduce token usage
     *
     * @param operation - The operation to format
     * @returns Formatted help text for the operation
     */
    formatOperationHelp(operation: HelpOperation): string {
        let text = `**${operation.name}**\n`;
        text += `${operation.description}\n`;

        if (operation.parameters.length > 0) {
            text += `Parameters:\n`;
            for (const param of operation.parameters) {
                const req = param.required ? "required" : "optional";
                text += `  - ${param.name} (${param.type}, ${req}): ${param.description}\n`;
                if (param.example) {
                    text += `    Example: ${param.example}\n`;
                }
            }
        } else {
            text += `Parameters: none\n`;
        }

        text += `Returns: ${operation.returns}\n`;

        if (operation.example) {
            text += `\nExample usage:\n${operation.example}\n`;
        }

        return text;
    }

    /**
     * Get the integration URL for this service
     * Uses the correct env variable that works in all contexts
     */
    protected getIntegrationUrl(): string {
        const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        // Remove trailing slash if present to avoid double slashes
        const cleanBaseUrl = baseUrl.replace(/\/$/, "");
        return `${cleanBaseUrl}/integrations/${this.serviceName}`;
    }

    /**
     * Create a standardized "not connected" error message
     */
    protected createNotConnectedError(): string {
        return [
            `❌ ${this.serviceDisplayName} isn't connected to your account.`,
            "",
            `Connect ${this.serviceDisplayName} at: ${this.getIntegrationUrl()}`,
        ].join("\n");
    }

    /**
     * Create a standardized "invalid connection" error message
     */
    protected createInvalidConnectionError(): string {
        return `Your ${this.serviceDisplayName} connection is invalid. Reconnect at: ${this.getIntegrationUrl()}`;
    }

    /**
     * Handle common API errors with smart error messages
     * This provides consistent error handling across all adapters
     *
     * @param error The error object
     * @param action The action that failed
     * @returns User-friendly error message
     */
    protected handleCommonAPIError(error: unknown, action: string): string {
        const errorMessage = `We couldn't ${action}: `;

        if (!(error instanceof Error)) {
            return errorMessage + "The bots have been alerted. 🤖";
        }

        const errMsg = error.message;

        // API not enabled errors (Google APIs) - show full helpful message
        if (
            errMsg.includes("API has not been used") ||
            errMsg.includes("Enable it by visiting")
        ) {
            return errorMessage + errMsg;
        }

        // 404 errors
        if (errMsg.includes("404")) {
            return errorMessage + "That resource doesn't exist. Check the ID.";
        }

        // 401 errors - definitely authentication
        if (errMsg.includes("401")) {
            return (
                errorMessage +
                `Authentication failed. Your ${this.serviceDisplayName} connection may have expired. ` +
                `Reconnect at: ${this.getIntegrationUrl()}`
            );
        }

        // 403 errors - could be many things, show actual message + reconnect suggestion
        if (errMsg.includes("403")) {
            return (
                errorMessage +
                errMsg +
                `. If this is an authentication issue, try reconnecting at: ${this.getIntegrationUrl()}`
            );
        }

        // 429 rate limit
        if (errMsg.includes("429")) {
            return (
                errorMessage +
                `${this.serviceDisplayName} rate limit hit. Please wait a moment.`
            );
        }

        // 500/503 service errors
        if (errMsg.includes("500") || errMsg.includes("503")) {
            return (
                errorMessage +
                `${this.serviceDisplayName} is temporarily unavailable. Please try again later.`
            );
        }

        // Default: show the actual error message
        return errorMessage + errMsg;
    }

    /**
     * Create error response
     */
    protected createErrorResponse(message: string): MCPToolResponse {
        return {
            content: [
                {
                    type: "text",
                    text: message,
                },
            ],
            isError: true,
        };
    }

    /**
     * Create a smart error response with inline hints
     * Includes minimal operation docs to help LLM correct the error without requiring a describe call
     *
     * @param message - The error message
     * @param action - The action that failed (optional, will include operation hints)
     * @returns Error response with hints
     */
    async createSmartErrorResponse(
        message: string,
        action?: string
    ): Promise<MCPToolResponse> {
        let errorText = message;

        // If action provided, try to add inline hints
        if (action) {
            try {
                // Get full operations list to find the requested one
                const help = await this.getHelp();
                const operation = help.operations.find((op) => op.name === action);

                if (operation) {
                    // Add quick reference for the operation
                    const requiredParams = operation.parameters
                        .filter((p) => p.required)
                        .map((p) => `${p.name} (${p.type})`)
                        .join(", ");

                    const optionalParams = operation.parameters
                        .filter((p) => !p.required)
                        .map((p) => `${p.name} (${p.type})`)
                        .join(", ");

                    errorText += `\n\nOperation '${action}' requires:`;
                    if (requiredParams) {
                        errorText += `\n  Required: ${requiredParams}`;
                    } else {
                        errorText += `\n  Required: (none)`;
                    }
                    if (optionalParams) {
                        errorText += `\n  Optional: ${optionalParams}`;
                    }

                    if (operation.example) {
                        errorText += `\n\nExample: ${operation.example}`;
                    }
                } else {
                    // Unknown operation - suggest using describe
                    errorText += `\n\nUse action='describe' to see all available operations for ${this.serviceDisplayName}.`;
                }
            } catch (error) {
                // If we can't get operation help, just return the basic error
                logger.debug(
                    { error, action },
                    "Failed to get operation help for smart error"
                );
            }
        }

        return {
            content: [
                {
                    type: "text",
                    text: errorText,
                },
            ],
            isError: true,
        };
    }

    /**
     * Create success response
     */
    protected createSuccessResponse(text: string): MCPToolResponse {
        return {
            content: [
                {
                    type: "text",
                    text,
                },
            ],
            isError: false,
        };
    }

    /**
     * Create JSON response (structured data)
     * MCP 2025-06-18: Automatically populates structuredContent field
     *
     * @param data - The structured data to return
     * @param options - Optional metadata and configuration
     * @returns MCPToolResponse with both human-readable text and machine-readable structuredContent
     */
    protected createJSONResponse(
        data: Record<string, unknown>,
        options?: {
            meta?: Record<string, unknown>;
            action?: string;
        }
    ): MCPToolResponse {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(data, null, 2),
                    data, // Keep for backward compat
                },
            ],
            isError: false,
            // MCP 2025-06-18: Structured content at response level
            structuredContent: data,
            // MCP 2025-06-18: Metadata for observability
            _meta: this.buildMeta(options?.meta, options?.action),
        };
    }

    /**
     * Create a response with full control over all fields
     * Use this when you need custom content blocks or metadata
     *
     * @param content - Content blocks to return
     * @param options - Response configuration
     * @returns MCPToolResponse with optional structuredContent and metadata
     */
    protected createResponse(
        content: MCPToolResponse["content"],
        options?: {
            isError?: boolean;
            structuredContent?: Record<string, unknown>;
            meta?: Record<string, unknown>;
            action?: string;
        }
    ): MCPToolResponse {
        return {
            content,
            isError: options?.isError ?? false,
            structuredContent: options?.structuredContent,
            _meta: this.buildMeta(options?.meta, options?.action),
        };
    }

    /**
     * Add metadata to an existing response
     * Useful for adding tracking info after response creation
     *
     * @param response - Existing response
     * @param meta - Metadata to add/merge
     * @returns Response with updated metadata
     */
    protected withMeta(
        response: MCPToolResponse,
        meta: Record<string, unknown>
    ): MCPToolResponse {
        return {
            ...response,
            _meta: {
                ...(response._meta || {}),
                ...meta,
            },
        };
    }

    /**
     * Build metadata object with standard fields
     * Private helper for consistent metadata structure
     *
     * @param customMeta - Custom metadata to include
     * @param action - Action being performed (optional)
     * @returns Metadata object or undefined if no metadata
     */
    private buildMeta(
        customMeta?: Record<string, unknown>,
        action?: string
    ): Record<string, unknown> | undefined {
        // Only include _meta if we have something to put in it
        const hasCustomMeta = customMeta && Object.keys(customMeta).length > 0;
        const hasAction = !!action;

        if (!hasCustomMeta && !hasAction) {
            return undefined;
        }

        const meta: Record<string, unknown> = {
            service: this.serviceName,
            timestamp: new Date().toISOString(),
        };

        if (action) {
            meta.action = action;
        }

        if (hasCustomMeta) {
            Object.assign(meta, customMeta);
        }

        return meta;
    }
}
