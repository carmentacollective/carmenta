/**
 * Base Service Adapter
 *
 * All service adapters extend this base class to provide consistent
 * error handling, validation, and help documentation.
 *
 * Progressive disclosure pattern:
 * - Each service exposes ONE tool with action-based routing
 * - action='describe' returns full operation documentation
 * - Specific actions execute operations
 * - Reduces initial token usage by ~95%
 */

import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
import type {
    HelpResponse,
    HelpOperation,
    AdapterResponse,
    RawAPIParams,
    ValidationResult,
} from "../types";

/**
 * Base class for all service adapters
 */
export abstract class ServiceAdapter {
    abstract serviceName: string;
    abstract serviceDisplayName: string;

    /**
     * Log error message with context
     */
    protected logError(message: string, context?: Record<string, unknown>) {
        logger.error({ service: this.serviceName, ...context }, message);
    }

    /**
     * Log info message with context
     */
    protected logInfo(message: string, context?: Record<string, unknown>) {
        logger.info({ service: this.serviceName, ...context }, message);
    }

    /**
     * Capture an error to Sentry for monitoring
     */
    protected captureError(
        error: unknown,
        context?: {
            action?: string;
            params?: Record<string, unknown>;
            userId?: string;
        }
    ) {
        if (process.env.NODE_ENV === "test") return;

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
     * Get documentation for a specific operation
     */
    getOperationHelp(operationName: string): HelpOperation | { error: string } {
        const help = this.getHelp();
        const operation = help.operations.find((op) => op.name === operationName);

        if (!operation) {
            const availableOps = help.operations.map((op) => op.name).join(", ");
            return {
                error: `Unknown operation '${operationName}' for ${this.serviceDisplayName}. Available: ${availableOps}`,
            };
        }

        return operation;
    }

    /**
     * Execute an operation
     *
     * @param action - The operation to execute
     * @param params - Parameters for the operation
     * @param userId - User's ID
     * @param accountId - Optional account ID for multi-account services
     */
    abstract execute(
        action: string,
        params: unknown,
        userId: string,
        accountId?: string
    ): Promise<AdapterResponse>;

    /**
     * Execute a raw API request (optional, can be overridden)
     */
    async executeRawAPI(
        _params: RawAPIParams,
        _userId: string,
        _accountId?: string
    ): Promise<AdapterResponse> {
        return this.createErrorResponse(
            `Raw API access not implemented for ${this.serviceDisplayName}. ` +
                `Use action='describe' to see available operations.`
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
                errors: [`Unknown action: ${action}`],
            };
        }

        const errors: string[] = [];

        if (typeof params !== "object" || params === null || Array.isArray(params)) {
            return {
                valid: false,
                errors: ["Parameters must be an object"],
            };
        }

        const paramsObj = params as Record<string, unknown>;

        for (const param of operation.parameters) {
            if (param.required && !(param.name in paramsObj)) {
                errors.push(`Missing required parameter: ${param.name}`);
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
     */
    protected getIntegrationUrl(): string {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const cleanBaseUrl = baseUrl.replace(/\/$/, "");
        return `${cleanBaseUrl}/integrations/${this.serviceName}`;
    }

    /**
     * Create a standardized "not connected" error message
     */
    protected createNotConnectedError(): string {
        return [
            `${this.serviceDisplayName} is not connected to your account.`,
            "",
            `Please connect ${this.serviceDisplayName} at: ${this.getIntegrationUrl()}`,
            "",
            "Once connected, try your request again.",
        ].join("\n");
    }

    /**
     * Handle common API errors with smart error messages
     */
    protected handleCommonAPIError(error: unknown, action: string): string {
        const errorMessage = `Failed to ${action}: `;

        if (!(error instanceof Error)) {
            return errorMessage + "Unknown error";
        }

        const errMsg = error.message;

        if (errMsg.includes("404")) {
            return (
                errorMessage +
                "The requested resource was not found. Please check the ID."
            );
        }

        if (errMsg.includes("401")) {
            return (
                errorMessage +
                `Authentication failed. Your ${this.serviceDisplayName} connection may have expired. ` +
                `Please reconnect at: ${this.getIntegrationUrl()}`
            );
        }

        if (errMsg.includes("403")) {
            return (
                errorMessage +
                errMsg +
                `. If this is an authentication issue, try reconnecting at: ${this.getIntegrationUrl()}`
            );
        }

        if (errMsg.includes("429")) {
            return (
                errorMessage + "Rate limit exceeded. Please try again in a few moments."
            );
        }

        if (errMsg.includes("500") || errMsg.includes("503")) {
            return (
                errorMessage +
                `${this.serviceDisplayName} service is temporarily unavailable. Please try again later.`
            );
        }

        return errorMessage + errMsg;
    }

    /**
     * Create error response
     */
    protected createErrorResponse(message: string): AdapterResponse {
        return {
            content: [{ type: "text", text: message }],
            isError: true,
        };
    }

    /**
     * Create success response
     */
    protected createSuccessResponse(text: string): AdapterResponse {
        return {
            content: [{ type: "text", text }],
            isError: false,
        };
    }

    /**
     * Create JSON response (structured data)
     */
    protected createJSONResponse(
        data: Record<string, unknown>,
        options?: {
            meta?: Record<string, unknown>;
            action?: string;
        }
    ): AdapterResponse {
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(data, null, 2),
                    data,
                },
            ],
            isError: false,
            structuredContent: data,
            _meta: this.buildMeta(options?.meta, options?.action),
        };
    }

    /**
     * Create a response with full control over all fields
     */
    protected createResponse(
        content: AdapterResponse["content"],
        options?: {
            isError?: boolean;
            structuredContent?: Record<string, unknown>;
            meta?: Record<string, unknown>;
            action?: string;
        }
    ): AdapterResponse {
        return {
            content,
            isError: options?.isError ?? false,
            structuredContent: options?.structuredContent,
            _meta: this.buildMeta(options?.meta, options?.action),
        };
    }

    /**
     * Build metadata object with standard fields
     */
    private buildMeta(
        customMeta?: Record<string, unknown>,
        action?: string
    ): Record<string, unknown> | undefined {
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
