/**
 * Tests for use-is-admin hooks
 *
 * Tests admin access determination and debug welcome functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";

// Mock the user context before importing the hook
vi.mock("@/lib/auth/user-context", () => ({
    useUserContext: vi.fn(),
}));

import { useIsAdmin, useDebugWelcome } from "@/lib/hooks/use-is-admin";
import { useUserContext } from "@/lib/auth/user-context";

const mockUseUserContext = vi.mocked(useUserContext);

describe("useIsAdmin", () => {
    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();
        // Default: no user
        mockUseUserContext.mockReturnValue({
            user: null,
            isLoaded: true,
            isSignedIn: false,
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe("development environment", () => {
        it("returns true in development mode", () => {
            vi.stubEnv("NODE_ENV", "development");

            const { result } = renderHook(() => useIsAdmin());

            expect(result.current).toBe(true);
        });
    });

    describe("production environment", () => {
        beforeEach(() => {
            vi.stubEnv("NODE_ENV", "production");
        });

        it("returns false for unauthenticated user", () => {
            const { result } = renderHook(() => useIsAdmin());

            expect(result.current).toBe(false);
        });

        it("returns false for user without admin role", () => {
            mockUseUserContext.mockReturnValue({
                user: {
                    publicMetadata: { role: "user" },
                } as unknown as ReturnType<typeof useUserContext>["user"],
                isLoaded: true,
                isSignedIn: true,
            });

            const { result } = renderHook(() => useIsAdmin());

            expect(result.current).toBe(false);
        });

        it("returns true for user with admin role", () => {
            mockUseUserContext.mockReturnValue({
                user: {
                    publicMetadata: { role: "admin" },
                } as unknown as ReturnType<typeof useUserContext>["user"],
                isLoaded: true,
                isSignedIn: true,
            });

            const { result } = renderHook(() => useIsAdmin());

            expect(result.current).toBe(true);
        });

        it("returns true when URL has debug param", () => {
            // Mock window.location.search using Object.defineProperty
            const originalSearch = window.location.search;
            Object.defineProperty(window, "location", {
                value: { ...window.location, search: "?debug" },
                writable: true,
            });

            const { result } = renderHook(() => useIsAdmin());

            expect(result.current).toBe(true);

            // Restore
            Object.defineProperty(window, "location", {
                value: { ...window.location, search: originalSearch },
                writable: true,
            });
        });

        it("returns false when URL has no debug param", () => {
            const originalSearch = window.location.search;
            Object.defineProperty(window, "location", {
                value: { ...window.location, search: "" },
                writable: true,
            });

            const { result } = renderHook(() => useIsAdmin());

            expect(result.current).toBe(false);

            // Restore
            Object.defineProperty(window, "location", {
                value: { ...window.location, search: originalSearch },
                writable: true,
            });
        });
    });
});

describe("useDebugWelcome", () => {
    beforeEach(() => {
        // Clear sessionStorage
        sessionStorage.clear();
    });

    afterEach(() => {
        sessionStorage.clear();
    });

    it("returns showWelcome true on first visit", () => {
        const { result } = renderHook(() => useDebugWelcome());

        expect(result.current.showWelcome).toBe(true);
    });

    it("returns showWelcome false after being welcomed", () => {
        sessionStorage.setItem("carmenta-debug-welcomed", "true");

        const { result } = renderHook(() => useDebugWelcome());

        expect(result.current.showWelcome).toBe(false);
    });

    it("dismissWelcome sets showWelcome to false", () => {
        const { result } = renderHook(() => useDebugWelcome());

        expect(result.current.showWelcome).toBe(true);

        act(() => {
            result.current.dismissWelcome();
        });

        expect(result.current.showWelcome).toBe(false);
    });

    it("dismissWelcome persists to sessionStorage", () => {
        const { result } = renderHook(() => useDebugWelcome());

        act(() => {
            result.current.dismissWelcome();
        });

        expect(sessionStorage.getItem("carmenta-debug-welcomed")).toBe("true");
    });

    it("handles sessionStorage.setItem errors gracefully", () => {
        const { result } = renderHook(() => useDebugWelcome());

        // Mock sessionStorage.setItem to throw
        const originalSetItem = sessionStorage.setItem;
        sessionStorage.setItem = () => {
            throw new Error("Storage unavailable");
        };

        // Should not throw
        act(() => {
            result.current.dismissWelcome();
        });

        expect(result.current.showWelcome).toBe(false);

        sessionStorage.setItem = originalSetItem;
    });
});
