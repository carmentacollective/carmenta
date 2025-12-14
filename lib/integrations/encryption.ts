/**
 * Credential Encryption - AES-256-GCM via @47ng/simple-e2ee
 *
 * ## Why AES-256-GCM (Not RSA, Not Simpler Encryption)
 * GCM provides authenticated encryption - tampering detection built-in. AES-256 is
 * NIST-approved and widely audited. simple-e2ee handles nonce generation and key
 * derivation correctly (easy to get wrong with raw crypto).
 *
 * ## Key Management
 * Single ENCRYPTION_KEY env var. No rotation strategy currently - key change requires
 * re-encrypting all credentials. For production scale, consider envelope encryption
 * with key versioning.
 *
 * ## What Gets Encrypted
 * - API keys for non-OAuth services (Fireflies, Limitless, Giphy, etc.)
 * - OAuth access tokens and refresh tokens (stored via storeTokens())
 *
 * ## Key Format
 * Base64-encoded 32-byte value. Minimum 32 chars for backward compat, but 44 chars
 * is correct for 32 bytes with padding.
 */

import { encrypt, decrypt } from "@47ng/simple-e2ee";
import { env } from "@/lib/env";

export interface ApiKeyCredentials {
    apiKey: string;
    additionalHeaders?: Record<string, string>;
}

export interface BearerTokenCredentials {
    token: string;
    refreshToken?: string;
    expiresAt?: string;
}

export type Credentials = ApiKeyCredentials | BearerTokenCredentials;

function getEncryptionKey(): string {
    const key = env.ENCRYPTION_KEY;

    if (!key) {
        throw new Error(
            "ENCRYPTION_KEY environment variable is required for credential storage"
        );
    }

    // 32 chars minimum for backward compat (44 is correct for base64-encoded 32 bytes)
    if (key.length < 32) {
        throw new Error("ENCRYPTION_KEY must be at least 32 characters");
    }

    return key;
}

export function encryptCredentials(credentials: Credentials): string {
    const key = getEncryptionKey();
    const json = JSON.stringify(credentials);
    const encrypted = encrypt(json, key);
    return encrypted;
}

export function decryptCredentials(encryptedData: string): Credentials {
    const key = getEncryptionKey();
    try {
        const decrypted = decrypt(encryptedData, key);
        return JSON.parse(decrypted as string) as Credentials;
    } catch (error) {
        throw new Error(
            "Failed to decrypt credentials. The encryption key may have changed or the data is corrupted."
        );
    }
}

export function isApiKeyCredentials(
    credentials: Credentials
): credentials is ApiKeyCredentials {
    return "apiKey" in credentials;
}

export function isBearerTokenCredentials(
    credentials: Credentials
): credentials is BearerTokenCredentials {
    return "token" in credentials;
}
