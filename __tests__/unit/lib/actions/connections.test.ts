/**
 * Connection Server Actions Tests
 *
 * Tests for lib/actions/connections.ts - server actions for connection operations.
 *
 * Testing approach:
 * - Mock only Clerk (currentUser) and next/navigation (redirect)
 * - Use real PGlite database operations for everything else
 * - Test behavior, not implementation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupTestDb } from "@/vitest.setup";
import { db, schema } from "@/lib/db";
import { encodeConnectionId, decodeConnectionId } from "@/lib/sqids";
import { createConnection as dbCreateConnection } from "@/lib/db/connections";

setupTestDb();

// ============================================================================
// MOCKS
// ============================================================================

// Mock Clerk server - this is the only external dependency we mock
const mockCurrentUser = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
    currentUser: () => mockCurrentUser(),
}));

// Mock next/navigation - redirect throws to stop execution
const mockRedirect = vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT: ${url}`);
});
vi.mock("next/navigation", () => ({
    redirect: (url: string) => mockRedirect(url),
}));

// Import after mocks are set up
import {
    createNewConnection,
    createAndRedirect,
    loadConnection,
    loadConnectionMessages,
    updateConnection,
    archiveConnection,
    deleteConnection,
    toggleStarConnection,
    getRecentConnections,
    getStarredConnections,
    getRecentUnstarredConnections,
    getConnectionMetadata,
} from "@/lib/actions/connections";
import { saveMessage } from "@/lib/db/connections";

// ============================================================================
// FIXTURES
// ============================================================================

/**
 * Factory for creating Clerk user objects.
 * Clerk's User type is verbose - this provides sensible defaults.
 */
function createClerkUser(
    overrides: {
        id?: string;
        email?: string;
        firstName?: string | null;
        lastName?: string | null;
        imageUrl?: string | null;
    } = {}
) {
    const email = overrides.email ?? "test@example.com";
    return {
        id: overrides.id ?? `clerk_${crypto.randomUUID()}`,
        emailAddresses: [
            {
                id: `email_${crypto.randomUUID()}`,
                emailAddress: email,
                verification: null,
                linkedTo: [],
            },
        ],
        firstName: overrides.firstName ?? "Test",
        lastName: overrides.lastName ?? "User",
        fullName: `${overrides.firstName ?? "Test"} ${overrides.lastName ?? "User"}`,
        imageUrl: overrides.imageUrl ?? "https://example.com/avatar.jpg",
        // Required properties that we don't care about in tests
        primaryEmailAddress: null,
        primaryPhoneNumber: null,
        primaryWeb3Wallet: null,
        phoneNumbers: [],
        web3Wallets: [],
        externalAccounts: [],
        samlAccounts: [],
        organizationMemberships: [],
        passkeys: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        twoFactorEnabled: false,
        passwordEnabled: true,
        publicMetadata: {},
        privateMetadata: {},
        unsafeMetadata: {},
    };
}

/**
 * Creates a test user in the database and returns a matching Clerk user mock.
 * This is the standard pattern for server action tests.
 */
async function createTestUserWithClerk(
    options: {
        email?: string;
        firstName?: string | null;
        lastName?: string | null;
    } = {}
) {
    const clerkId = `clerk_${crypto.randomUUID()}`;
    const email = options.email ?? `test-${crypto.randomUUID()}@example.com`;

    // Create user in database
    const [dbUser] = await db
        .insert(schema.users)
        .values({
            clerkId,
            email,
            firstName: options.firstName ?? "Test",
            lastName: options.lastName ?? "User",
        })
        .returning();

    // Create matching Clerk user for mock
    const clerkUser = createClerkUser({
        id: clerkId,
        email,
        firstName: options.firstName ?? "Test",
        lastName: options.lastName ?? "User",
    });

    return { dbUser, clerkUser };
}

// ============================================================================
// TESTS: createNewConnection
// ============================================================================

describe("createNewConnection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws error when not authenticated", async () => {
        mockCurrentUser.mockResolvedValue(null);

        await expect(createNewConnection()).rejects.toThrow("Sign in to continue");
    });

    it("throws error when user has no email", async () => {
        mockCurrentUser.mockResolvedValue({
            id: "clerk_123",
            emailAddresses: [],
        });

        await expect(createNewConnection()).rejects.toThrow("Sign in to continue");
    });

    it("creates connection and returns encoded id and slug", async () => {
        const { clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        const result = await createNewConnection();

        expect(result.id).toBeDefined();
        expect(result.slug).toBeDefined();
        // The ID should be a valid Sqid that can be decoded
        const decodedId = decodeConnectionId(result.id);
        expect(decodedId).not.toBeNull();
        expect(typeof decodedId).toBe("number");
    });

    it("creates connection with correct user association", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        const result = await createNewConnection();

        // Load the connection and verify it belongs to the right user
        const loadResult = await loadConnection(result.id);
        expect(loadResult).not.toBeNull();
        expect(loadResult!.connection.userId).toBe(dbUser.id);
    });
});

