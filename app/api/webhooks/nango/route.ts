/**
 * Nango Webhook Handler - OAuth Connection Lifecycle Events
 *
 * Receives notifications when OAuth connections are created, updated, or deleted.
 * Ported from mcp-hubby's battle-tested implementation.
 *
 * Key changes from v1:
 * - Uses userEmail directly as FK (no UUID lookup)
 * - Logs to integration_history audit table
 * - Handles token refresh failures with EXPIRED status
 *
 * Event types we care about:
 * - auth (connection lifecycle): creation, deletion, refresh
 *
 * Event types we ignore:
 * - sync (Nango sync jobs - not used)
 * - forward (webhook forwarding - not used)
 *
 * Security: ALL webhooks MUST be signature-verified using HMAC-SHA256.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";

import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { fetchAccountInfo } from "@/lib/integrations/fetch-account-info";
import { logIntegrationEvent } from "@/lib/integrations/log-integration-event";

interface NangoWebhookEvent {
    type: "auth" | "sync" | "forward";
    connectionId: string;
    providerConfigKey: string;
    authMode: "OAUTH2" | "OAUTH1" | "API_KEY" | "APP";
    operation?: "creation" | "override" | "deletion" | "refresh";
    success: boolean;
    error?: {
        type: string;
        description: string;
    };
    endUser?: {
        id: string;
        email?: string;
        displayName?: string;
    };
}

/**
 * Maps Nango provider config keys to Carmenta service names
 */
function getServiceFromProviderKey(providerKey: string): string {
    const mapping: Record<string, string> = {
        clickup: "clickup",
        notion: "notion",
        dropbox: "dropbox",
    };
    return mapping[providerKey] || providerKey;
}

/**
 * Verify webhook signature using HMAC-SHA256
 * Prevents spoofed webhooks from unauthorized sources
 */
function verifySignature(body: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");

    // Constant-time comparison prevents timing attacks
    const signatureBuffer = Buffer.from(signature, "utf-8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf-8");

    try {
        return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    } catch {
        // Buffers have different lengths - not equal
        return false;
    }
}

/**
 * Handle auth event - connection creation/deletion/refresh
 */
async function handleAuthEvent(event: NangoWebhookEvent) {
    const { connectionId, providerConfigKey, operation, success, endUser, error } =
        event;

    if (!operation) {
        logger.warn({ event }, "Auth event missing operation field");
        return;
    }

    const service = getServiceFromProviderKey(providerConfigKey);
    const errorMessage = error ? `${error.type}: ${error.description}` : null;

    logger.info(
        {
            operation,
            service,
            connectionId,
            userId: endUser?.id,
            success,
        },
        `Nango auth event: ${operation}`
    );

    // Known issue from MCPHubby: Sometimes webhooks arrive without endUser.id
    // When this happens, we can't match to a user. Frontend fallback handles it.
    if (!endUser?.id) {
        logger.warn(
            { event },
            "Nango webhook missing endUser.id - cannot match to user"
        );
        return;
    }

    // We pass email as ID in createConnectSession
    const userEmail = endUser.email || endUser.id;

    Sentry.setUser({ email: userEmail });

    switch (operation) {
        case "creation":
        case "override":
            if (!success) {
                logger.error({ event }, "OAuth connection failed");
                await handleConnectionFailed(
                    userEmail,
                    service,
                    connectionId,
                    errorMessage || "OAuth flow failed"
                );
                return;
            }

            // Fetch account info from the service to populate accountId/displayName
            await handleConnectionCreated(userEmail, service, connectionId);
            break;

        case "deletion":
            // Mark connection as disconnected (don't delete - preserve history)
            await handleConnectionDeleted(userEmail, service, connectionId);
            break;

        case "refresh":
            if (success) {
                await handleTokenRefreshSuccess(userEmail, service, connectionId);
            } else {
                await handleTokenRefreshFailed(
                    userEmail,
                    service,
                    connectionId,
                    errorMessage || "Token refresh failed"
                );
            }
            break;

        default:
            logger.warn({ operation }, "Unknown auth operation");
    }
}

