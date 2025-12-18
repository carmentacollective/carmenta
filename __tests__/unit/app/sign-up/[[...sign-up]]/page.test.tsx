import { describe, it, expect, vi } from "vitest";

// Mock next/navigation redirect
vi.mock("next/navigation", () => ({
    redirect: vi.fn(),
}));

import SignUpPage from "@/app/sign-up/[[...sign-up]]/page";
import { redirect } from "next/navigation";

describe("SignUpPage", () => {
    it("redirects to /enter", () => {
        SignUpPage();
        expect(redirect).toHaveBeenCalledWith("/enter");
    });
});
