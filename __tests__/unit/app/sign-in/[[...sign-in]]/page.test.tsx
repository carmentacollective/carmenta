import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import SignInPage, { metadata } from "@/app/sign-in/[[...sign-in]]/page";
import { ThemeProvider } from "@/lib/theme";

// Mock the Clerk SignIn component
vi.mock("@clerk/nextjs", async () => {
    const actual = await vi.importActual("@clerk/nextjs");
    return {
        ...actual,
        SignIn: () => <div data-testid="clerk-signin">SignIn Component</div>,
    };
});

describe("SignInPage", () => {
    it("renders without errors", () => {
        const { container } = render(
            <ThemeProvider>
                <SignInPage />
            </ThemeProvider>
        );
        expect(container).toBeTruthy();
    });

    it("has the expected metadata title", () => {
        expect(metadata.title).toBe("Welcome Back · Carmenta");
    });
});
