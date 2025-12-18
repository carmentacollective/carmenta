import { describe, it, expect, vi } from "vitest";

// Mock next/navigation redirect
vi.mock("next/navigation", () => ({
    redirect: vi.fn(),
}));

import SignInPage from "@/app/sign-in/[[...sign-in]]/page";
import { redirect } from "next/navigation";

describe("SignInPage", () => {
    it("redirects to /enter", () => {
        SignInPage();
        expect(redirect).toHaveBeenCalledWith("/enter");
    });
});