// ============================================================================
// TESTS: createAndRedirect
// ============================================================================

describe("createAndRedirect", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws error when not authenticated", async () => {
        mockCurrentUser.mockResolvedValue(null);

        await expect(createAndRedirect()).rejects.toThrow("Sign in to continue");
    });

    it("creates connection and redirects to connection page", async () => {
        const { clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        await expect(createAndRedirect()).rejects.toThrow(/NEXT_REDIRECT:/);

        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const redirectUrl = mockRedirect.mock.calls[0][0];
        expect(redirectUrl).toMatch(/^\/connection\/[a-z0-9-]+\/[a-z0-9]+$/);
    });
});

// ============================================================================
// TESTS: loadConnection
// ============================================================================

describe("loadConnection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns null when not authenticated", async () => {
        mockCurrentUser.mockResolvedValue(null);

        const result = await loadConnection("abc123def");
        expect(result).toBeNull();
    });

    it("returns null for invalid Sqid format", async () => {
        const { clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        // Invalid formats
        const result1 = await loadConnection("abc"); // Too short
        const result2 = await loadConnection("INVALID"); // Uppercase
        const result3 = await loadConnection("abc-123"); // Contains hyphen

        expect(result1).toBeNull();
        expect(result2).toBeNull();
        expect(result3).toBeNull();
    });

    it("returns null when connection does not exist", async () => {
        const { clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        // Valid Sqid format but connection doesn't exist
        const nonexistentId = encodeConnectionId(999999);
        const result = await loadConnection(nonexistentId);

        expect(result).toBeNull();
    });

    it("returns null when accessing another user's connection", async () => {
        // Create connection owner
        const { dbUser: owner } = await createTestUserWithClerk({
            email: "owner@example.com",
        });
        const connection = await dbCreateConnection(owner.id);
        const publicId = encodeConnectionId(connection.id);

        // Create different user who tries to access it
        const { clerkUser: attacker } = await createTestUserWithClerk({
            email: "attacker@example.com",
        });
        mockCurrentUser.mockResolvedValue(attacker);

        const result = await loadConnection(publicId);
        expect(result).toBeNull();
    });

    it("loads connection with messages for owner", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        // Create connection and add messages
        const connection = await dbCreateConnection(dbUser.id);
        await saveMessage(connection.id, {
            id: crypto.randomUUID(),
            role: "user",
            parts: [{ type: "text", text: "Hello" }],
        });
        await saveMessage(connection.id, {
            id: crypto.randomUUID(),
            role: "assistant",
            parts: [{ type: "text", text: "Hi there!" }],
        });

        const publicId = encodeConnectionId(connection.id);
        const result = await loadConnection(publicId);

        expect(result).not.toBeNull();
        expect(result!.connection.id).toBe(publicId);
        expect(result!.messages).toHaveLength(2);
        expect(result!.messages[0].role).toBe("user");
        expect(result!.messages[1].role).toBe("assistant");
    });

    it("returns null concierge data when fields are not set", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        const connection = await dbCreateConnection(dbUser.id);
        const publicId = encodeConnectionId(connection.id);

        const result = await loadConnection(publicId);

        expect(result).not.toBeNull();
        expect(result!.concierge).toBeNull();
    });

    it("extracts concierge data when all fields are present", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        // Create connection with concierge data
        const connection = await dbCreateConnection(
            dbUser.id,
            "Test Connection",
            "anthropic/claude-sonnet-4.5",
            {
                modelId: "anthropic/claude-sonnet-4.5",
                temperature: 0.7,
                explanation: "Standard task",
                reasoning: { enabled: true, maxTokens: 1000 },
            }
        );
        const publicId = encodeConnectionId(connection.id);

        const result = await loadConnection(publicId);

        expect(result).not.toBeNull();
        expect(result!.concierge).not.toBeNull();
        expect(result!.concierge!.modelId).toBe("anthropic/claude-sonnet-4.5");
        expect(result!.concierge!.temperature).toBe(0.7);
        expect(result!.concierge!.explanation).toBe("Standard task");
        expect(result!.concierge!.reasoning).toEqual({
            enabled: true,
            maxTokens: 1000,
        });
    });
});

