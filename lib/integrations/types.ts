/**
 * Shared Types for Integrations
 *
 * Types used across adapters, connection management, and UI components.
 */

import type { ServiceDefinition } from "./services";

/**
 * Connection status in the database
 */
export type IntegrationStatus =
    | "connected" // Active and working
    | "error" // Connection has an error (e.g., invalid credentials)
    | "expired" // OAuth token expired, needs refresh
    | "disconnected"; // Explicitly disconnected by user

/**
 * Credential type discriminator
 */
export type CredentialType = "oauth" | "api_key";

/**
 * Integration record from database
 */
export interface Integration {
    id: number;
    userId: string;
    service: string;
    connectionId: string | null; // OAuth connection ID
    encryptedCredentials: string | null; // Encrypted API key or OAuth tokens
    credentialType: CredentialType;
    accountId: string;
    accountDisplayName: string | null;
    isDefault: boolean;
    status: IntegrationStatus;
    errorMessage: string | null;
    connectedAt: Date;
    updatedAt: Date;
}

/**
 * Integration with service metadata (for UI)
 */
export interface IntegrationWithService extends Integration {
    serviceDefinition: ServiceDefinition;
}

/**
 * Credentials returned from connection manager
 */
export interface ConnectionCredentials {
    type: CredentialType;
    credentials: {
        apiKey?: string;
        token?: string;
        refreshToken?: string;
    } | null;
    connectionId?: string; // OAuth connection ID
}

/**
 * Result of a connection attempt
 */
export interface ConnectResult {
    success: boolean;
    integration?: Integration;
    error?: string;
}

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

/**
 * Operation parameter definition
 */
export interface OperationParameter {
    name: string;
    type: string;
    required: boolean;
    description: string;
    example?: string;
}

/**
 * Operation definition for help responses
 */
export interface HelpOperation {
    name: string;
    description: string;
    parameters: OperationParameter[];
    returns: string;
    example?: string;
    annotations?: ToolAnnotations;
}

/**
 * Help response from an adapter
 */
export interface HelpResponse {
    service: string;
    description?: string;
    operations: HelpOperation[];
    commonOperations?: string[];
    docsUrl?: string;
}

/**
 * Adapter tool response (MCP-compatible)
 */
export interface AdapterResponse {
    content: Array<{
        type: "text" | "image" | "resource";
        text?: string;
        data?: string | Record<string, unknown>;
        mimeType?: string;
    }>;
    isError: boolean;
    structuredContent?: Record<string, unknown>;
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
 * Validation result from adapter
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