/**
 * Handle successful OAuth connection
 */
async function handleConnectionCreated(
    userEmail: string,
    service: string,
    connectionId: string
) {
    try {
        // Verify user exists in our system
        const user = await db.query.users.findFirst({
            where: eq(schema.users.email, userEmail),
        });

        if (!user) {
            logger.error(
                { userEmail, service },
                "Cannot create connection: User not found in database"
            );
            throw new Error(
                `User ${userEmail} must be created before connecting services`
            );
        }

        // Fetch account info from the service
        let accountId: string;
        let accountDisplayName: string | null = null;

        try {
            const accountInfo = await fetchAccountInfo(
                service,
                connectionId,
                userEmail
            );
            accountId = accountInfo.identifier;
            accountDisplayName = accountInfo.displayName;
        } catch (error) {
            logger.error(
                { error, service, connectionId },
                "Failed to fetch account info"
            );

            // Store as failed connection instead of silently falling back
            await handleConnectionFailed(
                userEmail,
                service,
                connectionId,
                `Failed to fetch ${service} account information. Please try reconnecting.`
            );
            return;
        }

        // Upsert connection using userEmail directly (no UUID lookup needed)
        const isFirstAccount = await db.transaction(async (tx) => {
            // Clean up any orphaned ERROR entries
            await tx
                .delete(schema.integrations)
                .where(
                    and(
                        eq(schema.integrations.userEmail, userEmail),
                        eq(schema.integrations.service, service),
                        eq(schema.integrations.connectionId, connectionId),
                        eq(schema.integrations.status, "error")
                    )
                );

            const existingConnections = await tx.query.integrations.findMany({
                where: and(
                    eq(schema.integrations.userEmail, userEmail),
                    eq(schema.integrations.service, service),
                    eq(schema.integrations.status, "connected")
                ),
            });

            const isFirst = existingConnections.length === 0;

            const existing = await tx.query.integrations.findFirst({
                where: and(
                    eq(schema.integrations.userEmail, userEmail),
                    eq(schema.integrations.service, service),
                    eq(schema.integrations.accountId, accountId)
                ),
            });

            if (existing) {
                await tx
                    .update(schema.integrations)
                    .set({
                        connectionId,
                        status: "connected",
                        errorMessage: null,
                        accountDisplayName,
                        isDefault: isFirst,
                        lastSyncAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(eq(schema.integrations.id, existing.id));

                logger.info(
                    { userEmail, service, accountId },
                    "Updated existing integration via webhook"
                );
            } else {
                await tx.insert(schema.integrations).values({
                    userEmail,
                    service,
                    connectionId,
                    credentialType: "oauth",
                    accountId,
                    accountDisplayName,
                    isDefault: isFirst,
                    status: "connected",
                    connectedAt: new Date(),
                    lastSyncAt: new Date(),
                    updatedAt: new Date(),
                });

                logger.info(
                    { userEmail, service, accountId, isDefault: isFirst },
                    "Created new integration via webhook"
                );
            }

            return isFirst;
        });

        // Log to audit trail
        await logIntegrationEvent({
            userEmail,
            service,
            eventType: "nango_connection_created",
            eventSource: "nango_webhook",
            accountId,
            accountDisplayName: accountDisplayName ?? undefined,
            connectionId,
            metadata: {
                isFirstAccount,
                operation: "creation",
            },
        });
    } catch (error) {
        logger.error(
            { error, userEmail, service, connectionId },
            "Failed to store OAuth connection"
        );

        Sentry.captureException(error, {
            tags: {
                component: "webhook",
                action: "store_connection",
                service,
            },
            extra: {
                userEmail,
                connectionId,
            },
        });

        throw error;
    }
}

/**
 * Handle failed OAuth connection attempt
 */
async function handleConnectionFailed(
    userEmail: string,
    service: string,
    connectionId: string,
    errorMessage: string
) {
    try {
        const user = await db.query.users.findFirst({
            where: eq(schema.users.email, userEmail),
        });

        if (!user) {
            logger.error(
                { userEmail, service },
                "Cannot record connection error: User not found"
            );
            return;
        }

        // Use connectionId as fallback accountId - can't fetch real one on failure
        const accountId = connectionId;

        const existing = await db.query.integrations.findFirst({
            where: and(
                eq(schema.integrations.userEmail, userEmail),
                eq(schema.integrations.service, service),
                eq(schema.integrations.accountId, accountId)
            ),
        });

        if (existing) {
            await db
                .update(schema.integrations)
                .set({
                    status: "error",
                    errorMessage,
                    updatedAt: new Date(),
                })
                .where(eq(schema.integrations.id, existing.id));
        } else {
            await db.insert(schema.integrations).values({
                userEmail,
                service,
                connectionId,
                credentialType: "oauth",
                accountId,
                isDefault: false,
                status: "error",
                errorMessage,
                connectedAt: new Date(),
                updatedAt: new Date(),
            });
        }

        // Log to audit trail
        await logIntegrationEvent({
            userEmail,
            service,
            eventType: "connection_error",
            eventSource: "nango_webhook",
            errorMessage,
            metadata: {
                operation: "creation_failed",
                connectionId,
            },
        });

        logger.info({ userEmail, service, errorMessage }, "Recorded failed connection");
    } catch (error) {
        logger.error(
            { error, userEmail, service },
            "Failed to record connection error"
        );
    }
}

/**
 * Handle connection deletion
 */
async function handleConnectionDeleted(
    userEmail: string,
    service: string,
    connectionId: string
) {
    try {
        await db
            .update(schema.integrations)
            .set({
                status: "disconnected",
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(schema.integrations.userEmail, userEmail),
                    eq(schema.integrations.service, service),
                    eq(schema.integrations.connectionId, connectionId)
                )
            );

        // Log to audit trail
        await logIntegrationEvent({
            userEmail,
            service,
            eventType: "nango_connection_deleted",
            eventSource: "nango_webhook",
            connectionId,
            metadata: {
                operation: "deletion",
            },
        });

        logger.info({ userEmail, service }, "Marked connection as disconnected");
    } catch (error) {
        logger.error({ error, userEmail, service }, "Failed to mark disconnected");
    }
}

/**
 * Handle successful token refresh
 */
async function handleTokenRefreshSuccess(
    userEmail: string,
    service: string,
    connectionId: string
) {
    try {
        const result = await db
            .update(schema.integrations)
            .set({
                lastSyncAt: new Date(),
                errorMessage: null,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(schema.integrations.userEmail, userEmail),
                    eq(schema.integrations.service, service),
                    eq(schema.integrations.connectionId, connectionId),
                    eq(schema.integrations.status, "connected")
                )
            )
            .returning({ id: schema.integrations.id });

        if (result.length > 0) {
            // Log to audit trail
            await logIntegrationEvent({
                userEmail,
                service,
                eventType: "nango_token_refresh",
                eventSource: "nango_webhook",
                connectionId,
                metadata: {
                    operation: "refresh",
                    success: true,
                },
            });

            logger.info({ userEmail, service }, "Token refreshed successfully");
        } else {
            logger.debug(
                { userEmail, service },
                "No connected integration found to refresh"
            );
        }
    } catch (error) {
        logger.error({ error, userEmail, service }, "Failed to record token refresh");
    }
}

/**
 * Handle token refresh failure - mark as EXPIRED (not ERROR)
 * User sees "reconnect" prompt, prevents stale credential API errors
 */
async function handleTokenRefreshFailed(
    userEmail: string,
    service: string,
    connectionId: string,
    errorMessage: string
) {
    try {
        const result = await db
            .update(schema.integrations)
            .set({
                status: "expired",
                errorMessage,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(schema.integrations.userEmail, userEmail),
                    eq(schema.integrations.service, service),
                    eq(schema.integrations.connectionId, connectionId),
                    eq(schema.integrations.status, "connected")
                )
            )
            .returning({ id: schema.integrations.id });

        if (result.length > 0) {
            // Log to audit trail
            await logIntegrationEvent({
                userEmail,
                service,
                eventType: "nango_auth_error",
                eventSource: "nango_webhook",
                connectionId,
                errorMessage,
                metadata: {
                    operation: "refresh_failed",
                },
            });

            logger.info(
                { userEmail, service, errorMessage },
                "Token expired - needs reconnection"
            );
        } else {
            logger.debug(
                { userEmail, service },
                "No connected integration found to mark as expired"
            );
        }
    } catch (error) {
        logger.error(
            { error, userEmail, service },
            "Failed to record token expiration"
        );
    }
}

/**
 * POST /api/webhooks/nango
 *
 * Receives webhook notifications from Nango when OAuth connections change.
 * MUST verify signature to prevent spoofing.
 */
export async function POST(req: NextRequest) {
    return await Sentry.startSpan(
        {
            op: "webhook.nango",
            name: "Nango Webhook Handler",
        },
        async (span) => {
            try {
                const signature = req.headers.get("x-nango-signature");
                const webhookSecret = env.NANGO_WEBHOOK_SECRET;

                const hasSignature = Boolean(signature && webhookSecret);
                span.setAttribute("signature_verified", hasSignature);

                if (webhookSecret && signature) {
                    const body = await req.text();

                    if (!verifySignature(body, signature, webhookSecret)) {
                        logger.error(
                            {
                                received: signature.substring(0, 10) + "...",
                            },
                            "Nango webhook signature verification failed"
                        );

                        span.setStatus({ code: 2, message: "Invalid signature" });
                        Sentry.captureMessage(
                            "Nango webhook signature verification failed",
                            {
                                level: "warning",
                                tags: {
                                    webhook: "nango",
                                    security: "signature_mismatch",
                                },
                            }
                        );

                        return NextResponse.json(
                            { error: "Invalid signature" },
                            { status: 401 }
                        );
                    }

                    const event = JSON.parse(body) as NangoWebhookEvent;
                    span.setAttribute("event_type", event.type);

                    if (event.type === "auth") {
                        span.setAttribute("service", event.providerConfigKey);
                        span.setAttribute("operation", event.operation || "unknown");
                        span.setAttribute("success", event.success);
                        await handleAuthEvent(event);
                    } else {
                        logger.debug({ type: event.type }, "Ignoring non-auth webhook");
                    }
                } else if (!webhookSecret) {
                    // Development mode - no signature verification
                    logger.warn(
                        "Nango webhook signature not verified (development mode)"
                    );

                    Sentry.addBreadcrumb({
                        category: "webhook",
                        message: "Webhook signature not verified (development mode)",
                        level: "warning",
                    });

                    const event = (await req.json()) as NangoWebhookEvent;
                    span.setAttribute("event_type", event.type);

                    if (event.type === "auth") {
                        span.setAttribute("service", event.providerConfigKey);
                        span.setAttribute("operation", event.operation || "unknown");
                        span.setAttribute("success", event.success);
                        await handleAuthEvent(event);
                    }
                } else {
                    // Secret configured but no signature provided
                    logger.warn("Webhook secret configured but no signature provided");
                    return NextResponse.json(
                        { error: "Missing signature" },
                        { status: 401 }
                    );
                }

                span.setStatus({ code: 1, message: "Success" });
                return NextResponse.json({ success: true });
            } catch (error) {
                logger.error(
                    {
                        err: error,
                        errorMessage:
                            error instanceof Error ? error.message : String(error),
                    },
                    "Webhook processing failed"
                );

                span.setStatus({ code: 2, message: "Processing failed" });
                Sentry.captureException(error, {
                    tags: {
                        webhook: "nango",
                    },
                });

                return NextResponse.json(
                    {
                        error: "Webhook processing failed",
                        details:
                            error instanceof Error ? error.message : "Unknown error",
                    },
                    { status: 500 }
                );
            }
        }
    );
}
