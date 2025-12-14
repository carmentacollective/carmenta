/**
 * Test fixtures for integration tests
 *
 * Provides helper functions to create test data for integrations, users, and connections.
 */

import { db, schema } from "@/lib/db";
import {
    encryptCredentials,
    type ApiKeyCredentials,
} from "@/lib/integrations/encryption";
import { v4 as uuid } from "uuid";

/**
 * Options for creating a test user
 */
export interface TestUserOptions {
    email?: string;
    clerkId?: string;
    firstName?: string;
    lastName?: string;
}

/**
 * Create a test user in the database
 *
 * @param options - User creation options
 * @returns The created user
 */
export async function createTestUser(options: TestUserOptions = {}) {
    const [user] = await db
        .insert(schema.users)
        .values({
            email: options.email ?? `test-${uuid().slice(0, 8)}@example.com`,
            clerkId: options.clerkId ?? `clerk_${uuid()}`,
            firstName: options.firstName ?? "Test",
            lastName: options.lastName ?? "User",
        })
        .returning();
    return user;
}

/**
 * Options for creating a test integration
 */
export interface TestIntegrationOptions {
    userEmail: string;
    service: string;
    credentialType: "api_key" | "oauth";
    status?: "connected" | "expired" | "error" | "disconnected";
    accountId?: string;
    isDefault?: boolean;
    apiKey?: string;
    accessToken?: string; // For OAuth - direct access token
    connectionId?: string;
    accountDisplayName?: string;
    errorMessage?: string;
}

/**
 * Create a test integration in the database
 *
 * @param options - Integration creation options
 * @returns The created integration
 */
export async function createTestIntegration(options: TestIntegrationOptions) {
    const {
        userEmail,
        service,
        credentialType,
        status = "connected",
        accountId = "default",
        isDefault = false,
        apiKey,
        accessToken,
        connectionId,
        accountDisplayName,
        errorMessage,
    } = options;

    // Prepare encrypted credentials
    let encryptedCreds: string | null = null;
    if (credentialType === "api_key" && apiKey) {
        const credentials: ApiKeyCredentials = { apiKey };
        encryptedCreds = encryptCredentials(credentials);
    } else if (credentialType === "oauth" && accessToken) {
        // For OAuth integrations with in-house auth, encrypt the token
        const credentials = { token: accessToken };
        encryptedCreds = encryptCredentials(credentials);
    }

    const [integration] = await db
        .insert(schema.integrations)
        .values({
            userEmail,
            service,
            credentialType,
            status,
            accountId,
            isDefault,
            encryptedCredentials: encryptedCreds,
            connectionId:
                credentialType === "oauth" && !accessToken
                    ? (connectionId ?? `nango_${uuid()}`)
                    : null,
            accountDisplayName,
            errorMessage,
        })
        .returning();

    return integration;
}

/**
 * Create a test API key integration
 *
 * @param userEmail - User's email address
 * @param service - Service ID (e.g., "giphy", "limitless")
 * @param apiKey - API key (defaults to "test-api-key")
 * @param options - Additional options
 * @returns The created integration
 */
export async function createTestApiKeyIntegration(
    userEmail: string,
    service: string,
    apiKey: string = "test-api-key",
    options: Partial<TestIntegrationOptions> = {}
) {
    return createTestIntegration({
        ...options,
        userEmail,
        service,
        credentialType: "api_key",
        apiKey,
    });
}

/**
 * Create a test OAuth integration
 *
 * @param userEmail - User's email address
 * @param service - Service ID (e.g., "notion", "clickup")
 * @param accessTokenOrConnectionId - Access token (for in-house OAuth) or Nango connection ID (legacy)
 * @param options - Additional options
 * @returns The created integration
 */
export async function createTestOAuthIntegration(
    userEmail: string,
    service: string,
    accessTokenOrConnectionId?: string,
    options: Partial<TestIntegrationOptions> = {}
) {
    // For in-house OAuth services (like notion), use accessToken
    // For legacy Nango services, use connectionId
    const isInHouseOAuth = service === "notion"; // Add more services as they migrate

    return createTestIntegration({
        ...options,
        userEmail,
        service,
        credentialType: "oauth",
        accessToken: isInHouseOAuth ? accessTokenOrConnectionId : undefined,
        connectionId: !isInHouseOAuth ? accessTokenOrConnectionId : undefined,
    });
}

/**
 * Create a user with connected integrations
 *
 * @param services - Array of service IDs to connect
 * @param userOptions - User creation options
 * @returns Object with user and integrations
 */
export async function createUserWithIntegrations(
    services: string[],
    userOptions: TestUserOptions = {}
) {
    const user = await createTestUser(userOptions);

    const integrations = await Promise.all(
        services.map((service) =>
            createTestApiKeyIntegration(user.email, service, `${service}-test-key`)
        )
    );

    return { user, integrations };
}