// ============================================================================
// TESTS: loadConnectionMessages
// ============================================================================

describe("loadConnectionMessages", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns empty array when not authenticated", async () => {
        mockCurrentUser.mockResolvedValue(null);

        const result = await loadConnectionMessages("abc123def");
        expect(result).toEqual([]);
    });

    it("returns empty array for invalid connection", async () => {
        const { clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        const result = await loadConnectionMessages("invalid");
        expect(result).toEqual([]);
    });

    it("returns messages for valid connection", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        const connection = await dbCreateConnection(dbUser.id);
        await saveMessage(connection.id, {
            id: crypto.randomUUID(),
            role: "user",
            parts: [{ type: "text", text: "Message 1" }],
        });
        await saveMessage(connection.id, {
            id: crypto.randomUUID(),
            role: "assistant",
            parts: [{ type: "text", text: "Message 2" }],
        });

        const publicId = encodeConnectionId(connection.id);
        const result = await loadConnectionMessages(publicId);

        expect(result).toHaveLength(2);
    });
});

// ============================================================================
// TESTS: updateConnection
// ============================================================================

describe("updateConnection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns null when not authenticated", async () => {
        mockCurrentUser.mockResolvedValue(null);

        const result = await updateConnection("abc123def", { title: "New Title" });
        expect(result).toBeNull();
    });

    it("returns null for another user's connection", async () => {
        const { dbUser: owner } = await createTestUserWithClerk({
            email: "owner@example.com",
        });
        const connection = await dbCreateConnection(owner.id);
        const publicId = encodeConnectionId(connection.id);

        const { clerkUser: attacker } = await createTestUserWithClerk({
            email: "attacker@example.com",
        });
        mockCurrentUser.mockResolvedValue(attacker);

        const result = await updateConnection(publicId, { title: "Hacked!" });
        expect(result).toBeNull();
    });

    it("updates title for owner's connection", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        const connection = await dbCreateConnection(dbUser.id);
        const publicId = encodeConnectionId(connection.id);

        const result = await updateConnection(publicId, { title: "Updated Title" });

        expect(result).not.toBeNull();
        expect(result!.title).toBe("Updated Title");
    });

    it("updates status for owner's connection", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        const connection = await dbCreateConnection(dbUser.id);
        const publicId = encodeConnectionId(connection.id);

        const result = await updateConnection(publicId, { status: "background" });

        expect(result).not.toBeNull();
        expect(result!.status).toBe("background");
    });

    it("updates modelId for owner's connection", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        const connection = await dbCreateConnection(dbUser.id);
        const publicId = encodeConnectionId(connection.id);

        const result = await updateConnection(publicId, {
            modelId: "anthropic/claude-opus-4",
        });

        expect(result).not.toBeNull();
        expect(result!.modelId).toBe("anthropic/claude-opus-4");
    });
});

// ============================================================================
// TESTS: archiveConnection
// ============================================================================

describe("archiveConnection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws error when not authenticated", async () => {
        mockCurrentUser.mockResolvedValue(null);

        await expect(archiveConnection("abc123def")).rejects.toThrow(
            "Sign in to continue"
        );
    });

    it("throws error for another user's connection", async () => {
        const { dbUser: owner } = await createTestUserWithClerk({
            email: "owner@example.com",
        });
        const connection = await dbCreateConnection(owner.id);
        const publicId = encodeConnectionId(connection.id);

        const { clerkUser: attacker } = await createTestUserWithClerk({
            email: "attacker@example.com",
        });
        mockCurrentUser.mockResolvedValue(attacker);

        await expect(archiveConnection(publicId)).rejects.toThrow(
            "That connection doesn't exist"
        );
    });

    it("archives owner's connection", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        const connection = await dbCreateConnection(dbUser.id);
        const publicId = encodeConnectionId(connection.id);

        await archiveConnection(publicId);

        // Verify it's archived
        const result = await loadConnection(publicId);
        expect(result).not.toBeNull();
        expect(result!.connection.status).toBe("archived");
    });
});

// ============================================================================
// TESTS: deleteConnection
// ============================================================================

