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
        connectionId,
        accountDisplayName,
        errorMessage,
    } = options;

    // Prepare encrypted credentials for API key type
    let encryptedCredentials: string | null = null;
    if (credentialType === "api_key" && apiKey) {
        const credentials: ApiKeyCredentials = { apiKey };
        encryptedCredentials = encryptCredentials(credentials);
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
            encryptedCredentials,
            connectionId:
                credentialType === "oauth" ? (connectionId ?? `nango_${uuid()}`) : null,
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
 * @param connectionId - Nango connection ID (defaults to generated)
 * @param options - Additional options
 * @returns The created integration
 */
export async function createTestOAuthIntegration(
    userEmail: string,
    service: string,
    connectionId?: string,
    options: Partial<TestIntegrationOptions> = {}
) {
    return createTestIntegration({
        ...options,
        userEmail,
        service,
        credentialType: "oauth",
        connectionId,
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
