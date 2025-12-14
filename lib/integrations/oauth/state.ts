/**
 * OAuth State Management
 *
 * Handles CSRF protection for OAuth flows via state parameter.
 *
 * Flow:
 * 1. User clicks "Connect" → generateState() creates random token, stores in DB
 * 2. Token included in authorization URL as `state` param
 * 3. Provider redirects back with same `state` param
 * 4. validateState() checks token exists, isn't expired, returns user context
 *
 * State expires after 5 minutes to limit attack window.
 */

import crypto from "crypto";
import { db } from "@/lib/db";
import { oauthStates } from "@/lib/db/schema";
import { eq, lt } from "drizzle-orm";
import { logger } from "@/lib/logger";
import type { OAuthState } from "./types";

/** State expires after 5 minutes */
const STATE_TTL_MS = 5 * 60 * 1000;

/**
 * Generate a cryptographically secure random state token.
 * URL-safe base64 encoding, 32 bytes of entropy.
 */
function generateRandomState(): string {
    return crypto.randomBytes(32).toString("base64url");
}

/**
 * Generate a PKCE code verifier (for providers that support it).
 * 43-128 characters of URL-safe characters per RFC 7636.
 */
export function generateCodeVerifier(): string {
    return crypto.randomBytes(64).toString("base64url").slice(0, 128);
}

/**
 * Generate PKCE code challenge from verifier.
 * S256 method: base64url(SHA256(verifier))
 */
export function generateCodeChallenge(verifier: string): string {
    return crypto.createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Create and store OAuth state for CSRF protection.
 *
 * @param userEmail - User initiating the OAuth flow
 * @param provider - OAuth provider (notion, slack, etc.)
 * @param returnUrl - Where to redirect after successful connection
 * @param usePKCE - Whether to generate PKCE code verifier
 * @returns The state token to include in authorization URL
 */
export async function generateState(
    userEmail: string,
    provider: string,
    returnUrl?: string,
    usePKCE?: boolean
): Promise<{ state: string; codeVerifier?: string; codeChallenge?: string }> {
    const state = generateRandomState();
    const now = Date.now();
    const expiresAt = new Date(now + STATE_TTL_MS);

    let codeVerifier: string | undefined;
    let codeChallenge: string | undefined;

    if (usePKCE) {
        codeVerifier = generateCodeVerifier();
        codeChallenge = generateCodeChallenge(codeVerifier);
    }

    await db.insert(oauthStates).values({
        state,
        userEmail,
        provider,
        returnUrl,
        codeVerifier,
        expiresAt,
    });

    logger.info({ provider, userEmail }, "🔑 Generated OAuth state");

    return { state, codeVerifier, codeChallenge };
}

/**
 * Validate OAuth state from callback.
 *
 * Checks:
 * - State exists in database
 * - State hasn't expired
 * - Deletes state after validation (one-time use)
 *
 * @param stateParam - State parameter from callback URL
 * @returns OAuthState if valid, null if invalid/expired
 */
export async function validateState(stateParam: string): Promise<OAuthState | null> {
    const record = await db.query.oauthStates.findFirst({
        where: eq(oauthStates.state, stateParam),
    });

    if (!record) {
        logger.warn(
            { state: stateParam.slice(0, 8) + "..." },
            "⚠️ Invalid OAuth state"
        );
        return null;
    }

    // Check expiration
    const now = new Date();
    if (record.expiresAt < now) {
        logger.warn(
            { provider: record.provider, userEmail: record.userEmail },
            "⚠️ Expired OAuth state"
        );
        // Clean up expired state
        await db.delete(oauthStates).where(eq(oauthStates.state, stateParam));
        return null;
    }

    // Delete state after successful validation (one-time use)
    await db.delete(oauthStates).where(eq(oauthStates.state, stateParam));

    logger.info(
        { provider: record.provider, userEmail: record.userEmail },
        "✅ Validated OAuth state"
    );

    return {
        csrf: record.state,
        userEmail: record.userEmail,
        provider: record.provider,
        returnUrl: record.returnUrl ?? undefined,
        createdAt: record.createdAt.getTime(),
        codeVerifier: record.codeVerifier ?? undefined,
    };
}

/**
 * Clean up expired OAuth states.
 * Run periodically (e.g., via cron) to prevent table bloat.
 *
 * @returns Number of expired states deleted
 */
export async function cleanupExpiredStates(): Promise<number> {
    const now = new Date();

    // Use returning() to get deleted rows for accurate count
    const deleted = await db
        .delete(oauthStates)
        .where(lt(oauthStates.expiresAt, now))
        .returning({ id: oauthStates.id });

    const deletedCount = deleted.length;

    if (deletedCount > 0) {
        logger.info({ count: deletedCount }, "🧹 Cleaned up expired OAuth states");
    }

    return deletedCount;
}