describe("deleteConnection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws error when not authenticated", async () => {
        mockCurrentUser.mockResolvedValue(null);

        await expect(deleteConnection("abc123def")).rejects.toThrow(
            "Sign in to continue"
        );
    });

    it("throws error for another user's connection", async () => {
        const { dbUser: owner } = await createTestUserWithClerk({
            email: "owner@example.com",
        });
        const connection = await dbCreateConnection(owner.id);
        const publicId = encodeConnectionId(connection.id);

        const { clerkUser: attacker } = await createTestUserWithClerk({
            email: "attacker@example.com",
        });
        mockCurrentUser.mockResolvedValue(attacker);

        await expect(deleteConnection(publicId)).rejects.toThrow(
            "That connection doesn't exist"
        );
    });

    it("deletes owner's connection permanently", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        const connection = await dbCreateConnection(dbUser.id);
        const publicId = encodeConnectionId(connection.id);

        await deleteConnection(publicId);

        // Verify it's gone
        const result = await loadConnection(publicId);
        expect(result).toBeNull();
    });
});

// ============================================================================
// TESTS: toggleStarConnection (starConnection / unstarConnection)
// ============================================================================

describe("toggleStarConnection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns null when not authenticated", async () => {
        mockCurrentUser.mockResolvedValue(null);

        const result = await toggleStarConnection("abc123def", true);
        expect(result).toBeNull();
    });

    it("returns null for another user's connection", async () => {
        const { dbUser: owner } = await createTestUserWithClerk({
            email: "owner@example.com",
        });
        const connection = await dbCreateConnection(owner.id);
        const publicId = encodeConnectionId(connection.id);

        const { clerkUser: attacker } = await createTestUserWithClerk({
            email: "attacker@example.com",
        });
        mockCurrentUser.mockResolvedValue(attacker);

        const result = await toggleStarConnection(publicId, true);
        expect(result).toBeNull();
    });

    it("stars a connection", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        const connection = await dbCreateConnection(dbUser.id);
        const publicId = encodeConnectionId(connection.id);

        const result = await toggleStarConnection(publicId, true);

        expect(result).not.toBeNull();
        expect(result!.isStarred).toBe(true);
        expect(result!.starredAt).not.toBeNull();
    });

    it("unstars a connection", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        const connection = await dbCreateConnection(dbUser.id);
        const publicId = encodeConnectionId(connection.id);

        // Star first
        await toggleStarConnection(publicId, true);

        // Then unstar
        const result = await toggleStarConnection(publicId, false);

        expect(result).not.toBeNull();
        expect(result!.isStarred).toBe(false);
        expect(result!.starredAt).toBeNull();
    });
});

// ============================================================================
// TESTS: getRecentConnections
// ============================================================================

describe("getRecentConnections", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns empty array when not authenticated", async () => {
        mockCurrentUser.mockResolvedValue(null);

        const result = await getRecentConnections();
        expect(result).toEqual([]);
    });

    it("returns connections ordered by lastActivityAt", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        // Create connections
        const conn1 = await dbCreateConnection(dbUser.id, "First");
        const conn2 = await dbCreateConnection(dbUser.id, "Second");

        // Add message to conn1 to make it more recent
        await saveMessage(conn1.id, {
            id: crypto.randomUUID(),
            role: "user",
            parts: [{ type: "text", text: "Hello" }],
        });

        const result = await getRecentConnections();

        expect(result).toHaveLength(2);
        // conn1 should be first (most recent activity)
        expect(result[0].title).toBe("First");
        expect(result[1].title).toBe("Second");
    });

    it("respects limit parameter", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        await dbCreateConnection(dbUser.id, "One");
        await dbCreateConnection(dbUser.id, "Two");
        await dbCreateConnection(dbUser.id, "Three");

        const result = await getRecentConnections(2);
        expect(result).toHaveLength(2);
    });

    it("filters by status", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        const active = await dbCreateConnection(dbUser.id, "Active");
        const toArchive = await dbCreateConnection(dbUser.id, "Archived");
        const archivedPublicId = encodeConnectionId(toArchive.id);
        await archiveConnection(archivedPublicId);

        const result = await getRecentConnections(10, "active");

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(encodeConnectionId(active.id));
    });

    it("returns connections with encoded Sqid IDs", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        await dbCreateConnection(dbUser.id, "Test");

        const result = await getRecentConnections();

        expect(result).toHaveLength(1);
        // ID should be a Sqid (6+ chars, lowercase alphanumeric)
        expect(result[0].id).toMatch(/^[0-9a-z]{6,}$/);
    });
});

