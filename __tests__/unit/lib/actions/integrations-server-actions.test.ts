/**
 * Integration Server Actions Tests
 *
 * Comprehensive tests for the integration server actions:
 * - connectApiKeyService: Validate, encrypt, and store API keys
 * - disconnectService: Remove integration connections
 * - deleteIntegration: Hard delete with default promotion
 * - testIntegration: Verify API key and OAuth connections
 * - setDefaultAccount: Manage default accounts per service
 * - getServicesWithStatus: List services with connection state
 * - getGroupedServices: Group services by type for multi-account UI
 *
 * Tests use mocks for external dependencies (Clerk, database, adapters)
 * to ensure isolated unit testing of business logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

// Mock Clerk currentUser before importing the module
vi.mock("@clerk/nextjs/server", () => ({
    currentUser: vi.fn(),
}));

// Mock Sentry before importing the module
vi.mock("@sentry/nextjs", () => ({
    captureException: vi.fn(),
}));

// Mock the database
vi.mock("@/lib/db", () => ({
    db: {
        transaction: vi.fn(),
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    },
    schema: {
        integrations: {
            userEmail: "userEmail",
            service: "service",
            accountId: "accountId",
            status: "status",
            isDefault: "isDefault",
            id: "id",
            connectedAt: "connectedAt",
        },
    },
}));

// Mock encryption
vi.mock("@/lib/integrations/encryption", () => ({
    encryptCredentials: vi.fn(() => "encrypted-credentials"),
    decryptCredentials: vi.fn(() => ({ apiKey: "test-api-key" })),
    isApiKeyCredentials: vi.fn(() => true),
}));

// Mock services registry
vi.mock("@/lib/integrations/services", () => ({
    getServiceById: vi.fn(),
    getAvailableServices: vi.fn(() => []),
}));

// Mock connection manager
vi.mock("@/lib/integrations/connection-manager", () => ({
    getConnectionStatus: vi.fn(),
    disconnectService: vi.fn(),
    listServiceAccounts: vi.fn(() => []),
    getCredentials: vi.fn(),
}));

// Mock integration event logging
vi.mock("@/lib/integrations/log-integration-event", () => ({
    logIntegrationEvent: vi.fn(),
}));

// Mock adapters/tools
vi.mock("@/lib/integrations/tools", () => ({
    getAdapter: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

// Now import the module under test
import {
    connectApiKeyService,
    disconnectService,
    deleteIntegration,
    testIntegration,
    setDefaultAccount,
    getServicesWithStatus,
    getGroupedServices,
} from "@/lib/actions/integrations";

import { currentUser } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { getServiceById, getAvailableServices } from "@/lib/integrations/services";
import {
    disconnectService as dbDisconnectService,
    listServiceAccounts,
    getCredentials,
    getConnectionStatus,
} from "@/lib/integrations/connection-manager";
import { logIntegrationEvent } from "@/lib/integrations/log-integration-event";
import { getAdapter } from "@/lib/integrations/tools";

// Type assertions for mocked functions
const mockCurrentUser = currentUser as Mock;
const mockGetServiceById = getServiceById as Mock;
const mockGetAvailableServices = getAvailableServices as Mock;
const mockDbDisconnectService = dbDisconnectService as Mock;
const mockListServiceAccounts = listServiceAccounts as Mock;
const mockLogIntegrationEvent = logIntegrationEvent as Mock;
const mockGetAdapter = getAdapter as Mock;
const mockGetCredentials = getCredentials as Mock;
const mockGetConnectionStatus = getConnectionStatus as Mock;
const mockCaptureException = Sentry.captureException as Mock;

// Test fixtures
const testUserEmail = "test@example.com";
const testUser = {
    id: "user_123",
    emailAddresses: [{ emailAddress: testUserEmail }],
    publicMetadata: {},
};

const mockApiKeyService = {
    id: "coinmarketcap",
    name: "CoinMarketCap",
    description: "Cryptocurrency market data",
    logo: "/logos/coinmarketcap.svg",
    authMethod: "api_key",
    status: "available",
};

const mockOAuthService = {
    id: "notion",
    name: "Notion",
    description: "Notion workspace",
    logo: "/logos/notion.svg",
    authMethod: "oauth",
    status: "available",
};

describe("Integration Server Actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: authenticated user
        mockCurrentUser.mockResolvedValue(testUser);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("connectApiKeyService", () => {
        describe("authentication checks", () => {
            it("returns error when user is not authenticated", async () => {
                mockCurrentUser.mockResolvedValue(null);

                const result = await connectApiKeyService(
                    "coinmarketcap",
                    "test-api-key"
                );

                expect(result).toEqual({
                    success: false,
                    error: "Sign in to continue",
                });
            });

            it("returns error when user has no email address", async () => {
                mockCurrentUser.mockResolvedValue({
                    id: "user_123",
                    emailAddresses: [],
                });

                const result = await connectApiKeyService(
                    "coinmarketcap",
                    "test-api-key"
                );

                expect(result).toEqual({
                    success: false,
                    error: "Sign in to continue",
                });
            });

            it("returns error when email is invalid (no @)", async () => {
                mockCurrentUser.mockResolvedValue({
                    id: "user_123",
                    emailAddresses: [{ emailAddress: "invalid-email" }],
                });

                const result = await connectApiKeyService(
                    "coinmarketcap",
                    "test-api-key"
                );

                expect(result).toEqual({
                    success: false,
                    error: "Sign in to continue",
                });
            });
        });

        describe("service validation", () => {
            it("returns error when service is not found", async () => {
                mockGetServiceById.mockReturnValue(undefined);

                const result = await connectApiKeyService(
                    "unknown-service",
                    "test-api-key"
                );

                expect(result).toEqual({
                    success: false,
                    error: "We don't recognize that service",
                });
            });

            it("returns error when service uses OAuth instead of API key", async () => {
                mockGetServiceById.mockReturnValue(mockOAuthService);

                const result = await connectApiKeyService("notion", "test-api-key");

                expect(result).toEqual({
                    success: false,
                    error: "This service connects differently—no API key needed",
                });
            });

            it("returns error when API key is empty", async () => {
                mockGetServiceById.mockReturnValue(mockApiKeyService);

                const result = await connectApiKeyService("coinmarketcap", "");

                expect(result).toEqual({
                    success: false,
                    error: "We need an API key to connect",
                });
            });

            it("returns error when API key is only whitespace", async () => {
                mockGetServiceById.mockReturnValue(mockApiKeyService);

                const result = await connectApiKeyService("coinmarketcap", "   ");

                expect(result).toEqual({
                    success: false,
                    error: "We need an API key to connect",
                });
            });
        });

        describe("adapter validation", () => {
            it("returns error and reports to Sentry when adapter is missing", async () => {
                mockGetServiceById.mockReturnValue(mockApiKeyService);
                mockGetAdapter.mockReturnValue(null);

                const result = await connectApiKeyService(
                    "coinmarketcap",
                    "test-api-key"
                );

                expect(result).toEqual({
                    success: false,
                    error: "This service isn't fully configured yet. We've been notified. 🤖",
                });
                expect(mockCaptureException).toHaveBeenCalledWith(
                    expect.any(Error),
                    expect.objectContaining({
                        level: "error",
                        tags: { component: "integrations", operation: "api_key_test" },
                    })
                );
            });

            it("returns error when adapter testConnection fails", async () => {
                mockGetServiceById.mockReturnValue(mockApiKeyService);
                mockGetAdapter.mockReturnValue({
                    testConnection: vi.fn().mockResolvedValue({
                        success: false,
                        error: "Invalid API key",
                    }),
                });

                const result = await connectApiKeyService(
                    "coinmarketcap",
                    "invalid-key"
                );

                expect(result).toEqual({
                    success: false,
                    error: "Invalid API key",
                });
            });

            it("uses default error message when adapter returns no error message", async () => {
                mockGetServiceById.mockReturnValue(mockApiKeyService);
                mockGetAdapter.mockReturnValue({
                    testConnection: vi.fn().mockResolvedValue({
                        success: false,
                    }),
                });

                const result = await connectApiKeyService(
                    "coinmarketcap",
                    "invalid-key"
                );

                expect(result).toEqual({
                    success: false,
                    error: "We couldn't verify that API key",
                });
            });

            it("continues with connection if adapter test throws unexpectedly", async () => {
                mockGetServiceById.mockReturnValue(mockApiKeyService);
                mockGetAdapter.mockReturnValue({
                    testConnection: vi
                        .fn()
                        .mockRejectedValue(new Error("Network error")),
                });

                // Mock successful database transaction
                const mockTx = {
                    select: vi.fn().mockReturnValue({
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([]),
                            }),
                        }),
                    }),
                    insert: vi.fn().mockReturnValue({
                        values: vi.fn().mockResolvedValue(undefined),
                    }),
                };
                (db.transaction as Mock).mockImplementation(async (fn) => {
                    return fn(mockTx);
                });

                const result = await connectApiKeyService(
                    "coinmarketcap",
                    "test-api-key"
                );

                // Should succeed despite test failure (logged as warning)
                expect(result).toEqual({ success: true });
                expect(mockCaptureException).toHaveBeenCalled();
            });
        });

        describe("new integration creation", () => {
            it("creates new integration when none exists", async () => {
                mockGetServiceById.mockReturnValue(mockApiKeyService);
                mockGetAdapter.mockReturnValue({
                    testConnection: vi.fn().mockResolvedValue({ success: true }),
                });

                // Mock transaction for new integration
                const mockTx = {
                    select: vi.fn().mockReturnValue({
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([]), // No existing
                            }),
                        }),
                    }),
                    insert: vi.fn().mockReturnValue({
                        values: vi.fn().mockResolvedValue(undefined),
                    }),
                };
                (db.transaction as Mock).mockImplementation(async (fn) => {
                    // First select: check existing by accountId
                    // Second select: check other connected accounts
                    mockTx.select.mockReturnValueOnce({
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([]),
                            }),
                        }),
                    });
                    mockTx.select.mockReturnValueOnce({
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockResolvedValue([]), // No other accounts
                        }),
                    });
                    return fn(mockTx);
                });

                const result = await connectApiKeyService(
                    "coinmarketcap",
                    "test-api-key"
                );

                expect(result).toEqual({ success: true });
                expect(mockLogIntegrationEvent).toHaveBeenCalledWith(
                    expect.objectContaining({
                        eventType: "connected",
                        eventSource: "user",
                    })
                );
            });

            it("sets first account as default", async () => {
                mockGetServiceById.mockReturnValue(mockApiKeyService);
                mockGetAdapter.mockReturnValue({
                    testConnection: vi.fn().mockResolvedValue({ success: true }),
                });

                let insertValues: Record<string, unknown> | null = null;
                const mockTx = {
                    select: vi.fn(),
                    insert: vi.fn().mockReturnValue({
                        values: vi.fn((vals) => {
                            insertValues = vals as Record<string, unknown>;
                            return Promise.resolve(undefined);
                        }),
                    }),
                };

                (db.transaction as Mock).mockImplementation(async (fn) => {
                    // No existing integration
                    mockTx.select.mockReturnValueOnce({
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([]),
                            }),
                        }),
                    });
                    // No other connected accounts
                    mockTx.select.mockReturnValueOnce({
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockResolvedValue([]),
                        }),
                    });
                    return fn(mockTx);
                });

                await connectApiKeyService("coinmarketcap", "test-api-key");

                expect(
                    (insertValues as unknown as { isDefault?: boolean })?.isDefault
                ).toBe(true);
            });

            it("uses account label as accountId when provided", async () => {
                mockGetServiceById.mockReturnValue(mockApiKeyService);
                mockGetAdapter.mockReturnValue({
                    testConnection: vi.fn().mockResolvedValue({ success: true }),
                });

                let insertValues: Record<string, unknown> | null = null;
                const mockTx = {
                    select: vi.fn(),
                    insert: vi.fn().mockReturnValue({
                        values: vi.fn((vals) => {
                            insertValues = vals as Record<string, unknown>;
                            return Promise.resolve(undefined);
                        }),
                    }),
                };

                (db.transaction as Mock).mockImplementation(async (fn) => {
                    mockTx.select.mockReturnValueOnce({
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([]),
                            }),
                        }),
                    });
                    mockTx.select.mockReturnValueOnce({
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockResolvedValue([]),
                        }),
                    });
                    return fn(mockTx);
                });

                await connectApiKeyService(
                    "coinmarketcap",
                    "test-api-key",
                    "work-account"
                );

                expect(
                    (insertValues as unknown as { accountId?: string })?.accountId
                ).toBe("work-account");
                expect(
                    (insertValues as unknown as { accountDisplayName?: string })
                        ?.accountDisplayName
                ).toBe("work-account");
            });
        });

        describe("reconnection (existing integration)", () => {
            it("updates existing integration on reconnection", async () => {
                mockGetServiceById.mockReturnValue(mockApiKeyService);
                mockGetAdapter.mockReturnValue({
                    testConnection: vi.fn().mockResolvedValue({ success: true }),
                });

                const existingIntegration = {
                    id: "int_123",
                    status: "error",
                    isDefault: true,
                };

                let updateCalled = false;
                const mockTx = {
                    select: vi.fn(),
                    update: vi.fn().mockReturnValue({
                        set: vi.fn().mockReturnValue({
                            where: vi.fn().mockImplementation(() => {
                                updateCalled = true;
                                return Promise.resolve(undefined);
                            }),
                        }),
                    }),
                };

                (db.transaction as Mock).mockImplementation(async (fn) => {
                    // Return existing integration
                    mockTx.select.mockReturnValueOnce({
                        from: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([existingIntegration]),
                            }),
                        }),
                    });
                    return fn(mockTx);
                });

                const result = await connectApiKeyService(
                    "coinmarketcap",
                    "test-api-key"
                );

                expect(result).toEqual({ success: true });
                expect(updateCalled).toBe(true);
                expect(mockLogIntegrationEvent).toHaveBeenCalledWith(
                    expect.objectContaining({
                        eventType: "reconnected",
                        metadata: expect.objectContaining({
                            wasReconnection: true,
                            previousStatus: "error",
                        }),
                    })
                );
            });
        });

        describe("error handling", () => {
            it("returns error and reports to Sentry when database operation fails", async () => {
                mockGetServiceById.mockReturnValue(mockApiKeyService);
                mockGetAdapter.mockReturnValue({
                    testConnection: vi.fn().mockResolvedValue({ success: true }),
                });

                const dbError = new Error("Database connection failed");
                (db.transaction as Mock).mockRejectedValue(dbError);

                const result = await connectApiKeyService(
                    "coinmarketcap",
                    "test-api-key"
                );

                expect(result).toEqual({
                    success: false,
                    error: "Database connection failed",
                });
                expect(mockCaptureException).toHaveBeenCalledWith(
                    dbError,
                    expect.objectContaining({
                        tags: {
                            component: "action",
                            action: "connect_api_key_service",
                        },
                    })
                );
            });

            it("returns generic error when error is not an Error instance", async () => {
                mockGetServiceById.mockReturnValue(mockApiKeyService);
                mockGetAdapter.mockReturnValue({
                    testConnection: vi.fn().mockResolvedValue({ success: true }),
                });

                (db.transaction as Mock).mockRejectedValue("string error");

                const result = await connectApiKeyService(
                    "coinmarketcap",
                    "test-api-key"
                );

                expect(result.success).toBe(false);
                expect(result.error).toContain(
                    "We had an error connecting that service"
                );
            });
        });
    });

    describe("disconnectService", () => {
        it("returns error when user is not authenticated", async () => {
            mockCurrentUser.mockResolvedValue(null);

            const result = await disconnectService("notion");

            expect(result).toEqual({
                success: false,
                error: "Sign in to continue",
            });
        });

        it("successfully disconnects a service", async () => {
            mockDbDisconnectService.mockResolvedValue(undefined);

            const result = await disconnectService("notion");

            expect(result).toEqual({ success: true });
            expect(mockDbDisconnectService).toHaveBeenCalledWith(
                testUserEmail,
                "notion",
                undefined
            );
            expect(mockLogIntegrationEvent).toHaveBeenCalledWith({
                userEmail: testUserEmail,
                service: "notion",
                accountId: undefined,
                eventType: "disconnected",
                eventSource: "user",
            });
        });

        it("disconnects specific account when accountId provided", async () => {
            mockDbDisconnectService.mockResolvedValue(undefined);

            const result = await disconnectService("notion", "work-account");

            expect(result).toEqual({ success: true });
            expect(mockDbDisconnectService).toHaveBeenCalledWith(
                testUserEmail,
                "notion",
                "work-account"
            );
        });

        it("returns error and reports to Sentry when disconnect fails", async () => {
            const error = new Error("Disconnect failed");
            mockDbDisconnectService.mockRejectedValue(error);

            const result = await disconnectService("notion");

            expect(result).toEqual({
                success: false,
                error: "Disconnect failed",
            });
            expect(mockCaptureException).toHaveBeenCalledWith(
                error,
                expect.objectContaining({
                    tags: {
                        component: "action",
                        action: "disconnect_service",
                    },
                })
            );
        });
    });

    describe("deleteIntegration", () => {
        it("returns error when user is not authenticated", async () => {
            mockCurrentUser.mockResolvedValue(null);

            const result = await deleteIntegration("notion", "work-account");

            expect(result).toEqual({
                success: false,
                error: "Sign in to continue",
            });
        });

        it("returns error when account not found", async () => {
            const mockTx = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([]),
                        }),
                    }),
                }),
            };
            (db.transaction as Mock).mockImplementation(async (fn) => fn(mockTx));

            const result = await deleteIntegration("notion", "nonexistent");

            expect(result).toEqual({
                success: false,
                error: "Account not found",
            });
        });

        it("deletes integration and promotes next account when deleting default", async () => {
            const accountToDelete = {
                id: "int_123",
                accountId: "work-account",
                isDefault: true,
            };
            const nextAccount = {
                id: "int_456",
                accountId: "personal-account",
                isDefault: false,
            };

            let deleteCalled = false;
            let updateCalled = false;
            const mockTx = {
                select: vi.fn(),
                delete: vi.fn().mockReturnValue({
                    where: vi.fn().mockImplementation(() => {
                        deleteCalled = true;
                        return Promise.resolve(undefined);
                    }),
                }),
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockImplementation(() => {
                            updateCalled = true;
                            return Promise.resolve(undefined);
                        }),
                    }),
                }),
            };

            (db.transaction as Mock).mockImplementation(async (fn) => {
                // First select: find account to delete
                mockTx.select.mockReturnValueOnce({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([accountToDelete]),
                        }),
                    }),
                });
                // Second select: find next account to promote
                mockTx.select.mockReturnValueOnce({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue([nextAccount]),
                            }),
                        }),
                    }),
                });
                return fn(mockTx);
            });

            const result = await deleteIntegration("notion", "work-account");

            expect(result).toEqual({ success: true });
            expect(deleteCalled).toBe(true);
            expect(updateCalled).toBe(true); // Promoted next account
            expect(mockLogIntegrationEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: "disconnected",
                    metadata: { wasDeleted: true },
                })
            );
        });

        it("deletes non-default integration without promotion", async () => {
            const accountToDelete = {
                id: "int_123",
                accountId: "secondary-account",
                isDefault: false,
            };

            let deleteCalled = false;
            let updateCalled = false;
            const mockTx = {
                select: vi.fn(),
                delete: vi.fn().mockReturnValue({
                    where: vi.fn().mockImplementation(() => {
                        deleteCalled = true;
                        return Promise.resolve(undefined);
                    }),
                }),
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockImplementation(() => {
                            updateCalled = true;
                            return Promise.resolve(undefined);
                        }),
                    }),
                }),
            };

            (db.transaction as Mock).mockImplementation(async (fn) => {
                mockTx.select.mockReturnValueOnce({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([accountToDelete]),
                        }),
                    }),
                });
                return fn(mockTx);
            });

            const result = await deleteIntegration("notion", "secondary-account");

            expect(result).toEqual({ success: true });
            expect(deleteCalled).toBe(true);
            expect(updateCalled).toBe(false); // No promotion needed
        });
    });

    describe("testIntegration", () => {
        it("returns error when user is not authenticated", async () => {
            mockCurrentUser.mockResolvedValue(null);

            const result = await testIntegration("notion");

            expect(result).toEqual({
                success: false,
                error: "Sign in to continue",
            });
        });

        it("returns error when service not found", async () => {
            mockGetServiceById.mockReturnValue(undefined);

            const result = await testIntegration("unknown-service");

            expect(result).toEqual({
                success: false,
                error: "We don't recognize that service",
            });
        });

        describe("API key services", () => {
            it("tests API key connection successfully", async () => {
                mockGetServiceById.mockReturnValue(mockApiKeyService);
                mockGetAdapter.mockReturnValue({
                    testConnection: vi.fn().mockResolvedValue({ success: true }),
                });
                mockGetCredentials.mockResolvedValue({
                    type: "api_key",
                    credentials: { apiKey: "test-api-key" },
                    accountId: "default",
                    isDefault: true,
                });

                const result = await testIntegration("coinmarketcap");

                expect(result).toEqual({ success: true });
            });

            it("returns error when adapter not found for API key service", async () => {
                mockGetServiceById.mockReturnValue(mockApiKeyService);
                mockGetAdapter.mockReturnValue(null);

                const result = await testIntegration("coinmarketcap");

                expect(result).toEqual({
                    success: false,
                    error: "Service adapter not found",
                });
            });

            it("returns error for invalid credentials type", async () => {
                mockGetServiceById.mockReturnValue(mockApiKeyService);
                mockGetAdapter.mockReturnValue({
                    testConnection: vi.fn(),
                });
                mockGetCredentials.mockResolvedValue({
                    type: "oauth", // Wrong type for API key service
                    credentials: null,
                });

                const result = await testIntegration("coinmarketcap");

                expect(result).toEqual({
                    success: false,
                    error: "Invalid credentials type",
                });
            });

            it("updates status to error when API key test fails", async () => {
                mockGetServiceById.mockReturnValue(mockApiKeyService);
                mockGetAdapter.mockReturnValue({
                    testConnection: vi.fn().mockResolvedValue({
                        success: false,
                        error: "API key expired",
                    }),
                });
                mockGetCredentials.mockResolvedValue({
                    type: "api_key",
                    credentials: { apiKey: "expired-key" },
                    accountId: "default",
                    isDefault: true,
                });

                // Mock database update
                (db.update as Mock).mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue(undefined),
                    }),
                });

                const result = await testIntegration("coinmarketcap");

                expect(result).toEqual({
                    success: false,
                    error: "API key expired",
                });
                expect(db.update).toHaveBeenCalled();
            });

            it("includes accountId in where clause when testing specific account", async () => {
                mockGetServiceById.mockReturnValue(mockApiKeyService);
                mockGetAdapter.mockReturnValue({
                    testConnection: vi.fn().mockResolvedValue({
                        success: false,
                        error: "API key revoked",
                    }),
                });
                mockGetCredentials.mockResolvedValue({
                    type: "api_key",
                    credentials: { apiKey: "revoked-key" },
                    accountId: "work-account",
                    isDefault: false,
                });

                // Mock database update to track where clause
                let whereClauseBuilt = false;
                (db.update as Mock).mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockImplementation(() => {
                            whereClauseBuilt = true;
                            return Promise.resolve(undefined);
                        }),
                    }),
                });

                const result = await testIntegration("coinmarketcap", "work-account");

                expect(result.success).toBe(false);
                expect(whereClauseBuilt).toBe(true);
            });
        });

        describe("OAuth services", () => {
            it("tests OAuth connection successfully", async () => {
                mockGetServiceById.mockReturnValue(mockOAuthService);
                mockGetAdapter.mockReturnValue({
                    testConnection: vi.fn().mockResolvedValue({ success: true }),
                });
                mockGetCredentials.mockResolvedValue({
                    type: "oauth",
                    accessToken: "valid-token",
                    accountId: "default",
                    isDefault: true,
                });

                const result = await testIntegration("notion");

                expect(result).toEqual({ success: true });
            });

            it("falls back to connection status when no adapter", async () => {
                mockGetServiceById.mockReturnValue(mockOAuthService);
                mockGetAdapter.mockReturnValue(null);
                mockGetConnectionStatus.mockResolvedValue("connected");

                const result = await testIntegration("notion");

                expect(result).toEqual({ success: true });
            });

            it("returns error with status message when fallback shows not connected", async () => {
                mockGetServiceById.mockReturnValue(mockOAuthService);
                mockGetAdapter.mockReturnValue(null);
                mockGetConnectionStatus.mockResolvedValue("error");

                const result = await testIntegration("notion");

                expect(result).toEqual({
                    success: false,
                    error: "Connection status: error",
                });
            });

            it("updates status to error when OAuth test fails", async () => {
                mockGetServiceById.mockReturnValue(mockOAuthService);
                mockGetAdapter.mockReturnValue({
                    testConnection: vi.fn().mockResolvedValue({
                        success: false,
                        error: "Token expired",
                    }),
                });
                mockGetCredentials.mockResolvedValue({
                    type: "oauth",
                    accessToken: "expired-token",
                    accountId: "default",
                    isDefault: true,
                });

                // Mock database update
                (db.update as Mock).mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue(undefined),
                    }),
                });

                const result = await testIntegration("notion");

                expect(result).toEqual({
                    success: false,
                    error: "Token expired",
                });
                expect(db.update).toHaveBeenCalled();
            });

            it("includes accountId in where clause when OAuth test fails for specific account", async () => {
                mockGetServiceById.mockReturnValue(mockOAuthService);
                mockGetAdapter.mockReturnValue({
                    testConnection: vi.fn().mockResolvedValue({
                        success: false,
                        error: "Token revoked",
                    }),
                });
                mockGetCredentials.mockResolvedValue({
                    type: "oauth",
                    accessToken: "revoked-token",
                    accountId: "work-account",
                    isDefault: false,
                });

                let whereClauseBuilt = false;
                (db.update as Mock).mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockImplementation(() => {
                            whereClauseBuilt = true;
                            return Promise.resolve(undefined);
                        }),
                    }),
                });

                const result = await testIntegration("notion", "work-account");

                expect(result.success).toBe(false);
                expect(whereClauseBuilt).toBe(true);
            });

            it("returns error when OAuth has no access token", async () => {
                mockGetServiceById.mockReturnValue(mockOAuthService);
                mockGetAdapter.mockReturnValue({
                    testConnection: vi.fn(),
                });
                mockGetCredentials.mockResolvedValue({
                    type: "oauth",
                    accessToken: null,
                    accountId: "default",
                    isDefault: true,
                });

                const result = await testIntegration("notion");

                expect(result).toEqual({
                    success: false,
                    error: "No access token found for this integration",
                });
            });
        });

        describe("error handling", () => {
            it("catches and reports unexpected errors", async () => {
                mockGetServiceById.mockReturnValue(mockApiKeyService);
                mockGetAdapter.mockReturnValue({
                    testConnection: vi
                        .fn()
                        .mockRejectedValue(new Error("Network error")),
                });
                mockGetCredentials.mockResolvedValue({
                    type: "api_key",
                    credentials: { apiKey: "test-key" },
                    accountId: "default",
                    isDefault: true,
                });

                const result = await testIntegration("coinmarketcap");

                expect(result).toEqual({
                    success: false,
                    error: "Network error",
                });
                expect(mockCaptureException).toHaveBeenCalled();
            });
        });
    });

    describe("setDefaultAccount", () => {
        it("returns error when user is not authenticated", async () => {
            mockCurrentUser.mockResolvedValue(null);

            const result = await setDefaultAccount("notion", "work-account");

            expect(result).toEqual({
                success: false,
                error: "Sign in to continue",
            });
        });

        it("returns error when target account not found", async () => {
            const mockTx = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([]),
                        }),
                    }),
                }),
            };
            (db.transaction as Mock).mockImplementation(async (fn) => fn(mockTx));

            const result = await setDefaultAccount("notion", "nonexistent");

            expect(result).toEqual({
                success: false,
                error: "Account not found",
            });
        });

        it("clears existing default and sets new default", async () => {
            const targetAccount = {
                id: "int_456",
                accountId: "work-account",
                isDefault: false,
            };

            let clearDefaultCalled = false;
            let setDefaultCalled = false;
            const mockTx = {
                select: vi.fn(),
                update: vi.fn().mockImplementation(() => ({
                    set: vi.fn().mockImplementation((values) => ({
                        where: vi.fn().mockImplementation(() => {
                            if (values.isDefault === false) {
                                clearDefaultCalled = true;
                            } else if (values.isDefault === true) {
                                setDefaultCalled = true;
                            }
                            return Promise.resolve(undefined);
                        }),
                    })),
                })),
            };

            (db.transaction as Mock).mockImplementation(async (fn) => {
                mockTx.select.mockReturnValueOnce({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([targetAccount]),
                        }),
                    }),
                });
                return fn(mockTx);
            });

            const result = await setDefaultAccount("notion", "work-account");

            expect(result).toEqual({ success: true });
            expect(clearDefaultCalled).toBe(true);
            expect(setDefaultCalled).toBe(true);
        });

        it("handles transaction errors", async () => {
            const error = new Error("Transaction failed");
            (db.transaction as Mock).mockRejectedValue(error);

            const result = await setDefaultAccount("notion", "work-account");

            expect(result).toEqual({
                success: false,
                error: "Transaction failed",
            });
            expect(mockCaptureException).toHaveBeenCalled();
        });
    });

    describe("getServicesWithStatus", () => {
        it("returns empty arrays when user is not authenticated", async () => {
            mockCurrentUser.mockResolvedValue(null);

            const result = await getServicesWithStatus();

            expect(result).toEqual({ connected: [], available: [] });
        });

        it("can accept explicit user email for server-side calls", async () => {
            mockGetAvailableServices.mockReturnValue([mockApiKeyService]);
            mockListServiceAccounts.mockResolvedValue([]);

            const result = await getServicesWithStatus("explicit@example.com");

            expect(result.available).toHaveLength(1);
            expect(mockListServiceAccounts).toHaveBeenCalledWith(
                "explicit@example.com",
                "coinmarketcap"
            );
        });

        it("filters services based on user permissions in production", async () => {
            // Override NODE_ENV for this test using vi.stubEnv
            vi.stubEnv("NODE_ENV", "production");

            mockCurrentUser.mockResolvedValue({
                ...testUser,
                publicMetadata: { showBetaIntegrations: false },
            });

            const betaService = { ...mockOAuthService, status: "beta" };
            mockGetAvailableServices.mockReturnValue([mockApiKeyService, betaService]);
            mockListServiceAccounts.mockResolvedValue([]);

            const result = await getServicesWithStatus();

            // Only available service should be visible, not beta
            expect(result.available).toHaveLength(1);
            expect(result.available[0].id).toBe("coinmarketcap");

            vi.unstubAllEnvs();
        });

        it("sorts connected services by most recent first", async () => {
            mockGetAvailableServices.mockReturnValue([
                mockApiKeyService,
                mockOAuthService,
            ]);

            // First service has older connection
            mockListServiceAccounts
                .mockResolvedValueOnce([
                    {
                        accountId: "default",
                        isDefault: true,
                        status: "connected",
                        connectedAt: new Date("2024-01-01"),
                    },
                ])
                .mockResolvedValueOnce([
                    {
                        accountId: "default",
                        isDefault: true,
                        status: "connected",
                        connectedAt: new Date("2024-06-01"),
                    },
                ]);

            const result = await getServicesWithStatus();

            expect(result.connected).toHaveLength(2);
            // More recent (Notion) should be first
            expect(result.connected[0].service.id).toBe("notion");
        });
    });

    describe("getGroupedServices", () => {
        it("returns empty array when user is not authenticated", async () => {
            mockCurrentUser.mockResolvedValue(null);

            const result = await getGroupedServices();

            expect(result).toEqual([]);
        });

        it("groups services with their accounts", async () => {
            mockGetAvailableServices.mockReturnValue([mockApiKeyService]);
            mockListServiceAccounts.mockResolvedValue([
                {
                    accountId: "work",
                    accountDisplayName: "Work Account",
                    isDefault: true,
                    status: "connected",
                    connectedAt: new Date("2024-01-01"),
                },
                {
                    accountId: "personal",
                    accountDisplayName: "Personal Account",
                    isDefault: false,
                    status: "connected",
                    connectedAt: new Date("2024-02-01"),
                },
            ]);

            const result = await getGroupedServices();

            expect(result).toHaveLength(1);
            expect(result[0].service.id).toBe("coinmarketcap");
            expect(result[0].accounts).toHaveLength(2);
        });

        it("sorts services with accounts before services without", async () => {
            mockGetAvailableServices.mockReturnValue([
                mockApiKeyService,
                mockOAuthService,
            ]);

            // First service: no accounts
            // Second service: has accounts
            mockListServiceAccounts.mockResolvedValueOnce([]).mockResolvedValueOnce([
                {
                    accountId: "default",
                    isDefault: true,
                    status: "connected",
                    connectedAt: new Date("2024-01-01"),
                },
            ]);

            const result = await getGroupedServices();

            expect(result).toHaveLength(2);
            // Service with accounts first
            expect(result[0].service.id).toBe("notion");
            expect(result[0].accounts).toHaveLength(1);
            // Service without accounts second
            expect(result[1].service.id).toBe("coinmarketcap");
            expect(result[1].accounts).toHaveLength(0);
        });

        it("sorts services with accounts by most recent connection", async () => {
            const thirdService = {
                id: "fireflies",
                name: "Fireflies",
                description: "Meeting transcripts",
                logo: "/logos/fireflies.svg",
                authMethod: "api_key",
                status: "available",
            };
            mockGetAvailableServices.mockReturnValue([
                mockApiKeyService,
                mockOAuthService,
                thirdService,
            ]);

            // All three have accounts with different connection times
            mockListServiceAccounts
                .mockResolvedValueOnce([
                    {
                        accountId: "default",
                        isDefault: true,
                        status: "connected",
                        connectedAt: new Date("2024-01-01"), // Oldest
                    },
                ])
                .mockResolvedValueOnce([
                    {
                        accountId: "default",
                        isDefault: true,
                        status: "connected",
                        connectedAt: new Date("2024-06-01"), // Newest
                    },
                ])
                .mockResolvedValueOnce([
                    {
                        accountId: "default",
                        isDefault: true,
                        status: "connected",
                        connectedAt: new Date("2024-03-01"), // Middle
                    },
                ]);

            const result = await getGroupedServices();

            expect(result).toHaveLength(3);
            // Should be sorted by most recent first
            expect(result[0].service.id).toBe("notion"); // June
            expect(result[1].service.id).toBe("fireflies"); // March
            expect(result[2].service.id).toBe("coinmarketcap"); // January
        });

        it("sorts services without accounts alphabetically", async () => {
            const thirdService = {
                id: "fireflies",
                name: "Fireflies",
                description: "Meeting transcripts",
                logo: "/logos/fireflies.svg",
                authMethod: "api_key",
                status: "available",
            };
            mockGetAvailableServices.mockReturnValue([
                mockOAuthService, // Notion
                thirdService, // Fireflies
                mockApiKeyService, // CoinMarketCap
            ]);

            // None have accounts
            mockListServiceAccounts
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            const result = await getGroupedServices();

            expect(result).toHaveLength(3);
            // Should be sorted alphabetically by name
            expect(result[0].service.name).toBe("CoinMarketCap"); // C
            expect(result[1].service.name).toBe("Fireflies"); // F
            expect(result[2].service.name).toBe("Notion"); // N
        });
    });
});
