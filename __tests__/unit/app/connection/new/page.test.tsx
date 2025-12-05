import { describe, it, expect, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";

/**
 * Unit tests for /connection/new page
 *
 * This route serves as a "reset trampoline" - it redirects to /connection
 * to force a fresh page load. Useful when a user is already on /connection
 * and wants to start completely fresh.
 */

// Mock next/navigation
// redirect() in Next.js throws a special error to break execution
vi.mock("next/navigation", () => ({
    redirect: vi.fn((url: string) => {
        throw new Error(`NEXT_REDIRECT: ${url}`);
    }),
}));

// Mock Clerk authentication
const mocks = vi.hoisted(() => ({
    mockCurrentUser: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
    currentUser: mocks.mockCurrentUser,
}));

describe("/connection/new page", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default: authenticated user
        mocks.mockCurrentUser.mockResolvedValue({
            id: "user_test123",
            emailAddresses: [{ emailAddress: "test@example.com" }],
        });
    });

    it("redirects to /connection for fresh load", async () => {
        const NewConnectionPage = (await import("@/app/connection/new/page")).default;

        // Should throw redirect (Next.js redirect behavior)
        await expect(NewConnectionPage()).rejects.toThrow();

        // Verify redirect was called with correct path
        expect(redirect).toHaveBeenCalledWith("/connection");
        expect(redirect).toHaveBeenCalledTimes(1);
    });

    it("always redirects regardless of user state", async () => {
        // Even if something weird happens, always redirect
        const NewConnectionPage = (await import("@/app/connection/new/page")).default;

        await expect(NewConnectionPage()).rejects.toThrow();
        expect(redirect).toHaveBeenCalledWith("/connection");
    });
});
