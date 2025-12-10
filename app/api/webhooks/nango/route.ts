import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";

import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { fetchAccountInfo } from "@/lib/integrations/fetch-account-info";

/**
 * Nango webhook handler
 *
 * Receives notifications when OAuth connections are created, updated, or deleted.
 * Pattern from MCPHubby's battle-tested implementation.
 *
 * Security: ALL webhooks MUST be signature-verified using HMAC-SHA256.
 * Flow:
 * 1. User completes OAuth → ClickUp redirects to our callback
 * 2. Our callback redirects to Nango (308)
 * 3. Nango exchanges code for tokens, stores encrypted
 * 4. Nango sends webhook to this endpoint
 * 5. We verify signature, fetch account info, store in database
 *
 * Event types we care about:
 * - auth (connection lifecycle): creation, deletion, refresh
 *
 * Event types we ignore:
 * - sync (Nango sync jobs - not used)
 * - forward (webhook forwarding - not used)
 */

interface NangoWebhookEvent {
    type: "auth" | "sync" | "forward";
    connectionId: string;
    providerConfigKey: string;
    authMode: "OAUTH2" | "OAUTH1" | "API_KEY" | "APP";
    operation?: "creation" | "override" | "deletion" | "refresh";
    success: boolean;
    error?: string;
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
        // Add more services as needed
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
    const { connectionId, providerConfigKey, operation, success, endUser } = event;

    if (!operation) {
        logger.warn({ event }, "Auth event missing operation field");
        return;
    }

    const service = getServiceFromProviderKey(providerConfigKey);

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
    // When this happens, we can't match to a user. Log and return.
    if (!endUser?.id) {
        logger.warn(
            { event },
            "Nango webhook missing endUser.id - cannot match to user"
        );
        return;
    }

    const userEmail = endUser.id; // We pass email as ID in createConnectSession

    switch (operation) {
        case "creation":
        case "override":
            if (!success) {
                logger.error({ event }, "OAuth connection failed");
                // Store ERROR status so UI can show reconnect button
                await storeFailedConnection(
                    userEmail,
                    service,
                    connectionId,
                    event.error
                );
                return;
            }

            // Fetch account info from the service to populate accountId/displayName
            await storeSuccessfulConnection(userEmail, service, connectionId);
            break;

        case "deletion":
            // Mark connection as disconnected (don't delete - preserve history)
            await markConnectionDisconnected(userEmail, service, connectionId);
            break;

        case "refresh":
            // Token was refreshed successfully - update timestamp
            await updateConnectionTimestamp(userEmail, service, connectionId);
            break;

        default:
            logger.warn({ operation }, "Unknown auth operation");
    }
}

/**
 * Fetch account info and store successful OAuth connection
 */
