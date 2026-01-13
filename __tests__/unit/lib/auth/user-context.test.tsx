/**
 * Tests for user context
 *
 * Tests the UserProvider, useUserContext hook, and conditional Clerk/Mock provider selection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

// Unmock these modules so we test the real implementation
vi.unmock("@/lib/auth/user-context");
vi.unmock("@/lib/env");

// Store the original mock values so we can restore
const originalEnvMock = vi.hoisted(() => ({
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: undefined as string | undefined,
}));

// Mock the env module to control Clerk key presence
vi.mock("@/lib/env", () => ({
    env: originalEnvMock,
}));

// Track what Clerk returns for testing different user states
const clerkUserMock = vi.hoisted(() => ({
    user: null as { firstName: string; id: string } | null,
    isLoaded: true,
    isSignedIn: false as boolean | undefined,
}));

// Mock Clerk's useUser hook
vi.mock("@clerk/nextjs", () => ({
    useUser: () => clerkUserMock,
}));

import { UserProvider, useUserContext } from "@/lib/auth/user-context";

describe("UserProvider and useUserContext", () => {
    beforeEach(() => {
        // Reset to defaults
        originalEnvMock.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = undefined;
        clerkUserMock.user = null;
        clerkUserMock.isLoaded = true;
        clerkUserMock.isSignedIn = false;
    });

    afterEach(() => {
        cleanup();
    });

    function createWrapper() {
        return function Wrapper({ children }: { children: ReactNode }) {
            return <UserProvider>{children}</UserProvider>;
        };
    }

    describe("useUserContext hook", () => {
        it("throws error when used outside UserProvider", () => {
            // Suppress console.error for this test since we expect an error
            const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

            expect(() => {
                renderHook(() => useUserContext());
            }).toThrow("useUserContext must be used within UserProvider");

            consoleSpy.mockRestore();
        });

        it("returns context when used inside UserProvider", () => {
            const { result } = renderHook(() => useUserContext(), {
                wrapper: createWrapper(),
            });

            expect(result.current).toBeDefined();
            expect(result.current).toHaveProperty("user");
            expect(result.current).toHaveProperty("isLoaded");
            expect(result.current).toHaveProperty("isSignedIn");
        });
    });

    describe("without Clerk keys (MockUserProvider)", () => {
        beforeEach(() => {
            originalEnvMock.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = undefined;
        });

        it("provides null user when Clerk is not configured", () => {
            const { result } = renderHook(() => useUserContext(), {
                wrapper: createWrapper(),
            });

            expect(result.current.user).toBeNull();
        });

        it("returns isLoaded as true immediately", () => {
            const { result } = renderHook(() => useUserContext(), {
                wrapper: createWrapper(),
            });

            expect(result.current.isLoaded).toBe(true);
        });

        it("returns isSignedIn as false", () => {
            const { result } = renderHook(() => useUserContext(), {
                wrapper: createWrapper(),
            });

            expect(result.current.isSignedIn).toBe(false);
        });
    });

    describe("with Clerk keys (ClerkUserProvider)", () => {
        beforeEach(() => {
            originalEnvMock.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_12345";
        });

        it("propagates Clerk user data when signed in", () => {
            clerkUserMock.user = { firstName: "Test", id: "user_123" };
            clerkUserMock.isLoaded = true;
            clerkUserMock.isSignedIn = true;

            const { result } = renderHook(() => useUserContext(), {
                wrapper: createWrapper(),
            });

            expect(result.current.user).toEqual({ firstName: "Test", id: "user_123" });
            expect(result.current.isLoaded).toBe(true);
            expect(result.current.isSignedIn).toBe(true);
        });

        it("returns null user when not signed in", () => {
            clerkUserMock.user = null;
            clerkUserMock.isLoaded = true;
            clerkUserMock.isSignedIn = false;

            const { result } = renderHook(() => useUserContext(), {
                wrapper: createWrapper(),
            });

            expect(result.current.user).toBeNull();
            expect(result.current.isSignedIn).toBe(false);
        });

        it("propagates loading state", () => {
            clerkUserMock.isLoaded = false;
            clerkUserMock.isSignedIn = undefined; // Clerk returns undefined when loading

            const { result } = renderHook(() => useUserContext(), {
                wrapper: createWrapper(),
            });

            expect(result.current.isLoaded).toBe(false);
            // isSignedIn should default to false when undefined
            expect(result.current.isSignedIn).toBe(false);
        });

        it("handles undefined isSignedIn gracefully", () => {
            // When Clerk is still loading, isSignedIn can be undefined
            clerkUserMock.isLoaded = true;
            clerkUserMock.isSignedIn = undefined;

            const { result } = renderHook(() => useUserContext(), {
                wrapper: createWrapper(),
            });

            // Should coerce undefined to false via nullish coalescing
            expect(result.current.isSignedIn).toBe(false);
        });
    });

    describe("conditional provider selection", () => {
        it("uses MockUserProvider when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is empty string", () => {
            // Empty string should be treated as falsy
            originalEnvMock.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "";

            const { result } = renderHook(() => useUserContext(), {
                wrapper: createWrapper(),
            });

            // MockUserProvider always returns null user, isLoaded: true, isSignedIn: false
            expect(result.current.user).toBeNull();
            expect(result.current.isLoaded).toBe(true);
            expect(result.current.isSignedIn).toBe(false);
        });

        it("uses ClerkUserProvider when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY has value", () => {
            originalEnvMock.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_xyz";
            clerkUserMock.user = { firstName: "Jane", id: "user_456" };
            clerkUserMock.isSignedIn = true;

            const { result } = renderHook(() => useUserContext(), {
                wrapper: createWrapper(),
            });

            // Should get Clerk's data, not mock data
            expect(result.current.user).toEqual({ firstName: "Jane", id: "user_456" });
            expect(result.current.isSignedIn).toBe(true);
        });
    });

    describe("nested provider behavior", () => {
        it("allows child components to access user context", () => {
            originalEnvMock.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_nested";
            clerkUserMock.user = { firstName: "Nested", id: "user_nested" };
            clerkUserMock.isSignedIn = true;

            // Create a nested wrapper to simulate real app structure
            function NestedWrapper({ children }: { children: ReactNode }) {
                return (
                    <UserProvider>
                        <div>
                            <div>{children}</div>
                        </div>
                    </UserProvider>
                );
            }

            const { result } = renderHook(() => useUserContext(), {
                wrapper: NestedWrapper,
            });

            expect(result.current.user?.firstName).toBe("Nested");
        });
    });
});