// ============================================================================
// TESTS: getStarredConnections
// ============================================================================

describe("getStarredConnections", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns empty array when not authenticated", async () => {
        mockCurrentUser.mockResolvedValue(null);

        const result = await getStarredConnections();
        expect(result).toEqual([]);
    });

    it("returns only starred connections", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        const starred = await dbCreateConnection(dbUser.id, "Starred");
        const unstarred = await dbCreateConnection(dbUser.id, "Unstarred");

        await toggleStarConnection(encodeConnectionId(starred.id), true);

        const result = await getStarredConnections();

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe("Starred");
        expect(result[0].isStarred).toBe(true);
    });
});

// ============================================================================
// TESTS: getRecentUnstarredConnections
// ============================================================================

describe("getRecentUnstarredConnections", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns empty array when not authenticated", async () => {
        mockCurrentUser.mockResolvedValue(null);

        const result = await getRecentUnstarredConnections();
        expect(result).toEqual([]);
    });

    it("excludes starred connections", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        const starred = await dbCreateConnection(dbUser.id, "Starred");
        const unstarred = await dbCreateConnection(dbUser.id, "Unstarred");

        await toggleStarConnection(encodeConnectionId(starred.id), true);

        const result = await getRecentUnstarredConnections();

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe("Unstarred");
        expect(result[0].isStarred).toBe(false);
    });
});

// ============================================================================
// TESTS: getConnectionMetadata
// ============================================================================

describe("getConnectionMetadata", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns null when not authenticated", async () => {
        mockCurrentUser.mockResolvedValue(null);

        const result = await getConnectionMetadata("abc123def");
        expect(result).toBeNull();
    });

    it("returns null for another user's connection", async () => {
        const { dbUser: owner } = await createTestUserWithClerk({
            email: "owner@example.com",
        });
        const connection = await dbCreateConnection(owner.id, "Test Title");
        const publicId = encodeConnectionId(connection.id);

        const { clerkUser: attacker } = await createTestUserWithClerk({
            email: "attacker@example.com",
        });
        mockCurrentUser.mockResolvedValue(attacker);

        const result = await getConnectionMetadata(publicId);
        expect(result).toBeNull();
    });

    it("returns title and slug for owner's connection", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        const connection = await dbCreateConnection(dbUser.id, "My Connection Title");
        const publicId = encodeConnectionId(connection.id);

        const result = await getConnectionMetadata(publicId);

        expect(result).not.toBeNull();
        expect(result!.title).toBe("My Connection Title");
        expect(result!.slug).toBeDefined();
    });

    it("returns null title when connection has no title", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        const connection = await dbCreateConnection(dbUser.id);
        const publicId = encodeConnectionId(connection.id);

        const result = await getConnectionMetadata(publicId);

        expect(result).not.toBeNull();
        expect(result!.title).toBeNull();
    });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("Edge cases", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("handles Sqid that decodes to negative number", async () => {
        const { clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        // A valid-looking Sqid that might decode to something weird
        // The Sqids library should handle this gracefully
        const result = await loadConnection("zzzzzzz");
        expect(result).toBeNull();
    });

    it("handles concurrent operations on same connection", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        const connection = await dbCreateConnection(dbUser.id);
        const publicId = encodeConnectionId(connection.id);

        // Concurrent updates should all succeed
        const results = await Promise.all([
            updateConnection(publicId, { title: "Title 1" }),
            updateConnection(publicId, { title: "Title 2" }),
            toggleStarConnection(publicId, true),
        ]);

        // All operations should return valid results
        expect(results.every((r) => r !== null)).toBe(true);
    });

    it("handles user with email but no primary email", async () => {
        // Some edge case where emailAddresses array might be empty
        mockCurrentUser.mockResolvedValue({
            id: "clerk_123",
            emailAddresses: [],
        });

        // Should fail gracefully - can't create user without email
        await expect(createNewConnection()).rejects.toThrow("Sign in to continue");
    });

    it("handles connection with maximum-length title", async () => {
        const { dbUser, clerkUser } = await createTestUserWithClerk();
        mockCurrentUser.mockResolvedValue(clerkUser);

        const longTitle = "a".repeat(500);
        const connection = await dbCreateConnection(dbUser.id, longTitle);
        const publicId = encodeConnectionId(connection.id);

        const result = await loadConnection(publicId);

        expect(result).not.toBeNull();
        expect(result!.connection.title).toBe(longTitle);
    });
});