async function storeSuccessfulConnection(
    userEmail: string,
    service: string,
    connectionId: string
) {
    try {
        // Find user by email
        const user = await db.query.users.findFirst({
            where: eq(schema.users.email, userEmail),
        });

        if (!user) {
            logger.error({ userEmail }, "User not found for OAuth connection");
            return;
        }

        // Fetch account info from the service using centralized function
        // Errors bubble up - connection save fails if we can't identify the account
        const accountInfo = await fetchAccountInfo(service, connectionId, user.id);
        const accountId = accountInfo.identifier;
        const accountDisplayName = accountInfo.displayName;

        // Upsert integration record (idempotent for webhook retries)
        await db.transaction(async (tx) => {
            // Check if this is the first account for this service (inside transaction to prevent race conditions)
            const existingConnections = await tx.query.integrations.findMany({
                where: and(
                    eq(schema.integrations.userId, user.id),
                    eq(schema.integrations.service, service),
                    eq(schema.integrations.status, "connected")
                ),
            });

            const isFirstAccount = existingConnections.length === 0;
            // Clean up any orphaned ERROR entries for this connectionId
            await tx
                .delete(schema.integrations)
                .where(
                    and(
                        eq(schema.integrations.userId, user.id),
                        eq(schema.integrations.service, service),
                        eq(schema.integrations.connectionId, connectionId),
                        eq(schema.integrations.status, "error")
                    )
                );

            // Check if integration already exists
            const existing = await tx.query.integrations.findFirst({
                where: and(
                    eq(schema.integrations.userId, user.id),
                    eq(schema.integrations.service, service),
                    eq(schema.integrations.accountId, accountId)
                ),
            });

            if (existing) {
                // Update existing integration
                await tx
                    .update(schema.integrations)
                    .set({
                        connectionId,
                        status: "connected",
                        accountDisplayName,
                        errorMessage: null,
                        updatedAt: new Date(),
                    })
                    .where(eq(schema.integrations.id, existing.id));

                logger.info(
                    { userId: user.id, service, accountId },
                    "Updated existing integration"
                );
            } else {
                // Create new integration
                await tx.insert(schema.integrations).values({
                    userId: user.id,
                    service,
                    connectionId,
                    credentialType: "oauth",
                    accountId,
                    accountDisplayName,
                    isDefault: isFirstAccount,
                    status: "connected",
                    connectedAt: new Date(),
                    updatedAt: new Date(),
                });

                logger.info(
                    { userId: user.id, service, accountId, isDefault: isFirstAccount },
                    "Created new integration"
                );
            }
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
 * Store failed OAuth connection attempt (for UI error handling)
 */
async function storeFailedConnection(
    userEmail: string,
    service: string,
    connectionId: string,
    errorMessage?: string
) {
    try {
        const user = await db.query.users.findFirst({
            where: eq(schema.users.email, userEmail),
        });

        if (!user) {
            logger.error({ userEmail }, "User not found for failed connection");
            return;
        }

        await db.insert(schema.integrations).values({
            userId: user.id,
            service,
            connectionId,
            credentialType: "oauth",
            accountId: "error",
            status: "error",
            errorMessage: errorMessage || "OAuth connection failed",
            isDefault: false,
            connectedAt: new Date(),
            updatedAt: new Date(),
        });

        logger.info({ userId: user.id, service }, "Stored failed connection");
    } catch (error) {
        logger.error({ error, userEmail, service }, "Failed to store error connection");
    }
}

/**
 * Mark connection as disconnected (preserve history, don't delete)
 */
async function markConnectionDisconnected(
    userEmail: string,
    service: string,
    connectionId: string
) {
    try {
        const user = await db.query.users.findFirst({
            where: eq(schema.users.email, userEmail),
        });

        if (!user) {
            logger.error({ userEmail }, "User not found for disconnection");
            return;
        }

        await db
            .update(schema.integrations)
            .set({
                status: "disconnected",
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(schema.integrations.userId, user.id),
                    eq(schema.integrations.service, service),
                    eq(schema.integrations.connectionId, connectionId)
                )
            );

        logger.info({ userId: user.id, service }, "Marked connection as disconnected");
    } catch (error) {
        logger.error({ error, userEmail, service }, "Failed to mark disconnected");
    }
}

/**
 * Update connection timestamp after token refresh
 */
async function updateConnectionTimestamp(
    userEmail: string,
    service: string,
    connectionId: string
) {
    try {
        const user = await db.query.users.findFirst({
            where: eq(schema.users.email, userEmail),
        });

        if (!user) {
            logger.error({ userEmail }, "User not found for refresh");
            return;
        }

        await db
            .update(schema.integrations)
            .set({
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(schema.integrations.userId, user.id),
                    eq(schema.integrations.service, service),
                    eq(schema.integrations.connectionId, connectionId)
                )
            );

        logger.debug({ userId: user.id, service }, "Updated connection timestamp");
    } catch (error) {
        logger.error({ error, userEmail, service }, "Failed to update timestamp");
    }
}

/**
 * POST /api/webhooks/nango
 *
 * Receives webhook notifications from Nango when OAuth connections change.
 * MUST verify signature to prevent spoofing.
 */
export async function POST(req: NextRequest) {
    try {
        // Get signature from header
        const signature = req.headers.get("x-nango-signature");
        const webhookSecret = env.NANGO_WEBHOOK_SECRET;

        // Verify signature if secret is configured
        if (webhookSecret && signature) {
            const body = await req.text();

            if (!verifySignature(body, signature, webhookSecret)) {
                logger.warn("Invalid webhook signature");
                return NextResponse.json(
                    { error: "Invalid signature" },
                    { status: 401 }
                );
            }

            // Parse body after verification
            const event = JSON.parse(body) as NangoWebhookEvent;

            // Only handle auth events
            if (event.type === "auth") {
                await handleAuthEvent(event);
            } else {
                logger.debug({ type: event.type }, "Ignoring non-auth webhook event");
            }

            return NextResponse.json({ success: true });
        } else if (!webhookSecret) {
            // Development mode - no signature verification
            logger.warn(
                "No webhook secret configured - skipping signature verification"
            );

            const event = (await req.json()) as NangoWebhookEvent;

            if (event.type === "auth") {
                await handleAuthEvent(event);
            }

            return NextResponse.json({ success: true });
        } else {
            // Secret configured but no signature provided
            logger.warn("Webhook secret configured but no signature provided");
            return NextResponse.json({ error: "Missing signature" }, { status: 401 });
        }
    } catch (error) {
        logger.error({ error }, "Webhook processing failed");

        Sentry.captureException(error, {
            tags: {
                component: "webhook",
                action: "process",
            },
        });

        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
