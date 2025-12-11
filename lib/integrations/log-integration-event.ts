/**
 * Integration History Logging Utility
 *
 * Centralized function for logging all integration lifecycle events
 * to the integration_history audit table for debugging, analytics, and compliance.
 *
 * Ported from mcp-hubby's battle-tested log-connection-event.ts pattern.
 */

import { db, schema } from "@/lib/db";
import { logger } from "@/lib/logger";

export type IntegrationEventType =
    | "connected"
    | "disconnected"
    | "reconnected"
    | "nango_sync_success"
    | "nango_sync_error"
    | "nango_auth_error"
    | "nango_token_refresh"
    | "nango_connection_created"
    | "nango_connection_deleted"
    | "token_expired"
    | "connection_error"
    | "rate_limited";

export type IntegrationEventSource = "user" | "nango_webhook" | "system";

export interface LogIntegrationEventOptions {
    userEmail: string;
    service: string;
    accountId?: string;
    accountDisplayName?: string;
    eventType: IntegrationEventType;
    eventSource: IntegrationEventSource;
    connectionId?: string;
    nangoProviderConfigKey?: string;
    errorMessage?: string;
    errorCode?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Log an integration lifecycle event to the audit table.
 * This function is non-blocking and will not throw errors to prevent
 * disruption of critical user flows.
 */
export async function logIntegrationEvent(
    options: LogIntegrationEventOptions
): Promise<void> {
    try {
        await db.insert(schema.integrationHistory).values({
            userEmail: options.userEmail,
            service: options.service,
            accountId: options.accountId ?? null,
            accountDisplayName: options.accountDisplayName ?? null,
            eventType: options.eventType,
            eventSource: options.eventSource,
            occurredAt: new Date(),
            connectionId: options.connectionId ?? null,
            nangoProviderConfigKey: options.nangoProviderConfigKey ?? null,
            errorMessage: options.errorMessage ?? null,
            errorCode: options.errorCode ?? null,
            metadata: options.metadata ?? null,
            createdAt: new Date(),
        });

        logger.info(
            {
                userEmail: options.userEmail,
                service: options.service,
                eventType: options.eventType,
                eventSource: options.eventSource,
            },
            `Logged integration event: ${options.eventType}`
        );
    } catch (error) {
        // Non-blocking: log the error but don't throw
        // Integration history is for debugging/analytics, not critical path
        logger.error(
            {
                error:
                    error instanceof Error
                        ? { message: error.message, stack: error.stack }
                        : error,
                userEmail: options.userEmail,
                service: options.service,
                eventType: options.eventType,
            },
            "Failed to log integration event to history table"
        );
    }
}
